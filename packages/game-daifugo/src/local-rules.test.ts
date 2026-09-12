import {
  createSession,
  sessionApply,
  replaySession,
  stateHash,
  makeRng,
  type MoveCtx,
} from '@parlour/engine';
import { describe, it, expect } from 'vitest';
import { daifugoGame, phaseFor, activeSeats } from './game';
import { daifugoConfig, type DaifugoRules } from './config';
import type { DaifugoState } from './state';
import { combination, validateCombination, playableSets } from './combinations';
import { daifugoBots } from './bots';
import { forbiddenFinishReason } from './effects';

function fixture(
  hands: string[][],
  rules: Partial<DaifugoRules> = {},
  extra: Partial<DaifugoState> = {},
): DaifugoState {
  return {
    ...createSession(daifugoGame, {
      seed: 1,
      seats: hands.length,
      config: daifugoConfig.resolve(rules),
    }).state,
    hands,
    turn: 0,
    openingCard: null,
    pile: [],
    captured: [],
    ...extra,
  };
}
const ctx = (): MoveCtx => ({ rng: makeRng(42), fx: { events: [], emit() {} }, event: { seq: 1 } });
function move(state: DaifugoState, id: string, seat: number, cards?: string[]) {
  const payload = cards ? { cards } : undefined;
  expect(daifugoGame.moves[id]!.validate(state, seat, payload), `${id} by ${seat}`).toBe(true);
  return daifugoGame.moves[id]!.apply(state, seat, payload, ctx());
}
const stairs = daifugoConfig.resolve({ stairs: true });

describe('default stairs during revolution', () => {
  it('accepts the photographed descending heart run and offers it as a legal choice', () => {
    const s = fixture([['H6', 'H5', 'H4', 'H3'], ['C9'], ['D9'], ['S9']], {}, { revolution: true });
    expect(s.rules.stairs).toBe(true);
    expect(validateCombination(s, ['H5', 'H4', 'H3'])).toBe(true);
    expect(playableSets(s, 0)).toContainEqual(['H3', 'H4', 'H5']);
    expect(validateCombination({ ...s, revolution: false }, ['H3', 'H4', 'H5'])).toBe(true);
    expect(
      validateCombination({ ...s, rules: { ...s.rules, stairs: false } }, ['H5', 'H4', 'H3']),
    ).not.toBe(true);
  });
});

