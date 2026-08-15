import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Masthead, NewsButton } from '@/components/press';
import { Colophon } from '@/components/press/sections';
import { GOV_COPY } from '@/components/press/government/copy';
import { MatchedVoteList } from '@/components/press/government/MatchedVoteList';
import { ReviewPanel } from '@/components/press/government/ReviewPanel';
import { ScoreMeter } from '@/components/press/government/ScoreMeter';
import styles from '@/components/press/government/Government.module.css';
import { EM_DASH, formatScore, scoreBand } from '@/lib/civic/score';
import { localePrefix, type Locale } from '@/lib/i18n';
import { getSessionFromCookies } from '@/services/auth/session';
import {
  knessetMemberBySlug,
  memberMatchedVotes,
  memberReviews,
} from '@/server/read/government';

// Same window as the house's own page: a member's score moves when a roll
// call lands or a citizen rates them, neither of which is per-request live.
export const revalidate = 300;

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = GOV_COPY[locale];
  const member = await knessetMemberBySlug(decodeURIComponent(slug));
  if (!member) return { title: t.memberNotFound };
  return {
    title: t.memberMetaTitle(member.fullName),
    description: t.memberMetaDescription(member.fullName),
  };
}

export default async function KnessetMemberPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const t = GOV_COPY[locale];

  const member = await knessetMemberBySlug(decodeURIComponent(slug));
  if (!member) notFound();

  /* The session decides one thing only: whether the review panel opens with a
     form or with an invitation to sign in, and which row is marked as the
     reader's own. Everything else on this page is public. */
  const session = await getSessionFromCookies();

  const [votes, reviews] = await Promise.all([
    memberMatchedVotes(member.personId),
    memberReviews(member.personId, session?.userId ?? null),
  ]);

  const numberFormat = (value: number) => value.toLocaleString(t.dateLocale);
  const { scores } = member;

  const dateFormat = new Intl.DateTimeFormat(t.dateLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  });

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
              <a className={styles.crumb} href={`${localePrefix(locale)}/government`}>
                {t.crumbGovernment}
              </a>
              <span aria-hidden>/</span>
              <span>{member.fullName}</span>
            </nav>

            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {t.memberKicker}
            </span>

            <div className={styles.heroGrid}>
              <div className={styles.heroMain}>
                <span aria-hidden className={styles.nameGhost}>
                  {member.lastName}
                </span>
                <h1 className={styles.name}>{member.fullName}</h1>

                <div className={styles.officeRow}>
                  {member.factionName ? (
                    <span className={styles.faction}>{member.factionName}</span>
                  ) : null}
                  {/* Offices, highest standing first. The top one prints as an
                      ink block: a minister who is also on three committees is
                      a minister first. */}
                  {member.positions.map((position, index) => (
                    <span
                      key={`${position.office}-${position.title}-${position.portfolio ?? index}`}
                      className={`${styles.office}${
                        index === 0 ? ` ${styles.officeTop}` : ''
                      }`}
                    >
                      {t.officeNames[position.office]}
                      {position.portfolio ? (
                        <span className={styles.officePortfolio}>
                          {position.portfolio}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>

                <p className={styles.standfirst}>
                  {t.memberStandfirst(member.fullName)}
                </p>

                <div className={styles.heroActions}>
                  <a
                    className={styles.textLink}
                    href={`${localePrefix(locale)}/government`}
                  >
                    {t.backToRoster}
                  </a>
                  <span className={styles.meterNote}>
                    {t.sourceLine(
                      member.source.name,
                      dateFormat.format(new Date(member.source.asOf))
                    )}
                  </span>
                </div>
              </div>

              <aside
                className={styles.plate}
                data-band={scoreBand(scores.overallScore)}
              >
                <span className={styles.plateLabel}>{t.plateLabel}</span>
                <b className={styles.plateValue}>{formatScore(scores.overallScore)}</b>
                <span className={styles.plateNote}>
                  {scores.overallScore === null
                    ? t.plateUnmeasured
                    : t.memberEvidenceAlignment(scores.matchedVotes)}
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
              <span className={styles.railLabel}>{t.railMatched}</span>
              <b
                className={styles.railValue}
                data-accent={scores.matchedVotes === 0 ? 'faint' : undefined}
              >
                {numberFormat(scores.matchedVotes)}
              </b>
              <span className={styles.railNote}>{t.railMatchedNote}</span>
            </div>
            <div className={styles.railCell}>
              <span className={styles.railLabel}>{t.railRecorded}</span>
              <b className={styles.railValue}>{numberFormat(scores.recordedVotes)}</b>
              <span className={styles.railNote}>{t.railRecordedNote}</span>
            </div>
            <div className={styles.railCell}>
              <span className={styles.railLabel}>{t.railRating}</span>
              <b
                className={styles.railValue}
                data-accent={scores.ratingAverage === null ? 'faint' : 'red'}
              >
                {scores.ratingAverage === null
                  ? EM_DASH
                  : `${scores.ratingAverage.toFixed(1)} / 5`}
              </b>
              <span className={styles.railNote}>
                {t.railRatingNote(scores.reviewCount)}
              </span>
            </div>
            <div className={styles.railCell}>
              <span className={styles.railLabel}>{t.railTerm}</span>
              <b
                className={styles.railValue}
                data-accent={member.knessetNum === null ? 'faint' : undefined}
              >
                {member.knessetNum === null ? EM_DASH : numberFormat(member.knessetNum)}
              </b>
              <span className={styles.railNote}>{t.railTermNote}</span>
            </div>
          </section>

          {/* ---- The three scores ---------------------------------------- */}
          <section className={styles.section} aria-label={t.indexTitle}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t.indexTitle}</h2>
              <p className={styles.sectionNote}>{t.indexNote}</p>
            </div>

            <div className={styles.meterGrid}>
              <ScoreMeter
                label={t.memberScoreAlignment}
                score={scores.alignmentScore}
                evidence={
                  scores.matchedVotes === 0
                    ? t.unmeasured
                    : t.memberEvidenceAlignment(scores.matchedVotes)
                }
                method={t.memberMethodAlignment}
                scaleMin={t.scaleMin}
                scaleMax={t.scaleMax}
              />
              <ScoreMeter
                label={t.memberScoreParticipation}
                score={scores.participationScore}
                evidence={
                  scores.rollCalls === 0
                    ? t.unmeasured
                    : t.memberEvidenceParticipation(
                        scores.recordedVotes,
                        scores.rollCalls
                      )
                }
                method={t.memberMethodParticipation}
                scaleMin={t.scaleMin}
                scaleMax={t.scaleMax}
              />
              <ScoreMeter
                label={t.memberScoreTrust}
                score={scores.trustScore}
                evidence={
                  scores.reviewCount === 0
                    ? t.unmeasured
                    : t.memberEvidenceTrust(scores.reviewCount)
                }
                method={t.memberMethodTrust}
                scaleMin={t.scaleMin}
                scaleMax={t.scaleMax}
              />
            </div>
          </section>

          {/* ---- The evidence --------------------------------------------- */}
          <section className={styles.section} aria-label={t.memberVotesTitle}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t.memberVotesTitle}</h2>
              <p className={styles.sectionNote}>{t.memberVotesNote}</p>
            </div>

            {votes.length > 0 ? (
              <MatchedVoteList votes={votes} locale={locale} t={t} withMemberStance />
            ) : (
              <div className={styles.empty}>
                <h3 className={styles.emptyTitle}>{t.memberVotesEmptyTitle}</h3>
                <p className={styles.emptyBody}>{t.memberVotesEmptyBody}</p>
              </div>
            )}
          </section>

          {/* ---- Citizen reviews ------------------------------------------ */}
          <section className={styles.section} aria-label={t.reviews.title}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t.reviews.title}</h2>
              <p className={styles.sectionNote}>{t.reviews.note}</p>
            </div>

            <ReviewPanel
              slug={member.slug}
              initialReviews={reviews.reviews}
              initialCount={reviews.reviewCount}
              initialAverage={reviews.ratingAverage}
              signedIn={session !== null}
              signInHref={`${localePrefix(locale)}/sign-in`}
              dateLocale={t.dateLocale}
              copy={t.reviews}
            />
          </section>

          {/* ---- Closing band --------------------------------------------- */}
          <section className={styles.closing}>
            <div>
              <h2 className={styles.closingTitle}>{t.closingTitle}</h2>
              <p className={styles.closingBody}>{t.closingBody}</p>
            </div>
            <NewsButton
              href={`${localePrefix(locale)}/government`}
              variant="red"
              size="lg"
              trailing={<span aria-hidden>{locale === 'he' ? '←' : '→'}</span>}
            >
              {t.backToRoster}
            </NewsButton>
          </section>
        </div>
      </main>

      <Colophon locale={locale} />
    </div>
  );
}
