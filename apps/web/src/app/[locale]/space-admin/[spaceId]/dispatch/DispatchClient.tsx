'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  AudienceFilter,
  AudiencePreviewResponse,
  SendNotificationResponse,
  SpaceNotificationQuota,
} from '@sync/shared/contracts';
import { NewsButton } from '@/components/press/NewsButton';
import { PressInput } from '@/components/press/PressInput/PressInput';
import { PressSelect } from '@/components/press/PressSelect/PressSelect';
import { Receipt } from '@/components/press';
import { ConfirmDialog, disabledButtonClass } from '@/components/space-admin';
import {
  AudiencePreview,
  AudiencePreviewComputing,
} from '@/components/space-admin/AudiencePreview';
import { QuotaBlock } from '@/components/space-admin/QuotaBlock';
import { ReceiptKicker } from '@/components/space-admin/ReceiptKicker';
import { serverSentence } from '@/components/space-admin/serverSentence';
import styles from './page.module.css';

/**
 * Surface 5 - the notification composer, and the eight-state gate in front of
 * the one irreversible thing this dashboard can do.
 *
 * THE POINT OF THIS FILE IS AN ABSENCE: there is no list of recipients in it.
 * `resolveAudience` on the server is the only function in the codebase that
 * decides who receives a space notification; the preview persists what it
 * resolved and fingerprints it; the send re-runs the same resolver and refuses
 * unless both fingerprints still match. So this component cannot dispatch to
 * an audience other than the one it displayed - not because it is careful, but
 * because it holds four counts and an opaque token and has nothing else to
 * send.
 *
 * That token IS the server's content hash of `title + body + audienceFilter`.
 * An edit invalidates it on the server whether or not this client notices,
 * which is what makes the staleness rule below a courtesy to the admin rather
 * than the safety mechanism.
 */

// ---------------------------------------------------------------------------
// Copy deck - one literal per line, so each stays greppable
// ---------------------------------------------------------------------------

const TITLE_LABEL = 'כותרת ההתראה';
const TITLE_HINT = 'עד 60 תווים';
const BODY_LABEL = 'גוף ההודעה';
const BODY_HINT = 'עד 300 תווים';
const AUDIENCE_LABEL = 'קהל יעד';
const AUDIENCE_PLACEHOLDER = '…בחרו קהל';
const PREVIEW_CTA = 'חשבו קהל יעד';
const PREVIEW_PENDING = '…מחשב קהל יעד';
const SEND_CTA = 'שלחו התראה';
const SEND_PENDING = '…שולח';
const SEND_AGAIN = 'שליחת התראה נוספת';

const HINT_NO_PREVIEW = 'חשבו קהל יעד כדי לאפשר שליחה.';
const HINT_NO_RECIPIENTS = 'אין נמענים מאושרים בקהל שבחרתם.';

const SEND_ERROR_HE =
  'ההתראה לא נשלחה, ואף נמען לא קיבל אותה. נסו שוב; אם זה חוזר - פנו למנהל-על.';

/** A failed preview is not in the copy deck; this is the deck's error voice. */
const PREVIEW_ERROR_HE =
  'לא הצלחנו לחשב את הקהל. הנתונים לא נפגעו - נסו שוב; אם זה חוזר, פנו למנהל-על.';

/**
 * The house required-field string, verbatim. It already exists in four other
 * surfaces (`votes/create`, `verification`, the document scan step, the cart)
 * as four local constants; a fifth copy is the honest cost of not starting a
 * repo-wide microcopy extraction from inside a phase-5 plan. Logged as a
 * deferred item.
 */
const MSG_REQUIRED = 'צריך למלא את השדה הזה כדי להמשיך.';

const CONFIRM_HEADING = 'לשלוח את ההתראה?';
const CONFIRM_CONSEQUENCE = 'שליחה אינה ניתנת לביטול או למחיקה.';
const CONFIRM_REASON_LABEL = 'סיבת המשלוח (חובה)';

