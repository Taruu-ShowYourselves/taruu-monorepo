'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton } from '@/components/press/NewsButton';
import { useAuth } from '@/providers/AuthProvider';
import { setStoredMunicipality } from '@/lib/locality';
import { municipalityFromCoords } from '@sync/shared';
import styles from './PilotArrivalClient.module.css';

type Role = 'participant' | 'observer';
type Step = 'intro' | 'role' | 'consent' | 'confirm' | 'done';

interface PilotMunicipality {
  municipalityId: string;
  rank: number | null;
  votes: { voteId: string; title: string; position: number; participantCount: number }[];
}

interface PilotStatus {
  municipalities: PilotMunicipality[];
}

interface Coords {
  lat: number;
  lng: number;
  accuracyM?: number;
}

const SESSION_KEY = 'taruu.pilot';
const CONSENT_VERSION = 'pilot-gps-v1';

function saveProgress(progress: Record<string, unknown>) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(progress));
  } catch {
    // Storage may be partitioned in Facebook's in-app browser. The flow still works.
  }
}

export function PilotArrivalClient() {
  const router = useRouter();
  const search = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<PilotStatus | null>(null);
  const [step, setStep] = useState<Step>('intro');
  const [role, setRole] = useState<Role | null>(null);
  const [selectedMuni, setSelectedMuni] = useState<string | null>(search.get('muni') ?? null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [gpsHint, setGpsHint] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/pilot/status')
      .then((response) => (response.ok ? response.json() : { municipalities: [] }))
      .then((data) => {
        if (live) setStatus(data as PilotStatus);
      })
      .catch(() => {
        if (live) setStatus({ municipalities: [] });
      });
    return () => {
      live = false;
    };
  }, []);

  // Stable identity: the fallback literal would otherwise be a fresh array on
  // every render and re-run every hook that reads the cohort.
  const municipalities = useMemo(() => status?.municipalities ?? [], [status]);
  const linkedMunicipality = useMemo(
    () => municipalities.find((municipality) => municipality.municipalityId === search.get('muni')) ?? null,
    [municipalities, search]
  );
  const selected = municipalities.find((municipality) => municipality.municipalityId === selectedMuni) ?? null;

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsHint('הדפדפן הזה לא מאפשר שיתוף מיקום. אפשר לבחור רשות ידנית.');
      setStep('confirm');
      return;
    }
    setLocating(true);
    setGpsHint(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        };
        setCoords(next);
        const resolved = municipalityFromCoords(next.lat, next.lng)?.name ?? null;
        if (resolved && municipalities.some((municipality) => municipality.municipalityId === resolved)) {
          setSelectedMuni(resolved);
          setGpsHint(`מצאנו את ${resolved}. אפשר לאשר או לבחור רשות אחרת.`);
        } else {
          setGpsHint('לא הצלחנו לשייך את המיקום לרשות פיילוט. אפשר לבחור רשות ידנית.');
        }
        setLocating(false);
        setStep('confirm');
      },
      () => {
        setLocating(false);
        setGpsHint('לא התקבל מיקום. אפשר להמשיך עם בחירה ידנית.');
        setStep('confirm');
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 }
    );
  }, [municipalities]);

  const register = useCallback(async () => {
    if (!role || !selectedMuni) return;
    saveProgress({ role, selectedMuni, step: 'confirm' });
    if (!isAuthenticated) {
      sessionStorage.setItem('taruu.post_auth_redirect', `${window.location.pathname}${window.location.search}`);
      router.push(`/sign-in?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/pilot/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          role,
          municipalityId: selectedMuni,
          ...(coords
            ? { coords, locationConsent: true, consentVersion: CONSENT_VERSION }
            : {}),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.code === 'CONFLICT' ? 'הרישום להשתתפות פתוח רק ברשות פיילוט פעילה.' : 'לא הצלחנו להשלים את הרישום. נסו שוב.');
      }
      setStoredMunicipality(data.resolvedMunicipality);
      saveProgress({ role, selectedMuni: data.resolvedMunicipality, complete: true });
      setStep('done');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'לא הצלחנו להשלים את הרישום.');
    } finally {
      setSubmitting(false);
    }
  }, [coords, isAuthenticated, role, router, selectedMuni]);

  return (
    <>
      <Header />
      <main className={styles.main}>
        <section className={styles.desk} aria-live="polite">
          <span className={styles.kicker}><span aria-hidden>■</span> פיילוט הרשויות · 10 המובילות</span>
          {step === 'intro' && (
            <>
              <h1>הקול של <em>{linkedMunicipality?.municipalityId ?? 'הרשויות המשתתפות'}</em> עולה למבחן.</h1>
              <p className={styles.lead}>
                עשר רשויות נמדדו כבעלות המעורבות האזרחית הגבוהה בארץ. חמשת הנושאים שנרשמו בכל רשות פתוחים עכשיו לצפייה — ולהצבעה לתושביה בלבד.
              </p>
              {linkedMunicipality ? <Topics municipality={linkedMunicipality} /> : <p className={styles.note}>הגעתם בלי קישור קבוצה? אפשר לבחור רשות פיילוט בשלב הבא.</p>}
              <NewsButton variant="red" size="lg" onClick={() => setStep('role')} trailing={<span aria-hidden>←</span>}>המשיכו לפיילוט</NewsButton>
            </>
          )}
          {step === 'role' && (
            <>
              <h1>אתם כאן כדי <em>להשתתף</em> או לצפות?</h1>
              <div className={styles.roleGrid}>
                <button className={styles.roleCard} onClick={() => { setRole('participant'); setStep('consent'); }}>
                  <strong>אני תושב/ת</strong><span>אאשר את הרשות שלי ואוכל להצביע בנושאים הפתוחים בה.</span>
                </button>
                <button className={styles.roleCard} onClick={() => { setRole('observer'); setStep('consent'); }}>
                  <strong>אני צופה</strong><span>אראה את הנושאים והתוצאות, בלי להשתתף בהצבעה.</span>
                </button>
              </div>
            </>
          )}
          {step === 'consent' && (
            <>
              <h1>שיתוף מיקום — <em>הפעם הוא נשלח אלינו.</em></h1>
              <p className={styles.lead}>המיקום נשלח פעם אחת כדי לאמת את הרשות המשתתפת. הוא נשמר רק לתיעוד הפיילוט, לא משמש לפרסום ולא נחשף למשתתפים אחרים.</p>
              <div className={styles.consent}><span>מה נשלח</span><strong>קואורדינטות GPS ורמת דיוק</strong><span>למה</span><strong>אימות שיוך לרשות</strong></div>
              <div className={styles.actions}>
                <NewsButton variant="red" size="lg" disabled={locating} onClick={locate}>{locating ? 'בודקים מיקום…' : 'אשרו ושתפו מיקום'}</NewsButton>
                <button className={styles.textButton} onClick={() => setStep('confirm')}>בלי מיקום — אבחר ידנית</button>
              </div>
            </>
          )}
          {step === 'confirm' && (
            <>
              <h1>אשרו את <em>הרשות שלכם.</em></h1>
              <p className={styles.lead}>{gpsHint ?? 'הבחירה שלכם היא זו שתיקבע את הרשות שמוצגת לכם באתר.'}</p>
              <div className={styles.municipalities}>
                {municipalities.map((municipality) => (
                  <button key={municipality.municipalityId} className={selectedMuni === municipality.municipalityId ? styles.muniSelected : styles.muni} onClick={() => setSelectedMuni(municipality.municipalityId)}>
                    <span>{selectedMuni === municipality.municipalityId ? '✓' : '○'}</span><strong>{municipality.municipalityId}</strong><small>מקום {municipality.rank ?? '—'} · {municipality.votes.length} נושאים</small>
                  </button>
                ))}
              </div>
              {selected ? <Topics municipality={selected} compact /> : null}
              {error ? <p className={styles.error}>{error}</p> : null}
              <NewsButton variant="red" size="lg" disabled={!selectedMuni || submitting} onClick={register}>{submitting ? 'רושמים…' : role === 'observer' ? 'התחילו לצפות' : 'אשרו והצטרפו'}</NewsButton>
            </>
          )}
          {step === 'done' && (
            <>
              <h1>הרשות שלכם <em>נרשמה.</em></h1>
              <p className={styles.lead}>{role === 'participant' ? `ברוכים הבאים לפיילוט של ${selectedMuni}. חמשת הנושאים מחכים להצבעה שלכם.` : `אתם צופים עכשיו בפיילוט של ${selectedMuni}.`}</p>
              <NewsButton variant="red" size="lg" onClick={() => router.push('/votes')}>לנושאים הפעילים</NewsButton>
            </>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function Topics({ municipality, compact = false }: { municipality: PilotMunicipality; compact?: boolean }) {
  return <ol className={compact ? styles.topicsCompact : styles.topics}>{municipality.votes.map((vote) => <li key={vote.voteId}><span>0{vote.position}</span><strong>{vote.title}</strong><small>{vote.participantCount.toLocaleString('he-IL')} קולות</small></li>)}</ol>;
}
