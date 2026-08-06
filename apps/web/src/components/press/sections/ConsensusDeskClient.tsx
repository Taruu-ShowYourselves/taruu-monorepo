'use client';

import { useEffect, useMemo, useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { MUNICIPALITY_GEO, distanceKm } from '@sync/shared';
import { NewsButton } from '@/components/press/NewsButton';
import { getStoredMunicipality, LOCALITY_EVENT } from '@/lib/locality';
import { useAuth } from '@/providers/AuthProvider';
import { submitParticipation } from '@/app/[locale]/votes/[id]/flow/submitParticipation';
import { DeskTopicRow, slotVariant, type DeskTopic } from './DeskTopicRow';
import { DeskCarousel } from './DeskCarousel';
import styles from './ConsensusDesk.module.css';
import { localePrefix, type Locale } from '@/lib/i18n';

export interface MunicipalityDesk {
  municipality: string;
  topics: DeskTopic[];
}

interface DeskCopy {
  kicker: string;
  headlineLead: string;
  headlineAccent: string;
  standfirst: string;
  homeChip: (home: string) => string;
  nationalChip: string;
  emptyLede: string;
  emptyNote: string;
  proposeCta: string;
  carouselLabel: string;
  allTopicsCta: string;
  quickVote: string;
  chooseOption: string;
  castVote: string;
  casting: string;
  close: string;
  /** Direction-semantic CTA glyph: mirrored between RTL and LTR. */
  ctaArrow: string;
}

const COPY: Record<Locale, DeskCopy> = {
  he: {
    kicker: 'המהדורה המקומית · THE CIVIC DESK',
    headlineLead: 'נושאי הקונצנזוס,',
    headlineAccent: 'רשות אחר רשות.',
    standfirst:
      'מה עומד להצבעה עכשיו בעיר שלכם. הנושאים נספרים בזמן אמת מתוך קבוצות הפייסבוק המקומיות.',
    homeChip: (home) => `המהדורה שלכם: ${home} והסביבה`,
    nationalChip: 'מהדורה ארצית - לפי חום',
    emptyLede: 'המערכת פתוחה. עדיין אין נושאים פעילים על השולחן.',
    emptyNote: 'היו הראשונים להעלות נושא לרשות שלכם.',
    proposeCta: 'הציעו נושא',
    carouselLabel: 'נושאי הקונצנזוס לפי רשות',
    allTopicsCta: 'לכל הנושאים',
    quickVote: 'הצבעה מהירה',
    chooseOption: 'בחרו עמדה כדי להצביע',
    castVote: 'הצביעו',
    casting: 'רושמים את הקול…',
    close: 'סגירה',
    ctaArrow: '←',
  },
  en: {
    kicker: 'The Local Edition · THE CIVIC DESK',
    headlineLead: 'The consensus topics,',
    headlineAccent: 'municipality by municipality.',
    standfirst:
      'What your city is voting on right now. Topics are counted in real time from the local Facebook groups.',
    homeChip: (home) => `Your edition: ${home} and the surrounding area`,
    nationalChip: 'National edition - by heat',
    emptyLede: 'The desk is open. No active topics are on the table yet.',
    emptyNote: 'Be the first to raise a topic for your municipality.',
    proposeCta: 'Propose a topic',
    carouselLabel: 'Consensus topics by municipality',
    allTopicsCta: 'All topics',
    quickVote: 'Quick vote',
    chooseOption: 'Choose a position to vote',
    castVote: 'Cast vote',
    casting: 'Recording your vote…',
    close: 'Close',
    ctaArrow: '→',
  },
};

interface ConsensusDeskClientProps {
  desks: MunicipalityDesk[];
  locale: Locale;
}

/**
 * ConsensusDeskClient - one continuous carousel of all live topics; each
 * card names its municipality (chip → profile page). The reader's stored
 * locality (GeoGate) puts their own city's topics first.
 */
export function ConsensusDeskClient({ desks, locale }: ConsensusDeskClientProps) {
  const t = COPY[locale];
  const { isAuthenticated } = useAuth();
  const [home, setHome] = useState<string | null>(null);
  const [openTopic, setOpenTopic] = useState<DeskTopic | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => setHome(getStoredMunicipality());
    apply();
    window.addEventListener(LOCALITY_EVENT, apply);
    return () => window.removeEventListener(LOCALITY_EVENT, apply);
  }, []);

  // Single stream of cards. heatRank is the pure country-wide heat position
  // (the badge); display order blends heat with distance from the reader's
  // municipality - home first, then surroundings (e.g. a קריית טבעון reader
  // sees the עמק before תל אביב), fading to national heat with no locality.
  const entries = useMemo(() => {
    const flat = desks.flatMap((desk) =>
      desk.topics.map((topic) => ({ topic, municipality: desk.municipality }))
    );
    const unique = [...new Map(flat.map((entry) => [entry.topic.id, entry])).values()];
    const byHeat = [...unique].sort(
      (a, b) => (b.topic.source?.hotness ?? -1) - (a.topic.source?.hotness ?? -1)
    );
    const heatRank = new Map<string, number>();
    byHeat.forEach(({ topic }, i) => {
      if (topic.source) heatRank.set(topic.id, i + 1);
    });

    const geoByName = new Map(MUNICIPALITY_GEO.map((m) => [m.name, m]));
    const homeGeo = home ? geoByName.get(home) : undefined;
    // ~0.7 heat points per km: a topic 20km away needs +14 heat to outrank a
    // local one; 100km away it effectively drops to the national tail.
    const KM_WEIGHT = 0.7;
    const UNKNOWN_PENALTY = 40;
    const localityScore = ({ topic, municipality }: (typeof unique)[number]) => {
      const heat = topic.source?.hotness ?? 0;
      if (!homeGeo) return heat;
      if (municipality === home) return heat + 1000;
      const geo = geoByName.get(municipality);
      const penalty = geo
        ? distanceKm(homeGeo.lat, homeGeo.lng, geo.lat, geo.lng) * KM_WEIGHT
        : UNKNOWN_PENALTY;
      return heat - penalty;
    };

    return [...byHeat]
      .sort((a, b) => localityScore(b) - localityScore(a))
      .map((e) => ({ ...e, heatRank: heatRank.get(e.topic.id) }));
  }, [desks, home]);

  const openQuickVote = (topic: DeskTopic) => {
    if (!isAuthenticated) {
      window.location.assign(`${localePrefix(locale)}/votes/${topic.id}`);
      return;
    }
    setSelectedOption(null);
    setMessage(null);
    setOpenTopic(topic);
  };

  const castVote = async () => {
    if (!openTopic || !selectedOption || submitting) return;
    setSubmitting(true);
    setMessage(null);
    const result = await submitParticipation({ voteId: openTopic.id, optionId: selectedOption, locale });
    setSubmitting(false);
    setMessage(
      result.status === 'recorded'
        ? locale === 'he'
          ? 'הקול נרשם.'
          : 'Your vote is recorded.'
        : result.message
    );
  };

  return (
    <section
      id="consensus-desk"
      data-nav-reveal
      className={styles.desk}
      aria-labelledby="consensus-desk-headline"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>

          <h2 id="consensus-desk-headline" className={styles.headline}>
            {t.headlineLead} <span className={styles.red}>{t.headlineAccent}</span>
          </h2>

          <p className={styles.standfirst}>{t.standfirst}</p>

          <span className={styles.homeChip}>
            <span aria-hidden className={styles.homeChipDot} />
            {home ? t.homeChip(home) : t.nationalChip}
          </span>
        </header>

        <div className={styles.ruleHeavy} aria-hidden />

        {entries.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyLede}>{t.emptyLede}</p>
            <p className={styles.emptyNote}>{t.emptyNote}</p>
            <NewsButton
              href="#act-now"
              variant="red"
              size="md"
              trailing={<span aria-hidden>{t.ctaArrow}</span>}
            >
              {t.proposeCta}
            </NewsButton>
          </div>
        ) : (
          <>
            <DeskCarousel label={t.carouselLabel} locale={locale}>
              {entries.map(({ topic, municipality, heatRank }, i) => (
                <DeskTopicRow
                  key={topic.id}
                  topic={topic}
                  municipality={municipality}
                  index={i}
                  heatRank={heatRank}
                  variant={slotVariant(i)}
                  onOpen={openQuickVote}
                  locale={locale}
                />
              ))}
            </DeskCarousel>

            <div className={styles.deskFooter}>
              <NewsButton
                href={`${localePrefix(locale)}/votes`}
                variant="outline"
                size="md"
                trailing={<span aria-hidden>{t.ctaArrow}</span>}
              >
                {t.allTopicsCta}
              </NewsButton>
            </div>
          </>
        )}
      </div>

      <AlertDialog.Root open={openTopic !== null} onOpenChange={(open) => !open && setOpenTopic(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={styles.quickVoteBackdrop} />
          <AlertDialog.Content className={styles.quickVoteDialog}>
            {openTopic ? (
              <>
                <span className={styles.quickVoteKicker}>{t.quickVote}</span>
                <AlertDialog.Title className={styles.quickVoteTitle}>{openTopic.title}</AlertDialog.Title>
                <AlertDialog.Description className={styles.quickVoteDescription}>
                  {openTopic.description}
                </AlertDialog.Description>
                <fieldset className={styles.quickVoteOptions}>
                  <legend>{t.chooseOption}</legend>
                  {openTopic.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={selectedOption === option.id ? styles.quickVoteOptionSelected : styles.quickVoteOption}
                      onClick={() => setSelectedOption(option.id)}
                      aria-pressed={selectedOption === option.id}
                    >
                      {option.text} <span>{option.pct}%</span>
                    </button>
                  ))}
                </fieldset>
                {message ? <p className={styles.quickVoteMessage} role="status">{message}</p> : null}
                <div className={styles.quickVoteActions}>
                  <NewsButton variant="red" size="md" onClick={castVote} disabled={!selectedOption || submitting}>
                    {submitting ? t.casting : t.castVote}
                  </NewsButton>
                  <AlertDialog.Cancel asChild>
                    <NewsButton variant="outline" size="md">{t.close}</NewsButton>
                  </AlertDialog.Cancel>
                </div>
              </>
            ) : null}
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
