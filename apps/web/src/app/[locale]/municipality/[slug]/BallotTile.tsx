import { NewsButton } from '@/components/press';
import type { MunicipalityVoteSummary } from '@/lib/supabase/db';
import { localePrefix, type Locale } from '@/lib/i18n';
import type { MunicipalityCopy } from './copy';
import styles from './MunicipalityProfile.module.css';

/** How many option rows a tile prints before it stops; the rest are implied. */
const MAX_TALLY_ROWS = 4;

export type BallotKind = 'live' | 'topic' | 'closed';

interface BallotTileProps {
  vote: MunicipalityVoteSummary;
  /** Running number down the stretch, printed like a front-page index. */
  index: number;
  /** 0-100 share of the busiest ballot in this stretch - the heat rule. */
  heat: number;
  /** Duotone plate from the desk's art job; null until an agent plated it. */
  artUrl: string | null;
  kind: BallotKind;
  locale: Locale;
  t: MunicipalityCopy;
}

function formatDate(t: MunicipalityCopy, iso: string | null): string {
  if (!iso) return '-';
  return new Intl.DateTimeFormat(t.dateLocale, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(iso));
}

/**
 * One ballot, set as a broadsheet tile rather than a card: rules instead of
 * boxes, a running number instead of an icon, and the tally printed as bars
 * that share a scale down the whole stretch.
 *
 * Three states, because they are three different objects to a reader: a live
 * race with a tally, a topic still waiting for its first voice, and a decided
 * vote whose winner is the point.
 */
export function BallotTile({
  vote,
  index,
  heat,
  artUrl,
  kind,
  locale,
  t,
}: BallotTileProps) {
  const href = `${localePrefix(locale)}/votes/${vote.id}`;
  const isTopic = kind === 'topic';
  const isClosed = kind === 'closed';

  const rows = [...vote.options]
    .sort((a, b) => b.votes - a.votes)
    .slice(0, MAX_TALLY_ROWS);
  const lead = rows[0];

  return (
    <article className={styles.tile}>
      {artUrl ? (
        /* Decorative plate under the type; plain <img> on purpose - the file
           is a remote agent output, not a build-time asset. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={artUrl} alt="" aria-hidden loading="lazy" className={styles.tileArt} />
      ) : null}

      <p className={styles.tileSlug}>
        <span className={styles.tileNo}>{String(index).padStart(2, '0')}</span>
        <span aria-hidden className={styles.tileHeat}>
          <span
            className={styles.tileHeatFill}
            style={{ ['--fill' as string]: `${Math.max(0, Math.min(100, heat))}%` }}
          />
        </span>
        {isTopic ? (
          <span className={`${styles.chip} ${styles.chipOpen}`}>{t.statusFresh}</span>
        ) : isClosed ? (
          <span className={`${styles.chip} ${styles.chipClosed}`}>{t.statusClosed}</span>
        ) : (
          <span className={`${styles.chip} ${styles.chipLive}`}>
            <span aria-hidden className={styles.chipDot} />
            {t.statusLive}
          </span>
        )}
      </p>

      <h3 className={styles.tileTitle}>
        <a className={styles.tileLink} href={href}>
          {vote.title}
        </a>
      </h3>

      {vote.description ? <p className={styles.tileDesc}>{vote.description}</p> : null}

      {isTopic ? (
        <ul className={styles.options}>
          {vote.options.map((option) => (
            <li key={option.id} className={styles.optionChip}>
              {option.text}
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.tally}>
          {rows.map((option) => (
            <div
              key={option.id}
              className={styles.tallyRow}
              data-lead={option.id === lead?.id ? 'true' : undefined}
            >
              <span className={styles.tallyHead}>
                <span>{option.text}</span>
                <span className={styles.tallyCount}>
                  {option.pct}% · {option.votes.toLocaleString(t.dateLocale)}
                </span>
              </span>
              <span aria-hidden className={styles.tallyTrack}>
                <span
                  className={styles.tallyFill}
                  style={{ ['--fill' as string]: `${option.pct}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.tileFoot}>
        <span className={styles.tileMeta}>
          {isTopic ? null : (
            <span>{t.ballots(vote.totalBallots.toLocaleString(t.dateLocale))}</span>
          )}
          <span>
            {t.opened} {formatDate(t, vote.startDate)}
          </span>
          <span>
            {isClosed ? t.closed : t.closes} {formatDate(t, vote.endDate)}
          </span>
        </span>

        <NewsButton
          href={href}
          variant={isClosed ? 'outline' : 'red'}
          size="sm"
          trailing={<span aria-hidden>{t.arrow}</span>}
        >
          {isClosed ? t.resultCta : isTopic ? t.voteFirstCta : t.voteCta}
        </NewsButton>
      </div>
    </article>
  );
}
