import { interpolate, type MessageKey, type MessageValues, type Translator } from '@/lib/i18n';

const messages: Partial<Record<MessageKey, string>> = {
  'join.heading': '部屋に参加する',
  'join.hint': '友だちから届いた4文字の部屋コードを入力してください。',
  'join.codeLabel': '部屋コード（{total}文字中{entered}文字）',
  'join.knocking': '接続中…',
  'join.submit': '部屋に参加する',
  'join.connecting': '主催者と接続して、席を確認しています…',
  'join.unreachable':
    '部屋 {code} に接続できませんでした。コードと通信状況を確認して、もう一度お試しください。',
  'join.unreachableGeneric': '部屋に接続できませんでした。もう一度お試しください。',
  'room.codeLabel': '部屋コード',
  'room.addBot': 'CPUを追加',
  'room.lobbyClosed': '主催者が部屋を閉じました。',
  'room.connected': '部屋に接続しています',
  'room.reconnecting': '再接続中です。席は確保されています',
  'room.finding': '部屋に接続中…',
  'room.copyLink': 'リンクをコピー',
  'room.copied': 'コピーしました',
  'room.share': '共有',
  'room.shareFailed': '共有できませんでした。このリンクをコピーしてください：{url}',
  'room.bot': 'CPU',
  'room.shareTitle': '大富豪で一緒に遊ぼう',
  'room.shareText': '大富豪の対戦に参加しよう！ 部屋コード：{code}',
  'room.seatsLabel': '参加者の席',
  'room.ready': '準備完了',
  'room.rejoining': '再接続中…',
  'room.openChair': '空席',
  'room.start': '対戦を始める',
  'room.waitingFor_one': 'あと{count}人の参加を待っています',
  'room.waitingFor_other': 'あと{count}人の参加を待っています',
  'room.listPublicly': 'この部屋を公開する',
  'room.listPubliclyDetail':
    '公開すると、部屋一覧にゲーム名・あなたの名前・部屋コードが表示され、誰でも参加できます。',
  'room.listedDetail':
    '満席になるか対戦を開始するまで公開されます。チェックを外すと非公開に戻ります。',
  'table.dealing': '対戦を準備中…',
  'common.leaveArrow': '← 退出する',
  'common.backArrow': '← 戻る',
  'join.seated': '参加できました。主催者が対戦を始めるまでお待ちください。',
};

/** Daifugo room screens use Japanese regardless of the legacy engine locale. */
export function japaneseRoomCopy(fallback: Translator): Translator {
  const t = ((key: MessageKey, values?: MessageValues) =>
    messages[key] ? interpolate(messages[key]!, values) : fallback(key, values)) as Translator;
  t.count = (key, count, values) => t(`${key}_other` as MessageKey, { ...values, count });
  t.locale = fallback.locale;
  return t;
}
