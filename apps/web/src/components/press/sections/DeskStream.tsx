/* The carousel and the reading room are one unit: a tile has to be able to
   hand the dialog its own record, so the two live behind a single client
   boundary. Server desks (KnessetDesk) hand it plain entries; client desks
   (ConsensusDeskClient) hand it the same shape after ordering them. */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { DeskCarousel, type DeskCarouselControls } from './DeskCarousel';
import { DeskTopicRow, type DeskTopic, type VoteAuthRequest } from './DeskTopicRow';
import { TopicDialog, type DeskEntry } from './TopicDialog';
import { VoteAuthDialog } from './VoteAuthDialog';
import { slotVariant } from './deskBento';
import type { Locale } from '@/lib/i18n';

export type { DeskEntry };

/**
 * That this reader has already been shown how a tile works.
 *
 * On their device, like the set-aside list: the lesson is about this browser's
 * hands, not about the account, and a reader who has learnt the gesture on
 * their phone should not be taught it again by every desk they open.
 */
const TUTOR_KEY = 'taruu:desk-swipe-taught';

interface DeskStreamProps {
  /** Cards in running order - slot 0 of every stretch is the lead tile. */
  entries: DeskEntry[];
  /** Announced label for the carousel region. */
  label: string;
  locale: Locale;
  /** Index of the entry at the head of the viewport - the dock names it. */
  onActiveIndexChange?: (index: number) => void;
  /** Handle for controls outside the track (the municipality dial). */
  controlsRef?: React.MutableRefObject<DeskCarouselControls | null>;
}

/** One desk's stream of tiles, with the topic dialog they open into. */
export function DeskStream({
  entries,
  label,
  locale,
  onActiveIndexChange,
  controlsRef,
}: DeskStreamProps) {
  const [open, setOpen] = useState<DeskEntry | null>(null);
  /** The side a swipe carried in, if the dialog was opened by pushing a tile. */
  const [intent, setIntent] = useState<string | null>(null);

  /* ---- Who may be counted ---------------------------------------------
     A guest's push opens the sign-in gate instead of the ballot, and the gate
     is rendered once for the whole desk rather than once per tile.

     The flag is taken straight off the store as a single boolean rather than
     out of the auth context, so a desk of a dozen live tiles is not re-rendered
     by every other field of the session. It is restored from storage before
     that session is re-verified, which is the right way round here: this only
     decides which sheet a push opens, and the server remains the sole
     authority on whether a ballot is ever recorded. */
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [guestVote, setGuestVote] = useState<VoteAuthRequest | null>(null);

  /* ---- Who gets taught the gesture ------------------------------------
     The edge cues only appear once a tile is already in hand, which teaches
     nobody who does not know there is anything to take hold of. So exactly one
     tile demonstrates it - and the tile it happens on has to be one the reader
     can see, or the lesson plays somewhere off the side of the desk.

     Rather than nominate an index and hope it is on screen, the tiles bid:
     each watches itself, and the first to come properly into view claims the
     lesson. Whichever tile the desk actually opened on is the one that
     teaches, at any scroll position and on any screen. */
  const [tutorIndex, setTutorIndex] = useState<number | null>(null);
  /* Assume taught until storage says otherwise: the first render is the
     server's, and a lesson that begins before the check would flash on a
     reader who has already had it. */
  const [taught, setTaught] = useState(true);
  const claimed = useRef(false);

  useEffect(() => {
    try {
      setTaught(window.localStorage.getItem(TUTOR_KEY) === '1');
    } catch {
      /* Private browsing, or storage refused. Skip the lesson rather than
         teach it on every visit - the second showing is more annoying than
         the first is useful. */
      setTaught(true);
    }
  }, []);

  /* Bids are collected for a beat rather than settled on the first one in.
     Several tiles cross the threshold in the same frame when the desk scrolls
     into view, and the observer fires them in DOM order only by accident of
     layout - the first draft handed the lesson to whichever brief happened to
     be fully on screen while the lead was still a few pixels short, and taught
     the gesture on a 1x1 with barely room for the three pills.

     The lowest index wins, which is the lead of the stretch: slot 0 is the
     biggest tile on the desk, it carries the hint line without help, and it is
     the one a reader is looking at anyway. */
  const bids = useRef<number[]>([]);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const claimTutor = useCallback((index: number) => {
    if (claimed.current) return;
    bids.current.push(index);
    if (settle.current) return;

    settle.current = setTimeout(() => {
      claimed.current = true;
      setTutorIndex(Math.min(...bids.current));
      try {
        window.localStorage.setItem(TUTOR_KEY, '1');
      } catch {
        /* Nothing to do: it plays this once and is forgotten. */
      }
    }, 250);
  }, []);

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    []
  );

  const lessonOpen = !taught && tutorIndex === null;

  // Opening by id rather than holding the clicked object keeps the dialog on
  // the freshest copy of the record when the desk re-orders under it.
  const openTopic = (topic: DeskTopic, optionId?: string) => {
    const entry = entries.find((e) => e.topic.id === topic.id);
    if (!entry) return;
    setIntent(optionId ?? null);
    setOpen(entry);
  };

  return (
    <>
      <DeskCarousel
        label={label}
        locale={locale}
        onActiveIndexChange={onActiveIndexChange}
        controlsRef={controlsRef}
      >
        {entries.map(({ topic, municipality, heatRank, ranking }, i) => (
          <DeskTopicRow
            key={topic.id}
            topic={topic}
            municipality={municipality}
            index={i}
            heatRank={heatRank}
            ranking={ranking ?? null}
            variant={slotVariant(i)}
            onOpen={openTopic}
            tutor={tutorIndex === i}
            onTutorVisible={lessonOpen ? claimTutor : undefined}
            onRequireAuth={isAuthenticated ? undefined : setGuestVote}
            locale={locale}
          />
        ))}
      </DeskCarousel>

      <TopicDialog
        entry={open}
        intentOptionId={intent}
        onClose={() => {
          setOpen(null);
          setIntent(null);
        }}
        locale={locale}
      />

      <VoteAuthDialog
        request={guestVote}
        onClose={() => setGuestVote(null)}
        locale={locale}
      />
    </>
  );
}
