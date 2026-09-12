import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { DaifugoMusicToggle } from './DaifugoMusicToggle';

const audio = vi.hoisted(() => ({
  unlock: vi.fn(),
  setMuted: vi.fn(),
  channels: { master: { muted: false }, music: { muted: false } },
}));
vi.mock('@/stores/audio', () => ({
  useAudioManager: () => ({ unlock: audio.unlock }),
  useAudioStore: (selector: (state: typeof audio) => unknown) => selector(audio),
}));

describe('persistent BGM control', () => {
  it.each([
    [false, false, true, [['music', true]]],
    [
      false,
      true,
      false,
      [
        ['master', false],
        ['music', false],
      ],
    ],
    [
      true,
      false,
      false,
      [
        ['master', false],
        ['music', false],
      ],
    ],
  ])('toggles music with master=%s and music=%s', (master, music, enabled, calls) => {
    audio.channels.master.muted = master;
    audio.channels.music.muted = music;
    audio.unlock.mockClear();
    audio.setMuted.mockClear();
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      act(() => root.render(createElement(DaifugoMusicToggle)));
      const button = container.querySelector('button')!;
      expect(button.getAttribute('aria-checked')).toBe(String(enabled));
      expect(button.textContent).toBe(enabled ? 'ON' : 'OFF');
      act(() => button.click());
      expect(audio.unlock).toHaveBeenCalledOnce();
      expect(audio.setMuted.mock.calls).toEqual(calls);
    } finally {
      act(() => root.unmount());
    }
  });
});
