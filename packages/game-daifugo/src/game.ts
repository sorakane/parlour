import {
  Fx,
  type BotPolicy,
  type CardId,
  type Flow,
  type FxEmitter,
  type GameDef,
  type LegalMove,
  type MatchResult,
  type MatchResultRank,
  type Move,
  type MoveCtx,
  type PhaseState,
  type RuleError,
  type SeatId,
  type SetupCtx,
  dealOrder,
} from '@parlour/engine';
import { daifugoHowToPlay } from './howto';
import { daifugoDeck, tryOrder, isJoker } from './deck';
import { DaifugoState, StandingSet, type DaifugoRole } from './state';
import { DaifugoRules, daifugoConfig } from './config';
import { daifugoBots } from './bots';
import { playEffects, forbiddenFinishReason } from './effects';
import {
  resolvePlay,
  type JokerAssignments,
  playableSets,
  sameSuits,
  rankStep,
  reversed,
  validateCombination,
} from './combinations';

export const GAME_ID = 'daifugo';
/** The table shell supports 2–8 seats; Daifugo fills the upper half of that ring. */
export const MIN_SEATS = 4;
export const MAX_SEATS = 8;

export {
  daifugoConfig,
  DEFAULT_TARGET_POINTS,
  MAX_TARGET_POINTS,
  MIN_TARGET_POINTS,
  type DaifugoRules,
} from './config';
export type { ExchangeMove, DaifugoRole, DaifugoState, StandingSet } from './state';
export { DAIFUGO_DECK, MAX_SET_SIZE, MIN_SET_SIZE, TWO_ORDER, orderOf } from './deck';

/** Namespaced fx accents — audio maps live in apps/web/src/lib/audio/game-cues.ts. */
export const DaifugoFx = {
  Set: 'daifugo.set', // {seat, count, rank}
  Pass: 'daifugo.pass', // {seat}
  PileClear: 'daifugo.pile-clear', // {seat, reason}
  Role: 'daifugo.role', // {seat, role, deal}
  Out: 'daifugo.out', // {seat, place}
  Exchange: 'daifugo.exchange', // {fromSeat, toSeat, count}
} as const;

const DEAL_STAGGER_MS = 32;
const SET_STAGGER_MS = 40;
const ROLE_STAGGER_MS = 140;

