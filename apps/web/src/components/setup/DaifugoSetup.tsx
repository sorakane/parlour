'use client';

import type { ReactNode } from 'react';
import { HowToPlayButton } from '@/components/HowToPlay';
import type { SetupHelp, SetupMode } from './GameSetupScreen';
import s from '@/styles/daifugoVisual.module.css';

export function DaifugoSetup({
  modes,
  selected,
  onSelect,
  help,
  actions,
  children,
}: {
  modes: readonly SetupMode[];
  selected: string;
  onSelect: (id: string) => void;
  help: SetupHelp;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className={`${s.theme} ${s.setup}`} lang="ja">
      <header className={s.navigation}>
        <span className={s.edition}>PARLOUR / CARD CLUB</span>
        <HowToPlayButton doc={help.doc} title="大富豪" subtitle={help.subtitle} />
      </header>
      <div className={s.setupGrid}>
        <section className={s.poster} aria-labelledby="daifugo-title">
          <p className={s.kicker}>一手で、ひっくり返せ。</p>
          <div className={s.titleBlock}>
            <span className={s.ghostTitle} aria-hidden="true">
              DAI
              <br />
              FUGO
            </span>
            <h1 id="daifugo-title">
              大<span>富</span>豪<span className={s.titlePeriod}>.</span>
            </h1>
            <span className={s.titleCaption}>DAIFUGO — THE CARD GAME</span>
          </div>
          <div className={s.posterFooter}>
            <span className={s.suitStamp} aria-hidden="true">
              ♠
            </span>
            <p>
              切り札は、ルールの数だけ。
              <br />
              いつもの仲間と、あなたの大富豪を。
            </p>
            <span className={s.playerStamp}>
              04–08<span>PLAYERS</span>
            </span>
          </div>
          <div className={s.startActions}>{actions}</div>
        </section>
        <section className={s.modeSection} aria-labelledby="daifugo-modes">
          <div className={s.sectionHeading}>
            <span>01 / SELECT</span>
            <h2 id="daifugo-modes">遊び方を選ぶ</h2>
          </div>
          <div className={s.modeList} role="group" aria-label="マッチ形式">
            {modes.map((mode, index) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={selected === mode.id}
                className={s.modeRow}
                onClick={() => onSelect(mode.id)}
              >
                <span className={s.modeIndex}>{String(index + 1).padStart(2, '0')}</span>
                <span className={s.modeCopy}>
                  <strong>{mode.name}</strong>
                  <span>{mode.description}</span>
                </span>
                <span className={s.modeArrow} aria-hidden="true">
                  ↗
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className={s.settingsSection} aria-label="テーブル設定">
          <div className={s.sectionHeading}>
            <span>02 / CUSTOMIZE</span>
            <h2>あなたの卓をつくる</h2>
          </div>
          <div className={s.settingsBody}>{children}</div>
        </section>
      </div>
      <footer className={s.setupFooter}>
        <span>大富豪 / DAIFUGO</span>
        <span>YOUR TABLE. YOUR RULES.</span>
      </footer>
    </main>
  );
}
