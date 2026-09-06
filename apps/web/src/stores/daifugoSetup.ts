import { applyPreset } from '@parlour/engine';
import { daifugoConfig, type DaifugoRules } from '@parlour/game-daifugo';
import { getGameMode, modePreset } from '@/lib/games';
import { isDaifugoModeId, type DaifugoModeId } from '@/lib/daifugo/modes';
import { defineSeatedRulesSetup, type SeatedRulesSetup } from './setupFactories';

export const DAIFUGO_SEAT_OPTIONS = [4, 5, 6, 7, 8] as const;

export const DAIFUGO_SETUP_STORAGE_KEY = 'parlour.daifugo.setup.v1';

export type DaifugoSetupState = SeatedRulesSetup<DaifugoModeId, DaifugoRules>;

function clampSeats(value: number): number {
  return (DAIFUGO_SEAT_OPTIONS as readonly number[]).includes(value) ? value : 4;
}

export function daifugoRulesFor(
  mode: DaifugoModeId,
  overrides: Partial<DaifugoRules>,
): DaifugoRules {
  // The mode names its own preset in the pack's catalog; a mode that names
  // none simply starts from the schema defaults.
  const preset = modePreset(getGameMode('daifugo', mode));
  const base = preset ? applyPreset(daifugoConfig, preset) : daifugoConfig.defaults();
  return daifugoConfig.resolve({ ...base, ...overrides });
}

/** Daifugo session setup — UI state only; rule values come from the pack's schema. */
export const useDaifugoSetupStore = defineSeatedRulesSetup<DaifugoModeId, DaifugoRules>({
  gameId: 'daifugo',
  defaultMode: 'classic',
  isMode: isDaifugoModeId,
  defaultSeats: 4,
  clampSeats,
});
