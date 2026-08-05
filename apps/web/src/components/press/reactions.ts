/**
 * Facebook reaction kinds → press glyphs, in display order.
 * One list for every surface that prints source engagement.
 */
export const REACTION_GLYPHS: readonly (readonly [string, string])[] = [
  ['like', '👍'],
  ['love', '❤️'],
  ['haha', '😆'],
  ['wow', '😮'],
  ['sad', '😢'],
  ['angry', '😡'],
] as const;

/** The `count` loudest reactions on a topic, biggest first, zeros dropped. */
export function topReactions(
  reactions: Record<string, number>,
  count: number
): { kind: string; glyph: string; total: number }[] {
  return REACTION_GLYPHS.map(([kind, glyph]) => ({
    kind,
    glyph,
    total: reactions[kind] ?? 0,
  }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, count);
}

/** Reaction kinds counted as approval of the post. */
export const APPROVING_KINDS: readonly string[] = ['like', 'love', 'haha', 'wow'];
/** Reaction kinds counted as displeasure with what the post reports. */
export const OBJECTING_KINDS: readonly string[] = ['sad', 'angry'];

export interface ReactionSentiment {
  /** Sum of {@link APPROVING_KINDS}. */
  approving: number;
  /** Sum of {@link OBJECTING_KINDS}. */
  objecting: number;
  /** Every counted reaction, including kinds neither bucket knows about. */
  total: number;
}

/** A tally that survived the trip from the source: a finite, non-negative count. */
function counted(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Collapse the six Facebook reaction kinds into the two the press furniture
 * prints: approval and objection.
 *
 * Six emoji plus a comment count is neither one line nor in the art direction
 * ("no emojis - use ■ ▍ ● ✕ ✓ as glyphs"), and at tile size the individual
 * kinds carry no information a reader acts on. Every kind lands in exactly one
 * bucket, so nothing measured is silently dropped, and `total` counts kinds
 * from the source that this build has never heard of.
 */
export function reactionSentiment(
  reactions: Record<string, number>
): ReactionSentiment {
  const sum = (kinds: readonly string[]) =>
    kinds.reduce((acc, kind) => acc + counted(reactions[kind]), 0);

  return {
    approving: sum(APPROVING_KINDS),
    objecting: sum(OBJECTING_KINDS),
    total: Object.values(reactions).reduce<number>((acc, v) => acc + counted(v), 0),
  };
}
