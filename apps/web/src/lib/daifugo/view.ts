import type { LegalMove } from '@parlour/engine';
import {
  MAX_SET_SIZE,
  validateCombination,
  MIN_SEATS,
  roleFor,
  giftCountFor,
  type DaifugoState,
} from '@parlour/game-daifugo';
import { getDaifugoMode, type DaifugoModeId } from '@/lib/daifugo/modes';
import type { DaifugoPlayer, DaifugoSnapshot } from '@/lib/solo/DaifugoTransport';

export type DaifugoDecision = 'lead-or-follow' | 'pass-only' | 'give' | 'return';

export interface DaifugoSeatView extends DaifugoPlayer {
  handCount: number;
  score: number;
  isLocal: boolean;
  /** role from the previous deal's finish order — null before any deal completed */
  role: string | null;
}

export interface PileSetView {
  seat: number;
  cards: readonly string[];
  rank: number;
  suits: readonly string[];
  jokerOnly: boolean;
}

export interface DaifugoTableView {
  players: readonly DaifugoSeatView[];
  localSeat: number;
  activeSeat: number | null;
  dealNumber: number;
  phaseLabel: string;
  mode: DaifugoModeId;
  targetPoints: number;
  rules: DaifugoState['rules'];
  revolution: boolean;
  jackBack: boolean;
  lockedSuits: readonly string[];
  openingCard: string | null;
  seatOrder: readonly number[];
  /** current trick, oldest first */
  pile: readonly PileSetView[];
  standing: PileSetView | null;
  hand: readonly string[];
  decision: DaifugoDecision | null;
  /** exchange sizes for the local seat this transition */
  giveCount: number;
  returnCount: number;
  legal: {
    /** cards that can participate in some legal set right now */
    playableCards: readonly string[];
    pass: boolean;
    give: boolean;
    returnCards: boolean;
  };
  finishedOrder: readonly number[];
}

function pileSets(state: DaifugoState): PileSetView[] {
  return state.standing ? [state.standing] : [];
}

/**
 * Pure snapshot → render model for the Daifugo table. `legal` must be the
 * moves the transport currently offers the local seat; while others act it
 * should be empty.
 */
export function daifugoTableView(
  snapshot: DaifugoSnapshot,
  legal: readonly LegalMove[],
  localSeat = 0,
): DaifugoTableView {
  const { session } = snapshot;
  const state = session.state;
  const isLocalTurn =
    session.status === 'playing' &&
    (session.phase.actor === localSeat || (session.phase.actors ?? []).includes(localSeat));
  const offered = isLocalTurn ? legal : [];

  const hasGive = offered.some((move) => move.id === 'giveCards');
  const hasReturn = offered.some((move) => move.id === 'returnCards');
  const setMoves = offered.filter((move) => move.id === 'playSet');

  // A card is playable when some enumerated set contains it.
  const playable = new Set<string>();
  for (const move of setMoves) {
    const raw = (move.payload as { cards?: readonly string[] } | undefined)?.cards;
    if (Array.isArray(raw)) for (const card of raw) playable.add(card);
  }

  const order = state.lastOrder;
  const players = snapshot.players.map((player) => ({
    ...player,
    handCount: state.hands[player.seat]?.length ?? 0,
    score: state.score[player.seat] ?? 0,
    isLocal: player.seat === localSeat,
    role: order ? (roleFor(order, player.seat) ?? null) : null,
  }));

  const giveCount = hasGive
    ? giftCountFor(roleFor(order ?? [], localSeat) ?? 'neutral', state.rules.exchangeCount)
    : 0;
  const returnCount = hasReturn ? (state.awaitingReturn?.count ?? 0) : 0;

  const decision: DaifugoDecision | null = !isLocalTurn
    ? null
    : hasGive
      ? 'give'
      : hasReturn
        ? 'return'
        : state.turn === localSeat
          ? 'lead-or-follow'
          : null;

  const standingView: PileSetView | null = state.standing
    ? {
        seat: state.standing.seat,
        cards: state.standing.cards,
        rank: state.standing.rank,
        suits: state.standing.suits,
        jokerOnly: state.standing.jokerOnly,
      }
    : null;

  const modeName = getDaifugoMode(snapshot.mode).name;
  let phaseLabel = `${modeName} · 第${state.deal + 1}ゲーム`;
  if (session.status !== 'playing') phaseLabel = 'マッチ終了';
  else if (decision === 'give' || decision === 'return') phaseLabel = 'カード交換';
  const effects = [
    state.revolution ? '革命' : '',
    state.jackBack ? '11バック' : '',
    state.lockedSuits.length ? `${state.lockedSuits.join('・')}縛り` : '',
  ].filter(Boolean);
  if (effects.length) phaseLabel += ` · ${effects.join(' / ')}`;

  return {
    players,
    localSeat,
    activeSeat: session.phase.actor,
    dealNumber: state.deal + 1,
    phaseLabel,
    mode: snapshot.mode,
    targetPoints: state.rules.targetPoints,
    rules: state.rules,
    revolution: state.revolution,
    jackBack: state.jackBack,
    lockedSuits: state.lockedSuits,
    openingCard: state.openingCard,
    seatOrder: state.seatOrder,
    pile: pileSets(state),
    standing: standingView,
    hand: state.hands[localSeat] ?? [],
    decision,
    giveCount,
    returnCount,
    legal: {
      playableCards: [...playable],
      pass: offered.some((move) => move.id === 'pass'),
      give: hasGive,
      returnCards: hasReturn,
    },
    finishedOrder: state.finished,
  };
}

/** Client-side check for a hand-picked set before sending it to the engine. */
export function isValidLocalSet(view: DaifugoTableView, cards: readonly string[]): boolean {
  if (cards.length < 1 || cards.length > MAX_SET_SIZE) return false;
  const seen = new Set(cards);
  if (seen.size !== cards.length) return false;
  if (!cards.every((card) => view.hand.includes(card))) return false;
  return validateCombination(view, cards) === true;
}

export function minDaifugoSeats(): number {
  return MIN_SEATS;
}
