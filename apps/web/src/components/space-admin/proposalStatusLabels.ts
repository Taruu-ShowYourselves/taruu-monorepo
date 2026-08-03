import type { ProposalStatus } from '@sync/shared/contracts';

/**
 * The proposal status chip labels, in a module a CLIENT bundle may import.
 *
 * The source of truth is `REVIEW_STATUS_LABELS_HE` in
 * `apps/web/src/server/domain/space/review.ts`, which `review.test.ts` pins.
 * This map cannot import it, and the reason is structural rather than a
 * preference: `server/domain/votes/vote.ts` re-exports `REVIEW_VOTE_STATUSES`
 * from `review.ts` while `review.ts` imports `initialStatus` back out of it, so
 * the two modules form an import cycle. Reaching through it from a browser
 * bundle would also drag a server-domain module into the client for five
 * strings. Plan 05-10 hit the same wall and copied one label inline; this
 * module exists so the client side has ONE second definition rather than one
 * per surface.
 *
 * The five review labels are byte-identical to the server map — verified, not
 * assumed. If either side is reworded, both must move together, and the right
 * long-term fix is to lift the map into `packages/shared` (where the status
 * enum already lives) and have both sides import it. Named for 05-15/05-16:
 *   - repoint `apps/web/src/app/[locale]/votes/create/page.tsx` here, and
 *   - collapse this map and the server one into a single shared definition.
 *
 * `pending` and `ended` carry the approved label deliberately. A proposal
 * approved before its start date lands in `pending` — scheduled rather than
 * open — and the copy deck's own approve announcement calls that outcome
 * approved-and-published, so the chip says the same thing. `ended` is
 * unreachable from the review queue and is mapped only so the record is total.
 */
export const PROPOSAL_STATUS_LABELS_HE: Record<ProposalStatus, string> = {
  draft: 'טיוטה',
  in_review: 'בבדיקה',
  changes_requested: 'הוחזרה לתיקון',
  rejected: 'נדחתה',
  active: 'אושרה ופורסמה',
  pending: 'אושרה ופורסמה',
  ended: 'אושרה ופורסמה',
};

/**
 * The single red chip on this dashboard means "this needs your decision".
 * Every other status is an ink outline; there is no second status colour.
 */
export const proposalChipTone = (status: ProposalStatus): 'review' | 'neutral' =>
  status === 'in_review' ? 'review' : 'neutral';
