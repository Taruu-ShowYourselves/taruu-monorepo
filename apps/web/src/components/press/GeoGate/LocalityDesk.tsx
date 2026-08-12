'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MUNICIPALITY_GEO,
  municipalityFromCoords,
  municipalityFromText,
} from '@sync/shared';
import { NewsButton } from '@/components/press/NewsButton';
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
 * This was a modal that met people at the door. A dialog is the wrong shape for
 * it: it interrupts before the reader knows what is being asked for or why, it
 * can only be answered once, and it disappears - so the single most important
 * setting on the page ends up with nowhere to live and no way back.
 *
 * As a section between the two desks it governs them instead. It sits where its
 * effect is visible: the municipal river above it re-orders the moment a town
 * is chosen (both desks listen for LOCALITY_EVENT), and the national desk below
 * it is what a reader gets either way. It also stops being a one-shot question -
 * it prints the standing choice, and changing it is a control rather than a
 * second visit.
 */

type Mode = 'settled' | 'choosing' | 'locating' | 'confirm';

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
      'תַּרְאוּ נכתבת יישוב־יישוב: כל נושא, כל הצבעה וכל שקל שייכים לרשות אחת. בחרו את שלכם - וזו המהדורה שתקבלו.',
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
  /* The stored choice can only be read after mount, so the section renders its
     asking state on the server and settles once it knows. `home === null` is a
     reader with no choice yet; `chose` separates "reads everything on purpose"
     from "has not answered". */
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

  const choose = (name: string) => {
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
    setError(null);
    setMode('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const muni = municipalityFromCoords(pos.coords.latitude, pos.coords.longitude);
        if (muni) {
          // Never auto-commit a GPS guess - show it and let the reader confirm.
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

  const settled = mode === 'settled';
  const picking = mode === 'choosing' || mode === 'locating';

  return (
    <section
      className={styles.desk}
      data-locality-gate
      aria-labelledby="locality-desk-headline"
    >
      <div className={styles.inner}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          {settled ? t.settledKicker : home === null && !picking ? t.allKicker : t.kicker}
        </span>

        {settled && home ? (
          <>
            <h2 id="locality-desk-headline" className={styles.headline}>
              {t.settledLede} <span className={styles.town}>{home}</span>
            </h2>
            <p className={styles.lede}>{t.settledNote}</p>
            <div className={styles.actions}>
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
          </>
        ) : mode === 'confirm' && detected ? (
          <>
            <h2 id="locality-desk-headline" className={styles.headline}>
              {t.confirmLede} <span className={styles.town}>{detected}</span>
            </h2>
            <p className={styles.lede}>{t.confirmAsk}</p>
            <div className={styles.actions}>
              <NewsButton
                variant="red"
                size="md"
                onClick={() => choose(detected)}
                trailing={<span aria-hidden>{t.confirmGlyph}</span>}
              >
                {t.confirmYes}
              </NewsButton>
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
            </div>
          </>
        ) : (
          <>
            <h2 id="locality-desk-headline" className={styles.headline}>
              {t.askHeadline}
            </h2>
            <p className={styles.lede}>{t.askLede}</p>

            <div className={styles.actions}>
              <NewsButton
                variant="red"
                size="md"
                onClick={locate}
                disabled={mode === 'locating'}
                trailing={<span aria-hidden>◎</span>}
              >
                {mode === 'locating' ? t.locating : t.locateCta}
              </NewsButton>

              <span className={styles.or}>{t.or}</span>

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
                <NewsButton type="submit" variant="ink" size="md" disabled={!textMatch}>
                  {t.openBoard}
                </NewsButton>
              </form>

              {/* Only offered to a reader who already had a choice - there is
                  nothing to go back to otherwise. */}
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
            </div>

            <p className={styles.privacy}>{t.privacy}</p>
          </>
        )}

        {textMatch && town.trim() !== textMatch.name ? (
          <p className={styles.match}>
            {t.matchPrefix} {textMatch.name}
          </p>
        ) : null}
        {error ? (
          <p className={styles.error} role="status">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
