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

/** Hard cap per upstream call — a hung Knesset API must not eat the cron. */
const FETCH_TIMEOUT_MS = 15_000;

async function fetchODataCollection<T>(pathAndQuery: string): Promise<T[]> {
  const url = `${KNESSET_ODATA_BASE}/${pathAndQuery}`;
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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

/** One attached document row (KNS_DocumentBill / KNS_DocumentAgenda). */
export interface KnsDocument {
  /** Document class, e.g. 'הצעת חוק לקריאה הראשונה', 'נוסח הצעה לסדר היום'. */
  GroupTypeID: number | null;
  GroupTypeDesc: string | null;
  /** File format as reported upstream: 'DOC' (covers .doc/.docx) or 'PDF'. */
  ApplicationDesc: string | null;
  /** fs.knesset.gov.il URL — sometimes with backslash separators. */
  FilePath: string | null;
  LastUpdatedDate: string | null;
}

/** Documents attached to a bill (an ItemID of type הצעת חוק IS a BillID). */
export async function fetchBillDocuments(billId: number): Promise<KnsDocument[]> {
  return fetchODataCollection<KnsDocument>(
    `KNS_DocumentBill?$filter=BillID%20eq%20${Math.trunc(billId)}&$format=json`
  );
}

/** Documents attached to a day-order proposal (ItemID IS an AgendaID). */
export async function fetchAgendaDocuments(agendaId: number): Promise<KnsDocument[]> {
  return fetchODataCollection<KnsDocument>(
    `KNS_DocumentAgenda?$filter=AgendaID%20eq%20${Math.trunc(agendaId)}&$format=json`
  );
}
