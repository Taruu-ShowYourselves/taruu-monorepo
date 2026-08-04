/**
 * Engagement hotness — the single scale used everywhere a topic's social
 * heat is printed (press desks, live map, API DTOs).
 *
 * Saturating 0–100 score. Comments weigh 3× a reaction (writing > clicking).
 * 400 engagement points ≈ 50°, and the curve flattens toward 100° so one
 * viral post never dwarfs the rest of the scale.
 */
export function hotnessOf(commentsCount: number, reactionsTotal: number): number {
  const engagement = commentsCount * 3 + reactionsTotal;
  if (engagement <= 0) return 0;
  return Math.min(100, Math.round((100 * engagement) / (engagement + 400)));
}

/** Sum of every per-kind reaction tally, tolerant of missing/partial maps. */
export function reactionsTotalOf(
  reactions: Record<string, number> | null | undefined
): number {
  if (!reactions) return 0;
  return Object.values(reactions).reduce(
    (sum, count) => sum + (Number.isFinite(count) ? count : 0),
    0
  );
}
