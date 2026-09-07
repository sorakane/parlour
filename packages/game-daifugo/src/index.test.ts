import {
  createSession,
  sessionApply,
  replaySession,
  stateHash,
  makeRng,
  type MoveCtx,
} from '@parlour/engine';
import { describe, it, expect } from 'vitest';
import { daifugoGame, phaseFor, roleFor } from './game';
import { daifugoConfig, type DaifugoRules } from './config';
import { daifugoBots } from './bots';
import type { DaifugoState } from './state';
import { combination, validateCombination } from './combinations';

function session(seed = 7, rules: Partial<DaifugoRules> = {}, seats = 4) {
  return createSession(daifugoGame, { seed, seats, config: daifugoConfig.resolve(rules) });
}
function fixture(
  hands: string[][],
  rules: Partial<DaifugoRules> = {},
  extra: Partial<DaifugoState> = {},
): DaifugoState {
  return { ...session(7, rules).state, hands, turn: 0, openingCard: null, ...extra };
}
const ctx = (): MoveCtx => ({ rng: makeRng(42), fx: { events: [], emit() {} }, event: { seq: 1 } });
function move(state: DaifugoState, id: string, seat: number, cards?: string[]): DaifugoState {
  const payload = cards ? { cards } : undefined;
  expect(daifugoGame.moves[id]!.validate(state, seat, payload)).toBe(true);
  return daifugoGame.moves[id]!.apply(state, seat, payload, ctx());
}

