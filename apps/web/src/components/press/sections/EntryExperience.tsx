'use client';

/* PROTOTYPE — local exploration of a simplified entry experience.
 *
 * Not a new design system: every surface here is built out of the existing
 * press furniture (NewsButton, PressAutocomplete, BallotCard + BallotLane
 * over TopicDialog/ParticipationFlow) and the `--np-*` tokens. The only new
 * CSS is the layout of the first screen and the two lane cards.
 *
 * The product idea it tests: a first-time reader should see, in about three
 * seconds, that Taruu is two things — their own town and the Knesset — and
 * should be one push away from a live topic in either.
 *
 *   home → city   → (איפה אתם גרים?) → מה הכי בוער ב-X עכשיו? → participate
 *   home → knesset → על מה מצביעים עכשיו בכנסת? → participate
 *
 * Locality is the real one: `@/lib/locality` + `@sync/shared`'s
 * MUNICIPALITY_GEO / municipalityFromCoords, the same store the desks and the
 * locality desk read, so a choice made here is the choice the rest of the
 * site already respects.
 */

import { useEffect, useMemo, useState } from 'react';
import { MUNICIPALITY_GEO, municipalityFromCoords } from '@sync/shared';
import { NewsButton } from '@/components/press/NewsButton';
import {
  MuiPressProvider,
  PressAutocomplete,
} from '@/components/press/PressAutocomplete';
import {
  LOCALITY_EVENT,
  getStoredMunicipality,
  setStoredMunicipality,
} from '@/lib/locality';
import { localePrefix, type Locale } from '@/lib/i18n';
import { BallotLane } from './BallotLane';
import type { DeskEntry } from './TopicDialog';
import desk from './ConsensusDesk.module.css';
import styles from './EntryExperience.module.css';

type Lane = 'home' | 'city' | 'knesset';

interface EntryCopy {
  kicker: string;
  headlineAsk: string;
  headlineAct: string;
  lede: string;
  cityKicker: string;
  cityName: string;
  cityQuestion: string;
  cityCta: string;
  knessetKicker: string;
  knessetName: string;
  knessetQuestion: string;
  knessetCta: string;
  back: string;
  arrow: string;
  whereKicker: string;
  whereHeadline: string;
  whereLede: string;
  townLabel: string;
  townPlaceholder: string;
  locateCta: string;
  locating: string;
  quickPicks: string;
  hasTopics: (n: number) => string;
  errNoGeoSupport: string;
  errNoMatchNearby: string;
  errNoPermission: string;
  burningKicker: string;
  burningHeadline: (town: string) => string;
  burningLede: string;
  allTopics: string;
  townPage: string;
  changeTown: string;
  emptyLede: (town: string) => string;
  emptyNote: string;
  knessetDeskKicker: string;
  knessetDeskHeadline: string;
  knessetDeskLede: string;
  allAgenda: string;
  knessetEmptyLede: string;
  knessetEmptyNote: string;
  cityStreamLabel: string;
  knessetStreamLabel: string;
}

