# Requirements: Taruu — P0 Payments + Go-Live

**Defined:** 2026-06-28
**Core Value:** A resident votes freely on their city's affairs, and supporters who believe in the cause fund the civic pool by buying into its token — so the money behind executed decisions is visible and anyone can join it.

## v1 Requirements

This milestone (re-scoped 2026-08-03): **participation is free**, vote creation costs **₪50** through the Green Invoice hosted form, and the **civic pool is funded by a tradeable Bags.fm token** that supporters buy into. Make the remaining money rails correct and secure, and go live. The card-on-file membership model this milestone was originally written around is retired — see the Payments section. A hard legal gate (COIN-01) precedes any live token surface.

### Foundation

- [x] **LAND-01**: Land the uncommitted change (Auth0 OIDC swap + Printful removal + RLS `public.user_id()` fix) as one clean commit, including the two cleanups — dead Printful entries in `.dev.vars.example` and orphaned `merch_orders` tracking/`pod_order_id` columns (drop or document as reserved).

### Security Prerequisites

- [x] **SEC-01**: Corrective migration replaces `auth.uid()` with `public.user_id()` on `treasury_transactions`, `issue_coin_holdings`, and `phone_verifications` policies, so per-user reads work and tables aren't anon-readable — before any card-on-file write to `treasury_transactions`. *(Done: 20260628000002_fix_rls_user_id_helper.sql — commit 31d6860)*
  > **Necessary but not sufficient — superseded by RLS-01..05 (Phase 5) and MIG-01..04 (Phase 7).** Discovered 2026-08-02 while researching Phase 5: SEC-01 corrected the *policies*, which were genuinely wrong, but the *transport* that would make any policy match was never wired up. `public.user_id()` (`20240101000001_rls_policies.sql:10-21`) reads `request.jwt.claims->>'sub'` first and falls back to `app.current_user_id`; nothing ever sets either. `withUserContext()` (`apps/web/src/lib/supabase/server.ts:67`) calls `set_claim('user_id', …)`, which writes `app.user_id` — a different key — and has zero call sites; even with the name fixed, `set_config(…, true)` is transaction-local and PostgREST is stateless HTTP, so the value would not survive to the next query. All real traffic uses the service-role client, which bypasses RLS entirely. SEC-01's policies are correct and remain correct; they simply never evaluate. Do not re-open SEC-01 — the corrective work is tracked below.
- [x] **SEC-02**: Treasury transactions endpoint (`api/treasury/[municipality]/transactions`) scopes results to the caller's `user_id` for non-admin requests (or strips `userId` and exposes only anonymized aggregates) — no full-ledger enumeration. *(Satisfied out of phase in commit 35b0709 — the endpoint strips `userId`/`paymentId` and whitelists `metadata`; verified 2026-08-03 and locked by a source guard in `__tests__/api/treasury-transactions.test.ts`.)*
- [ ] **SEC-03**: The vote-payment webhook verifies its secret via an HTTP header or payload HMAC (never a `?token=` URL param) and fails closed in production with constant-time comparison.
- [ ] **SEC-04**: The payment idempotency key is generated server-side and deterministically (`{userId}:{type}:{voteId|optionId}`), never using `Date.now()`, so retries dedupe.
- [ ] **SEC-05**: `env.ts` validates the variables actually read at runtime (rename `SUPABASE_SERVICE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`, add the `GREENINVOICE_*` vote-payment vars) and `validateEnv()` runs at app startup (fail-fast).

### Spike & Gate

- [x] **SPIKE-01**: Green Invoice sandbox spike confirms the saved-card token charge is a valid off-session MIT, documents 3DS/SCA + soft-decline behavior, and verifies `/payments/tokens/{id}/charge` returns a usable document + charge id.
- [x] **SPIKE-02**: Accountant/legal sign-off on merchant-of-record status — correct GI document type per flow, VAT treatment, refund/credit-note (זיכוי) mechanics, consumer-protection.
- [x] **SPIKE-03**: GI **Prime** plan provisioned and real Green Invoice + Supabase credentials in place (the ₪0.15/receipt rate the economics depend on).

