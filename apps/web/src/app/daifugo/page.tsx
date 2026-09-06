'use client';

import { useWipeRouter } from '@/hooks/useWipeRouter';
import { useState } from 'react';
import { daifugoConfig } from '@parlour/game-daifugo';
import { DaifugoPresets } from '@/components/setup/DaifugoPresets';
import { RuleSettings } from '@/components/settings/RuleSettings';
import {
  BotDifficultyPicker,
  GameSetupScreen,
  SeatPicker,
  SetupPanel,
  SetupTableActions,
} from '@/components/setup';
import { getGame } from '@/lib/games';
import { useT } from '@/lib/i18n';
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
  const t = useT();
  const shelfEntry = useLocalizedGame('daifugo');
  const modes = useLocalizedModes('daifugo', DAIFUGO_MODES);
  const schema = useLocalizedSchema('daifugo', daifugoConfig);

  const startSolo = () => {
    if (starting) return;
    setStarting(true);
    router.push('/daifugo/table');
  };

  return (
    <GameSetupScreen
      title={shelfEntry.name}
      eyebrow="setup.eyebrow.claimCrown"
      help={{ doc: shelfEntry.howToPlay, subtitle: shelfEntry.subtitle }}
      modes={modes}
      modesLabel="setup.matchFormat"
      selected={mode}
      onSelect={(id) => setMode(id as typeof mode)}
    >
      <SetupPanel>
        <SeatPicker
          options={SEAT_OPTIONS}
          value={seats}
          onChange={setSeats}
          hint={`あなたとCPU ${seats - 1}人。友人対戦は下の部屋作成から。`}
        />
        <BotDifficultyPicker value={botTier} onChange={setBotTier} />
      </SetupPanel>

      <RuleSettings
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

      <SetupTableActions
        busy={starting}
        soloBusyLabel={t('setup.busy.cuttingDeck')}
        onSolo={startSolo}
        createHref="/daifugo/create"
        createTestId="create-daifugo-room"
        note={t('setup.note.friendRoomsEight')}
      />
    </GameSetupScreen>
  );
}
