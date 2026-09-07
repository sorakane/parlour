import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession, type FxEvent } from '@parlour/engine';
import { daifugoGame, daifugoConfig } from '@parlour/game-daifugo';
import { daifugoTableView } from '@/lib/daifugo/view';
import { DaifugoPresentation, daifugoNotice } from './DaifugoPresentation';

function view() {
  const session = createSession(daifugoGame, {
    seed: 42,
    seats: 4,
    config: daifugoConfig.resolve({}),
  });
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
    [],
  );
}
const play: FxEvent[] = [{ kind: 'daifugo.set', payload: { seat: 0, count: 4, rank: 7 } }];
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('Daifugo presentation follows confirmed state', () => {
  it('announces a revolution once and does not infer one on reconnect or unrelated renders', () => {
    const before = view();
    const after = { ...before, revolution: true };
    expect(daifugoNotice(before, after, play)?.title).toBe('革命');
    expect(daifugoNotice(after, after, play)).toBeNull();
    expect(daifugoNotice(null, after, [])).toBeNull();
    expect(daifugoNotice(before, after, [])).toBeNull();
    expect(before.revolution).toBe(false);
  });
  it('uses actual local-seat rank and gives final outcome priority over effects', () => {
    const v = { ...view(), localSeat: 2 };
    const roles = [
      { kind: 'daifugo.role', payload: { seat: 0, role: 'daifugo' } },
      { kind: 'daifugo.role', payload: { seat: 2, role: 'scum' } },
    ];
    expect(daifugoNotice(null, v, roles)?.title).toBe('大貧民');
    expect(daifugoNotice(v, { ...v, phaseLabel: 'マッチ終了' }, roles)?.title).toBe('決着');
  });
  it('replaces a cut-in, expires it, and preserves the readable last event without replay', () => {
    const v = view();
    const render = (fx: FxEvent[], key: number) =>
      act(() => root.render(createElement(DaifugoPresentation, { view: v, fx, fxKey: key })));
    render([], 0);
    render([{ kind: 'daifugo.pile-clear', payload: { seat: 0, reason: 'eight-cut' } }], 1);
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')?.textContent).toContain(
      '8切り',
    );
    render([{ kind: 'daifugo.effect', payload: { seat: 1, kind: 'give', count: 1 } }], 2);
    expect(container.querySelectorAll('[data-testid="daifugo-cut-in"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')?.textContent).toContain(
      '7渡し',
    );
    act(() => vi.advanceTimersByTime(1400));
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')).toBeNull();
    render([], 2);
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')).toBeNull();
    expect(container.querySelector('[data-testid="daifugo-recent-event"]')?.textContent).toContain(
      '7渡し',
    );
  });
  it('cancels pending presentation timers on unmount', () => {
    act(() =>
      root.render(
        createElement(DaifugoPresentation, {
          view: view(),
          fx: [{ kind: 'daifugo.out', payload: { seat: 0, place: 1 } }],
          fxKey: 1,
        }),
      ),
    );
    expect(vi.getTimerCount()).toBe(1);
    act(() => root.render(null));
    expect(vi.getTimerCount()).toBe(0);
  });
});
