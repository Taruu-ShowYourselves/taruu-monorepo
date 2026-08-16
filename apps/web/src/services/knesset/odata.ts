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
  /** Position in the day order - the API returns it as a string. */
  Ordinal: string | number | null;
  Name: string | null;
  StatusID: number | null;
  IsDiscussion: number | boolean | null;
  LastUpdatedDate: string | null;
}

/** Hard cap per upstream call - a hung Knesset API must not eat the cron. */
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

/** Ordinal arrives as a string ("5") - normalize to a number or null. */
export function parseOrdinal(ordinal: string | number | null): number | null {
  if (ordinal === null || ordinal === undefined) return null;
  const n = typeof ordinal === 'number' ? ordinal : parseInt(ordinal, 10);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// The roster: KNS_Person + KNS_PersonToPosition
//
// The Knesset publishes two id spaces for the same people. ParliamentInfo
// numbers them by PersonID and the Votes service by kmmbr_id, and nothing
// upstream joins the two - see `resolveMemberPerson` in ./rollcalls.ts for
// how that gap is closed.
// ---------------------------------------------------------------------------

/** A person the Knesset has a record of (KNS_Person). */
export interface KnsPerson {
  PersonID: number;
  FirstName: string | null;
  LastName: string | null;
  GenderDesc: string | null;
  IsCurrent: boolean | null;
  LastUpdatedDate: string | null;
}

/** One office a person holds or held (KNS_PersonToPosition). */
export interface KnsPersonToPosition {
  PersonToPositionID: number;
  PersonID: number;
  PositionID: number;
  KnessetNum: number | null;
  StartDate: string | null;
  FinishDate: string | null;
  GovMinistryID: number | null;
  GovMinistryName: string | null;
  DutyDesc: string | null;
  FactionID: number | null;
  FactionName: string | null;
  GovernmentNum: number | null;
  CommitteeID: number | null;
  CommitteeName: string | null;
  IsCurrent: boolean | null;
  LastUpdatedDate: string | null;
}

/** The position taxonomy itself (KNS_Position) - 29 rows, rarely changes. */
export interface KnsPosition {
  PositionID: number;
  Description: string | null;
  GenderID: number | null;
}

/**
 * Page through a collection until it runs dry or the cap is reached.
 *
 * The step is the number of rows that actually came back, never the number
 * asked for. This service caps a page at 100 rows however large a `$top` it
 * is handed, so "fewer rows than requested means the end" - the obvious
 * termination test - stops after the first page and silently returns a
 * truncated roster. That cost the first sync 62 of the 120 members.
 *
 * The loop therefore ends only on a genuinely empty page, at the cost of one
 * extra request per collection. `maxRows` is the guard against a cron that
 * would otherwise walk the whole history of the Knesset on a bad filter.
 */
async function fetchAllPages<T>(
  collectionAndQuery: string,
  { pageSize = 100, maxRows = 5_000 } = {}
): Promise<T[]> {
  const rows: T[] = [];
  let skip = 0;

  while (rows.length < maxRows) {
    const page = await fetchODataCollection<T>(
      `${collectionAndQuery}&$top=${pageSize}&$skip=${skip}&$format=json`
    );
    if (page.length === 0) break;
    rows.push(...page);
    skip += page.length;
  }

  return rows;
}

/** Everyone currently sitting. */
export async function fetchCurrentPersons(): Promise<KnsPerson[]> {
  return fetchAllPages<KnsPerson>('KNS_Person?$filter=IsCurrent%20eq%20true');
}

/** Every office currently held, across all sitting members. */
export async function fetchCurrentPositions(): Promise<KnsPersonToPosition[]> {
  return fetchAllPages<KnsPersonToPosition>(
    'KNS_PersonToPosition?$filter=IsCurrent%20eq%20true'
  );
}

/** The position taxonomy, for the source-line title of each office. */
export async function fetchPositions(): Promise<KnsPosition[]> {
  return fetchODataCollection<KnsPosition>('KNS_Position?$format=json');
}

// ---------------------------------------------------------------------------
// The record: plenum votes (OData v4)
//
// The Knesset publishes its voting record twice. The legacy Votes.svc service
// - the one every tutorial points at - stopped at the 24th Knesset in July
// 2021 and answers an empty list for anything since, which is worse than an
// error because a sync built on it reports success and mirrors nothing.
//
// The live record is KNS_PlenumVote / KNS_PlenumVoteResult on the v4 service.
// It is also the better source: each result row carries `ItemID`, which is
// the same number as KNS_PlmSessionItem.ItemID and therefore as
// knesset_items.item_id - so a Taruu national ballot and the chamber's roll
// call on the same item join without a heuristic.
// ---------------------------------------------------------------------------

const KNESSET_V4_BASE = 'https://knesset.gov.il/OdataV4/ParliamentInfo';

/** One plenum vote (KNS_PlenumVote). Totals are not published on the header. */
export interface KnsPlenumVote {
  Id: number;
  VoteDateTime: string | null;
  SessionID: number | null;
  /** The day-order item this vote belongs to - the join to knesset_items. */
  ItemID: number | null;
  VoteTitle: string | null;
  VoteSubject: string | null;
  VoteStatusDesc: string | null;
}

/** How one member voted (KNS_PlenumVoteResult). */
export interface KnsPlenumVoteResult {
  Id: number;
  /** The Votes feed's own member id - NOT the roster's PersonID. */
  MkId: number;
  VoteID: number;
  VoteDate: string | null;
  ResultCode: number | null;
  ResultDesc: string | null;
  FirstName: string | null;
  LastName: string | null;
  SessionID: number | null;
  ItemID: number | null;
}

async function fetchV4Collection<T>(pathAndQuery: string): Promise<T[]> {
  const response = await fetch(`${KNESSET_V4_BASE}/${pathAndQuery}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Knesset OData v4 ${response.status} for ${pathAndQuery}`);
  }

  const body = (await response.json()) as { value?: T[] };
  if (!Array.isArray(body.value)) {
    throw new Error(`Knesset OData v4 malformed envelope for ${pathAndQuery}`);
  }
  return body.value;
}

