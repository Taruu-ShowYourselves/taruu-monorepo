# Spec — issue #69 research-brief-persistence v1

## Current state

`CreateVoteRequestSchema` accepts proposal prose but no identifiable research brief or citations; the contract is mirrored by `packages/api-client/src/votes.ts`. `POST /api/votes` delegates to `createVote()`, which immediately creates an `in_review` vote. Persistence is split across `insertVote()` and `insertVoteOptions()`, and the `votes` table has no research-packet columns. Existing review and public-visibility behavior must remain unchanged. Payment, attachments, durable drafts, submission idempotency, and distinct lifecycle states remain missing and require later slices.

The full issue must be **split**: it combines schema design, payment capture, webhook reconciliation, file security, workflow changes, two clients, and administrative UI. This half-day slice establishes only the mandatory textual research-brief and citation persistence boundary.

## Goal

Require every newly created vote submitted through `POST /api/votes` to include a nonblank textual research brief, optionally preserve a bounded list of source citations, and persist both with the vote. This is a contract-and-persistence foundation only: it does not claim that the overall paid-submission workflow is complete, and it retains the existing `in_review` creation behavior until later lifecycle and payment slices land.

## In scope

- claim: packages/shared/src/contracts/vote.ts
- claim: packages/shared/src/contracts/__tests__/vote.test.ts
- claim: packages/api-client/src/votes.ts
- claim: packages/api-client/src/__tests__/votes.test.ts
- claim: apps/web/src/app/api/votes/route.ts
- claim: apps/web/src/server/app/votes/create-vote.ts
- claim: apps/web/src/server/infra/supabase/vote.repo.ts
- claim: apps/web/src/lib/supabase/types.ts
- claim: apps/web/src/__tests__/api/votes.test.ts
- claim: supabase/migrations/20260816000001_vote_research_packet.sql

## Out of scope

- Draft persistence or editing.
- Submission idempotency and transactional insertion of votes and options.
- Checkout creation, payment capture, payment returns, receipts, refunds, reconciliation, or changes to the existing approval-time fee.
- Any change under `apps/web/src/app/api/payments/`.
- Attachments, uploads, storage policies, sanitization, malware scanning, or quarantine.
- Optional structured legal, budget, stakeholder, implementation, or survey analyses.
- New status values or transitions, creator resubmission, approval/publication separation, or platform-admin authority.
- Changes to admin review, audit records, publication, public visibility, or voting participation.
- Web or mobile UI changes.
- Backfilling research content for historical votes.
- Production migration execution.
- Screenshots; this backend-only slice has no new visual state.

Proposed subsequent slices:

1. Durable draft plus atomic/idempotent submission.
2. Hosted ₪50 checkout, verified payment binding, kill switch, and reconciliation.
3. Attachment storage, scanning, sanitization, and access control after provider/policy decisions.
4. Review/resubmission/approval/publication state-machine changes.
5. Web creation, payment-return, status, and admin-review UI.
6. Mobile parity after the web/server workflow stabilizes.

## Contracts

Add these request fields to `CreateVoteRequestSchema`:

```ts
researchBrief: string // trim, min 100, max 20_000 characters

citations?: Array<{
  title: string; // trim, min 1, max 300
  url: string;   // absolute http/https URL, max 2_048
}> // max 50 entries
```

`researchBrief` is distinct from the existing proposal `description`; neither substitutes for the other. Empty or whitespace-only briefs fail request validation before orchestration. Citation order, title, and URL are preserved exactly after schema trimming. Duplicate citations are accepted in this slice because normalization and document deduplication remain unresolved.

`CreateVoteCommand` carries validated `researchBrief` and `citations` into `insertVote()`. The route must not synthesize either value or accept them from query parameters.

Migration `20260816000001_vote_research_packet.sql` adds:

- `votes.research_brief text NULL`
- `votes.research_citations jsonb NOT NULL DEFAULT '[]'::jsonb`
- a check that `research_brief` is either null for historical rows or has a trimmed length from 100 through 20,000;
- a check that `research_citations` is a JSON array.

