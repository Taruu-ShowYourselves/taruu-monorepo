import React from 'react';
import { redirect } from 'next/navigation';
import type { Result } from 'neverthrow';
import type { ProposalListResponse } from '@sync/shared/contracts';
import {
  ErrorPanel,
  SpaceAdminHeader,
  SpaceAdminNav,
} from '@/components/space-admin';
import { spaceTypeLabel, visibleNavHrefs } from '@/components/space-admin/chrome';
import { EscalationDialog } from '@/components/space-admin/EscalationDialog';
import kicker from '@/components/space-admin/kicker.module.css';
import type { Locale } from '@/lib/i18n';
import { getProposalDetail } from '@/server/app/space-admin/decide-proposal';
import { getSpaceOverview } from '@/server/app/space-admin/get-space-overview';
import { listSpaceProposals } from '@/server/app/space-admin/list-proposals';
import type { AppError } from '@/server/http/errors';
import { getSessionFromCookies, type Session } from '@/services/auth/session';
import {
  DEFAULT_PROPOSAL_FILTER,
  PROPOSAL_FILTERS,
  ProposalsClient,
  type ProposalsFilter,
} from './ProposalsClient';
import styles from './page.module.css';

/**
 * Surface 2 — `/he/space-admin/{spaceId}/proposals`.
 *
 * This page resolves its own authorization, on every request, through the same
 * use-cases the API routes call. The layout above it renders chrome only and
 * is deliberately not the boundary, so the "swap the spaceId and get refused"
 * test applies to this surface independently of the other five.
 */

const HEADING_ID = 'space-admin-proposals-heading';

type SearchParams = Record<string, string | string[] | undefined>;

interface ProposalsPageProps {
  params: Promise<{ locale: Locale; spaceId: string }>;
  searchParams: Promise<SearchParams>;
}

const readParam = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const isFilter = (value: string | null): value is ProposalsFilter =>
  value !== null && (PROPOSAL_FILTERS as readonly string[]).includes(value);

/**
 * "Show all" is two authorized reads rather than one.
 *
 * The queue read with no status returns the four REVIEW statuses; the
 * published one is not among them. An audit-log link points at a DECIDED
 * proposal, so a single unfiltered read would silently omit exactly the rows
 * the deep link exists to reach.
 */
async function loadProposals(
  session: Session,
  spaceId: string,
  status: ProposalsFilter,
): Promise<Result<ProposalListResponse, AppError>> {
  if (status !== 'all') return listSpaceProposals(session, spaceId, { status });

  const [underReview, published] = await Promise.all([
    listSpaceProposals(session, spaceId, {}),
    listSpaceProposals(session, spaceId, { status: 'active' }),
  ]);

  return underReview.andThen((review) =>
    published.map((approved) => ({
      proposals: [...review.proposals, ...approved.proposals].sort((a, b) =>
        b.submittedAt.localeCompare(a.submittedAt),
      ),
    })),
  );
}

export default async function SpaceProposalsPage({
  params,
  searchParams,
}: ProposalsPageProps) {
  const { locale, spaceId } = await params;
  const query = await searchParams;

  const session = await getSessionFromCookies();
  if (!session) redirect(`/${locale}/sign-in`);

  // Shell identity and the capability set. A membership that does not resolve
  // is the same opaque refusal as a space that does not exist.
  const overview = await getSpaceOverview(session, spaceId);
  if (overview.isErr()) {
    // No header and no nav here on purpose: the space has not been disclosed,
    // and naming it in the refusal would answer the question the refusal is
    // withholding. The escalation path is still present.
    return (
      <div className={styles.surface}>
        {overview.error.kind === 'FORBIDDEN' ? (
          <EscalationDialog spaceId={spaceId} trigger="no-permission" />
        ) : (
          <ErrorPanel />
        )}
      </div>
    );
  }

  const { space } = overview.value;
  const deepLinkId = readParam(query.proposal);
  const requested = readParam(query.status);
  // The deep link forces the filter to show everything BEFORE expanding.
  // Surface 2 opens on `in_review`, and audit-log subjects are decided
  // proposals that view excludes — without this the panel would silently fail
  // to open on exactly the links that matter.
  const status: ProposalsFilter = deepLinkId
    ? 'all'
    : isFilter(requested)
      ? requested
      : DEFAULT_PROPOSAL_FILTER;

  const listed = await loadProposals(session, spaceId, status);
  const detail = deepLinkId ? await getProposalDetail(session, spaceId, deepLinkId) : null;

  const shell = (
    <>
      <SpaceAdminHeader
        spaceName={space.nameHe}
        spaceTypeLabel={spaceTypeLabel(space.type)}
        slug={space.slug}
        spaceId={space.id}
        suspended={space.suspended}
      />
      <SpaceAdminNav
        spaceId={space.id}
        active="proposals"
        visibleHrefs={visibleNavHrefs(space.capabilities)}
        locale={locale}
      />
      <h2 id={HEADING_ID} className={styles.srOnly}>
        תור הכרעה
      </h2>
      <span className={kicker.kicker}>
        <span aria-hidden className={kicker.tick}>
          ■
        </span>
        תור הכרעה · REVIEW QUEUE
      </span>
      <p className={styles.standfirst}>
        הצעה מתפרסמת לתושבים רק אחרי אישור. כל הכרעה כאן דורשת נימוק ונרשמת ביומן.
      </p>
    </>
  );

  if (listed.isErr()) {
    // The admin is a member here but holds no `proposal.read`: the page stays
    // coherent — masthead, header, nav, footer — and the surface itself is the
    // refusal, with the escalation path on it.
    return (
      <section className={styles.surface} aria-labelledby={HEADING_ID}>
        {shell}
        {listed.error.kind === 'FORBIDDEN' ? (
          <EscalationDialog spaceId={spaceId} trigger="no-permission" />
        ) : (
          <ErrorPanel />
        )}
      </section>
    );
  }

  return (
    <section className={styles.surface} aria-labelledby={HEADING_ID}>
      {shell}
      <ProposalsClient
        spaceId={space.id}
        spaceName={space.nameHe}
        status={status}
        proposals={listed.value.proposals}
        canApprove={space.capabilities.includes('proposal.approve')}
        canReject={space.capabilities.includes('proposal.reject')}
        canModerate={space.capabilities.includes('content.moderate')}
        initialDetail={detail?.isOk() ? detail.value : null}
        deepLinkMissing={detail?.isErr() ?? false}
      />
    </section>
  );
}
