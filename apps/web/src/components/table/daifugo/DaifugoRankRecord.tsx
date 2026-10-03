'use client';

import { useState } from 'react';
import type { GameSession } from '@parlour/engine';
import type { DaifugoState, DaifugoRules } from '@parlour/game-daifugo';
import { daifugoRankReport } from '@/lib/daifugo/rank-report';
import styles from '@/styles/daifugo.module.css';

type Report = ReturnType<typeof daifugoRankReport>;
export function DaifugoRankRecord({
  session,
  players,
  localSeat,
}: {
  session: GameSession<DaifugoState, DaifugoRules>;
  players: readonly { seat: number; name: string }[];
  localSeat: number;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const refresh = () => setReport(daifugoRankReport(session, players, localSeat));
  const save = () => {
    const current = daifugoRankReport(session, players, localSeat);
    setReport(current);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `daifugo-ranks-game-${current.game}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const latestGame = report?.rankedGame ?? report?.game;
  return (
    <details
      className={styles.rankRecord}
      onToggle={(event) => {
        if (event.currentTarget.open) refresh();
      }}
    >
      <summary>順位・手番の記録</summary>
      {report && (
        <>
          <p>第{report.game}ゲーム時点の記録</p>
          <h3>{report.rankedGame ? `第${report.rankedGame}ゲームの確定順位` : '確定順位'}</h3>
          {report.previousRanks.length ? (
            <ol>
              {report.previousRanks.map((player) => (
                <li key={player.seat}>
                  {player.rank}位：{player.name} — {player.role}
                </li>
              ))}
            </ol>
          ) : (
            <p>まだ確定していません。</p>
          )}
          <h3>第{latestGame}ゲームの上がり・降格の記録</h3>
          <ul>
            {report.events
              .filter((event) => event.game === latestGame && event.kind !== 'rank')
              .map((event, index) => (
                <li key={`${event.sequence}-${index}`}>
                  {event.name}：{event.detail}
                </li>
              ))}
          </ul>
          <h3>今ゲームの手番順</h3>
          <p>{report.turnOrder.map((player) => player.name).join(' → ')}</p>
          <p>手番順はカードを出す順番です。上がった順位とは別です。</p>
          {!report.verified && (
            <p role="status">記録の再確認と現在の状態が一致しません。記録を保存してください。</p>
          )}
          <div className={styles.rankRecordActions}>
            <button type="button" className="btn-fat btn-fat--ghost" onClick={refresh}>
              記録を更新
            </button>
            <button type="button" className="btn-fat btn-fat--ghost" onClick={save}>
              対戦記録を保存
            </button>
          </div>
        </>
      )}
    </details>
  );
}
