import { defineConfig, type RuleValues } from '@parlour/engine';

export interface DaifugoRules extends RuleValues {
  jokerCount: number;
  stairs: boolean;
  stairsMin: number;
  stairsTwo: boolean;
  stairsJoker: boolean;
  stairsOverlap: boolean;
  stairsRevolution: boolean;
  stairsRevolutionCount: number;
  specialsOnStairs: boolean;
  strictLock: boolean;
  sevenGive: boolean;
  tenDiscard: boolean;
  miyako: boolean;
  forbidJokerFinish: boolean;
  forbidEightFinish: boolean;
  forbidStrongestFinish: boolean;
  forbidSpadeThreeFinish: boolean;
  forbidEffectFinish: boolean;

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
    {
      key: 'jokerCount',
      group: '基本',
      kind: 'int',
      label: 'ジョーカーの枚数',
      min: 0,
      max: 2,
      default: 2,
    },
    { key: 'revolution', group: '革命', kind: 'toggle', label: '革命', default: true },
    {
      key: 'revolutionCount',
      group: '革命',
      kind: 'int',
      label: '革命に必要な枚数',
      min: 4,
      max: 6,
      default: 4,
    },
    { key: 'eightCut', group: 'カードの効果', kind: 'toggle', label: '8切り', default: true },
    {
      key: 'jackBack',
      group: 'カードの効果',
      kind: 'toggle',
      label: '11バック（場が流れるまで逆転）',
      default: true,
    },
    {
      key: 'suitLock',
      group: '縛り',
      kind: 'toggle',
      label: '縛り（同じスートの組を2回）',
      default: true,
    },
    {
      key: 'spadeThree',
      group: 'カードの効果',
      kind: 'toggle',
      label: 'スペ3返し（単体ジョーカーに勝って場を流す）',
      default: true,
    },
    {
      key: 'fiveSkip',
      group: 'カードの効果',
      kind: 'toggle',
      label: '5スキップ（5の枚数ぶん）',
      default: false,
    },
    {
      key: 'stairs',
      group: '階段',
      kind: 'toggle',
      label: '階段（同じスートの連番）',
      default: false,
    },
    {
      key: 'stairsMin',
      group: '階段',
      kind: 'int',
      label: '階段の最小枚数',
      min: 3,
      max: 5,
      default: 3,
    },
    {
      key: 'stairsTwo',
      group: '階段',
      kind: 'toggle',
      label: '階段に2を含める（Aの次。3にはつながらない）',
      default: false,
    },
    {
      key: 'stairsJoker',
      group: '階段',
      kind: 'toggle',
      label: '階段の途中の欠番をジョーカーで補う（両端は実札）',
      default: false,
    },
    {
      key: 'stairsOverlap',
      group: '階段',
      kind: 'toggle',
      label: '場と数字が重なる階段を許可',
      default: true,
    },
    { key: 'stairsRevolution', group: '階段', kind: 'toggle', label: '階段革命', default: false },
    {
      key: 'stairsRevolutionCount',
      group: '階段',
      kind: 'int',
      label: '階段革命に必要な枚数',
      min: 4,
      max: 13,
      default: 4,
    },
    {
      key: 'specialsOnStairs',
      group: '階段',
      kind: 'toggle',
      label: '階段でも8切り・11バック・5/7/10の効果を使う',
      default: true,
    },
    {
      key: 'strictLock',
      group: '縛り',
      kind: 'toggle',
      label: '激縛り（同じスート＋数字が続くと、以後も連続必須）',
      default: false,
    },
    {
      key: 'sevenGive',
      group: 'カードの効果',
      kind: 'toggle',
      label: '7渡し（7の枚数ぶん次の人へ）',
      default: false,
    },
    {
      key: 'tenDiscard',
      group: 'カードの効果',
      kind: 'toggle',
      label: '10捨て（10の枚数ぶん手札を捨てる）',
      default: false,
    },
    {
      key: 'miyako',
      group: '上がり・順位',
      kind: 'toggle',
      label: '都落ち（前の大富豪が1位を逃すと脱落）',
      default: false,
    },
    {
      key: 'forbidJokerFinish',
      group: '上がり・順位',
      kind: 'toggle',
      label: 'ジョーカーを含む組での上がりを反則にする',
      default: false,
    },
    {
      key: 'forbidEightFinish',
      group: '上がり・順位',
      kind: 'toggle',
      label: '8切りでの上がりを反則にする',
      default: false,
    },
    {
      key: 'forbidStrongestFinish',
      group: '上がり・順位',
      kind: 'toggle',
      label: '最強の数字での上がりを反則にする（通常2・逆転中3）',
      default: false,
    },
    {
      key: 'forbidSpadeThreeFinish',
      group: '上がり・順位',
      kind: 'toggle',
      label: 'スペ3返しでの上がりを反則にする',
      default: false,
    },
    {
      key: 'forbidEffectFinish',
      group: '上がり・順位',
      kind: 'toggle',
      label: '7渡し・10捨てで手札が0枚になると反則にする',
      default: false,
    },
    {
      key: 'passLocks',
      group: '基本',
      kind: 'toggle',
      label: 'パスしたら場が流れるまで休み',
      default: true,
    },
    {
      key: 'trading',
      group: '交換・次のゲーム',
      kind: 'toggle',
      label: '次ゲームのカード交換',
      default: true,
    },
    {
      key: 'exchangeCount',
      group: '交換・次のゲーム',
      kind: 'int',
      label: '大富豪と大貧民の交換枚数（富豪は1枚少ない）',
      min: 1,
      max: 3,
      default: 2,
    },
    {
      key: 'firstPlayer',
      group: '交換・次のゲーム',
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
      group: '交換・次のゲーム',
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
      group: '交換・次のゲーム',
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
      group: '交換・次のゲーム',
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
      id: 'local',
      label: 'ローカル卓',
      values: {
        stairs: true,
        stairsRevolution: true,
        sevenGive: true,
        tenDiscard: true,
        miyako: true,
        forbidJokerFinish: true,
        forbidEightFinish: true,
        forbidStrongestFinish: true,
        forbidSpadeThreeFinish: true,
      },
    },
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
