import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createSession } from '@parlour/engine';
import {
  combination,
  daifugoGame,
  daifugoConfig,
  validateCombination,
} from '@parlour/game-daifugo';
import { daifugoTableView } from '@/lib/daifugo/view';
import { DaifugoRuleStatus, nextLockedCards } from './DaifugoRuleStatus';

function fixture(cards = ['S8', 'H8'], overrides = {}) {
  const rules = daifugoConfig.resolve({ stairs: true, strictLock: true, stairsOverlap: false });
  const session = createSession(daifugoGame, { seed: 42, seats: 4, config: rules });
  const base = daifugoTableView(
    {
      session,
      mode: 'local',
      matchWinner: null,
      players: [0, 1, 2, 3].map((seat) => ({
        seat,
        name: `P${seat}`,
        avatarId: 'ember',
        isBot: seat !== 0,
      })),
    },
    [],
  );
  const set = combination(cards, session.state.rules)!;
  return {
    ...base,
    openingCard: null,
    rankLocked: true,
    lockedSuits: set.suits,
    standing: { ...set, cards, seat: 1 },
    ...overrides,
  };
}

describe('current rule constraints', () => {
  it('keeps the cause and required suit combination visible, including after reconnect', () => {
    const single = renderToStaticMarkup(
      createElement(DaifugoRuleStatus, { view: fixture(['C6'], { rankLocked: false }) }),
    );
    expect(single).toContain('同じ♣の組が続いたため');
    expect(single).toContain('♣が必要・場が流れるまで');
    const pair = renderToStaticMarkup(
      createElement(DaifugoRuleStatus, { view: fixture(['S8', 'H8'], { rankLocked: false }) }),
    );
    expect(pair).toContain('の組が続いたため');
    expect(pair).toContain('の組が必要・場が流れるまで');
    const clear = renderToStaticMarkup(
      createElement(DaifugoRuleStatus, {
        view: fixture(['C6'], { lockedSuits: [], rankLocked: false }),
      }),
    );
    expect(clear).not.toContain('続いたため');
    expect(clear).not.toContain('が必要');
  });

  it('distinguishes number-only lock and the combined club constraint', () => {
    const number = fixture(['C6'], { lockedSuits: [] });
    const html = renderToStaticMarkup(createElement(DaifugoRuleStatus, { view: number }));
    expect(html).toContain('数縛り · 次に出す札');
    expect(html).toContain('7 を1枚');
    expect(html).not.toContain('激縛り');
    const combined = renderToStaticMarkup(
      createElement(DaifugoRuleStatus, {
        view: { ...number, lockedSuits: ['C'] },
      }),
    );
    expect(combined).toContain('激縛り · 次に出す札');
    expect(combined).toContain('♣ 7 を1枚');
  });
  it('explains the spade-three exception without losing the current suit lock', () => {
    const base = fixture(['J0'], { rankLocked: false, lockedSuits: ['H'] });
    const view = { ...base, rules: { ...base.rules, spadeThree: true } };
    const html = renderToStaticMarkup(createElement(DaifugoRuleStatus, { view }));
    expect(html).toContain('♠3 で返せる');
    expect(html).toContain('スペ3返しは縛りより優先');
    expect(validateCombination(view, ['S3'])).toBe(true);
    expect(
      renderToStaticMarkup(
        createElement(DaifugoRuleStatus, {
          view: { ...view, rules: { ...view.rules, spadeThree: false } },
        }),
      ),
    ).toContain('返せる札なし');
  });

  it.each([
    [['S8', 'H8'], {}, '9 を2枚', ['S9', 'H9']],
    [['S8', 'H8'], { revolution: true }, '7 を2枚', ['S7', 'H7']],
    [['S8', 'H8'], { revolution: true, jackBack: true }, '9 を2枚', ['S9', 'H9']],
    [['S13'], {}, 'A を1枚', ['S1']],
    [['S1'], {}, '2 を1枚', ['S2']],
    [['S9', 'S10', 'S11'], {}, 'Q–A の階段', ['S12', 'S13', 'S1']],
    [['S9', 'S10', 'S11'], { revolution: true }, '6–8 の階段', ['S6', 'S7', 'S8']],
  ] as const)('matches legal play for %j with %j', (cards, overrides, expected, next) => {
    const view = fixture([...cards], overrides);
    expect(nextLockedCards(view)).toBe(expected);
    expect(validateCombination(view, next)).toBe(true);
  });
  it('handles overlapping runs, non-wrapping endpoints, and optional 2 in runs', () => {
    const v = fixture(['S9', 'S10', 'S11']);
    const overlap = { ...v, rules: { ...v.rules, stairsOverlap: true } };
    expect(nextLockedCards(overlap)).toBe('10–Q の階段');
    expect(validateCombination(overlap, ['S10', 'S11', 'S12'])).toBe(true);
    expect(nextLockedCards(fixture(['S2']))).toBe('続く数字なし');
    expect(nextLockedCards(fixture(['S3'], { revolution: true }))).toBe('続く数字なし');
    const end = fixture(['S10', 'S11', 'S12']);
    expect(nextLockedCards(end)).toBe('続く数字なし');
    const two = { ...end, rules: { ...end.rules, stairsTwo: true } };
    expect(nextLockedCards(two)).toBe('K–2 の階段');
    expect(validateCombination(two, ['S13', 'S1', 'S2'])).toBe(true);
  });
  it('renders reconnect state immediately and removes temporary locks on the next state', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const view = fixture(['S8', 'H8'], { revolution: true, jackBack: true });
    try {
      act(() => root.render(createElement(DaifugoRuleStatus, { view })));
      expect(container.textContent).toContain('9 を2枚');
      expect(container.textContent).toContain('重なって通常順');
      expect(container.querySelector('[aria-label="スペード"]')?.textContent).toBe('♠');
      expect(container.querySelector('[aria-label="ハート"]')?.textContent).toBe('♥');
      act(() =>
        root.render(
          createElement(DaifugoRuleStatus, {
            view: { ...view, standing: null, lockedSuits: [], rankLocked: false, jackBack: false },
          }),
        ),
      );
      expect(container.textContent).toContain('縛りなし');
      expect(container.textContent).toContain('逆転中');
      expect(container.textContent).not.toContain('激縛り');
      expect(container.textContent).not.toContain('11バック');
      expect(container.textContent).not.toContain('9 を2枚');
    } finally {
      act(() => root.unmount());
    }
  });
});
