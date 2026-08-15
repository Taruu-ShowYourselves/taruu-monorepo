/**
 * The bento tiling rule shared by both desks.
 *
 * Kept out of `DeskTopicRow` on purpose: that module is a client component, so
 * the server-rendered Knesset desk cannot call a function exported from it.
 * This one is plain, boundary-free logic that either side may use.
 */

/**
 * Four tile weights, three depths of story.
 *
 * `lead` fills a 2×2 cell as an ink block: the whole standing, the full
 * evidence, a ballot door. `feature` fills a tall column - the whole standing,
 * but at brief typography. `brief` fills a 1×1: the headline, where the count
 * leads, one line of evidence. `wide` is a brief lying down - the same copy in
 * a 2×1 cell.
 *
 * The variants exist because one card body cannot honestly fill every cell.
 * Rendering the same content at both sizes left the big tile two-thirds empty
 * and overflowed the small one - the evidence strip spilled through the card
 * border, which is how the heat badges ended up floating outside the box.
 *
 * `wide` carries a brief's copy, so it is only ever a shape: two columns of a
 * row, lying under the lead. See the tiling note on {@link slotVariant}.
 */
export type DeskTopicVariant = 'lead' | 'feature' | 'wide' | 'brief';

/** Tiles per bento stretch - see {@link slotVariant} for how they tile. */
const STRETCH = 6;

/**
 * The weight of the tile at this position in the running order.
 *
 * One stretch of six tiles has to fill whole columns, or `grid-auto-flow:
 * column dense` opens a hole - the failure mode this sequence exists to avoid.
 * Over three rows it comes to 12 cells in 4 columns: the lead takes 2×2 with
 * `wide` lying across the two columns beneath it, the feature runs the full
 * height of the third, and the three briefs stack down the fourth.
 *
 * The desk was two rows above 800px until the desktop bento was found to be a
 * lead block followed by a queue of identical squares - at two rows a `wide`
 * has nowhere to lie down, so it sat as a 1×1 and three of the four shapes
 * collapsed into one. Three rows everywhere; only the column width still
 * changes with measure.
 *
 * Both desks hand their rows in running order - heat-and-locality for the
 * civic desk, editorial heat for the national one - so slot 0 of every stretch
 * is genuinely its top story rather than an arbitrary cell.
 */
export function slotVariant(index: number): DeskTopicVariant {
  const slot = index % STRETCH;
  if (slot === 0) return 'lead';
  if (slot === 1) return 'wide';
  if (slot === 2) return 'feature';
  return 'brief';
}
