import type { Viewport, Metadata } from 'next';
import '@/styles/globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563EB',
};

export const metadata: Metadata = {
  title: 'Taro | תַּרְאוּ',
  description: 'Community voting platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The [locale]/layout.tsx provides the actual html/body structure
  // This layout just passes children through for the i18n routing to work
  return children;
}
