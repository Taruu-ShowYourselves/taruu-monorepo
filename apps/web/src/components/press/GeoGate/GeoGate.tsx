'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MUNICIPALITY_GEO,
  municipalityFromCoords,
  municipalityFromText,
} from '@sync/shared';
import { NewsButton } from '@/components/press/NewsButton';
import { useAuth } from '@/providers/AuthProvider';
import type { Locale } from '@/lib/i18n';
import {
  dismissLocalityPrompt,
  getStoredMunicipality,
  isLocalityPromptDismissed,
  setStoredMunicipality,
} from '@/lib/locality';
import styles from './GeoGate.module.css';

type GateState = 'closed' | 'open' | 'locating' | 'confirm';

interface GeoGateCopy {
  kicker: string;
  headline: string;
  why: string;
  confirmLede: string;
  confirmAsk: string;
  confirmYes: string;
  confirmYesGlyph: string;
  confirmNo: string;
  locateCta: string;
  locating: string;
  or: string;
  townLabel: string;
  townPlaceholder: string;
  openBoard: string;
  matchPrefix: string;
  skip: string;
  errNoGeoSupport: string;
  errNoMatchNearby: string;
  errNoPermission: string;
  errNoTextMatch: string;
}

const COPY: Record<Locale, GeoGateCopy> = {
  he: {
    kicker: 'מקומי קודם · LOCAL FIRST',
    headline: 'מאיפה אתם קוראים אותנו?',
    why: 'תַּרְאוּ היא עיתון מקומי: כל נושא, כל הצבעה וכל קופה שייכים לרשות מקומית אחת. כדי לפתוח את הלוח של היישוב שלכם אנחנו צריכים לדעת איפה אתם גרים. המיקום נשאר במכשיר שלכם בלבד, לא נשלח לשרת ולא נשמר אצלנו.',
    confirmLede: 'זיהינו אתכם ליד:',
    confirmAsk: 'זה היישוב שלכם?',
    confirmYes: 'כן, פתחו את הלוח',
    confirmYesGlyph: '←',
    confirmNo: 'לא, אכתוב בעצמי',
    locateCta: 'אתרו אותי אוטומטית',
    locating: 'מאתרים…',
    or: 'או',
    townLabel: 'שם היישוב',
    townPlaceholder: 'כתבו את שם היישוב…',
    openBoard: 'פתחו את הלוח',
    matchPrefix: 'נמצא:',
    skip: 'לא עכשיו, הראו לי את כל הרשויות',
    errNoGeoSupport: 'הדפדפן לא תומך באיתור מיקום. כתבו את שם היישוב.',
    errNoMatchNearby: 'לא זיהינו רשות נתמכת בקרבתכם. כתבו את שם היישוב.',
    errNoPermission: 'לא קיבלנו הרשאת מיקום. כתבו את שם היישוב במקום.',
    errNoTextMatch: 'לא מצאנו רשות תואמת. נסו שם עיר או מועצה מהרשימה.',
  },
  en: {
    kicker: 'Local first',
    headline: 'Where are you reading us from?',
    why: 'Taruu is a local newspaper for Israel: every topic, every vote and every fund belongs to a single municipality, and voting is reserved for Israeli residents. To open your town’s board we need to know where you live. Your location stays on your device only - it is never sent to a server and never stored by us.',
    confirmLede: 'We placed you near:',
    confirmAsk: 'Is this your town?',
    confirmYes: 'Yes, open the board',
    confirmYesGlyph: '→',
    confirmNo: 'No, I will type it myself',
    locateCta: 'Detect my location',
    locating: 'Locating…',
    or: 'or',
    townLabel: 'Town name',
    townPlaceholder: 'Type the name of your town…',
    openBoard: 'Open the board',
    matchPrefix: 'Found:',
    skip: 'Not now, show me all municipalities',
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

/**
 * GeoGate - the geo-first entry prompt. The platform is municipal: without
 * knowing the reader's town we can't open the right board. Shown once per
 * browser when there is no auth session and no stored locality; resolves via
 * GPS (nearest municipality centroid, on-device) or a typed town name.
 */
export function GeoGate({ locale = 'he' }: { locale?: Locale }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [state, setState] = useState<GateState>('closed');
  const [town, setTown] = useState('');
  const [detected, setDetected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = COPY[locale];

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    if (getStoredMunicipality() || isLocalityPromptDismissed()) return;
    /* A page that asks the question in its own flow asks it better: it can
       show what the answer changes, and it stays there to be changed again.
       Where one is mounted (the homepage's LocalityDesk, between the desks)
       this modal has nothing to add and would arrive on top of it. */
    if (document.querySelector('[data-locality-gate]')) return;
    setState('open');
  }, [isLoading, isAuthenticated]);

  const textMatch = useMemo(
    () => (town.trim().length >= 2 ? municipalityFromText(town) : null),
    [town]
  );

  if (state === 'closed') return null;

  const choose = (name: string) => {
    setStoredMunicipality(name);
    setState('closed');
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setError(t.errNoGeoSupport);
      return;
    }
    setError(null);
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const muni = municipalityFromCoords(
          pos.coords.latitude,
          pos.coords.longitude
        );
        if (muni) {
          // Never auto-commit a GPS guess - show it and let the reader confirm.
          setDetected(muni.name);
          setState('confirm');
        } else {
          setState('open');
          setError(t.errNoMatchNearby);
        }
      },
      () => {
        setState('open');
        setError(t.errNoPermission);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  };

  const submitTown = (e: React.FormEvent) => {
    e.preventDefault();
    if (textMatch) {
      choose(textMatch.name);
    } else {
      setError(t.errNoTextMatch);
    }
  };

  const dismiss = () => {
    dismissLocalityPrompt();
    setState('closed');
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="geogate-headline">
      <div className={styles.plate}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          {t.kicker}
        </span>

        <h2 id="geogate-headline" className={styles.headline}>
          {t.headline}
        </h2>

        <p className={styles.why}>{t.why}</p>

        {state === 'confirm' && detected ? (
          <div className={styles.confirm}>
            <p className={styles.confirmLede}>
              {t.confirmLede} <span className={styles.confirmName}>{detected}</span>
            </p>
            <p className={styles.confirmAsk}>{t.confirmAsk}</p>
            <div className={styles.confirmActions}>
              <NewsButton
                variant="red"
                size="md"
                onClick={() => choose(detected)}
                trailing={<span aria-hidden>{t.confirmYesGlyph}</span>}
              >
                {t.confirmYes}
              </NewsButton>
              <NewsButton
                variant="outline"
                size="md"
                onClick={() => {
                  setDetected(null);
                  setState('open');
                }}
              >
                {t.confirmNo}
              </NewsButton>
            </div>
          </div>
        ) : (
        <div className={styles.actions}>
          <NewsButton
            variant="red"
            size="md"
            onClick={locate}
            disabled={state === 'locating'}
            trailing={<span aria-hidden>◎</span>}
          >
            {state === 'locating' ? t.locating : t.locateCta}
          </NewsButton>
          <span className={styles.or}>{t.or}</span>
          <form className={styles.townForm} onSubmit={submitTown}>
            <label className={styles.srOnly} htmlFor="geogate-town">
              {t.townLabel}
            </label>
            <input
              id="geogate-town"
              type="text"
              className={styles.input}
              placeholder={t.townPlaceholder}
              value={town}
              onChange={(e) => {
                setTown(e.target.value);
                setError(null);
              }}
              list="geogate-towns"
              autoComplete="off"
            />
            <datalist id="geogate-towns">
              {MUNICIPALITY_GEO.map((m) => (
                <option key={m.name} value={m.name} />
              ))}
            </datalist>
            <NewsButton type="submit" variant="ink" size="md" disabled={!textMatch}>
              {t.openBoard}
            </NewsButton>
          </form>
        </div>
        )}

        {textMatch && town.trim() !== textMatch.name ? (
          <p className={styles.match}>{t.matchPrefix} {textMatch.name}</p>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        <button type="button" className={styles.skip} onClick={dismiss}>
          {t.skip}
        </button>
      </div>
    </div>
  );
}
