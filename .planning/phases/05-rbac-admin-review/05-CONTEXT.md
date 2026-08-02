# Phase 5: RBAC + Admin Review - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning
**Source:** PRD Express Path (GitHub issue #79 — "Paid community-manager onboarding and monthly billing")

<domain>
## Phase Boundary

Issue #79 asks for the whole community-manager lifecycle: recruit, approve, activate, bill, and offboard. It was deliberately split across two phases because the billing half is blocked on an unverified provider contract while the role half is not (see `.planning/STATE.md` → Blockers/Concerns).

**This phase delivers the role half only ("79a"):**

- A roles / role-grants schema with `super_admin`, `space_admin`, and `community_manager`.
- One server-side authorization helper that is the single enforcement point for every privileged route.
- A community-manager application: an applicant submits, an admin reviews, and the admin can approve, reject, or suspend with a recorded reason.
- An append-only audit trail of every grant, revocation, and suspension.

**The load-bearing property of this phase:** approval is a *standalone prerequisite that by itself grants nothing*. An approved applicant with no billing has no manager access. This phase must be built so that Phase 6 can add the billing prerequisite alongside approval without redesigning the authorization model — the helper must be able to require **both** conditions, and must not treat approval as sufficient.

**Second forward-compatibility constraint — GitHub issue #76.** `.planning/v1.0-MILESTONE-AUDIT.md` finds that issue #76 (municipality onboarding + authority dashboard) depends directly on this phase: the role model, the authorization helper, the super-admin review console, and the append-only audit table are the same infrastructure #76's acceptance criteria require. #76 is a continuation of this phase's line, not an independent milestone.

This does **not** widen Phase 5's scope — no authority onboarding, no dashboard, no organization verification here. It is a design constraint on how the three pieces are built:

- The role set must be extensible to an authority-representative role scoped to one municipality, without a schema rewrite.
- The review console must generalize to "an admin reviews a submitted claim and approves/rejects it with evidence and a reason", rather than hardcoding community-manager application as the only reviewable object.
- The audit table must be able to record approvals of things that are not role grants (#76 requires "commitment and satisfaction histories remain auditable after staff changes").

Build for that shape; do not build those features.

**Explicitly NOT in this phase** (all deferred to Phase 6): any payment code, any Green Invoice call, subscription state, renewal scheduling, invoices/receipts, grace/past-due policy, and reconciliation.

**Why there is nothing to build on:** the codebase currently has no role concept whatsoever. The `users` table (`supabase/migrations/20240101000000_initial_schema.sql:24`) has no role column, and there is not a single `is_admin` / `super_admin` / `space_admin` check anywhere under `apps/web/src`. Every line in issue #79 about "platform or authorized space admins" and "super admins may suspend" presumes infrastructure this phase creates from nothing.

</domain>

<decisions>
## Implementation Decisions

Everything in this section is a locked decision derived from issue #79 or from the Phase 5 success criteria in `.planning/ROADMAP.md`.

### Role model

- Three roles exist: `super_admin`, `space_admin`, `community_manager`.
- Role grants are **rows with an explicit lifecycle**, not a boolean column on `users`. (ROADMAP Phase 5 success criterion 1.)
- Grants are scoped per space where applicable — `super_admin` is platform-wide; `space_admin` and `community_manager` are scoped to a space.
- Issue #79 says review is performed by "platform or authorized space admins", so both `super_admin` and `space_admin` can act on applications within their scope.

### Authorization

- A **single** server-side authorization helper is the only enforcement point. Every privileged route calls it. (ROADMAP criterion 2.)
- Authorization is never inferred client-side.
- Authorization is never derived from payment state. Payment alone must never grant a role — this is issue #79's central requirement and its first acceptance criterion.
- The helper must be shaped so Phase 6 can require approval **AND** active billing without changing its call sites.

### Application and review

- An applicant submits a community-manager application.
- An admin sees pending applications in a review console and can approve, reject, or suspend.
- Every one of those transitions records an actor, a timestamp, and a reason. (Issue #79: "Allow super admins to suspend access independently of billing and record the reason.")
- Approval is **not** automatic. Issue #79 places automatic approval explicitly out of scope.
- Super admins can suspend access independently of any other condition.

### States

Issue #79 names a combined set of states across both halves: `active`, `past_due`, `grace`, `cancelled`, `rejected`, `suspended`, `expired`. `past_due`, `grace`, `cancelled`, and `expired` are billing states and belong to Phase 6.

This phase owns the application/grant states only — at minimum: submitted/pending, `approved`, `rejected`, `suspended`, and revoked. Transitions must be explicit and recorded, not implied by field mutation.

### Audit and data protection

- Every grant, revocation, and suspension writes an **append-only** audit row that outlives the role change itself. (ROADMAP criterion 5.)
- RLS denies anon-key reads of applications and audit rows.
- Follow the project's established RLS convention: policies use `public.user_id()`, **never** `auth.uid()` — the built-in helper returns NULL under this project's custom JWT. This was a corrective migration in Phase 1 (`20260628000002_fix_rls_user_id_helper.sql`) and repeating the mistake would silently break every per-user policy.

> **Correction from `05-RESEARCH.md` (2026-08-02) — read the research before acting on the paragraph above.** RLS is not currently a real enforcement layer in this codebase. `public.user_id()` reads a session config key that nothing ever sets, `withUserContext()` sets a differently-named key and has zero call sites, and all real traffic goes through the service-role client, which bypasses RLS entirely.
>
> **Decision (2026-08-02, user): fix the transport in this phase rather than work around it.** This supersedes the deny-all approach the first planning pass took. Requirements RLS-01..05 are now part of Phase 5. See the RLS Foundation section below.

### RLS Foundation (added 2026-08-02 — requirements RLS-01..05)

The user chose to make RLS genuinely work in this phase instead of shipping deny-all policies and inheriting a broken security layer. These are locked decisions.

**The diagnosis, verified against the code:**
- `public.user_id()` (`supabase/migrations/20240101000001_rls_policies.sql:10-21`) resolves `COALESCE(current_setting('request.jwt.claims', true)::json->>'sub', current_setting('app.current_user_id', true))::UUID`. The JWT branch is the correct design and was simply never fed.
- `withUserContext()` (`apps/web/src/lib/supabase/server.ts:67`) calls `set_claim('user_id', …)`, and `set_claim` does `set_config('app.' || claim, value, true)` → it writes `app.user_id`, but the function reads `app.current_user_id`. Name mismatch, and zero call sites.
- Even with the name corrected it cannot work: the third argument `true` makes the setting transaction-local, and PostgREST is stateless HTTP, so the RPC's transaction closes before the next query runs.
- `supabaseAdmin` uses the service-role key, which bypasses RLS regardless of any of the above.

**The fix:**
- Mint a **short-lived** Supabase access token server-side from an already-verified session: HS256 over the Supabase project JWT secret (a new env var, distinct from the existing `JWT_SECRET`), `sub` = the user's UUID, `role` and `aud` = `authenticated`, expiry in minutes. The long-lived `sync-session` cookie is never sent to PostgREST — it is not a database credential.
- Build the user-scoped client on the **anon/publishable** key using supabase-js's `accessToken` callback. Verified present in the installed version: `accessToken?: () => Promise<string | null>` in `@supabase/supabase-js@2.90.1` (note the lockfile is far ahead of `package.json`'s `^2.39.0`). Confirmed against Supabase's own docs as the canonical third-party-JWT pattern.
- Delete `withUserContext()` and the `set_claim` SQL function. Leaving dead security plumbing in place is worse than not having it, because the next reader assumes it works.
- Phase 5's three tables get **real** policies, not deny-all.

**Two traps that must be designed around:**
1. A policy on a role table that queries the role table recurses infinitely. Any role lookup inside a policy must go through a `SECURITY DEFINER` helper function.
2. Switching a route off `supabaseAdmin` before its policies exist silently returns zero rows rather than erroring. Policies land first, in the same migration.

**Scope boundary:** this phase builds the transport and applies it to its own three tables. Migrating the existing 25 tables and 112 `db.ts` exports is **Phase 7** and must not be attempted here.

### Claude's Discretion

Issue #79 does not settle these; the planner decides:

- What a "space" is concretely in this codebase — the natural candidate is a municipality (`supabase/migrations/20260728000001_municipalities.sql`), but the mapping is unstated in the issue and must be chosen and justified.
- Table and column naming, and whether applications and grants are one table or two.
- Whether roles are an enum type or a lookup table.
- How the helper reads identity — it must integrate with the existing session/JWT plumbing (`apps/web/src/app/api/auth/session/`, `apps/web/src/middleware.ts`) rather than inventing a parallel auth path.
- The admin review console's surface and its route placement. No UI-SPEC was generated for this phase; the console inherits the locked redesign system rather than introducing new visual language.
- Notification of applicants on approve/reject/suspend — issue #79 lists notifications, but its acceptance criterion ties them to the failed-payment/cancellation policy, which is Phase 6. Basic transition notification here is at the planner's discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` — Phase 5 section: goal, the five success criteria, and the context note on why no role system exists yet
- `.planning/REQUIREMENTS.md` — RBAC-01 through RBAC-04, the requirement IDs every plan must map to
- `.planning/STATE.md` — Blockers/Concerns (why the billing half is deferred) and Decisions (project history)

### Database and RLS conventions
- `supabase/migrations/20240101000000_initial_schema.sql` — the `users` table this phase must attach roles to; note it has no role column
- `supabase/migrations/20240101000001_rls_policies.sql` — the established RLS policy style
- `supabase/migrations/20260628000002_fix_rls_user_id_helper.sql` — **the `public.user_id()` vs `auth.uid()` rule.** Mandatory read; this is a repeat-offense trap
- `supabase/migrations/20260728000004_identity_documents.sql` — recent example of a privacy-sensitive scoped table with RLS, the closest existing analogue
- `supabase/migrations/20260728000001_municipalities.sql` — the likely concrete meaning of "space"

### Auth and request plumbing
- `apps/web/src/middleware.ts` — request-level interception; where or whether authorization hooks in
- `apps/web/src/app/api/auth/session/` — how a session is read server-side today
- `apps/web/src/lib/supabase/server.ts` — server-side Supabase client construction
- `specs/auth-flow.md` — the documented auth flow

### Project conventions
- `CLAUDE.md` — design tokens, RTL/Hebrew-only requirement, naming, import order, no hardcoded values
- `.planning/codebase/CONVENTIONS.md` — established code conventions
- `.planning/codebase/ARCHITECTURE.md` — layering
- `.planning/codebase/CONCERNS.md` — known security concerns to avoid repeating
- `specs/api-contracts.md` — API contract style for new endpoints

</canonical_refs>

<specifics>
## Specific Ideas

From issue #79, carried verbatim in intent:

- "Payment alone must never grant a role." This is the phase's defining constraint and the reason approval and billing are modeled as two independent prerequisites rather than one status field.
- "Platform or authorized space admins review applicants" — hence the `super_admin` / `space_admin` split rather than a single admin flag.
- "Allow super admins to suspend access independently of billing and record the reason" — suspension is not a billing state and must not be reachable only through billing.
- Verification plan (issue #79): the phase should be testable for approval-billing race conditions, role authorization, and notification delivery. The approval-billing race is the interesting one and is testable in this phase even though billing lands in Phase 6 — an approved-but-unbilled grant must never authorize.
- Visual evidence (issue #79): screenshots of the application form, admin review, and manager activation/suspension screens with sanitized test records.

</specifics>

<deferred>
## Deferred Ideas

All deferred to **Phase 6: Manager Billing + Subscription** (requirements MGR-01..05):

- The ₪50/month subscription, checkout, and tokenization
- Invoices and receipts
- Renewal state, idempotent renewal handling, and duplicate-event protection
- Failed-payment grace policy and past-due handling
- Cancellation
- Billing-driven role activation and suspension
- Reconciliation against Green Invoice settlement records
- The billing states `past_due`, `grace`, `cancelled`, `expired`

Out of scope for issue #79 entirely (both phases): vote-submission fees, salary or payment *to* managers, and automatic approval.

</deferred>

---

*Phase: 05-rbac-admin-review*
*Context gathered: 2026-08-02 via PRD Express Path (GitHub issue #79)*
