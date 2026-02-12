import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Market Pulse — 시장 심리 대시보드',
  description: 'Fear & Greed Index, VIX, 주요 종목 종가를 한 화면에서 추적하는 PWA 대시보드',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Market Pulse',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="noise-bg">{children}</body>
    </html>
  );
}
