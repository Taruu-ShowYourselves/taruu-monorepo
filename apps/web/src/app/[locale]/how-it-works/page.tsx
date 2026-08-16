import { permanentRedirect } from 'next/navigation';
import { localePrefix, type Locale } from '@/lib/i18n';

interface HowItWorksPageProps {
  params: Promise<{ locale: Locale }>;
}

/**
 * The page moved to /what-is-taruu, which now carries the argument as well as
 * the mechanism. Kept as a permanent redirect rather than deleted: the URL is
 * in the sitemap, in the lede, and on printed pilot material, and a 404 there
 * costs a resident the page they were promised.
 */
export default async function HowItWorksPage({ params }: HowItWorksPageProps) {
  const { locale } = await params;
  permanentRedirect(`${localePrefix(locale)}/what-is-taruu`);
}
