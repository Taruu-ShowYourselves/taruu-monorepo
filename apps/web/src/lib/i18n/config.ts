// Hebrew is the default locale and is served unprefixed at the root
// (taruu.co.il/votes). Every other locale keeps its prefix (taruu.co.il/en/votes).
// The middleware rewrites bare paths to /he internally and 301s any visible
// /he prefix back to the bare path, so /he never appears in the address bar.
export const i18n = {
  defaultLocale: 'he',
  locales: ['he', 'en'],
} as const;

export type Locale = 'he' | 'en';

/**
 * URL prefix for a locale: '' for the default (unprefixed) locale,
 * '/<locale>' for the rest. Use inside template literals when composing
 * a longer path: `${localePrefix(locale)}/votes`. Takes `string` because
 * route params surface the locale untyped throughout the app.
 */
export function localePrefix(locale: string): string {
  return locale === i18n.defaultLocale ? '' : `/${locale}`;
}

/**
 * Complete href for a route in a locale. With no path (or '/') it returns
 * the locale's home: '/' for the default locale, '/en' for English.
 */
export function localePath(locale: string, path = '/'): string {
  return `${localePrefix(locale)}${path === '/' ? '' : path}` || '/';
}

/**
 * Same page, other locale — for the language switcher. Strips whatever
 * locale prefix the current pathname carries (the default locale carries
 * none) and re-roots the bare path in the target locale.
 */
export function localeSwitchPath(pathname: string, target: Locale): string {
  let bare = pathname;
  for (const l of i18n.locales) {
    if (bare === `/${l}` || bare.startsWith(`/${l}/`)) {
      bare = bare.slice(l.length + 1) || '/';
      break;
    }
  }
  return localePath(target, bare);
}

export const localeNames: Record<Locale, string> = {
  he: 'עברית',
  en: 'English',
};

export const localeDirections: Record<Locale, 'rtl' | 'ltr'> = {
  he: 'rtl',
  en: 'ltr',
};
