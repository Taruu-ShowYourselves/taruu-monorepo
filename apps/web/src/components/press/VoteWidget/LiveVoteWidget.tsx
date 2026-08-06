'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { KNESSET_SCOPE, WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import {
  isMunicipality,
  municipalityHref,
} from '@/components/uikit/municipality-link';
import { localePrefix } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n';
import { useReducedMotion } from '@/hooks';
import { NewsButton } from '@/components/press/NewsButton';
import { VoteWidget } from './VoteWidget';
import styles from './VoteWidget.module.css';

interface LiveVoteWidgetCopy {
  verifiedCountOf: (count: number) => string;
  noVotesYet: string;
  skeletonAria: string;
  skeletonKicker: string;
  dispatchAria: string;
  dispatchKicker: string;
  dispatchPlace: string;
  issueSuffixOf: (issueNo: string) => string;
  dispatchQuestion: string;
  dispatchText: string;
  dispatchCta: string;
  arrow: string;
  metaVerified: string;
  metaSigned: string;
  metaForgeryProof: string;
}

const COPY: Record<Locale, LiveVoteWidgetCopy> = {
  he: {
    verifiedCountOf: (count) => `${count.toLocaleString('he-IL')} קולות מאומתים`,
    noVotesYet: 'עדיין אין קולות - היו ראשונים',
    skeletonAria: 'טוען הצבעה',
    skeletonKicker: 'הצבעה חיה',
    dispatchAria: 'ההצבעות נפתחות בקרוב',
    dispatchKicker: 'נפתחים בקרוב',
    dispatchPlace: 'ישראל',
    issueSuffixOf: (issueNo) => ` · גיליון ${issueNo}`,
    dispatchQuestion: 'ההצבעה הראשונה נפתחת ב־04.08.26.',
    dispatchText:
      'בכל הארץ בבת אחת. הצטרפו לקבוצת המייסדים כדי לקבל עדכון ברגע שהקלפי נפתחת.',
    dispatchCta: 'קבוצת המייסדים',
    arrow: '←',
    metaVerified: 'מאומת · זהות + GPS',
    metaSigned: 'חתום בבלוקצ׳יין',
    metaForgeryProof: 'בלתי ניתן לזיוף',
  },
  en: {
    verifiedCountOf: (count) => `${count.toLocaleString('en-US')} verified votes`,
    noVotesYet: 'No votes yet - be the first',
    skeletonAria: 'Loading vote',
    skeletonKicker: 'Live vote',
    dispatchAria: 'Voting opens soon',
    dispatchKicker: 'Opening soon',
    dispatchPlace: 'Israel',
    issueSuffixOf: (issueNo) => ` · Issue ${issueNo}`,
    dispatchQuestion: 'The first vote opens on 04.08.26.',
    dispatchText:
      'Across the country, all at once. Join the founders group to be notified the moment the ballot box opens.',
    dispatchCta: 'The founders group',
    arrow: '→',
    metaVerified: 'Verified · identity + GPS',
    metaSigned: 'Signed on the blockchain',
    metaForgeryProof: 'Tamper-proof',
  },
};

interface ApiVoteOption {
  id: string;
  label: string;
  voteCount: number;
}

interface ApiVote {
  id: string;
  title: string;
  municipality: string;
  status: string;
  participantCount: number;
  options: ApiVoteOption[];
}

/** How long each vote holds the front page before rotating. */
const ROTATE_MS = 8000;
/** Rotation pool cap - most voted first, one per municipality first. */
const MAX_ROTATION = 6;

/** Total ballots cast - the ranking signal. */
function totalVotes(vote: ApiVote): number {
  return vote.options.reduce((sum, o) => sum + o.voteCount, 0);
}

/**
 * Top-ranked rotation, spread across municipalities: most voted first
 * (zero-tally votes rank last but still show - real ballots, honest zeros),
 * and each municipality contributes its single top vote before any
 * municipality repeats.
 */
function pickRotation(votes: ApiVote[]): ApiVote[] {
  const ranked = [...votes].sort((a, b) => totalVotes(b) - totalVotes(a));
  const seen = new Set<string>();
  const primary: ApiVote[] = [];
  const rest: ApiVote[] = [];
  for (const vote of ranked) {
    if (seen.has(vote.municipality)) {
      rest.push(vote);
    } else {
      seen.add(vote.municipality);
      primary.push(vote);
    }
  }
  return [...primary, ...rest].slice(0, MAX_ROTATION);
}

function toWidgetOptions(vote: ApiVote) {
  const total = vote.options.reduce((sum, o) => sum + o.voteCount, 0);
  return vote.options.map((o) => ({
    id: o.id,
    label: o.label,
    count: o.voteCount,
    pct: total > 0 ? Math.round((o.voteCount / total) * 100) : 0,
  }));
}

