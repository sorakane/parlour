import type { CardId } from '@parlour/engine';
import type { DaifugoState } from './state';
import { resolvePlay, reversed, spadeReturn, type JokerAssignments } from './combinations';
import { isJoker, orderOf } from './deck';

/** Decisions about card effects are pure and reused by validation, bots and the UI. */
export function playEffects(
  state: Pick<DaifugoState, 'rules' | 'standing' | 'revolution' | 'jackBack'> &
    Partial<Pick<DaifugoState, 'rankLocked' | 'lockedSuits'>>,
  cards: readonly CardId[],
  jokerAs?: JokerAssignments,
) {
  const resolved = resolvePlay(state, cards, jokerAs);
  const set = resolved?.set;
  const effective = state.rules.jokerEffects ? (resolved?.effectiveCards ?? cards) : cards;
  const enabled = set?.kind === 'set' || state.rules.specialsOnStairs;
  const count = (rank: number) =>
    enabled ? effective.filter((card) => !isJoker(card) && orderOf(card) === rank).length : 0;
  return {
    revolution:
      set?.kind === 'run'
        ? state.rules.stairsRevolution && cards.length >= state.rules.stairsRevolutionCount
        : state.rules.revolution && cards.length >= state.rules.revolutionCount,
    jackBack: state.rules.jackBack && count(11) > 0,
    clearReason: spadeReturn(state, effective)
      ? 'spade-three'
      : state.rules.eightCut && count(8) > 0
        ? 'eight-cut'
        : null,
    skips: state.rules.fiveSkip ? count(5) : 0,
    give: state.rules.sevenGive ? count(7) : 0,
    discard: state.rules.tenDiscard ? count(10) : 0,
  };
}
export function forbiddenFinishReason(
  state: Pick<DaifugoState, 'rules' | 'standing' | 'revolution' | 'jackBack'> &
    Partial<Pick<DaifugoState, 'rankLocked' | 'lockedSuits'>>,
  cards: readonly CardId[],
  jokerAs?: JokerAssignments,
): string | null {
  const effects = playEffects(state, cards, jokerAs);
  const effective = state.rules.jokerEffects
    ? (resolvePlay(state, cards, jokerAs)?.effectiveCards ?? cards)
    : cards;
  if (state.rules.forbidJokerFinish && cards.some(isJoker)) return 'ジョーカー上がり';
  if (state.rules.forbidEightFinish && effects.clearReason === 'eight-cut') return '8切り上がり';
  if (state.rules.forbidSpadeThreeFinish && effects.clearReason === 'spade-three')
    return 'スペ3返し上がり';
  const strongest = reversed(state) ? 3 : 15;
  if (
    state.rules.forbidStrongestFinish &&
    effective.some((card) => !isJoker(card) && orderOf(card) === strongest)
  )
    return '最強札上がり';
  return null;
}
