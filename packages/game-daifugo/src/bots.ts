import type { BotPolicy } from '@parlour/engine';
import type { DaifugoState } from './state';
import { giftCountFor, roleFor } from './game';
import { orderOf, isJoker } from './deck';
import { resolvePlay, reversed } from './combinations';
import { forbiddenFinishReason } from './effects';

export const daifugoBots: readonly BotPolicy<DaifugoState>[] = ([1, 2, 3] as const).map((tier) => ({
  id: `daifugo-${tier}`,
  label: ['気軽', 'ふつう', '手強い'][tier - 1]!,
  tier,
  chooseMove(view, seat, legal, rng) {
    const hand = view.hands[seat] ?? [];
    if (legal.some((move) => move.id === 'resolveEffect')) {
      const count = view.pendingPlay!.effects[0]!.count;
      const cards = [...hand]
        .sort((a, b) => (reversed(view) ? -1 : 1) * (orderOf(a) - orderOf(b)))
        .slice(0, count);
      return { id: 'resolveEffect', payload: { cards } };
    }
    const gift = legal.find((move) => move.id === 'giveCards');
    const returning = legal.find((move) => move.id === 'returnCards');
    if (gift || returning) {
      const count = gift
        ? giftCountFor(roleFor(view.lastOrder ?? [], seat) ?? 'neutral', view.rules.exchangeCount)
        : view.awaitingReturn!.count;
      const cards = hand
        .filter((card) => !gift || !view.rules.excludeJokersFromExchange || !isJoker(card))
        .sort((a, b) => (gift ? -1 : 1) * (orderOf(a) - orderOf(b)) || a.localeCompare(b))
        .slice(0, count);
      return { id: gift ? 'giveCards' : 'returnCards', payload: { cards } };
    }
    const sets = legal.filter((move) => move.id === 'playSet');
    if (!sets.length) return legal.find((move) => move.id === 'pass') ?? null;
    if (tier === 1) return rng.pick(sets) ?? sets[0]!;
    const score = (move: (typeof sets)[number]) => {
      const cards = (move.payload as { cards: string[] }).cards;
      const set = resolvePlay(view, cards)!.set;
      const strength = set.jokerOnly ? 30 : reversed(view) ? 18 - set.rank : set.rank;
      return (
        (cards.length === hand.length ? (forbiddenFinishReason(view, cards) ? 10000 : -1000) : 0) +
        strength -
        cards.length * (tier === 3 ? 8 : 3)
      );
    };
    return [...sets].sort((a, b) => score(a) - score(b))[0]!;
  },
}));
