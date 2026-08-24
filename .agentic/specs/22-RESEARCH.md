# Research — issue #22

## Already-done check

The issue provides no explicit acceptance criteria. The repository’s current work order defines the immediate #22 scope as three RLS hotfixes, followed by selected security-audit findings and a broader service-role migration ([docs/WORK-ORDER.md](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/docs/WORK-ORDER.md>)).

- Webhook replay guard protected from anonymous deletion: **MISSING**. `webhook_events` still has an unrestricted `FOR ALL USING (true)` policy without `TO service_role` ([20250115000002_webhook_events.sql](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/supabase/migrations/20250115000002_webhook_events.sql>)).
- Vote NFT user/wallet linkage no longer publicly readable: **MISSING**. `vote_nfts` still has public `SELECT USING (true)` over the complete row ([20250118000001_vote_nfts.sql](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/supabase/migrations/20250118000001_vote_nfts.sql>)).
- Self-service user updates restricted to approved columns: **MISSING**. The policy permits an owner to update their entire row; no column-level UPDATE grants or protective trigger are present ([20240101000001_rls_policies.sql](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/supabase/migrations/20240101000001_rls_policies.sql>)).
- Audit finding 1, duplicate payment fulfilment: **DONE**. `markPaymentCompleted` atomically claims `pending → completed`, and the webhook gates fulfilment on the returned row ([db.ts](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/apps/web/src/lib/supabase/db.ts>), [payment webhook](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/apps/web/src/app/api/payments/webhook/route.ts>)).
- Audit finding 2, client coordinates trusted at ballot time: **DONE by superseding the flow**. The participation contract now accepts only `optionId`; ballots are free, use previously established residency, and perform no blockchain write ([participate route](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/apps/web/src/app/api/votes/[id]/participate/route.ts>)).
- Audit finding 4, duplicate token/entitlement fulfilment: **DONE at the application claim seam** through the same atomic payment claim ([payment webhook](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/apps/web/src/app/api/payments/webhook/route.ts>)).
- Audit finding 6, treasury identity disclosure: **DONE**. The municipality ledger explicitly omits `user_id` and `payment_id`; the own-contributions query applies `user_id` in SQL ([transactions route](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/apps/web/src/app/api/treasury/[municipality]/transactions/route.ts>), [db.ts](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/apps/web/src/lib/supabase/db.ts>)).
- Full security pass: **MISSING**. Confirmed unresolved examples include server-side Google OAuth state/PKCE and client-supplied Bags swap quotes ([auth callback](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/apps/web/src/app/api/auth/callback/route.ts>), [Bags swap route](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/apps/web/src/app/api/bags/swap/route.ts>), [SECURITY-AUDIT.md](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/SECURITY-AUDIT.md>)).

**Verdict: proceed.** Do not close issue #22.

## Current-state map

- Database security lives in `supabase/migrations/`. Policies are additive/corrective migrations; existing historical files should not be rewritten.
- The original RLS policy set and `public.user_id()` helper originate in [20240101000001_rls_policies.sql](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/supabase/migrations/20240101000001_rls_policies.sql>).
- The working RLS identity transport is a short-lived ES256 JWT used with the anon-key client:
  - [user-token.ts](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/apps/web/src/lib/supabase/user-token.ts>)
  - [user-client.ts](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/apps/web/src/lib/supabase/user-client.ts>)
  - [20260802000001_rls_transport.sql](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/supabase/migrations/20260802000001_rls_transport.sql>)
- Most legacy data access remains centralized in [db.ts](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/apps/web/src/lib/supabase/db.ts>) and uses `supabaseAdmin`.
- Privileged Supabase access is explicitly marked as RLS-bypassing in [server.ts](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/apps/web/src/lib/supabase/server.ts>).
- Newer server code uses application/domain/repository layers under:
  - `apps/web/src/server/app/`
  - `apps/web/src/server/domain/`
  - `apps/web/src/server/infra/supabase/`
- HTTP authentication is normally established with `getSessionFromRequest`; newer routes then pass the session into Result-based application services.
- Object authorization for service-role repositories must be enforced in application/repository predicates, not assumed from RLS. This is documented directly in `server/app/space-admin/authorize.ts` and the space repository files.
- Voting is free and idempotent through `recordUserVoteOnce`; the current ballot route has no payment or blockchain seam.
- Blockchain integrations remain under:
  - `apps/web/src/services/qubik/`
  - `apps/web/src/services/bags/`
  - `apps/web/src/services/nft/`

## Integration points

