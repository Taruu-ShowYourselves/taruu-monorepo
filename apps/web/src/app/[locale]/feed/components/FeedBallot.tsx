'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NewsButton } from '@/components/press/NewsButton';
import { useAuth } from '@/providers/AuthProvider';
import {
  isTerminalRejection,
  submitParticipation,
  type ParticipationRejectionCode,
} from '@/app/[locale]/votes/[id]/flow/submitParticipation';
import type { DeskOption } from '@/components/press/sections/DeskTopicRow';
import styles from './Feed.module.css';

interface FeedBallotProps {
  voteId: string;
  question: string;
  options: DeskOption[];
  totalVotes: number;
  locale: string;
  /** Card anchor, so an auth detour returns the reader to this exact card. */
  anchor: string;
  /** The option the server already holds for this reader, if any. */
  recordedOptionId: string | null;
  onRecorded: (voteId: string, optionId: string) => void;
}

/** sessionStorage key holding a choice made before an auth/verify round-trip. */
const PENDING_KEY = 'taruu-feed-pending';

/**
 * The third deck: casting the ballot without leaving the stream.
 *
 * Guests may choose freely - the choice is held across the sign-in round-trip
 * and the reader comes back to this card - but only the server decides whether
 * a ballot is recorded. Eligibility is never guessed here: the request is
 * attempted and the server's rejection routes the reader, so the feed and the
 * vote page answer to exactly one rule.
 */
export function FeedBallot({
  voteId,
  question,
  options,
  totalVotes,
  locale,
  anchor,
  recordedOptionId,
  onRecorded,
}: FeedBallotProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ParticipationRejectionCode | null>(null);

  const blocked = errorCode !== null && isTerminalRejection(errorCode);

  const recordedText = useMemo(
    () => options.find((option) => option.id === recordedOptionId)?.text ?? null,
    [options, recordedOptionId]
  );

  // Restore a choice parked before a sign-in / verification redirect.
  useEffect(() => {
    if (recordedOptionId) return;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const pending = JSON.parse(raw) as { voteId?: string; optionId?: string };
      if (pending.voteId !== voteId || !pending.optionId) return;
      sessionStorage.removeItem(PENDING_KEY);
      if (options.some((option) => option.id === pending.optionId)) {
        setSelected(pending.optionId);
      }
    } catch {
      /* malformed or unavailable storage - the reader just picks again */
    }
    // Restore once per card; options identity changes with every live tally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteId, recordedOptionId]);

  const parkChoice = useCallback(
    (optionId: string) => {
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ voteId, optionId }));
      } catch {
        /* storage unavailable - the detour just loses the pick */
      }
    },
    [voteId]
  );

  const backHere = `/${locale}/feed#${anchor}`;

  const handleConfirm = useCallback(async () => {
    if (!selected || submitting || blocked) return;

    if (!isAuthenticated) {
      parkChoice(selected);
      router.push(`/${locale}/sign-in?redirect=${encodeURIComponent(backHere)}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setErrorCode(null);
    const result = await submitParticipation({ voteId, optionId: selected });
    setSubmitting(false);

    if (result.status === 'rejected') {
      if (
        result.code === 'RESIDENCY_NOT_VERIFIED' ||
        result.code === 'IDENTITY_NOT_VERIFIED'
      ) {
        parkChoice(selected);
        router.push(`/${locale}/verification?redirect=${encodeURIComponent(backHere)}`);
        return;
      }
      if (result.code === 'UNAUTHENTICATED') {
        parkChoice(selected);
        router.push(`/${locale}/sign-in?redirect=${encodeURIComponent(backHere)}`);
        return;
      }
      setError(result.message);
      setErrorCode(result.code);
      return;
    }

    // The server is the authority on what was recorded - on the
    // already-recorded path that is not always the option just clicked.
    onRecorded(voteId, result.ballot.optionId);
  }, [
    selected,
    submitting,
    blocked,
    isAuthenticated,
    parkChoice,
    router,
    locale,
    backHere,
    voteId,
    onRecorded,
  ]);

  /* ---- already on record: show the standing, not another form ---- */
  if (recordedOptionId) {
    return (
      <div className={styles.ballot}>
        <p className={styles.recordedNote}>
          <span aria-hidden>✓ </span>
          הקול שלכם נרשם: <strong>{recordedText ?? 'עמדה שנרשמה'}</strong>
        </p>

        <ul className={styles.results}>
          {options.map((option) => (
            <li key={option.id} className={styles.resultRow}>
              <span className={styles.resultLabel}>
                {option.id === recordedOptionId ? (
                  <span aria-hidden className={styles.resultMark}>
                    ■
                  </span>
                ) : null}
                {option.text}
              </span>
              <span className={styles.track} aria-hidden>
                <span
                  className={`${styles.fill} ${option.id === recordedOptionId ? styles.fillMine : ''}`}
                  style={{ inlineSize: `${option.pct}%` }}
                />
              </span>
              <span className={styles.resultPct}>{option.pct}%</span>
            </li>
          ))}
        </ul>

        <p className={styles.trust}>
          {totalVotes.toLocaleString('he-IL')} קולות מאומתים · הקול נרשם פעם אחת
          ואי אפשר לשנות אותו.
        </p>

        <Link href={`/${locale}/votes/${voteId}`} className={styles.textLink}>
          לרשומה המלאה ←
        </Link>
      </div>
    );
  }

  /* ---- open ballot ---- */
  return (
    <div className={styles.ballot}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{question}</legend>

        <ul className={styles.options}>
          {options.map((option) => {
            const isSelected = selected === option.id;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                  onClick={() => setSelected(option.id)}
                  aria-pressed={isSelected}
                >
                  <span className={styles.optionTop}>
                    <span aria-hidden className={styles.mark}>
                      {isSelected ? '■' : '□'}
                    </span>
                    <span className={styles.optionLabel}>{option.text}</span>
                    <span className={styles.optionPct}>{option.pct}%</span>
                  </span>
                  <span className={styles.track} aria-hidden>
                    <span
                      className={`${styles.fill} ${isSelected ? styles.fillSelected : ''}`}
                      style={{ inlineSize: `${option.pct}%` }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {!isAuthenticated ? (
        <p className={styles.gateNote}>
          <span aria-hidden>■ </span>
          צריך חשבון כדי לרשום קול. נשמור את הבחירה ונחזיר אתכם בדיוק לכאן.
        </p>
      ) : (
        <p className={styles.trust}>
          הקול נרשם פעם אחת, משויך לתושב מאומת, ואי אפשר לשנות אותו בדיעבד.
        </p>
      )}

      {error ? (
        <p className={styles.errorNote} role="alert">
          <span aria-hidden>■ </span>
          {error}
        </p>
      ) : null}

      <div className={styles.ballotActions}>
        <NewsButton
          variant="red"
          size="lg"
          onClick={handleConfirm}
          disabled={!selected || submitting || blocked}
          trailing={blocked ? undefined : <span aria-hidden>←</span>}
        >
          {blocked
            ? 'ההצבעה סגורה'
            : !isAuthenticated
              ? 'התחברו והצביעו'
              : submitting
                ? 'רושמים את הקול…'
                : 'אשרו והצביעו'}
        </NewsButton>
      </div>
    </div>
  );
}
