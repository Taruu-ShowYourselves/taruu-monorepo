/**
 * Minimal client for the official Knesset OData service.
 *
 * The service speaks OData v2/v3 JSON: responses are `{ value: [...] }`
 * envelopes. We keep `$filter` to numeric equality only (date-literal
 * syntax varies across OData versions) and do date logic client-side.
 *
 * @see https://knesset.gov.il/Odata/ParliamentInfo.svc/
 */

const KNESSET_ODATA_BASE = 'https://knesset.gov.il/Odata/ParliamentInfo.svc';

/** A plenum sitting (KNS_PlenumSession). */
export interface KnsPlenumSession {
  PlenumSessionID: number;
  /** Sitting number within the Knesset term. */
  Number: number | null;
  KnessetNum: number | null;
  /** e.g. "ישיבת מליאה בתאריך 13/07/2026 בשעה 12:00" */
  Name: string | null;
  /** Local ISO datetime without offset, e.g. "2026-07-13T12:00:00". */
  StartDate: string | null;
  FinishDate: string | null;
  IsSpecialMeeting: boolean | null;
  LastUpdatedDate: string | null;
}

/** One day-order item of a sitting (KNS_PlmSessionItem). */
export interface KnsPlmSessionItem {
  plmPlenumSessionID: number;
  ItemID: number;
  PlenumSessionID: number;
  ItemTypeID: number | null;
  /** e.g. "הצעה לסדר היום", "הצעת חוק". */
  ItemTypeDesc: string | null;
  /** Position in the day order — the API returns it as a string. */
  Ordinal: string | number | null;
  Name: string | null;
  StatusID: number | null;
  IsDiscussion: number | boolean | null;
  LastUpdatedDate: string | null;
}

async function fetchODataCollection<T>(pathAndQuery: string): Promise<T[]> {
  const url = `${KNESSET_ODATA_BASE}/${pathAndQuery}`;
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Knesset OData ${response.status} for ${pathAndQuery}`);
  }

  const body = (await response.json()) as { value?: T[] };
  if (!Array.isArray(body.value)) {
    throw new Error(`Knesset OData malformed envelope for ${pathAndQuery}`);
  }
  return body.value;
}

/** Latest plenum sittings, newest first. */
export async function fetchRecentPlenumSessions(
  top = 10
): Promise<KnsPlenumSession[]> {
  return fetchODataCollection<KnsPlenumSession>(
    `KNS_PlenumSession?$top=${top}&$orderby=StartDate%20desc&$format=json`
  );
}

/** All day-order items of one sitting. */
export async function fetchSessionItems(
  plenumSessionId: number
): Promise<KnsPlmSessionItem[]> {
  return fetchODataCollection<KnsPlmSessionItem>(
    `KNS_PlmSessionItem?$filter=PlenumSessionID%20eq%20${Math.trunc(plenumSessionId)}&$format=json`
  );
}

/** Ordinal arrives as a string ("5") — normalize to a number or null. */
export function parseOrdinal(ordinal: string | number | null): number | null {
  if (ordinal === null || ordinal === undefined) return null;
  const n = typeof ordinal === 'number' ? ordinal : parseInt(ordinal, 10);
  return Number.isFinite(n) ? n : null;
}
