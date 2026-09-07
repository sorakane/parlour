import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MatchSnapshot } from '@/stores/matchFlow';
import { MatchPodium } from './MatchPodium';
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const snapshot: MatchSnapshot = {
  game: 'daifugo',
  mode: 'classic',
  localSeat: 0,
  seats: [0, 1, 2, 3].map((seat) => ({
    seat,
    name: `P${seat}`,
    avatarId: 'ember',
    kind: 'bot',
    key: `bot:${seat}`,
  })),
  result: {
    winner: 1,
    reason: 'points-target',
    rankings: [
      { seat: 1, rank: 1, detail: { points: 15 } },
      { seat: 0, rank: 1, detail: { points: 15 } },
      { seat: 2, rank: 3, detail: { points: 4 } },
      { seat: 3, rank: 4, detail: { points: 1 } },
    ],
  },
};
describe('Daifugo final results', () => {
  it('preserves supplied ties, points and winner instead of generic game counters', () => {
    act(() => root.render(createElement(MatchPodium, { snapshot })));
    expect(container.querySelector('h1')?.textContent).toBe('敗北');
    expect(container.querySelector('[data-testid="winner-name"]')?.textContent).toBe('P1');
    expect(container.querySelectorAll('[data-testid="podium-1"]')).toHaveLength(2);
    expect(container.querySelector('tr[data-local="true"]')?.textContent).toContain('15');
    expect(container.textContent).not.toMatch(/Blitzes|Knock wins/);
  });
  it('shows victory only for the supplied local winner and remains neutral for spectators', () => {
    act(() => root.render(createElement(MatchPodium, { snapshot: { ...snapshot, localSeat: 1 } })));
    expect(container.querySelector('h1')?.textContent).toContain('勝利');
    act(() =>
      root.render(createElement(MatchPodium, { snapshot: { ...snapshot, localSeat: null } })),
    );
    expect(container.querySelector('h1')?.textContent).toBe('対局終了');
  });
});
