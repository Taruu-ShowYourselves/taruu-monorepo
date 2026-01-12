'use client';

import { usePathname, useRouter } from 'next/navigation';
import styles from './LanguageToggle.module.css';
import type { Locale } from '@/lib/i18n';

interface LanguageToggleProps {
  locale: Locale;
}

export function LanguageToggle({ locale }: LanguageToggleProps) {
  const pathname = usePathname();
  const router = useRouter();

  const toggleLanguage = () => {
    const newLocale = locale === 'he' ? 'en' : 'he';
    // Remove current locale from pathname and add new one
    const segments = pathname.split('/');
    segments[1] = newLocale;
    const newPath = segments.join('/');

    // Set cookie for locale preference
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;

    router.push(newPath);
  };

  return (
    <button
      onClick={toggleLanguage}
      className={styles.toggle}
      aria-label={locale === 'he' ? 'Switch to English' : 'עבור לעברית'}
      title={locale === 'he' ? 'English' : 'עברית'}
    >
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <span className={styles.text}>
        {locale === 'he' ? 'English' : 'עברית'}
      </span>
    </button>
  );
}
