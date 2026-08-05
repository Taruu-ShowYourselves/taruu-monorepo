/** Whole-shekel display: `₪12,847`. Mono/tabular styling is the caller's job. */
export function formatIls(amount: number): string {
  return `₪${Math.round(amount).toLocaleString('he-IL')}`;
}
