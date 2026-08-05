'use client';

import { useEffect, useMemo, useState } from 'react';
import { MUNICIPALITY_GEO, distanceKm } from '@sync/shared';
import { NewsButton } from '@/components/press/NewsButton';
import { getStoredMunicipality, LOCALITY_EVENT } from '@/lib/locality';
import { DeskTopicRow, slotVariant, type DeskTopic } from './DeskTopicRow';
import { DeskCarousel } from './DeskCarousel';
import styles from './ConsensusDesk.module.css';

export interface MunicipalityDesk {
  municipality: string;
  topics: DeskTopic[];
}

interface ConsensusDeskClientProps {
  desks: MunicipalityDesk[];
  locale: string;
}

/**
 * ConsensusDeskClient - one continuous carousel of all live topics; each
 * card names its municipality (chip → profile page). The reader's stored
 * locality (GeoGate) puts their own city's topics first.
 */
export function ConsensusDeskClient({ desks, locale }: ConsensusDeskClientProps) {
  const [home, setHome] = useState<string | null>(null);

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
    const byHeat = [...flat].sort(
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
    const localityScore = ({ topic, municipality }: (typeof flat)[number]) => {
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

  return (
    <section id="consensus-desk" className={styles.desk} aria-labelledby="consensus-desk-headline">
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            המהדורה המקומית · THE CIVIC DESK
          </span>

          <h2 id="consensus-desk-headline" className={styles.headline}>
            נושאי הקונצנזוס, <span className={styles.red}>רשות אחר רשות.</span>
          </h2>

          <p className={styles.standfirst}>
            מה עומד להצבעה עכשיו בעיר שלכם. הנושאים נספרים בזמן אמת מתוך קבוצות
            הפייסבוק המקומיות.
          </p>

          <span className={styles.homeChip}>
            <span aria-hidden className={styles.homeChipDot} />
            {home ? `המהדורה שלכם: ${home} והסביבה` : 'מהדורה ארצית - לפי חום'}
          </span>
        </header>

        <div className={styles.ruleHeavy} aria-hidden />

        {entries.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyLede}>
              המערכת פתוחה. עדיין אין נושאים פעילים על השולחן.
            </p>
            <p className={styles.emptyNote}>
              היו הראשונים להעלות נושא לרשות שלכם.
            </p>
            <NewsButton
              href="#act-now"
              variant="red"
              size="md"
              trailing={<span aria-hidden>←</span>}
            >
              הציעו נושא
            </NewsButton>
          </div>
        ) : (
          <>
            <DeskCarousel label="נושאי הקונצנזוס לפי רשות">
              {entries.map(({ topic, municipality, heatRank }, i) => (
                <DeskTopicRow
                  key={topic.id}
                  topic={topic}
                  municipality={municipality}
                  index={i}
                  heatRank={heatRank}
                  variant={slotVariant(i)}
                  locale={locale}
                />
              ))}
            </DeskCarousel>

            <div className={styles.deskFooter}>
              <NewsButton
                href={`/${locale}/votes`}
                variant="outline"
                size="md"
                trailing={<span aria-hidden>←</span>}
              >
                לכל הנושאים
              </NewsButton>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
