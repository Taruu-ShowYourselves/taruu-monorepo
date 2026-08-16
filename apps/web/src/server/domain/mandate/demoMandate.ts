/**
 * A mandate to present with, when there is not yet one to read.
 *
 * The register is real and empty: 267 ballots are open and none has closed, so
 * every surface that prints decisions prints "המנדט עוד ריק". True, and
 * useless in a room where the point is to show what the register looks like
 * once it fills.
 *
 * So this: a fixed, invented mandate, reachable only by asking for it
 * (`?demo=1`) and never by default. Two rules hold it honest, and both are
 * enforced by the surfaces that render it rather than by convention here:
 *
 * 1. It is always stamped. Every screen that shows these rows also shows that
 *    they are a demonstration, in the same eyeline as the figures. A
 *    screenshot of this must not be able to pass as a counted decision.
 * 2. It never touches the ledger. Nothing here is written, cached as real, or
 *    counted into a total; it is substituted at the last moment, in the view.
 *
 * The topics are written for this file rather than lifted from live ballots -
 * attaching invented majorities to a real town's open question is exactly the
 * misreading the stamp exists to prevent, and there is no reason to court it.
 */

import type { MandateDecision, MandateTotals } from './mandate';

/** Marks a run of any mandate surface as a demonstration. */
export const DEMO_QUERY_FLAG = 'demo';

export const DEMO_MANDATE: readonly MandateDecision[] = [
  {
    voteId: 'demo-haifa-shade',
    title: 'הצללה ומחסה בתחנות האוטובוס בעיר',
    scope: 'municipal',
    municipality: 'חיפה',
    position: 'בעד הקמת הצללה בכל תחנה עירונית תוך שנה',
    share: 87,
    margin: 74,
    ballots: 1240,
    standing: 'decided',
    endDate: '2026-07-19T21:00:00.000Z',
  },
  {
    voteId: 'demo-knesset-rent',
    title: 'פיקוח על מחירי שכירות באזורי ביקוש',
    scope: 'national',
    municipality: 'כנסת ישראל',
    position: 'בעד חקיקת פיקוח על שכר דירה באזורי ביקוש',
    share: 71,
    margin: 42,
    ballots: 9430,
    standing: 'decided',
    endDate: '2026-07-28T21:00:00.000Z',
  },
  {
    voteId: 'demo-knesset-prices',
    title: 'הצעת חוק להוזלת יוקר המחיה',
    scope: 'national',
    municipality: 'כנסת ישראל',
    position: 'בעד הוזלת מחירי מוצרי יסוד ב-30% בפיקוח מחירים',
    share: 82,
    margin: 64,
    ballots: 15240,
    standing: 'decided',
    endDate: '2026-07-24T21:00:00.000Z',
  },
  {
    voteId: 'demo-knesset-housing',
    title: 'הצעת חוק שכירות במחיר מפוקח',
    scope: 'national',
    municipality: 'כנסת ישראל',
    position: 'בעד קביעת מחירי שכירות מפוקחים לדירות מגורים בכל הארץ',
    share: 76,
    margin: 52,
    ballots: 11360,
    standing: 'standing',
    endDate: '2026-09-06T21:00:00.000Z',
  },
  {
    voteId: 'demo-batyam-pests',
    title: 'מפגעי מכרסמים ומזיקים ברחבי העיר',
    scope: 'municipal',
    municipality: 'בת ים',
    position: 'בעד תוכנית הדברה עירונית רבעונית וקבועה',
    share: 78,
    margin: 56,
    ballots: 964,
    standing: 'decided',
    endDate: '2026-08-02T21:00:00.000Z',
  },
  {
    voteId: 'demo-akko-waste',
    title: 'כשלים בפינוי אשפה ובניקיון העיר',
    scope: 'municipal',
    municipality: 'עכו',
    position: 'בעד החלפת קבלן הניקיון והצמדת יעדי שירות',
    share: 69,
    margin: 38,
    ballots: 741,
    standing: 'decided',
    endDate: '2026-08-05T21:00:00.000Z',
  },
  {
    voteId: 'demo-knesset-transit',
    title: 'תחבורה ציבורית ברשויות שיבחרו בכך',
    scope: 'national',
    municipality: 'כנסת ישראל',
    position: 'בעד הפעלת קווים בסופי שבוע לפי החלטת כל רשות',
    share: 63,
    margin: 26,
    ballots: 12880,
    standing: 'standing',
    endDate: '2026-09-01T21:00:00.000Z',
  },
  {
    voteId: 'demo-raanana-parking',
    title: 'הסדרי חניה בשכונות המגורים',
    scope: 'municipal',
    municipality: 'רעננה',
    position: 'נגד הרחבת אזורי הכחול-לבן בשכונות',
    share: 58,
    margin: 16,
    ballots: 512,
    standing: 'standing',
    endDate: '2026-08-30T21:00:00.000Z',
  },
] as const;

export const DEMO_NATIONAL = DEMO_MANDATE.filter((d) => d.scope === 'national');
export const DEMO_MUNICIPAL = DEMO_MANDATE.filter((d) => d.scope === 'municipal');

export const DEMO_TOTALS: MandateTotals = {
  decided: DEMO_MANDATE.filter((d) => d.standing === 'decided').length,
  standing: DEMO_MANDATE.filter((d) => d.standing === 'standing').length,
  ballotsCounted: DEMO_MANDATE.reduce((sum, d) => sum + d.ballots, 0),
  authorities: new Set(DEMO_MANDATE.map((d) => d.municipality)).size,
};

/** Whether a run was asked to demonstrate rather than to report. */
export function isDemoRequested(value: string | string[] | undefined): boolean {
  const flag = Array.isArray(value) ? value[0] : value;
  return flag === '1' || flag === 'true';
}
