'use client';

import {
  DAIFUGO_DECK,
  isJoker,
  resolvePlay,
  playEffects,
  type JokerAssignments,
} from '@parlour/game-daifugo';
import type { DaifugoTableView } from '@/lib/daifugo/view';
import s from '@/styles/daifugoVisual.module.css';

const SUITS: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };
export const faceLabel = (card: string) =>
  isJoker(card) ? 'JOKER' : `${SUITS[card[0]!] ?? ''}${DAIFUGO_DECK.faces[card]?.short ?? card}`;
const options = ['C', 'D', 'H', 'S'].flatMap((suit) =>
  [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1, 2].map((rank) => `${suit}${rank}`),
);

export function DaifugoJokerChoice({
  view,
  cards,
  jokerAs,
  onChange,
}: {
  view: DaifugoTableView;
  cards: readonly string[];
  jokerAs: JokerAssignments;
  onChange: (joker: string, face: string) => void;
}) {
  const jokers = cards.filter(isJoker);
  if (!jokers.length) return null;
  const resolved = resolvePlay(view, cards, jokerAs);
  const effects = resolved ? playEffects(view, cards, jokerAs) : null;
  const labels = effects
    ? [
        effects.revolution ? '革命' : '',
        effects.jackBack ? '11バック' : '',
        effects.clearReason === 'eight-cut'
          ? '8切り'
          : effects.clearReason === 'spade-three'
            ? 'スペ3返し'
            : '',
        effects.skips ? `${effects.skips}人スキップ` : '',
        effects.give ? `${effects.give}枚渡し` : '',
        effects.discard ? `${effects.discard}枚捨て` : '',
      ].filter(Boolean)
    : [];
  return (
    <details className={s.jokerChoice}>
      <summary>ジョーカーの役割を指定{labels.length ? ` · ${labels.join(' / ')}` : ''}</summary>
      <div className={s.jokerChoicePanel}>
        <strong>ジョーカーの代用先</strong>
        <p>自動で組を補うか、数字とマークを指定できます。指定した効果は「出す」で確定します。</p>
        {jokers.map((joker) => (
          <label key={joker}>
            ジョーカー {joker === 'J0' ? '1' : '2'}
            <select
              aria-label={`ジョーカー${joker === 'J0' ? '1' : '2'}の代用先`}
              value={jokerAs[joker] ?? ''}
              onChange={(event) => onChange(joker, event.target.value)}
            >
              <option value="">自動（場に合わせる）</option>
              {options.map((face) => (
                <option key={face} value={face}>
                  {faceLabel(face)}
                </option>
              ))}
            </select>
          </label>
        ))}
        <p role="status">
          {resolved
            ? `判定：${resolved.set.kind === 'run' ? '階段 ' : ''}${resolved.effectiveCards.map(faceLabel).join('・')}${labels.length ? ` ／ ${labels.join('・')}` : ''}`
            : 'この指定では今の場に出せません。数字・マークか選択する札を変更してください。'}
        </p>
      </div>
    </details>
  );
}