### Payments (Green Invoice — creation fee only)

> **Re-scoped 2026-08-03.** The card-on-file membership model is retired. Participation is free (`cfa5d25`), and the civic pool is now funded by a tradeable Bags.fm token rather than by a per-member monthly charge (see COIN-01..04). PAY-01..05 described a product Taruu no longer sells; they are retired rather than deferred. What survives is the ₪50 vote-creation fee, which already works end to end through the GI hosted form.

- ~~**PAY-01**~~ RETIRED — card-on-file token storage. No recurring charge exists to store a card for.
- ~~**PAY-02**~~ RETIRED — ₪6 first-vote-of-month membership charge. Participation is free.
- ~~**PAY-03**~~ RETIRED — charge-then-commit ordering. Superseded by VOTE-03: free ballots commit directly.
- ~~**PAY-04**~~ RETIRED — ₪2.10/member/month pool accrual. Replaced by COIN-02.
- ~~**PAY-05**~~ RETIRED — declined-token retry path. No off-session token charge exists to decline.
- [ ] **PAY-06**: Vote creation charges **₪50** via the Green Invoice hosted form (100% platform; the civic pool is not credited on creation). *(Mechanism corrected: the original text said "the same token-charge flow" — the shipped and working path is the hosted form at `services/payments/greenInvoice.ts:213`.)*
- [ ] **PAY-07**: Each settled ₪50 creation charge issues a Green Invoice receipt (חשבונית/קבלה) with correct Israeli private-payer fields, and stores the document id with the transaction.
- [ ] **PAY-08**: Paddle is gone from the vote-payment flow, and all user-facing copy states the model accurately: participation is free, creating a vote costs ₪50, and the civic pool is funded by the token — not by a membership, and not by a per-vote share.

### Civic Pool (Bags.fm token)

> **Added 2026-08-03.** The civic pool is funded by a tradeable meme coin on Bags.fm (Solana) that supporters buy into because they believe in the cause — closer to a prediction-market posture than a subscription. Partial surface already exists: `/api/bags/{quote,swap,trending}` and the `/coin` pages.
>
> **HARD REGULATORY GATE.** A tradeable token whose proceeds fund a civic treasury raises Israeli securities and consumer-protection questions that are not a product decision. Written legal sign-off is required before any of this is live — this gate is stricter than SPIKE-02's, not a reuse of it.

- [ ] **COIN-01**: Legal sign-off, in writing, on the token's status under Israeli securities law, the treasury's custody structure, and what may and may not be claimed to buyers. Blocks everything else in this section.
- [ ] **COIN-02**: Token proceeds accrue to a per-municipality civic pool with an append-only ledger, reconciling against on-chain records with zero open mismatches.
- [ ] **COIN-03**: Buy/sell runs through the existing Bags surfaces with server-side validation; no raw chain error reaches the user, and every quote the UI shows is the quote that executes.
- [ ] **COIN-04**: Every public claim about the token — expected return, pool size, what the money funds — is one Taruu can actually back, with no implied guarantee of profit or of civic outcome.

### Go-Live

- [ ] **GO-01**: The app deploys to Cloudflare Workers with real credentials and GI Prime live.
- [ ] **GO-02**: An end-to-end money check passes — one real ₪50 vote-creation charge lands, the GI document issues, and the internal `transactions` table reconciles with zero open mismatches. *(Re-scoped 2026-08-03: the original text required a real participation charge, which cannot exist in a free-participation product, and quoted ₪5 against a ₪6 milestone.)*

### Participation Persistence (Phase 02.1 — P0 from the v1.0 audit, URGENT)

Free participation shipped in `cfa5d25` without resolving the participate API's payment-shaped contract; the UI bypassed the server entirely. These requirements exist because the live site currently shows residents a signed-and-sealed receipt for votes it never records.

