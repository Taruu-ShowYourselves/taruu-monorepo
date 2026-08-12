'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { NewsButton } from '@/components/press/NewsButton';
import { useParallaxBackdrop } from '@/hooks';
import { localePrefix, type Locale } from '@/lib/i18n';
import styles from './HowToJoin.module.css';

/** One live topic, reduced to what a blurred backdrop tile can carry. */
interface JoinTile {
  id: string;
  title: string;
  municipality: string;
  participantCount: number;
}

/**
 * The live desk, as this section's backdrop.
 *
 * The section itself is copy with no data behind it, so rather than draw
 * invented cards it asks the same endpoint the desks read and shows real
 * topics - blurred back far enough to be texture, but true. A failed read
 * simply leaves the paper bare, which is what it looks like today.
 */
function useJoinTiles(): JoinTile[] {
  const [tiles, setTiles] = useState<JoinTile[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/votes?status=active');
        if (!res.ok) return;
        const data = (await res.json()) as { votes?: JoinTile[] };
        if (live && Array.isArray(data.votes)) setTiles(data.votes.slice(0, 4));
      } catch {
        /* Backdrop only - nothing here is worth an error state. */
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return tiles;
}

interface HowToJoinProps {
  locale?: Locale;
}

interface JoinRoute {
  index: string;
  label: string;
  body: string;
  /** Where this route actually starts, as a locale-relative path segment. */
  href: string;
  cta: string;
}

interface HowToJoinCopy {
  kicker: string;
  headline: string;
  standfirst: string;
  primaryCta: string;
  secondaryCta: string;
  routes: readonly JoinRoute[];
}

/**
 * The ask, and only the ask. The intro states what Taruu is and what it can
 * compel; the two desks show what is actually open in the reader's town and in
 * the Knesset. This is the beat after both - by the time a resident reaches it
 * they have seen the thing they would be joining, which is the only point at
 * which "how do I take part" is a real question rather than a pitch.
 */
const COPY: Record<Locale, HowToJoinCopy> = {
  he: {
    // Not the headline again: the kicker names the desk, the headline asks
    // the question.
    kicker: 'להשתתף · JOIN',
    headline: 'כיצד משתתפים?',
    standfirst:
      'תַּרְאוּ מקשיבה למה שכבר נאמר בקבוצות התושבים, ומנגישה אותו כהצבעה. שלוש דרכים להיכנס:',
    primaryCta: 'להתחבר ולהצביע',
    secondaryCta: 'מהי תַּרְאוּ?',
    routes: [
      {
        index: '01',
        label: 'להצביע בהצבעות הפתוחות',
        body: 'הצבעות מאומתות ביישוב שלכם: קול אחד לכל תושב, ותוצאה שנשארת מתועדת גם אחרי הבחירות.',
        href: 'feed',
        cta: 'לראות מה פתוח עכשיו',
      },
      {
        index: '02',
        label: 'להעלות הצבעה מהכנסת',
        body: 'כל סעיף שעולה במליאה יכול להיפתח כאן להצבעה אזרחית - אתם בוחרים עמדה, והמנדט הציבורי נמדד מול איך שהצביעו בפועל.',
        href: 'knesset',
        cta: 'לסדר היום של הכנסת',
      },
      {
        index: '03',
        label: 'לפתוח הצבעה משלכם',
        body: 'בתשלום סמלי אפשר להעלות נושא לכלל התושבים - או לדרוש שהכנסת תעסוק בו. הנושא עולה מכם, לא מחבר כנסת.',
        href: 'votes/create',
        cta: 'להעלות הצבעה',
      },
    ],
  },
  en: {
    kicker: 'JOIN',
    headline: 'How do you take part?',
    standfirst:
      'Taruu listens to what residents already say to each other, and opens it as a ballot. Three ways in:',
    primaryCta: 'Sign in and vote',
    secondaryCta: 'What is Taruu?',
    routes: [
      {
        index: '01',
        label: 'Vote on what is open',
        body: 'Verified ballots in your own town: one voice per resident, and a result that stays on the record after the election.',
        href: 'feed',
        cta: 'See what is open now',
      },
      {
        index: '02',
        label: 'Raise a Knesset vote',
        body: 'Any item on the plenum floor can open here as a civic ballot - you take a position, and the public mandate is measured against how they actually voted.',
        href: 'knesset',
        cta: 'To the Knesset agenda',
      },
      {
        index: '03',
        label: 'Open a ballot of your own',
        body: 'For a symbolic fee you can put an issue to every resident - or demand the Knesset take it up. The subject comes from you, not from a member.',
        href: 'votes/create',
        cta: 'Raise a ballot',
      },
    ],
  },
};

export function HowToJoin({ locale = 'he' }: HowToJoinProps) {
  const t = COPY[locale];
  // Matches CivicReminder's drift: the two sit back to back at the foot of the
  // page and a heavier parallax here would read as the pair sliding apart.
  const sectionRef = useParallaxBackdrop<HTMLElement>({ back: -0.04, fore: 0.1 });
  const tiles = useJoinTiles();
  // The glyph points the way the language reads.
  const arrow = locale === 'he' ? '←' : '→';

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="how-to-join-headline"
    >
      {/* The bare half of this spread is the backdrop's, not the copy's: the
          two routes sit on the reading side and everything below them was
          empty paper. */}
      {tiles.length > 0 && (
        <div className={styles.joinTiles} aria-hidden>
          {tiles.map((tile, index) => (
            <article className={styles.joinTile} data-slot={index} key={tile.id}>
              <span className={styles.joinTileMuni}>{tile.municipality}</span>
              <h3 className={styles.joinTileTitle}>{tile.title}</h3>
            </article>
          ))}
        </div>
      )}

      <div className={styles.inner}>
        <header className={styles.lead}>
          <span className={styles.kicker}>{t.kicker}</span>
          <h2 id="how-to-join-headline" className={styles.headline}>
            {t.headline}
          </h2>
          <p className={styles.standfirst}>{t.standfirst}</p>

          <div className={styles.leadActions}>
            <NewsButton
              href={`${localePrefix(locale)}/sign-up`}
              variant="red"
              size="md"
              trailing={<span aria-hidden>{arrow}</span>}
            >
              {t.primaryCta}
            </NewsButton>
            <Link
              href={`${localePrefix(locale)}/what-is-taruu`}
              className={styles.leadQuiet}
            >
              {t.secondaryCta}
            </Link>
          </div>
        </header>

        {/* Each route ends in the door it describes - the section used to
            explain three ways in and offer none of them. */}
        <ol className={styles.routes}>
          {t.routes.map((route) => (
            <li className={styles.route} key={route.index}>
              <span className={styles.routeIndex} aria-hidden>
                {route.index}
              </span>
              <h3 className={styles.routeLabel}>{route.label}</h3>
              <p className={styles.routeBody}>{route.body}</p>
              <Link
                href={`${localePrefix(locale)}/${route.href}`}
                className={styles.routeCta}
              >
                {route.cta}
                <span aria-hidden>{arrow}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
