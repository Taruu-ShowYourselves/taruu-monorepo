/**
 * The contract between a scrubbed section and the page's pager.
 *
 * A section whose content is played by a scroll timeline rather than laid out
 * in the DOM - the cinematic runway is one 430svh block with five claims
 * scrubbed through it - has nothing in the document to tell the pager where
 * its stopping places are. Divided into screens it stepped out of phase with
 * the beats and carried two claims past the reader on one swipe.
 *
 * Such a section publishes its own stops as document scroll positions on
 * `data-snap-stops` and announces the change; the pager reads them and folds
 * them into its list. The timeline is the only thing that knows the mapping,
 * so it is the thing that says.
 */
export const SNAP_STOPS_EVENT = 'taruu:snap-stops';
export const SNAP_STOPS_ATTR = 'data-snap-stops';
export const SNAP_RANGE_ATTR = 'data-snap-range';

/** Parses the published attribute into scroll positions, dropping junk. */
export function readPublishedStops(root: ParentNode): number[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[${SNAP_STOPS_ATTR}]`))
    .flatMap((el) => (el.dataset.snapStops ?? '').split(','))
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value));
}

export interface ScrollRange {
  start: number;
  end: number;
}

/**
 * The spans the published stops govern, in document scroll positions.
 *
 * A runway's element box is not this span: the site layer is docked over the
 * opening intro with a negative margin, so that intro's box covers the first
 * two desks, and suppressing stops by box swallowed desks the reader has to
 * be able to rest on. The runway declares the range its own scroll timeline
 * occupies instead - the only span where a rest would land mid-transition.
 */
export function readNoRestRanges(root: ParentNode): ScrollRange[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[${SNAP_RANGE_ATTR}]`))
    .map((el) => (el.dataset.snapRange ?? '').split(','))
    .map(([start, end]) => ({
      start: Number.parseFloat(start),
      end: Number.parseFloat(end),
    }))
    .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end));
}
