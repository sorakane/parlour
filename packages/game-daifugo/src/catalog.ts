import { defineGameCatalog } from '@parlour/engine';
import { daifugoConfig } from './config';
import { daifugoHowToPlay } from './howto';
import { orderDaifugoHand } from './deck';

const art = [
  { label: '8', tint: ['#369b88', '#18574e'] as [string, string] },
  { label: '♛', tint: ['#e2b049', '#926423'] as [string, string] },
  { label: 'J', tint: ['#8264b7', '#4a3372'] as [string, string] },
];
export const daifugoCatalog = defineGameCatalog({
  id: 'daifugo',
  gameId: 'daifugo',
  name: '大富豪 / Daifugo',
  subtitle: 'いつもの仲間と、いつものルールで',
  tagline: 'この卓のルールは、みんなで決める。',
  description:
    '革命、階段、7渡し、10捨て、都落ち。好きなルールと手番順を選んで、友人と大富豪を楽しみましょう。',
  facts: ['4〜8人', 'ローカルルール設定', 'CPU・友人対戦'],
  accent: '#369b88',
  shade: '#18574e',
  art,
  href: '/daifugo',
  seats: [4, 5, 6, 7, 8],
  configSchema: daifugoConfig,
  howToPlay: daifugoHowToPlay,
  handOrder: orderDaifugoHand,
  modes: [
    {
      id: 'local',
      preset: 'local',
      name: 'ローカル卓',
      tagline: '追加ルールをまとめて試す',
      description:
        '階段・階段革命・7渡し・10捨て・都落ち・禁止上がりを追加。激縛りや細かな扱いは設定から選べます。',
      facts: ['階段・7渡し・10捨て', '都落ち', '禁止上がり'],
      accent: '#b7835e',
      shade: '#6f4632',
      art,
    },
    {
      id: 'classic',
      preset: 'classic',
      name: 'いつもの大富豪',
      tagline: 'まずはこの卓から',
      description: '革命・8切り・11バック・縛り・スペ3返し。各ルールは自由に変更できます。',
      facts: ['11ポイント', '交換あり', 'ジョーカー2枚'],
      accent: '#369b88',
      shade: '#18574e',
      art,
    },
    {
      id: 'rapid',
      preset: 'rapid',
      name: 'シンプル',
      tagline: '気軽に一勝負',
      description: '革命と8切りを中心にした短いマッチ。初めての人にも。',
      facts: ['7ポイント', '11バックなし', '縛りなし'],
      accent: '#d9a441',
      shade: '#8a5c14',
      art,
    },
    {
      id: 'marathon',
      preset: 'marathon',
      name: 'シャッフル卓',
      tagline: '次は誰の隣から？',
      description: '毎ゲーム手番順をシャッフル。5スキップも加わる長めのマッチ。',
      facts: ['21ポイント', '手番シャッフル', '5スキップ'],
      accent: '#8264b7',
      shade: '#4a3372',
      art,
    },
  ],
});
