'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  MUNICIPALITY_GEO,
  municipalityFromCoords,
  municipalityFromText,
} from '@sync/shared';
import { NewsButton } from '@/components/press/NewsButton';
import { chime, primeChime } from '@/lib/feedback/chime';
import type { Locale } from '@/lib/i18n';
import {
  LOCALITY_EVENT,
  clearStoredMunicipality,
  getStoredMunicipality,
  setStoredMunicipality,
} from '@/lib/locality';
import styles from './LocalityDesk.module.css';

/**
 * The locality desk - where the reader says which edition they are reading.
 *
 * This was a modal that met people at the door, then a centered stack of
 * form controls. Both were the wrong shape. It is now an editorial column
 * and an instrument panel side by side: the ask reads like the paper, and
 * the answer happens on a boxed sheet sitting on the desk - the same
 * desk-and-sheet pairing the tokens define for exactly this.
 *
 * It sits where its effect is visible: the municipal river above it
 * re-orders the moment a town is chosen (both desks listen for
 * LOCALITY_EVENT), and it prints the standing choice, so changing it is a
 * control rather than a second visit.
 */

type Mode = 'settled' | 'choosing' | 'locating' | 'confirm';

/** The dock's own easing constant, as framer-motion spells it. */
const NP_EASE = 'cubicBezier(0.2, 0, 0, 1)';

interface LocalityDeskCopy {
  kicker: string;
  askHeadline: string;
  askLede: string;
  settledKicker: string;
  settledLede: string;
  settledNote: string;
  allKicker: string;
  allHeadline: string;
  allLede: string;
  change: string;
  readAll: string;
  privacy: string;
  confirmLede: string;
  confirmAsk: string;
  confirmYes: string;
  confirmGlyph: string;
  confirmNo: string;
  locateCta: string;
  locating: string;
  or: string;
  townLabel: string;
  townPlaceholder: string;
  openBoard: string;
  matchPrefix: string;
  cancel: string;
  quickPicksLabel: string;
  errNoGeoSupport: string;
  errNoMatchNearby: string;
  errNoPermission: string;
  errNoTextMatch: string;
}

const COPY: Record<Locale, LocalityDeskCopy> = {
  he: {
    kicker: 'מקומי קודם · LOCAL FIRST',
    askHeadline: 'איזו מהדורה נפתח לכם?',
    askLede:
      'תַּרְאוּ נכתבת יישוב-יישוב: כל נושא, כל הצבעה וכל שקל שייכים לרשות אחת. בחרו את שלכם - וזו המהדורה שתקבלו.',
    settledKicker: 'המהדורה שלכם · YOUR EDITION',
    settledLede: 'המהדורה של',
    settledNote:
      'כל מה שמעל שייך ליישוב הזה. מתחת ממשיכה המהדורה הארצית - סדר היום של הכנסת, שנוגע לכל הרשויות.',
    allKicker: 'כל הרשויות · ALL AUTHORITIES',
    allHeadline: 'אתם קוראים את כל הארץ',
    allLede:
      'הנושאים שמעל מסודרים לפי חום ציבורי בכל הרשויות. בחרו יישוב כדי להעלות את שלו לראש המהדורה.',
    change: 'להחליף יישוב',
    readAll: 'לקרוא את כל הארץ',
    privacy: 'המיקום נשאר במכשיר. לא נשלח לשרת, לא נשמר אצלנו.',
    confirmLede: 'נראה שאתם ליד',
    confirmAsk: 'זה היישוב שלכם?',
    confirmYes: 'כן, זו המהדורה שלי',
    confirmGlyph: '←',
    confirmNo: 'לא, אכתוב בעצמי',
    locateCta: 'אתרו אותי',
    locating: 'מאתרים…',
    or: 'או',
    townLabel: 'שם היישוב',
    townPlaceholder: 'כתבו את שם היישוב…',
    openBoard: 'פתחו את המהדורה',
    matchPrefix: 'נמצא:',
    cancel: 'ביטול',
    quickPicksLabel: 'בחירה מהירה של יישוב',
    errNoGeoSupport: 'הדפדפן לא תומך באיתור מיקום. כתבו את שם היישוב.',
    errNoMatchNearby: 'לא זיהינו רשות נתמכת בקרבתכם. כתבו את שם היישוב.',
    errNoPermission: 'לא קיבלנו הרשאת מיקום. כתבו את שם היישוב במקום.',
    errNoTextMatch: 'לא מצאנו רשות תואמת. נסו שם עיר או מועצה מהרשימה.',
  },
  en: {
    kicker: 'Local first',
    askHeadline: 'Which edition should we open?',
    askLede:
      'Taruu is written town by town: every topic, every ballot and every shekel belongs to one authority. Pick yours - that is the edition you get.',
    settledKicker: 'Your edition',
    settledLede: 'The edition of',
    settledNote:
      'Everything above belongs to this authority. Below it the national edition continues - the Knesset agenda, which reaches every town.',
    allKicker: 'All authorities',
    allHeadline: 'You are reading the whole country',
    allLede:
      'The topics above are ordered by public heat across every authority. Pick a town to bring its own to the head of the edition.',
    change: 'Change town',
    readAll: 'Read the whole country',
    privacy:
      'Your location stays on your device. Never sent to a server, never stored by us.',
    confirmLede: 'Looks like you are near',
    confirmAsk: 'Is this your town?',
    confirmYes: 'Yes, that is my edition',
    confirmGlyph: '→',
    confirmNo: 'No, I will type it myself',
    locateCta: 'Detect my location',
    locating: 'Locating…',
    or: 'or',
    townLabel: 'Town name',
    townPlaceholder: 'Type the name of your town…',
    openBoard: 'Open the edition',
    matchPrefix: 'Found:',
    cancel: 'Cancel',
    quickPicksLabel: 'Quick town picks',
    errNoGeoSupport:
      'Your browser does not support location services. Type the name of your town instead.',
    errNoMatchNearby:
      'We could not find a supported municipality near you. Taruu serves residents of Israeli municipalities - if you live in Israel, type the name of your town.',
    errNoPermission:
      'Location permission was declined. Type the name of your town instead.',
    errNoTextMatch:
      'No matching municipality was found. Try a city or council name from the list.',
  },
};