const ANNOUNCE_STALE = 'ההודעה שונתה. יש לחשב את הקהל מחדש לפני שליחה.';
const ANNOUNCE_EMPTY = 'חושב קהל יעד: אין נמענים מאושרים.';

const AUDIENCE_OPTIONS: { value: AudienceFilter; label: string }[] = [
  { value: 'all_members', label: 'כל חברי המרחב' },
  { value: 'active_vote_participants', label: 'משתתפים בהצבעה פעילה' },
  { value: 'new_members_30d', label: 'חברים חדשים (30 יום)' },
];

/** Mirrors `PreviewAudienceRequestSchema`; the field hints promise both. */
const TITLE_MAX = 60;
const BODY_MAX = 300;

// ---------------------------------------------------------------------------
// The state machine
// ---------------------------------------------------------------------------

export type ComposerState =
  | 'quota_exhausted'
  | 'draft'
  | 'previewing'
  | 'preview_fresh'
  | 'preview_stale'
  | 'preview_empty'
  | 'sent'
  | 'send_failed';

/**
 * The costed preview, plus whether it still describes what is on screen.
 * `banner` carries the server's own refusal sentence when a send was rejected;
 * it is null for a staleness this client noticed itself, which the preview's
 * own shared banner already explains.
 */
interface PreviewState {
  data: AudiencePreviewResponse;
  stale: boolean;
  banner: string | null;
}

/** The three fields the content hash is derived from. */
interface Draft {
  title: string;
  body: string;
  audienceFilter: AudienceFilter | '';
}

interface FieldErrors {
  title?: string;
  body?: string;
  audience?: string;
}

export interface DispatchClientProps {
  spaceId: string;
  /**
   * From `GET …/notifications`. Composer state 0 renders before any preview
   * exists, so `{used}/{limit}` and the reset date cannot come from a preview
   * response - and the send's 429 deliberately carries no figures at all.
   */
  quota: SpaceNotificationQuota;
}

