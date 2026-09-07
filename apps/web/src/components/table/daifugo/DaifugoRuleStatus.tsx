import { reversed } from '@parlour/game-daifugo';
import type { DaifugoTableView } from '@/lib/daifugo/view';
import s from '@/styles/daifugoVisual.module.css';

const SUITS: Record<string, { symbol: string; name: string }> = {
  S: { symbol: '♠', name: 'スペード' },
  H: { symbol: '♥', name: 'ハート' },
  D: { symbol: '♦', name: 'ダイヤ' },
  C: { symbol: '♣', name: 'クラブ' },
};
const RANKS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' };
const rankLabel = (rank: number) => RANKS[rank] ?? String(rank);

/** Display-only projection of the engine's strict-lock rank step and run bounds. */
export function nextLockedCards(view: DaifugoTableView): string | null {
  const { standing, rules } = view;
  if (!view.rankLocked || !standing) return null;
  const run = standing.kind === 'run';
  const count = standing.cards.length;
  const step = run && !rules.stairsOverlap ? count : 1;
  const low = standing.rank + (reversed(view) ? -step : step);
  const high = run ? low + count - 1 : low;
  if (low < 3 || high > (run && !rules.stairsTwo ? 14 : 15)) return '続く数字なし';
  return run ? `${rankLabel(low)}–${rankLabel(high)} の階段` : `${rankLabel(low)} を${count}枚`;
}

/** Always reads current public state, including reconnects; no timers or game actions. */
export function DaifugoRuleStatus({ view }: { view: DaifugoTableView }) {
  const isReversed = reversed(view);
  const locked = view.lockedSuits.length > 0;
  const next = nextLockedCards(view);
  const jokerOnTable = view.standing?.jokerOnly && view.standing.cards.length === 1;
  const spadeReturn = jokerOnTable && view.rules.spadeThree;
  return (
    <section
      className={s.ruleStatus}
      aria-label="いまのルール"
      aria-live="polite"
      aria-atomic="true"
      data-testid="daifugo-rule-status"
    >
      <div className={s.ruleStrength}>
        <span className={s.ruleLabel}>いまの強さ</span>
        <strong>{isReversed ? '逆転中' : '通常順'}</strong>
        <span className={s.ruleSequence}>
          弱 {isReversed ? '2 → A → … → 3' : '3 → … → A → 2'} 強
        </span>
        <span className={s.ruleCauses}>
          {view.revolution && <b>革命</b>}
          {view.jackBack && <b>11バック</b>}
          {view.revolution && view.jackBack ? (
            <span>重なって通常順</span>
          ) : (
            <span>{view.rankLocked ? 'JOKERも次の数字に合わせる' : '未指定JOKERは最強'}</span>
          )}
        </span>
      </div>
      <div className={s.ruleConstraint} data-active={locked}>
        <span className={s.ruleLabel}>マーク縛り</span>
        <strong className={locked ? s.ruleSuits : undefined}>
          {locked
            ? view.lockedSuits.map((suit) => (
                <span key={suit} role="img" aria-label={SUITS[suit]?.name ?? suit}>
                  {SUITS[suit]?.symbol ?? suit}
                </span>
              ))
            : '縛りなし'}
        </strong>
        <small>
          {locked
            ? view.lockedSuits.map((suit) => SUITS[suit]?.name ?? suit).join('・')
            : 'どのマークでもOK'}
        </small>
      </div>
      <div className={s.ruleConstraint} data-active={Boolean(next || view.openingCard)}>
        <span className={s.ruleLabel}>{next ? '激縛り · 次に出す札' : '次に出す札'}</span>
        <strong>
          {spadeReturn
            ? '♠3 で返せる'
            : (next ??
              (view.openingCard ? '♦3 を含める' : jokerOnTable ? '返せる札なし' : '数字指定なし'))}
        </strong>
        <small>
          {spadeReturn
            ? 'スペ3返しは縛りより優先'
            : next
              ? next === '続く数字なし'
                ? 'この場では返せません'
                : '場が流れるまで連続必須'
              : view.standing
                ? '同じ枚数・種類で、場より強く'
                : '好きな枚数・組み合わせから'}
        </small>
      </div>
    </section>
  );
}