describe('same-suit runs', () => {
  it('requires a single suit, distinct ranks and the configured minimum', () => {
    expect(combination(['S3', 'S4', 'S5'], stairs)).toMatchObject({
      kind: 'run',
      rank: 3,
      high: 5,
    });
    for (const cards of [
      ['S3', 'S4'],
      ['S3', 'H4', 'S5'],
      ['S3', 'S5', 'S6'],
      ['S3', 'S3', 'S4'],
    ])
      expect(combination(cards, stairs)).toBeNull();
    expect(combination(['S3', 'S4', 'S5'])).toBeNull();
    expect(combination(['S3', 'S4', 'S5'], { ...stairs, stairsMin: 4 })).toBeNull();
  });
  it('optionally includes 2 after ace without wrapping to 3', () => {
    expect(combination(['H13', 'H1', 'H2'], stairs)).toBeNull();
    expect(combination(['H13', 'H1', 'H2'], { ...stairs, stairsTwo: true })).toMatchObject({
      rank: 13,
      high: 15,
    });
    expect(combination(['H1', 'H2', 'H3'], { ...stairs, stairsTwo: true })).toBeNull();
  });
  it('allows joker gaps and endpoints when enabled', () => {
    expect(combination(['H3', 'H5', 'J0'], { ...stairs, stairsJoker: false })).toBeNull();
    const rules = { ...stairs, stairsJoker: true };
    expect(combination(['H3', 'H5', 'J0'], rules)).toMatchObject({ kind: 'run', rank: 3, high: 5 });
    expect(combination(['H3', 'H6', 'J0', 'J1'], rules)).toMatchObject({ high: 6 });
    expect(combination(['H3', 'H4', 'J0'], rules)).toMatchObject({ kind: 'run', rank: 3, high: 5 });
    // Same-rank substitution is still a set, not a run.
    expect(combination(['H3', 'J0', 'J1'], rules)?.kind).toBe('set');
  });
  it('compares runs separately from rank sets and enforces length and overlap', () => {
    let s = fixture([['S3', 'S4', 'S5', 'C12'], ['H4', 'H5', 'H6', 'C13'], ['D3'], ['C3']], {
      stairs: true,
    });
    s = move(s, 'playSet', 0, ['S3', 'S4', 'S5']);
    expect(validateCombination(s, ['H4', 'H5', 'H6'])).toBe(true);
    expect(validateCombination(s, ['H7', 'D7', 'C7'])).not.toBe(true);
    expect(validateCombination(s, ['H4', 'H5', 'H6', 'H7'])).not.toBe(true);
    s = { ...s, rules: { ...s.rules, stairsOverlap: false } };
    expect(validateCombination(s, ['H4', 'H5', 'H6'])).not.toBe(true);
    expect(validateCombination(s, ['H6', 'H7', 'H8'])).toBe(true);
    s = { ...s, revolution: true };
    expect(validateCombination(s, ['H3', 'H4', 'H5'])).not.toBe(true);
  });
  it('enumerates long runs without the six-card set limit', () => {
    const cards = Array.from({ length: 10 }, (_, i) => `H${i + 3}`);
    const s = fixture([cards, ['S3'], ['D3'], ['C3']], { stairs: true });
    expect(playableSets(s, 0)).toContainEqual(cards);
    expect(daifugoGame.moves.playSet!.validate(s, 0, { cards })).toBe(true);
  });
  it('does not treat a four-card run as a four-of-a-kind revolution', () => {
    let s = fixture([['H3', 'H4', 'H5', 'H6', 'C12'], ['S3'], ['D3'], ['C3']], { stairs: true });
    s = move(s, 'playSet', 0, ['H3', 'H4', 'H5', 'H6']);
    expect(s.revolution).toBe(false);
  });
  it('combines stair revolution and 11-back, then clears only temporary effects', () => {
    let s = fixture([['H9', 'H10', 'H11', 'H12', 'C12'], ['S3'], ['D3'], ['C3']], {
      stairs: true,
      stairsRevolution: true,
    });
    s = move(s, 'playSet', 0, ['H9', 'H10', 'H11', 'H12']);
    expect(s).toMatchObject({ revolution: true, jackBack: true });
    s = move(s, 'pass', 1);
    s = move(s, 'pass', 2);
    s = move(s, 'pass', 3);
    expect(s).toMatchObject({ revolution: true, jackBack: false });
  });
  it('can disable card-number effects on runs while retaining stair revolution', () => {
    let s = fixture([['H7', 'H8', 'H9', 'H10', 'C12'], ['S3'], ['D3'], ['C3']], {
      stairs: true,
      stairsRevolution: true,
      specialsOnStairs: false,
      sevenGive: true,
      tenDiscard: true,
    });
    s = move(s, 'playSet', 0, ['H7', 'H8', 'H9', 'H10']);
    expect(s.revolution).toBe(true);
    expect(s.standing?.kind).toBe('run');
    expect(s.pendingPlay).toBeNull();
  });
});

describe('strict lock', () => {
  it('does not introduce ordinary suit lock when only strict lock is enabled', () => {
    let s = fixture([['S4', 'C12'], ['S6', 'C13'], ['H7'], ['D3']], {
      strictLock: true,
      suitLock: false,
    });
    s = move(s, 'playSet', 0, ['S4']);
    s = move(s, 'playSet', 1, ['S6']);
    expect(s).toMatchObject({ rankLocked: false, lockedSuits: [] });
    expect(validateCombination(s, ['H7'])).toBe(true);
  });
  it('requires the next rank and suit, including after reversal and a sweep', () => {
    let s = fixture([['S4', 'C12'], ['S5', 'C13'], ['S6', 'S7', 'J0'], ['D3']], {
      strictLock: true,
      suitLock: false,
    });
    s = move(s, 'playSet', 0, ['S4']);
    s = move(s, 'playSet', 1, ['S5']);
    expect(s).toMatchObject({ rankLocked: true, lockedSuits: ['S'] });
    expect(validateCombination(s, ['S6'])).toBe(true);
    expect(validateCombination(s, ['H6'])).not.toBe(true);
    expect(validateCombination(s, ['S7'])).not.toBe(true);
    expect(validateCombination(s, ['J0'])).toBe(true);
    expect(validateCombination({ ...s, revolution: true }, ['S4'])).toBe(true);
    s = move(s, 'pass', 2);
    s = move(s, 'pass', 3);
    s = move(s, 'pass', 0);
    expect(s).toMatchObject({ rankLocked: false, lockedSuits: [] });
  });
  it('uses the next non-overlapping run when overlap is disabled', () => {
    let s = fixture([['H3', 'H4', 'H5', 'C12'], ['H6', 'H7', 'H8', 'C13'], ['D3'], ['C3']], {
      stairs: true,
      stairsOverlap: false,
      strictLock: true,
      eightCut: false,
    });
    s = move(s, 'playSet', 0, ['H3', 'H4', 'H5']);
    s = move(s, 'playSet', 1, ['H6', 'H7', 'H8']);
    expect(s.rankLocked).toBe(true);
    expect(validateCombination(s, ['H9', 'H10', 'H11'])).toBe(true);
    expect(validateCombination(s, ['H10', 'H11', 'H12'])).not.toBe(true);
  });
});

