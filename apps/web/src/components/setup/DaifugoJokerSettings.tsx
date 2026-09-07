'use client';

import type { DaifugoRules } from '@parlour/game-daifugo';
import s from '@/styles/daifugoVisual.module.css';

/** Visible shortcuts into the same rule values used by solo play and friend rooms. */
export function DaifugoJokerSettings({
  rules,
  onChange,
}: {
  rules: DaifugoRules;
  onChange: (key: string, value: number | boolean) => void;
}) {
  return (
    <section className={s.jokerSettings} aria-label="ジョーカー・スペ3返し">
      <div>
        <h3>
          ジョーカー <strong>{rules.jokerCount}枚</strong>
        </h3>
        <div role="group" aria-label="ジョーカーの枚数" className={s.jokerChoices}>
          {[0, 1, 2].map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={rules.jokerCount === count}
              onClick={() => onChange('jokerCount', count)}
            >
              {count}枚
            </button>
          ))}
        </div>
        <p>デッキ全体に入る枚数です。あなたに配られない回もあります。</p>
      </div>
      <div>
        <h3>♠3 でジョーカーを返す</h3>
        <button
          type="button"
          role="switch"
          aria-label="スペ3返し"
          aria-checked={rules.spadeThree}
          className={s.spadeSwitch}
          onClick={() => onChange('spadeThree', !rules.spadeThree)}
        >
          スペ3返し {rules.spadeThree ? 'ON' : 'OFF'}
        </button>
        <p>
          {rules.jokerCount === 0
            ? 'ジョーカーが0枚のため、この設定では発動しません。'
            : '単体のJOKERに♠3を出すと場が流れ、出した人から再開します。'}
        </p>
      </div>
    </section>
  );
}
