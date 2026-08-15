import type { MatchedVote } from '@sync/shared/contracts';
import { localePrefix, type Locale } from '@/lib/i18n';
import type { GovernmentCopy } from './copy';
import styles from './Government.module.css';

interface MatchedVoteListProps {
  votes: MatchedVote[];
  locale: Locale;
  t: GovernmentCopy;
  /** On a member's page each row also prints how that member voted. */
  withMemberStance?: boolean;
}

/** A tally as two percentages of its own total, for the split bar. */
function split(forVotes: number, againstVotes: number) {
  const total = forVotes + againstVotes;
  if (total === 0) return { for: 0, against: 0 };
  return {
    for: Math.round((forVotes / total) * 100),
    against: Math.round((againstVotes / total) * 100),
  };
}

function formatDate(t: GovernmentCopy, iso: string | null): string {
  if (!iso) return '-';
  return new Intl.DateTimeFormat(t.dateLocale, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(iso));
}

function stanceLabel(t: GovernmentCopy, vote: MatchedVote): string {
  switch (vote.memberStance) {
    case 'for':
      return t.stanceFor;
    case 'against':
      return t.stanceAgainst;
    case 'abstain':
      return t.stanceAbstain;
    case 'absent':
      return t.stanceAbsent;
    default:
      return t.stanceUnknown;
  }
}

/**
 * The same agenda item, twice: what the public here decided and what the
 * chamber did. This is the whole argument of the government pages, so it is
 * printed as evidence rather than summarised into a score and hidden.
 */
export function MatchedVoteList({
  votes,
  locale,
  t,
  withMemberStance = false,
}: MatchedVoteListProps) {
  return (
    <div className={styles.matched}>
      {votes.map((vote) => {
        const publicSplit = split(vote.publicFor, vote.publicAgainst);
        const houseSplit = split(vote.houseFor, vote.houseAgainst);

        /* On a member's page the verdict is about the member; on the house's
           page it is about the chamber. Either way an undecided side prints
           as "no decision" rather than as a disagreement - a tie is not a
           position anyone took. */
        const subjectSide = withMemberStance
          ? vote.memberStance === 'for' || vote.memberStance === 'against'
            ? vote.memberStance
            : null
          : vote.houseSide;

        const verdict =
          vote.publicSide === null || subjectSide === null
            ? { label: t.verdictNone, className: styles.verdictNone }
            : subjectSide === vote.publicSide
              ? {
                  label: withMemberStance ? t.memberVerdictWith : t.verdictAgreed,
                  className: styles.verdictAgreed,
                }
              : {
                  label: withMemberStance
                    ? t.memberVerdictAgainst
                    : t.verdictSplit,
                  className: styles.verdictSplit,
                };

        return (
          <article key={`${vote.voteId}-${vote.itemId}`} className={styles.matchedRow}>
            <div>
              <h3 className={styles.matchedTitle}>
                <a
                  className={styles.matchedLink}
                  href={`${localePrefix(locale)}/votes/${vote.voteId}`}
                >
                  {vote.title}
                </a>
              </h3>
              <span className={styles.matchedDate}>
                {formatDate(t, vote.voteDate)}
                {withMemberStance ? ` · ${stanceLabel(t, vote)}` : null}
              </span>
            </div>

            <div className={styles.tally}>
              <span className={styles.tallyHead}>
                <span>{t.publicLabel}</span>
                <span>
                  {vote.publicFor} {t.forLabel} · {vote.publicAgainst} {t.againstLabel}
                </span>
              </span>
              <span aria-hidden className={styles.split}>
                <span
                  className={styles.splitFor}
                  style={{ ['--for' as string]: `${publicSplit.for}%` }}
                />
                <span
                  className={styles.splitAgainst}
                  style={{ ['--against' as string]: `${publicSplit.against}%` }}
                />
              </span>
            </div>

            <div className={styles.tally}>
              <span className={styles.tallyHead}>
                <span>{t.houseLabel}</span>
                <span>
                  {vote.houseFor} {t.forLabel} · {vote.houseAgainst} {t.againstLabel}
                </span>
              </span>
              <span aria-hidden className={styles.split}>
                <span
                  className={styles.splitFor}
                  style={{ ['--for' as string]: `${houseSplit.for}%` }}
                />
                <span
                  className={styles.splitAgainst}
                  style={{ ['--against' as string]: `${houseSplit.against}%` }}
                />
              </span>
            </div>

            <span className={`${styles.verdict} ${verdict.className}`}>
              {verdict.label}
            </span>
          </article>
        );
      })}
    </div>
  );
}
