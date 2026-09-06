import type { GameMode } from '@parlour/engine';
import type { DaifugoRules } from '@parlour/game-daifugo';
import { gameModes, isGameModeId } from '@/lib/games';

export type DaifugoModeId = 'classic' | 'rapid' | 'marathon';

export type DaifugoModeDef = GameMode;

/**
 * Daifugo's table settings, straight from the pack's shelf entry. Rule
 * values live in @parlour/game-daifugo's config schema and the presentation
 * lives beside them in its catalog; this module is only the app-side name for
 * that list.
 */
export const DAIFUGO_MODES: readonly DaifugoModeDef[] = gameModes('daifugo');

/** A comfortable full-table match; the tense-music cue measures against this. */
export const DAIFUGO_MATCH_PACE_MS = 900_000;

const BY_ID = new Map(DAIFUGO_MODES.map((mode) => [mode.id, mode]));

export function getDaifugoMode(id: DaifugoModeId): DaifugoModeDef {
  const mode = BY_ID.get(id);
  if (!mode) throw new Error(`unknown daifugo mode id: ${id}`);
  return mode;
}

export function isDaifugoModeId(value: unknown): value is DaifugoModeId {
  return isGameModeId('daifugo', value);
}

/**
 * Best-fit mode label for a set of rules that arrived over the wire. Tables
 * can be tuned knob by knob, so this is presentation only — never a rules
 * source.
 */
export function daifugoModeForRules(rules: DaifugoRules): DaifugoModeId {
  if (rules.targetPoints <= 7) return 'rapid';
  if (rules.targetPoints >= 21) return 'marathon';
  return 'classic';
}
