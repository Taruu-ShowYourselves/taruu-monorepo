'use client';

import { useMemo, useState } from 'react';
import { formatScore, scoreBand, trackGeometry } from '@/lib/civic/score';
import type { RosterCopy } from './copy';
import styles from './Government.module.css';

/**
 * The serializable shape of one member for the board.
 *
 * Deliberately flat: this crosses the server/client boundary, and the page
 * has already resolved offices to a printable line, so nothing here needs the
 * contract types or the locale's copy functions.
 */
export interface RosterEntry {
  slug: string;
  fullName: string;
  factionName: string | null;
  /** Highest office, already translated, e.g. "Minister · Justice". */
  officeLine: string;
  overallScore: number | null;
  /**
   * Which axes the score rests on, already worded, e.g. "measured on
   * attendance". Without it a +100 built from attendance alone reads as a
   * verdict on how well someone represents their voters, which it is not.
   */
  basis: string;
  href: string;
}

interface RosterBoardProps {
  members: RosterEntry[];
  copy: RosterCopy;
}

type SortKey = 'score' | 'name';

/**
 * The whole sitting house as one board: search, filter by faction, sort by
 * score or name.
 *
 * A hundred and twenty rows is exactly the size where a plain list stops
 * being usable and a paginated table starts hiding people, so it filters in
 * the browser over a payload that arrived with the page - no request per
 * keystroke, and no member who is only reachable by knowing their name.
 */
export function RosterBoard({ members, copy }: RosterBoardProps) {
  const [query, setQuery] = useState('');
  const [faction, setFaction] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('score');

  const factions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const member of members) {
      if (!member.factionName) continue;
      seen.set(member.factionName, (seen.get(member.factionName) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [members]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = members.filter((member) => {
      if (faction !== null && member.factionName !== faction) return false;
      if (!needle) return true;
      return (
        member.fullName.toLowerCase().includes(needle) ||
        (member.factionName ?? '').toLowerCase().includes(needle) ||
        member.officeLine.toLowerCase().includes(needle)
      );
    });

    return filtered.sort((a, b) => {
      if (sort === 'name') return a.fullName.localeCompare(b.fullName, 'he');
      /* Unmeasured members sort last rather than at the bottom of the scale:
         having no matched votes is not the same as voting against the public
         every time, and the order must not imply that it is. */
      if (a.overallScore === b.overallScore) {
        return a.fullName.localeCompare(b.fullName, 'he');
      }
      if (a.overallScore === null) return 1;
      if (b.overallScore === null) return -1;
      return b.overallScore - a.overallScore;
    });
  }, [members, query, faction, sort]);

  return (
    <>
      <div className={styles.controls}>
        <input
          type="search"
          className={styles.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchPlaceholder}
        />

        <div className={styles.chips}>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={faction === null}
            onClick={() => setFaction(null)}
          >
            {copy.allFactions}
          </button>
          {factions.map(([name, count]) => (
            <button
              key={name}
              type="button"
              className={styles.chip}
              aria-pressed={faction === name}
              onClick={() => setFaction(faction === name ? null : name)}
            >
              {name} · {count}
            </button>
          ))}
        </div>

        <div className={styles.chips}>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={sort === 'score'}
            onClick={() => setSort('score')}
          >
            {copy.sortByScore}
          </button>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={sort === 'name'}
            onClick={() => setSort('name')}
          >
            {copy.sortByName}
          </button>
        </div>

        <span className={styles.count}>
          {copy.showing} {shown.length} {copy.of} {members.length}
        </span>
      </div>

      {shown.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyBody}>{copy.noResults}</p>
        </div>
      ) : (
        <div className={styles.roster}>
          {shown.map((member) => {
            const { from, span } = trackGeometry(member.overallScore);
            return (
              <a key={member.slug} className={styles.member} href={member.href}>
                <span className={styles.memberHead}>
                  <span className={styles.memberName}>{member.fullName}</span>
                  <b
                    className={styles.memberScore}
                    data-band={scoreBand(member.overallScore)}
                  >
                    {formatScore(member.overallScore)}
                  </b>
                </span>
                <span className={styles.memberLine}>{member.officeLine}</span>
                <span className={styles.memberFaction}>
                  {member.factionName ?? copy.unmeasured}
                </span>
                <span className={styles.memberBasis}>{member.basis}</span>
                <span aria-hidden className={styles.memberTrack}>
                  <span
                    className={styles.trackFill}
                    style={{
                      ['--from' as string]: `${from}%`,
                      ['--span' as string]: `${span}%`,
                    }}
                  />
                  <span className={styles.trackZero} />
                </span>
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}
