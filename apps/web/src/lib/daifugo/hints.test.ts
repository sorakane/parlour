import { createSession } from '@parlour/engine';
import {
  daifugoGame,
  daifugoConfig,
  phaseFor,
  type DaifugoState,
  type DaifugoRules,
} from '@parlour/game-daifugo';
import { describe, expect, it } from 'vitest';
import { daifugoTableView } from './view';
import { daifugoHints, matchingHintCards } from './hints';
import { daifugoModeForRules, isDaifugoModeId } from './modes';

function hintFixture(
  hand: string[],
  extra: Partial<DaifugoState> = {},
  rules: Partial<DaifugoRules> = {},
) {
  const session = createSession(daifugoGame, {
    seed: 1,
    seats: 4,
    config: daifugoConfig.resolve(rules),
  });
  session.state = {
    ...session.state,
    hands: [hand, ['D3'], ['H3'], ['C3']],
    turn: 0,
    openingCard: null,
    ...extra,
  };
  session.phase = phaseFor(session.state);
  const snapshot = {
    session,
    mode: 'classic' as const,
    matchWinner: null,
    players: [0, 1, 2, 3].map((seat) => ({
      seat,
      name: `P${seat}`,
      avatarId: 'ember',
      isBot: seat !== 0,
    })),
  };
  const legal = daifugoGame.flow.legalMovesFor!(session.state, session.phase, 0);
  return { view: daifugoTableView(snapshot, legal), snapshot, legal };
}
const pile = (cards: string[], rank: number) => ({
  seat: 1,
  cards,
  rank,
  high: rank,
  kind: 'set' as const,
  suits: cards.map((c) => c[0]!),
  jokerOnly: rank === 16,
});

describe('legal hand hints', () => {
  it('offers only exact pairs under suit and rank locks, including joker substitution', () => {
    const { view, snapshot } = hintFixture(['S5', 'H5', 'D5', 'J0', 'S6', 'H6'], {
      standing: pile(['H4', 'S4'], 4),
      lockedSuits: ['H', 'S'],
      rankLocked: true,
    });
    const hints = daifugoHints(view);
    expect(hints).toHaveLength(3);
    for (const cards of hints)
      expect(daifugoGame.moves.playSet!.validate(snapshot.session.state, 0, { cards })).toBe(true);
    expect(matchingHintCards(view, ['S5'])).toEqual(new Set(['S5', 'H5', 'J0']));
    expect(matchingHintCards(view, ['S5', 'S6']).size).toBe(0);
  });
  it('uses reversed strength and supports spade-three return', () => {
    const reverse = hintFixture(['S3', 'S5', 'S9', 'J0'], {
      standing: pile(['H6'], 6),
      revolution: true,
    }).view;
    expect(daifugoHints(reverse)).toEqual([['S5'], ['S3'], ['J0']]);
    const joker = hintFixture(['S3', 'S9', 'J1'], {
      standing: pile(['J0'], 16),
      revolution: true,
      lockedSuits: ['H'],
      rankLocked: true,
    }).view;
    expect(daifugoHints(joker)).toEqual([['S3'], ['J1']]);
  });
  it('includes legal stairs and places forbidden finishes after safe options', () => {
    const run = hintFixture(['S4', 'J0', 'S6', 'C9'], {}, { stairs: true, stairsJoker: true }).view;
    expect(daifugoHints(run)[0]).toEqual(['S4', 'S6', 'J0']);
    const risk = hintFixture(
      ['C8', 'J0'],
      {},
      { forbidJokerFinish: true, forbidEightFinish: true },
    ).view;
    expect(daifugoHints(risk).at(-1)).toEqual(['C8', 'J0']);
  });
  it('has no candidates when blocked, off-turn or during card exchange', () => {
    const blocked = hintFixture(['S3', 'C4'], { standing: pile(['H2'], 15) });
    expect(daifugoHints(blocked.view)).toEqual([]);
    expect(blocked.view.legal.pass).toBe(true);
    expect(daifugoTableView(blocked.snapshot, blocked.legal, 1).legal.playableSets).toEqual([]);
    const exchanging = hintFixture(['S2', 'S3'], {
      lastOrder: [3, 2, 1, 0],
      awaitingGive: [0],
      turn: null,
    });
    expect(daifugoHints(exchanging.view)).toEqual([]);
  });
  it('recognizes the new mode for solo and received online settings', () => {
    expect(isDaifugoModeId('rank-up')).toBe(true);
    expect(
      daifugoModeForRules(daifugoConfig.resolve({ seatOrder: 'rank-ascending', stairs: true })),
    ).toBe('rank-up');
  });
});