describe('seven give and ten discard', () => {
  it('pauses for owned-card selection, uses seat order even for passed recipients', () => {
    let s = fixture(
      [['S7', 'C4', 'C9'], ['H3'], ['D3'], ['C3']],
      { sevenGive: true },
      { seatOrder: [0, 2, 1, 3], lockedOut: [2] },
    );
    s = move(s, 'playSet', 0, ['S7']);
    expect(phaseFor(s)).toMatchObject({ phase: 'effect-give', actor: 0 });
    expect(s.pendingPlay?.effects[0]).toEqual({ kind: 'give', count: 1, recipient: 2 });
    for (const [seat, cards] of [
      [1, ['H3']],
      [0, ['S7']],
      [0, ['C4', 'C9']],
      [0, ['C4', 'C4']],
    ] as const)
      expect(daifugoGame.moves.resolveEffect!.validate(s, seat, { cards })).not.toBe(true);
    expect(daifugoGame.moves.pass!.validate(s, 0, undefined)).not.toBe(true);
    s = move(s, 'resolveEffect', 0, ['C4']);
    expect(s.hands[2]).toContain('C4');
    expect(s.pendingPlay).toBeNull();
    expect(s.turn).toBe(1);
  });
  it('skips already finished recipients and caps the count at remaining cards', () => {
    let s = fixture(
      [['S7', 'H7', 'C4'], [], ['D3'], ['C3']],
      { sevenGive: true },
      { finished: [1] },
    );
    s = move(s, 'playSet', 0, ['S7', 'H7']);
    expect(s.pendingPlay?.effects[0]).toEqual({ kind: 'give', count: 1, recipient: 2 });
    s = move(s, 'resolveEffect', 0, ['C4']);
    expect(s.finished).toEqual([1, 0]);
    expect(s.hands[2]).toContain('C4');
  });
  it('resolves seven then ten before eight-cut, conserving every card', () => {
    const hands = [['H7', 'H8', 'H9', 'H10', 'C4', 'C5', 'C6'], ['S3'], ['D3'], ['C3']];
    let s = fixture(hands, { stairs: true, sevenGive: true, tenDiscard: true });
    s = move(s, 'playSet', 0, ['H7', 'H8', 'H9', 'H10']);
    expect(s.standing).not.toBeNull();
    expect(s.pendingPlay?.effects.map((e) => e.kind)).toEqual(['give', 'discard']);
    s = move(s, 'resolveEffect', 0, ['C4']);
    expect(phaseFor(s).phase).toBe('effect-discard');
    s = move(s, 'resolveEffect', 0, ['C5']);
    expect(s).toMatchObject({ standing: null, turn: 0, pendingPlay: null });
    expect(s.hands[1]).toContain('C4');
    expect(s.captured).toContain('C5');
    expect([...s.hands.flat(), ...s.pile, ...s.captured].sort()).toEqual(hands.flat().sort());
  });
  it('does not manufacture additional effects from a discarded or substituted card', () => {
    let s = fixture([['S10', 'S7', 'S9'], ['H3'], ['D3'], ['C3']], {
      sevenGive: true,
      tenDiscard: true,
    });
    s = move(s, 'playSet', 0, ['S10']);
    s = move(s, 'resolveEffect', 0, ['S7']);
    expect(s.pendingPlay).toBeNull();
    expect(s.hands[1]).toEqual(['H3']);
    s = fixture([['S10', 'J0', 'C4', 'C5'], ['H3'], ['D3'], ['C3']], {
      tenDiscard: true,
      jokerEffects: false,
    });
    s = move(s, 'playSet', 0, ['S10', 'J0']);
    expect(s.pendingPlay?.effects[0]?.count).toBe(1);
  });
  it('allows direct seven/ten finishing without a zero-card prompt', () => {
    for (const card of ['S7', 'S10']) {
      let s = fixture([[card], ['H3'], ['D3'], ['C3']], { sevenGive: true, tenDiscard: true });
      s = move(s, 'playSet', 0, [card]);
      expect(s.finished).toEqual([0]);
      expect(s.pendingPlay).toBeNull();
    }
  });
});

