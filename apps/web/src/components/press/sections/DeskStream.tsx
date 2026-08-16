/* The carousel and the reading room are one unit: a tile has to be able to
   hand the dialog its own record, so the two live behind a single client
   boundary. Server desks (KnessetDesk) hand it plain entries; client desks
   (ConsensusDeskClient) hand it the same shape after ordering them. */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/stores/authStore';
import { DeskCarousel, type DeskCarouselControls } from './DeskCarousel';
import { DeskTopicRow, type DeskTopic, type VoteAuthRequest } from './DeskTopicRow';
import { useDeskPanelActive } from './deskPanelActive';
import type { DeskEntry } from './TopicDialog';
import { slotVariant } from './deskBento';
import type { Locale } from '@/lib/i18n';

export type { DeskEntry };

/* The reading room and the sign-in gate open on a push, never on load - so
   their code (radix dialog, the whole participation flow) has no business in
   the desk's initial bundle, and their closed state has no business in the
   server HTML. They mount on the first push and stay mounted, which keeps
   the exit animations from the second open onward. */
const TopicDialog = dynamic(
  () => import('./TopicDialog').then((m) => m.TopicDialog),
  { ssr: false }
);
const VoteAuthDialog = dynamic(
  () => import('./VoteAuthDialog').then((m) => m.VoteAuthDialog),
  { ssr: false }
);

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
  /**
   * Scenery. The intro's backdrop desk renders the mosaic and nothing else:
   * no dialogs, no auth gate, no drift (see DeskCarousel) - and, critically,
   * no swipe lesson. The decorative desk's tiles used to bid for the tutor
   * and write the taught flag from behind an opacity-0 layer, spending the
   * one lesson a reader gets on a demonstration nobody saw.
   */
  decorative?: boolean;
  /** Scenery that moves: keep the decorative river's drift running. */
  drifting?: boolean;
}

/** One desk's stream of tiles, with the topic dialog they open into. */
export function DeskStream({
  entries,
  label,
  locale,
  onActiveIndexChange,
  controlsRef,
  decorative = false,
  drifting = false,
}: DeskStreamProps) {
  const [open, setOpen] = useState<DeskEntry | null>(null);
  /** The side a swipe carried in, if the dialog was opened by pushing a tile. */
  const [intent, setIntent] = useState<string | null>(null);
  /* Inside the tabbed desk, the hidden edition stays mounted and laid out -
     its tiles intersect like anyone's, and left alone they would bid for the
     one-time swipe lesson from behind visibility:hidden. The lesson only
     goes to a desk somebody is looking at. */
  const panelActive = useDeskPanelActive();

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
    if (decorative) return;
    try {
      setTaught(window.localStorage.getItem(TUTOR_KEY) === '1');
    } catch {
      /* Private browsing, or storage refused. Skip the lesson rather than
         teach it on every visit - the second showing is more annoying than
         the first is useful. */
      setTaught(true);
    }
  }, [decorative]);

  /* Bids are collected for a beat rather than settled on the first one in.
     Several tiles cross the threshold in the same frame when the desk scrolls
     into view, and the observer fires them in DOM order only by accident of
     layout - the first draft handed the lesson to whichever brief happened to
     be fully on screen while the lead was still a few pixels short, and taught
     the gesture on a 1x1 with barely room for the three pills.

     Each bid carries the tile's squared distance from the viewport's centre,
     and the closest bidder wins: the lesson plays on the tile in the middle
     of the screen - the one the reader is actually looking at - whatever the
     scroll position put there. An index-based winner used to hand it to the
     lead of the stretch, which on a carousel mid-travel can be half off the
     edge of the desk, demonstrating the gesture into the void. Ties (two
     tiles equally centred) fall to the lower index, the bigger tile. */
  const bids = useRef<{ index: number; distance: number }[]>([]);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const claimTutor = useCallback((index: number, distance: number) => {
    if (claimed.current) return;
    bids.current.push({ index, distance });
    if (settle.current) return;

    settle.current = setTimeout(() => {
      claimed.current = true;
      const winner = bids.current.reduce((best, bid) =>
        bid.distance < best.distance ||
        (bid.distance === best.distance && bid.index < best.index)
          ? bid
          : best
      );
      setTutorIndex(winner.index);
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

  /* The dialogs mount on the first push and stay: a lazy chunk that unmounts
     on close would re-pay its exit animation every time. */
  const [dialogsLive, setDialogsLive] = useState(false);
  useEffect(() => {
    if (open || guestVote) setDialogsLive(true);
  }, [open, guestVote]);

  return (
    <>
      <DeskCarousel
        label={label}
        locale={locale}
        onActiveIndexChange={onActiveIndexChange}
        controlsRef={controlsRef}
        decorative={decorative}
        drifting={drifting}
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
            onOpen={decorative ? undefined : openTopic}
            tutor={tutorIndex === i}
            onTutorVisible={
              !decorative && panelActive && lessonOpen ? claimTutor : undefined
            }
            onRequireAuth={
              decorative || isAuthenticated ? undefined : setGuestVote
            }
            locale={locale}
          />
        ))}
      </DeskCarousel>

      {dialogsLive ? (
        <>
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
      ) : null}
    </>
  );
}
