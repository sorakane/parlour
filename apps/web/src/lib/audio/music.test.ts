import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BASE_PACK_ID,
  FALLBACK_TRACK,
  MENU_PLAYLIST,
  MUSIC_TRACKS,
  PARLOUR_PACK,
  TENSE_PLAYLISTS,
  getMusicPack,
  getMusicTrack,
  menuForPack,
  listMusicPacks,
  moodForPack,
  playlistForPack,
  registerMusicPack,
  tracksForScene,
  unregisterMusicPack,
} from './music';

const SCENE_IDS = ['campfire', 'casino', 'snug', 'beach'] as const;

describe('music library', () => {
  it('ships no unverified recordings and uses only reproducible ambience', () => {
    expect(MUSIC_TRACKS).toEqual([]);
    expect(MENU_PLAYLIST).toEqual([]);
    for (const scene of SCENE_IDS) {
      expect(tracksForScene(scene)).toEqual([]);
      expect(TENSE_PLAYLISTS[scene]).toEqual([]);
    }
    const path = join(process.cwd(), 'public', FALLBACK_TRACK.src);
    expect(statSync(path).size).toBeGreaterThan(1000);
    const header = readFileSync(path).subarray(0, 12);
    expect(header.subarray(0, 4).toString()).toBe('RIFF');
    expect(header.subarray(8, 12).toString()).toBe('WAVE');
    expect(getMusicTrack('title-1')).toBeUndefined();
    expect(getMusicTrack('hearth')).toBe(FALLBACK_TRACK);
    expect(FALLBACK_TRACK.loop).toBe(true);
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      );
    expect(
      walk(join(process.cwd(), 'public/audio')).every(
        (path) => path.includes('/original/') && path.endsWith('.wav'),
      ),
    ).toBe(true);
  });
  it('lets a game pack globally override tense music and inherit moods it omits', () => {
    const own = { id: 'wild-tense', title: 'Pile Pressure', src: '/audio/music/wild-tense.mp3' };
    registerMusicPack({
      id: 'mood-game',
      label: 'Mood Game',
      playlists: {},
      moods: { tense: [own] },
    });
    const pack = getMusicPack('mood-game');

    expect(moodForPack(pack, 'tense', 'campfire')).toEqual([own]);
    expect(moodForPack(pack, 'tense', 'casino')).toEqual([own]);
    expect(moodForPack(pack, 'tense', 'snug')).toEqual([own]);
    expect(getMusicTrack('wild-tense')).toEqual(own);
    expect(moodForPack(pack, 'unknown-mood')).toEqual([]);

    unregisterMusicPack('mood-game');
  });

  it('lets a game pack override one scene mood and inherit themed Parlour cues elsewhere', () => {
    const own = {
      id: 'casino-sudden-death',
      title: 'Loaded Dice',
      src: '/audio/music/casino-sudden-death.m4a',
    };
    registerMusicPack({
      id: 'scene-mood-game',
      label: 'Scene Mood Game',
      playlists: {},
      sceneMoods: { casino: { tense: [own] } },
    });
    const pack = getMusicPack('scene-mood-game');

    expect(moodForPack(pack, 'tense', 'casino')).toEqual([own]);
    expect(moodForPack(pack, 'tense', 'campfire')).toEqual(TENSE_PLAYLISTS.campfire);
    expect(moodForPack(pack, 'tense', 'snug')).toEqual(TENSE_PLAYLISTS.snug);
    expect(getMusicTrack('casino-sudden-death')).toEqual(own);

    unregisterMusicPack('scene-mood-game');
  });
});

describe('music pack registry', () => {
  it('registers the parlour base pack and lists it first', () => {
    expect(getMusicPack(BASE_PACK_ID)).toBe(PARLOUR_PACK);
    expect(listMusicPacks()[0]?.id).toBe(BASE_PACK_ID);
    expect(getMusicPack('missing')).toBeUndefined();
  });

  it('lets games contribute their own playlists and removes them again', () => {
    registerMusicPack({
      id: 'test-game',
      label: 'Test Game',
      playlists: { snug: [FALLBACK_TRACK] },
    });

    const gamePack = getMusicPack('test-game');
    expect(gamePack).toBeDefined();
    expect(listMusicPacks().map((pack) => pack.id)).toContain('test-game');

    // A pack's own playlist wins; scenes it omits inherit the parlour library.
    expect(playlistForPack(gamePack, 'snug').map((song) => song.id)).toEqual(['hearth']);
    expect(playlistForPack(gamePack, 'casino')).toEqual(tracksForScene('casino'));

    unregisterMusicPack('test-game');
    expect(getMusicPack('test-game')).toBeUndefined();
  });

  it('never unregisters the parlour base pack', () => {
    unregisterMusicPack(BASE_PACK_ID);
    expect(getMusicPack(BASE_PACK_ID)).toBe(PARLOUR_PACK);
  });
});