function error(code: string, message: string): RuleError {
  return { code, message };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function handOf(state: DaifugoState, seat: SeatId): readonly CardId[] {
  return state.hands[seat] ?? [];
}

/** Seats still holding cards in the live deal, in seat order. */
export function activeSeats(state: DaifugoState): SeatId[] {
  const out: SeatId[] = [];
  for (let seat = 0; seat < state.seats; seat++) {
    if (
      !state.finished.includes(seat) &&
      !state.eliminated.some((entry) => entry.seat === seat) &&
      handOf(state, seat).length > 0
    )
      out.push(seat);
  }
  return out;
}

function nextActiveSeat(state: DaifugoState, from: SeatId): SeatId | null {
  const active = activeSeats(state);
  const start = state.seatOrder.indexOf(from);
  for (let step = 1; step <= state.seats; step++) {
    const seat = state.seatOrder[(start + step) % state.seats]!;
    if (
      active.includes(seat) &&
      !state.lockedOut.includes(seat) &&
      !state.passedCycle.includes(seat) &&
      seat !== state.standing?.seat
    )
      return seat;
  }
  return null;
}

/** Finish-order role lookup: index 0 is daifugo, the last index is scum. */
export function roleFor(order: readonly SeatId[], seat: SeatId): DaifugoRole | null {
  const index = order.indexOf(seat);
  if (index < 0) return null;
  const last = order.length - 1;
  if (index === 0) return 'daifugo';
  if (index === 1) return 'vice';
  if (index === last) return 'scum';
  if (index === last - 1) return 'vice-scum';
  return 'neutral';
}

/** Cards a role donates from their fresh hand at the start of the next deal. */
export function giftCountFor(role: DaifugoRole, count = 2): number {
  if (role === 'scum') return count;
  if (role === 'vice-scum') return Math.max(0, count - 1);
  return 0;
}

function counterpartOf(order: readonly SeatId[], seat: SeatId): SeatId | null {
  const index = order.indexOf(seat);
  const mirrored = order.length - 1 - index;
  if (index < 0 || mirrored === index || mirrored < 0 || mirrored >= order.length) return null;
  return order[mirrored]!;
}

export function pointsForFinish(seats: number, finishIndex: number): number {
  return seats - finishIndex;
}

/** True once any seat has banked the configured target. */
export function matchOver(state: DaifugoState): boolean {
  return state.score.some((points) => points >= state.rules.targetPoints);
}

function rankingsByScore(state: DaifugoState): MatchResultRank[] {
  const ordered = state.score
    .map((points, seat) => ({ seat, points }))
    .sort((a, b) => b.points - a.points || a.seat - b.seat);
  let priorPoints: number | null = null;
  let priorRank = 0;
  return ordered.map(({ seat, points }, index) => {
    if (points !== priorPoints) priorRank = index + 1;
    priorPoints = points;
    return { seat, rank: priorRank, detail: { points } };
  });
}

export function matchResult(state: DaifugoState): MatchResult {
  const rankings = rankingsByScore(state);
  const champion = rankings.find((entry) => entry.rank === 1);
  const points = champion?.detail?.points;
  return {
    winner: typeof points === 'number' && points > 0 ? (champion!.seat as SeatId) : null,
    rankings,
    reason: 'points-target',
  };
}

export function phaseFor(state: DaifugoState): PhaseState {
  const round = state.deal + 1;
  if (state.pendingPlay)
    return {
      phase: `effect-${state.pendingPlay.effects[0]!.kind}`,
      actor: state.pendingPlay.seat,
      round,
      label: 'カード効果を選択',
    };
  if (matchOver(state)) return { phase: 'ended', actor: null, round };
  if (state.awaitingGive.length > 0) {
    return {
      phase: 'exchange-give',
      actor: state.awaitingGive[0] ?? null,
      actors: state.awaitingGive,
      round,
      label: 'card exchange',
    };
  }
  if (state.awaitingReturn) {
    return {
      phase: 'exchange-return',
      actor: state.awaitingReturn.seat,
      round,
      label: 'returning cards',
    };
  }
  return { phase: 'play', actor: state.turn, round };
}

// ---------------------------------------------------------------------------
// Dealing
// ---------------------------------------------------------------------------

function sortKey(card: CardId): number {
  const rank = tryOrder(card);
  // Handles sort after every face with a stable tiebreak, so the shared
  // veiled state hashes identically on every peer.
  return rank ?? 100 + (card.charCodeAt(2) ?? 0);
}

function sortedHand(cards: readonly CardId[]): CardId[] {
  return [...cards].sort((a, b) => sortKey(a) - sortKey(b) || a.localeCompare(b));
}

/**
 * Deals `order` round-robin starting at a seeded seat, so odd table sizes do
 * not systematically favour seat 0. Emits the opening flight timeline.
 */
function dealHands(
  seats: number,
  order: readonly CardId[],
  startSeat: SeatId,
  fx: FxEmitter,
): CardId[][] {
  const hands: CardId[][] = Array.from({ length: seats }, () => []);
  let cursor = 0;
  for (let slot = 0; slot < order.length; slot++) {
    const seat = (startSeat + slot) % seats;
    const card = order[cursor++]!;
    hands[seat]!.push(card);
    fx.emit(
      Fx.DealCard,
      { card, from: 'stock', to: `hand:${seat}`, dur: 220 },
      cursor * DEAL_STAGGER_MS,
    );
  }
  return hands.map(sortedHand);
}

function freshTrick() {
  return {
    pile: [] as CardId[],
    standing: null as StandingSet | null,
    passedCycle: [] as SeatId[],
    lockedOut: [] as SeatId[],
    jackBack: false,
    lockedSuits: [] as string[],
    rankLocked: false,
    openingCard: null as CardId | null,
  };
}

/** Every card id in play — hands, the live pile, and swept dead cards. */
function collectCards(state: DaifugoState): CardId[] {
  return [...state.hands.flat(), ...state.pile, ...state.captured];
}

/** Seats owing a gift this transition, in finish order (vice-scum before scum). */
function exchangeGivers(state: DaifugoState): SeatId[] {
  if (!state.rules.trading || state.seats < 4 || !state.lastOrder) return [];
  const order = state.lastOrder;
  return order.filter(
    (seat) => giftCountFor(roleFor(order, seat) ?? 'neutral', state.rules.exchangeCount) > 0,
  );
}

interface DealContext extends MoveCtx {
  /** Veil ceremony order — present on the opening deal of a veiled room. */
  deckOrder?: readonly CardId[];
}

/**
 * Opens a fresh deal inside the same session. The opening deal draws from the
 * ceremony deck order (a real shuffle in open rooms); later deals reshuffle
 * the conserved cards already in play, which keeps veiled rooms private —
 * opaque handles stay opaque, they merely change owner.
 */
function openDeal(state: DaifugoState, ctx: DealContext): DaifugoState {
  const pool =
    state.deal < 0
      ? dealOrder({ rng: ctx.rng, deckOrder: ctx.deckOrder }, daifugoDeck(state.rules.jokerCount))
      : collectCards(state);
  const shuffled = ctx.rng.shuffle(pool);
  const startSeat = ctx.rng.int(state.seats);
  const mid: DaifugoState = {
    ...state,
    ...freshTrick(),
    captured: [],
    revolution: false,
    eliminated: [],
    pendingPlay: null,
    seatOrder:
      state.rules.seatOrder === 'random'
        ? ctx.rng.shuffle(state.seatOrder)
        : state.rules.seatOrder === 'rank-ascending' && state.lastOrder
          ? [...state.lastOrder].reverse()
          : state.rules.seatOrder === 'rank' && state.lastOrder
            ? [...state.lastOrder]
            : state.seatOrder,
    finished: [],
    awaitingGive: [],
    awaitingReturn: null,
    exchangeLog: [],
    turn: null,
    deal: state.deal + 1,
    hands: dealHands(state.seats, shuffled, startSeat, ctx.fx),
  };
  const leader = mid.lastOrder
    ? mid.rules.nextLeader === 'random'
      ? startSeat
      : mid.rules.nextLeader === 'first'
        ? mid.lastOrder[0]!
        : mid.lastOrder[mid.lastOrder.length - 1]!
    : mid.rules.firstPlayer === 'diamond3'
      ? mid.hands.findIndex((hand) => hand.includes('D3'))
      : startSeat;
  const ready = {
    ...mid,
    dealLeader: leader,
    openingCard: !mid.lastOrder && mid.rules.firstPlayer === 'diamond3' ? 'D3' : null,
  };
  const givers = exchangeGivers(ready);
  if (givers.length > 0) return { ...ready, awaitingGive: givers };
  ctx.fx.emit(Fx.TurnRing, { seat: leader }, 80);
  return { ...ready, turn: leader };
}

/** Awards position points, crowns roles, and closes the finished deal. */
function completeDeal(state: DaifugoState, ctx: MoveCtx): DaifugoState {
  const finished = [...state.finished];
  for (const seat of activeSeats(state)) finished.push(seat);
  for (const entry of [...state.eliminated].reverse())
    if (!finished.includes(entry.seat)) finished.push(entry.seat);
  const score = state.score.slice();
  finished.forEach((seat, index) => {
    score[seat] = (score[seat] ?? 0) + pointsForFinish(state.seats, index);
  });
  finished.forEach((seat, index) => {
    const role = roleFor(finished, seat) ?? 'neutral';
    ctx.fx.emit(DaifugoFx.Role, { seat, role, deal: state.deal }, index * ROLE_STAGGER_MS);
  });
  ctx.fx.emit(Fx.RoundEnd, { reason: 'deal-complete' }, finished.length * ROLE_STAGGER_MS);
  return {
    ...state,
    ...freshTrick(),
    captured: [...state.captured, ...state.pile],
    finished,
    score,
    lastOrder: finished,
    pendingPlay: null,
    awaitingGive: [],
    awaitingReturn: null,
    exchangeLog: [],
    turn: null,
  };
}

// ---------------------------------------------------------------------------
// Payload helpers
// ---------------------------------------------------------------------------

function payloadCardList(payload: unknown): CardId[] | null {
  const raw = (payload as { cards?: unknown } | undefined)?.cards;
  if (!Array.isArray(raw)) return null;
  const cards: CardId[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string' || entry.length === 0) return null;
    cards.push(entry);
  }
  return cards;
}

function heldOnce(hand: readonly CardId[], cards: readonly CardId[]): boolean {
  const seen = new Set<CardId>();
  for (const card of cards) {
    if (!hand.includes(card) || seen.has(card)) return false;
    seen.add(card);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

/** Rivals who may still respond to the standing set during this trick. */
function undecidedRivals(state: DaifugoState): SeatId[] {
  if (!state.standing) return [];
  const winner = state.standing.seat;
  return activeSeats(state).filter(
    (seat) =>
      seat !== winner && !state.passedCycle.includes(seat) && !state.lockedOut.includes(seat),
  );
}

function removeFromHand(
  hands: readonly (readonly CardId[])[],
  seat: SeatId,
  cards: readonly CardId[],
): CardId[][] {
  return hands.map((hand, index) =>
    index === seat ? hand.filter((card) => !cards.includes(card)) : [...hand],
  );
}

function addToHand(
  hands: readonly (readonly CardId[])[],
  seat: SeatId,
  cards: readonly CardId[],
): CardId[][] {
  return hands.map((hand, index) => (index === seat ? sortedHand([...hand, ...cards]) : [...hand]));
}

/**
 * Sweeps a won pile and seats the next leader. A winner who just went out
 * hands the lead to the next active seat clockwise.
 */
function sweepPile(
  state: DaifugoState,
  winner: SeatId,
  reason: string,
  ctx: MoveCtx,
): DaifugoState {
  ctx.fx.emit(DaifugoFx.PileClear, { seat: winner, reason });
  const swept: DaifugoState = {
    ...state,
    ...freshTrick(),
    captured: [...state.captured, ...state.pile],
  };
  const leader = activeSeats(swept).includes(winner) ? winner : nextActiveSeat(swept, winner);
  return { ...swept, turn: leader };
}

/** Recipient order ignores passes: a passed player can still receive cards. */
function nextLivingSeat(state: DaifugoState, from: SeatId): SeatId | null {
  const active = activeSeats(state);
  const index = state.seatOrder.indexOf(from);
  for (let step = 1; step < state.seats; step++) {
    const seat = state.seatOrder[(index + step) % state.seats]!;
    if (active.includes(seat)) return seat;
  }
  return null;
}
function eliminate(state: DaifugoState, seat: SeatId, reason: string, ctx: MoveCtx): DaifugoState {
  if (state.finished.includes(seat) || state.eliminated.some((entry) => entry.seat === seat))
    return state;
  ctx.fx.emit('daifugo.eliminated', { seat, reason });
  return {
    ...state,
    hands: state.hands.map((hand, index) => (index === seat ? [] : hand)),
    captured: [...state.captured, ...handOf(state, seat)],
    eliminated: [...state.eliminated, { seat, reason }],
  };
}
/** Suspend before advancing turns. Everything needed to resume lives in the replay state. */
function continuePlay(state: DaifugoState, ctx: MoveCtx): DaifugoState {
  const pending = state.pendingPlay!;
  const effect = pending.effects[0];
  if (effect && handOf(state, pending.seat).length > 0) {
    return {
      ...state,
      turn: pending.seat,
      pendingPlay: {
        ...pending,
        effects: [
          { ...effect, count: Math.min(effect.count, handOf(state, pending.seat).length) },
          ...pending.effects.slice(1),
        ],
      },
    };
  }
  let next: DaifugoState = { ...state, pendingPlay: null };
  const seat = pending.seat;
  if (!handOf(next, seat).length) {
    if (pending.forbiddenReason)
      next = eliminate(next, seat, `反則：${pending.forbiddenReason}`, ctx);
    else {
      next = { ...next, finished: [...next.finished, seat] };
      ctx.fx.emit(DaifugoFx.Out, { seat, place: next.finished.length }, SET_STAGGER_MS * 2);
      const previousWinner = next.lastOrder?.[0];
      if (
        next.rules.miyako &&
        next.finished.length === 1 &&
        previousWinner !== undefined &&
        previousWinner !== seat
      )
        next = eliminate(next, previousWinner, '都落ち', ctx);
    }
  }
  if (activeSeats(next).length <= 1) return completeDeal(next, ctx);
  if (pending.clearReason || undecidedRivals(next).length === 0) {
    next = sweepPile(next, seat, pending.clearReason ?? 'passed-out', ctx);
  } else {
    let actor = nextActiveSeat(next, seat);
    for (let i = 0; i < pending.skips && actor !== null; i++) {
      next = { ...next, passedCycle: [...next.passedCycle, actor] };
      actor = nextActiveSeat(next, actor);
    }
    next = actor === null ? sweepPile(next, seat, 'skipped-out', ctx) : { ...next, turn: actor };
  }
  ctx.fx.emit(Fx.TurnRing, { seat: next.turn ?? seat }, 80);
  return next;
}

const resolveEffect: Move<DaifugoState> = {
  validate(state, seat, payload) {
    const pending = state.pendingPlay;
    if (!pending || pending.seat !== seat)
      return error('no-effect', 'この人のカード選択待ちではありません。');
    const cards = payloadCardList(payload);
    if (!cards || cards.length !== pending.effects[0]!.count)
      return error('wrong-count', `${pending.effects[0]!.count}枚選んでください。`);
    if (!heldOnce(handOf(state, seat), cards))
      return error('not-in-hand', '手札から重複しないカードを選んでください。');
    return true;
  },
  apply(state, seat, payload, ctx) {
    const cards = payloadCardList(payload)!;
    const pending = state.pendingPlay!;
    const effect = pending.effects[0]!;
    let hands = removeFromHand(state.hands, seat, cards);
    let captured = state.captured;
    if (effect.kind === 'give') {
      hands = addToHand(hands, effect.recipient!, cards);
      exchangeFlight(ctx, seat, effect.recipient!, cards);
    } else {
      captured = [...captured, ...cards];
      cards.forEach((card, index) =>
        ctx.fx.emit(Fx.DiscardCard, { card, seat, to: 'discard' }, index * SET_STAGGER_MS),
      );
    }
    ctx.fx.emit('daifugo.effect', {
      seat,
      kind: effect.kind,
      count: cards.length,
      recipient: effect.recipient,
    });
    return continuePlay(
      {
        ...state,
        hands,
        captured,
        pendingPlay: {
          ...pending,
          effects: pending.effects.slice(1),
          forbiddenReason:
            hands[seat]!.length === 0 && state.rules.forbidEffectFinish
              ? '効果での上がり'
              : pending.forbiddenReason,
        },
      },
      ctx,
    );
  },
};

const playSet: Move<DaifugoState> = {
  validate(state, seat, payload) {
    if (phaseFor(state).phase !== 'play') {
      return error('not-playing', 'the table is not accepting plays right now');
    }
    if (state.turn !== seat) return error('not-your-turn', 'it is another seat’s turn');
    const cards = payloadCardList(payload);
    if (!cards || cards.length === 0) return error('bad-payload', 'expected {cards: string[]}');
    if (!heldOnce(handOf(state, seat), cards)) {
      return error('not-in-hand', 'every played card must be held once');
    }
    if (state.lockedOut.includes(seat) || state.passedCycle.includes(seat))
      return error('locked-out', 'この場はパス済みです。');
    return validateCombination(state, cards, (payload as { jokerAs?: JokerAssignments }).jokerAs);
  },
  apply(state, seat, payload, ctx) {
    const cards = payloadCardList(payload)!;
    const jokerAs = (payload as { jokerAs?: JokerAssignments }).jokerAs;
    const resolved = resolvePlay(state, cards, jokerAs)!;
    const set = resolved.set;
    const effects = playEffects(state, cards, jokerAs);
    const hands = removeFromHand(state.hands, seat, cards);
    cards.forEach((card, index) =>
      ctx.fx.emit(Fx.DiscardCard, { card, seat, to: 'discard' }, index * SET_STAGGER_MS),
    );
    ctx.fx.emit(DaifugoFx.Set, { seat, count: cards.length, rank: set.rank, kind: set.kind });
    const matchingSuits = state.standing && sameSuits(state.standing.suits, set.suits);
    const adjacent =
      state.standing &&
      set.rank === state.standing.rank + (reversed(state) ? -1 : 1) * rankStep(state);
    const recipient = nextLivingSeat(state, seat);
    const next: DaifugoState = {
      ...state,
      hands,
      pile: [...state.pile, ...cards],
      standing: { seat, cards, ...set, effectiveCards: resolved.effectiveCards },
      openingCard: null,
      revolution: effects.revolution ? !state.revolution : state.revolution,
      jackBack: effects.jackBack ? !state.jackBack : state.jackBack,
      lockedSuits:
        (state.rules.suitLock || (state.rules.strictLock && adjacent)) && matchingSuits
          ? set.suits
          : state.lockedSuits,
      rankLocked:
        state.rankLocked ||
        Boolean(adjacent && (state.rules.numberLock || (state.rules.strictLock && matchingSuits))),
      passedCycle: [],
      pendingPlay: {
        seat,
        clearReason: effects.clearReason,
        skips: effects.skips,
        forbiddenReason:
          hands[seat]!.length === 0 ? forbiddenFinishReason(state, cards, jokerAs) : null,
        effects: [
          ...(effects.give && recipient !== null
            ? [{ kind: 'give' as const, count: effects.give, recipient }]
            : []),
          ...(effects.discard
            ? [{ kind: 'discard' as const, count: effects.discard, recipient: null }]
            : []),
        ],
      },
    };
    return continuePlay(next, ctx);
  },
};

const pass: Move<DaifugoState> = {
  validate(state, seat) {
    if (phaseFor(state).phase !== 'play') return error('not-playing', 'nothing to pass on');
    if (state.turn !== seat) return error('not-your-turn', 'it is another seat’s turn');
    if (!state.standing) return error('lead-required', 'the leader must open the trick');
    if (state.passedCycle.includes(seat))
      return error('already-passed', 'this seat already passed');
    if (state.lockedOut.includes(seat)) return error('locked-out', 'this seat is out of the trick');
    return true;
  },
  apply(state, seat, _payload, ctx) {
    ctx.fx.emit(DaifugoFx.Pass, { seat });
    let next: DaifugoState = {
      ...state,
      passedCycle: [...state.passedCycle, seat],
      lockedOut: state.rules.passLocks ? [...state.lockedOut, seat] : state.lockedOut,
    };
    if (undecidedRivals(next).length === 0 && next.standing) {
      const winner = next.standing.seat;
      next = sweepPile(next, winner, 'passed-out', ctx);
    } else {
      next = { ...next, turn: nextActiveSeat(next, seat) };
    }
    ctx.fx.emit(Fx.TurnRing, { seat: next.turn ?? seat }, 80);
    return next;
  },
};

function exchangeFlight(ctx: MoveCtx, from: SeatId, to: SeatId, cards: readonly CardId[]): void {
  cards.forEach((card, index) => {
    ctx.fx.emit(
      Fx.DealCard,
      { card, from: `seat:${from}`, to: `hand:${to}`, dur: 200 },
      index * 60,
    );
  });
  ctx.fx.emit(DaifugoFx.Exchange, { fromSeat: from, toSeat: to, count: cards.length });
}

const giveCards: Move<DaifugoState> = {
  validate(state, seat, payload) {
    if (!state.lastOrder) return error('no-roles', 'no roles exist yet');
    if (!state.awaitingGive.includes(seat)) return error('not-giving', 'this seat owes no gift');
    const cards = payloadCardList(payload);
    if (!cards) return error('bad-payload', 'expected {cards: string[]}');
    const role = roleFor(state.lastOrder, seat);
    const expected = giftCountFor(role ?? 'neutral', state.rules.exchangeCount);
    if (cards.length !== expected) {
      return error('wrong-count', `this seat gives ${expected} card(s)`);
    }
    if (!heldOnce(handOf(state, seat), cards)) {
      return error('not-in-hand', 'gifts must come from the giver’s own hand');
    }
    if (state.rules.excludeJokersFromExchange && cards.some(isJoker))
      return error('joker-exchange', 'ジョーカーを除いて強い順に選んでください。');
    const strongest = handOf(state, seat)
      .filter((card) => !state.rules.excludeJokersFromExchange || !isJoker(card))
      .map((card) => tryOrder(card) ?? 0)
      .sort((a, b) => b - a)
      .slice(0, expected);
    const chosen = cards.map((card) => tryOrder(card) ?? 0).sort((a, b) => b - a);
    if (strongest.some((rank, i) => rank !== chosen[i]))
      return error(
        'strongest-required',
        '強い順のカードを渡してください（同じ強さならスートは自由）。',
      );
    return true;
  },
  apply(state, seat, payload, ctx) {
    const cards = payloadCardList(payload)!;
    const order = state.lastOrder!;
    const recipient = counterpartOf(order, seat)!;
    exchangeFlight(ctx, seat, recipient, cards);
    let next: DaifugoState = {
      ...state,
      hands: addToHand(removeFromHand(state.hands, seat, cards), recipient, cards),
      exchangeLog: [...state.exchangeLog, { from: seat, to: recipient, cards }],
      awaitingGive: state.awaitingGive.filter((giver) => giver !== seat),
    };
    if (next.awaitingGive.length === 0) {
      next = { ...next, awaitingReturn: { seat: order[0]!, count: state.rules.exchangeCount } };
      ctx.fx.emit(Fx.TurnRing, { seat: order[0]! }, 60);
    }
    return next;
  },
};

const returnCards: Move<DaifugoState> = {
  validate(state, seat, payload) {
    if (state.awaitingReturn?.seat !== seat) {
      return error('not-returning', 'this seat owes no return');
    }
    const cards = payloadCardList(payload);
    if (!cards) return error('bad-payload', 'expected {cards: string[]}');
    if (cards.length !== state.awaitingReturn.count) {
      return error('wrong-count', `this seat returns ${state.awaitingReturn.count} card(s)`);
    }
    if (!heldOnce(handOf(state, seat), cards)) {
      return error('not-in-hand', 'returns must come from the returner’s own hand');
    }
    return true;
  },
  apply(state, seat, payload, ctx) {
    const cards = payloadCardList(payload)!;
    const order = state.lastOrder!;
    const recipient = counterpartOf(order, seat)!;
    exchangeFlight(ctx, seat, recipient, cards);
    let next: DaifugoState = {
      ...state,
      hands: addToHand(removeFromHand(state.hands, seat, cards), recipient, cards),
      exchangeLog: [...state.exchangeLog, { from: seat, to: recipient, cards }],
    };
    const returningVice = seat === order[1] || state.rules.exchangeCount === 1;
    next = returningVice
      ? { ...next, awaitingReturn: null }
      : {
          ...next,
          awaitingReturn:
            order[1] !== undefined
              ? { seat: order[1]!, count: state.rules.exchangeCount - 1 }
              : null,
        };
    if (next.awaitingReturn === null) {
      next = { ...next, turn: next.dealLeader };
      ctx.fx.emit(Fx.TurnRing, { seat: next.dealLeader }, 60);
    }
    return next;
  },
};

/** Automatic-only: opens the next deal once every seat has finished. */
const openNextDeal: Move<DaifugoState> = {
  validate(state) {
    return state.finished.length >= state.seats
      ? true
      : error('deal-not-finished', 'the current deal is still live');
  },
  apply(state, _seat, _payload, ctx) {
    return openDeal(state, ctx);
  },
};

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

function legalMovesForSeat(
  state: DaifugoState,
  phase: PhaseState,
  seat: SeatId,
): readonly LegalMove[] {
  switch (phase.phase) {
    case 'play': {
      if (state.turn !== seat) return [];
      const sets = playableSets(state, seat).map((cards) => ({
        id: 'playSet',
        payload: { cards },
        hint: `${cards.length}枚`,
      }));
      return state.standing && pass.validate(state, seat, undefined) === true
        ? [...sets, { id: 'pass' }]
        : sets;
    }
    case 'effect-give':
    case 'effect-discard':
      return phase.actor === seat ? [{ id: 'resolveEffect' }] : [];
    case 'exchange-give':
      return (phase.actors ?? []).includes(seat) ? [{ id: 'giveCards' }] : [];
    case 'exchange-return':
      return phase.actor === seat ? [{ id: 'returnCards' }] : [];
    default:
      return [];
  }
}

const flow: Flow<DaifugoState> = {
  start(state) {
    return phaseFor(state);
  },
  legalMovesFor: legalMovesForSeat,
  legalMoves(state, phase) {
    const actors =
      phase.actors && phase.actors.length > 0
        ? phase.actors
        : phase.actor !== null
          ? [phase.actor]
          : [];
    return actors.flatMap((seat) => legalMovesForSeat(state, phase, seat));
  },
  advance(state) {
    if (matchOver(state)) {
      return { phase: phaseFor(state), ended: matchResult(state) };
    }
    if (state.finished.length >= state.seats) {
      return {
        phase: {
          phase: 'deal-open',
          actor: null,
          round: state.deal + 2,
          label: 'dealing next',
        },
        autoMoves: [{ seat: null, move: 'openNextDeal', reason: 'deal-complete' }],
      };
    }
    return { phase: phaseFor(state) };
  },
};

// ---------------------------------------------------------------------------
// Setup & definition
// ---------------------------------------------------------------------------

function initialState(seats: number, rules: DaifugoRules): DaifugoState {
  return {
    seats,
    seatOrder: Array.from({ length: seats }, (_, seat) => seat),
    revolution: false,
    eliminated: [],
    pendingPlay: null,
    dealLeader: 0,
    rules,
    score: Array.from({ length: seats }, () => 0),
    deal: -1,
    hands: Array.from({ length: seats }, () => [] as CardId[]),
    ...freshTrick(),
    captured: [],
    finished: [],
    lastOrder: null,
    awaitingGive: [],
    awaitingReturn: null,
    exchangeLog: [],
    turn: null,
  };
}

function setup(ctx: SetupCtx<DaifugoRules>): DaifugoState {
  const { config, seats } = ctx;
  if (!Number.isInteger(seats) || seats < MIN_SEATS || seats > MAX_SEATS) {
    throw new Error(`daifugo requires ${MIN_SEATS}–${MAX_SEATS} seats`);
  }
  // openDeal reads only rng/fx/deckOrder from the setup context.
  return openDeal(initialState(seats, config), {
    rng: ctx.rng,
    fx: ctx.fx,
    event: { seq: -1 },
    deckOrder: ctx.deckOrder,
  });
}

export function createDaifugoDef(
  options: { bots?: readonly BotPolicy<DaifugoState>[] } = {},
): GameDef<DaifugoState, DaifugoRules> {
  return {
    id: GAME_ID,
    howToPlay: daifugoHowToPlay,
    configSchema: daifugoConfig,
    setup,
    moves: { playSet, pass, resolveEffect, giveCards, returnCards, openNextDeal },
    flow,
    playerView(state, seat) {
      return {
        ...state,
        exchangeLog: state.exchangeLog.map((entry) => ({
          ...entry,
          cards:
            entry.from === seat || entry.to === seat ? entry.cards : entry.cards.map(() => '??'),
        })),
        hands: state.hands.map((cards, index) =>
          index === seat ? cards.slice() : cards.map(() => '??'),
        ),
      };
    },
    end(state) {
      return matchOver(state) ? matchResult(state) : null;
    },
    bots: options.bots ?? daifugoBots,
  };
}

export const daifugoGame = createDaifugoDef();
