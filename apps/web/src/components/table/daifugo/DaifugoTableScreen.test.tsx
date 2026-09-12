import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession } from '@parlour/engine';
import { daifugoGame, daifugoConfig, phaseFor } from '@parlour/game-daifugo';
import { daifugoTableView, daifugoConfirmMove } from '@/lib/daifugo/view';
import { DaifugoTableScreen } from './DaifugoTableScreen';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Daifugo local-rule choices', () => {
  it.each(['give', 'discard'] as const)(
    'selects owned cards to resolve %s, without offering a pass',
    (kind) => {
      const session = createSession(daifugoGame, {
        seed: 1,
        seats: 4,
        config: daifugoConfig.resolve({ sevenGive: true, tenDiscard: true }),
      });
      session.state = {
        ...session.state,
        hands: [['C4', 'C9', 'S12'], ['H3'], ['D3'], ['C3']],
        turn: 0,
        pendingPlay: {
          seat: 0,
          effects: [{ kind, count: 2, recipient: kind === 'give' ? 1 : null }],
          clearReason: null,
          skips: 0,
          forbiddenReason: null,
        },
      };
      session.phase = phaseFor(session.state);
      const snapshot = {
        session,
        mode: 'local' as const,
        matchWinner: null,
        players: [0, 1, 2, 3].map((seat) => ({
          seat,
          name: `P${seat}`,
          avatarId: 'ember',
          isBot: seat !== 0,
        })),
      };
      const legal = daifugoGame.flow.legalMovesFor!(session.state, session.phase, 0);
      const view = daifugoTableView(snapshot, legal);
      const onConfirm = vi.fn();
      act(() =>
        root.render(createElement(DaifugoTableScreen, { view, fx: [], fxKey: 'ready', onConfirm })),
      );
      expect(view.decision).toBe(`effect-${kind}`);
      expect(daifugoConfirmMove(session.phase.phase)).toBe('resolveEffect');
      expect(daifugoTableView(snapshot, [], 1).decision).toBeNull();
      expect(container.textContent).toContain(
        kind === 'give' ? '7渡し — P1へ2枚' : '10捨て — 2枚捨てる',
      );
      const confirm = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => b.textContent === (kind === 'give' ? '2枚 渡す' : '2枚 捨てる'),
      )!;
      expect(confirm.disabled).toBe(true);
      const cards = [...container.querySelectorAll<HTMLButtonElement>('[data-hand-card] button')];
      expect(cards).toHaveLength(3);
      act(() => cards[0]!.click());
      expect(confirm.disabled).toBe(true);
      act(() => cards[0]!.click());
      const pointer = (type: string, x: number) => {
        const event = new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: 5,
          button: 0,
        });
        Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
        act(() => cards[0]!.dispatchEvent(event));
      };
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: (x: number) => cards[Math.min(2, Math.floor(x / 10))],
      });
      pointer('pointerdown', 0);
      pointer('pointermove', 28);
      pointer('pointerup', 28);
      Reflect.deleteProperty(document, 'elementFromPoint');
      expect(cards.map((card) => card.getAttribute('aria-pressed'))).toEqual([
        'true',
        'true',
        'false',
      ]);
      expect(onConfirm).not.toHaveBeenCalled();
      expect(confirm.disabled).toBe(false);
      act(() => confirm.click());
      expect(onConfirm).toHaveBeenCalledWith(['C4', 'C9']);
      expect(
        daifugoGame.moves.resolveEffect!.validate(session.state, 0, {
          cards: onConfirm.mock.calls[0]![0],
        }),
      ).toBe(true);
      expect([...container.querySelectorAll('button')].some((b) => b.textContent === 'パス')).toBe(
        false,
      );
    },
  );
});

