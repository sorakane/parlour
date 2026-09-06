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

/** Runs use real endpoints: a joker can fill an internal hole, never an ambiguous end. */
export function combination(cards: readonly CardId[], rules?: DaifugoRules): Combination | null {
  if (
    !cards.length ||
    cards.length > MAX_PLAY_SIZE ||
    new Set(cards).size !== cards.length ||
    !cards.every(isDaifugoCard)
  )
    return null;
  const real = cards.filter((card) => !isJoker(card));
  const wild = cards.length - real.length;
  const ranks = real.map(orderOf).sort((a, b) => a - b);
  if (cards.length <= MAX_SET_SIZE && ranks.every((rank) => rank === ranks[0])) {
    const rank = ranks[0] ?? 16;
    return {
      kind: 'set',
      rank,
      high: rank,
      suits: wild ? [] : real.map((card) => card[0]!).sort(),
      jokerOnly: real.length === 0,
    };
  }
  if (!rules?.stairs || cards.length < rules.stairsMin || real.length < 2) return null;
  const suit = real[0]![0]!;
  if (!real.every((card) => card[0] === suit) || new Set(ranks).size !== ranks.length) return null;
  const low = ranks[0]!,
    high = ranks[ranks.length - 1]!;
  if (
    high > (rules.stairsTwo ? 15 : 14) ||
    high - low + 1 !== cards.length ||
    (wild > 0 && !rules.stairsJoker)
  )
    return null;
  return { kind: 'run', rank: low, high, suits: [suit], jokerOnly: false };
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
  state: Pick<
    DaifugoState,
    'rules' | 'standing' | 'revolution' | 'jackBack' | 'lockedSuits' | 'openingCard'
  > &
    Partial<Pick<DaifugoState, 'rankLocked'>>,
  cards: readonly CardId[],
): true | RuleError {
  const fail = (code: string, message: string) => ({ code, message });
  const set = combination(cards, state.rules);
  if (!set)
    return fail(
      'bad-set',
      state.rules.stairs
        ? '同じ数字の組、または同じスートの連続した階段を選んでください。'
        : '同じ数字のカードとジョーカーを選んでください。',
    );
  if (state.openingCard && !cards.includes(state.openingCard))
    return fail('opening-card', '最初は♦3を含めて出してください。');
  if (spadeReturn(state, cards)) return true;
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
  if (state.lockedSuits.length) {
    const suits =
      set.kind === 'run'
        ? set.suits
        : cards.filter((card) => !isJoker(card)).map((card) => card[0]!);
    if (
      new Set(suits).size !== suits.length ||
      suits.some((suit) => !state.lockedSuits.includes(suit))
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
      for (const first of suited)
        for (const last of suited) {
          const low = orderOf(first),
            high = orderOf(last),
            count = high - low + 1;
          if (
            count < state.rules.stairsMin ||
            count > MAX_PLAY_SIZE ||
            high > (state.rules.stairsTwo ? 15 : 14)
          )
            continue;
          const real = suited.filter((card) => orderOf(card) >= low && orderOf(card) <= high);
          for (const wild of jokers)
            if (real.length + wild.length === count && (!wild.length || state.rules.stairsJoker))
              candidates.push([...real, ...wild]);
        }
    }
  return candidates.filter((cards) => validateCombination(state, cards) === true);
}
