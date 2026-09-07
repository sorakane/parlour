import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { daifugoConfig, type DaifugoRules } from '@parlour/game-daifugo';
import { daifugoRulesFor } from '@/stores/daifugoSetup';
import { DaifugoTransport } from '@/lib/solo/DaifugoTransport';
import { DaifugoJokerSettings } from './DaifugoJokerSettings';

describe('visible joker settings', () => {
  it.each(['classic', 'local', 'rapid', 'marathon', 'rank-up'] as const)(
    'deals two jokers and enables spade-three in the %s preset',
    (mode) => {
      const rules = daifugoRulesFor(mode, {});
      const transport = new DaifugoTransport({
        mode,
        rules,
        seed: 17,
        seats: 4,
        player: { name: 'あなた', avatarId: 'ember' },
      });
      const { state } = transport.getSnapshot().session;
      expect(state.rules.spadeThree).toBe(true);
      expect(
        state.hands
          .flat()
          .filter((card) => card === 'J0' || card === 'J1')
          .sort(),
      ).toEqual(['J0', 'J1']);
    },
  );

  it('updates the resolved rules through the shortcuts and explains a zero-joker deck', () => {
    let selected: DaifugoRules = daifugoConfig.defaults();
    function Harness() {
      const [rules, setRules] = useState(selected);
      selected = rules;
      return createElement(DaifugoJokerSettings, {
        rules,
        onChange: (key, value) =>
          setRules((current) => daifugoConfig.resolve({ ...current, [key]: value })),
      });
    }
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      act(() => root.render(createElement(Harness)));
      const button = [...host.querySelectorAll('button')].find((b) => b.textContent === '0枚')!;
      act(() => button.click());
      expect(selected.jokerCount).toBe(0);
      expect(host.textContent).toContain('この設定では発動しません');
      act(() => host.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
      expect(selected.spadeThree).toBe(false);
      expect(host.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false');
    } finally {
      act(() => root.unmount());
    }
  });
});
