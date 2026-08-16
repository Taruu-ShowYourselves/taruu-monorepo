/**
 * The municipality profile's figure helpers.
 *
 * They moved to `@/lib/civic/score` when the government pages arrived: a
 * member of Knesset and a city are printed on the same −100..+100 scale, and
 * two copies of "what counts as a positive score" would eventually disagree.
 * Re-exported from here so this page's imports keep reading as page-local.
 */

export {
  EM_DASH,
  formatScore,
  median,
  percent,
  scoreBand,
  trackGeometry,
  type Band,
} from '@/lib/civic/score';
