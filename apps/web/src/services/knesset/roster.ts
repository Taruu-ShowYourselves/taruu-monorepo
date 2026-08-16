/**
 * Knesset roster sync - mirrors who currently sits, and what each of them
 * holds, from the official ParliamentInfo OData service.
 *
 * Every member gets a row and therefore a page, automatically: the roster is
 * whatever the Knesset publishes as current, not a hand-picked list of the
 * well-known. A member who joins mid-term appears on the next run; one who
 * leaves stops being current and keeps their record.
 *
 * Idempotent - PersonID and PersonToPositionID are the upstream identities,
 * so a re-run refreshes rows and never duplicates them. Runs from
 * /api/cron/knesset-roster.
 */

import { cronLogger as log } from '@/lib/logger';
import {
  existingPersonSlugs,
  retireMissingPersons,
  retireMissingPositions,
  upsertPersons,
  upsertPositions,
  type PersonInsert,
  type PositionInsert,
} from '@/server/infra/supabase/government.repo';
import type { GovOffice } from '@sync/shared/contracts';
import {
  fetchCurrentPersons,
  fetchCurrentPositions,
  type KnsPerson,
  type KnsPersonToPosition,
} from './odata';

const SOURCE_NAME = 'הכנסת · ParliamentInfo OData';
const SOURCE_URL = 'https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_PersonToPosition';

/**
 * Upstream PositionID → the office it is.
 *
 * The Knesset's position table carries each office twice, once per
 * grammatical gender ('שר' 39 and 'שרה' 57 are the same job), so the map
 * collapses those pairs. Ids absent from this map are deliberately dropped
 * rather than bucketed into some fallback: an unknown position id means the
 * upstream taxonomy grew, and inventing an office for it would print a claim
 * about a real person that nobody published.
 */
const OFFICE_BY_POSITION_ID: Readonly<Record<number, GovOffice>> = {
  45: 'pm',
  73: 'alternate_pm',
  31: 'deputy_pm',
  50: 'deputy_pm',
  51: 'deputy_pm',
  65: 'deputy_pm',
  39: 'minister',
  57: 'minister',
  40: 'deputy_minister',
  59: 'deputy_minister',
  285079: 'deputy_minister',
  122: 'speaker',
  123: 'speaker',
  285078: 'speaker',
  70: 'deputy_speaker',
  71: 'deputy_speaker',
  130: 'opposition_leader',
  131: 'opposition_leader',
  29: 'coalition_chair',
  30: 'coalition_chair',
  48: 'faction_chair',
  41: 'committee_chair',
  42: 'committee_member',
  66: 'committee_member',
  67: 'committee_member',
  663: 'committee_member',
  43: 'mk',
  61: 'mk',
  54: 'mk',
};

export function officeOfPosition(positionId: number): GovOffice | null {
  return OFFICE_BY_POSITION_ID[positionId] ?? null;
}

/**
 * A Hebrew name as a URL slug.
 *
 * Quotes and the geresh go (they survive percent-encoding badly and vary
 * between the Knesset's own services), spaces and dashes become one dash.
 * Hebrew letters are kept as they are: an ASCII transliteration of a Knesset
 * member's name would be a worse identifier than their name.
 */
