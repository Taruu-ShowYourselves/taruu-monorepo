/**
 * Document endpoints of the official Knesset OData service.
 *
 * The service speaks OData v2/v3 JSON: responses are `{ value: [...] }`
 * envelopes. Only the attachment tables live here — the web app keeps its
 * own client for the day-order sync cron.
 *
 * @see https://knesset.gov.il/Odata/ParliamentInfo.svc/
 */

const KNESSET_ODATA_BASE = 'https://knesset.gov.il/Odata/ParliamentInfo.svc';

/** Hard cap per upstream call — a hung Knesset API must not eat the run. */
const FETCH_TIMEOUT_MS = 15_000;

/** A file attached to a bill or a day-order proposal. */
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

async function fetchODataCollection<T>(pathAndQuery: string): Promise<T[]> {
  const response = await fetch(`${KNESSET_ODATA_BASE}/${pathAndQuery}`, {
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

/** Documents attached to a bill (an ItemID of type הצעת חוק IS a BillID). */
export async function fetchBillDocuments(billId: number): Promise<KnsDocument[]> {
  return fetchODataCollection<KnsDocument>(
    `KNS_DocumentBill?$filter=BillID%20eq%20${Math.trunc(billId)}&$format=json`
  );
}

/** Documents attached to a day-order proposal (ItemID IS an AgendaID). */
export async function fetchAgendaDocuments(
  agendaId: number
): Promise<KnsDocument[]> {
  return fetchODataCollection<KnsDocument>(
    `KNS_DocumentAgenda?$filter=AgendaID%20eq%20${Math.trunc(agendaId)}&$format=json`
  );
}
