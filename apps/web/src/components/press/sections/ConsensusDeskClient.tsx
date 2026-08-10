'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MUNICIPALITY_GEO, distanceKm } from '@sync/shared';
import type { MunicipalityCivicStats } from '@sync/shared/contracts';
import { NewsButton } from '@/components/press/NewsButton';
import { getStoredMunicipality, LOCALITY_EVENT } from '@/lib/locality';
import type { DeskTopic } from './DeskTopicRow';
import type { DeskCarouselControls } from './DeskCarousel';
import { DeskStream } from './DeskStream';
import { MunicipalityDock } from './MunicipalityDock';
import styles from './ConsensusDesk.module.css';
import type { Locale } from '@/lib/i18n';

export interface MunicipalityDesk {
  municipality: string;
  topics: DeskTopic[];
}

interface DeskCopy {
  kicker: string;
  headlineLead: string;
  headlineAccent: string;
  standfirst: string;
  emptyLede: string;
  emptyNote: string;
  proposeCta: string;
  carouselLabel: string;
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
    emptyLede: 'המערכת פתוחה. עדיין אין נושאים פעילים על השולחן.',
    emptyNote: 'היו הראשונים להעלות נושא לרשות שלכם.',
    proposeCta: 'הציעו נושא',
    carouselLabel: 'נושאי הקונצנזוס לפי רשות',
    ctaArrow: '←',
  },
  en: {
    kicker: 'The Local Edition · THE CIVIC DESK',
    headlineLead: 'The consensus topics,',
    headlineAccent: 'municipality by municipality.',
    standfirst:
      'What your city is voting on right now. Topics are counted in real time from the local Facebook groups.',
    emptyLede: 'The desk is open. No active topics are on the table yet.',
    emptyNote: 'Be the first to raise a topic for your municipality.',
    proposeCta: 'Propose a topic',
    carouselLabel: 'Consensus topics by municipality',
    ctaArrow: '→',
  },
};

interface ConsensusDeskClientProps {
  desks: MunicipalityDesk[];
  /** Civic stats for every municipality - what the dock's dial reads. */
  stats: MunicipalityCivicStats[];
  locale: Locale;
}

/**
 * ConsensusDeskClient - one continuous carousel of all live topics; each
 * card names its municipality (chip → profile page). The reader's stored
 * locality (GeoGate) puts their own city's topics first.
 */
export function ConsensusDeskClient({ desks, stats, locale }: ConsensusDeskClientProps) {
  const t = COPY[locale];
  const [home, setHome] = useState<string | null>(null);
  /* Which tile is at the head of the river. The dock names its municipality,
     and the dial steers the river back through this same index. */
  const [activeIndex, setActiveIndex] = useState(0);
  const carousel = useRef<DeskCarouselControls | null>(null);

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

  /* Every edition on the desk, in the order the river runs them - the dial
     leads with these before it offers the municipalities with nothing open. */
  const deskOrder = useMemo(
    () => [...new Set(entries.map((entry) => entry.municipality))],
    [entries]
  );

  /* What the desk can vouch for on its own, for municipalities the stats read
     could not answer for. */
  const deskTopicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const { municipality } of entries) {
      counts[municipality] = (counts[municipality] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

  /* Re-ordering the river (the reader's locality arrives after mount) leaves
     the old index pointing at an unrelated tile. Fall back to the head. */
  const activeMunicipality =
    entries[activeIndex]?.municipality ?? entries[0]?.municipality ?? '';

  // Stable identity: DeskCarousel takes this into the dep array of the
  // callback it subscribes to Embla with.
  const handleActiveIndex = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const travelTo = useCallback(
    (municipality: string) => {
      const index = entries.findIndex((e) => e.municipality === municipality);
      if (index < 0) return;
      // Move the readout with the reader's finger; Embla's own `select` will
      // confirm the same index a frame later.
      setActiveIndex(index);
      carousel.current?.scrollTo(index);
    },
    [entries]
  );

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
            <DeskStream
              label={t.carouselLabel}
              locale={locale}
              entries={entries}
              onActiveIndexChange={handleActiveIndex}
              controlsRef={carousel}
            />

            <MunicipalityDock
              active={activeMunicipality}
              deskOrder={deskOrder}
              deskTopicCounts={deskTopicCounts}
              stats={stats}
              home={home}
              onSelect={travelTo}
              locale={locale}
            />
          </>
        )}
      </div>
    </section>
  );
}
