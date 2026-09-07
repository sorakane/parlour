'use client';

import { useEffect, type ReactNode } from 'react';
import type { MatchSnapshot } from '@/stores/matchFlow';
import { getAudioManager } from '@/lib/audio/AudioManager';
import { PARLOUR_SFX } from '@/lib/audio/sfx';
import { getDaifugoMode, isDaifugoModeId } from '@/lib/daifugo/modes';
import s from '@/styles/daifugoVisual.module.css';

/** Renders authoritative standings; does not recompute scores or winners. */
export function DaifugoResult({
  snapshot,
  children,
}: {
  snapshot: MatchSnapshot;
  children?: ReactNode;
}) {
  const { result, localSeat } = snapshot;
  const localRank = result.rankings.find((entry) => entry.seat === localSeat);
  const winner = snapshot.seats.find((entry) => entry.seat === result.winner);
  const won = localSeat !== null && result.winner === localSeat;
  const title = localSeat === null || result.winner === null ? '対局終了' : won ? '勝利' : '敗北';
  const audio = getAudioManager();
  useEffect(() => {
    const timer = window.setTimeout(
      () => audio.play(won ? PARLOUR_SFX.matchWin : PARLOUR_SFX.matchLose),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [audio, won]);
  return (
    <section className={`${s.theme} ${s.result}`} data-testid="match-podium" lang="ja">
      <header className={s.resultHeader}>
        <p>DAIFUGO / FINAL RESULT</p>
        <h1>
          <span>{title}</span>
          {won ? '。' : ''}
        </h1>
        <span>
          {winner ? (
            <>
              <b data-testid="winner-name">{winner.seat === localSeat ? 'あなた' : winner.name}</b>{' '}
              がマッチに勝利
            </>
          ) : (
            'マッチが終了しました'
          )}{' '}
          / {isDaifugoModeId(snapshot.mode) ? getDaifugoMode(snapshot.mode).name : '大富豪'}
        </span>
      </header>
      <div className={s.resultGrid}>
        <div className={s.resultRank}>
          <span>{localRank ? 'あなたの最終順位' : '最終結果'}</span>
          <strong>
            {localRank ? String(localRank.rank).padStart(2, '0') : '—'}
            <small>{localRank ? '位' : ''}</small>
          </strong>
          <p>
            {won
              ? 'この卓の頂点へ。次の勝負も、あなたらしく。'
              : '勝負は、何度でも。次の一手でひっくり返そう。'}
          </p>
        </div>
        <table className={s.standings}>
          <caption>最終順位 / STANDINGS</caption>
          <thead>
            <tr>
              <th scope="col">順位</th>
              <th scope="col">プレイヤー</th>
              <th scope="col">得点</th>
            </tr>
          </thead>
          <tbody>
            {[...result.rankings]
              .sort((a, b) => a.rank - b.rank)
              .map((entry) => {
                const player = snapshot.seats.find((seat) => seat.seat === entry.seat);
                const points = entry.detail?.points;
                return (
                  <tr
                    key={entry.seat}
                    data-local={entry.seat === localSeat}
                    data-testid={`podium-${entry.rank}`}
                  >
                    <td>{String(entry.rank).padStart(2, '0')}</td>
                    <td>
                      {player?.name ?? `席 ${entry.seat + 1}`}
                      {entry.seat === localSeat && <small>あなた</small>}
                      {entry.seat === result.winner && <small>WINNER</small>}
                    </td>
                    <td>
                      {typeof points === 'number' ? points : '—'} <small>pt</small>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {children}
    </section>
  );
}
