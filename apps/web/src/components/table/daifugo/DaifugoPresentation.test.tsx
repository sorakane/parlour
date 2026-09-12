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
  it('announces number lock and its later combination with suit lock', () => {
    const before = view();
    const number = { ...before, rankLocked: true, lockedSuits: [] };
    const combined = { ...number, lockedSuits: ['C'] };
    expect(daifugoNotice(before, number, play)?.title).toBe('数縛り');
    expect(daifugoNotice(number, combined, play)?.title).toBe('激縛り');
    expect(daifugoNotice(combined, combined, play)).toBeNull();
  });
  it('announces a revolution once and does not infer one on reconnect or unrelated renders', () => {
    const before = view();
    const after = { ...before, revolution: true };
    expect(daifugoNotice(before, after, play)).toMatchObject({
      title: '革命',
      strength: 'reversed',
    });
    expect(daifugoNotice(after, after, play)).toBeNull();
    expect(daifugoNotice(null, after, [])).toBeNull();
    expect(daifugoNotice(before, after, [])).toBeNull();
    expect(before.revolution).toBe(false);
  });
  it('does not call a new-deal reset a counter, even when its first play arrives together', () => {
    const previous = {
      ...view(),
      revolution: true,
      jackBack: true,
      rankLocked: true,
      lockedSuits: ['C'],
    };
    const next = { ...view(), dealNumber: previous.dealNumber + 1 };
    expect(daifugoNotice(previous, next, play)).toMatchObject({
      title: `第${next.dealNumber}ゲーム`,
      tone: 'rank',
    });
    expect(daifugoNotice(previous, next, [])?.title).toBe(`第${next.dealNumber}ゲーム`);
    expect(daifugoNotice(previous, { ...next, revolution: true }, play)).toMatchObject({
      title: '革命',
      strength: 'reversed',
    });
    expect(daifugoNotice({ ...next, revolution: true }, next, play)?.title).toBe('革命返し');
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
  it('keeps a revolution readable across routine bot updates without restarting its timer', () => {
    const before = view();
    const after = { ...before, revolution: true };
    const render = (v: typeof before, fx: FxEvent[], key: number) =>
      act(() => root.render(createElement(DaifugoPresentation, { view: v, fx, fxKey: key })));
    render(before, [], 0);
    render(after, play, 1);
    act(() => vi.advanceTimersByTime(600));
    render({ ...after, activeSeat: 1 }, [], 2);
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')?.textContent).toContain(
      '革命',
    );
    render(after, [{ kind: 'daifugo.out', payload: { seat: 1, place: 1 } }], 25);
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')?.textContent).toContain(
      '革命',
    );
    render(after, [{ kind: 'daifugo.pile-clear', payload: { reason: 'all-pass', seat: 1 } }], 3);
    act(() => vi.advanceTimersByTime(2900));
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(150));
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')).toBeNull();
  });
  it('explains cancellation and keeps a revolution visible when the same move finishes a player', () => {
    const before = view();
    const after = { ...before, revolution: true, jackBack: true };
    const notice = daifugoNotice(before, after, [
      ...play,
      { kind: 'daifugo.out', payload: { seat: 1, place: 1 } },
    ]);
    expect(notice).toMatchObject({
      title: '革命',
      impact: 'major',
      actor: 'あなた',
      strength: 'normal',
    });
    expect(notice?.detail).toContain('重なって通常順');
    expect(notice?.extra).toContain('11バック');
    expect(daifugoNotice(after, { ...after, revolution: false }, play)?.title).toBe('革命返し');
  });
  it('treats an ordinary all-pass sweep as history and never starts a reconnect animation', () => {
    const v = view();
    act(() =>
      root.render(
        createElement(DaifugoPresentation, {
          view: v,
          fx: [{ kind: 'daifugo.pile-clear', payload: { reason: 'all-pass' } }],
          fxKey: 1,
        }),
      ),
    );
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')).toBeNull();
    expect(container.textContent).toContain('直前：場が流れた');
    expect(daifugoNotice(null, { ...v, revolution: true }, [])).toBeNull();
  });
  it('replaces a revolution with its counter and clears it for a new round', () => {
    const before = view();
    const after = { ...before, revolution: true };
    const render = (v: typeof before, fx: FxEvent[], fxKey: number) =>
      act(() => root.render(createElement(DaifugoPresentation, { view: v, fx, fxKey })));
    render(before, [], 0);
    render(after, play, 1);
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')?.textContent).toContain(
      '3 ＞ 2',
    );
    act(() => vi.advanceTimersByTime(3000));
    render(before, play, 2);
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')?.textContent).toContain(
      '革命返し',
    );
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')?.textContent).toContain(
      '3 ＜ 2',
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')).not.toBeNull();
    render({ ...before, dealNumber: before.dealNumber + 1 }, [], 3);
    expect(container.querySelector('[data-testid="daifugo-cut-in"]')?.textContent).not.toContain(
      '革命返し',
    );
  });
  it('celebrates only the local first finisher and survives later rank updates', () => {
    const v = view();
    const out = [{ kind: 'daifugo.out', payload: { seat: v.localSeat, place: 1 } }];
    const render = (fx: FxEvent[], fxKey: number) =>
      act(() => root.render(createElement(DaifugoPresentation, { view: v, fx, fxKey })));
    render([], 0);
    render(out, 1);
    expect(container.querySelector('[data-celebration="daifugo"]')?.textContent).toContain(
      '大富豪',
    );
    act(() => vi.advanceTimersByTime(1500));
    render([{ kind: 'daifugo.out', payload: { seat: 1, place: 2 } }], 2);
    render([{ kind: 'daifugo.role', payload: { seat: v.localSeat, role: 'daifugo' } }], 3);
    act(() => vi.advanceTimersByTime(2600));
    expect(container.querySelector('[data-celebration="daifugo"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(150));
    expect(container.querySelector('[data-celebration="daifugo"]')).toBeNull();
    render([], 3);
    expect(container.querySelector('[data-celebration="daifugo"]')).toBeNull();
    expect(
      daifugoNotice(v, v, [{ kind: 'daifugo.out', payload: { seat: 1, place: 1 } }])?.celebration,
    ).toBeUndefined();
    expect(
      daifugoNotice(v, v, [{ kind: 'daifugo.out', payload: { seat: v.localSeat, place: 2 } }])
        ?.celebration,
    ).toBeUndefined();
    expect(daifugoNotice(null, v, [])?.celebration).toBeUndefined();
    expect(daifugoNotice(v, { ...v, revolution: true }, [...play, ...out])).toMatchObject({
      title: '大富豪',
      celebration: 'daifugo',
      extra: '革命',
    });
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
