'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MUNICIPALITY_GEO,
  municipalityFromCoords,
  municipalityFromText,
} from '@sync/shared';
import { NewsButton } from '@/components/press/NewsButton';
import { useAuth } from '@/providers/AuthProvider';
import {
  dismissLocalityPrompt,
  getStoredMunicipality,
  isLocalityPromptDismissed,
  setStoredMunicipality,
} from '@/lib/locality';
import styles from './GeoGate.module.css';

type GateState = 'closed' | 'open' | 'locating' | 'confirm';

/**
 * GeoGate — the geo-first entry prompt. The platform is municipal: without
 * knowing the reader's town we can't open the right board. Shown once per
 * browser when there is no auth session and no stored locality; resolves via
 * GPS (nearest municipality centroid, on-device) or a typed town name.
 */
export function GeoGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const [state, setState] = useState<GateState>('closed');
  const [town, setTown] = useState('');
  const [detected, setDetected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    if (getStoredMunicipality() || isLocalityPromptDismissed()) return;
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
      setError('הדפדפן לא תומך באיתור מיקום — כתבו את שם היישוב.');
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
          // Never auto-commit a GPS guess — show it and let the reader confirm.
          setDetected(muni.name);
          setState('confirm');
        } else {
          setState('open');
          setError('לא זיהינו רשות נתמכת בקרבתכם — כתבו את שם היישוב.');
        }
      },
      () => {
        setState('open');
        setError('לא קיבלנו הרשאת מיקום — כתבו את שם היישוב במקום.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  };

  const submitTown = (e: React.FormEvent) => {
    e.preventDefault();
    if (textMatch) {
      choose(textMatch.name);
    } else {
      setError('לא מצאנו רשות תואמת — נסו שם עיר או מועצה מהרשימה.');
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
          מקומי קודם · LOCAL FIRST
        </span>

        <h2 id="geogate-headline" className={styles.headline}>
          מאיפה אתם קוראים אותנו?
        </h2>

        <p className={styles.why}>
          תַּרְאוּ היא עיתון מקומי: כל נושא, כל הצבעה וכל קופה שייכים לרשות
          מקומית אחת. כדי לפתוח את הלוח הנכון — של היישוב שלכם — אנחנו צריכים
          לדעת איפה אתם גרים. המיקום נשאר במכשיר שלכם בלבד, לא נשלח לשרת ולא
          נשמר אצלנו.
        </p>

        {state === 'confirm' && detected ? (
          <div className={styles.confirm}>
            <p className={styles.confirmLede}>
              זיהינו אתכם ליד: <span className={styles.confirmName}>{detected}</span>
            </p>
            <p className={styles.confirmAsk}>זה היישוב שלכם?</p>
            <div className={styles.confirmActions}>
              <NewsButton
                variant="red"
                size="md"
                onClick={() => choose(detected)}
                trailing={<span aria-hidden>←</span>}
              >
                כן — פתחו את הלוח
              </NewsButton>
              <NewsButton
                variant="outline"
                size="md"
                onClick={() => {
                  setDetected(null);
                  setState('open');
                }}
              >
                לא — אכתוב בעצמי
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
            {state === 'locating' ? 'מאתרים…' : 'אתרו אותי אוטומטית'}
          </NewsButton>
          <span className={styles.or}>או</span>
          <form className={styles.townForm} onSubmit={submitTown}>
            <label className={styles.srOnly} htmlFor="geogate-town">
              שם היישוב
            </label>
            <input
              id="geogate-town"
              type="text"
              className={styles.input}
              placeholder="כתבו את שם היישוב…"
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
              פתחו את הלוח
            </NewsButton>
          </form>
        </div>
        )}

        {textMatch && town.trim() !== textMatch.name ? (
          <p className={styles.match}>נמצא: {textMatch.name}</p>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        <button type="button" className={styles.skip} onClick={dismiss}>
          לא עכשיו — הראו לי את כל הרשויות
        </button>
      </div>
    </div>
  );
}
