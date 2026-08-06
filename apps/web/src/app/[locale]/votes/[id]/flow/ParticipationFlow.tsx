'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { NewsButton } from '@/components/press/NewsButton';
import { Stepper, Receipt } from '@/components/press';
import { useReducedMotion, useVotingGate } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import {
  submitParticipation,
  isTerminalRejection,
  type ParticipationRejectionCode,
  type RecordedBallot,
} from './submitParticipation';
import styles from './ParticipationFlow.module.css';
import { localePrefix } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
export interface FlowOption {
  id: string;
  text: string;
  votes: number;
}

interface ParticipationFlowProps {
  voteId: string;
  voteTitle: string;
  options: FlowOption[];
  totalVotes: number;
  /** Pre-selected option (e.g. restored from a deep-link). */
  initialOptionId?: string | null;
  /** Fired when the receipt is dismissed, with the recorded option id, so the page can flip to results. */
  onComplete: (optionId: string) => void;
}

type Stage = 'choice' | 'confirm' | 'receipt';

const STEPS: Record<Locale, { label: string }[]> = {
  he: [{ label: 'בחירה' }, { label: 'אישור' }, { label: 'רישום' }],
  en: [{ label: 'Choice' }, { label: 'Confirm' }, { label: 'Record' }],
};

const STAGE_INDEX: Record<Stage, number> = {
  choice: 0,
  confirm: 1,
  receipt: 2,
};

/** sessionStorage key for restoring a choice across an auth/verify round-trip. */
const PENDING_KEY = 'taruu-pending-vote';

interface FlowCopy {
  choiceAria: string;
  choiceKicker: string;
  choiceTitle: string;
  votesUnit: string;
  choiceTrust: string;
  continueCta: string;
  /** CTA arrow is direction-semantic: forward points left in RTL, right in LTR. */
  ctaGlyph: string;
  confirmAria: string;
  confirmKicker: string;
  confirmTitle: string;
  confirmLead: string;
  ballotKicker: string;
  positionLabel: string;
  /** Receipt footer prefix: `${votePrefix} ${voteId}`. */
  votePrefix: string;
  confirmTrust: string;
  gateNote: string;
  /** Score gate composes `${scoreGatePrefix}${have}${scoreGateMid}${need}${scoreGateSuffix}`. */
  scoreGatePrefix: string;
  scoreGateMid: string;
  scoreGateSuffix: string;
  scoreGateResidency: string;
  scoreGateCta: string;
  ctaClosed: string;
  ctaSignIn: string;
  ctaSubmitting: string;
  ctaConfirm: string;
  /** Includes its leading back glyph - mirrored between RTL and LTR. */
  backToChoice: string;
  receiptAria: string;
  receiptKicker: string;
  recordedTitleLead: string;
  recordedTitleMark: string;
  alreadyLead: string;
  freshLead: string;
  receiptCardKicker: string;
  receiptCardTitle: string;
  statusLabel: string;
  statusRecorded: string;
  recordNumberLabel: string;
  receiptTrust: string;
  resultsCta: string;
}

