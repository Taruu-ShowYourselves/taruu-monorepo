'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SocialMark } from '@/components/uikit/social-mark';
import { chime } from '@/lib/feedback/chime';
import { localePrefix, type Locale } from '@/lib/i18n';
import {
  shareTopicClipboard,
  shareTopicPayload,
  type ShareTopicFacts,
} from './shareTopic';
import styles from './ConsensusDesk.module.css';

interface ShareTopicButtonProps {
  /** Everything the message prints, minus the URL the button builds itself. */
  facts: Omit<ShareTopicFacts, 'url'>;
  topicId: string;
  locale: Locale;
}

interface ShareCopy {
  label: string;
  copied: string;
  failed: string;
}

const COPY: Record<Locale, ShareCopy> = {
  he: {
    label: 'שיתוף ההצבעה',
    copied: 'הקישור הועתק',
    failed: 'השיתוף לא הושלם',
  },
  en: {
    label: 'Share this ballot',
    copied: 'Link copied',
    failed: 'Share did not complete',
  },
};

/** How long the button reports what it did before going back to being a button. */
const SAID_MS = 2400;

/**
 * Share one ballot.
 *
 * The platform's own share sheet where there is one - that is the path that
 * reaches WhatsApp, which is where an Israeli municipal topic actually
 * travels - and the clipboard everywhere else. Both carry the same message, so
 * a desktop reader pasting into a group posts what a phone would have sent.
 *
 * A cancelled share sheet is not a failure and says nothing: the reader closed
 * it on purpose, and a tile announcing an error over that is the interface
 * arguing with them.
 */
export function ShareTopicButton({ facts, topicId, locale }: ShareTopicButtonProps) {
  const t = COPY[locale];
  const [said, setSaid] = useState<'copied' | 'failed' | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  /* The tile underneath listens for pointerdown with a raw listener and reads
     any 9px of drift as the start of a ballot - and its capture-phase click
     swallow would then eat this button's click, so a slightly sloppy tap on
     the share chip shared nothing and part-cast a vote. A press that starts
     on the chip belongs to the chip. This has to be a native listener on the
     button: React delegates at the root, which the tile's own listener fires
     before, so a synthetic stopPropagation would arrive too late. */
  useEffect(() => {
    const el = buttonRef.current;
    if (!el) return;
    const claim = (event: Event) => event.stopPropagation();
    el.addEventListener('pointerdown', claim);
    return () => el.removeEventListener('pointerdown', claim);
  }, []);

  const report = useCallback((what: 'copied' | 'failed') => {
    setSaid(what);
    window.setTimeout(() => setSaid(null), SAID_MS);
  }, []);

  const share = useCallback(async () => {
    const url = `${window.location.origin}${localePrefix(locale)}/votes/${topicId}`;
    const payload = shareTopicPayload({ ...facts, url }, locale);

    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        /* Dismissing the sheet throws AbortError; that is a decision, not a
           fault. Anything else falls through to the clipboard, which is a
           working share rather than a dead end. */
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareTopicClipboard(payload));
      report('copied');
    } catch {
      report('failed');
    }
  }, [facts, locale, report, topicId]);

  /* The chip answers the tap itself - sound and a pop - before the share
     sheet or the clipboard get a say, so the acknowledgement stays in the
     synchronous part of the click. The pop restarts by reflow: re-setting
     the attribute inside one frame is a no-op to CSS, so the removal is
     flushed first and a second tap mid-bounce still bounces. */
  const press = useCallback(() => {
    chime('pop');
    const el = buttonRef.current;
    if (el) {
      el.removeAttribute('data-pop');
      void el.offsetWidth;
      el.setAttribute('data-pop', '');
    }
    void share();
  }, [share]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={styles.shareTopic}
      onClick={press}
      aria-label={t.label}
      title={t.label}
      data-said={said ?? undefined}
    >
      <SocialMark glyph="share" fillClassName={styles.shareFill} />
      {/* Live region rather than a tooltip: the outcome of a share is the one
          thing here a reader cannot see for themselves. */}
      <span className={styles.shareSaid} role="status">
        {said === 'copied' ? t.copied : said === 'failed' ? t.failed : ''}
      </span>
    </button>
  );
}