interface LiveVoteWidgetProps {
  /** Editorial issue number passed through to the widget header. */
  issueNo?: string;
  locale?: Locale;
}

/**
 * LiveVoteWidget - the front-page ballot wired to real data. Fetches active
 * votes, ranks them (most ballots cast, one per municipality first), and
 * rotates them endlessly: each ballot sweeps in from the right and slides out
 * to the left, vanishing behind the column rule. Tapping an option pauses the
 * rotation so the ballot is never yanked mid-interaction. While fetching it
 * shows a press skeleton; with no open votes it shows the pre-launch dispatch.
 */
export function LiveVoteWidget({ issueNo, locale = 'he' }: LiveVoteWidgetProps) {
  const t = COPY[locale];
  const reduced = useReducedMotion();
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [rotation, setRotation] = useState<ApiVote[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/votes?status=active&include=options')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { votes?: ApiVote[] } | null) => {
        if (cancelled) return;
        const eligible = (data?.votes ?? []).filter(
          (v) => v.status === 'active' && (v.options?.length ?? 0) >= 2
        );
        setRotation(pickRotation(eligible));
        setStatus('ready');
      })
      .catch(() => {
        // network/DB unavailable - show the pre-launch dispatch, not fake data
        if (!cancelled) setStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (paused || rotation.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % rotation.length),
      ROTATE_MS
    );
    return () => clearInterval(timer);
  }, [paused, rotation.length]);

  const vote = rotation[index] ?? null;

  if (!vote) {
    return status === 'loading' ? (
      <BallotSkeleton locale={locale} />
    ) : (
      <PreLaunchDispatch issueNo={issueNo} locale={locale} />
    );
  }

  return (
    <div className={styles.carousel}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={vote.id}
          initial={reduced ? false : { x: '110%' }}
          animate={reduced ? { opacity: 1 } : { x: 0 }}
          exit={reduced ? { opacity: 0 } : { x: '-110%' }}
          transition={{ duration: reduced ? 0 : 0.6, ease: [0.2, 0, 0, 1] }}
        >
          <VoteWidget
            place={null}
            municipality={vote.municipality}
            municipalityHref={
              isMunicipality(vote.municipality)
                ? municipalityHref(vote.municipality, locale)
                : vote.municipality === KNESSET_SCOPE
                  ? `${localePrefix(locale)}/knesset`
                  : undefined
            }
            question={vote.title}
            options={toWidgetOptions(vote)}
            totalLabel={
              vote.participantCount > 0
                ? t.verifiedCountOf(vote.participantCount)
                : t.noVotesYet
            }
            href={`${localePrefix(locale)}/votes/${vote.id}`}
            issueNo={issueNo}
            onSelectOption={() => setPaused(true)}
            locale={locale}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Press skeleton shown while the ballot fetch is in flight. */
function BallotSkeleton({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <section className={styles.widget} aria-busy="true" aria-label={t.skeletonAria}>
      <header className={styles.head}>
        <span className={styles.kicker}>
          <span className={styles.live} aria-hidden />
          {t.skeletonKicker}
        </span>
      </header>
      <div className={styles.skel}>
        <span className={`${styles.skelLine} ${styles.skelTitle}`} />
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className={`${styles.skelLine} ${styles.skelOption}`} />
        ))}
        <span className={`${styles.skelLine} ${styles.skelCta}`} />
      </div>
    </section>
  );
}

/** No open votes yet - the honest pre-launch dispatch with the founders CTA. */
function PreLaunchDispatch({ issueNo, locale }: { issueNo?: string; locale: Locale }) {
  const t = COPY[locale];
  return (
    <section className={styles.widget} aria-label={t.dispatchAria}>
      <header className={styles.head}>
        <span className={styles.kicker}>
          <span className={styles.live} aria-hidden />
          {t.dispatchKicker}
        </span>
        <span className={styles.place}>
          {t.dispatchPlace}
          {issueNo ? t.issueSuffixOf(issueNo) : ''}
        </span>
      </header>

      <h3 className={styles.question}>{t.dispatchQuestion}</h3>

      <p className={styles.dispatchText}>{t.dispatchText}</p>

      <div className={styles.actions}>
        <NewsButton
          href={WHATSAPP_FOUNDERS_LINK}
          target="_blank"
          rel="noopener noreferrer"
          variant="red"
          size="lg"
          trailing={<span aria-hidden>{t.arrow}</span>}
        >
          {t.dispatchCta}
        </NewsButton>
      </div>

      <footer className={styles.meta}>
        <span>{t.metaVerified}</span>
        <span className={styles.sep} aria-hidden>■</span>
        <span>{t.metaSigned}</span>
        <span className={styles.sep} aria-hidden>■</span>
        <span>{t.metaForgeryProof}</span>
      </footer>
    </section>
  );
}