const COPY: Record<Locale, FlowCopy> = {
  he: {
    choiceAria: 'בחירת עמדה',
    choiceKicker: 'שלב 01 · בחירה',
    choiceTitle: 'בחרו את עמדתכם',
    votesUnit: 'קולות',
    choiceTrust: 'הקול שלכם נרשם פעם אחת ומשויך לתושב מאומת. אי אפשר לשנות אותו בדיעבד.',
    continueCta: 'המשיכו · אישור',
    ctaGlyph: '←',
    confirmAria: 'אישור הקול',
    confirmKicker: 'שלב 02 · אישור',
    confirmTitle: 'אשרו את הקול שלכם',
    confirmLead:
      'נדרש אימות זהות ותושבוּת חד-פעמי, כדי שכל קול ישויך לתושב אמיתי אחד. הקול נרשם פעם אחת ואי אפשר לשנות אותו.',
    ballotKicker: 'פתק הצבעה · BALLOT',
    positionLabel: 'עמדה',
    votePrefix: 'הצבעה',
    confirmTrust: 'מאומת זהות ותושבוּת · נרשם פעם אחת.',
    gateNote: 'צריך חשבון כדי להשלים. נשמור את הבחירה שלכם ונחזיר אתכם לכאן.',
    scoreGatePrefix: 'הקול לא יירשם עדיין: יש לכם ',
    scoreGateMid: ' מתוך ',
    scoreGateSuffix: ' נקודות האימות הדרושות להצבעה.',
    scoreGateResidency: 'אימות התושבוּת שווה 40 נקודות - הצ׳ק-אין הראשון פותח את הקלפי.',
    scoreGateCta: 'להשלמת האימות ←',
    ctaClosed: 'ההצבעה סגורה',
    ctaSignIn: 'התחברו והשלימו',
    ctaSubmitting: 'רושמים את הקול…',
    ctaConfirm: 'אשרו והצביעו',
    backToChoice: '↳ חזרה לבחירה',
    receiptAria: 'קבלה ורישום',
    receiptKicker: 'שלב 03 · רישום',
    recordedTitleLead: 'הקול שלכם ',
    recordedTitleMark: 'נרשם.',
    alreadyLead: 'כבר הצבעתם בהצבעה הזו. זה הרישום הקיים שלכם: ',
    freshLead: 'הרישום הושלם. בחרתם: ',
    receiptCardKicker: 'קבלה · RECEIPT',
    receiptCardTitle: 'רישום השתתפות',
    statusLabel: 'סטטוס',
    statusRecorded: 'נרשם',
    recordNumberLabel: 'מספר רישום',
    receiptTrust: 'הרישום נשמר בשרת ומשויך לתושב מאומת אחד.',
    resultsCta: 'צפו בתוצאות',
  },
  en: {
    choiceAria: 'Choosing a position',
    choiceKicker: 'Step 01 · Choice',
    choiceTitle: 'Choose your position',
    votesUnit: 'votes',
    choiceTrust: 'Your vote is recorded once and linked to a verified resident. It cannot be changed afterwards.',
    continueCta: 'Continue · Confirm',
    ctaGlyph: '→',
    confirmAria: 'Confirming the vote',
    confirmKicker: 'Step 02 · Confirm',
    confirmTitle: 'Confirm your vote',
    confirmLead:
      'A one-time identity and residency verification is required, so that every vote is linked to one real resident. The vote is recorded once and cannot be changed.',
    ballotKicker: 'BALLOT',
    positionLabel: 'Position',
    votePrefix: 'Vote',
    confirmTrust: 'Identity and residency verified · recorded once.',
    gateNote: 'An account is required to complete this step. Your choice will be saved and you will be returned here.',
    scoreGatePrefix: 'Your vote cannot be recorded yet: you hold ',
    scoreGateMid: ' of the ',
    scoreGateSuffix: ' verification points a ballot requires.',
    scoreGateResidency: 'The residency check is worth 40 points — the first check-in opens the ballot.',
    scoreGateCta: 'Finish verification →',
    ctaClosed: 'Voting is closed',
    ctaSignIn: 'Sign in to complete',
    ctaSubmitting: 'Recording your vote…',
    ctaConfirm: 'Confirm and vote',
    backToChoice: '↲ Back to choice',
    receiptAria: 'Receipt and record',
    receiptKicker: 'Step 03 · Record',
    recordedTitleLead: 'Your vote is ',
    recordedTitleMark: 'recorded.',
    alreadyLead: 'You have already voted in this vote. This is your existing record: ',
    freshLead: 'The record is complete. You chose: ',
    receiptCardKicker: 'RECEIPT',
    receiptCardTitle: 'Participation record',
    statusLabel: 'Status',
    statusRecorded: 'Recorded',
    recordNumberLabel: 'Record number',
    receiptTrust: 'The record is stored on the server and linked to one verified resident.',
    resultsCta: 'View results',
  },
};

/**
 * ParticipationFlow - the press ballot, reshaped (UX flow J2). Choice →
 * confirmation → server-recorded receipt. Residency is verified ONCE
 * elsewhere (/verification), so there is no per-vote GPS step.
 *
 * Only the sign-in gate is evaluated client-side, because "no session" is
 * unambiguous here. Residency is decided solely by the server: the client's
 * `isEligibleToVote` depends on `checkInsCompleted`, which this screen never
 * loads, so gating on it turned away residents the server accepts. A 403
 * routes them to /verification instead. Guests pick freely, and the selected
 * option is persisted across either round-trip so nothing is lost. The ballot
 * is persisted by
 * `POST /api/votes/[id]/participate` - via `submitParticipation` - before the
 * receipt is shown; nothing here is chain-anchored.
 */
