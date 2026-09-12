'use client';

import { useAudioManager, useAudioStore } from '@/stores/audio';
import s from '@/styles/daifugoMusic.module.css';

/** A single persistent control; navigation never owns or restarts the music. */
export function DaifugoMusicToggle() {
  const manager = useAudioManager();
  const muted = useAudioStore((state) => state.channels.music.muted || state.channels.master.muted);
  const setMuted = useAudioStore((state) => state.setMuted);

  return (
    <button
      type="button"
      role="switch"
      aria-label="BGM"
      aria-checked={!muted}
      title={muted ? 'BGMを再生する' : 'BGMを止める'}
      className={s.toggle}
      onClick={() => {
        manager.unlock();
        if (muted) setMuted('master', false);
        setMuted('music', !muted);
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none">
        <path d="M9 17V5l11-2v12M9 9l11-2" stroke="currentColor" strokeWidth="2" />
        <ellipse cx="6" cy="18" rx="3" ry="2.5" fill="currentColor" />
        <ellipse cx="17" cy="16" rx="3" ry="2.5" fill="currentColor" />
        {muted && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" />}
      </svg>
      <span aria-hidden="true">{muted ? 'OFF' : 'ON'}</span>
    </button>
  );
}