/** Page a v4 collection, stepping by what came back. Same 100-row cap. */
async function fetchAllV4Pages<T>(
  collectionAndQuery: string,
  { pageSize = 100, maxRows = 2_000 } = {}
): Promise<T[]> {
  const rows: T[] = [];
  let skip = 0;

  while (rows.length < maxRows) {
    const page = await fetchV4Collection<T>(
      `${collectionAndQuery}&$top=${pageSize}&$skip=${skip}`
    );
    if (page.length === 0) break;
    rows.push(...page);
    skip += page.length;
  }

  return rows;
}

/** The most recent plenum votes, newest first. */
export async function fetchRecentPlenumVotes(
  maxRows = 300
): Promise<KnsPlenumVote[]> {
  return fetchAllV4Pages<KnsPlenumVote>(
    'KNS_PlenumVote?$orderby=VoteDateTime%20desc',
    { maxRows }
  );
}

/** Every member's stance in one plenum vote. */
export async function fetchPlenumVoteResults(
  voteId: number
): Promise<KnsPlenumVoteResult[]> {
  return fetchAllV4Pages<KnsPlenumVoteResult>(
    `KNS_PlenumVoteResult?$filter=VoteID%20eq%20${Math.trunc(voteId)}`,
    { maxRows: 200 }
  );
}

/**
 * The result codes the plenum feed uses.
 *
 * 7/8/9 are the three sides. 6 is 'נוכח' - present, side not taken - which is
 * a recorded appearance rather than an absence, so it is stored as an
 * abstention: it counts toward being in the chamber and toward neither side
 * of a question. Anything unrecognised is an absence rather than a guess, and
 * an absence never counts for or against a member's alignment.
 */
export function parseStance(
  code: number | null
): 'for' | 'against' | 'abstain' | 'absent' {
  switch (code) {
    case 7:
      return 'for';
    case 8:
      return 'against';
    case 9:
    case 6:
      return 'abstain';
    default:
      return 'absent';
  }
}

/** An OData id that arrives as a string ("2160193") - normalize or null. */
export function parseUpstreamId(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}