describe('finish penalties and miyako', () => {
  it.each([
    ['forbidJokerFinish', 'J0'],
    ['forbidEightFinish', 'S8'],
    ['forbidStrongestFinish', 'S2'],
  ] as const)('demotes %s without wedging a hand made only of forbidden cards', (key, card) => {
    let s = fixture([[card], ['H3'], ['D4'], ['C5']], { [key]: true });
    s = move(s, 'playSet', 0, [card]);
    expect(s.eliminated.map((e) => e.seat)).toEqual([0]);
    expect(activeSeats(s)).not.toContain(0);
    // Later finish order puts the first offender last.
    s = { ...s, standing: null, lockedOut: [], passedCycle: [], turn: 1 };
    s = move(s, 'playSet', 1, ['H3']);
    s = move(s, 'playSet', 2, ['D4']);
    expect(s.lastOrder).toEqual([1, 2, 3, 0]);
  });
  it('evaluates strongest-card finishing before the played effect changes strength', () => {
    const s = fixture(
      [['S3'], ['H4'], ['D5'], ['C6']],
      { forbidStrongestFinish: true },
      { revolution: true },
    );
    expect(forbiddenFinishReason(s, ['S3'])).not.toBeNull();
    expect(forbiddenFinishReason({ ...s, jackBack: true }, ['S3'])).toBeNull();
    expect(forbiddenFinishReason({ ...s, jackBack: true }, ['S2'])).not.toBeNull();
  });
  it('penalizes spade-three only when it is returning a single joker', () => {
    let s = fixture([['J0', 'C4'], ['S3'], ['D5'], ['C6']], { forbidSpadeThreeFinish: true });
    expect(forbiddenFinishReason(s, ['S3'])).toBeNull();
    s = move(s, 'playSet', 0, ['J0']);
    s = move(s, 'playSet', 1, ['S3']);
    expect(s.eliminated[0]?.seat).toBe(1);
    expect(s.standing).toBeNull();
    expect(s.turn).toBe(2);
  });
  it.each([false, true])('configures finishing through ten-discard: penalty=%s', (penalty) => {
    let s = fixture([['S10', 'S2'], ['H3'], ['D4'], ['C5']], {
      tenDiscard: true,
      forbidStrongestFinish: true,
      forbidEffectFinish: penalty,
    });
    s = move(s, 'playSet', 0, ['S10']);
    s = move(s, 'resolveEffect', 0, ['S2']);
    expect(s.finished.includes(0)).toBe(!penalty);
    expect(s.eliminated.some((e) => e.seat === 0)).toBe(penalty);
  });
  it('drops the previous winner only after someone else finishes normally', () => {
    let s = fixture(
      [['S4'], ['H5', 'H6'], ['D7', 'D8'], ['C9']],
      { miyako: true },
      { lastOrder: [2, 1, 3, 0] },
    );
    s = move(s, 'playSet', 0, ['S4']);
    expect(s.eliminated).toEqual([{ seat: 2, reason: '都落ち' }]);
    expect(s.hands[2]).toEqual([]);
    expect(s.captured).toEqual(['D7', 'D8']);
    expect(activeSeats(s)).not.toContain(2);
  });
  it('does not trigger miyako on a foul or when the old winner wins again', () => {
    let s = fixture(
      [['J0'], ['H5'], ['D7', 'D8'], ['C9']],
      { miyako: true, forbidJokerFinish: true },
      { lastOrder: [2, 1, 3, 0] },
    );
    s = move(s, 'playSet', 0, ['J0']);
    expect(s.eliminated.map((e) => e.seat)).toEqual([0]);
    s = fixture([['S4'], ['H5'], ['D7'], ['C9']], { miyako: true }, { lastOrder: [0, 1, 2, 3] });
    s = move(s, 'playSet', 0, ['S4']);
    expect(s.eliminated).toEqual([]);
  });
});

