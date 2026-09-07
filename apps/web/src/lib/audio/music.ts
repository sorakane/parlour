import { DEFAULT_SCENE, type SceneId } from '@/stores/scene';

/**
 * A soundtrack pack: named set of playlists any game can ship. The built-in
 * `parlour` pack covers every background scene; game modules register extra
 * packs via `registerMusicPack` and the app plays them per scene.
 */
export type MusicPack = {
  id: string;
  label: string;
  /** Playlist per background scene; missing scenes fall back to the parlour pack. */
  playlists: Partial<Record<SceneId, readonly MusicTrack[]>>;
  /** Title-screen theme; packs without one inherit the parlour menu theme. */
  menu?: readonly MusicTrack[];
  /**
   * Scenes whose playlist should keep playing on menu routes too. The cozy
   * scenes hand the menus their title waltz; a party scene like the beach
   * would sound wrong dropping to it, so it brings its own music along.
   */
  sceneMenus?: Partial<Record<SceneId, readonly MusicTrack[]>>;
  /**
   * Mood cues a running game can switch on from its own state (never pickable
   * in settings). This is the simple game-pack authoring path: a global cue
   * such as `moods: { tense: [...] }` overrides every background.
   */
  moods?: Readonly<Record<string, readonly MusicTrack[]>>;
  /**
   * Optional background-specific mood cues. These win over the pack's global
   * moods; omitted scenes and moods fall back through the global cue and then
   * the matching Parlour background.
   */
  sceneMoods?: Partial<Record<SceneId, Readonly<Record<string, readonly MusicTrack[]>>>>;
};

/**
 * Shared mood vocabulary. Games drive these from game state — `tense` is the
 * closing-stretch cue (Blitz's bell, Wild's final minute) — and may override
 * any of them, or add their own ids, on the pack they register.
 */
export type MusicMoodId = 'tense' | (string & {});

export type MusicTrack = {
  id: string;
  title: string;
  src: string;
  /** Explicit Howler codec hint; omit when the source extension is sufficient. */
  format?: string;
  /** Per-track scale inside the music channel gain. */
  volume?: number;
  /** Ambience-style tracks repeat themselves; songs advance the playlist instead. */
  loop?: boolean;
};

// Recorded upstream music was removed: generation/subscription provenance was unavailable.
const CAMPFIRE_PLAYLIST: readonly MusicTrack[] = [];
const CASINO_PLAYLIST: readonly MusicTrack[] = [];
const SNUG_PLAYLIST: readonly MusicTrack[] = [];
export const BEACH_PLAYLIST: readonly MusicTrack[] = [];
export const MENU_PLAYLIST: readonly MusicTrack[] = [];
export const TENSE_PLAYLISTS: Readonly<Record<SceneId, readonly MusicTrack[]>> = {
  campfire: [],
  casino: [],
  snug: [],
  beach: [],
};
export const MUSIC_TRACKS: readonly MusicTrack[] = [];

export const BASE_PACK_ID = 'parlour';

export const PARLOUR_PACK: MusicPack = {
  id: BASE_PACK_ID,
  label: 'Parlour',
  playlists: {
    campfire: CAMPFIRE_PLAYLIST,
    casino: CASINO_PLAYLIST,
    snug: SNUG_PLAYLIST,
    beach: BEACH_PLAYLIST,
  },
  menu: MENU_PLAYLIST,
  sceneMenus: { beach: BEACH_PLAYLIST },
  sceneMoods: {
    campfire: { tense: TENSE_PLAYLISTS.campfire },
    casino: { tense: TENSE_PLAYLISTS.casino },
    snug: { tense: TENSE_PLAYLISTS.snug },
    beach: { tense: TENSE_PLAYLISTS.beach },
  },
};

