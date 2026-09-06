'use client';

import { defineSetup } from './gameSetup';
import { daifugoConfig, type DaifugoRules } from '@parlour/game-daifugo';

export type SavedDaifugoPreset = { name: string; rules: DaifugoRules };

export function readDaifugoPresets(raw: unknown): SavedDaifugoPreset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item) =>
        item && typeof item === 'object' && typeof item.name === 'string' && item.name.trim(),
    )
    .slice(0, 20)
    .map((item) => ({
      name: item.name.trim().slice(0, 40),
      rules: daifugoConfig.resolve(item.rules ?? {}),
    }));
}

export const useDaifugoPresets = defineSetup<
  { entries: SavedDaifugoPreset[] },
  { save(name: string, rules: DaifugoRules): void; remove(name: string): void }
>(
  'daifugo-presets',
  {
    defaults: { entries: [] },
    coerce: (stored) => ({ entries: readDaifugoPresets(stored.entries) }),
  },
  (setup) => ({
    save: (name, rules) => {
      const cleaned = name.trim().slice(0, 40);
      if (!cleaned) return;
      const entries = setup.get().entries.filter((entry) => entry.name !== cleaned);
      setup.patch({
        entries: [{ name: cleaned, rules: daifugoConfig.resolve(rules) }, ...entries].slice(0, 20),
      });
    },
    remove: (name) =>
      setup.patch({ entries: setup.get().entries.filter((entry) => entry.name !== name) }),
  }),
);
