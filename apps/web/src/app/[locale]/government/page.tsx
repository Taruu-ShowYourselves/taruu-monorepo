import type { Metadata } from 'next';
import { Masthead, NewsButton } from '@/components/press';
import { Colophon } from '@/components/press/sections';
import { GOV_COPY, type GovernmentCopy } from '@/components/press/government/copy';
import { MatchedVoteList } from '@/components/press/government/MatchedVoteList';
import {
  RosterBoard,
  type RosterEntry,
} from '@/components/press/government/RosterBoard';
import { ScoreMeter } from '@/components/press/government/ScoreMeter';
import styles from '@/components/press/government/Government.module.css';
import { EM_DASH, formatScore, scoreBand } from '@/lib/civic/score';
import { localePrefix, type Locale } from '@/lib/i18n';
import {
  governmentStats,
  houseMatchedVotes,
  knessetRoster,
} from '@/server/read/government';
import type { GovOffice, KnessetMember } from '@sync/shared/contracts';

// The roster changes on reshuffles and the record on sitting days; five
// minutes matches the municipal profiles and the desks.
export const revalidate = 300;

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = GOV_COPY[locale];
  return { title: t.metaTitle, description: t.metaDescription };
}

/** Offices that make someone a member of the government rather than the house. */
const CABINET_OFFICES = new Set<GovOffice>([
  'pm',
  'alternate_pm',
  'deputy_pm',
  'minister',
  'deputy_minister',
]);

/**
 * Which axes a member's overall score actually rests on, in words.
 *
 * Today most of the roster scores on attendance alone - the chamber's record
 * is mirrored but no citizen has voted on a national item yet - and a bare
 * "+100" beside a politician's name reads as a verdict on how well they
 * represent their voters. The card says what was measured.
 */
function basisOf(member: KnessetMember, copy: GovernmentCopy['roster']): string {
  const axes = [
    member.scores.alignmentScore !== null ? copy.basisAlignment : null,
    member.scores.participationScore !== null ? copy.basisParticipation : null,
    member.scores.trustScore !== null ? copy.basisTrust : null,
  ].filter((axis): axis is string => axis !== null);

  return axes.length === 0 ? copy.basisNone : `${copy.basisPrefix} ${axes.join(' · ')}`;
}

/** "Minister · Justice", or just the office when it carries no portfolio. */
function officeLineOf(
  member: KnessetMember,
  officeNames: Record<GovOffice, string>
): string {
  const top =
    member.positions.find((position) => position.office === member.topOffice) ??
    member.positions[0];
  const name = officeNames[member.topOffice];
  return top?.portfolio ? `${name} · ${top.portfolio}` : name;
}

