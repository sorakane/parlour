import type { CardId, RuleError } from '@parlour/engine';
import { isDaifugoCard, isJoker, orderOf, MAX_PLAY_SIZE, MAX_SET_SIZE } from './deck';
import type { DaifugoState } from './state';
import type { DaifugoRules } from './config';

export interface Combination {
  kind: 'set' | 'run';
  rank: number;
  high: number;
  suits: string[];
  jokerOnly: boolean;
}
export const reversed = (state: Pick<DaifugoState, 'revolution' | 'jackBack'>) =>
  state.revolution !== state.jackBack;

export type JokerAssignments = Readonly<Record<string, string>>;
export type PlayContext = Pick<DaifugoState, 'rules' | 'standing' | 'revolution' | 'jackBack'> &
  Partial<Pick<DaifugoState, 'lockedSuits' | 'openingCard' | 'rankLocked'>>;
export interface ResolvedPlay {
  set: Combination;
  effectiveCards: readonly CardId[];
}

const suits = ['C', 'D', 'H', 'S'];
const faceId = (suit: string, rank: number) => `${suit}${rank === 14 ? 1 : rank === 15 ? 2 : rank}`;

export function validJokerAssignments(cards: readonly CardId[], assignments: unknown): boolean {
  return (
    assignments === undefined ||
    (assignments !== null &&
      typeof assignments === 'object' &&
      !Array.isArray(assignments) &&
      Object.entries(assignments).every(
        ([key, value]) =>
          isJoker(key) &&
          cards.includes(key) &&
          typeof value === 'string' &&
          isDaifugoCard(value) &&
          !isJoker(value),
      ))
  );
}

/** All interpretations are bounded by the 13 ranks, not 52^number-of-jokers. */
function interpretations(
  cards: readonly CardId[],
  rules?: DaifugoRules,
  assignments: JokerAssignments = {},
): ResolvedPlay[] {
  if (
    !cards.length ||
    cards.length > MAX_PLAY_SIZE ||
    new Set(cards).size !== cards.length ||
    !cards.every(isDaifugoCard) ||
    !validJokerAssignments(cards, assignments)
  )
    return [];
  const fixed = cards
    .filter((card) => !isJoker(card) || assignments[card])
    .map((card) => assignments[card] ?? card);
  const wild = cards.filter((card) => isJoker(card) && !assignments[card]);
  const ranks = fixed.map(orderOf).sort((a, b) => a - b);
  const out: ResolvedPlay[] = [];
  if (cards.length <= MAX_SET_SIZE && ranks.every((rank) => rank === ranks[0])) {
    const rank = ranks[0] ?? 16;
    const effectiveCards = [
      ...fixed,
      ...wild.map((card, i) =>
        rank === 16
          ? card
          : faceId(suits.filter((suit) => !fixed.some((c) => c[0] === suit))[i] ?? 'C', rank),
      ),
    ];
    out.push({
      set: {
        kind: 'set',
        rank,
        high: rank,
        suits: wild.length ? [] : fixed.map((card) => card[0]!).sort(),
        jokerOnly: rank === 16,
      },
      effectiveCards,
    });
  }
  if (
    !rules?.stairs ||
    cards.length < rules.stairsMin ||
    !fixed.length ||
    (cards.some(isJoker) && !rules.stairsJoker) ||
    new Set(ranks).size !== ranks.length ||
    !fixed.every((card) => card[0] === fixed[0]![0])
  )
    return out;
  const suit = fixed[0]![0]!;
  for (let low = 3; low + cards.length - 1 <= (rules.stairsTwo ? 15 : 14); low++) {
    const high = low + cards.length - 1;
    if (!ranks.every((rank) => rank >= low && rank <= high)) continue;
    const missing = Array.from({ length: cards.length }, (_, i) => low + i).filter(
      (rank) => !ranks.includes(rank),
    );
    if (missing.length !== wild.length) continue;
    out.push({
      set: { kind: 'run', rank: low, high, suits: [suit], jokerOnly: false },
      effectiveCards: [...fixed, ...missing.map((rank) => faceId(suit, rank))],
    });
  }
  return out;
}