describe('hand hints and seat positions', () => {
  function makeView() {
    const session = createSession(daifugoGame, {
      seed: 1,
      seats: 4,
      config: daifugoConfig.resolve({}),
    });
    session.state = {
      ...session.state,
      hands: [['C4', 'D4', 'C6', 'D6'], ['S3'], ['H3'], ['D3']],
      turn: 0,
      openingCard: null,
      seatOrder: [3, 1, 0, 2],
      lastOrder: [2, 0, 1, 3],
      standing: {
        seat: 2,
        cards: ['S3', 'H3'],
        rank: 3,
        high: 3,
        kind: 'set',
        suits: ['H', 'S'],
        jokerOnly: false,
      },
    };
    session.phase = phaseFor(session.state);
    return daifugoTableView(
      {
        session,
        mode: 'rank-up',
        matchWinner: null,
        players: [0, 1, 2, 3].map((seat) => ({
          seat,
          name: `P${seat}`,
          avatarId: 'ember',
          isBot: seat !== 0,
        })),
      },
      daifugoGame.flow.legalMovesFor!(session.state, session.phase, 0),
    );
  }
  it('cycles whole legal groups, waits for confirmation and clears stale selections', () => {
    const view = makeView();
    const onConfirm = vi.fn();
    const render = (fxKey: number) =>
      act(() => root.render(createElement(DaifugoTableScreen, { view, fx: [], fxKey, onConfirm })));
    const button = (text: string) =>
      [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent?.startsWith(text),
      )!;
    render(1);
    expect(container.textContent).toContain('出せる組 2通り');
    expect(container.querySelector('[data-seat="0"]')?.getAttribute('data-position')).toBe('0');
    expect(container.querySelector('[data-seat="2"]')?.getAttribute('data-position')).toBe('1');
    expect(container.querySelector('[data-testid="daifugo-order"]')?.textContent).toBe(
      '手番順：P3（大貧民） → P1（貧民） → P0（富豪） → P2（大富豪）',
    );
    act(() => button('出せる組を見る').click());
    expect(container.querySelectorAll('[data-hand-card] button[aria-pressed="true"]')).toHaveLength(
      2,
    );
    expect(button('出す (2)').disabled).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => button('次の出せる組').click());
    act(() => button('出す (2)').click());
    expect(onConfirm).toHaveBeenCalledWith(['C6', 'D6']);
    act(() => button('出せる組を見る').click());
    render(2);
    expect(container.querySelectorAll('[data-hand-card] button[aria-pressed="true"]')).toHaveLength(
      0,
    );
    expect(button('出す').disabled).toBe(true);
  });
  it('hides assistance while busy and on an opponent turn', () => {
    const view = makeView();
    act(() =>
      root.render(createElement(DaifugoTableScreen, { view, fx: [], fxKey: 1, busy: true })),
    );
    expect(container.textContent).not.toContain('出せる組を見る');
    act(() =>
      root.render(
        createElement(DaifugoTableScreen, { view: { ...view, decision: null }, fx: [], fxKey: 2 }),
      ),
    );
    expect(container.textContent).not.toContain('出せる組を見る');
  });
});