describe('Daifugo rules', () => {
  it.each([0, 1, 2])('deals exactly 52 + %i cards without duplication', (jokerCount) => {
    for (const seats of [4, 5, 6, 7, 8]) {
      const cards = session(17, { jokerCount }, seats).state.hands.flat();
      expect(cards.length).toBe(52 + jokerCount);
      expect(new Set(cards).size).toBe(cards.length);
    }
  });
  it('rejects duplicate, unheld, malformed and off-turn cards', () => {
    const state = fixture([['S3', 'S4'], ['H3'], ['D3'], ['C3']]);
    for (const [seat, cards] of [
      [0, ['S3', 'S3']],
      [0, ['J0']],
      [0, ['S3', 'S4']],
      [1, ['H3']],
      [0, ['S99']],
    ] as const) {
      expect(daifugoGame.moves.playSet!.validate(state, seat, { cards })).not.toBe(true);
    }
    expect(combination(['?'])).toBeNull();
  });
  it('allows joker substitution and requires the same size', () => {
    let state = fixture([['S4', 'J0', 'S9'], ['H5', 'J1', 'H9'], ['D3'], ['C3']]);
    state = move(state, 'playSet', 0, ['S4', 'J0']);
    expect(state.standing?.rank).toBe(4);
    expect(daifugoGame.moves.playSet!.validate(state, 1, { cards: ['H5'] })).not.toBe(true);
    state = move(state, 'playSet', 1, ['H5', 'J1']);
    expect(state.standing?.rank).toBe(5);
  });
  it('keeps joker strongest during revolution, then allows spade-three to clear', () => {
    let state = fixture([['J0', 'S9'], ['S3', 'H9'], ['D3'], ['C3']], {}, { revolution: true });
    state = move(state, 'playSet', 0, ['J0']);
    expect(
      validateCombination({ ...state, rules: { ...state.rules, jokerEffects: false } }, ['J1']),
    ).not.toBe(true);
    state = move(state, 'playSet', 1, ['S3']);
    expect(state.standing).toBeNull();
    expect(state.turn).toBe(1);
    expect(state.revolution).toBe(true);
  });
  it.each([false, true])(
    'returns a single joker with spade-three (revolution=%s)',
    (revolution) => {
      let state = fixture([['J0', 'S9'], ['S3', 'H9'], ['D3'], ['C3']], {}, { revolution });
      state = move(state, 'playSet', 0, ['J0']);
      const legal = daifugoGame.flow.legalMovesFor!(state, phaseFor(state), 1);
      expect(
        legal.some(
          (m) =>
            m.id === 'playSet' && JSON.stringify(m.payload) === JSON.stringify({ cards: ['S3'] }),
        ),
      ).toBe(true);
      state = move(state, 'playSet', 1, ['S3']);
      expect(state.standing).toBeNull();
      expect(state.turn).toBe(1);
    },
  );
  it('honors disabling spade-three and does not counter a joker pair with one card', () => {
    let off = fixture([['J0', 'S9'], ['S3', 'H9'], ['D3'], ['C3']], { spadeThree: false });
    off = move(off, 'playSet', 0, ['J0']);
    expect(validateCombination(off, ['S3'])).not.toBe(true);
    let pair = fixture([['J0', 'J1', 'S9'], ['S3', 'H9'], ['D3'], ['C3']]);
    pair = move(pair, 'playSet', 0, ['J0', 'J1']);
    expect(validateCombination(pair, ['S3'])).not.toBe(true);
  });
  it('composes revolution and jack-back as XOR, resets only jack-back on sweep', () => {
    let state = fixture([
      ['S11', 'H11', 'D11', 'C11', 'S9'],
      ['S12', 'H12', 'D12', 'C12', 'H9'],
      ['D3'],
      ['C3'],
    ]);
    state = move(state, 'playSet', 0, ['S11', 'H11', 'D11', 'C11']);
    expect(state).toMatchObject({ revolution: true, jackBack: true });
    expect(validateCombination(state, ['S12', 'H12', 'D12', 'C12'])).toBe(true);
    state = move(state, 'pass', 1);
    state = move(state, 'pass', 2);
    state = move(state, 'pass', 3);
    expect(state).toMatchObject({ revolution: true, jackBack: false, standing: null, turn: 0 });
  });
  it('jack-back during revolution returns to normal strength', () => {
    let state = fixture([['S11', 'S9'], ['H12', 'H9'], ['D3'], ['C3']], {}, { revolution: true });
    state = move(state, 'playSet', 0, ['S11']);
    expect(validateCombination(state, ['H12'])).toBe(true);
    expect(validateCombination(state, ['H10'])).not.toBe(true);
  });
  it('eight-cut leaves revolution active, clears locks and transfers lead after finishing', () => {
    let state = fixture(
      [['S8', 'H8', 'D8', 'C8'], ['S5'], ['D3'], ['C3']],
      {},
      { jackBack: true, lockedSuits: ['C', 'D', 'H', 'S'] },
    );
    state = move(state, 'playSet', 0, ['S8', 'H8', 'D8', 'C8']);
    expect(state).toMatchObject({
      revolution: true,
      jackBack: false,
      lockedSuits: [],
      standing: null,
      turn: 1,
      finished: [0],
    });
  });
  it('locks matching suits, permits joker filling, and enumerates every legal suit choice', () => {
    let state = fixture([['S4', 'H4', 'S9'], ['S5', 'H5', 'H9'], ['S6', 'C6', 'H6', 'J0'], ['C3']]);
    state = move(state, 'playSet', 0, ['S4', 'H4']);
    state = move(state, 'playSet', 1, ['S5', 'H5']);
    expect(state.lockedSuits).toEqual(['H', 'S']);
    expect(validateCombination(state, ['S6', 'C6'])).not.toBe(true);
    expect(validateCombination(state, ['S6', 'J0'])).toBe(true);
    const legal = daifugoGame.flow.legalMovesFor!(state, phaseFor(state), 2);
    expect(legal.some((m) => JSON.stringify(m.payload).includes('H6'))).toBe(true);
  });
  it('never offers a passed seat another turn in the same trick with pass locks', () => {
    let state = fixture([
      ['S3', 'S9'],
      ['H4', 'H9'],
      ['D5', 'D9'],
      ['C6', 'C9'],
    ]);
    state = move(state, 'playSet', 0, ['S3']);
    state = move(state, 'pass', 1);
    state = move(state, 'playSet', 2, ['D5']);
    state = move(state, 'pass', 3);
    state = move(state, 'pass', 0);
    expect(state).toMatchObject({ standing: null, turn: 2, lockedOut: [] });
  });
  it('allows a previously passed player back after the pile changes when configured', () => {
    let state = fixture(
      [
        ['S3', 'S9'],
        ['H4', 'H9'],
        ['D5', 'D9'],
        ['C6', 'C9'],
      ],
      { passLocks: false },
    );
    state = move(state, 'playSet', 0, ['S3']);
    state = move(state, 'pass', 1);
    state = move(state, 'playSet', 2, ['D5']);
    state = move(state, 'pass', 3);
    state = move(state, 'pass', 0);
    expect(state.turn).toBe(1);
    state = move(state, 'playSet', 1, ['H9']);
    expect(state.standing?.seat).toBe(1);
  });
  it('skips by actual fives, using the configured turn order', () => {
    let state = fixture(
      [['S5', 'S9'], ['H3'], ['D3'], ['C3']],
      { fiveSkip: true },
      { seatOrder: [0, 2, 1, 3] },
    );
    state = move(state, 'playSet', 0, ['S5']);
    expect(state.turn).toBe(1);
    expect(state.passedCycle).toEqual([2]);
  });
  it('enforces diamond-three as the first card when chosen', () => {
    const state = session(4, { firstPlayer: 'diamond3' }).state;
    expect(state.hands[state.turn!]!).toContain('D3');
    expect(validateCombination(state, ['S3'])).not.toBe(true);
    expect(validateCombination(state, ['D3'])).toBe(true);
  });
  it('requires strongest gifts, allows equal-strength suits, returns selected cards', () => {
    let state = fixture(
      [['S3', 'H3'], ['S4'], ['D2', 'D9'], ['J0', 'S2', 'H2', 'C3']],
      { exchangeCount: 2, excludeJokersFromExchange: false },
      {
        lastOrder: [0, 1, 2, 3],
        awaitingGive: [2, 3],
        turn: null,
        dealLeader: 3,
      },
    );
    expect(daifugoGame.moves.giveCards!.validate(state, 3, { cards: ['H2', 'C3'] })).not.toBe(true);
    state = move(state, 'giveCards', 2, ['D2']);
    state = move(state, 'giveCards', 3, ['J0', 'H2']);
    expect(state.awaitingReturn).toEqual({ seat: 0, count: 2 });
    state = move(state, 'returnCards', 0, ['S3', 'H3']);
    state = move(state, 'returnCards', 1, ['S4']);
    expect(state.turn).toBe(3);
    expect(state.hands[3]).toContain('S3');
    expect(daifugoGame.playerView(state, 2).exchangeLog[1]!.cards).toEqual(['??', '??']);
  });
  it('does not ask the vice roles to exchange zero cards', () => {
    let state = fixture(
      [['S3', 'J0'], ['S4'], ['D2'], ['C3']],
      { exchangeCount: 1 },
      {
        lastOrder: [0, 1, 2, 3],
        awaitingGive: [],
        awaitingReturn: { seat: 0, count: 1 },
        turn: null,
        dealLeader: 3,
      },
    );
    state = move(state, 'returnCards', 0, ['S3']);
    expect(state.awaitingReturn).toBeNull();
    expect(state.turn).toBe(3);
  });
});