- [x] **VOTE-01**: `/api/votes/[id]/participate` accepts a free-participation request with no `paymentTxId` and never returns 402 for it, while remaining gated on session and residency — the payment-shaped contract is removed, not bypassed. (Complete: contract layer in plan 02.1-01, server eligibility check in plan 02.1-02, route rewrite in plan 02.1-04.)
- [x] **VOTE-02**: The participation flow calls the server and reaches the receipt only on a confirmed write; a rejected or failed write shows a Hebrew/RTL error and no seal. A repeated submission records exactly one vote. (Server-side idempotency landed in plan 02.1-04; the client flow itself is plan 02.1-05.)
- [x] **VOTE-03**: A recorded free vote produces a `user_votes` row, an `incrementVoteOption` bump, and an updated `participant_count` — the same persistence the paid path got via `recordUserVote`. (Complete: idempotent insert primitive `recordUserVoteOnce` in plan 02.1-02, route wiring in plan 02.1-04.)
- [x] **VOTE-04**: `mockHash()` is removed and no user-facing copy claims a blockchain seal unless an actual chain write backs it; the receipt states only verifiable facts about the recorded ballot. (Client-side work, plan 02.1-05.)
- [x] **VOTE-05**: The ₪3 legacy is reconciled — the participate route stops minting 3 tokens and emailing `amount: 3` for a free vote, and `packages/shared/src/constants/index.ts` no longer leaves mobile charging ₪3 for what web gives free. (Complete: contract layer in plan 02.1-01, mobile copy in plan 02.1-03, route mint/email removal in plan 02.1-04.)

### Municipality Onboarding + Authority Dashboard (Phase 8 — issue #76, post-launch)

Built entirely on Phase 5's primitives — the role-grant schema, the authorization helper, the review console, and the audit table. Nothing here exists in the codebase today.

- [ ] **AUTH-01**: An organization becomes the official municipality only through super-admin evidence review; approval records actor, timestamp, evidence, and reason, and an unreviewed organization can hold no badge, no dashboard access, and no official-response authorship.
- [ ] **AUTH-02**: Representatives are invited into a single municipality with a lifecycle (invited, active, suspended, offboarded); the server-side authorization helper is the only enforcement point and denies all cross-municipality reads.
- [ ] **AUTH-03**: The authority dashboard exposes only aggregate or explicitly-public resident data for its own municipality, and withholds any aggregate below the minimum cohort size rather than rounding it.
- [ ] **AUTH-04**: Official responses are append-only and versioned — each revision retains author, timestamp, and prior text — and residents can visually distinguish them from Taruu-generated content.
- [ ] **AUTH-05**: Commitments and satisfaction snapshots are auditable across staff turnover: offboarding a representative revokes access without deleting the record they created.
- [ ] **AUTH-06**: Response deadlines and escalations are workflow states with recorded transitions, carrying no legal claim in either data model or copy; suspending an authority removes access without deleting history and leaves the public council page unchanged.

### RBAC + Admin Review (Phase 5 — issue #79a, post-launch)

- [ ] **RBAC-01**: A roles/role-grants schema exists with `super_admin`, `space_admin`, and `community_manager`, scoped per space where applicable — grants are rows with an explicit lifecycle, not a boolean column on `users`.
- [ ] **RBAC-02**: A single server-side authorization helper is the only enforcement point for privileged routes; authorization is never inferred client-side and never derived from payment state.
- [ ] **RBAC-03**: A community-manager application can be submitted and reviewed in an admin console — approve, reject, and suspend each record an actor, a timestamp, and a reason. Approval alone changes no authorization outcome.
- [ ] **RBAC-04**: Every grant, revocation, and suspension writes an append-only audit row that outlives the role change, and RLS denies anon-key reads of applications and audit rows.

### RLS Foundation (Phase 5 — corrective, supersedes SEC-01's transport gap)

