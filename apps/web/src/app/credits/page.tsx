import Link from 'next/link';
import styles from './page.module.css';

export default function CreditsPage() {
  return (
    <main className={styles.page} lang="ja">
      <Link href="/daifugo/">← 大富豪に戻る</Link>
      <h1>クレジット・ライセンス</h1>
      <section>
        <h2>ゲームの基盤</h2>
        <p>
          このゲームは、Braedon Saunders
          によるオープンソースのカードゲーム「Parlour」を基に、大富豪と独自の画面・演出を追加したものです。
        </p>
        <p>Copyright (c) 2026 Braedon Saunders — MIT License</p>
        <p>
          <a href="https://github.com/braedonsaunders/parlour">元のリポジトリ</a> ·{' '}
          <a href="https://github.com/sorakane/parlour">この版のソースコード</a> ·{' '}
          <a href="/legal/parlour-LICENSE.txt">著作権表示・MITライセンス全文</a>
        </p>
      </section>
      <section>
        <h2>フォント・ライブラリ</h2>
        <p>
          Baloo 2 — The Baloo 2 Project Authors。Nunito Sans — The Nunito Sans Project
          Authors。いずれも SIL Open Font License 1.1。
        </p>
        <ul>
          <li>
            <a href="/legal/Baloo2-OFL.txt">Baloo 2 のライセンス</a>
          </li>
          <li>
            <a href="/legal/NunitoSans-OFL.txt">Nunito Sans のライセンス</a>
          </li>
          <li>
            <a href="/legal/THIRD-PARTY-NOTICES.txt">使用ライブラリの著作権・ライセンス表示</a>
          </li>
          <li>
            <a href="https://gsap.com/standard-license/">GSAP — Standard License</a>
          </li>
        </ul>
      </section>
      <section>
        <h2>音・ビジュアル</h2>
        <p>
          この版では、利用条件を確認できない既存の音楽・録音素材を使用していません。環境音と短い操作音は、数式による合成音です。音声・楽曲・録音サンプルは含みません。
        </p>
        <p>
          環境音は Parlour の MIT
          ライセンスの生成コード、操作音はこの版で追加した生成コードから作成しています。
        </p>
        <p>
          赤・黒・白の大富豪UIとカットインは、文字と幾何学図形で構成した独自デザインです。特定のゲーム作品の画像・ロゴ・演出素材は使用していません。
        </p>
      </section>
    </main>
  );
}
