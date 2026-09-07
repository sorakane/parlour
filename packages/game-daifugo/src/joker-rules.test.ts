import {
  createSession,
  makeRng,
  sessionApply,
  replaySession,
  stateHash,
  type MoveCtx,
} from '@parlour/engine';
import { describe, it, expect } from 'vitest';
import { daifugoGame } from './game';
import { daifugoConfig, type DaifugoRules } from './config';
import {
  resolvePlay,
  validateCombination,
  playableSets,
  type JokerAssignments,
} from './combinations';
import { playEffects, forbiddenFinishReason } from './effects';
import { daifugoBots } from './bots';
import type { DaifugoState } from './state';
const context = (): MoveCtx => ({
  rng: makeRng(19),
  fx: { events: [], emit() {} },
  event: { seq: 1 },
});
function state(rules: Partial<DaifugoRules> = {}, extra: Partial<DaifugoState> = {}) {
  return {
    ...createSession(daifugoGame, { seed: 12, seats: 4, config: daifugoConfig.resolve(rules) })
      .state,
    hands: [
      ['J0', 'J1', 'S4', 'S5', 'C9', 'D12'],
      ['H3', 'H9'],
      ['D3', 'D9'],
      ['C3', 'C4'],
    ],
    turn: 0,
    openingCard: null,
    ...extra,
  };
}
const run = (low: number, high: number) => ({
  seat: 1,
  cards: Array.from({ length: high - low + 1 }, (_, i) => `H${low + i}`),
  kind: 'run' as const,
  rank: low,
  high,
  suits: ['H'],
  jokerOnly: false,
});

describe('wild joker interpretation', () => {
  it('resolves either run endpoint against the pile, including reverse and rank locks', () => {
    const normal = state({ stairs: true }, { standing: run(3, 5) });
    expect(resolvePlay(normal, ['S4', 'S5', 'J0'])?.set).toMatchObject({
      kind: 'run',
      rank: 4,
      high: 6,
    });
    expect(playableSets(normal, 0)).toContainEqual(['S4', 'S5', 'J0']);
    const reverse = state({ stairs: true }, { revolution: true, standing: run(4, 6) });
    expect(resolvePlay(reverse, ['S4', 'S5', 'J0'])?.set).toMatchObject({ rank: 3, high: 5 });
    expect(resolvePlay({ ...normal, rankLocked: true }, ['S4', 'S5', 'J0'])?.set.rank).toBe(4);
    expect(resolvePlay(state({ stairs: true, stairsJoker: false }), ['S4', 'S5', 'J0'])).toBeNull();
  });
  it('uses two jokers and one real card as a run when following a run', () => {
    const s = state({ stairs: true }, { standing: run(3, 5) });
    expect(resolvePlay(s, ['S5', 'J0', 'J1'])?.set).toMatchObject({
      kind: 'run',
      rank: 4,
      high: 6,
    });
    expect(playableSets(s, 0)).toContainEqual(['S5', 'J0', 'J1']);
    expect(validateCombination(s, ['S5', 'J0', 'J1'], { J0: 'S6', J1: 'S7' })).toBe(true);
  });
  it('allows any declared rank and suit, respecting strength, locks and boundaries', () => {
    const s = state(
      {},
      { standing: { ...run(6, 6), kind: 'set', suits: ['H'] }, lockedSuits: ['H'] },
    );
    expect(validateCombination(s, ['J0'], { J0: 'H7' })).toBe(true);
    expect(validateCombination(s, ['J0'], { J0: 'S7' })).not.toBe(true);
    expect(validateCombination(s, ['J0'], { J0: 'H5' })).not.toBe(true);
    expect(resolvePlay({ ...s, rankLocked: true }, ['J0'])?.set.rank).toBe(7);
    expect(
      validateCombination(state({ stairs: true }), ['S4', 'J0', 'J1'], { J0: 'S1', J1: 'S2' }),
    ).not.toBe(true);
    for (const bad of [{ J0: 'J1' }, { J0: 'S99' }, { J1: 'H8' }, { S4: 'H8' }, null, 'H8'])
      expect(
        daifugoGame.moves.playSet!.validate(state(), 0, { cards: ['J0'], jokerAs: bad }),
      ).not.toBe(true);
  });
  it.each([
    ['C8', 'clearReason', 'eight-cut'],
    ['H11', 'jackBack', true],
    ['D5', 'skips', 1],
    ['S7', 'give', 1],
    ['C10', 'discard', 1],
  ] as const)('applies the effect of a joker declared as %s', (face, key, value) => {
    const s = state({ sevenGive: true, tenDiscard: true, fiveSkip: true });
    const payload = { cards: ['J0'], jokerAs: { J0: face } };
    expect(daifugoGame.moves.playSet!.validate(s, 0, payload)).toBe(true);
    expect(playEffects(s, payload.cards, payload.jokerAs)[key]).toBe(value);
    const next = daifugoGame.moves.playSet!.apply(s, 0, payload, context());
    expect(next.hands[0]).not.toContain('J0');
    expect([...next.hands.flat(), ...next.pile, ...next.captured]).toContain('J0');
    if (key === 'clearReason') expect(next.standing).toBeNull();
    if (key === 'jackBack') expect(next.jackBack).toBe(true);
    if (key === 'give') expect(next.pendingPlay?.effects[0]?.kind).toBe('give');
    if (key === 'discard') expect(next.pendingPlay?.effects[0]?.kind).toBe('discard');
    if (key === 'skips') expect(next.turn).toBe(2);
  });
  it('counts substituted cards in grouped effects, can disable effects, and preserves forbidden finishes', () => {
    const s = state({ sevenGive: true, forbidJokerFinish: true });
    expect(playEffects(s, ['S7', 'J0', 'J1']).give).toBe(3);
    expect(
      playEffects({ ...s, rules: { ...s.rules, jokerEffects: false } }, ['S7', 'J0', 'J1']).give,
    ).toBe(1);
    expect(forbiddenFinishReason(s, ['J0'], { J0: 'C4' })).toBe('ジョーカー上がり');
    expect(forbiddenFinishReason(state({ forbidEightFinish: true }), ['J0'], { J0: 'C8' })).toBe(
      '8切り上がり',
    );
    expect(
      forbiddenFinishReason(state({ forbidStrongestFinish: true }), ['J0'], { J0: 'C2' }),
    ).toBe('最強札上がり');
  });
  it('can represent spade-three against a lone joker when substitute effects are enabled', () => {
    const s = state(
      {},
      {
        standing: {
          seat: 1,
          cards: ['J1'],
          kind: 'set',
          rank: 16,
          high: 16,
          suits: [],
          jokerOnly: true,
        },
      },
    );
    expect(playEffects(s, ['J0'], { J0: 'S3' }).clearReason).toBe('spade-three');
    expect(resolvePlay(s, ['J0'])?.effectiveCards).toEqual(['S3']);
    expect(
      validateCombination({ ...s, rules: { ...s.rules, jokerEffects: false } }, ['J0']),
    ).not.toBe(true);
  });
});