export function combination(cards: readonly CardId[], rules?: DaifugoRules): Combination | null {
  return interpretations(cards, rules)[0]?.set ?? null;
}

/** Prefer the weakest valid interpretation, while an unassigned lone joker stays strongest. */
export function resolvePlay(
  state: PlayContext,
  cards: readonly CardId[],
  assignments: JokerAssignments = {},
): ResolvedPlay | null {
  let choices = interpretations(cards, state.rules, assignments);
  // A free joker can represent the required next rank under a rank lock.
  if (
    state.rankLocked &&
    state.standing &&
    cards.every(isJoker) &&
    !Object.keys(assignments).length
  ) {
    const rank = state.standing.rank + (reversed(state) ? -1 : 1) * rankStep(state);
    if (rank >= 3 && rank <= 15)
      choices = interpretations(
        cards,
        state.rules,
        Object.fromEntries(
          cards.map((card, i) => [card, faceId(state.lockedSuits?.[i] ?? suits[i]!, rank)]),
        ),
      );
  }
  if (state.lockedSuits?.length)
    choices = choices.map((play) => {
      if (play.set.kind !== 'set') return play;
      const real = cards
        .filter((card) => !isJoker(card) || assignments[card])
        .map((card) => assignments[card] ?? card);
      const missing = state.lockedSuits!.filter((suit) => !real.some((card) => card[0] === suit));
      let index = 0;
      return {
        ...play,
        effectiveCards: cards.map((card) =>
          !isJoker(card) || assignments[card]
            ? (assignments[card] ?? card)
            : play.set.rank === 16
              ? card
              : faceId(missing[index++] ?? 'C', play.set.rank),
        ),
      };
    });
  if (
    cards.length === 1 &&
    cards.every(isJoker) &&
    !Object.keys(assignments).length &&
    state.rules.jokerEffects &&
    state.rules.spadeThree &&
    state.standing?.jokerOnly &&
    state.standing.cards.length === 1
  )
    choices.push(...interpretations(cards, state.rules, { [cards[0]!]: 'S3' }));
  const ordered = choices.sort((a, b) =>
    a.set.kind === b.set.kind
      ? (reversed(state) ? -1 : 1) * (a.set.rank - b.set.rank)
      : a.set.kind === 'set'
        ? -1
        : 1,
  );
  return ordered.find((play) => validateResolved(state, cards, play) === true) ?? null;
}

export function sameSuits(a: readonly string[], b: readonly string[]): boolean {
  return a.length > 0 && a.length === b.length && a.every((suit, i) => suit === b[i]);
}
export function spadeReturn(
  state: Pick<DaifugoState, 'rules' | 'standing'>,
  cards: readonly CardId[],
): boolean {
  return (
    state.rules.spadeThree &&
    cards.length === 1 &&
    cards[0] === 'S3' &&
    state.standing?.cards.length === 1 &&
    state.standing.jokerOnly
  );
}
export function rankStep(state: Pick<DaifugoState, 'rules' | 'standing'>): number {
  return state.standing?.kind === 'run' && !state.rules.stairsOverlap
    ? state.standing.cards.length
    : 1;
}

