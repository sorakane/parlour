'use client';

import { useAudioManager, useAudioStore } from '@/stores/audio';

/** Shares the existing persisted music channel with the full sound settings. */
export function DaifugoMusicToggle() {
  useAudioManager();
  const muted = useAudioStore((state) => state.channels.music.muted);
  const toggleMuted = useAudioStore((state) => state.toggleMuted);

  return (
    <button
      type="button"
      role="switch"
      aria-label="BGM"
      aria-checked={!muted}
      className="btn-fat btn-fat--ghost"
      onClick={() => toggleMuted('music')}
    >
      BGM {muted ? 'OFF' : 'ON'}
    </button>
  );
}
