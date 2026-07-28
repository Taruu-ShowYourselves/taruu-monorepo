'use client';

import { useEffect, useMemo, useState } from 'react';
import { NewsButton } from '@/components/press/NewsButton';
import {
  isMunicipality,
  municipalityHref,
} from '@/components/uikit/municipality-link';
import { getStoredMunicipality, LOCALITY_EVENT } from '@/lib/locality';
import { DeskTopicRow, type DeskTopic } from './DeskTopicRow';
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
 * ConsensusDeskClient — municipality tabs styled as regional edition
 * mastheads; each topic is an index entry with live consensus meters and
 * the engagement heat of its source posts. The reader's stored locality
 * (GeoGate) opens their own board first.
 */
export function ConsensusDeskClient({ desks, locale }: ConsensusDeskClientProps) {
  const [home, setHome] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => setHome(getStoredMunicipality());
    apply();
    window.addEventListener(LOCALITY_EVENT, apply);
    return () => window.removeEventListener(LOCALITY_EVENT, apply);
  }, []);

  // Reader's municipality first, then the rest in server order.
  const ordered = useMemo(() => {
    if (!home) return desks;
    const mine = desks.find((d) => d.municipality === home);
    if (!mine) return desks;
    return [mine, ...desks.filter((d) => d.municipality !== home)];
  }, [desks, home]);

  const [selected, setSelected] = useState(desks[0]?.municipality ?? '');

  useEffect(() => {
    if (home && desks.some((d) => d.municipality === home)) {
      setSelected(home);
    }
  }, [home, desks]);

  const activeDesk = ordered.find((d) => d.municipality === selected);

  return (
    <section id="consensus-desk" className={styles.desk} aria-labelledby="consensus-desk-headline">
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            המהדורה המקומית · THE CIVIC DESK
          </span>

          <h2 id="consensus-desk-headline" className={styles.headline}>
            נושאי הקונצנזוס — <span className={styles.red}>רשות אחר רשות.</span>
          </h2>

          <p className={styles.standfirst}>
            מה עומד להצבעה עכשיו בעיר שלכם. כל נושא נספר בזמן אמת, קול אחר קול —
            בחרו רשות וראו את מפת הקונצנזוס שלה.
          </p>
        </header>

        <div className={styles.ruleHeavy} aria-hidden />

        {desks.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyLede}>
              המערכת פתוחה — עדיין אין נושאים פעילים על השולחן.
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
            {/* Municipality picker — regional edition tabs */}
            <div className={styles.editions} role="tablist" aria-label="בחירת רשות">
              {ordered.map((desk) => {
                const isActive = desk.municipality === selected;
                const isHome = desk.municipality === home;
                return (
                  <button
                    key={desk.municipality}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.edition} ${isActive ? styles.editionActive : ''}`}
                    onClick={() => setSelected(desk.municipality)}
                  >
                    {isHome ? (
                      <span className={styles.homeMark} aria-label="הרשות שלי" title="הרשות שלי">
                        ●
                      </span>
                    ) : null}
                    <span className={styles.editionName}>{desk.municipality}</span>
                    <span className={styles.editionCount}>{desk.topics.length}</span>
                  </button>
                );
              })}
            </div>

            {/* Topic carousel for the selected municipality */}
            {activeDesk && (
              <DeskCarousel label={`נושאים ב${activeDesk.municipality}`}>
                {activeDesk.topics.map((topic, i) => (
                  <DeskTopicRow key={topic.id} topic={topic} index={i} locale={locale} />
                ))}
              </DeskCarousel>
            )}

            <div className={styles.deskFooter}>
              {activeDesk && isMunicipality(activeDesk.municipality) ? (
                <NewsButton
                  href={municipalityHref(activeDesk.municipality)}
                  variant="outline"
                  size="md"
                  trailing={<span aria-hidden>←</span>}
                >
                  פרופיל {activeDesk.municipality}
                </NewsButton>
              ) : null}
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
