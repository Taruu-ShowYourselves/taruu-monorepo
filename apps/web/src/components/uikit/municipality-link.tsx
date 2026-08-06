import Link from 'next/link';
import { MUNICIPALITIES } from '@sync/shared';
import { localePrefix, i18n } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { cn } from '@/lib/cn';

interface MunicipalityLinkProps {
  /** Municipality display name (Hebrew, as stored on votes/users). */
  name: string | null | undefined;
  className?: string;
  /** Rendered when `name` is empty. Pass '-' where call sites showed a dash. */
  fallback?: string;
  locale?: Locale;
}

export function municipalityHref(name: string, locale: string = i18n.defaultLocale): string {
  return `${localePrefix(locale)}/municipality/${encodeURIComponent(name)}`;
}

export function isMunicipality(name: string): boolean {
  return (MUNICIPALITIES as readonly string[]).includes(name);
}

/**
 * Municipality name that links to its profile page when the name is a real
 * municipality. Non-municipal scopes (Knesset votes, free-text cities,
 * missing data) render as plain text with the same className, so call sites
 * can use this unconditionally wherever a municipality name appears.
 */
export function MunicipalityLink({
  name,
  className,
  fallback,
  locale = 'he',
}: MunicipalityLinkProps) {
  if (!name) {
    return fallback ? <span className={className}>{fallback}</span> : null;
  }
  if (!isMunicipality(name)) {
    return <span className={className}>{name}</span>;
  }
  return (
    <Link
      href={municipalityHref(name, locale)}
      className={cn(
        'underline-offset-2 hover:underline focus-visible:underline',
        className
      )}
      title={locale === 'he' ? `פרופיל רשות - ${name}` : `Municipality profile - ${name}`}
    >
      {name}
    </Link>
  );
}