describe('joker declarations and tribute selection', () => {
  function jokerView(exchange = false) {
    const session = createSession(daifugoGame, {
      seed: 1,
      seats: 4,
      config: daifugoConfig.resolve({}),
    });
    session.state = {
      ...session.state,
      hands: [['J0', 'S2', 'H1', 'C4'], ['S3'], ['H3'], ['D3']],
      turn: exchange ? null : 0,
      openingCard: null,
      ...(exchange ? { lastOrder: [3, 2, 1, 0], awaitingGive: [0] } : {}),
    };
    session.phase = phaseFor(session.state);
    return daifugoTableView(
      {
        session,
        mode: 'classic',
        matchWinner: null,
        players: [0, 1, 2, 3].map((seat) => ({
          seat,
          name: `P${seat}`,
          avatarId: 'ember',
          isBot: seat !== 0,
        })),
      },
      daifugoGame.flow.legalMovesFor!(session.state, session.phase, 0),
    );
  }
  it('reorders the rendered hand when strength reverses and restores it on the next deal', () => {
    const initial = jokerView();
    const render = (view: typeof initial, fxKey: number) =>
      act(() => root.render(createElement(DaifugoTableScreen, { view, fx: [], fxKey })));
    const cards = () =>
      Array.from(container.querySelectorAll('[data-hand-card]')).map((e) =>
        e.getAttribute('data-card-id'),
      );
    render(initial, 1);
    expect(cards()).toEqual(['C4', 'H1', 'S2', 'J0']);
    render({ ...initial, revolution: true }, 2);
    expect(cards()).toEqual(['S2', 'H1', 'C4', 'J0']);
    render({ ...initial, revolution: true, jackBack: true }, 3);
    expect(cards()).toEqual(['C4', 'H1', 'S2', 'J0']);
    render({ ...initial, dealNumber: initial.dealNumber + 1 }, 4);
    expect(cards()).toEqual(['C4', 'H1', 'S2', 'J0']);
  });
  it('offers the extra pass only when no legal set exists and the player can act', () => {
    const playable = jokerView();
    const blocked = {
      ...playable,
      legal: { ...playable.legal, playableSets: [], playableCards: [], pass: true },
    };
    const onPass = vi.fn();
    const render = (view: typeof playable, busy = false) =>
      act(() =>
        root.render(createElement(DaifugoTableScreen, { view, busy, fx: [], fxKey: 1, onPass })),
      );
    const shortcut = () =>
      container.querySelector<HTMLButtonElement>('[aria-label="パス（出せる組なし）"]');
    render(playable);
    expect(shortcut()).toBeNull(); // No selection does not mean there are no playable sets.
    render(blocked);
    expect(shortcut()).not.toBeNull();
    act(() => shortcut()!.click());
    expect(onPass).toHaveBeenCalledTimes(1);
    render(blocked, true);
    expect(shortcut()).toBeNull();
    render({ ...blocked, legal: { ...blocked.legal, pass: false } });
    expect(shortcut()).toBeNull();
    render({ ...blocked, decision: null });
    expect(shortcut()).toBeNull();
    render(playable);
    expect(shortcut()).toBeNull();
  });
  it('sends an explicit joker role only after confirmation and clears it next turn', () => {
    const view = jokerView();
    const onConfirm = vi.fn();
    const render = (fxKey: number) =>
      act(() => root.render(createElement(DaifugoTableScreen, { view, fx: [], fxKey, onConfirm })));
    render(1);
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-hand-card][data-card-id="J0"] button')!
        .click(),
    );
    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="ジョーカー1の代用先"]',
    )!;
    act(() => {
      select.value = 'C8';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('8切り');
    expect(onConfirm).not.toHaveBeenCalled();
    const confirm = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent === '出す (1)',
    )!;
    act(() => confirm.click());
    expect(onConfirm).toHaveBeenCalledWith(['J0'], { J0: 'C8' });
    render(2);
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-hand-card][data-card-id="J0"] button')!
        .click(),
    );
    expect(container.querySelector<HTMLSelectElement>('select')!.value).toBe('');
  });
  it('disables jokers for tribute and accepts the strongest remaining cards', () => {
    const view = jokerView(true);
    const onConfirm = vi.fn();
    act(() =>
      root.render(createElement(DaifugoTableScreen, { view, fx: [], fxKey: 1, onConfirm })),
    );
    expect(
      container.querySelector<HTMLButtonElement>('[data-hand-card][data-card-id="J0"] button')!
        .disabled,
    ).toBe(true);
    for (const card of ['S2', 'H1'])
      act(() =>
        container
          .querySelector<HTMLButtonElement>(`[data-hand-card][data-card-id="${card}"] button`)!
          .click(),
      );
    const confirm = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent === '2枚 渡す',
    )!;
    expect(confirm.disabled).toBe(false);
    act(() => confirm.click());
    expect(onConfirm).toHaveBeenCalledWith(['S2', 'H1']);
  });
});
