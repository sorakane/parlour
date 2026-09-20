# 大富豪の公開構成

- GitHub: ソース管理。
- Vercel: Next.js static export を配信。公開 URL は https://dai-fugo.vercel.app/。
- Nostr: 元プロジェクトの部屋検索・接続交渉。
- WebRTC: 元プロジェクトのデータチャネル、ホスト判定、同期・再接続。
- Metered TURN: 端末間の直接通信ができない場合の中継。

Sites の HTTP 中継コードと Vercel の転送設定は撤去した。
以前の Sites 方式の部屋とは互換性がないため、全員が更新して新しい部屋を作る。
大富豪の追加ルール・画面・音・人数選択は維持する。

## TURN 設定

上流の `iceServers.ts` が持つ設定方法を利用する。
Vercel の production / preview と、Git 対象外の `apps/web/.env.local` に以下を設定する。

- NEXT_PUBLIC_PARLOUR_TURN_URLS
- NEXT_PUBLIC_PARLOUR_TURN_USERNAME
- NEXT_PUBLIC_PARLOUR_TURN_CREDENTIAL

TURN 専用情報は WebRTC 接続のためブラウザで使用される。
Metered の管理用 Secret Key や接続情報取得用 API キーはソースに含めない。
認証情報を無効化・再発行した場合は、上記設定を更新して再ビルドする。

## 検証

`ROOM_TEST_URL=http://127.0.0.1:4321 ROOM_TEST_FORCE_RELAY=1 node scripts/verify-webrtc-rooms.cjs`

ローカル Chrome が必要。実際の Nostr で部屋を検索し、4ブラウザ間の WebRTC を
TURN 経由に限定して、人数、ルール共有、カード操作、再接続、主催者離脱後の操作を確認する。
Sites への通信が発生した場合は失敗とする。

画面ロックによるブラウザ停止をTURNが防ぐわけではない。
全員がブラウザを閉じたゲームを後から再開するサーバー保存機能はない。
