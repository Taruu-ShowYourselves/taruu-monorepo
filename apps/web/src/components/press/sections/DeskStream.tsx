/* The carousel and the reading room are one unit: a tile has to be able to
   hand the dialog its own record, so the two live behind a single client
   boundary. Server desks (KnessetDesk) hand it plain entries; client desks
   (ConsensusDeskClient) hand it the same shape after ordering them. */
'use client';

import { useState } from 'react';
import { DeskCarousel } from './DeskCarousel';
import { DeskTopicRow, type DeskTopic } from './DeskTopicRow';
import { TopicDialog, type DeskEntry } from './TopicDialog';
import { slotVariant } from './deskBento';
import type { Locale } from '@/lib/i18n';

export type { DeskEntry };

interface DeskStreamProps {
  /** Cards in running order - slot 0 of every stretch is the lead tile. */
  entries: DeskEntry[];
  /** Announced label for the carousel region. */
  label: string;
  locale: Locale;
}

/** One desk's stream of tiles, with the topic dialog they open into. */
export function DeskStream({ entries, label, locale }: DeskStreamProps) {
  const [open, setOpen] = useState<DeskEntry | null>(null);

  // Opening by id rather than holding the clicked object keeps the dialog on
  // the freshest copy of the record when the desk re-orders under it.
  const openTopic = (topic: DeskTopic) => {
    const entry = entries.find((e) => e.topic.id === topic.id);
    if (entry) setOpen(entry);
  };

  return (
    <>
      <DeskCarousel label={label} locale={locale}>
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
            locale={locale}
          />
        ))}
      </DeskCarousel>

      <TopicDialog entry={open} onClose={() => setOpen(null)} locale={locale} />
    </>
  );
}
