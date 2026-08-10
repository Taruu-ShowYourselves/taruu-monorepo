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
 * `wide` carries a brief's copy, so it is only ever a shape: the stylesheet
 * gives it two columns on the three-row phone bento and lets it sit as a plain
 * 1×1 on the two-row desktop one. See the tiling note on {@link slotVariant}.
 */
export type DeskTopicVariant = 'lead' | 'feature' | 'wide' | 'brief';

/** Tiles per bento stretch - see {@link slotVariant} for how they tile. */
const STRETCH = 6;

/**
 * The weight of the tile at this position in the running order.
 *
 * One stretch of six tiles has to fill whole columns at both row counts, or
 * `grid-auto-flow: column dense` opens a hole - the failure mode this sequence
 * exists to avoid. It does, and the shapes differ between them:
 *
 * - Two rows (desktop, 10 cells / 5 columns). `wide` sits as a 1×1. The lead
 *   takes two whole columns, the feature one, and the four remaining 1×1 tiles
 *   pair up into the last two.
 * - Three rows (phone, 12 cells / 4 columns). The lead takes 2×2 with `wide`
 *   lying across the two columns beneath it, the feature runs the full height
 *   of the third, and the three briefs stack down the fourth.
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