describe('rank-based seating', () => {
  it.each([4, 5, 6, 7, 8])(
    'reseats %i players without changing identity or exchange roles',
    (seats) => {
      const base = session(7, { seatOrder: 'rank-ascending', nextLeader: 'last' }, seats).state;
      expect(base.seatOrder).toEqual(Array.from({ length: seats }, (_, seat) => seat));
      const order = [
        2,
        0,
        ...Array.from({ length: seats }, (_, seat) => seat).filter(
          (seat) => seat !== 0 && seat !== 2,
        ),
      ];
      const state = { ...base, finished: order, lastOrder: order };
      const next = move(state, 'openNextDeal', 0);
      expect(next.seatOrder).toEqual([...order].reverse());
      expect(next.dealLeader).toBe(order.at(-1));
      expect(next.awaitingGive).toEqual(order.slice(-2));
      expect(next.score).toEqual(base.score);
      expect(state.lastOrder).toEqual(order);
      expect(roleFor(next.lastOrder!, 2)).toBe('daifugo');
      expect(roleFor(next.lastOrder!, order.at(-1)!)).toBe('scum');
      const noExchange = move(
        { ...state, rules: { ...state.rules, trading: false } },
        'openNextDeal',
        0,
      );
      expect(noExchange.turn).toBe(order.at(-1));
      const afterPass = move(
        {
          ...noExchange,
          standing: {
            seat: order.at(-1)!,
            cards: ['C3'],
            rank: 3,
            high: 3,
            kind: 'set',
            suits: ['C'],
            jokerOnly: false,
          },
        },
        'pass',
        order.at(-1)!,
      );
      expect(afterPass.turn).toBe(order.at(-2));
    },
  );
  it('keeps the independently selected next leader and the existing top-first order', () => {
    const base = session(7, {
      seatOrder: 'rank-ascending',
      nextLeader: 'first',
      trading: false,
    }).state;
    const state = { ...base, finished: [2, 0, 3, 1], lastOrder: [2, 0, 3, 1] };
    expect(move(state, 'openNextDeal', 0)).toMatchObject({ seatOrder: [1, 3, 0, 2], turn: 2 });
    expect(
      move({ ...state, rules: { ...state.rules, seatOrder: 'rank' } }, 'openNextDeal', 0).seatOrder,
    ).toEqual([2, 0, 3, 1]);
  });
});