- RLS subject helper: `public.user_id()` reads the verified PostgREST JWT `sub`; do not use `auth.uid()` because Supabase Auth is disabled.
- User-scoped data port: `createUserScopedClient(userId)` in `apps/web/src/lib/supabase/user-client.ts`.
- Privileged data port: `supabaseAdmin` in `apps/web/src/lib/supabase/server.ts`; it bypasses all RLS.
- Legacy repository layer: exported functions in `apps/web/src/lib/supabase/db.ts`.
- New repository layer: `apps/web/src/server/infra/supabase/*.repo.ts`, returning `neverthrow` Results where paired with `server/app`.
- Authentication seam: `getSessionFromRequest(request)` in `apps/web/src/services/auth/session.ts`.
- Authorization seams: `apps/web/src/server/app/authz/` plus resource-specific authorizers such as `server/app/space-admin/authorize.ts`.
- Payment idempotency seam: `markPaymentCompleted()`; downstream treasury, entitlement, and token work must remain gated on its non-null result.
- Ballot idempotency seam: `recordUserVoteOnce()` backed by the database uniqueness constraint.
- Shared voting eligibility seam: `votingGate` from `packages/shared`; do not re-derive score/residency rules locally.
- Required hotfix policy seams:
  - Drop/recreate the `webhook_events` policy with an explicit privileged role or deny-all client posture.
  - Replace public whole-row `vote_nfts` access with a projection/view or restricted policy/API boundary that does not expose holder linkage.
  - Restrict `users` self-updates at the database level using column grants and/or a trigger; row ownership alone is insufficient.
- Latest migration is `20260811000004_pilot_program.sql`. A new migration must use a later unique timestamp/version; no existing migration should be renumbered.

## Prior art

The nearest merged PR is **PR #95**, commit `bc227bd` — “RLS transport, authz enforcement, re-scoped money model, press homepage.”

Copy from it:

- Corrective, forward-only migrations.
- A user-scoped anon-key client carrying a server-minted JWT.
- Explicit separation between the RLS-enforced client and the service-role client.
- Application authorization for service-role operations.
- Database/RLS assurance tests around the transport.

Related precedent:

- **PR #96**, commit `19d8d0e`, corrected the token signer to ES256.
- **PR #93**, commit `9d6bc53`, established the current space-admin application/domain/repository authorization pattern.
- Commit `31d6860` corrected `auth.uid()` policies to `public.user_id()`.

## Constraint register

- The working tree is clean and based directly on `origin/main`.
- Deployment state cannot be established from the working tree. Repository documentation says `20260807000001_identity_score_unification.sql` requires targeted application, but does not prove whether it has since been applied ([docs/WORK-ORDER.md](</home/sahar-admin/taruu-monorepo/.agentic/worktrees/22/docs/WORK-ORDER.md>)).
- No `CODEOWNERS` file was found, so no repository-defined protected-path ownership can be verified.
- Historical migrations are deployment history. Fixes must be new migrations, not edits to already-shipped files.
- Service-role repositories bypass RLS. RLS changes alone cannot fix authorization weaknesses on those paths.
- The three immediate RLS findings remain open in the exact tables claimed by the work order.
- Additional confirmed/open security areas include:
  - Google login state and PKCE remain client-only/absent server-side.
  - Bags swap execution still accepts a client-provided quote.
  - URL-carried webhook secrets remain listed as provider-dependent work in the audit/handover.
  - The audit document is partially stale: several findings it describes are now fixed in code. It should not be used as current-state evidence without checking each referenced path.
- `SECURITY-AUDIT.md` records a static audit only; it does not prove deployed database policy state.
- No live Supabase inspection or denial harness was available from the working tree, so unapplied migrations and production RLS behavior remain unverified.

## Open questions

1. What are the authoritative acceptance criteria for issue #22? The issue title alone is broader than the concrete work order.
2. Should the next PR contain only the three immediate RLS hotfixes, or also the remaining audit findings and Phase 7 service-role migration?
3. What public NFT data must remain queryable: mint metadata only, aggregate gallery data, or holder-linked records?
4. Which `users` columns are intentionally self-editable? The database currently provides no allowlist.
5. Has migration `20260807000001_identity_score_unification.sql` been applied in every target Supabase environment?
6. Is there an external protected-path or migration-approval policy not committed as `CODEOWNERS`?
7. Should Google OAuth state/PKCE and the Bags quote boundary be accepted within #22, or split into separately testable security issues?
8. What live SQL/RLS harness and database roles should supply the required denial evidence for the hotfix PR?