export function LocalityDesk({ locale = 'he' }: { locale?: Locale }) {
  const t = COPY[locale];
  const reduceMotion = useReducedMotion();
  /* The stored choice can only be read after mount, so the section renders its
     asking state on the server and settles once it knows. */
  const [home, setHome] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('choosing');
  const [town, setTown] = useState('');
  const [detected, setDetected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => {
      const stored = getStoredMunicipality();
      setHome(stored);
      setMode(stored ? 'settled' : 'choosing');
    };
    apply();
    window.addEventListener(LOCALITY_EVENT, apply);
    return () => window.removeEventListener(LOCALITY_EVENT, apply);
  }, []);

  const textMatch = useMemo(
    () => (town.trim().length >= 2 ? municipalityFromText(town) : null),
    [town]
  );

  /* The blank's live reveal gets one pop per NEW match, not one per
     keystroke while the same match holds. */
  const lastMatch = useRef<string | null>(null);
  useEffect(() => {
    const name = textMatch?.name ?? null;
    if (name && name !== lastMatch.current) chime('pop');
    lastMatch.current = name;
  }, [textMatch]);

  /* Every commit path - chip, confirm-yes, typed submit - funnels here, so
     the tick lives in exactly one place. */
  const choose = (name: string) => {
    chime('tick');
    setStoredMunicipality(name);
    setTown('');
    setDetected(null);
    setError(null);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setError(t.errNoGeoSupport);
      return;
    }
    /* The confirm tick lands in the geolocation callback - an async
       continuation, not a gesture - so the context is woken on the click. */
    primeChime();
    setError(null);
    setMode('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const muni = municipalityFromCoords(pos.coords.latitude, pos.coords.longitude);
        if (muni) {
          // Never auto-commit a GPS guess - show it and let the reader confirm.
          chime('tick');
          setDetected(muni.name);
          setMode('confirm');
        } else {
          setMode('choosing');
          setError(t.errNoMatchNearby);
        }
      },
      () => {
        setMode('choosing');
        setError(t.errNoPermission);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  };

  const submitTown = (event: React.FormEvent) => {
    event.preventDefault();
    if (textMatch) choose(textMatch.name);
    else setError(t.errNoTextMatch);
  };

  const busy = mode === 'locating';
  /* One face per composition, coarser than `mode`: choosing and locating
     share a face, so the panel does not cross-fade against itself while the
     radar sweeps. */
  const face =
    mode === 'confirm' && detected
      ? 'confirm'
      : mode === 'settled' && home
        ? 'settled'
        : 'ask';

  /* Population order is the array's own order; the reader's current town
     would be a dead button, so it sits the list out. */
  const quickPicks = useMemo(
    () =>
      MUNICIPALITY_GEO.slice(0, 7)
        .filter((m) => m.name !== home)
        .slice(0, 6),
    [home]
  );

  const faceMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: reduceMotion ? 0 : 0.2, ease: NP_EASE },
  } as const;

  const radar = (
    <span className={styles.radar} data-sweeping={busy || undefined} aria-hidden>
      <span className={styles.radarRing} />
      <span className={styles.radarRing} />
      <span className={styles.radarDot} />
    </span>
  );

  return (
    <section
      className={styles.desk}
      data-locality-gate
      /* "hold": the pinned dock stands over this section while it is on
         screen and tucks away elsewhere - see Masthead's sentinel logic. */
      data-nav-reveal="hold"
      aria-labelledby="locality-desk-headline"
    >
      <div className={styles.inner}>
        {/* Column A - the editorial ask. Never carries a control. */}
        <div className={styles.story} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={face} className={styles.storyFace} {...faceMotion}>
              <span className={styles.kicker}>
                <span aria-hidden className={styles.kickerTick} />
                {face === 'settled' ? t.settledKicker : t.kicker}
              </span>
              {face === 'settled' && home ? (
                <>
                  <h2 id="locality-desk-headline" className={styles.headline}>
                    {t.settledLede}{' '}
                    {/* Keyed by value: the stamp plays once per new town,
                        not on every re-render of a standing choice. */}
                    <span key={home} className={styles.town}>
                      {home}
                    </span>
                  </h2>
                  <p className={styles.lede}>{t.settledNote}</p>
                </>
              ) : face === 'confirm' && detected ? (
                <>
                  <h2 id="locality-desk-headline" className={styles.headline}>
                    {t.confirmLede}{' '}
                    <span className={styles.townRise}>{detected}</span>
                  </h2>
                  <p className={styles.lede}>{t.confirmAsk}</p>
                </>
              ) : (
                <>
                  <h2 id="locality-desk-headline" className={styles.headline}>
                    {t.askHeadline}
                  </h2>
                  <p className={styles.lede}>{t.askLede}</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Column B - the instrument panel: the sheet on the desk. The live
            wrapper is persistent so assistive tech keeps its registration
            while the faces swap inside it. */}
        <div className={styles.panel} data-busy={busy || undefined}>
          <div className={styles.panelLive} aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={face} className={styles.panelFace} {...faceMotion}>
                {face === 'settled' && home ? (
                  <div className={styles.panelStack}>
                    <NewsButton
                      variant="ink"
                      size="md"
                      onClick={() => {
                        setMode('choosing');
                        setError(null);
                      }}
                    >
                      {t.change}
                    </NewsButton>
                    <button
                      type="button"
                      className={styles.quiet}
                      onClick={() => clearStoredMunicipality()}
                    >
                      {t.readAll}
                    </button>
                  </div>
                ) : face === 'confirm' && detected ? (
                  <div className={styles.panelStack}>
                    {/* Staggered on purpose: the eye lands on the primary
                        path before the escape hatch arrives. */}
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.18, ease: NP_EASE }}
                    >
                      <NewsButton
                        variant="red"
                        size="md"
                        onClick={() => choose(detected)}
                        trailing={<span aria-hidden>{t.confirmGlyph}</span>}
                      >
                        {t.confirmYes}
                      </NewsButton>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: reduceMotion ? 0 : 0.18,
                        delay: reduceMotion ? 0 : 0.06,
                        ease: NP_EASE,
                      }}
                    >
                      <NewsButton
                        variant="outline"
                        size="md"
                        onClick={() => {
                          setDetected(null);
                          setMode('choosing');
                        }}
                      >
                        {t.confirmNo}
                      </NewsButton>
                    </motion.div>
                  </div>
                ) : (
                  <div className={styles.panelStack}>
                    <NewsButton
                      variant="red"
                      size="lg"
                      onClick={locate}
                      disabled={busy}
                      className={busy ? styles.locating : undefined}
                      trailing={radar}
                    >
                      {busy ? t.locating : t.locateCta}
                    </NewsButton>

                    <div className={styles.divider} aria-hidden>
                      <span>{t.or}</span>
                    </div>

                    <div
                      className={styles.chips}
                      role="group"
                      aria-label={t.quickPicksLabel}
                    >
                      {quickPicks.map((m) => (
                        <button
                          key={m.name}
                          type="button"
                          className={styles.chip}
                          disabled={busy}
                          onClick={() => choose(m.name)}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>

                    <form className={styles.townForm} onSubmit={submitTown}>
                      <label className={styles.srOnly} htmlFor="locality-town">
                        {t.townLabel}
                      </label>
                      <input
                        id="locality-town"
                        type="text"
                        className={styles.input}
                        placeholder={t.townPlaceholder}
                        value={town}
                        disabled={busy}
                        onChange={(event) => {
                          setTown(event.target.value);
                          setError(null);
                        }}
                        list="locality-towns"
                        autoComplete="off"
                      />
                      <datalist id="locality-towns">
                        {MUNICIPALITY_GEO.map((m) => (
                          <option key={m.name} value={m.name} />
                        ))}
                      </datalist>
                      <NewsButton
                        type="submit"
                        variant="ink"
                        size="md"
                        disabled={!textMatch || busy}
                      >
                        {t.openBoard}
                      </NewsButton>
                    </form>

                    {textMatch && town.trim() !== textMatch.name ? (
                      <p className={styles.match}>
                        {t.matchPrefix} {textMatch.name}
                      </p>
                    ) : null}

                    {home ? (
                      <button
                        type="button"
                        className={styles.quiet}
                        onClick={() => setMode('settled')}
                      >
                        {t.cancel}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.quiet}
                        onClick={() => clearStoredMunicipality()}
                      >
                        {t.readAll}
                      </button>
                    )}

                    <p className={styles.privacy}>{t.privacy}</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {error ? (
            <p className={styles.error} role="status">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
