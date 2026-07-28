'use client';

/**
 * Document-scan verification step (issue #32).
 *
 * Privacy-by-design: the whole pipeline — capture, quality gates, OCR,
 * field extraction — runs on this device. The photo is drawn to a local
 * canvas, read by tesseract.js (self-hosted WASM under /ocr), and discarded;
 * only the extracted, user-confirmed fields are submitted.
 *
 * Sub-flow: consent → details (doc type + ID number) → capture → review.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { isValidIsraeliId, normalizeIsraeliId } from '@sync/shared';
import type {
  FaceProvenance,
  IdentityDocumentType,
  SubmitIdentityDocumentResponse,
} from '@sync/shared/contracts';
import { NewsButton, PressInput, Segmented } from '@/components/press';
import { analyzeQuality } from '@/lib/scan/quality';
import { deriveFields } from '@/lib/scan/extract';
import { disposeOcr, preloadOcr, recognizeDocument } from '@/lib/scan/ocr';
import {
  disposeFace,
  faceSimilarity,
  observeFrame,
  preloadFace,
  readFace,
} from '@/lib/scan/face';
import {
  advanceLiveness,
  buildChallengeSequence,
  challengePrompt,
  initialLiveness,
  MAX_MISSING_FRAMES,
  type LivenessState,
} from '@/lib/scan/liveness';
import styles from './DocumentScanStep.module.css';

/** Version of the consent text below — stored with every submission. */
export const CONSENT_VERSION = 'doc-face-consent-v2-2026-07';

/** Face pipeline result when the selfie step could not run at all. */
const FACE_UNCHECKED: FaceProvenance = {
  checked: false,
  docFaceFound: false,
  matchScore: null,
  livenessPassed: false,
  antispoofScore: null,
};

/** ID-1 card aspect ratio (85.6mm × 53.98mm). */
const CARD_ASPECT = 1.586;

const COPY = {
  consentTitle: 'סריקת תעודה — בהסכמתכם בלבד',
  consentLead:
    'כדי לוודא שכל קול שייך לתושב אמיתי אחד, נאמת את זהותכם מול תעודת זהות ביומטרית או רישיון נהיגה. הסריקה מתבצעת על המכשיר שלכם בלבד.',
  consentPoints: [
    'הצילום לא עולה לשרת ולא נשמר — נשלפים ממנו פרטים בלבד.',
    'סלפי קצר מושווה לתמונה שבתעודה על המכשיר בלבד — ולא נשמר.',
    'נשמרים: שם, תאריך לידה, תוקף התעודה, תוצאת ההתאמה, ואימות מוצפן של מספר הזהות.',
    'מספר הזהות עצמו לא נשמר — רק טביעת אצבע מוצפנת שלו, למניעת כפל חשבונות.',
    'אפשר למחוק את נתוני האימות בכל עת מהגדרות הפרופיל.',
  ],
  consentCheckbox:
    'קראתי ואני מסכים/ה לאימות הזהות כמפורט. ידוע לי שבלי אימות לא ניתן להצביע.',
  biometricCheckbox:
    'אני מסכים/ה גם להשוואת פנים חד-פעמית בין סלפי לתמונה שבתעודה. ההשוואה מתבצעת על המכשיר בלבד; הסלפי, תמונת התעודה והחתימות הביומטריות לא נשמרים ולא נשלחים — רק תוצאת ההתאמה.',
  camDenied:
    'אין הרשאת מצלמה. אפשרו גישה בדפדפן ונסו שוב, או העלו צילום קיים.',
  camUnavailable: 'המכשיר לא תומך במצלמה מהדפדפן. העלו צילום של התעודה.',
  quality: {
    blurry: 'הצילום יצא מטושטש — החזיקו יציב ונסו שוב.',
    glare: 'יש בוהק על התעודה — הטו מעט את הכרטיס או המכשיר.',
    too_small: 'התעודה רחוקה מדי — קרבו את המצלמה.',
  },
  ocrFailed: 'לא הצלחנו לקרוא את התעודה. נסו שוב באור טוב יותר.',
  idInvalid: 'מספר הזהות לא תקין (ספרת ביקורת). בדקו ונסו שוב.',
  emptyField: 'צריך למלא את השדה הזה כדי להמשיך.',
  general: 'משהו השתבש אצלנו, לא אצלכם. נסו שוב בעוד רגע.',
  conflict: 'מספר הזהות הזה כבר מאומת בחשבון אחר. פנו לתמיכה אם זו טעות.',
  expired: 'התעודה שצולמה כבר לא בתוקף. נסו עם תעודה בתוקף.',
  selfieLead:
    'עכשיו סלפי קצר: הביטו למצלמה ועקבו אחרי ההנחיות. ההשוואה לתמונת התעודה מתבצעת על המכשיר — הסלפי לא נשמר.',
  selfieLost: 'איבדנו אתכם — חזרו למרכז המסגרת ונסו שוב.',
  selfieNoCam:
    'בלי מצלמה קדמית לא ניתן לבצע השוואת פנים — הפרטים יעברו בדיקה ידנית.',
  matching: 'משווים לתמונת התעודה…',
} as const;