const COPY: Record<Locale, EntryCopy> = {
  he: {
    kicker: 'תַּרְאוּ · הקול האזרחי',
    headlineAsk: 'מה חשוב לכם?',
    headlineAct: 'תשפיעו.',
    lede: 'כאן אומרים מה דעתכם על מה שקורה בעיר שלכם ובכנסת — והדעה נספרת.',
    cityKicker: 'מקומי',
    cityName: 'בעיר שלי',
    cityQuestion: 'מה קורה בעיר שלי?',
    cityCta: 'לעיר שלי',
    knessetKicker: 'ארצי',
    knessetName: 'בכנסת',
    knessetQuestion: 'מה קורה בכנסת?',
    knessetCta: 'לכנסת',
    back: 'חזרה',
    arrow: '←',
    whereKicker: 'מקומי · שלב 1',
    whereHeadline: 'איפה אתם גרים?',
    whereLede: 'בחרו יישוב — וזה היישוב שתראו בכל הכניסות הבאות.',
    townLabel: 'היישוב שלכם',
    townPlaceholder: 'כתבו או בחרו יישוב…',
    locateCta: 'אתרו אותי',
    locating: 'מאתרים…',
    quickPicks: 'בחירה מהירה',
    hasTopics: (n) => `${n} נושאים פתוחים`,
    errNoGeoSupport: 'הדפדפן לא תומך באיתור מיקום. בחרו יישוב מהרשימה.',
    errNoMatchNearby: 'לא זיהינו רשות נתמכת בקרבתכם. בחרו יישוב מהרשימה.',
    errNoPermission: 'לא קיבלנו הרשאת מיקום. בחרו יישוב מהרשימה.',
    burningKicker: 'המהדורה שלכם · מקומי',
    burningHeadline: (town) => `מה הכי בוער ב${town} עכשיו?`,
    burningLede: 'שלושת הנושאים הבוערים. בחרו עמדה ישירות מהכרטיס.',
    allTopics: 'לכל הנושאים',
    townPage: 'לעמוד היישוב',
    changeTown: 'להחליף יישוב',
    emptyLede: (town) => `עדיין אין נושא פתוח ב${town}.`,
    emptyNote: 'אפשר לקרוא את מה שפתוח בשאר הארץ, או להעלות נושא ראשון.',
    knessetDeskKicker: 'המהדורה הארצית · כנסת',
    knessetDeskHeadline: 'על מה מצביעים עכשיו בכנסת?',
    knessetDeskLede: 'שלוש ההצעות שעל הפרק. בחרו עמדה ישירות מהכרטיס.',
    allAgenda: 'לכל סדר היום',
    knessetEmptyLede: 'סדר היום הבא של המליאה בדרך.',
    knessetEmptyNote: 'בינתיים אפשר לקרוא את הדסק הארצי במלואו.',
    cityStreamLabel: 'הנושאים הבוערים ביישוב שלכם',
    knessetStreamLabel: 'נושאים על סדר יום הכנסת',
  },
  en: {
    kicker: 'Taruu · the civic voice',
    headlineAsk: 'What matters to you?',
    headlineAct: 'Have your say.',
    lede: 'Say what you think about what is happening in your city and in the Knesset — and be counted.',
    cityKicker: 'Local',
    cityName: 'My city',
    cityQuestion: 'What is happening in my city?',
    cityCta: 'To my city',
    knessetKicker: 'National',
    knessetName: 'The Knesset',
    knessetQuestion: 'What is happening in the Knesset?',
    knessetCta: 'To the Knesset',
    back: 'Back',
    arrow: '→',
    whereKicker: 'Local · step 1',
    whereHeadline: 'Where do you live?',
    whereLede: 'Pick your town — that is the edition you get from now on.',
    townLabel: 'Your town',
    townPlaceholder: 'Type or pick a town…',
    locateCta: 'Detect my location',
    locating: 'Locating…',
    quickPicks: 'Quick pick',
    hasTopics: (n) => `${n} open topics`,
    errNoGeoSupport: 'Your browser does not support location. Pick a town from the list.',
    errNoMatchNearby: 'No supported municipality near you. Pick a town from the list.',
    errNoPermission: 'Location permission declined. Pick a town from the list.',
    burningKicker: 'Your edition · local',
    burningHeadline: (town) => `What is most urgent in ${town} right now?`,
    burningLede: 'The three most urgent topics. Take a position straight from the card.',
    allTopics: 'All topics',
    townPage: 'Town page',
    changeTown: 'Change town',
    emptyLede: (town) => `Nothing open in ${town} yet.`,
    emptyNote: 'Read what is open elsewhere, or raise the first topic.',
    knessetDeskKicker: 'The national edition · Knesset',
    knessetDeskHeadline: 'What is the Knesset voting on right now?',
    knessetDeskLede: 'The three bills on the table. Take a position straight from the card.',
    allAgenda: 'The full agenda',
    knessetEmptyLede: 'The next plenum agenda is on its way.',
    knessetEmptyNote: 'In the meantime, the national desk is open.',
    cityStreamLabel: 'The most urgent topics in your town',
    knessetStreamLabel: 'Topics on the Knesset agenda',
  },
};

/**
 * The lane is an editorial selection, not a list: exactly three topics, chosen
 * and standing still. The rest is one quiet click away.
 */
const TOPICS_SHOWN = 3;

interface EntryExperienceProps {
  locale: Locale;
  /** Every live municipal topic, already shaped as desk entries. */
  municipal: DeskEntry[];
  /** The Knesset print run, hottest first. */
  knesset: DeskEntry[];
}