/** Original upbeat synth pop, reproducible from generate-pop-music.mjs (MIT). No samples. */
export const FALLBACK_TRACK: MusicTrack = {
  id: 'hearth',
  title: 'ポップ・シャッフル',
  src: '/audio/original/pop-shuffle.wav',
  volume: 0.55,
  loop: true,
};

const packs = new Map<string, MusicPack>([[PARLOUR_PACK.id, PARLOUR_PACK]]);

/** Games call this (client-side) to contribute their own soundtracks. */
export function registerMusicPack(pack: MusicPack): void {
  packs.set(pack.id, pack);
}

export function unregisterMusicPack(id: string): void {
  if (id !== PARLOUR_PACK.id) packs.delete(id);
}

export function getMusicPack(id: string | null | undefined): MusicPack | undefined {
  return packs.get(id ?? '');
}

export function listMusicPacks(): MusicPack[] {
  const rest = [...packs.values()].filter((pack) => pack.id !== PARLOUR_PACK.id);
  return [PARLOUR_PACK, ...rest];
}

export function getMusicTrack(id: string | null | undefined): MusicTrack | undefined {
  if (id === FALLBACK_TRACK.id) return FALLBACK_TRACK;
  const base = MUSIC_TRACKS.find((candidate) => candidate.id === id);
  if (base) return base;
  for (const pack of packs.values()) {
    for (const list of Object.values(pack.playlists)) {
      const found = list?.find((candidate) => candidate.id === id);
      if (found) return found;
    }
    const menuHit = pack.menu?.find((candidate) => candidate.id === id);
    if (menuHit) return menuHit;
    for (const list of Object.values(pack.moods ?? {})) {
      const found = list.find((candidate) => candidate.id === id);
      if (found) return found;
    }
    for (const sceneMoods of Object.values(pack.sceneMoods ?? {})) {
      for (const list of Object.values(sceneMoods ?? {})) {
        const found = list.find((candidate) => candidate.id === id);
        if (found) return found;
      }
    }
  }
  return undefined;
}

/** Base-library playlist for a scene (what the parlour pack ships). */
export function tracksForScene(scene: SceneId): MusicTrack[] {
  const fromPack = PARLOUR_PACK.playlists[scene];
  return fromPack ? [...fromPack] : [];
}

/** Every playlist a pack provides for a scene, resolved against the parlour base. */
export function playlistForPack(pack: MusicPack | undefined, scene: SceneId): MusicTrack[] {
  const own = pack?.playlists[scene];
  if (own && own.length > 0) return [...own];
  return tracksForScene(scene);
}

/** Menu-theme playlist for a pack, resolved against the parlour base. */
export function menuForPack(pack: MusicPack | undefined, scene?: SceneId): MusicTrack[] {
  const sceneMenu = scene ? (pack?.sceneMenus?.[scene] ?? PARLOUR_PACK.sceneMenus?.[scene]) : null;
  if (sceneMenu && sceneMenu.length > 0) return [...sceneMenu];
  if (pack?.menu && pack.menu.length > 0) return [...pack.menu];
  return [...MENU_PLAYLIST];
}

/**
 * Tracks for a mood cue, resolved against the parlour base. An empty result
 * means the mood has no music, so the controller leaves the playlist alone.
 */
export function moodForPack(
  pack: MusicPack | undefined,
  mood: MusicMoodId,
  scene: SceneId = DEFAULT_SCENE,
): MusicTrack[] {
  const ownScene = pack?.sceneMoods?.[scene]?.[mood];
  if (ownScene && ownScene.length > 0) return [...ownScene];

  const ownGlobal = pack?.moods?.[mood];
  if (ownGlobal && ownGlobal.length > 0) return [...ownGlobal];

  if (pack?.id === PARLOUR_PACK.id) return [];

  const baseScene = PARLOUR_PACK.sceneMoods?.[scene]?.[mood];
  if (baseScene && baseScene.length > 0) return [...baseScene];
  return [...(PARLOUR_PACK.moods?.[mood] ?? [])];
}
