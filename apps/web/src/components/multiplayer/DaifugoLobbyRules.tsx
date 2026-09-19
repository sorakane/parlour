'use client';

import type { RuleValues } from '@parlour/engine';
import { daifugoConfig } from '@parlour/game-daifugo';
import { RuleSettings } from '@/components/settings/RuleSettings';

export function DaifugoLobbyRules({
  config,
  onChange,
  disabled = false,
}: {
  config: RuleValues;
  onChange?: (rules: RuleValues) => void;
  disabled?: boolean;
}) {
  const rules = daifugoConfig.resolve(config);
  return (
    <div className="mt-6 text-left" lang="ja">
      <p className="mb-3 text-sm">
        {onChange
          ? '友だちを待ちながら変更できます。変更は参加者にも反映されます。'
          : '主催者が設定したルールです。対戦開始までは変更されることがあります。'}
      </p>
      {onChange ? (
        <fieldset disabled={disabled} className="min-w-0">
          <RuleSettings
            variant="daifugo"
            label="ローカルルールを変更する"
            schema={daifugoConfig}
            values={rules}
            onChange={(key, value) => onChange({ ...rules, [key]: value })}
          />
        </fieldset>
      ) : (
        <details>
          <summary className="cursor-pointer border-b-2 border-red-600 py-3 font-bold">
            この部屋のローカルルールを確認
          </summary>
          <fieldset disabled className="min-w-0">
            <RuleSettings
              variant="daifugo"
              label="現在のルール"
              defaultOpen
              schema={daifugoConfig}
              values={rules}
              onChange={() => {}}
            />
          </fieldset>
        </details>
      )}
    </div>
  );
}
