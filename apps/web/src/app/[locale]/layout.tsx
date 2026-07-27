import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { Secular_One, Heebo } from 'next/font/google';
import { AuthProvider } from '@/providers/AuthProvider';
import { LenisProvider } from '@/providers/LenisProvider';
import { GeoGate } from '@/components/press/GeoGate/GeoGate';
import { i18n, localeDirections, getDictionary } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import '@/styles/globals.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import { AnalyticsEvents } from '@/components/AnalyticsEvents';

const SITE_URL = 'https://taruu.co.il';

const GA_MEASUREMENT_ID = 'G-FPXS9HK4QS';

const secularOne = Secular_One({
  weight: '400',
  subsets: ['hebrew', 'latin'],
  variable: '--font-secular-one',
  display: 'swap',
});

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
});

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  const dict = await getDictionary(locale);
  const keywords = dict.meta.keywords?.split(', ') || [];

  return {
    title: {
      default: dict.meta.title,
      template: `%s | ${locale === 'he' ? 'תַּרְאוּ' : 'Taro'}`,
    },
    description: dict.meta.description,
    keywords: [
      ...keywords,
      'הצבעות',
      'קהילה',
      'רשויות מקומיות',
      'דמוקרטיה',
      'ישראל',
      'תראו',
      'voting',
      'community',
      'local government',
      'civic tech',
      'e-democracy',
    ],
    authors: [{ name: 'Taro', url: SITE_URL }],
    creator: 'Taro',
    publisher: 'Taro',
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: `${SITE_URL}/he`,
      languages: {
        'he': `${SITE_URL}/he`,
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'he' ? 'he_IL' : 'en_US',
      alternateLocale: locale === 'he' ? 'en_US' : 'he_IL',
      url: `${SITE_URL}/${locale}`,
      siteName: locale === 'he' ? 'תַּרְאוּ' : 'Taro',
      title: dict.meta.title,
      description: dict.meta.description,
      images: [
        {
          url: `${SITE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: locale === 'he' ? 'תַּרְאוּ — הקול של השכונה, סוף־סוף במספרים' : 'Taruu — your neighborhood\'s voice, finally in numbers',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: dict.meta.title,
      description: dict.meta.description,
      images: [`${SITE_URL}/og-image.png`],
      creator: '@taro_il',
    },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: [
        { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    manifest: '/site.webmanifest',
    verification: {
      // Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION in env; omitted when unset.
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    },
    category: 'technology',
  };
}

function generateStructuredData(locale: Locale) {
  const isHebrew = locale === 'he';

  // Organization Schema
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: isHebrew ? 'תַּרְאוּ' : 'Taro',
    url: SITE_URL,
    logo: `${SITE_URL}/logo600.png`,
    description: isHebrew
      ? 'פלטפורמת הצבעות קהילתיות עם אימות GPS ותוצאות שקופות'
      : 'Community voting platform with GPS verification and transparent results',
    foundingDate: '2024',
    foundingLocation: {
      '@type': 'Place',
      name: 'Israel',
    },
    areaServed: {
      '@type': 'Country',
      name: 'Israel',
    },
    sameAs: [
      WHATSAPP_FOUNDERS_LINK,
    ],
  };

  // WebSite Schema for Search
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: isHebrew ? 'תַּרְאוּ' : 'Taro',
    url: SITE_URL,
    description: isHebrew
      ? 'פלטפורמת הצבעות קהילתיות מקומיות בישראל'
      : 'Local community voting platform in Israel',
    inLanguage: isHebrew ? 'he-IL' : 'en-US',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  // SoftwareApplication Schema
  const softwareApp = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: isHebrew ? 'תַּרְאוּ' : 'Taro',
    operatingSystem: 'iOS, Android',
    applicationCategory: 'UtilitiesApplication',
    description: isHebrew
      ? 'אפליקציה להצבעות קהילתיות מקומיות עם אימות מיקום GPS'
      : 'App for local community voting with GPS location verification',
    offers: {
      '@type': 'Offer',
      price: '3',
      priceCurrency: 'ILS',
      description: isHebrew ? 'דמי השתתפות להצבעה' : 'Voting participation fee',
    },
    featureList: isHebrew
      ? ['אימות GPS', 'תוצאות שקופות', 'הצבעות קהילתיות', 'אימות תושבים']
      : ['GPS verification', 'Transparent results', 'Community voting', 'Resident verification'],
  };

  // FAQ Schema for AEO
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: isHebrew ? 'מהי תַּרְאוּ?' : 'What is Taro?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: isHebrew
            ? 'תַּרְאוּ היא פלטפורמה להצבעות קהילתיות מקומיות בישראל. היא מאפשרת לתושבים להצביע על נושאים מקומיים עם אימות GPS ותוצאות שקופות לכולם.'
            : 'Taro is a platform for local community voting in Israel. It enables residents to vote on local issues with GPS verification and transparent results for everyone.',
        },
      },
      {
        '@type': 'Question',
        name: isHebrew ? 'כמה עולה להשתתף בהצבעה?' : 'How much does it cost to participate in a vote?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: isHebrew
            ? 'דמי ההשתתפות הם ₪3 בלבד. מתוכם ₪2 נשמרים בקרן נאמנות קהילתית ו-₪1 משמש לתחזוקת הפלטפורמה.'
            : 'The participation fee is only 3 NIS. Of this, 2 NIS goes to a community trust fund and 1 NIS is used for platform maintenance.',
        },
      },
      {
        '@type': 'Question',
        name: isHebrew ? 'איך מאמתים שאני תושב?' : 'How do you verify that I am a resident?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: isHebrew
            ? 'האימות מתבצע באמצעות GPS. רק מי שנמצא פיזית בתחום הרשות המקומית יכול להשתתף בהצבעות.'
            : 'Verification is done via GPS. Only those physically located within the municipality boundaries can participate in votes.',
        },
      },
      {
        '@type': 'Question',
        name: isHebrew ? 'באילו רשויות הפלטפורמה פעילה?' : 'In which municipalities is the platform active?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: isHebrew
            ? 'הפלטפורמה נפתחת בכל הארץ, בכל הרשויות בבת אחת. ההצבעה הראשונה מתוכננת ל-04.08.26.'
            : 'The platform opens nationwide, in all municipalities at once. The first vote is planned for 04.08.26.',
        },
      },
    ],
  };

  // LocalBusiness Schema for local SEO
  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: isHebrew ? 'תַּרְאוּ - ישראל' : 'Taro - Israel',
    description: isHebrew
      ? 'פלטפורמת הצבעות קהילתיות לתושבי כל הרשויות בישראל'
      : 'Community voting platform for residents of every Israeli municipality',
    url: SITE_URL,
    areaServed: {
      '@type': 'Country',
      name: 'Israel',
    },
    priceRange: '₪3',
  };

  return [organization, website, softwareApp, faq, localBusiness];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;

  // Validate locale (Hebrew-only — anything else 404s; middleware already redirects)
  if (!(i18n.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  const direction = localeDirections[locale];

  const structuredData = generateStructuredData(locale);

  return (
    <html lang={locale} dir={direction} className={`${secularOne.variable} ${heebo.variable}`}>
      <head>
        {/* JSON-LD Structured Data for SEO & AEO */}
        {structuredData.map((data, index) => (
          <script
            key={index}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
          />
        ))}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            // send_page_view:false — page_view fired manually on route change
            // (with explicit page_title) by AnalyticsEvents to avoid (not set).
            gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
          `}
        </Script>
      </head>
      <body>
        <AnalyticsEvents />
        <AuthProvider>
          <LenisProvider>{children}</LenisProvider>
          <GeoGate />
        </AuthProvider>
      </body>
    </html>
  );
}
