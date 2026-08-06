/**
 * The bento tiling rule shared by both desks.
 *
 * Kept out of `DeskTopicRow` on purpose: that module is a client component, so
 * the server-rendered Knesset desk cannot call a function exported from it.
 * This one is plain, boundary-free logic that either side may use.
 */

/**
 * Three tile weights, three depths of story.
 *
 * `lead` fills a 2×2 cell as an ink block: the whole standing, the full
 * evidence, a ballot door. `feature` fills a tall 1×2 column - the whole
 * standing, but at brief typography. `brief` fills a 1×1: the headline, where
 * the count leads, one line of evidence.
 *
 * The variants exist because one card body cannot honestly fill every cell.
 * Rendering the same content at both sizes left the big tile two-thirds empty
 * and overflowed the small one - the evidence strip spilled through the card
 * border, which is how the heat badges ended up floating outside the box.
 */
export type DeskTopicVariant = 'lead' | 'feature' | 'brief';

/** Tiles per bento stretch - see {@link slotVariant} for how they tile. */
const STRETCH = 6;

/**
 * The weight of the tile at this position in the running order.
 *
 * A stretch of six tiles exactly fills five bento columns: the lead takes two
 * whole columns, the feature one, and the four briefs pair up into the last
 * two. Because every column ends up full, the mosaic never opens a hole - the
 * failure mode of mixing spans under `grid-auto-flow: column dense`.
 *
 * Both desks hand their rows in running order - heat-and-locality for the
 * civic desk, editorial heat for the national one - so slot 0 of every stretch
 * is genuinely its top story rather than an arbitrary cell.
 */
export function slotVariant(index: number): DeskTopicVariant {
  const slot = index % STRETCH;
  if (slot === 0) return 'lead';
  if (slot === 1) return 'feature';
  return 'brief';
}
