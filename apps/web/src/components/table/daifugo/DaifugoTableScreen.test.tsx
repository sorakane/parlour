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
      act(() => cards[1]!.click());
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