it.each([4, 5, 6, 7, 8])(
  'finishes and exactly replays %i-seat matches with all local rules enabled',
  (seats) => {
    for (const seed of [3, 17, 43]) {
      const config = daifugoConfig.resolve({
        stairs: true,
        stairsJoker: true,
        stairsTwo: true,
        stairsRevolution: true,
        strictLock: true,
        numberLock: true,
        sevenGive: true,
        tenDiscard: true,
        miyako: true,
        forbidJokerFinish: true,
        forbidEightFinish: true,
        forbidStrongestFinish: true,
        forbidSpadeThreeFinish: true,
        forbidEffectFinish: seed === 17,
        fiveSkip: true,
        seatOrder: 'random',
        targetPoints: 21,
        stairsOverlap: seed !== 43,
      });
      let live = createSession(daifugoGame, { seed, seats, config });
      for (let step = 0; step < 5000 && live.status === 'playing'; step++) {
        const actor = live.phase.actor!;
        const legal = daifugoGame.flow.legalMovesFor!(live.state, live.phase, actor);
        const chosen = daifugoBots[2]!.chooseMove(
          daifugoGame.playerView(live.state, actor),
          actor,
          legal,
          makeRng(seed).fork(String(step)),
          { thinkMs: () => 0 },
        );
        expect(chosen, `stalled: ${live.phase.phase}`).not.toBeNull();
        const result = sessionApply(daifugoGame, live, actor, chosen!.id, chosen!.payload);
        expect(result.rejected).toBeUndefined();
        live = result.session;
        const all = [...live.state.hands.flat(), ...live.state.pile, ...live.state.captured];
        expect(all).toHaveLength(54);
        expect(new Set(all).size).toBe(54);
        const out = [...live.state.finished, ...live.state.eliminated.map((e) => e.seat)];
        if (live.state.finished.length < seats) expect(new Set(out).size).toBe(out.length);
      }
      expect(live.status).toBe('ended');
      expect(new Set(live.state.lastOrder!).size).toBe(seats);
      const replay = replaySession(daifugoGame, seed, live.log, { seats, config, verify: true });
      expect(replay.fault).toBeNull();
      expect(stateHash(replay.state)).toBe(stateHash(live.state));
    }
  },
  30000,
);

