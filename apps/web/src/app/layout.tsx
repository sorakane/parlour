import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Baloo_2, Nunito_Sans } from 'next/font/google';
import { ComfortSync } from '@/components/ComfortSync';
import { ColorModeSync } from '@/components/ColorModeSync';
import { LocaleSync } from '@/components/LocaleSync';
import { DaifugoMusicToggle } from '@/components/DaifugoMusicToggle';
import { AudioDirector } from '@/components/AudioDirector';
import { SceneStage } from '@/components/backgrounds/SceneStage';
import { MenuShell } from '@/components/menu/MenuShell';
import { WipeOverlay } from '@/components/transitions/WipeOverlay';
import { PwaRegister } from '@/components/PwaRegister';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const display = Baloo_2({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const body = Nunito_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://dai-fugo.vercel.app'),
  title: {
    default: '大富豪｜友だちと遊べるオンラインカードゲーム',
    template: '%s · 大富豪',
  },
  applicationName: '大富豪',
  description:
    '友だちとブラウザで遊べるオンライン大富豪。4〜8人対戦、CPU対戦、革命・8切りなどのローカルルールに対応。',
  keywords: ['大富豪', 'オンライン', 'トランプ', '友だち', 'ローカルルール'],
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: '大富豪',
    title: '大富豪｜友だちと遊べるオンラインカードゲーム',
    description:
      '友だちとブラウザで遊べるオンライン大富豪。4〜8人対戦、CPU対戦、革命・8切りなどのローカルルールに対応。',
    images: [
      {
        url: '/social/daifugo-v1.png',
        width: 1200,
        height: 630,
        alt: '大富豪 — いつもの仲間と、あなたのルールで。',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '大富豪｜友だちと遊べるオンラインカードゲーム',
    description:
      '友だちとブラウザで遊べるオンライン大富豪。4〜8人対戦、CPU対戦、革命・8切りなどのローカルルールに対応。',
    images: ['/social/daifugo-v1.png'],
  },
  category: 'games',
  manifest: '/manifest.webmanifest?v=daifugo-1',
  icons: {
    icon: [
      { url: '/daifugo-icon-v1.svg', type: 'image/svg+xml' },
      { url: '/daifugo-icon-192-v1.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/daifugo-icon-180-v1.png', type: 'image/png', sizes: '180x180' }],
    shortcut: '/daifugo-icon-192-v1.png',
  },
  appleWebApp: { capable: true, title: '大富豪', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  other: { 'mobile-web-app-capable': 'yes' },
};

/**
 * The table is an app surface, not a page: it is laid out to the viewport, it
 * drags cards, and a pinch that rescales it mid-hand breaks the thing rather
 * than revealing more of it. So the scale is pinned deliberately, and the cost
 * is stated rather than hidden — this is a WCAG 1.4.4 trade, made on the
 * grounds that a fixed-canvas game is not the reflowable content that rule is
 * written for. Type size and contrast carry the legibility burden instead.
 *
 * Because the lock also suppresses iOS Safari's focus auto-zoom, no input needs
 * to reach 16px to avoid it. Keep the lock and the input sizes together: if one
 * ever goes, the other has to be revisited in the same change.
 */
export const viewport: Viewport = {
  themeColor: '#111112',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  colorScheme: 'dark',
};

const developmentPwaReset = `
(() => {
  const marker = 'parlour-pwa-dev-reset';

  const reset = async () => {
    if (!('serviceWorker' in navigator)) return;

    const registrations = await navigator.serviceWorker.getRegistrations();
    const parlourRegistrations = registrations.filter((registration) => {
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      return worker && new URL(worker.scriptURL).pathname === '/sw.js';
    });

    await Promise.all(parlourRegistrations.map((registration) => registration.unregister()));

    const cacheKeys = 'caches' in window ? await caches.keys() : [];
    const parlourCacheKeys = cacheKeys.filter((key) => key.startsWith('parlour-'));
    await Promise.all(parlourCacheKeys.map((key) => caches.delete(key)));

    const foundPwaState = parlourRegistrations.length > 0 || parlourCacheKeys.length > 0;
    const resetAttempts = Number(sessionStorage.getItem(marker) ?? 0);

    if (foundPwaState && resetAttempts < 2) {
      sessionStorage.setItem(marker, String(resetAttempts + 1));
      window.location.reload();
      return;
    }

    sessionStorage.removeItem(marker);
  };

  void reset().catch(() => undefined);
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} data-color-mode="richer">
      <body className="min-h-dvh antialiased">
        {process.env.NODE_ENV === 'development' ? (
          <Script
            id="parlour-pwa-development-reset"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: developmentPwaReset }}
          />
        ) : null}
        <SceneStage />
        <MenuShell>{children}</MenuShell>
        <WipeOverlay />
        <ComfortSync />
        <ColorModeSync />
        <LocaleSync />
        <AudioDirector />
        <DaifugoMusicToggle />
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  );
}