export function DispatchClient({ spaceId, quota }: DispatchClientProps) {
  const router = useRouter();

  const [draft, setDraft] = useState<Draft>({
    title: '',
    body: '',
    audienceFilter: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sent, setSent] = useState<SendNotificationResponse | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  /**
   * The send answered 429. Separate from `quota.used >= quota.limit` because
   * the prop only moves on a server round trip, and the composer has to reach
   * state 0 on the tick the refusal arrives.
   */
  const [quotaHit, setQuotaHit] = useState(false);

  /**
   * Bumped by every edit. A preview that was requested before an edit and
   * arrives after it describes a message that no longer exists, so it must
   * land STALE rather than enabling the send for text the admin has changed.
   * Comparing the counter is enough - the edit funnel is the only writer.
   */
  const editSeq = useRef(0);

  const exhausted = quotaHit || quota.used >= quota.limit;

  /**
   * THE STATE IS DERIVED, NEVER ASSIGNED. Eight names, one expression, in
   * priority order - a `setState('preview_fresh')` buried in a handler is how
   * a send control outlives the preview that justified it.
   */
  const state: ComposerState = useMemo(() => {
    if (sent) return 'sent';
    if (exhausted) return 'quota_exhausted';
    if (previewing) return 'previewing';
    if (sendError) return 'send_failed';
    if (preview) {
      if (preview.stale) return 'preview_stale';
      if (preview.data.approvedRecipients === 0) return 'preview_empty';
      return 'preview_fresh';
    }
    return 'draft';
  }, [sent, exhausted, previewing, sendError, preview]);

  /**
   * The send is enabled in exactly one state. Everywhere else it is disabled
   * with visible unblock text (Rule B) or - at quota and after a send - gone.
   */
  const canSend = state === 'preview_fresh';
  const showSend = state !== 'quota_exhausted' && state !== 'sent';
  const sendHint = canSend
    ? null
    : state === 'preview_empty'
      ? HINT_NO_RECIPIENTS
      : HINT_NO_PREVIEW;

  /**
   * STALENESS FIRES ON CHANGE, NOT ON BLUR, and all three fields go through
   * here - one place where 3 → 4 happens, so no field can forget it.
   */
  const edit = useCallback(
    (patch: Partial<Draft>) => {
      editSeq.current += 1;
      setSendError(null);
      setPreviewError(null);
      setFieldErrors({});
      setDraft((current) => ({ ...current, ...patch }));

      // An edit also drops a refusal sentence the server sent about the
      // PREVIOUS text. The shared stale banner still says what to do; keeping
      // `הקהל השתנה` on screen while the admin rewrites the body would be
      // answering a question they are no longer asking.
      if (preview && (!preview.stale || preview.banner !== null)) {
        if (!preview.stale) setAnnouncement(ANNOUNCE_STALE);
        setPreview({ ...preview, stale: true, banner: null });
      }
    },
    [preview],
  );

  const runPreview = useCallback(async () => {
    const missing: FieldErrors = {};
    if (draft.title.trim() === '') missing.title = MSG_REQUIRED;
    if (draft.body.trim() === '') missing.body = MSG_REQUIRED;
    if (draft.audienceFilter === '') missing.audience = MSG_REQUIRED;
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      return;
    }

    const seq = editSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    setSendError(null);

    try {
      const response = await fetch(
        `/api/space-admin/${spaceId}/notifications/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: draft.title,
            body: draft.body,
            audienceFilter: draft.audienceFilter,
          }),
        },
      );

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setPreviewError(serverSentence(payload) ?? PREVIEW_ERROR_HE);
        return;
      }

      const data = payload as AudiencePreviewResponse;
      const overtaken = editSeq.current !== seq;
      setPreview({ data, stale: overtaken, banner: null });
      setAnnouncement(
        overtaken
          ? ANNOUNCE_STALE
          : data.approvedRecipients === 0
            ? ANNOUNCE_EMPTY
            : `חושב קהל יעד: ${data.approvedRecipients} נמענים מאושרים.`,
      );
    } catch {
      setPreviewError(PREVIEW_ERROR_HE);
    } finally {
      setPreviewing(false);
    }
  }, [draft, spaceId]);

  const runSend = useCallback(
    async (reason: string) => {
      if (!preview || draft.audienceFilter === '') return;
      setSending(true);

      try {
        const response = await fetch(
          `/api/space-admin/${spaceId}/notifications/send`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaignId: preview.data.campaignId,
              previewToken: preview.data.previewToken,
              title: draft.title,
              body: draft.body,
              audienceFilter: draft.audienceFilter,
              reason,
            }),
          },
        );

        const payload: unknown = await response.json().catch(() => null);

        if (response.ok) {
          const result = payload as SendNotificationResponse;
          setSent(result);
          setConfirming(false);
          setAnnouncement(
            `ההתראה נשלחה ל-${result.deliveredRecipients} נמענים. רשומת המשלוח נשמרה ביומן.`,
          );
          router.refresh();
          return;
        }

        // 429 - the quota was spent between the preview and the send. The body
        // carries no figures by design, so the block's numbers come from the
        // prop and the refresh is what makes them current.
        if (response.status === 429) {
          setQuotaHit(true);
          setConfirming(false);
          router.refresh();
          return;
        }

        // 409 - a fingerprint moved, or the campaign had already been sent.
        // All of them return the composer to state 4 carrying THE SERVER'S OWN
        // SENTENCE, which is why this is one branch and not three: the two
        // staleness sentences are already distinct on the wire, and re-typing
        // either here would create a second copy of a string that only a
        // screenshot review would ever catch drifting.
        //
        // 05-09 asks for the sent receipt rather than a banner on the third of
        // them, `ההתראה כבר נשלחה.` - but an error response carries no
        // recipient count, no send time and no remaining quota, so that
        // receipt could only be fabricated. It is also all but unreachable
        // here: every preview inserts its own campaign row, the send disables
        // while a request is in flight, and success leaves the composer
        // entirely. The refresh puts the dispatch into the history list below,
        // where it is visible and true.
        if (response.status === 409) {
          setPreview((existing) =>
            existing
              ? { ...existing, stale: true, banner: serverSentence(payload) }
              : existing,
          );
          setConfirming(false);
          router.refresh();
          return;
        }

        // Anything else is state 7. Nothing is written before the campaign is
        // claimed and the claim precedes the first recipient row, so "no
        // recipient received it" is accurate rather than reassuring. The
        // composer keeps its text; the preview is dropped, because the token
        // it carries can no longer be trusted to describe a live campaign.
        setSendError(SEND_ERROR_HE);
        setPreview(null);
        setConfirming(false);
      } catch {
        setSendError(SEND_ERROR_HE);
        setPreview(null);
        setConfirming(false);
      } finally {
        setSending(false);
      }
    },
    [draft, preview, router, spaceId],
  );

  const reset = useCallback(() => {
    editSeq.current += 1;
    setSent(null);
    setPreview(null);
    setPreviewError(null);
    setSendError(null);
    setFieldErrors({});
    setDraft({ title: '', body: '', audienceFilter: '' });
    setAnnouncement('');
  }, []);

  const live = (
    <p aria-live="polite" className={styles.srOnly}>
      {announcement}
    </p>
  );

  // ------------------------------------------------------------------
  // State 6 - the send receipt replaces the composer
  // ------------------------------------------------------------------
  if (state === 'sent' && sent) {
    return (
      <>
        {live}
        <div className={styles.sent}>
          <Receipt
            kicker={<ReceiptKicker>נשלח · SENT</ReceiptKicker>}
            rows={[
              { label: 'נמענים', value: sent.deliveredRecipients, strong: true },
              {
                label: 'זמן שליחה',
                value: new Date(sent.sentAt).toLocaleString('he-IL', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }),
              },
              {
                label: 'מזהה משלוח',
                value: (
                  <span dir="ltr" title={sent.campaignId}>
                    {sent.campaignId.slice(0, 8)}…
                  </span>
                ),
              },
              { label: 'מכסה שנותרה', value: sent.quotaRemaining },
            ]}
            footer="רשומת המשלוח נשמרה ביומן הפעולות."
          />
          <NewsButton variant="outline" onClick={reset}>
            {SEND_AGAIN}
          </NewsButton>
        </div>
      </>
    );
  }

  // ------------------------------------------------------------------
  // State 0 - the quota is spent
  // ------------------------------------------------------------------
  //
  // The send control is ABSENT rather than disabled, because an exhausted
  // quota is not self-resolvable inside this session; this is the one place
  // where Rule A's absence and Rule B's disabled-with-text agree. The preview
  // CTA is absent for a plainer reason: costing an audience for read-only
  // empty fields could only answer 400.
  const readOnly = state === 'quota_exhausted';

  return (
    <>
      {live}

      {readOnly ? (
        <QuotaBlock used={quota.used} limit={quota.limit} resetDate={quota.resetsAt} />
      ) : null}

      <div className={styles.composer}>
        <div className={styles.fields}>
          <PressInput
            label={TITLE_LABEL}
            hint={TITLE_HINT}
            maxLength={TITLE_MAX}
            value={draft.title}
            readOnly={readOnly}
            error={fieldErrors.title}
            onChange={(event) => edit({ title: event.target.value })}
          />

          <PressInput
            multiline
            rows={4}
            label={BODY_LABEL}
            hint={BODY_HINT}
            maxLength={BODY_MAX}
            value={draft.body}
            readOnly={readOnly}
            error={fieldErrors.body}
            onChange={(event) => edit({ body: event.target.value })}
          />

          {/* `readOnly` does not exist on a select, so state 0 disables it.
              Its unblock text is the QuotaBlock above: this is the composer
              the state table calls read-only, not a Rule B control. */}
          <PressSelect
            label={AUDIENCE_LABEL}
            placeholder={AUDIENCE_PLACEHOLDER}
            options={AUDIENCE_OPTIONS}
            value={draft.audienceFilter}
            disabled={readOnly}
            error={fieldErrors.audience}
            onChange={(event) =>
              edit({ audienceFilter: event.target.value as AudienceFilter })
            }
          />
        </div>

        {/* State 1's always-visible quota line. Absent at state 0, where the
            ink block states the same numbers far more loudly. */}
        {readOnly ? null : (
          <p className={styles.quotaLine}>
            מכסה חודשית · {quota.used}/{quota.limit}
          </p>
        )}

        {previewing ? (
          <div aria-busy="true">
            <AudiencePreviewComputing />
          </div>
        ) : preview ? (
          <AudiencePreview
            approvedRecipients={preview.data.approvedRecipients}
            excludedOptedOut={preview.data.excludedOptedOut}
            excludedNoChannel={preview.data.excludedNoChannel}
            quotaUsed={preview.data.quotaUsed}
            quotaLimit={preview.data.quotaLimit}
            computedAt={preview.data.computedAt}
            stale={preview.stale}
          />
        ) : null}

        {/* The server's own refusal sentence, when a send was rejected for a
            reason the shared stale banner does not describe. */}
        {preview?.banner ? (
          <p className={styles.alert} role="alert">
            <span aria-hidden>✕ </span>
            {preview.banner}
          </p>
        ) : null}

        {previewError ? (
          <p className={styles.alert} role="alert">
            <span aria-hidden>✕ </span>
            {previewError}
          </p>
        ) : null}

        {sendError ? (
          <p className={styles.alert} role="alert">
            <span aria-hidden>✕ </span>
            {sendError}
          </p>
        ) : null}

        {readOnly ? null : (
          <div className={styles.actions}>
            <div className={styles.actionRow}>
              {/* Disabled only while its own request is in flight, with the
                  label swap Rule B's last row specifies. An empty field is
                  answered by a field error on the field itself - a preview CTA
                  disabled until the form is valid would be a seventh disabled
                  state, and Rule B's list is exhaustive. */}
              <NewsButton
                variant="outline"
                className={disabledButtonClass}
                disabled={previewing}
                onClick={() => {
                  void runPreview();
                }}
              >
                {previewing ? PREVIEW_PENDING : PREVIEW_CTA}
              </NewsButton>

              {/* The surface's single page-primary, and the only red button on
                  this dashboard. `lg` is not hierarchy: 19.2px at weight 800
                  clears WCAG's large-text threshold, which is the sole reason
                  a 4.03:1 red fill is permitted for it at all (D8).
                  `disabledButtonClass` is the D17/D27 appearance WITHOUT D23's
                  hover fill - that fix is scoped to `ink`, and this button's
                  own hover already inverts to ink at 16.66:1. */}
              {showSend ? (
                <NewsButton
                  variant="red"
                  size="lg"
                  className={disabledButtonClass}
                  disabled={!canSend || sending}
                  onClick={() => setConfirming(true)}
                >
                  {sending ? SEND_PENDING : SEND_CTA}
                </NewsButton>
              ) : null}
            </div>

            {sendHint ? <p className={styles.hint}>{sendHint}</p> : null}
          </div>
        )}
      </div>

      {preview ? (
        <ConfirmDialog
          kind="irreversible"
          open={confirming}
          onOpenChange={(next) => {
            if (sending) return;
            setConfirming(next);
          }}
          heading={CONFIRM_HEADING}
          body={`ההתראה תישלח ל-${preview.data.approvedRecipients} נמענים מאושרים במרחב.`}
          consequence={CONFIRM_CONSEQUENCE}
          reasonLabel={CONFIRM_REASON_LABEL}
          confirmLabel={SEND_CTA}
          pending={sending}
          pendingLabel={SEND_PENDING}
          onConfirm={(reason) => {
            void runSend(reason);
          }}
        />
      ) : null}
    </>
  );
}
