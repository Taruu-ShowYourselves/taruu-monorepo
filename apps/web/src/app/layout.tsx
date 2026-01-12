import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { heIL } from '@clerk/localizations';
import { LenisProvider } from '@/providers/LenisProvider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'סינק | הצבעות קהילתיות מקומיות',
    template: '%s | סינק',
  },
  description:
    'פלטפורמה לקבלת החלטות קהילתיות ברשויות המקומיות בישראל. הצביעו על נושאים מקומיים, עקבו אחרי החלטות, והשפיעו על הקהילה שלכם.',
  keywords: [
    'הצבעות',
    'קהילה',
    'רשויות מקומיות',
    'דמוקרטיה',
    'ישראל',
    'בלוקצ׳יין',
    'סינק',
  ],
  authors: [{ name: 'Sync' }],
  creator: 'Sync',
  publisher: 'Sync',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    url: 'https://sync.co.il',
    siteName: 'סינק',
    title: 'סינק | הצבעות קהילתיות מקומיות',
    description:
      'פלטפורמה לקבלת החלטות קהילתיות ברשויות המקומיות בישראל.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'סינק - הצבעות קהילתיות',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'סינק | הצבעות קהילתיות מקומיות',
    description:
      'פלטפורמה לקבלת החלטות קהילתיות ברשויות המקומיות בישראל.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563EB',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider localization={heIL as any}>
      <html lang="he" dir="rtl">
        <body>
          <Script id="developer-console-message" strategy="afterInteractive">
            {`console.log("%cתֵּרָאוּ • built with love by saharbarak.dev", "font-weight:600; font-size:12px;");`}
          </Script>
          <LenisProvider>{children}</LenisProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
