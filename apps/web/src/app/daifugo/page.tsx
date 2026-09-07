'use client';

import { useWipeRouter } from '@/hooks/useWipeRouter';
import { useState } from 'react';
import { daifugoConfig } from '@parlour/game-daifugo';
import { DaifugoJokerSettings } from '@/components/setup/DaifugoJokerSettings';
import { DaifugoPresets } from '@/components/setup/DaifugoPresets';
import { DaifugoMusicToggle } from '@/components/DaifugoMusicToggle';
import { RuleSettings } from '@/components/settings/RuleSettings';
import { BotDifficultyPicker, SeatPicker, SetupPanel, SetupActions } from '@/components/setup';
import { DaifugoSetup } from '@/components/setup/DaifugoSetup';
import { getGame } from '@/lib/games';
import { useLocalizedGame, useLocalizedModes, useLocalizedSchema } from '@/lib/i18n/gameContent';
import { DAIFUGO_MODES } from '@/lib/daifugo/modes';
import { daifugoRulesFor, useDaifugoSetupStore } from '@/stores/daifugoSetup';

const SEAT_OPTIONS = getGame('daifugo').seats;

export default function DaifugoSetupPage() {
  const router = useWipeRouter();
  const mode = useDaifugoSetupStore((s) => s.mode);
  const seats = useDaifugoSetupStore((s) => s.seats);
  const botTier = useDaifugoSetupStore((s) => s.botTier);
  const setMode = useDaifugoSetupStore((s) => s.setMode);
  const setSeats = useDaifugoSetupStore((s) => s.setSeats);
  const setBotTier = useDaifugoSetupStore((s) => s.setBotTier);
  const overrides = useDaifugoSetupStore((s) => s.overrides);
  const setRule = useDaifugoSetupStore((s) => s.setRule);
  const resetRules = useDaifugoSetupStore((s) => s.resetRules);
  const [starting, setStarting] = useState(false);
  const shelfEntry = useLocalizedGame('daifugo');
  const modes = useLocalizedModes('daifugo', DAIFUGO_MODES);
  const schema = useLocalizedSchema('daifugo', daifugoConfig);

  const startSolo = () => {
    if (starting) return;
    setStarting(true);
    router.push('/daifugo/table');
  };

  return (
    <DaifugoSetup
      help={{ doc: shelfEntry.howToPlay, subtitle: shelfEntry.subtitle }}
      modes={modes}
      selected={mode}
      onSelect={(id) => setMode(id as typeof mode)}
      actions={
        <SetupActions
          busy={starting}
          actions={[
            {
              label: '対戦開始 — CPUと遊ぶ',
              busyLabel: '対戦を準備中…',
              onClick: startSolo,
              testId: 'deal-me-in',
            },
            {
              label: '友人と部屋をつくる',
              tone: 'teal',
              onClick: () => router.push('/daifugo/create'),
              testId: 'create-daifugo-room',
            },
            { label: '部屋コードで参加', tone: 'ghost', href: '/join' },
          ]}
          note="友人対戦は最大8人。部屋コードを共有して参加できます。"
        />
      }
    >
      <DaifugoJokerSettings rules={daifugoRulesFor(mode, overrides)} onChange={setRule} />
      <SetupPanel>
        <SeatPicker
          options={SEAT_OPTIONS}
          value={seats}
          onChange={setSeats}
          hint={`あなたとCPU ${seats - 1}人。友人対戦は「友人と部屋をつくる」から。`}
        />
        <BotDifficultyPicker value={botTier} onChange={setBotTier} />
        <div className="flex flex-wrap items-center gap-3">
          <DaifugoMusicToggle />
          <p className="text-sm text-dusk-200">
            明るいポップBGM。画面を移っても続けて再生します。ON/OFFは保存されます。
          </p>
        </div>
      </SetupPanel>

      <RuleSettings
        variant="daifugo"
        label="ローカルルールを設定"
        schema={schema}
        values={daifugoRulesFor(mode, overrides)}
        onChange={setRule as (key: string, value: string | number | boolean) => void}
        onReset={resetRules}
      />

      <DaifugoPresets
        rules={daifugoRulesFor(mode, overrides)}
        apply={(rules) => {
          resetRules();
          for (const [key, value] of Object.entries(rules)) setRule(key, value);
        }}
      />
    </DaifugoSetup>
  );
}
