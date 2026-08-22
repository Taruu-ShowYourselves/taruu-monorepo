'use client';

/* PROTOTYPE — a lane of exactly N ballot cards, standing still.
 *
 * This is DeskStream with the carousel taken out: the same TopicDialog, the
 * same VoteAuthDialog, the same guest/authenticated split, and none of
 * DeskCarousel, deskDrift, the bento variants or the swipe tutor. Dropping
 * the carousel is what removes every source of automatic motion from the
 * lane — the drift engine was a per-frame scroll.
 */

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/stores/authStore';
import type { Locale } from '@/lib/i18n';
import { BallotCard } from './BallotCard';
import type { DeskEntry } from './TopicDialog';
import type { DeskOption, DeskTopic, VoteAuthRequest } from './DeskTopicRow';
import { topicHeadline } from './deskData';
import styles from './BallotLane.module.css';

/* Both sheets open on a push, never on load, so their code stays out of the
   lane's initial bundle — the same reason DeskStream imports them lazily. */
const TopicDialog = dynamic(
  () => import('./TopicDialog').then((m) => m.TopicDialog),
  { ssr: false }
);
const VoteAuthDialog = dynamic(
  () => import('./VoteAuthDialog').then((m) => m.VoteAuthDialog),
  { ssr: false }
);

const FOR_TEXT = /^(בעד|for)$/i;
const AGAINST_TEXT = /^(נגד|against)$/i;

/**
 * Which side an option names, where it names one at all.
 *
 * Opt-in only: an option whose text is not literally בעד/נגד gets the neutral
 * default, and the gate prints `optionLabel` rather than a side. This is
 * deliberately NOT `standingOf()`, whose `?? unnamed[n]` positional fallback
 * mislabels real three-option ballots.
 */
function sideOf(option: DeskOption): 'for' | 'against' {
  return AGAINST_TEXT.test(option.text.trim()) ? 'against' : 'for';
}

interface BallotLaneProps {
  entries: DeskEntry[];
  locale: Locale;
}

export function BallotLane({ entries, locale }: BallotLaneProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [open, setOpen] = useState<DeskEntry | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [guestVote, setGuestVote] = useState<VoteAuthRequest | null>(null);
  /** voteId → the option this reader already recorded. */
  const [myVotes, setMyVotes] = useState<Record<string, string>>({});

  /* One call for the whole lane rather than one per card: /api/user/votes
     returns the reader's full history, and three cards asking
     /api/votes/[id] individually would be three round-trips for one fact.
     Failure is silent — the cards simply render as not-yet-voted. */
  const loadMyVotes = useCallback(async () => {
    if (!isAuthenticated) {
      setMyVotes({});
      return;
    }
    try {
      const res = await fetch('/api/user/votes', { credentials: 'include' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        history?: { voteId: string; optionId: string }[];
      };
      const next: Record<string, string> = {};
      for (const row of data.history ?? []) next[row.voteId] = row.optionId;
      setMyVotes(next);
    } catch {
      /* Advisory only. A card that cannot prove a vote was cast prints the
         slip, and the server remains the sole authority on double-voting. */
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadMyVotes();
  }, [loadMyVotes]);

  const openTopic = (topic: DeskTopic, optionId?: string) => {
    const entry = entries.find((e) => e.topic.id === topic.id);
    if (!entry) return;
    setIntent(optionId ?? null);
    setOpen(entry);
  };

  /* A tap on a row. It captures the position and hands it to the existing
     secure flow — this component records nothing. */
  const cast = (topic: DeskTopic, option: DeskOption) => {
    const entry = entries.find((e) => e.topic.id === topic.id);
    if (!isAuthenticated) {
      setGuestVote({
        topic,
        intent: sideOf(option),
        optionId: option.id,
        headline: topicHeadline(topic, entry?.ranking),
        /* The gate prints a side by default, which would be a lie on an
           option called "בעד חניון ציבורי". It prefers this when set. */
        optionLabel: option.text,
      });
      return;
    }
    openTopic(topic, option.id);
  };

  const [dialogsLive, setDialogsLive] = useState(false);
  useEffect(() => {
    if (open || guestVote) setDialogsLive(true);
  }, [open, guestVote]);

  return (
    <>
      <ul className={styles.lane}>
        {entries.map((entry, i) => (
          <li key={entry.topic.id} className={styles.slot}>
            <BallotCard
              entry={entry}
              index={i + 1}
              myOptionId={myVotes[entry.topic.id] ?? null}
              onCast={cast}
              onOpen={openTopic}
              locale={locale}
            />
          </li>
        ))}
      </ul>

      {dialogsLive ? (
        <>
          <TopicDialog
            entry={open}
            intentOptionId={intent}
            onClose={() => {
              setOpen(null);
              setIntent(null);
              /* A ballot may have been recorded inside the sheet, so the lane
                 re-reads the reader's history rather than guessing. */
              void loadMyVotes();
            }}
            locale={locale}
          />

          <VoteAuthDialog
            request={guestVote}
            onClose={() => setGuestVote(null)}
            locale={locale}
          />
        </>
      ) : null}
    </>
  );
}