export default async function GovernmentPage({ params }: PageProps) {
  const { locale } = await params;
  const t = GOV_COPY[locale];

  const [stats, roster, matched] = await Promise.all([
    governmentStats(),
    knessetRoster(),
    houseMatchedVotes(12),
  ]);

  const numberFormat = (value: number) => value.toLocaleString(t.dateLocale);
  const term = stats?.knessetNum ?? null;

  const cabinet = roster.filter((member) => CABINET_OFFICES.has(member.topOffice));

  const entries: RosterEntry[] = roster.map((member) => ({
    slug: member.slug,
    fullName: member.fullName,
    factionName: member.factionName,
    officeLine: officeLineOf(member, t.officeNames),
    overallScore: member.scores.overallScore,
    basis: basisOf(member, t.roster),
    href: `${localePrefix(locale)}/government/${encodeURIComponent(member.slug)}`,
  }));

  const matchedEvidence =
    stats && stats.matchedItems > 0
      ? t.evidenceMatched(stats.agreedItems, stats.matchedItems)
      : t.unmeasured;

  return (
    <div className="np-page">
      <Masthead locale={locale} />

      <main className={styles.page}>
        <div className={styles.inner}>
          {/* ---- Hero ---------------------------------------------------- */}
          <header className={styles.hero}>
            <nav className={styles.breadcrumb} aria-label={t.crumbGovernment}>
              <a className={styles.crumb} href={localePrefix(locale) || '/'}>
                {t.crumbHome}
              </a>
              <span aria-hidden>/</span>
              <span>{t.crumbGovernment}</span>
            </nav>

            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {t.kicker}
            </span>

            <div className={styles.heroGrid}>
              <div className={styles.heroMain}>
                <span aria-hidden className={styles.nameGhost}>
                  {t.houseName}
                </span>
                <h1 className={styles.name}>{t.houseName}</h1>
                <p className={styles.standfirst}>{t.standfirst}</p>
                <div className={styles.heroActions}>
                  <span className={styles.faction}>
                    {term !== null ? t.term(term) : t.termUnknown}
                  </span>
                  <a className={styles.textLink} href={`${localePrefix(locale)}/knesset`}>
                    {t.deskCta}
                  </a>
                </div>
              </div>

              <aside
                className={styles.plate}
                data-band={scoreBand(stats?.overallScore ?? null)}
              >
                <span className={styles.plateLabel}>{t.plateLabel}</span>
                <b className={styles.plateValue}>
                  {formatScore(stats?.overallScore ?? null)}
                </b>
                <span className={styles.plateNote}>
                  {stats && stats.matchedItems > 0
                    ? t.plateEvidence(stats.matchedItems)
                    : t.plateUnmeasured}
                </span>
                <span aria-hidden className={styles.plateScale}>
                  <span>{t.scaleMin}</span>
                  <span>{t.scaleMax}</span>
                </span>
              </aside>
            </div>
          </header>

          {/* ---- Index band ---------------------------------------------- */}
          <section className={styles.rail} aria-label={t.indexTitle}>
            <div className={styles.railCell}>
              <span className={styles.railLabel}>{t.railMembers}</span>
              <b className={styles.railValue}>{numberFormat(stats?.members ?? 0)}</b>
              <span className={styles.railNote}>{t.railMembersNote}</span>
            </div>
            <div className={styles.railCell}>
              <span className={styles.railLabel}>{t.railFactions}</span>
              <b className={styles.railValue}>{numberFormat(stats?.factions ?? 0)}</b>
              <span className={styles.railNote}>{t.railFactionsNote}</span>
            </div>
            <div className={styles.railCell}>
              <span className={styles.railLabel}>{t.railOpen}</span>
              <b className={styles.railValue} data-accent="red">
                {numberFormat(stats?.openTopics ?? 0)}
              </b>
              <span className={styles.railNote}>{t.railOpenNote}</span>
            </div>
            <div className={styles.railCell}>
              <span className={styles.railLabel}>{t.railDecided}</span>
              <b className={styles.railValue}>
                {numberFormat(stats?.decidedTopics ?? 0)}
              </b>
              <span className={styles.railNote}>{t.railDecidedNote}</span>
            </div>
            <div className={styles.railCell}>
              <span className={styles.railLabel}>{t.railBallots}</span>
              <b className={styles.railValue}>
                {numberFormat(stats?.ballotsCounted ?? 0)}
              </b>
              <span className={styles.railNote}>{t.railBallotsNote}</span>
            </div>
            <div className={styles.railCell}>
              <span className={styles.railLabel}>{t.railCitizens}</span>
              <b className={styles.railValue}>
                {numberFormat(stats?.platformUsers ?? 0)}
              </b>
              <span className={styles.railNote}>
                {t.railCitizensNote(numberFormat(stats?.activeParticipants ?? 0))}
              </span>
            </div>
          </section>

          {/* ---- Civic index --------------------------------------------- */}
          <section className={styles.section} aria-label={t.indexTitle}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t.indexTitle}</h2>
              <p className={styles.sectionNote}>{t.indexNote}</p>
            </div>

            <div className={styles.meterGrid}>
              <ScoreMeter
                label={t.scoreRepresentation}
                score={stats?.representationScore ?? null}
                evidence={matchedEvidence}
                method={t.methodRepresentation}
                scaleMin={t.scaleMin}
                scaleMax={t.scaleMax}
              />
              <ScoreMeter
                label={t.scoreEngagement}
                score={stats?.engagementScore ?? null}
                evidence={t.railCitizensNote(
                  numberFormat(stats?.activeParticipants ?? 0)
                )}
                method={t.methodEngagement}
                scaleMin={t.scaleMin}
                scaleMax={t.scaleMax}
              />
              <ScoreMeter
                label={t.scoreAgreement}
                score={stats?.cooperationScore ?? null}
                evidence={`${numberFormat(
                  (stats?.openTopics ?? 0) + (stats?.decidedTopics ?? 0)
                )} ${t.railOpen.toLowerCase()}`}
                method={t.methodAgreement}
                scaleMin={t.scaleMin}
                scaleMax={t.scaleMax}
              />
              <ScoreMeter
                label={t.scoreTrust}
                score={stats?.trustScore ?? null}
                evidence={
                  stats?.trustScore === null || stats === null
                    ? t.unmeasured
                    : t.reviews.average
                }
                method={t.methodTrust}
                scaleMin={t.scaleMin}
                scaleMax={t.scaleMax}
              />
            </div>
          </section>

          {/* ---- The chamber against the public --------------------------- */}
          <section className={styles.section} aria-label={t.matchedTitle}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t.matchedTitle}</h2>
              <p className={styles.sectionNote}>{t.matchedNote}</p>
            </div>

            {matched.length > 0 ? (
              <MatchedVoteList votes={matched} locale={locale} t={t} />
            ) : (
              <div className={styles.empty}>
                <span className={styles.kicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  {EM_DASH}
                </span>
                <h3 className={styles.emptyTitle}>{t.matchedEmptyTitle}</h3>
                <p className={styles.emptyBody}>{t.matchedEmptyBody}</p>
              </div>
            )}
          </section>

          {/* ---- The cabinet ---------------------------------------------- */}
          {cabinet.length > 0 ? (
            <section className={styles.section} aria-label={t.cabinetTitle}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>{t.cabinetTitle}</h2>
                <p className={styles.sectionNote}>{t.cabinetNote}</p>
              </div>

              <div className={styles.roster}>
                {cabinet.map((member) => (
                  <a
                    key={member.slug}
                    className={styles.member}
                    href={`${localePrefix(locale)}/government/${encodeURIComponent(
                      member.slug
                    )}`}
                  >
                    <span className={styles.memberHead}>
                      <span className={styles.memberName}>{member.fullName}</span>
                      <b
                        className={styles.memberScore}
                        data-band={scoreBand(member.scores.overallScore)}
                      >
                        {formatScore(member.scores.overallScore)}
                      </b>
                    </span>
                    <span className={styles.memberLine}>
                      {officeLineOf(member, t.officeNames)}
                    </span>
                    <span className={styles.memberFaction}>
                      {member.factionName ?? EM_DASH}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {/* ---- The roster ----------------------------------------------- */}
          <section className={styles.section} aria-label={t.rosterTitle}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t.rosterTitle}</h2>
              <p className={styles.sectionNote}>{t.rosterNote}</p>
            </div>

            {entries.length > 0 ? (
              <RosterBoard members={entries} copy={t.roster} />
            ) : (
              <div className={styles.empty}>
                <h3 className={styles.emptyTitle}>{t.rosterEmptyTitle}</h3>
                <p className={styles.emptyBody}>{t.rosterEmptyBody}</p>
              </div>
            )}
          </section>

          {/* ---- Closing band --------------------------------------------- */}
          <section className={styles.closing}>
            <div>
              <h2 className={styles.closingTitle}>{t.closingTitle}</h2>
              <p className={styles.closingBody}>{t.closingBody}</p>
            </div>
            <NewsButton
              href={`${localePrefix(locale)}/knesset`}
              variant="red"
              size="lg"
              trailing={<span aria-hidden>{locale === 'he' ? '←' : '→'}</span>}
            >
              {t.deskCta}
            </NewsButton>
          </section>
        </div>
      </main>

      <Colophon locale={locale} />
    </div>
  );
}