describe('deterministic full matches', () => {
  it.each([4, 5, 6, 7, 8])(
    'finishes %i-seat matches, conserves cards, and replays every effect',
    (seats) => {
      for (const seed of [1, 12, 35, 46]) {
        const rules = daifugoConfig.resolve({
          targetPoints: 15,
          seatOrder: seed === 46 ? 'rank-ascending' : seed === 1 ? 'rank' : 'random',
          fiveSkip: true,
          firstPlayer: 'diamond3',
          exchangeCount: (seed % 3) + 1,
        });
        let live = createSession(daifugoGame, { seed, seats, config: rules });
        for (let step = 0; step < 5000 && live.status === 'playing'; step++) {
          const actor = live.phase.actor!;
          expect(actor).not.toBeNull();
          const legal = daifugoGame.flow.legalMovesFor!(live.state, live.phase, actor);
          const choice = daifugoBots[2]!.chooseMove(
            daifugoGame.playerView(live.state, actor),
            actor,
            legal,
            makeRng(seed).fork(`${step}`),
            { thinkMs: () => 0 },
          );
          expect(choice, `stuck at ${step} in ${live.phase.phase}`).not.toBeNull();
          const result = sessionApply(daifugoGame, live, actor, choice!.id, choice!.payload);
          expect(result.rejected).toBeUndefined();
          const previousDeal = live.state.deal;
          live = result.session;
          if (seed === 46 && live.state.deal > previousDeal) {
            expect(live.state.seatOrder).toEqual([...live.state.lastOrder!].reverse());
            expect(live.state.dealLeader).toBe(live.state.seatOrder[0]);
          }
          const all = [...live.state.hands.flat(), ...live.state.pile, ...live.state.captured];
          expect(all.length).toBe(54);
          expect(new Set(all).size).toBe(54);
          expect(new Set(live.state.finished).size).toBe(live.state.finished.length);
        }
        expect(live.status).toBe('ended');
        expect(live.state.lastOrder?.length).toBe(seats);
        expect(roleFor(live.state.lastOrder!, live.state.lastOrder![0]!)).toBe('daifugo');
        const replayed = replaySession(daifugoGame, seed, live.log, {
          seats,
          config: rules,
          verify: true,
        });
        expect(replayed.fault).toBeNull();
        expect(stateHash(replayed.state)).toBe(stateHash(live.state));
      }
    },
    30000,
  );
});