export function slugifyName(name: string): string {
  return name
    .replace(/[״"'׳`.,()]/g, '')
    .replace(/[\s\-־–]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

/** What to print in a portfolio line, given the office this row is. */
function portfolioOf(row: KnsPersonToPosition, office: GovOffice): string | null {
  if (office === 'minister' || office === 'deputy_minister') {
    return row.GovMinistryName ?? row.DutyDesc ?? null;
  }
  if (office === 'committee_chair' || office === 'committee_member') {
    return row.CommitteeName ?? null;
  }
  return row.DutyDesc ?? null;
}

/** A date-only string for a DATE column, or null. */
function asDate(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

export interface RosterSyncResult {
  personsSeen: number;
  personsUpserted: number;
  personsRetired: number;
  positionsSeen: number;
  positionsUpserted: number;
  positionsRetired: number;
  positionsSkippedUnknownOffice: number;
  knessetNum: number | null;
  errors: string[];
}

export async function syncKnessetRoster(
  now: Date = new Date()
): Promise<RosterSyncResult> {
  const asOf = now.toISOString().slice(0, 10);
  const errors: string[] = [];

  const [persons, positions] = await Promise.all([
    fetchCurrentPersons(),
    fetchCurrentPositions(),
  ]);

  /* The roster is the people who currently hold something. KNS_Person's own
     IsCurrent flag is the other half of the same claim, and where the two
     disagree the positions win: a person flagged current with no current
     office is not sitting in any sense a citizen would recognise. */
  const positionsByPerson = new Map<number, KnsPersonToPosition[]>();
  for (const row of positions) {
    const bucket = positionsByPerson.get(row.PersonID);
    if (bucket) bucket.push(row);
    else positionsByPerson.set(row.PersonID, [row]);
  }

  const personById = new Map<number, KnsPerson>(
    persons.map((person) => [person.PersonID, person])
  );

  const slugs = await existingPersonSlugs().catch((error: unknown) => {
    errors.push(`slug read failed: ${String(error)}`);
    return new Map<string, number>();
  });
  const claimed = new Map(slugs);

  const personRows: PersonInsert[] = [];
  const positionRows: PositionInsert[] = [];
  let skippedUnknownOffice = 0;
  let maxKnesset: number | null = null;

  for (const [personId, held] of positionsByPerson) {
    const person = personById.get(personId);
    if (!person) {
      /* A current office whose holder is not in the current-person list.
         Skipped rather than invented: the name is the one thing this row
         cannot supply, and a page for "person 3141" helps nobody. */
      continue;
    }

    const firstName = (person.FirstName ?? '').trim();
    const lastName = (person.LastName ?? '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName.length < 2) continue;

    const knessetNum = held.reduce<number | null>(
      (max, row) =>
        row.KnessetNum !== null && (max === null || row.KnessetNum > max)
          ? row.KnessetNum
          : max,
      null
    );
    if (knessetNum !== null && (maxKnesset === null || knessetNum > maxKnesset)) {
      maxKnesset = knessetNum;
    }

    const factionName =
      held.find((row) => row.FactionName && row.FactionName.trim())?.FactionName ??
      null;

    /* A slug already held by this same person is theirs to keep. One held by
       someone else gets the PersonID appended, so no member's URL ever
       silently starts resolving to a namesake. */
    const base = slugifyName(fullName);
    const owner = claimed.get(base);
    const slug = owner === undefined || owner === personId ? base : `${base}-${personId}`;
    claimed.set(slug, personId);

    personRows.push({
      person_id: personId,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      gender_desc: person.GenderDesc,
      is_current: true,
      slug,
      knesset_num: knessetNum,
      faction_name: factionName,
      source_name: SOURCE_NAME,
      source_url: SOURCE_URL,
      as_of: asOf,
      source_updated_at: person.LastUpdatedDate,
      fetched_at: now.toISOString(),
    });

    for (const row of held) {
      const office = officeOfPosition(row.PositionID);
      if (!office) {
        skippedUnknownOffice += 1;
        continue;
      }
      positionRows.push({
        position_row_id: row.PersonToPositionID,
        person_id: personId,
        office,
        title: row.DutyDesc?.trim() || officeTitleFallback(office),
        portfolio: portfolioOf(row, office),
        faction_name: row.FactionName,
        knesset_num: row.KnessetNum,
        start_date: asDate(row.StartDate),
        end_date: asDate(row.FinishDate),
        is_current: true,
        source_name: SOURCE_NAME,
        source_url: SOURCE_URL,
        as_of: asOf,
      });
    }
  }

  let personsUpserted = 0;
  let positionsUpserted = 0;
  let personsRetired = 0;
  let positionsRetired = 0;

  try {
    personsUpserted = await upsertPersons(personRows);
    positionsUpserted = await upsertPositions(positionRows);
    personsRetired = await retireMissingPersons(personRows.map((r) => r.person_id));
    positionsRetired = await retireMissingPositions(
      positionRows.map((r) => r.position_row_id)
    );
  } catch (error: unknown) {
    errors.push(error instanceof Error ? error.message : String(error));
    log.error('knesset roster sync write failed', { error });
  }

  return {
    personsSeen: positionsByPerson.size,
    personsUpserted,
    personsRetired,
    positionsSeen: positions.length,
    positionsUpserted,
    positionsRetired,
    positionsSkippedUnknownOffice: skippedUnknownOffice,
    knessetNum: maxKnesset,
    errors,
  };
}

/** The Knesset leaves DutyDesc null on plain seats; print the office instead. */
function officeTitleFallback(office: GovOffice): string {
  const titles: Record<GovOffice, string> = {
    pm: 'ראש הממשלה',
    alternate_pm: 'ראש הממשלה החילופי',
    deputy_pm: 'סגן ראש הממשלה',
    minister: 'שר/ה',
    deputy_minister: 'סגן/ית שר',
    speaker: 'יו״ר הכנסת',
    deputy_speaker: 'סגן/ית יו״ר הכנסת',
    opposition_leader: 'ראש/ת האופוזיציה',
    coalition_chair: 'יו״ר הקואליציה',
    faction_chair: 'יו״ר סיעה',
    committee_chair: 'יו״ר ועדה',
    committee_member: 'חבר/ת ועדה',
    mk: 'חבר/ת הכנסת',
  };
  return titles[office];
}