- [ ] **RLS-01**: A server-side minter issues a short-lived Supabase access token from an already-verified session — HS256 over the Supabase project JWT secret, `sub` = the user's UUID, `role` and `aud` = `authenticated`, expiry measured in minutes not days. The long-lived `sync-session` cookie is never itself sent to PostgREST.
- [ ] **RLS-02**: A user-scoped Supabase client factory builds a client on the **anon/publishable** key with supabase-js's `accessToken` callback (confirmed available in the installed 2.90.1), so `request.jwt.claims->>'sub'` populates and `public.user_id()` returns the real user id with RLS enforced. `supabaseAdmin` remains available but is renamed or documented as explicitly privileged.
- [ ] **RLS-03**: The dead transport is removed, not left to mislead — `withUserContext()` (`apps/web/src/lib/supabase/server.ts:67`) and the `set_claim` SQL function are deleted, and `public.user_id()`'s `app.current_user_id` fallback is either removed or documented as unreachable under PostgREST.
- [ ] **RLS-04**: An automated RLS test harness exists: mint a token for user A, read through the user-scoped client, and assert that user B's rows are invisible and that anon-key reads return zero rows. This replaces the manual-only anon-key check and establishes the repo's first RLS test precedent.
- [ ] **RLS-05**: Phase 5's three new tables (`role_grants`, `community_manager_applications`, `role_grant_events`) carry real working policies rather than deny-all, and any policy that must consult a role table does so through a `SECURITY DEFINER` helper so policy evaluation cannot recurse.

### Service-Role Migration (Phase 7 — full migration off unguarded service-role access)

- [ ] **MIG-01**: Every one of the 25 RLS-enabled tables has its policies audited and corrected against the now-working transport; each of the 15 existing `USING (true)` policies is either confirmed as deliberately public with a written reason or replaced.
- [ ] **MIG-02**: All 112 exports of `apps/web/src/lib/supabase/db.ts` are classified user-initiated vs system, and every user-initiated path runs through the RLS-enforced user-scoped client.
- [ ] **MIG-03**: Remaining privileged access is legitimate and visible — webhooks, cron routes, NFT minting, and notification fan-out keep an explicitly-named privileged client with a per-call-site justification; no route reaches for service-role merely by habit.
- [ ] **MIG-04**: Migration is proven, not asserted — each migrated table has an RLS test in the RLS-04 harness showing cross-user reads are denied, and the full suite is green.

### Manager Billing + Subscription (Phase 6 — issue #79c, post-launch)

- [ ] **MGR-01**: Approval and billing are separate prerequisites — a ₪50 charge without approval grants nothing, and an approved applicant gains scoped access only after server-side confirmation of billing activation.
- [ ] **MGR-02**: The subscription state machine implements `active`, `past_due`, `grace`, `cancelled`, `rejected`, `suspended`, and `expired` with explicit recorded transitions; a super admin can suspend independently of billing, with a stored reason.
- [ ] **MGR-03**: Renewal handling is idempotent — duplicate or replayed provider events produce exactly one charge, one invoice, and one role transition; idempotency keys are server-generated and no raw card data is stored.
- [ ] **MGR-04**: Cancellation and the failed-payment grace policy produce documented, predictable access outcomes, and the user is notified on every state change affecting access.
- [ ] **MGR-05**: Reconciliation matches GI settlement records against internal subscription and charge rows to zero open mismatches; any ambiguous payment state leaves the role inactive.

### Space Governance & Space-Admin Operations (issue #75, appended scope — independent of the payments track)

