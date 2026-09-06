import type { CardId, RuleError } from '@parlour/engine';
import { isDaifugoCard, isJoker, orderOf } from './deck';
import type { DaifugoState } from './state';

export interface Combination {
  rank: number;
  suits: string[];
  jokerOnly: boolean;
}
export const reversed = (state: Pick<DaifugoState, 'revolution' | 'jackBack'>) =>
  state.revolution !== state.jackBack;

/** Jokers substitute the real rank, but never create a suit lock. */
export function combination(cards: readonly CardId[]): Combination | null {
  if (!cards.length || cards.length > 6 || !cards.every(isDaifugoCard)) return null;
  const real = cards.filter((card) => !isJoker(card));
  if (real.some((card) => orderOf(card) !== orderOf(real[0]!))) return null;
  return {
    rank: real.length ? orderOf(real[0]!) : 16,
    suits: cards.some(isJoker) ? [] : real.map((card) => card[0]!).sort(),
    jokerOnly: real.length === 0,
  };
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

/** Shared by the authority and selection UI, so they cannot disagree. */
export function validateCombination(
  state: Pick<
    DaifugoState,
    'rules' | 'standing' | 'revolution' | 'jackBack' | 'lockedSuits' | 'openingCard'
  >,
  cards: readonly CardId[],
): true | RuleError {
  const fail = (code: string, message: string) => ({ code, message });
  const set = combination(cards);
  if (!set) return fail('bad-set', '同じ数字のカードとジョーカーを選んでください。');
  if (state.openingCard && !cards.includes(state.openingCard))
    return fail('opening-card', '最初は♦3を含めて出してください。');
  if (spadeReturn(state, cards)) return true;
  if (state.standing) {
    if (cards.length !== state.standing.cards.length)
      return fail('size-mismatch', '場と同じ枚数を選んでください。');
    const beats =
      !state.standing.jokerOnly &&
      (set.jokerOnly ||
        (reversed(state) ? set.rank < state.standing.rank : set.rank > state.standing.rank));
    if (!beats) return fail('not-higher', '場より強い組を選んでください。');
  }
  // A joker may fill a missing locked suit, but real cards must match distinct locked suits.
  if (state.lockedSuits.length) {
    const realSuits = cards.filter((card) => !isJoker(card)).map((card) => card[0]!);
    if (
      new Set(realSuits).size !== realSuits.length ||
      realSuits.some((suit) => !state.lockedSuits.includes(suit))
    ) {
      return fail('suit-lock', '縛りと同じスートを選んでください。');
    }
  }
  return true;
}

function subsets(cards: readonly CardId[]): CardId[][] {
  const out: CardId[][] = [[]];
  for (const card of cards) out.push(...out.map((set) => [...set, card]));
  return out;
}

/** Enumerate suit-distinct choices as well: they matter when a lock can form. */
export function playableSets(state: DaifugoState, seat: number): CardId[][] {
  const hand = (state.hands[seat] ?? []).filter(isDaifugoCard);
  const jokers = hand.filter(isJoker);
  const ranks = new Map<number, CardId[]>();
  for (const card of hand.filter((card) => !isJoker(card))) {
    const rank = orderOf(card);
    ranks.set(rank, [...(ranks.get(rank) ?? []), card]);
  }
  const candidates = subsets(jokers).filter((set) => set.length);
  for (const group of ranks.values())
    for (const real of subsets(group).filter((set) => set.length)) {
      for (const wild of subsets(jokers)) candidates.push([...real, ...wild]);
    }
  return candidates.filter((cards) => validateCombination(state, cards) === true);
}
