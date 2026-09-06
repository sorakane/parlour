import { defineConfig, type RuleValues } from '@parlour/engine';

export interface DaifugoRules extends RuleValues {
  jokerCount: number;
  revolution: boolean;
  revolutionCount: number;
  eightCut: boolean;
  jackBack: boolean;
  suitLock: boolean;
  spadeThree: boolean;
  fiveSkip: boolean;
  passLocks: boolean;
  trading: boolean;
  exchangeCount: number;
  firstPlayer: string;
  nextLeader: string;
  seatOrder: string;
  targetPoints: number;
}

export const DEFAULT_TARGET_POINTS = 11;
export const MIN_TARGET_POINTS = 5;
export const MAX_TARGET_POINTS = 40;

/** Only implemented rules appear here. Future effects can add their own fields. */
export const daifugoConfig = defineConfig<DaifugoRules>(
  [
    { key: 'jokerCount', kind: 'int', label: 'ジョーカーの枚数', min: 0, max: 2, default: 2 },
    { key: 'revolution', kind: 'toggle', label: '革命', default: true },
    { key: 'revolutionCount', kind: 'int', label: '革命に必要な枚数', min: 4, max: 6, default: 4 },
    { key: 'eightCut', kind: 'toggle', label: '8切り', default: true },
    { key: 'jackBack', kind: 'toggle', label: '11バック（場が流れるまで逆転）', default: true },
    { key: 'suitLock', kind: 'toggle', label: '縛り（同じスートの組を2回）', default: true },
    {
      key: 'spadeThree',
      kind: 'toggle',
      label: 'スペ3返し（単体ジョーカーに勝って場を流す）',
      default: true,
    },
    { key: 'fiveSkip', kind: 'toggle', label: '5スキップ（5の枚数ぶん）', default: false },
    { key: 'passLocks', kind: 'toggle', label: 'パスしたら場が流れるまで休み', default: true },
    { key: 'trading', kind: 'toggle', label: '次ゲームのカード交換', default: true },
    {
      key: 'exchangeCount',
      kind: 'int',
      label: '大富豪と大貧民の交換枚数（富豪は1枚少ない）',
      min: 1,
      max: 3,
      default: 2,
    },
    {
      key: 'firstPlayer',
      kind: 'enum',
      label: '最初のゲームの初手',
      default: 'random',
      options: [
        { value: 'random', label: 'ランダム' },
        { value: 'diamond3', label: '♦3を持つ人（最初に♦3を出す）' },
      ],
    },
    {
      key: 'nextLeader',
      kind: 'enum',
      label: '次ゲームの初手',
      default: 'last',
      options: [
        { value: 'last', label: '前の大貧民' },
        { value: 'first', label: '前の大富豪' },
        { value: 'random', label: 'ランダム' },
      ],
    },
    {
      key: 'seatOrder',
      kind: 'enum',
      label: 'ゲームごとの手番順',
      default: 'fixed',
      options: [
        { value: 'fixed', label: '固定' },
        { value: 'random', label: '毎ゲームシャッフル' },
        { value: 'rank', label: '前ゲームの順位順' },
      ],
    },
    {
      key: 'targetPoints',
      kind: 'int',
      label: 'マッチ終了の目標ポイント',
      min: MIN_TARGET_POINTS,
      max: MAX_TARGET_POINTS,
      default: DEFAULT_TARGET_POINTS,
    },
  ],
  [
    { id: 'classic', label: 'いつもの大富豪', values: {} },
    {
      id: 'rapid',
      label: 'シンプル',
      values: { targetPoints: 7, jackBack: false, suitLock: false, fiveSkip: false },
    },
    {
      id: 'marathon',
      label: 'シャッフル卓',
      values: { targetPoints: 21, seatOrder: 'random', fiveSkip: true },
    },
  ],
);