- [x] **SPACE-01**: A typed `spaces` table exists (uuid id, type, slug, geography, owner, verification state) with a nullable `municipality_code` FK to `municipalities(code)`. Existing `municipality_id` columns on `users`, `votes`, and `treasury` are unchanged — additive only, no table rewrites.
- [ ] **SPACE-02**: Authority is expressed as explicit per-action capability grants (`space_capability_grants`), never a broad admin boolean and never a role column that confers power on its own. Default deny. Every capability is resolved server-side from the DB on every read and every mutation; the JWT carries no roles claim.
- [ ] **SPACE-03**: Object-level authorization holds — a space admin who changes `spaceId` in a URL or an API identifier receives `FORBIDDEN` for both reads and mutations, with no data disclosed in the error.
- [ ] **SPACE-04**: Every proposal decision and role change writes an immutable audit row carrying actor, timestamp, prior state, new state, reason, and related object. A reason is required at the API layer; audit rows cannot be updated or deleted by any application path.
- [ ] **SPACE-05**: The proposal review queue supports approve / reject / request-changes over `vote_status` review states (`draft`, `in_review`, `changes_requested`, `rejected`), gated ahead of publication. Conflicting simultaneous decisions resolve deterministically with no duplicate publication, and a reviewer cannot decide a proposal they submitted.
- [ ] **SPACE-06**: Member and role management plus permitted content controls are available within the administered space only, each mutation audited per SPACE-04.
- [ ] **SPACE-07**: Resident metrics are exposed as aggregates only; member listings carry privacy-safe fields needed for administration and never raw identity-document data.
- [ ] **SPACE-08**: The notification composer previews its audience, and the delivered recipient set equals the previewed authorized audience with opt-outs honored. Per-space quotas are enforced server-side before send, and a delivery log records what was sent to whom. Channels for v1 are in-app plus Expo push; no email.
- [ ] **SPACE-09**: A super admin can suspend a space admin's access (`suspended_at`) with immediate effect on authorization, without deleting any historical audit data, and space admins have an escalation path to super admins.
- [ ] **SPACE-10**: The dashboard ships at `/he/space-admin/[spaceId]` — Hebrew/RTL, design tokens only, no hardcoded colors or spacing — covering space overview, proposal review, members/roles, statistics, notification preview, and audit history at desktop and mobile widths.

> **Note on tick timing.** `phase complete` marks a requirement `[x]` when *a* plan declaring it
> finishes, but six of these requirements are covered by several plans each. A tick here means
> "some covering plan landed", not "the requirement is satisfied" — the authoritative check is
> `05-VERIFICATION.md` plus the evidence document from plan 05-16. SPACE-04 (plans 01, 02, 05, 07,
> 15, 16) and SPACE-09 (plans 01, 04, 06, 09, 12) were auto-ticked after plan 05-01 alone and have
> been reset; SPACE-01 is genuinely complete, since 05-01 is its only covering plan.

## v2 Requirements

### Vote-Bags Treasury Execution (separate later milestone)

- **BAG-01**: The monthly civic pool (₪2.10 × paying members) is allocated to that month's executed decisions, each showing a live balance.
- **BAG-02**: On-chain (Solana) read-only transparency mirror of each bag's lifecycle.
- **BAG-03**: In-house, dual-control vendor payout (KYC + approval + proof-of-execution) — gated on a license/trust structure.
- **BAG-04**: Refund path for failed/cancelled votes (GI credit-note).

### Payment Hardening (post-launch)

