import { describe, it, expect } from 'vitest';
import { daifugoConfig } from '@parlour/game-daifugo';
import { readDaifugoPresets, useDaifugoPresets } from './daifugoPresets';

describe('saved Daifugo rules', () => {
  it('restores rules through the current schema and ignores malformed storage', () => {
    expect(readDaifugoPresets(null)).toEqual([]);
    expect(readDaifugoPresets([null, { name: 7 }])).toEqual([]);
    const entries = readDaifugoPresets([
      { name: '  仲間  ', rules: { jokerCount: 99, seatOrder: 'invalid' } },
    ]);
    expect(entries[0]).toMatchObject({
      name: '仲間',
      rules: { jokerCount: 2, seatOrder: 'fixed' },
    });
  });
  it('saves a named preset, replaces it by name, and removes just that preset', () => {
    const store = useDaifugoPresets.getState();
    store.save('友人', daifugoConfig.resolve({ eightCut: false, seatOrder: 'random' }));
    store.save('友人', daifugoConfig.resolve({ eightCut: true }));
    expect(
      useDaifugoPresets.getState().entries.filter((entry) => entry.name === '友人'),
    ).toHaveLength(1);
    expect(useDaifugoPresets.getState().entries[0]!.rules.eightCut).toBe(true);
    store.remove('友人');
    expect(
      useDaifugoPresets.getState().entries.find((entry) => entry.name === '友人'),
    ).toBeUndefined();
  });
});
