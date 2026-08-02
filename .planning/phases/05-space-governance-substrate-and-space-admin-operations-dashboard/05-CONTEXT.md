# Phase 5: Space governance substrate and space-admin operations dashboard - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Delivers issue [#75](https://github.com/Taruu-ShowYourselves/taruu-monorepo/issues/75): a role-scoped `/space-admin/[spaceId]` surface for authorized space admins — space overview, proposal review queue, member/role management, content controls, aggregate metrics, notification composer, audit visibility, and escalation to super admins — plus the governance substrate it needs, which does not exist in this repo today.

The substrate (typed `spaces`, membership, explicit capability grants, immutable audit log, notification governance) is built once here and is deliberately shared: issue #68 later reuses it as the platform-wide moderation surface, and issue #74's non-municipal space types slot in as new rows rather than a schema change.

**Out of scope** (from #75, and enforced during planning): platform configuration, access to other spaces, raw identity documents, unrestricted bulk messaging, and #68's platform-wide admin surface itself.

</domain>

<decisions>
## Implementation Decisions

### Space model — additive, wraps municipalities

- New `spaces` table: uuid id, `type`, `slug`, geography, owner, verification state, plus a **nullable `municipality_code` FK** to `municipalities(code)`.
- Existing `municipality_id` columns on `users`, `votes`, and `treasury` stay untouched. No rewrite of three live tables, no churn in every repo that filters by municipality.
- This mirrors the strategy the municipalities migration itself used (NOT VALID foreign keys validated after a normalization pass, zero table rewrites) — see `supabase/migrations/20260728000001_municipalities.sql`.
- #74's org / urban-area / national space types become new `spaces` rows later, not a migration.

### Capabilities — per-action grants, roles as presets

- `space_capability_grants(user_id, space_id, capability, granted_by, granted_at, suspended_at)`. **Default deny.**
- Roles are named capability bundles applied at grant time, not stored authority. There is no role column that confers power on its own, and no broad admin boolean anywhere — #75 requires explicit capabilities.
- Super-admin suspension is setting `suspended_at`, a single nullable column. Access dies; audit rows are never deleted. This is exactly the fourth acceptance criterion.
- Every capability check resolves server-side per request from the DB. The JWT stays as-is (`userId/googleId/did/email`) — no roles claim, so a stale token can never carry stale authority.

### Proposals — review states on `votes`

- Extend `vote_status` with `draft | in_review | changes_requested | rejected` and gate publication behind approval.
- Today `initialStatus(start, now)` at `apps/web/src/server/app/votes/create-vote.ts:82` publishes with **no review gate at all**; `pending` currently means "scheduled, not started", not "awaiting approval". Planning must not conflate the two.
- One table, existing reads keep working, publication becomes the approved transition.
- **Requires a backfill** defaulting all existing rows to approved, and it touches the live create-vote path — call this out as a plan-level risk.

### Notifications — in-app + push

- Persist an in-app notification row per recipient, then fan out to existing Expo push tokens via `activeTokensForUsers` in `apps/web/src/server/infra/supabase/push.repo.ts`.
- No email for v1. Resend is wired but email needs unsubscribe handling plus bounce/complaint tracking before an admin-authored surface can safely use it.
- Audience preview, quota, and opt-out are all enforced **server-side before any send** — the delivery log must prove that delivered recipients equal the previewed authorized audience.

### Claude's Discretion

- Capability vocabulary (the concrete list of action names) and which bundles constitute the shipped role presets.
- Audit table shape beyond the mandated columns (actor, timestamp, prior state, new state, reason, related object) and how immutability is enforced — RLS, revoke-UPDATE/DELETE grants, or trigger.
- Concurrency mechanism for deterministic conflicting decisions (conditional update on prior state vs advisory lock vs unique partial index).
- Dashboard information architecture and component composition within the press design system.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Issue scope
- Issue #75 — acceptance criteria, verification plan, and the explicit out-of-scope list. Fetch with `gh issue view 75 --repo Taruu-ShowYourselves/taruu-monorepo`.
- Issue #74 — the typed space model this substrate must not contradict.
- Issue #68 — the platform-wide surface that will reuse this substrate.

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — layering rules.
- `.planning/codebase/CONVENTIONS.md` — naming and file placement.
- `.planning/codebase/TESTING.md` — test layout and patterns.
- `.planning/codebase/CONCERNS.md` — known open risks, including the Auth0 callback CSRF gap.

### Server patterns to follow, not reinvent
- `apps/web/src/app/api/verification/document/route.ts` — the canonical thin route shell: session → rate limit → zod parse → use-case → respond.
- `apps/web/src/server/http/errors.ts` — closed `AppError` union; `toHttp` is an exhaustive switch, so a new variant without a mapping is a compile error. `forbidden()` is the default-deny return for every cross-space attempt.
- `apps/web/src/server/infra/supabase/identity.repo.ts` — repo shape, including its append-only event-insert pattern.
- `apps/web/src/lib/rate-limit.ts` — `createRateLimiter` / `createRateLimitResponse`, needed for notification composer quotas.

### Data layer
- `supabase/migrations/20260728000001_municipalities.sql` — the additive-migration precedent this phase follows.
- `supabase/migrations/20260628000002_fix_rls_user_id_helper.sql` — RLS reads go through `public.user_id()`, **not** `auth.uid()`, because the built-in helper returns NULL under this project's custom JWT.

### Product surface
- `apps/web/src/middleware.ts` — Hebrew-only, everything routes under `/he`; the dashboard route must live under the locale segment.
- `docs/SITE-OVERVIEW-2026-07.md` — current site surface.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getSessionFromRequest` (`apps/web/src/services/auth/session.ts`) — session extraction for every admin route.
- `respond` / `parse` (`apps/web/src/server/http/respond.ts`) and the `AppError` constructors — the whole HTTP edge.
- `activeTokensForUsers` (`apps/web/src/server/infra/supabase/push.repo.ts`) — push fan-out for the notification composer.
- `createRateLimiter` (`apps/web/src/lib/rate-limit.ts`) — the existing named limiters (`identityDocumentLimiter` et al.) show the per-surface pattern to copy for notification quotas.
- Press design system components in `apps/web/src/components/press/` — CSS Modules, design tokens only, RTL.

### Established Patterns
- Hexagonal server layer `apps/web/src/server/{http,app,domain,infra}`; use-cases return `neverthrow` Results and routes stay thin. New admin use-cases go in `server/app/space-admin/`, pure authorization logic in `server/domain/`, queries in `server/infra/supabase/`.
- Zod contracts live in `packages/shared/src/contracts/` and are exported through `index.ts`.
- Migrations are RLS-first: per-user reads via `public.user_id()`, writes service-role.
- Hebrew/RTL only; no hardcoded colors, spacing, or sizes — design tokens per CLAUDE.md.

### Integration Points
- `spaces.municipality_code` → `municipalities(code)` is the single join back to existing scoping.
- `vote_status` extension changes the create-vote publication path (`server/app/votes/create-vote.ts`) and every reader of vote status, including `server/domain/votes/vote.ts:66-69`.
- New route group under `apps/web/src/app/[locale]/space-admin/[spaceId]/`, new API routes under `apps/web/src/app/api/space-admin/`.
- No admin surface exists in this repo to extend — the #42/#44 admin lives in the separate `taruu-agents` repo and is not a dependency.

</code_context>

<specifics>
## Specific Ideas

- Authorization is the product here, not a wrapper around it. Every read and every mutation resolves capability server-side; UI hiding is explicitly declared insufficient by #75. The object-level test — a space admin swapping `spaceId` in the URL or an API identifier and getting `FORBIDDEN` — is the phase's headline criterion.
- Suspension must never cascade to audit rows. Prove it with a test that suspends an admin and then reads their historical decisions.
- Notification audience correctness is a test, not a review item: delivered recipients must equal the previewed authorized audience, opt-outs honored.

</specifics>

<deferred>
## Deferred Ideas

- Platform-wide (super-admin) moderation surface — issue #68, reuses this substrate.
- Non-municipal space types (organization, urban area, nationwide civic), discovery/join/leave flows, org profiles, space switcher — issue #74.
- Email as a notification channel — needs unsubscribe, bounce, and complaint handling first.
- Statistics dashboard in admin — issue #91.

</deferred>

---

*Phase: 05-space-governance-substrate-and-space-admin-operations-dashboard*
*Context gathered: 2026-08-02*
