'use client';

import { useEffect, useState } from 'react';
import type { FxEvent } from '@parlour/engine';
import type { DaifugoTableView } from '@/lib/daifugo/view';
import s from '@/styles/daifugoVisual.module.css';

export type DaifugoNotice = { title: string; detail: string; tone: 'action' | 'rank' };
const ROLES: Record<string, string> = {
  daifugo: '大富豪',
  vice: '富豪',
  neutral: '平民',
  'vice-scum': '貧民',
  scum: '大貧民',
};
const CLEARS: Record<string, string> = {
  'eight-cut': '8切り',
  'spade-three': 'スペ3返し',
  'spade-three-counter': 'スペ3返し',
  'all-pass': '場が流れた',
};

/** Read-only presentation of confirmed batches; never emits or delays a move. */
export function daifugoNotice(
  previous: DaifugoTableView | null,
  view: DaifugoTableView,
  fx: readonly FxEvent[],
): DaifugoNotice | null {
  const payload = (kind: string) =>
    fx.find((event) => event.kind === kind)?.payload as Record<string, unknown> | undefined;
  if (view.phaseLabel === 'マッチ終了')
    return { title: '決着', detail: '最終結果へ', tone: 'rank' };
  const localRole = fx.find(
    (event) =>
      event.kind === 'daifugo.role' && (event.payload as { seat?: number }).seat === view.localSeat,
  )?.payload as { role: string } | undefined;
  if (localRole)
    return {
      title: ROLES[localRole.role] ?? '順位確定',
      detail: 'このゲームのあなたの階級',
      tone: 'rank',
    };
  const eliminated = payload('daifugo.eliminated');
  if (eliminated)
    return { title: '順位確定', detail: String(eliminated.reason ?? '反則上がり'), tone: 'rank' };
  const out = payload('daifugo.out');
  if (out) {
    const who =
      out.seat === view.localSeat
        ? 'あなた'
        : (view.players.find((p) => p.seat === out.seat)?.name ?? 'プレイヤー');
    return { title: `${out.place}位で上がり`, detail: who, tone: 'rank' };
  }
  if (previous && previous.dealNumber !== view.dealNumber)
    return { title: `第${view.dealNumber}ゲーム`, detail: '新しい一局が始まる', tone: 'rank' };
  const labels: string[] = [];
  if (previous && fx.some((event) => event.kind === 'daifugo.set')) {
    if (previous.revolution !== view.revolution) labels.push(view.revolution ? '革命' : '革命返し');
    if (previous.jackBack !== view.jackBack)
      labels.push(view.jackBack ? '11バック' : '11バック解除');
    if (!previous.rankLocked && view.rankLocked) labels.push('激縛り');
    else if (!previous.lockedSuits.length && view.lockedSuits.length) labels.push('縛り');
  }
  if (
    payload('daifugo.set') &&
    view.rules.fiveSkip &&
    fx.some(
      (event) =>
        event.kind === 'card.discard' &&
        /^[SHDC]5$/.test(String((event.payload as { card?: string }).card)),
    )
  )
    labels.push('5スキップ');
  const effect = payload('daifugo.effect');
  if (effect?.kind === 'give') labels.push('7渡し');
  if (effect?.kind === 'discard') labels.push('10捨て');
  if (view.pendingEffect && payload('daifugo.set'))
    labels.push(view.pendingEffect.kind === 'give' ? '7渡し' : '10捨て');
  const cleared = payload('daifugo.pile-clear');
  if (cleared && typeof cleared.reason === 'string' && CLEARS[cleared.reason])
    labels.push(CLEARS[cleared.reason]!);
  if (!labels.length) return null;
  const detail = view.pendingEffect
    ? `${view.pendingEffect.count}枚${view.pendingEffect.kind === 'give' ? '渡すカードを選択' : '捨てるカードを選択'}`
    : labels.includes('革命') || labels.includes('革命返し')
      ? 'カードの強さが逆転'
      : 'ローカルルール発動';
  return { title: [...new Set(labels)].join(' / '), detail, tone: 'action' };
}

export function DaifugoPresentation({
  view,
  fx,
  fxKey,
}: {
  view: DaifugoTableView;
  fx: readonly FxEvent[];
  fxKey: string | number;
}) {
  // React's guarded previous-render adjustment avoids replay on card selection,
  // while retaining only the last batch instead of a lagging animation queue.
  const [batch, setBatch] = useState(() => {
    const notice = daifugoNotice(null, view, fx);
    return { key: fxKey, view, notice, recent: notice ? `${notice.title} — ${notice.detail}` : '' };
  });
  if (batch.key !== fxKey) {
    const notice = daifugoNotice(batch.view, view, fx);
    setBatch({
      key: fxKey,
      view,
      notice,
      recent: notice ? `${notice.title} — ${notice.detail}` : batch.recent,
    });
  }
  const local = view.activeSeat === view.localSeat;
  const active = view.players.find((p) => p.seat === view.activeSeat);
  const turn =
    view.phaseLabel === 'マッチ終了'
      ? '対局終了'
      : local
        ? 'あなたの手番'
        : active
          ? `${active.name} の手番`
          : '順位を確認中';
  return (
    <>
      <div
        className={s.turnLane}
        data-local={local}
        role="status"
        aria-atomic="true"
        data-testid="daifugo-turn"
      >
        <span>
          ROUND {String(view.dealNumber).padStart(2, '0')} / {view.hand.length} 枚
        </span>
        <strong key={`${view.dealNumber}:${view.activeSeat}:${turn}`}>{turn}</strong>
      </div>
      {batch.notice && <CutIn key={fxKey} notice={batch.notice} />}
      <p
        className={s.recentCue}
        role="status"
        aria-atomic="true"
        data-testid="daifugo-recent-event"
      >
        {batch.recent}
      </p>
    </>
  );
}

function CutIn({ notice }: { notice: DaifugoNotice }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 1300);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div className={s.cutInLane} aria-hidden="true" data-testid="daifugo-cut-in">
      <div className={s.cutIn} data-tone={notice.tone}>
        <small>{notice.tone === 'rank' ? 'DAIFUGO / RANK' : 'RULE / ACTIVATED'}</small>
        <strong>{notice.title}</strong>
        <p>{notice.detail}</p>
      </div>
    </div>
  );
}
