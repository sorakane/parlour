import { describe, expect, it } from 'vitest';
import { orderDaifugoVisibleHand } from './hand-order';

describe('visible hand follows effective strength', () => {
  const hand = ['J1', 'H3', 'S2', 'D1', 'C7', 'S3', 'J0'];
  it.each([
    [false, false, [3, 3, 7, 1, 2]],
    [true, false, [2, 1, 7, 3, 3]],
    [false, true, [2, 1, 7, 3, 3]],
    [true, true, [3, 3, 7, 1, 2]],
  ] as const)('revolution=%s, jackBack=%s', (revolution, jackBack, expected) => {
    const original = [...hand];
    const result = orderDaifugoVisibleHand(hand, { revolution, jackBack });
    expect(result.slice(0, -2).map((card) => Number(card.slice(1)))).toEqual(expected);
    expect(result.slice(-2)).toEqual(['J0', 'J1']);
    expect([...result].sort()).toEqual([...hand].sort());
    expect(hand).toEqual(original);
  });
  it('restores normal order and keeps equal-rank suit order on reversal', () => {
    const normal = orderDaifugoVisibleHand(hand, { revolution: false, jackBack: false });
    const inverse = orderDaifugoVisibleHand(hand, { revolution: true, jackBack: false });
    expect(inverse.filter((card) => card.endsWith('3'))).toEqual(
      normal.filter((card) => card.endsWith('3')),
    );
    expect(orderDaifugoVisibleHand(inverse, { revolution: false, jackBack: false })).toEqual(
      normal,
    );
  });
});
