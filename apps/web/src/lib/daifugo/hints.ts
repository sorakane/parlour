import {
  resolvePlay,
  isJoker,
  forbiddenFinishReason,
  reversed,
  validateCombination,
  type JokerAssignments,
} from '@parlour/game-daifugo';
import type { DaifugoTableView } from './view';

/** Suggestions use only moves already offered to this player by the engine. */
export function daifugoHints(view: DaifugoTableView): readonly (readonly string[])[] {
  if (view.decision !== 'lead-or-follow') return [];
  const risk = (cards: readonly string[]) =>
    Number(cards.length === view.hand.length && Boolean(forbiddenFinishReason(view, cards)));
  const strength = (cards: readonly string[]) => {
    const set = resolvePlay(view, cards)!.set;
    return set.jokerOnly ? 100 : set.rank * (reversed(view) ? -1 : 1);
  };
  return [...view.legal.playableSets].sort(
    (a, b) =>
      risk(a) - risk(b) ||
      b.length - a.length ||
      strength(a) - strength(b) ||
      a.filter(isJoker).length - b.filter(isJoker).length,
  );
}

export function sameHandSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((card) => b.includes(card));
}

/** With a partial selection, highlight only cards that can complete that selection. */
export function matchingHintCards(
  view: DaifugoTableView,
  selected: readonly string[],
  jokerAs?: JokerAssignments,
): Set<string> {
  return new Set(
    view.legal.playableSets
      .filter(
        (cards) =>
          selected.every((card) => cards.includes(card)) &&
          validateCombination(view, cards, jokerAs) === true,
      )
      .flat(),
  );
}