The migration intentionally permits `NULL` research briefs on existing rows. Application validation makes the brief mandatory for all new `POST /api/votes` requests. No status enum or payment schema changes are included.

Regenerate `apps/web/src/lib/supabase/types.ts` from the migration; do not hand-maintain a schema shape that differs from generated output.

Response compatibility is preserved: `CreateVoteResponseSchema` and the public `VoteSchema` do not expose the research packet in this slice. This avoids publishing research content before its access-control and presentation contract is designed.

Invariants that must survive:

- New API-created votes cannot omit the research brief.
- Research content is never inferred from `description`.
- Existing historical rows remain readable.
- A valid packet still creates the existing `in_review` state; it is not described as paid, approved, or published.
- Vote participation remains free and unchanged.
- No provider call, charge, payment record, receipt, or approval transition is introduced.
- No migration other than the named migration is applied or modified.

## Acceptance gates

- G-1: Shared contract tests prove missing, blank, 99-character, and over-20,000-character research briefs are rejected, while boundary-valid briefs are accepted. → evidence: `pnpm --filter @sync/shared test -- src/contracts/__tests__/vote.test.ts`
- G-2: Shared contract tests prove citation count, title length, URL protocol, and URL length limits; valid ordered citations survive parsing. → evidence: `pnpm --filter @sync/shared test -- src/contracts/__tests__/vote.test.ts`
- G-3: API tests prove `POST /api/votes` returns the existing validation error response and performs no repository insertion when the brief is absent or invalid. → evidence: `pnpm --filter web test -- src/__tests__/api/votes.test.ts`
- G-4: API tests prove a valid brief and citations reach creation orchestration and persistence unchanged except for declared trimming, and the created vote remains `in_review`. → evidence: `pnpm --filter web test -- src/__tests__/api/votes.test.ts`
- G-5: API-client tests prove the client serializes `researchBrief` and `citations` in the creation request without adding any payment field. → evidence: `pnpm --filter @sync/api-client test -- src/__tests__/votes.test.ts`
- G-6: The migration contains the two declared columns, JSON-array constraint, and nullable historical-row-compatible brief constraint, and generated Supabase types contain both fields. → evidence: `rg -n "research_brief|research_citations|jsonb_typeof" supabase/migrations/20260816000001_vote_research_packet.sql apps/web/src/lib/supabase/types.ts`
- G-7: The repository passes contract compatibility and static typing across affected workspaces. → evidence: `pnpm typecheck`
- G-8: Existing voting-participation tests remain green, demonstrating no payment gate was added to voting. → evidence: `pnpm --filter web test -- src/__tests__/api/vote-participation.test.ts src/__tests__/api/vote-participated.test.ts`
- G-9: No files outside the claims changed. → evidence: `git diff --name-only`
- G-10: No payment route or workflow file changed. → evidence: `git diff --quiet -- .github/workflows apps/web/src/app/api/payments`

## Protected paths

- `supabase/migrations/` — protected and narrowly authorized only for `20260816000001_vote_research_packet.sql`; migration-ledger drift prohibits applying all pending migrations.
- `.github/workflows/` — protected; no CI workflow changes are authorized.
- `apps/web/src/app/api/payments/` — protected; payment behavior is explicitly deferred and must remain unchanged.

## Risk & rollback

The primary compatibility risk is that enforcing the required field immediately breaks the existing web and mobile creation clients, which do not send a research brief. Therefore this backend slice must not be deployed independently to user-facing environments; it must remain behind the PR delivery sequence until a compatible creation UI is ready, or deployment must be coordinated atomically with that later client slice.

Malformed citation JSON could make rows difficult to consume; the database array check and bounded application schema provide backstops. Historical records remain compatible because `research_brief` is nullable at the database layer.

Rollback consists of reverting the application, contract, client, and generated-type changes. If the migration has already been applied, leave the additive nullable columns in place during application rollback rather than dropping stored research data. A later, separately reviewed cleanup migration may remove them only after confirming they contain no required data. No payment, approval, publication, or participation data is modified by this slice.