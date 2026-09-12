'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { reversed } from '@parlour/game-daifugo';
import { nextLockedCards } from './DaifugoRuleStatus';
import type { FxEvent } from '@parlour/engine';
import type { DaifugoTableView } from '@/lib/daifugo/view';
import s from '@/styles/daifugoVisual.module.css';
import cinematic from '@/styles/daifugoRevolution.module.css';

export type DaifugoNotice = {
  title: string;
  detail: string;
  tone: 'action' | 'rank';
  impact?: 'major' | 'minor' | 'history';
  actor?: string;
  extra?: string;
  strength?: 'reversed' | 'normal';
};
export const cutInDuration = (notice: DaifugoNotice) => (notice.impact === 'major' ? 3600 : 1300);
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
  const labels: string[] = [];
  if (previous && fx.some((event) => event.kind === 'daifugo.set')) {
    if (previous.revolution !== view.revolution) labels.push(view.revolution ? '革命' : '革命返し');
    if (previous.jackBack !== view.jackBack)
      labels.push(view.jackBack ? '11バック' : '11バック解除');
    if (
      view.rankLocked &&
      (!previous.rankLocked || (!previous.lockedSuits.length && view.lockedSuits.length))
    )
      labels.push(view.lockedSuits.length ? '激縛り' : '数縛り');
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
  const set = payload('daifugo.set');
  const actorSeat = set?.seat ?? cleared?.seat ?? effect?.seat;
  const actor =
    actorSeat === view.localSeat ? 'あなた' : view.players.find((p) => p.seat === actorSeat)?.name;
  const revolution = labels.includes('革命') || labels.includes('革命返し');
  const back = labels.includes('11バック') || labels.includes('11バック解除');
  const lock = labels.includes('激縛り') || labels.includes('縛り');
  if (revolution || back || lock || labels.includes('8切り') || labels.includes('スペ3返し')) {
    const suits = view.lockedSuits
      .map((x) => (({ S: '♠', H: '♥', D: '♦', C: '♣' }) as Record<string, string>)[x] ?? x)
      .join(' ');
    const order = reversed(view) ? '強さが逆転 — 2より3が強い' : '通常順へ — 3より2が強い';
    return {
      title: labels[0]!,
      extra: labels.slice(1).join(' / '),
      actor,
      detail:
        revolution || back
          ? view.revolution && view.jackBack
            ? '革命 × 11バック — 重なって通常順'
            : order
          : lock
            ? `${suits} 縛り${nextLockedCards(view) ? ` — 次は${nextLockedCards(view)}` : ' — 同じマークで返す'}`
            : '場を流して、新しい攻防へ',
      tone: 'action',
      impact: revolution ? 'major' : 'minor',
      ...(revolution
        ? { strength: reversed(view) ? ('reversed' as const) : ('normal' as const) }
        : {}),
    };
  }
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
  if (!labels.length) return null;
  return {
    title: [...new Set(labels)].join(' / '),
    actor,
    detail: view.pendingEffect
      ? `${view.pendingEffect.count}枚${view.pendingEffect.kind === 'give' ? '渡すカードを選択' : '捨てるカードを選択'}`
      : 'ローカルルール発動',
    tone: 'action',
    impact: labels.every((x) => x === '場が流れた') ? 'history' : 'minor',
  };
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
  const [batch, setBatch] = useState(() => {
    const notice = daifugoNotice(null, view, fx);
    return {
      key: fxKey,
      view,
      active: notice && notice.impact !== 'history' ? { id: fxKey, notice } : null,
      recent: notice ? `${notice.title} — ${notice.detail}` : '',
    };
  });
  if (batch.key !== fxKey) {
    const notice = daifugoNotice(batch.view, view, fx);
    const newRound = batch.view.dealNumber !== view.dealNumber;
    const canReplace =
      notice &&
      notice.impact !== 'history' &&
      (newRound ||
        !batch.active ||
        notice.impact === 'major' ||
        view.phaseLabel === 'マッチ終了' ||
        batch.active.notice.impact !== 'major');
    setBatch({
      key: fxKey,
      view,
      active: canReplace ? { id: fxKey, notice } : newRound ? null : batch.active,
      recent: notice ? `${notice.title} — ${notice.detail}` : newRound ? '' : batch.recent,
    });
  }
  // Normal turns never cut the hold short. No queue, no delay to the game clock.
  const active = batch.active;
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      setBatch((current) => (current.active === active ? { ...current, active: null } : current));
    }, cutInDuration(active.notice));
    return () => window.clearTimeout(timer);
  }, [active]);
  const local = view.activeSeat === view.localSeat;
  const activePlayer = view.players.find((p) => p.seat === view.activeSeat);
  const turn =
    view.phaseLabel === 'マッチ終了'
      ? '対局終了'
      : local
        ? 'あなたの手番'
        : activePlayer
          ? `${activePlayer.name} の手番`
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
      {active && <CutIn key={active.id} notice={active.notice} />}
      <p
        className={s.recentCue}
        role="status"
        aria-atomic="true"
        data-testid="daifugo-recent-event"
      >
        {batch.recent ? `直前：${batch.recent}` : ''}
      </p>
    </>
  );
}

function CutIn({ notice }: { notice: DaifugoNotice }) {
  if (notice.impact === 'major') {
    return (
      <div
        className={cinematic.scene}
        aria-hidden="true"
        data-testid="daifugo-cut-in"
        data-impact="major"
        style={{ '--cut-in-duration': `${cutInDuration(notice)}ms` } as CSSProperties}
      >
        <div className={cinematic.burst} />
        <div className={cinematic.panel}>
          <span className={cinematic.echo}>革命</span>
          <small className={cinematic.actor}>{notice.actor ?? 'プレイヤー'} が発動</small>
          <strong className={cinematic.title} data-counter={notice.title === '革命返し'}>
            {notice.title}
          </strong>
          <div className={cinematic.strength}>
            <span>数字の強さ</span>
            <b>{notice.strength === 'reversed' ? '3 ＞ 2' : '3 ＜ 2'}</b>
          </div>
          <p className={cinematic.detail}>{notice.detail}</p>
          {notice.extra && <span className={cinematic.extra}>{notice.extra}</span>}
        </div>
      </div>
    );
  }
  return (
    <div
      className={s.cutInLane}
      data-impact={notice.impact ?? 'minor'}
      aria-hidden="true"
      data-testid="daifugo-cut-in"
      style={{ '--cut-in-duration': `${cutInDuration(notice)}ms` } as CSSProperties}
    >
      <span className={s.cutInSlash} />
      <div className={s.cutIn} data-tone={notice.tone}>
        <span className={s.cutInEcho}>{notice.title}</span>
        <small>
          {notice.actor ? `${notice.actor} / ` : ''}
          {notice.tone === 'rank' ? '順位決定' : '特殊ルール発動'}
        </small>
        <strong>{notice.title}</strong>
        <p>{notice.detail}</p>
        {notice.extra && <span className={s.cutInExtra}>{notice.extra}</span>}
      </div>
    </div>
  );
}
