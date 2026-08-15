import type { ReactNode } from 'react';
import { THESIS_BEATS } from '@/components/press/CinematicIntro/thesisBeats';
import { ChapterCta, type ChapterCtaKind } from './ChapterCta';
import { Reveal } from './Reveal';
import type { Locale } from '@/lib/i18n';
import styles from './ThesisChapters.module.css';

/**
 * The four claims of the thesis as four standing sections.
 *
 * They used to be beats on a scrub - one claim swapping into the next inside
 * a pinned viewport. Here each claim owns a real section instead: the reader
 * scrolls the argument at their own pace, and the browser's scrollbar tells
 * the truth about how much of it is left. Same copy as the pitch deck's
 * scrubbed intro (thesisBeats.ts is the single source), different delivery.
 *
 * A chapter can carry a backdrop - the part of the product that makes its
 * claim true (the live desk, the scores, the mandate sheet) - hung behind
 * the copy as a full-field layer. Backdrops are evidence, not controls:
 * the wrapper is inert so a decorative desk's buttons never enter the tab
 * order.
 */

interface ChapterCopy {
  sectionAria: string;
  chapterUnit: string;
}

const COPY: Record<Locale, ChapterCopy> = {
  he: {
    sectionAria: 'איך תראו הופכת רעש ציבורי למנדט',
    chapterUnit: 'פרק',
  },
  en: {
    sectionAria: 'How Taruu turns public noise into a mandate',
    chapterUnit: 'Chapter',
  },
};

/** `*text*` marks emphasis in the shared copy; set it in the house stress. */
function withEmphasis(text: string): ReactNode[] {
  return text.split(/\*([^*]+)\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <b key={index} className={styles.stress}>
        {part}
      </b>
    ) : (
      part
    )
  );
}

/**
 * A chapter's evidence layer. A purpose-built stage (BeatStages) hangs as-is;
 * a real component pressed into service as scenery - the live desk - asks for
 * `washed`, which blurs and fades it until it reads as the room the claim is
 * standing in rather than a page fighting for the reader.
 */
export type ChapterBackdrop =
  | ReactNode
  | { node: ReactNode; washed?: boolean }
  | null;

function resolveBackdrop(entry: ChapterBackdrop) {
  if (entry && typeof entry === 'object' && 'node' in entry) return entry;
  return { node: entry as ReactNode, washed: false };
}

/* Each claim ends with the door to the part of the product that makes it
   true, in beat order: the listening claim opens the desks, the majority
   claim opens the ballots, the score claim opens the score sheet, the court
   claim opens the mandate. Location-aware inside ChapterCta. */
const CTA_KINDS: readonly ChapterCtaKind[] = ['desk', 'vote', 'score', 'mandate'];

export function ThesisChapters({
  locale = 'he',
  backdrops = [],
}: {
  locale?: Locale;
  /** Per-chapter evidence layer, index-aligned with the beats; null = plain paper. */
  backdrops?: ChapterBackdrop[];
}) {
  const t = COPY[locale];
  const beats = THESIS_BEATS[locale];

  return (
    <>
      {beats.map((beat, index) => {
        const { node, washed } = resolveBackdrop(backdrops[index] ?? null);
        return (
        <section
          key={beat.head}
          className={styles.chapter}
          /* "hold": the pinned dock stands over the chapters while they are
             on screen and tucks away elsewhere - see Masthead. */
          data-nav-reveal="hold"
          aria-label={`${t.sectionAria} - ${t.chapterUnit} ${index + 1}`}
        >
          <Reveal />
          {node ? (
            <div
              className={`${styles.backdrop} ${washed ? styles.washed : ''}`}
              aria-hidden
              inert
            >
              {washed ? (
                <div className={styles.washInner}>{node}</div>
              ) : (
                node
              )}
            </div>
          ) : null}
          <div className={styles.copy}>
            <h2 className={styles.head}>{withEmphasis(beat.head)}</h2>
            {beat.note ? (
              <p className={styles.note}>{withEmphasis(beat.note)}</p>
            ) : null}
            <ChapterCta kind={CTA_KINDS[index]} locale={locale} />
          </div>
        </section>
        );
      })}
    </>
  );
}