export function ParticipationFlow({
  voteId,
  options,
  totalVotes,
  initialOptionId = null,
  onComplete,
}: ParticipationFlowProps) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { isAuthenticated } = useAuthStore();
  // Locale-less detour targets get a 307 from the locale middleware, and the
  // redirect back here is dropped with the query string - so build them
  // already localised.
  const params = useParams<{ locale?: Locale }>();
  const locale = params?.locale ?? 'he';
  const t = COPY[locale];

  const [stage, setStage] = useState<Stage>('choice');
  const [selectedOption, setSelectedOption] = useState<string | null>(initialOptionId);
  const [ballot, setBallot] = useState<RecordedBallot | null>(null);
  const [alreadyRecorded, setAlreadyRecorded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitErrorCode, setSubmitErrorCode] = useState<ParticipationRejectionCode | null>(null);

  /** A rejection retrying cannot fix - the confirm button stops offering one. */
  const isBlocked = submitErrorCode !== null && isTerminalRejection(submitErrorCode);

  /**
   * The score gate, told to the reader the moment they open a ballot rather
   * than after they have chosen a position and pressed confirm.
   *
   * Read from the server (`useVotingGate`), never inferred here: residency is
   * 40 of the 80 points and its signal is not on this screen, which is exactly
   * the guess that once turned eligible residents away. Null - loading, or a
   * guest - prints nothing, and the notice never disables the ballot. It
   * informs; the server still decides, and still routes a 403 to /verification
   * with the choice preserved.
   */
  const gate = useVotingGate(isAuthenticated);
  const scoreGate =
    gate && !gate.canVote ? (
      <div className={styles.scoreGate} role="status">
        <p className={styles.scoreGateLine}>
          <span aria-hidden>■ </span>
          {t.scoreGatePrefix}
          <strong>{gate.total}</strong>
          {t.scoreGateMid}
          <strong>{gate.required}</strong>
          {t.scoreGateSuffix}
        </p>
        {!gate.residencyVerified && (
          <p className={styles.scoreGateMeta}>{t.scoreGateResidency}</p>
        )}
        <Link
          href={`${localePrefix(locale)}/verification?redirect=${encodeURIComponent(
            `${localePrefix(locale)}/votes/${voteId}`
          )}`}
          className={styles.scoreGateCta}
          // Wrapped, not passed: `persistPending` is declared further down and
          // this element is built during render, before that binding exists.
          onClick={() => persistPending()}
        >
          {t.scoreGateCta}
        </Link>
      </div>
    ) : null;

  const selectedText = useMemo(
    () => options.find((o) => o.id === selectedOption)?.text ?? '',
    [options, selectedOption]
  );

  /**
   * The position the SERVER recorded - which is not always the one just
   * clicked. On the already-recorded path the API returns the existing
   * ballot, so a resident who voted differently before would otherwise be
   * shown a position they never cast. The receipt states server facts only.
   */
  const recordedText = useMemo(
    () => (ballot ? (options.find((o) => o.id === ballot.optionId)?.text ?? '') : ''),
    [options, ballot]
  );

  const recordedAt = useMemo(
    () =>
      ballot
        ? new Date(ballot.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
        : '',
    [ballot]
  );

  // Restore a choice persisted before an auth/verify redirect (or ?option=…),
  // and jump straight back to the payment step so the round-trip is seamless.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let restored: string | null = null;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) {
        const pending = JSON.parse(raw) as { voteId?: string; optionId?: string };
        if (pending.voteId === voteId && pending.optionId) restored = pending.optionId;
        sessionStorage.removeItem(PENDING_KEY);
      }
    } catch {
      /* ignore malformed cache */
    }
    if (!restored) {
      restored = new URLSearchParams(window.location.search).get('option');
    }
    if (restored && options.some((o) => o.id === restored)) {
      setSelectedOption(restored);
      setStage('confirm');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Persist the choice so it survives a sign-in / verification redirect. */
  const persistPending = useCallback(() => {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ voteId, optionId: selectedOption }));
    } catch {
      /* storage unavailable - non-fatal */
    }
  }, [voteId, selectedOption]);

  /* Motion props must never remove themselves. `useReducedMotion` starts false
     and flips in an effect, so a `reduced ? {} : {…}` ternary paints the hidden
     `initial` state on the first frame and then drops the `animate` that would
     have revealed it - the ballot stayed at `opacity: 0` forever for every
     reader who asked for less motion. The end state is unconditional; only the
     entrance is optional. */
  const stepAnim = {
    initial: reduced ? false : { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
    animate: { opacity: 1, clipPath: 'inset(0 0 0% 0)' },
    transition: { duration: reduced ? 0 : 0.22, ease: [0.2, 0, 0, 1] as const },
  };

  /* ---- Step 1: choice (open to guests) ---- */
  const handleConfirmChoice = useCallback(() => {
    if (!selectedOption) return;
    setStage('confirm');
  }, [selectedOption]);

  /* ---- Step 2: server-confirmed recording ---- */
  const recordVote = useCallback(async () => {
    if (!selectedOption || submitting || isBlocked) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitErrorCode(null);
    const result = await submitParticipation({ voteId, optionId: selectedOption });
    setSubmitting(false);
    if (result.status === 'rejected') {
      // The server is the only authority on eligibility. When it says the
      // resident still needs to verify, route them there rather than leaving
      // them staring at an error they cannot clear from this screen.
      if (result.code === 'RESIDENCY_NOT_VERIFIED' || result.code === 'IDENTITY_NOT_VERIFIED') {
        persistPending();
        router.push(
          `${localePrefix(locale)}/verification?redirect=${encodeURIComponent(`${localePrefix(locale)}/votes/${voteId}`)}`
        );
        return;
      }
      if (result.code === 'UNAUTHENTICATED') {
        persistPending();
        router.push(
          `${localePrefix(locale)}/sign-in?redirect=${encodeURIComponent(`${localePrefix(locale)}/votes/${voteId}`)}`
        );
        return;
      }
      setSubmitError(result.message);
      setSubmitErrorCode(result.code);
      return; // stay on 'confirm'; no receipt, no onComplete
    }
    setBallot(result.ballot);
    setAlreadyRecorded(result.alreadyRecorded);
    setStage('receipt');
  }, [selectedOption, submitting, isBlocked, voteId, locale, persistPending, router]);

  const handleConfirm = useCallback(async () => {
    if (!selectedOption) return;

    const back = encodeURIComponent(`${localePrefix(locale)}/votes/${voteId}`);
    // Sign-in is gated client-side because the answer is unambiguous here: no
    // session means no request worth making.
    //
    // Residency is NOT gated client-side. `isEligibleToVote` reads
    // `verificationStatus.checkInsCompleted`, which only `/api/verification/status`
    // ever populates and which the vote page never fetches - so on this screen
    // it is always undefined and the client rule collapses to "fully verified".
    // The server's rule is broader (verified OR at least one check-in), which is
    // the actual product decision. Gating on the narrower client value blocked
    // residents the server would have accepted. The request is attempted and
    // the server's 403 routes them, so there is exactly one eligibility rule.
    if (!isAuthenticated) {
      persistPending();
      router.push(`${localePrefix(locale)}/sign-in?redirect=${back}`);
      return;
    }

    await recordVote();
  }, [selectedOption, voteId, locale, recordVote, isAuthenticated, persistPending, router]);

  /* ------------------------------------------------------------------ */
  return (
    <div className={styles.flow}>
      <Stepper steps={STEPS[locale]} current={STAGE_INDEX[stage]} />

      <motion.div key={stage} className={styles.stage} {...stepAnim}>
        {/* ---- STEP 1 - בחירה ---- */}
        {stage === 'choice' && (
          <section className={styles.panel} aria-label={t.choiceAria}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {t.choiceKicker}
            </span>
            <h2 className={styles.panelTitle}>{t.choiceTitle}</h2>

            <ul className={styles.options}>
              {options.map((o) => {
                const isSel = selectedOption === o.id;
                const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={`${styles.option} ${isSel ? styles.optionSel : ''}`}
                      onClick={() => setSelectedOption(o.id)}
                      aria-pressed={isSel}
                    >
                      <span className={styles.optionTop}>
                        <span className={styles.mark} aria-hidden>
                          {isSel ? '■' : '□'}
                        </span>
                        <span className={styles.optionLabel}>{o.text}</span>
                        <span className={styles.pct}>{pct}%</span>
                      </span>
                      <span className={styles.track} aria-hidden>
                        <motion.span
                          className={`${styles.fill} ${isSel ? styles.fillSel : ''}`}
                          initial={reduced ? false : { width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: reduced ? 0 : 0.7, ease: [0.2, 0, 0, 1] }}
                        />
                      </span>
                      <span className={styles.optionCount}>
                        {o.votes.toLocaleString('he-IL')} {t.votesUnit}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {scoreGate}

            <p className={styles.trust}>
              {t.choiceTrust}
            </p>

            <div className={styles.actions}>
              <NewsButton
                variant="red"
                size="lg"
                className={styles.cta}
                onClick={handleConfirmChoice}
                disabled={!selectedOption}
                trailing={<span aria-hidden>{t.ctaGlyph}</span>}
              >
                {t.continueCta}
              </NewsButton>
            </div>
          </section>
        )}

        {/* ---- STEP 2 - אישור ---- */}
        {stage === 'confirm' && (
          <section className={styles.panel} aria-label={t.confirmAria}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {t.confirmKicker}
            </span>
            <h2 className={styles.panelTitle}>{t.confirmTitle}</h2>

            <p className={styles.lead}>
              {t.confirmLead}
            </p>

            <Receipt
              className={styles.receipt}
              kicker={t.ballotKicker}
              rows={[{ label: t.positionLabel, value: selectedText || '-', strong: true }]}
              footer={`${t.votePrefix} ${voteId}`}
            />

            <p className={styles.trust}>{t.confirmTrust}</p>

            {/* Gate notice - only for the one gate this screen can answer.
                Residency is decided by the server; guessing it here would
                tell an eligible resident to go verify something they already
                have. If the server disagrees, it routes them to /verification
                with the choice preserved. */}
            {!isAuthenticated && (
              <p className={styles.gateNote}>
                <span aria-hidden>■ </span>
                {t.gateNote}
              </p>
            )}

            {scoreGate}

            {submitError && (
              <p className={styles.errorNote} role="alert">
                <span aria-hidden>■ </span>
                {submitError}
              </p>
            )}

            <div className={styles.actions}>
              <NewsButton
                variant="red"
                size="lg"
                className={styles.cta}
                onClick={handleConfirm}
                disabled={submitting || isBlocked}
                trailing={isBlocked ? undefined : <span aria-hidden>{t.ctaGlyph}</span>}
              >
                {isBlocked
                  ? t.ctaClosed
                  : !isAuthenticated
                    ? t.ctaSignIn
                    : submitting
                      ? t.ctaSubmitting
                      : t.ctaConfirm}
              </NewsButton>
              <button
                type="button"
                className={styles.backLink}
                onClick={() => setStage('choice')}
                disabled={submitting}
              >
                {t.backToChoice}
              </button>
            </div>
          </section>
        )}

        {/* ---- STEP 3 - רישום ---- */}
        {stage === 'receipt' && ballot && (
          <section className={styles.panel} aria-label={t.receiptAria}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {t.receiptKicker}
            </span>
            <h2 className={styles.panelTitle}>
              {t.recordedTitleLead}<span className={styles.red}>{t.recordedTitleMark}</span>
            </h2>
            <p className={styles.lead}>
              {alreadyRecorded ? (
                <>
                  {t.alreadyLead}<strong>{recordedText}</strong>.
                </>
              ) : (
                <>
                  {t.freshLead}<strong>{recordedText}</strong>.
                </>
              )}
            </p>

            <Receipt
              className={styles.receipt}
              kicker={t.receiptCardKicker}
              title={t.receiptCardTitle}
              rows={[
                { label: t.positionLabel, value: recordedText || '-' },
                { label: t.statusLabel, value: t.statusRecorded, strong: true },
                { label: t.recordNumberLabel, value: ballot.id },
              ]}
              footer={`${t.votePrefix} ${voteId} · ${recordedAt}`}
            />

            <p className={styles.trust}>{t.receiptTrust}</p>

            <div className={styles.actions}>
              <NewsButton
                variant="red"
                size="lg"
                className={styles.cta}
                onClick={() => onComplete(ballot.optionId)}
                trailing={<span aria-hidden>{t.ctaGlyph}</span>}
              >
                {t.resultsCta}
              </NewsButton>
            </div>
          </section>
        )}
      </motion.div>
    </div>
  );
}