describe('independent number lock', () => {
  it('locks 3→4 across suits, advances to 5→6, constrains jokers and clears on passes', () => {
    let s = fixture(
      [
        ['S3', 'C12'],
        ['H4', 'C13'],
        ['D5', 'J0', 'S9'],
        ['C6', 'D12'],
      ],
      {
        numberLock: true,
        suitLock: false,
        strictLock: false,
      },
    );
    s = move(s, 'playSet', 0, ['S3']);
    s = move(s, 'playSet', 1, ['H4']);
    expect(s).toMatchObject({ rankLocked: true, lockedSuits: [] });
    for (const suit of ['S', 'H', 'D', 'C'])
      expect(validateCombination(s, [`${suit}5`])).toBe(true);
    expect(validateCombination(s, ['D6'])).not.toBe(true);
    expect(validateCombination(s, ['J0'])).toBe(true);
    expect(validateCombination(s, ['J0'], { J0: 'C5' })).toBe(true);
    expect(validateCombination(s, ['J0'], { J0: 'C9' })).not.toBe(true);
    expect(playableSets(s, 2)).toContainEqual(['D5']);
    expect(playableSets(s, 2)).not.toContainEqual(['S9']);
    s = move(s, 'playSet', 2, ['D5']);
    expect(validateCombination(s, ['C6'])).toBe(true);
    expect(validateCombination(s, ['C7'])).not.toBe(true);
    s = move(s, 'pass', 3);
    s = move(s, 'pass', 0);
    s = move(s, 'pass', 1);
    expect(s).toMatchObject({ rankLocked: false, lockedSuits: [], standing: null });
  });
  it('combines with suit lock for club 5→6, even when legacy strict lock is off', () => {
    let s = fixture([['C5', 'S12'], ['C6', 'H13'], ['C7', 'H7', 'C9'], ['D3']], {
      numberLock: true,
      suitLock: true,
      strictLock: false,
    });
    s = move(s, 'playSet', 0, ['C5']);
    s = move(s, 'playSet', 1, ['C6']);
    expect(s).toMatchObject({ rankLocked: true, lockedSuits: ['C'] });
    expect(validateCombination(s, ['C7'])).toBe(true);
    expect(validateCombination(s, ['H7'])).not.toBe(true);
    expect(validateCombination(s, ['C9'])).not.toBe(true);
    expect(validateCombination(s, ['J0'], { J0: 'C7' })).toBe(true);
    expect(validateCombination(s, ['J0'], { J0: 'H7' })).not.toBe(true);
  });
  it('can acquire suit lock after number lock has already started', () => {
    let s = fixture(
      [
        ['S3', 'S12'],
        ['H4', 'H13'],
        ['H5', 'C13'],
        ['H6', 'C6'],
      ],
      {
        numberLock: true,
        suitLock: true,
      },
    );
    s = move(s, 'playSet', 0, ['S3']);
    s = move(s, 'playSet', 1, ['H4']);
    expect(s.lockedSuits).toEqual([]);
    s = move(s, 'playSet', 2, ['H5']);
    expect(s).toMatchObject({ rankLocked: true, lockedSuits: ['H'] });
    expect(validateCombination(s, ['H6'])).toBe(true);
    expect(validateCombination(s, ['C6'])).not.toBe(true);
  });
  it('supports pairs and reversed direction', () => {
    let s = fixture(
      [['S6', 'H6', 'C12'], ['D5', 'C5', 'C13'], ['S4', 'H4'], ['D3']],
      {
        numberLock: true,
        suitLock: false,
      },
      { revolution: true },
    );
    s = move(s, 'playSet', 0, ['S6', 'H6']);
    s = move(s, 'playSet', 1, ['D5', 'C5']);
    expect(s.rankLocked).toBe(true);
    expect(validateCombination(s, ['S4', 'H4'])).toBe(true);
    expect(validateCombination(s, ['S3', 'H3'])).not.toBe(true);
    expect(validateCombination(s, ['S4'])).not.toBe(true);
    expect(validateCombination({ ...s, jackBack: true }, ['S6', 'H6'])).toBe(true);
  });
  it('does not wrap beyond 2 and clears both constraints on eight cut', () => {
    let end = fixture([['S1', 'C12'], ['H2', 'C13'], ['D3', 'J0'], ['C3']], {
      numberLock: true,
    });
    end = move(end, 'playSet', 0, ['S1']);
    end = move(end, 'playSet', 1, ['H2']);
    expect(end.rankLocked).toBe(true);
    expect(validateCombination(end, ['D3'])).not.toBe(true);
    expect(validateCombination(end, ['J0'])).not.toBe(true);
    let s = fixture([['C6', 'S12'], ['C7', 'H13'], ['C8', 'D12'], ['D3']], {
      numberLock: true,
      suitLock: true,
      eightCut: true,
    });
    s = move(s, 'playSet', 0, ['C6']);
    s = move(s, 'playSet', 1, ['C7']);
    expect(s).toMatchObject({ rankLocked: true, lockedSuits: ['C'] });
    s = move(s, 'playSet', 2, ['C8']);
    expect(s).toMatchObject({ rankLocked: false, lockedSuits: [], standing: null });
  });
  it('does not lock skipped ranks or enable itself in existing defaults', () => {
    for (const rules of [{ numberLock: false }, { numberLock: true }]) {
      let s = fixture([['S3', 'C12'], ['H5', 'C13'], ['D7'], ['C3']], rules);
      s = move(s, 'playSet', 0, ['S3']);
      s = move(s, 'playSet', 1, ['H5']);
      expect(s.rankLocked).toBe(false);
      expect(validateCombination(s, ['D7'])).toBe(true);
    }
    let s = fixture([['S3', 'C12'], ['H4', 'C13'], ['D7'], ['C3']]);
    s = move(s, 'playSet', 0, ['S3']);
    s = move(s, 'playSet', 1, ['H4']);
    expect(s.rankLocked).toBe(false);
  });
});
