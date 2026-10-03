import { describe, it, expect } from 'vitest';
import { createSession, makeRng, type MoveCtx } from '@parlour/engine';
import { daifugoGame, daifugoConfig } from './game';
import { previousFinishOrder, previousRoleFor, recordDealResult } from './rankings';
import type { DaifugoState } from './state';

function move(state: DaifugoState, id: string, seat: number, cards?: string[]) {
  const payload = cards ? { cards } : undefined;
  expect(daifugoGame.moves[id]!.validate(state, seat, payload)).toBe(true);
  const ctx: MoveCtx = { rng: makeRng(42), fx: { events: [], emit() {} }, event: { seq: 1 } };
  return daifugoGame.moves[id]!.apply(state, seat, payload, ctx);
}

const modes = ['fixed', 'random', 'rank', 'rank-ascending'];
describe('places are independent of turn order', () => {
  for (const seats of [4, 5, 6, 7, 8])
    for (const seatOrder of modes) {
      it(`${seats} seats / ${seatOrder}: preserve roles, leader and exchange recipients`, () => {
        const base = createSession(daifugoGame, {
          seed: 9,
          seats,
          config: daifugoConfig.resolve({ seatOrder, trading: true, nextLeader: 'last' }),
        }).state;
        const finish = [
          2,
          0,
          ...Array.from({ length: seats }, (_, i) => i).filter((i) => i !== 0 && i !== 2),
        ];
        const last = finish.at(-1)!;
        const result = recordDealResult(0, seats, finish);
        // Simulate the exact class of mix-up reported: a reversed legacy list
        // and a changed seating list must never reassign the committed places.
        const next = move(
          {
            ...base,
            lastResult: result,
            finished: [...finish],
            lastOrder: [...finish].reverse(),
            seatOrder: [...finish].reverse(),
          },
          'openNextDeal',
          0,
        );
        expect(previousFinishOrder(next)).toEqual(finish);
        expect(previousRoleFor(next, 2)).toBe('daifugo');
        expect(previousRoleFor(next, last)).toBe('scum');
        expect(next.dealLeader).toBe(last);
        expect(next.awaitingGive).toEqual(finish.slice(-2));
        expect(next.lastResult).toEqual(result);
        // Also survive a serialized online snapshot and mutations of derived lists.
        const restored: DaifugoState = JSON.parse(JSON.stringify(next));
        const derived = previousFinishOrder(restored)!;
        derived.reverse();
        expect(previousFinishOrder(restored)).toEqual(finish);
        const hands = Array.from({ length: seats }, () => ['S3']);
        hands[last] = ['S2', 'H2', 'S3'];
        const exchanged = move({ ...restored, hands }, 'giveCards', last, ['S2', 'H2']);
        expect(exchanged.exchangeLog.at(-1)).toMatchObject({ from: last, to: 2 });
      });
    }

  it('records the player finishing with two 2s as first, not the next turn leader', () => {
    const base = createSession(daifugoGame, {
      seed: 3,
      seats: 4,
      config: daifugoConfig.resolve({
        seatOrder: 'rank-ascending',
        trading: false,
        forbidStrongestFinish: false,
      }),
    }).state;
    let state: DaifugoState = {
      ...base,
      hands: [['S2', 'H2'], ['S3'], ['S4'], ['S5']],
      turn: 0,
      openingCard: null,
    };
    state = move(state, 'playSet', 0, ['S2', 'H2']);
    state = move(state, 'pass', 1);
    state = move(state, 'pass', 2);
    state = move(state, 'pass', 3);
    state = move(state, 'playSet', 1, ['S3']);
    state = move(state, 'playSet', 2, ['S4']);
    expect(state.lastResult?.placeBySeat).toEqual({ 0: 1, 1: 2, 2: 3, 3: 4 });
    expect(state.score).toEqual([4, 3, 2, 1]);
    const next = move(state, 'openNextDeal', 0);
    expect(next.seatOrder).toEqual([3, 2, 1, 0]);
    expect([0, 1, 2, 3].map((seat) => previousRoleFor(next, seat))).toEqual([
      'daifugo',
      'vice',
      'vice-scum',
      'scum',
    ]);
    expect(next.lastResult?.deal).toBe(0);
  });

  it('migrates old results before reshuffling and rejects invalid finish lists', () => {
    const base = createSession(daifugoGame, {
      seed: 3,
      seats: 4,
      config: daifugoConfig.resolve({ seatOrder: 'rank-ascending' }),
    }).state;
    const next = move(
      { ...base, lastResult: undefined, lastOrder: [2, 0, 3, 1], finished: [2, 0, 3, 1] },
      'openNextDeal',
      0,
    );
    expect(next.lastResult?.placeBySeat).toEqual({ 2: 1, 0: 2, 3: 3, 1: 4 });
    expect(() => recordDealResult(0, 4, [0, 0, 2, 3])).toThrow();
    expect(() => recordDealResult(0, 4, [0, 1, 2])).toThrow();
  });
});