export function validateCombination(
  state: PlayContext,
  cards: readonly CardId[],
  assignments?: JokerAssignments,
): true | RuleError {
  if (!validJokerAssignments(cards, assignments))
    return { code: 'bad-joker', message: '選択したジョーカーの代用先を指定してください。' };
  if (resolvePlay(state, cards, assignments)) return true;
  const first = interpretations(cards, state.rules, assignments)[0];
  return first
    ? validateResolved(state, cards, first)
    : {
        code: 'bad-set',
        message: '同じ数字の組、または同じスートの連続した階段を選んでください。',
      };
}
function validateResolved(
  state: PlayContext,
  cards: readonly CardId[],
  play: ResolvedPlay,
): true | RuleError {
  const fail = (code: string, message: string) => ({ code, message });
  const set = play.set;
  if (state.openingCard && !cards.includes(state.openingCard))
    return fail('opening-card', '最初は♦3を含めて出してください。');
  if (spadeReturn(state, state.rules.jokerEffects ? play.effectiveCards : cards)) return true;
  const standing = state.standing;
  if (standing) {
    if (cards.length !== standing.cards.length)
      return fail('size-mismatch', '場と同じ枚数を選んでください。');
    if (set.kind !== standing.kind)
      return fail('kind-mismatch', '階段には階段、同じ数字の組には同じ数字の組を出してください。');
    const beats =
      !standing.jokerOnly &&
      (set.jokerOnly || (reversed(state) ? set.rank < standing.rank : set.rank > standing.rank));
    if (!beats) return fail('not-higher', '場より強い組を選んでください。');
    if (
      set.kind === 'run' &&
      !state.rules.stairsOverlap &&
      (reversed(state) ? set.high >= standing.rank : set.rank <= standing.high)
    )
      return fail('overlap', '場の階段と数字が重ならない組を選んでください。');
    if (
      state.rankLocked &&
      (set.jokerOnly || set.rank !== standing.rank + (reversed(state) ? -1 : 1) * rankStep(state))
    )
      return fail('rank-lock', '激縛り中は次の数字の組を選んでください。');
  }
  if (state.lockedSuits?.length) {
    const suits =
      set.kind === 'run'
        ? set.suits
        : play.effectiveCards.filter((card) => !isJoker(card)).map((card) => card[0]!);
    if (
      new Set(suits).size !== suits.length ||
      suits.some((suit) => !state.lockedSuits!.includes(suit))
    )
      return fail('suit-lock', '縛りと同じスートを選んでください。');
  }
  return true;
}
function subsets(cards: readonly CardId[]): CardId[][] {
  const out: CardId[][] = [[]];
  for (const card of cards) out.push(...out.map((set) => [...set, card]));
  return out;
}
/** Rank groups and suit runs are enumerated independently; no exponential full-hand scan. */
export function playableSets(state: DaifugoState, seat: number): CardId[][] {
  const hand = (state.hands[seat] ?? []).filter(isDaifugoCard);
  const jokers = subsets(hand.filter(isJoker));
  const ranks = new Map<number, CardId[]>();
  for (const card of hand.filter((card) => !isJoker(card)))
    ranks.set(orderOf(card), [...(ranks.get(orderOf(card)) ?? []), card]);
  const candidates = jokers.filter((set) => set.length);
  for (const group of ranks.values())
    for (const real of subsets(group).filter((set) => set.length))
      for (const wild of jokers) candidates.push([...real, ...wild]);
  if (state.rules.stairs)
    for (const suit of ['C', 'D', 'H', 'S']) {
      const suited = hand
        .filter((card) => card[0] === suit)
        .sort((a, b) => orderOf(a) - orderOf(b));
      for (let low = 3; low <= 14; low++)
        for (
          let high = low + state.rules.stairsMin - 1;
          high <= (state.rules.stairsTwo ? 15 : 14);
          high++
        ) {
          const count = high - low + 1;
          const inside = suited.filter((card) => orderOf(card) >= low && orderOf(card) <= high);
          // At most two held real cards can be omitted and replaced by jokers.
          const variants = [inside];
          if (jokers.length > 1)
            for (let i = 0; i < inside.length; i++) {
              variants.push(inside.filter((_, index) => index !== i));
              if (jokers.length > 2)
                for (let j = i + 1; j < inside.length; j++)
                  variants.push(inside.filter((_, index) => index !== i && index !== j));
            }
          for (const real of variants)
            for (const wild of jokers)
              if (
                real.length &&
                real.length + wild.length === count &&
                (!wild.length || state.rules.stairsJoker)
              )
                candidates.push([...real, ...wild]);
        }
    }
  const unique = [
    ...new Map(candidates.map((cards) => [[...cards].sort().join(','), cards])).values(),
  ];
  return unique.filter((cards) => validateCombination(state, cards) === true);
}