- **HARD-01**: Orphaned-charge recovery cron (charged-but-uncommitted / committed-but-uncharged).
- **HARD-02**: Refund/chargeback reversal entries on the treasury ledger.
- **HARD-03**: OAuth login-CSRF fix (server-side signed state + PKCE) on the Auth0 callback.
- **HARD-04**: Constant-time secret compare on cron endpoints; logger secret redaction.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Vote-bags withdrawal/execution | Needs license/trust + legal; separate milestone |
| Prepaid wallet / top-ups | Dropped — GI card-on-file at ₪5 replaces it |
| Batching (multi-vote per charge) | Dropped — one charge + one receipt per vote |
| Crypto custody of civic money (USDC) | Value stays fiat; chain is transparency-only |
| Tourist/foreign-card support | Loses money at any sane vote price; block/flag |
| Mobile payment surfaces | Web-first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAND-01 | Phase 1 | Complete |
| SEC-01 | Phase 1 | Complete |
| SPIKE-01 | Phase 2 | Complete |
| SPIKE-02 | Phase 2 | Complete |
| SPIKE-03 | Phase 2 | Complete |
| VOTE-01 | Phase 02.1 | Complete (plans 01, 02, 04) |
| VOTE-02 | Phase 02.1 | Complete (server-side idempotency plan 04; client flow plan 05) |
| VOTE-03 | Phase 02.1 | Complete (plans 02, 04) |
| VOTE-04 | Phase 02.1 | Complete (client-side, plan 05) |
| VOTE-05 | Phase 02.1 | Complete (plans 01, 03, 04) |
| SEC-02 | Phase 3 | Complete (35b0709, verified 2026-08-03) |
| SEC-03 | Phase 3 | Pending |
| SEC-04 | Phase 3 | Pending |
| SEC-05 | Phase 3 | Pending |
| PAY-01 | — | RETIRED 2026-08-03 (membership model dropped) |
| PAY-02 | — | RETIRED 2026-08-03 (membership model dropped) |
| PAY-03 | — | RETIRED 2026-08-03 (membership model dropped) |
| PAY-04 | — | RETIRED 2026-08-03 (membership model dropped) |
| PAY-05 | — | RETIRED 2026-08-03 (membership model dropped) |
| PAY-06 | Phase 3 | Pending |
| PAY-07 | Phase 3 | Pending |
| PAY-08 | Phase 3 | Pending |
| COIN-01 | Phase 3 | Pending (hard legal gate) |
| COIN-02 | Phase 3 | Pending |
| COIN-03 | Phase 3 | Pending |
| COIN-04 | Phase 3 | Pending |
| GO-01 | Phase 4 | Pending |
| GO-02 | Phase 4 | Pending |
| RBAC-01 | Phase 5 | Pending |
| RBAC-02 | Phase 5 | Pending |
| RBAC-03 | Phase 5 | Pending |
| RBAC-04 | Phase 5 | Pending |
| RLS-01 | Phase 5 | Pending |
| RLS-02 | Phase 5 | Pending |
| RLS-03 | Phase 5 | Pending |
| RLS-04 | Phase 5 | Pending |
| RLS-05 | Phase 5 | Pending |
| MGR-01 | Phase 6 | Pending |
| MGR-02 | Phase 6 | Pending |
| MGR-03 | Phase 6 | Pending |
| MGR-04 | Phase 6 | Pending |
| MGR-05 | Phase 6 | Pending |
| MIG-01 | Phase 7 | Pending |
| MIG-02 | Phase 7 | Pending |
| MIG-03 | Phase 7 | Pending |
| MIG-04 | Phase 7 | Pending |
| AUTH-01 | Phase 8 | Pending |
| AUTH-02 | Phase 8 | Pending |
| AUTH-03 | Phase 8 | Pending |
| AUTH-04 | Phase 8 | Pending |
| AUTH-05 | Phase 8 | Pending |
| AUTH-06 | Phase 8 | Pending |

**Coverage:** 47/52 mapped, 5 retired (PAY-01..05) — 0 orphaned

> **Audit note (2026-08-02):** the checkbox and Status columns above predate `.planning/v1.0-MILESTONE-AUDIT.md` and overstate progress. SPIKE-01/02/03 are marked Complete but their artifacts are unfilled templates. SEC-02 reads Pending but shipped out of phase in `35b0709`. PAY-02/03/04/08 and GO-02 are contradicted by shipped free participation and need rewriting rather than building. Audit-verified coverage is 2/28 of the pre-02.1 set.
| SPACE-01 | Phase 5 | Complete |
| SPACE-02 | Phase 5 | Pending |
| SPACE-03 | Phase 5 | Pending |
| SPACE-04 | Phase 5 | Complete |
| SPACE-05 | Phase 5 | Pending |
| SPACE-06 | Phase 5 | Pending |
| SPACE-07 | Phase 5 | Pending |
| SPACE-08 | Phase 5 | Pending |
| SPACE-09 | Phase 5 | Complete |
| SPACE-10 | Phase 5 | Pending |

**Coverage:** 29/29 requirements mapped — 0 orphaned

---
*Requirements defined: 2026-06-28*
*Traceability populated: 2026-06-28*
*Updated: 2026-08-02 — added Phase 5 (RBAC-01..04) and Phase 6 (MGR-01..05) from GitHub issue #79*
*Last updated: 2026-08-02 — added Phase 02.1 (VOTE-01..05) from the v1.0 milestone audit P0 finding*
