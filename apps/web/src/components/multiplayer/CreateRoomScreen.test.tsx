import { useProfileStore } from '@/stores/profile';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CreateRoomScreen } from './CreateRoomScreen';

const { create, room } = vi.hoisted(() => ({
  create: vi.fn(async (_options: unknown) => undefined),
  room: vi.fn(() => ({ seats: 8, config: {} })),
}));
vi.mock('@/lib/rooms/createScreens', () => ({ createScreenFor: () => ({ room, hydrate: {} }) }));
vi.mock('@/stores/usePersistHydrated', () => ({ usePersistHydrated: () => true }));
vi.mock('@/lib/games/RoomGameTable', () => ({ HostRoomMatch: () => null }));
vi.mock('@/app/_multiplayer/roomSession', () => ({
  getActiveMultiplayerSession: () => null,
  activateMultiplayerSession: vi.fn(),
  clearActiveMultiplayerSession: vi.fn(),
  multiplayerProfile: () => ({}),
  MultiplayerRoomSession: class {
    create = create;
  },
}));
afterEach(() => {
  vi.clearAllMocks();
  useProfileStore.getState().setName('');
});

it.each([4, 6])(
  'creates an explicitly selected %i-seat room even when saved CPU settings say 8',
  async (seats) => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<CreateRoomScreen gameId="daifugo" />));
      expect(create).not.toHaveBeenCalled();
      const button = [...container.querySelectorAll('button')].find(
        (b) => b.textContent === `${seats}人`,
      )!;
      if (seats === 4) expect(button.getAttribute('aria-pressed')).toBe('true');
      await act(async () => button.click());
      const submit = container.querySelector<HTMLButtonElement>(
        '[data-testid="confirm-room-capacity"]',
      )!;
      expect(submit.textContent).toBe(`${seats}人の部屋を作る`);
      expect(submit.disabled).toBe(true);
      await act(async () => useProfileStore.getState().setName('主催者'));
      expect(submit.disabled).toBe(false);
      await act(async () => submit.click());
      expect(create).toHaveBeenCalledExactlyOnceWith({ gameId: 'daifugo', seats, config: {} });
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  },
);
