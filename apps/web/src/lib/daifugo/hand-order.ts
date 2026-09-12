import { orderedHand } from '@parlour/engine';
import { daifugoCatalog, isJoker, orderOf, reversed } from '@parlour/game-daifugo';

/** Presentation only: weakest on the left, with suit ties and jokers kept stable. */
export function orderDaifugoVisibleHand(
  cards: readonly string[],
  state: { revolution: boolean; jackBack: boolean },
): readonly string[] {
  const normal = orderedHand(cards, daifugoCatalog.handOrder);
  if (!reversed(state)) return normal;
  return [...normal].sort((a, b) => {
    if (isJoker(a) || isJoker(b)) return Number(isJoker(a)) - Number(isJoker(b));
    return orderOf(b) - orderOf(a);
  });
}
