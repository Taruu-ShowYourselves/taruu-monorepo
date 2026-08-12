'use client';

import { useCallback, useState } from 'react';
import { SocialMark } from '@/components/uikit/social-mark';
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

  return (
    <button
      type="button"
      className={styles.shareTopic}
      onClick={share}
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