type Phase =
  | 'consent'
  | 'details'
  | 'capture'
  | 'processing'
  | 'review'
  | 'selfie'
  | 'submitting';

interface ExtractedDraft {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO yyyy-mm-dd ('' when unknown)
  documentExpiry: string;
  idNumberMatched: boolean;
  confidence: number;
  /** OCR-derived values, to detect hand edits at submit time. */
  ocrDateOfBirth: string;
  ocrDocumentExpiry: string;
}

interface DocumentScanStepProps {
  /** Profile names used to prefill the review form (ID card is Hebrew-only). */
  profileFirstName?: string;
  profileLastName?: string;
  /** Called when the server accepted the document. */
  onDone: (result: SubmitIdentityDocumentResponse) => void;
}

export function DocumentScanStep({
  profileFirstName,
  profileLastName,
  onDone,
}: DocumentScanStepProps) {
  const [phase, setPhase] = useState<Phase>('consent');
  const [consented, setConsented] = useState(false);
  const [bioConsented, setBioConsented] = useState(false);
  const [docType, setDocType] = useState<IdentityDocumentType>('id_card');
  const [idNumber, setIdNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [draft, setDraft] = useState<ExtractedDraft | null>(null);
  const [liveness, setLiveness] = useState<LivenessState | null>(null);
  const [matching, setMatching] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Document portrait embedding — in-memory only, never submitted. */
  const docFaceRef = useRef<{ embedding: number[] | null; found: boolean }>({
    embedding: null,
    found: false,
  });

  /* ---- lifecycle: warm OCR + face models once consented ---- */
  useEffect(() => {
    if (phase !== 'consent') {
      preloadOcr();
      preloadFace();
    }
  }, [phase]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamReady(false);
  }, []);

  useEffect(
    () => () => {
      stopCamera();
      void disposeOcr();
      void disposeFace();
    },
    [stopCamera]
  );

  /* ---- camera ---- */
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(COPY.camUnavailable);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCamReady(true);
      return true;
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? COPY.camDenied
          : COPY.camUnavailable
      );
      return false;
    }
  }, []);

  useEffect(() => {
    if (phase === 'capture') void startCamera('environment');
    else if (phase !== 'selfie') stopCamera();
  }, [phase, startCamera, stopCamera]);

  /* ---- shared pipeline: canvas → quality → OCR → derive → review ---- */
  const processCanvas = useCallback(
    async (canvas: HTMLCanvasElement) => {
      setPhase('processing');
      setError(null);
      try {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('canvas');

        const quality = analyzeQuality(
          ctx.getImageData(0, 0, canvas.width, canvas.height)
        );
        if (!quality.ok) {
          setError(COPY.quality[quality.reasons[0]]);
          setPhase('capture');
          return;
        }

        const scan = await recognizeDocument(canvas);
        const fields = deriveFields(`${scan.text}\n${scan.digitText}`, idNumber);

        // Read the document portrait for the later selfie match — in memory
        // only; a missing portrait is a soft signal, never a blocker.
        try {
          const docFace = await readFace(canvas);
          docFaceRef.current = { embedding: docFace.embedding, found: docFace.faceFound };
        } catch {
          docFaceRef.current = { embedding: null, found: false };
        }

        setDraft({
          firstName: profileFirstName ?? '',
          lastName: profileLastName ?? '',
          dateOfBirth: fields.dateOfBirth ?? '',
          documentExpiry: fields.documentExpiry ?? '',
          idNumberMatched: fields.idNumberMatched,
          confidence: Math.round(scan.confidence),
          ocrDateOfBirth: fields.dateOfBirth ?? '',
          ocrDocumentExpiry: fields.documentExpiry ?? '',
        });
        stopCamera();
        setPhase('review');
      } catch {
        setError(COPY.ocrFailed);
        setPhase('capture');
      }
    },
    [idNumber, profileFirstName, profileLastName, stopCamera]
  );

  /** Crop the live video to the overlay-frame region and process it. */
  const handleShutter = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    // The overlay frame covers 90% of the preview width at card aspect,
    // centered — mirror that region from the native video resolution.
    const cropW = Math.round(video.videoWidth * 0.9);
    const cropH = Math.round(Math.min(cropW / CARD_ASPECT, video.videoHeight));
    const sx = Math.round((video.videoWidth - cropW) / 2);
    const sy = Math.round((video.videoHeight - cropH) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    canvas.getContext('2d')?.drawImage(video, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
    void processCanvas(canvas);
  }, [processCanvas]);

  /** Upload fallback: decode the file to a canvas and run the same pipeline. */
  const handleFile = useCallback(
    async (file: File) => {
      try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 2000 / bitmap.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        await processCanvas(canvas);
      } catch {
        setError(COPY.ocrFailed);
        setPhase('capture');
      }
    },
    [processCanvas]
  );

  /* ---- submit (called from the selfie phase with the face outcome) ---- */
  const handleSubmit = useCallback(
    async (face: FaceProvenance) => {
      if (!draft) return;
      const normalized = normalizeIsraeliId(idNumber);
      if (!normalized) {
        setError(COPY.idInvalid);
        setPhase('review');
        return;
      }

      setPhase('submitting');
      setError(null);

      const fieldsEdited =
        draft.dateOfBirth !== draft.ocrDateOfBirth ||
        draft.documentExpiry !== draft.ocrDocumentExpiry;

      try {
        const res = await fetch('/api/verification/document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            documentType: docType,
            idNumber: normalized,
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            dateOfBirth: draft.dateOfBirth,
            documentExpiry: draft.documentExpiry,
            ocr: {
              idNumberMatched: draft.idNumberMatched,
              confidence: draft.confidence,
              fieldsEdited,
            },
            face,
            consentVersion: CONSENT_VERSION,
          }),
        });

        if (res.ok) {
          onDone((await res.json()) as SubmitIdentityDocumentResponse);
          return;
        }

        const data = await res.json().catch(() => null);
        if (res.status === 409) setError(COPY.conflict);
        else if (
          Array.isArray(data?.details) &&
          data.details.some((d: string) => /document_expired/.test(d))
        ) {
          setError(COPY.expired);
        } else setError(data?.error || COPY.general);
        setPhase('review');
      } catch {
        setError(COPY.general);
        setPhase('review');
      }
    },
    [draft, docType, idNumber, onDone]
  );

  /* ---- review → selfie transition (validates the editable fields) ---- */
  const handleReviewNext = useCallback(async () => {
    if (!draft) return;
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      setError(COPY.emptyField);
      return;
    }
    if (!draft.dateOfBirth || !draft.documentExpiry) {
      setError(COPY.emptyField);
      return;
    }
    setError(null);
    setPhase('selfie');
    setLiveness(null);
    setMatching(false);
    const ok = await startCamera('user');
    if (!ok) {
      // No front camera → the face check cannot run; submit flagged for review.
      setError(COPY.selfieNoCam);
      await handleSubmit(FACE_UNCHECKED);
      return;
    }
    setLiveness(initialLiveness(buildChallengeSequence()));
  }, [draft, startCamera, handleSubmit]);

  /* ---- selfie: observation loop drives the liveness machine ---- */
  useEffect(() => {
    if (phase !== 'selfie' || liveness === null || liveness.passed || matching) return;
    if (liveness.missingFrames > MAX_MISSING_FRAMES) return;

    let cancelled = false;
    const tick = async () => {
      const video = videoRef.current;
      if (cancelled || !video || video.videoWidth === 0) return;
      try {
        const obs = await observeFrame(video);
        if (!cancelled) setLiveness((s) => (s ? advanceLiveness(s, obs) : s));
      } catch {
        /* transient detect failure — next tick retries */
      }
    };
    const interval = setInterval(() => void tick(), 350);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phase, liveness, matching]);

  /* ---- selfie: challenges passed → capture, match on-device, submit ---- */
  useEffect(() => {
    if (phase !== 'selfie' || !liveness?.passed || matching) return;
    setMatching(true);

    void (async () => {
      try {
        const video = videoRef.current;
        if (!video || video.videoWidth === 0) throw new Error('no-frame');

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);

        const selfie = await readFace(canvas);
        const doc = docFaceRef.current;

        let matchScore: number | null = null;
        if (selfie.embedding && doc.embedding) {
          matchScore = Math.round(
            (await faceSimilarity(selfie.embedding, doc.embedding)) * 100
          );
        }

        stopCamera();
        await handleSubmit({
          checked: true,
          docFaceFound: doc.found,
          matchScore,
          livenessPassed: true,
          antispoofScore:
            selfie.real === null ? null : Math.round(selfie.real * 100),
        });
      } catch {
        stopCamera();
        // Selfie readable frame never materialized — flag and let review handle it.
        await handleSubmit({
          checked: true,
          docFaceFound: docFaceRef.current.found,
          matchScore: null,
          livenessPassed: true,
          antispoofScore: null,
        });
      }
    })();
  }, [phase, liveness, matching, stopCamera, handleSubmit]);

  /* ------------------------------- render ------------------------------- */

  if (phase === 'consent') {
    return (
      <article className={styles.panel}>
        <header className={styles.panelHead}>
          <span className={styles.panelTag}>שלב 2 · תעודה</span>
          <h2 className={styles.panelTitle}>{COPY.consentTitle}</h2>
        </header>
        <p className={styles.panelText}>{COPY.consentLead}</p>
        <ul className={styles.consentList}>
          {COPY.consentPoints.map((point) => (
            <li key={point} className={styles.consentItem}>
              <span aria-hidden className={styles.consentMark}>✓</span>
              {point}
            </li>
          ))}
        </ul>
        <label className={styles.consentCheckRow}>
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className={styles.consentCheckbox}
          />
          <span>{COPY.consentCheckbox}</span>
        </label>
        {/* Biometric consent is a separate, unbundled checkbox (PPL Am. 13). */}
        <label className={styles.consentCheckRow}>
          <input
            type="checkbox"
            checked={bioConsented}
            onChange={(e) => setBioConsented(e.target.checked)}
            className={styles.consentCheckbox}
          />
          <span>{COPY.biometricCheckbox}</span>
        </label>
        <div className={styles.actions}>
          <NewsButton
            variant="red"
            size="lg"
            disabled={!consented || !bioConsented}
            onClick={() => setPhase('details')}
            trailing={<span aria-hidden>←</span>}
          >
            ממשיכים לאימות
          </NewsButton>
        </div>
      </article>
    );
  }

  if (phase === 'details') {
    return (
      <article className={styles.panel}>
        <header className={styles.panelHead}>
          <span className={styles.panelTag}>שלב 2 · תעודה</span>
          <h2 className={styles.panelTitle}>פרטי התעודה</h2>
        </header>
        <p className={styles.panelText}>
          בחרו איזו תעודה תסרקו והזינו את מספר הזהות. המספר משמש להצלבה מול
          הצילום — והוא לא נשמר אצלנו.
        </p>

        <Segmented
          aria-label="סוג תעודה"
          segments={[
            { value: 'id_card', label: 'תעודת זהות ביומטרית' },
            { value: 'drivers_license', label: 'רישיון נהיגה' },
          ]}
          value={docType}
          onChange={setDocType}
          variant="ink"
          className={styles.segmented}
        />

        <PressInput
          label="מספר זהות (9 ספרות)"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={9}
          placeholder="—————————"
          value={idNumber}
          onChange={(e) => {
            setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 9));
            if (error) setError(null);
          }}
          error={error}
          hint="כולל ספרת ביקורת. לא נשמר — מוצפן חד-כיוונית."
        />

        <div className={styles.actions}>
          <NewsButton
            variant="red"
            size="lg"
            onClick={() => {
              if (!isValidIsraeliId(idNumber)) {
                setError(COPY.idInvalid);
                return;
              }
              setError(null);
              setPhase('capture');
            }}
            trailing={<span aria-hidden>←</span>}
          >
            לצילום התעודה
          </NewsButton>
        </div>
      </article>
    );
  }

  if (phase === 'capture' || phase === 'processing') {
    const processing = phase === 'processing';
    return (
      <article className={styles.panel}>
        <header className={styles.panelHead}>
          <span className={styles.panelTag}>שלב 2 · תעודה</span>
          <h2 className={styles.panelTitle}>
            {docType === 'id_card' ? 'צלמו את קדמת תעודת הזהות' : 'צלמו את קדמת הרישיון'}
          </h2>
        </header>
        <p className={styles.panelText}>
          יישרו את התעודה בתוך המסגרת, באור טוב ובלי בוהק. הצילום נשאר על
          המכשיר — רק הפרטים נשלפים ממנו.
        </p>

        <div className={styles.cameraBox}>
          <video
            ref={videoRef}
            className={styles.cameraVideo}
            playsInline
            muted
            autoPlay
            aria-label="תצוגת מצלמה"
          />
          <div aria-hidden className={styles.cameraFrame} />
          {processing && (
            <div className={styles.processingOverlay} role="status">
              <span className={styles.processingText}>קוראים את התעודה…</span>
            </div>
          )}
        </div>

        {error && (
          <p className={styles.errorRow} role="alert" aria-live="assertive">
            <span aria-hidden>✕ </span>
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <NewsButton
            variant="red"
            size="lg"
            onClick={handleShutter}
            disabled={processing || !camReady}
          >
            {processing ? 'קוראים…' : 'צלמו'}
          </NewsButton>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => fileRef.current?.click()}
            disabled={processing}
          >
            ↳ העלאת צילום קיים
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleFile(file);
            }}
          />
        </div>
        <span className={styles.privacyNote}>
          ▍ הצילום לא עולה לשרת. עיבוד על המכשיר בלבד.
        </span>
      </article>
    );
  }

  if (phase === 'selfie') {
    const lost = (liveness?.missingFrames ?? 0) > MAX_MISSING_FRAMES;
    return (
      <article className={styles.panel}>
        <header className={styles.panelHead}>
          <span className={styles.panelTag}>שלב 2 · תעודה</span>
          <h2 className={styles.panelTitle}>סלפי קצר לאימות</h2>
        </header>
        <p className={styles.panelText}>{COPY.selfieLead}</p>

        <div className={styles.cameraBox}>
          <video
            ref={videoRef}
            className={`${styles.cameraVideo} ${styles.selfieVideo}`}
            playsInline
            muted
            autoPlay
            aria-label="מצלמה קדמית"
          />
          <div aria-hidden className={styles.selfieOval} />
          <div className={styles.challengeBanner} role="status" aria-live="polite">
            {matching
              ? COPY.matching
              : lost
                ? COPY.selfieLost
                : liveness
                  ? challengePrompt(liveness)
                  : 'פותחים מצלמה…'}
          </div>
        </div>

        {error && (
          <p className={styles.errorRow} role="alert">
            <span aria-hidden>✕ </span>
            {error}
          </p>
        )}

        {lost && !matching && (
          <div className={styles.actions}>
            <NewsButton
              variant="red"
              size="lg"
              onClick={() => setLiveness(initialLiveness(buildChallengeSequence()))}
            >
              נסו שוב
            </NewsButton>
          </div>
        )}
        <span className={styles.privacyNote}>
          ▍ הסלפי לא נשמר ולא נשלח. השוואה על המכשיר בלבד.
        </span>
      </article>
    );
  }

  // review / submitting
  const submitting = phase === 'submitting';
  return (
    <article className={styles.panel}>
      <header className={styles.panelHead}>
        <span className={styles.panelTag}>שלב 2 · תעודה</span>
        <h2 className={styles.panelTitle}>אשרו את הפרטים</h2>
      </header>

      <p className={styles.panelText}>
        {draft?.idNumberMatched
          ? 'מספר הזהות אומת מול הצילום. בדקו שהשאר נכון — ותקנו אם צריך.'
          : 'לא הצלחנו לאתר את מספר הזהות בצילום — הפרטים ייבדקו ידנית. בדקו שהכול נכון.'}
      </p>

      <div className={styles.reviewBadges}>
        <span
          className={
            draft?.idNumberMatched ? styles.badgeOk : styles.badgePending
          }
        >
          {draft?.idNumberMatched ? '✓ המספר אומת מול הצילום' : '⧗ ייבדק ידנית'}
        </span>
      </div>

      <div className={styles.reviewGrid}>
        <PressInput
          label="שם פרטי"
          value={draft?.firstName ?? ''}
          onChange={(e) =>
            setDraft((d) => (d ? { ...d, firstName: e.target.value } : d))
          }
          disabled={submitting}
        />
        <PressInput
          label="שם משפחה"
          value={draft?.lastName ?? ''}
          onChange={(e) =>
            setDraft((d) => (d ? { ...d, lastName: e.target.value } : d))
          }
          disabled={submitting}
        />
        <PressInput
          label="תאריך לידה"
          type="date"
          value={draft?.dateOfBirth ?? ''}
          onChange={(e) =>
            setDraft((d) => (d ? { ...d, dateOfBirth: e.target.value } : d))
          }
          disabled={submitting}
        />
        <PressInput
          label="תוקף התעודה"
          type="date"
          value={draft?.documentExpiry ?? ''}
          onChange={(e) =>
            setDraft((d) => (d ? { ...d, documentExpiry: e.target.value } : d))
          }
          disabled={submitting}
        />
      </div>

      {error && (
        <p className={styles.errorRow} role="alert">
          <span aria-hidden>✕ </span>
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <NewsButton
          variant="red"
          size="lg"
          onClick={handleReviewNext}
          disabled={submitting}
          trailing={<span aria-hidden>←</span>}
        >
          {submitting ? 'שולחים…' : 'אישור והמשך לסלפי'}
        </NewsButton>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => {
            setDraft(null);
            setError(null);
            setPhase('capture');
          }}
          disabled={submitting}
        >
          ↳ צילום מחדש
        </button>
      </div>
      <span className={styles.privacyNote}>
        ▍ נשמרים רק הפרטים שאישרתם. הצילום כבר נמחק.
      </span>
    </article>
  );
}