describe('joker-free tribute', () => {
  it.each([2, 3])('excludes jokers from seat %i gifts and CPU decisions', (seat) => {
    const s = state(
      {},
      {
        hands: [
          ['C3', 'C4'],
          ['D3', 'D4'],
          ['J0', 'S2', 'H1', 'H3'],
          ['J1', 'D2', 'C1', 'C9'],
        ],
        lastOrder: [0, 1, 2, 3],
        awaitingGive: [2, 3],
        turn: null,
      },
    );
    const count = seat === 2 ? 1 : 2;
    const choice = daifugoBots[2]!.chooseMove(s, seat, [{ id: 'giveCards' }], makeRng(1), {
      thinkMs: () => 0,
    })!;
    expect(daifugoGame.moves.giveCards!.validate(s, seat, choice.payload)).toBe(true);
    expect((choice.payload as { cards: string[] }).cards).toHaveLength(count);
    expect((choice.payload as { cards: string[] }).cards.some((c) => c.startsWith('J'))).toBe(
      false,
    );
    expect(
      daifugoGame.moves.giveCards!.validate(s, seat, {
        cards: count === 1 ? ['J0'] : ['J1', 'D2'],
      }),
    ).not.toBe(true);
    const allowed = { ...s, rules: { ...s.rules, excludeJokersFromExchange: false } };
    expect(
      daifugoGame.moves.giveCards!.validate(allowed, seat, {
        cards: count === 1 ? ['J0'] : ['J1', 'D2'],
      }),
    ).toBe(true);
  });
});

it('replays explicit joker declarations deterministically from the event log', () => {
  const config = daifugoConfig.resolve({ trading: false, targetPoints: 5 });
  let live = createSession(daifugoGame, { seed: 12, seats: 4, config });
  let declared = 0;
  for (let step = 0; step < 2000 && live.status === 'playing'; step++) {
    const seat = live.phase.actor!;
    const legal = daifugoGame.flow.legalMovesFor!(live.state, live.phase, seat);
    let choice = daifugoBots[2]!.chooseMove(live.state, seat, legal, makeRng(step), {
      thinkMs: () => 0,
    })!;
    for (const joker of live.state.hands[seat]!.filter((card) => card.startsWith('J'))) {
      const payload = { cards: [joker], jokerAs: { [joker]: 'C8' } as JokerAssignments };
      if (daifugoGame.moves.playSet!.validate(live.state, seat, payload) === true) {
        choice = { id: 'playSet', payload };
        declared++;
        break;
      }
    }
    const applied = sessionApply(daifugoGame, live, seat, choice.id, choice.payload);
    expect(applied.rejected).toBeUndefined();
    live = applied.session;
  }
  expect(declared).toBeGreaterThan(0);
  expect(live.status).toBe('ended');
  const replay = replaySession(daifugoGame, 12, live.log, { seats: 4, config, verify: true });
  expect(replay.fault).toBeNull();
  expect(stateHash(replay.state)).toBe(stateHash(live.state));
});