export function EntryExperience({
  locale,
  municipal,
  knesset,
}: EntryExperienceProps) {
  const t = COPY[locale];
  const prefix = localePrefix(locale);

  const [lane, setLane] = useState<Lane>('home');
  const [home, setHome] = useState<string | null>(null);
  /* The stored choice only exists on the client, so the first paint is the
     asking state and the component settles once it has read storage. */
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  /* "Change town" reopens the picker without discarding the standing choice:
     clearing storage here would also re-order every other desk on the site
     for a reader who was only having a second look. */
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => {
      setHome(getStoredMunicipality());
      setReady(true);
    };
    apply();
    window.addEventListener(LOCALITY_EVENT, apply);
    return () => window.removeEventListener(LOCALITY_EVENT, apply);
  }, []);

  /** How many live topics each municipality is running - the picker prints it. */
  const openCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of municipal) {
      counts.set(entry.municipality, (counts.get(entry.municipality) ?? 0) + 1);
    }
    return counts;
  }, [municipal]);

  const options = useMemo(
    () =>
      [...MUNICIPALITY_GEO]
        .sort((a, b) => (openCounts.get(b.name) ?? 0) - (openCounts.get(a.name) ?? 0))
        .map((m) => {
          const open = openCounts.get(m.name) ?? 0;
          return {
            value: m.name,
            label: open > 0 ? `${m.name} · ${t.hasTopics(open)}` : m.name,
          };
        }),
    [openCounts, t]
  );

  /* Towns with something open lead the quick picks - a chip that opens an
     empty desk is a worse first push than one that opens a live topic. */
  const quickPicks = useMemo(
    () =>
      [...openCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name]) => name),
    [openCounts]
  );

  const cityEntries = useMemo(
    () =>
      home
        ? municipal
            .filter((entry) => entry.municipality === home)
            .slice(0, TOPICS_SHOWN)
        : [],
    [municipal, home]
  );

  const choose = (name: string) => {
    if (!name) return;
    setError(null);
    setPicking(false);
    setStoredMunicipality(name);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setError(t.errNoGeoSupport);
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const muni = municipalityFromCoords(pos.coords.latitude, pos.coords.longitude);
        if (muni) choose(muni.name);
        else setError(t.errNoMatchNearby);
      },
      () => {
        setLocating(false);
        setError(t.errNoPermission);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  };

  const backLink = (
    <button type="button" className={styles.back} onClick={() => setLane('home')}>
      <span aria-hidden>{locale === 'he' ? '→' : '←'}</span> {t.back}
    </button>
  );

  /* ---- The first screen ------------------------------------------------ */
  if (lane === 'home') {
    return (
      <section
        className={styles.hero}
        /* This screen IS the locality ask, so the door modal in the layout
           (GeoGate) must stay shut behind it - it suppresses itself whenever
           a page carries its own gate. */
        data-locality-gate
        aria-labelledby="entry-headline"
      >
        <div className={styles.heroInner}>
          <span className={desk.kicker}>
            <span aria-hidden className={desk.kickerTick} />
            {t.kicker}
          </span>

          <h1 id="entry-headline" className={styles.headline}>
            {t.headlineAsk}
            <br />
            <span className={desk.red}>{t.headlineAct}</span>
          </h1>

          <p className={styles.lede}>{t.lede}</p>

          <div className={styles.lanes}>
            <article className={styles.lane}>
              <span className={styles.laneKicker}>{t.cityKicker}</span>
              <h2 className={styles.laneName}>{t.cityName}</h2>
              <p className={styles.laneQuestion}>{t.cityQuestion}</p>
              <NewsButton
                variant="red"
                size="md"
                className={styles.laneCta}
                trailing={<span aria-hidden>{t.arrow}</span>}
                onClick={() => setLane('city')}
              >
                {t.cityCta}
              </NewsButton>
            </article>

            <article className={styles.lane}>
              <span className={styles.laneKicker}>{t.knessetKicker}</span>
              <h2 className={styles.laneName}>{t.knessetName}</h2>
              <p className={styles.laneQuestion}>{t.knessetQuestion}</p>
              <NewsButton
                variant="ink"
                size="md"
                className={styles.laneCta}
                trailing={<span aria-hidden>{t.arrow}</span>}
                onClick={() => setLane('knesset')}
              >
                {t.knessetCta}
              </NewsButton>
            </article>
          </div>
        </div>
      </section>
    );
  }

  /* ---- The national lane ----------------------------------------------- */
  if (lane === 'knesset') {
    return (
      <section className={desk.desk} data-locality-gate aria-labelledby="entry-knesset-headline">
        <div className={desk.inner}>
          <header className={desk.header}>
            {backLink}
            <span className={desk.kicker}>
              <span aria-hidden className={desk.kickerTick} />
              {t.knessetDeskKicker}
            </span>
            <h2 id="entry-knesset-headline" className={desk.headline}>
              {t.knessetDeskHeadline}
            </h2>
            <p className={desk.standfirst}>{t.knessetDeskLede}</p>
          </header>

          <div className={desk.ruleHeavy} aria-hidden />

          {knesset.length === 0 ? (
            <div className={desk.emptyState}>
              <p className={desk.emptyLede}>{t.knessetEmptyLede}</p>
              <p className={desk.emptyNote}>{t.knessetEmptyNote}</p>
            </div>
          ) : (
            <BallotLane entries={knesset.slice(0, TOPICS_SHOWN)} locale={locale} />
          )}

          <div className={styles.deskFooter}>
            <NewsButton
              href={`${prefix}/knesset`}
              variant="outline"
              size="md"
              trailing={<span aria-hidden>{t.arrow}</span>}
            >
              {t.allAgenda}
            </NewsButton>
          </div>
        </div>
      </section>
    );
  }

  /* ---- The local lane: ask where, then print the town's desk ------------ */
  if (!ready || !home || picking) {
    return (
      <section className={desk.desk} data-locality-gate aria-labelledby="entry-where-headline">
        <div className={desk.inner}>
          <header className={desk.header}>
            {backLink}
            <span className={desk.kicker}>
              <span aria-hidden className={desk.kickerTick} />
              {t.whereKicker}
            </span>
            <h2 id="entry-where-headline" className={desk.headline}>
              {t.whereHeadline}
            </h2>
            <p className={desk.standfirst}>{t.whereLede}</p>
          </header>

          <div className={styles.picker}>
            <MuiPressProvider>
              <PressAutocomplete
                label={t.townLabel}
                placeholder={t.townPlaceholder}
                options={options}
                value=""
                onChange={choose}
                error={error}
                locale={locale}
              />
            </MuiPressProvider>

            <NewsButton
              variant="outline"
              size="md"
              onClick={locate}
              disabled={locating}
              className={styles.locate}
            >
              {locating ? t.locating : t.locateCta}
            </NewsButton>

            <div className={styles.picks}>
              <span className={styles.picksLabel}>{t.quickPicks}</span>
              <ul className={styles.chips}>
                {quickPicks.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      className={styles.chip}
                      onClick={() => choose(name)}
                    >
                      {name}
                      <span className={styles.chipCount}>
                        {openCounts.get(name) ?? 0}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={desk.desk} data-locality-gate aria-labelledby="entry-city-headline">
      <div className={desk.inner}>
        <header className={desk.header}>
          {backLink}
          <span className={desk.kicker}>
            <span aria-hidden className={desk.kickerTick} />
            {t.burningKicker}
          </span>
          <h2 id="entry-city-headline" className={desk.headline}>
            {t.burningHeadline(home)}
          </h2>
          <p className={desk.standfirst}>{t.burningLede}</p>
        </header>

        <div className={desk.ruleHeavy} aria-hidden />

        {cityEntries.length === 0 ? (
          <div className={desk.emptyState}>
            <p className={desk.emptyLede}>{t.emptyLede(home)}</p>
            <p className={desk.emptyNote}>{t.emptyNote}</p>
          </div>
        ) : (
          <BallotLane entries={cityEntries} locale={locale} />
        )}

        <div className={styles.deskFooter}>
          <NewsButton
            href={`${prefix}/votes`}
            variant="red"
            size="md"
            trailing={<span aria-hidden>{t.arrow}</span>}
          >
            {t.allTopics}
          </NewsButton>
          <NewsButton
            href={`${prefix}/municipality/${encodeURIComponent(home)}`}
            variant="outline"
            size="md"
          >
            {t.townPage}
          </NewsButton>
          <button
            type="button"
            className={styles.textLink}
            onClick={() => {
              setPicking(true);
              setError(null);
            }}
          >
            {t.changeTown}
          </button>
        </div>
      </div>
    </section>
  );
}
