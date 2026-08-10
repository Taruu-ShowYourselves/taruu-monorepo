'use client';

import { useState } from 'react';
import { GOV_REVIEW_BODY_MIN, type GovReview } from '@sync/shared/contracts';
import { NewsButton } from '@/components/press';
import type { ReviewsCopy } from './copy';
import styles from './Government.module.css';

interface ReviewPanelProps {
  /** URL slug of the member being reviewed - the API addresses them by it. */
  slug: string;
  initialReviews: GovReview[];
  initialCount: number;
  initialAverage: number | null;
  /** Null when nobody is signed in; the form then invites them to sign in. */
  signedIn: boolean;
  signInHref: string;
  dateLocale: string;
  copy: ReviewsCopy;
}

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Citizens' ratings of one member, and the form to leave one.
 *
 * Optimistic only about the shape, never about the outcome: the panel writes
 * through the API and re-renders from what comes back, because the residency
 * rule that decides whether a rating is allowed lives in a database trigger
 * and cannot be evaluated here.
 */
export function ReviewPanel({
  slug,
  initialReviews,
  initialCount,
  initialAverage,
  signedIn,
  signInHref,
  dateLocale,
  copy,
}: ReviewPanelProps) {
  const mine = initialReviews.find((review) => review.isMine) ?? null;

  const [reviews, setReviews] = useState(initialReviews);
  const [count, setCount] = useState(initialCount);
  const [average, setAverage] = useState(initialAverage);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  const hasMine = reviews.some((review) => review.isMine);

  const endpoint = `/api/government/members/${encodeURIComponent(slug)}/reviews`;

  async function send(method: 'POST' | 'DELETE') {
    setError(null);

    if (method === 'POST') {
      if (rating < 1 || rating > 5) {
        setError(copy.needsRating);
        return;
      }
      const trimmed = body.trim();
      if (trimmed.length > 0 && trimmed.length < GOV_REVIEW_BODY_MIN) {
        setError(copy.bodyTooShort);
        return;
      }
    }

    setStatus('saving');
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:
          method === 'POST'
            ? JSON.stringify({
                rating,
                body: body.trim().length > 0 ? body.trim() : null,
              })
            : undefined,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? copy.failed);
        setStatus('idle');
        return;
      }

      const payload = (await response.json()) as {
        reviewCount: number;
        ratingAverage: number | null;
        reviews: GovReview[];
      };
      setReviews(payload.reviews);
      setCount(payload.reviewCount);
      setAverage(payload.ratingAverage);
      if (method === 'DELETE') {
        setRating(0);
        setBody('');
      }
      setStatus('saved');
    } catch {
      setError(copy.failed);
      setStatus('idle');
    }
  }

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(dateLocale, {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(new Date(iso));

  return (
    <div className={styles.reviewPanel}>
      <div>
        <p className={styles.meterNote}>
          {count === 1 ? copy.countOne : `${count} ${copy.countMany}`}
          {average !== null ? ` · ${copy.average} ${average.toFixed(1)} / 5` : null}
        </p>

        {reviews.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyBody}>{copy.empty}</p>
          </div>
        ) : (
          <div className={styles.reviewList}>
            {reviews.map((review) => (
              <article key={review.id} className={styles.review}>
                <div className={styles.reviewHead}>
                  <span aria-hidden className={styles.reviewStars}>
                    {'★'.repeat(review.rating)}
                    {'☆'.repeat(5 - review.rating)}
                  </span>
                  <span>{review.rating} / 5</span>
                  <span>{formatDate(review.createdAt)}</span>
                  {review.isMine ? (
                    <span className={styles.reviewMine}>{copy.mine}</span>
                  ) : null}
                </div>
                {review.body ? (
                  <p className={styles.reviewBody}>{review.body}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className={styles.form}>
        <h3 className={styles.formTitle}>
          {hasMine ? copy.formEdit : copy.formTitle}
        </h3>

        {signedIn ? (
          <>
            <span className={styles.meterLabel}>{copy.ratingLabel}</span>
            <div className={styles.ratingRow}>
              {STARS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={styles.ratingButton}
                  aria-pressed={rating === value}
                  aria-label={`${value} / 5`}
                  onClick={() => setRating(value)}
                >
                  {value}
                </button>
              ))}
            </div>

            <textarea
              className={styles.textarea}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={copy.bodyPlaceholder}
              maxLength={1200}
            />

            <div className={styles.formFoot}>
              <NewsButton
                variant="red"
                size="sm"
                onClick={() => void send('POST')}
                disabled={status === 'saving'}
              >
                {hasMine ? copy.update : copy.submit}
              </NewsButton>

              {hasMine ? (
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => void send('DELETE')}
                  disabled={status === 'saving'}
                >
                  {copy.retract}
                </button>
              ) : null}
            </div>

            {error ? <span className={styles.formError}>{error}</span> : null}
            {!error && status === 'saved' ? (
              <span className={styles.formNote}>{copy.saved}</span>
            ) : null}
            <span className={styles.formNote}>{copy.note}</span>
          </>
        ) : (
          <>
            <p className={styles.formNote}>{copy.signedOut}</p>
            <NewsButton href={signInHref} variant="ink" size="sm">
              {copy.signIn}
            </NewsButton>
          </>
        )}
      </div>
    </div>
  );
}
