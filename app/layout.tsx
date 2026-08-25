import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { getPublicOrigin } from './seo-config.ts';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const publicOrigin = getPublicOrigin();
const socialImage = publicOrigin
  ? [{ url: '/og.png', width: 1200, height: 630, alt: 'Crelo — Forward Deployed Engineer' }]
  : undefined;

export const metadata: Metadata = {
  title: 'Crelo — Forward Deployed Engineer / Business × AI × Software',
  description: '課題整理から設計・開発・導入まで。事業の課題を、技術で解決します。',
  applicationName: 'Crelo',
  keywords: ['Crelo', 'Forward Deployed Engineer', 'AI', 'Software', 'Integration', 'Deployment'],
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png', sizes: '32x32' }],
    apple: [{ url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  openGraph: {
    title: 'Crelo — Forward Deployed Engineer',
    description: '課題整理から設計・開発・導入まで。事業の課題を、技術で解決します。',
    type: 'website',
    ...(socialImage ? { images: socialImage } : {}),
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crelo — Forward Deployed Engineer',
    description: '課題整理から設計・開発・導入まで。事業の課題を、技術で解決します。',
    ...(socialImage ? { images: ['/og.png'] } : {}),
  },
  ...(publicOrigin
    ? {
        metadataBase: publicOrigin,
        alternates: { canonical: '/' },
        robots: { index: true, follow: true },
      }
    : { robots: { index: false, follow: false } }),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <a className="skip-link" href="#main-content">本文へ移動</a>
        {children}
      </body>
    </html>
  );
}
