# Phase 7: Service-Role Migration — Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Source:** `.planning/ROADMAP.md` Phase 7; requirements MIG-01..04; the Phase 5 research finding that RLS is not an enforcement layer anywhere in this app.

---

## ⛔ HARD GATE — read before planning or executing anything

**Phase 5's RLS-01..05 must be BUILT, not merely planned.** There is no working transport to
migrate onto until they are. Concretely, all four of these must be true before plan 07-07 (the
first plan that touches a live database) can run, and before any wave-4 slice can prove anything:

| Gate | Where it stands 2026-08-03 | Evidence |
|---|---|---|
| `mintSupabaseAccessToken()` exists | ✅ built | `apps/web/src/lib/supabase/user-token.ts`, commit `96448b3` |
| `createUserScopedClient()` exists | ✅ built | `apps/web/src/lib/supabase/user-client.ts`, commit `96448b3` |
| `SUPABASE_JWT_SECRET` is set locally **and** as a Worker secret | ❌ **NOT SET** | `05-01-SUMMARY.md` → Blockers. `createUserScopedClient()` throws on first use until it is. |
| `20260802000001_rls_transport.sql` applied to the live database | ❌ **NOT APPLIED** | `05-01-SUMMARY.md`; application is Phase 5 plan 05-09 Task 1 |
| The HS256 assumption holds for this Supabase project | ❌ **UNVERIFIED** | Projects migrated to asymmetric signing keys have the legacy HS256 secret disabled. If this one is, RLS-01 as built does not apply and Phase 7 has no transport. |
| RLS-04 harness exists and is green with a **non-zero** test count | ❌ not built | Phase 5 plan 05-04; `apps/web/src/__tests__/rls/` does not exist yet |

Phase 5 is mid-execution on branch `feat/rls-transport`: plans 05-01 and 05-02 are committed,
05-03 is uncommitted work in progress, 05-04 through 05-09 are unrun.

**Do not start Phase 7 execution until Phase 5 plan 05-09 has completed.** Waves 1 and 2 of this
phase are inventory, documentation, test plumbing, and a mechanical file split — they can be
written and even executed against a credential-free tree. Everything from wave 3 onward is
worthless without the gate.

---

<domain>
## Phase Boundary

### What this phase is

Every user-initiated database path in the app runs RLS-enforced through Phase 5's user-scoped
client; every remaining privileged access is a deliberate, written-down exception; every migrated
table has an automated test proving user A cannot read user B's rows.

### What this phase is NOT

**It is not "delete `supabaseAdmin`."** Webhooks, cron routes, NFT minting, and notification
fan-out have no user session and legitimately require privileged access. A webhook has no cookie.
A minting worker acts for nobody. A notification fan-out reads other people's push tokens by
design. Those keep the privileged client.

The goal is that privileged access becomes a **visible, justified exception** rather than the
default every path reaches for. Success is not a lower `supabaseAdmin` count; success is that
every remaining one carries a written reason a reviewer can disagree with.

### Measured scope (re-counted 2026-08-03 — the roadmap's figures drifted)

| Roadmap said (2026-08-02) | Verified 2026-08-03 | Note |
|---|---|---|
| 25 RLS-enabled tables | **25** ✅ | 28 `ENABLE ROW LEVEL SECURITY` statements minus Phase 5's 3 new tables |
| 39 policies | **39 `CREATE POLICY` statements → 36 live distinct policies** ⚠️ | `20260628000002_fix_rls_user_id_helper.sql` DROPs 3 and re-CREATEs 3. Counting statements gives 39; counting live policies gives 36. Phase 5 adds 6 more (42 live). |
| 15 `USING (true)` policies | **14** ⚠️ | The 15th grep hit is a *comment* at `20260628000002_fix_rls_user_id_helper.sql:10`. |
| 27 files reference `supabaseAdmin` | **30** ⚠️ | +3 since the count: `lib/supabase/user-client.ts` (doc reference), `server/infra/supabase/role.repo.ts` (Phase 5 plan 05-03), `__tests__/services/treasury-transaction-scoping.test.ts`. 19 source files + 11 test files. |
| `db.ts` = 2404 lines, 112 refs, 112 exports | **2441 lines, 112 `supabaseAdmin` refs, 114 exports** ⚠️ | 114 = 107 functions + 7 exported types. The 112-reference count is exact. |
| 7 API routes use it directly | **7** ✅ | `bags/trending`, `stats/network`, `user/nfts`, `user/phone/send-code`, `user/phone/verify`, `votes/[id]/participate`, `votes/[id]/resolution` |

`MIG-02` says "all 112 exports of `db.ts`" — the real number is **114**. Plans must classify 114.

### Two live security findings the audit turned up

These are not "deliberate keep-or-replace decisions." They are bugs, and one of them is exploitable
today because `NEXT_PUBLIC_SUPABASE_ANON_KEY` is by definition public.

**FINDING-1 (HIGH) — `webhook_events` is anon read/write.**
`supabase/migrations/20250115000002_webhook_events.sql:68-72`:

```sql
CREATE POLICY "Service role full access to webhook_events"
  ON webhook_events
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

There is **no `TO service_role` clause**, so the policy defaults to `TO PUBLIC`. Every sibling
policy in the codebase that means "service role only" writes `TO service_role` explicitly (see
`20250116000001_treasury_and_issue_coins.sql:206-228`); this one forgot. The table is the
replay-attack guard: an anon caller can `DELETE` rows to re-enable webhook replay, or `INSERT`
rows keyed to a future `event_id` to make a legitimate webhook look already-processed. It also
exposes `payload_hash` and `idempotency_key`. **Fix this in wave 1, not wave 2.**

**FINDING-2 (MEDIUM-HIGH) — `vote_nfts` public read de-anonymizes participation.**
`20250118000001_vote_nfts.sql:169-172` is `FOR SELECT USING (true)` over a table whose columns
include `user_id UUID REFERENCES users(id)`, `wallet_address TEXT`, and `vote_id UUID`. Anyone
with the anon key can join a Taruu user id to a specific vote and a Solana wallet. The product
sells a secret ballot. Replace with own-row + a public projection that omits `user_id` and
`wallet_address`, or drop the public policy entirely and serve the public NFT gallery through a
privileged aggregate.

### Where the privileged surface actually lives

19 non-test source files, and the distribution is the whole story:

| File | `supabaseAdmin` refs | Tables |
|---|---|---|
| `apps/web/src/lib/supabase/db.ts` | **112** | 24 of the 25 |
| `apps/web/src/server/infra/supabase/role.repo.ts` | 14 | role_grants, community_manager_applications, role_grant_events |
| `apps/web/src/app/api/stats/network/route.ts` | 7 | treasury, user_votes, votes |
| `apps/web/src/server/infra/supabase/identity.repo.ts` | 7 | identity_documents, identity_document_events, users |
| `apps/web/src/app/api/user/phone/verify/route.ts` | 5 | users, phone_verifications |
| `apps/web/src/app/api/user/nfts/route.ts` | 4 | vote_nfts, votes |
| `apps/web/src/app/api/user/phone/send-code/route.ts` | 4 | phone_verifications (via RPC) |
| `apps/web/src/app/api/votes/[id]/resolution/route.ts` | 4 | issue_coins, vote_nfts, votes |
| `apps/web/src/app/[locale]/explore/data.ts` | 4 | treasury, user_votes |
| `apps/web/src/services/nft/index.ts` | 4 | user_votes, vote_options, votes |
| `apps/web/src/server/app/dashboard/get-dashboard.ts` | 3 | vote_nfts, votes |
| `apps/web/src/app/api/bags/trending/route.ts` | 2 | issue_coins |
| `apps/web/src/app/api/votes/[id]/participate/route.ts` | 2 | votes |
| `apps/web/src/server/infra/supabase/push.repo.ts` | 2 | push_tokens |
| `apps/web/src/services/treasury/bagSeeding.ts` | 2 | votes |
| `apps/web/src/server/infra/notify/vote-created.ts` | 1 | — (delegates) |
| `apps/web/src/lib/supabase/index.ts` | 1 | — (re-export) |
| `apps/web/src/lib/supabase/server.ts` | 1 | — (definition) |
| `apps/web/src/lib/supabase/user-client.ts` | 1 | — (doc comment) |

62 files import from `@/lib/supabase/db`. That import surface must not churn — see the barrel
decision below.

</domain>

---

<decisions>
## Implementation Decisions

### D1 — `db.ts` is split into domain modules behind a barrel, before anything is migrated

`db.ts` at 2441 lines with 114 exports across 24 tables is the whole problem. It cannot be one
plan, and it cannot be seven parallel plans either, because seven plans editing one file serialize
into seven waves.

**Decision:** waves 1–2 split `db.ts` into 15 domain modules under `apps/web/src/lib/supabase/db/`
and delete `db.ts`, replacing it with `db/index.ts` that re-exports all of them.

Because Node and TypeScript resolve `@/lib/supabase/db` to `db/index.ts` once `db.ts` is gone,
**all 62 importers keep working with zero edits.** The split is a pure move: no behaviour change,
no signature change, no import churn. Its verification is `pnpm --filter @sync/web test` staying
green at 827+ passing.

After the split, each migration slice owns its own module file exclusively and the seven slices run
in one parallel wave instead of seven sequential ones. This is also what makes each slice
independently reviewable — a reviewer reads one 150-line domain module, not a diff against a
2441-line file.

The 15 modules and their export counts (sum = 114):

| Module | Exports | Tables |
|---|---|---|
| `db/users.ts` | 9 | users, user_votes (read) |
| `db/social-proofs.ts` | 5 | social_proofs |
| `db/verification.ts` | 10 | verification_runs, verification_schedule, verification_attempts |
| `db/payments.ts` | 12 | payments, user_votes (read), entitlements (read) |
| `db/entitlements.ts` | 3 | entitlements |
| `db/votes.ts` | 13 | votes, vote_options, vote_sources, knesset_items, knesset_rankings |
| `db/ballots.ts` | 8 | user_votes, vote_options |
| `db/stats.ts` | 6 | users, user_votes, votes |
| `db/push.ts` | 6 | push_tokens |
| `db/webhooks.ts` | 4 | webhook_events |
| `db/treasury.ts` | 7 | treasury, treasury_transactions |
| `db/issue-coins.ts` | 8 | issue_coins, issue_coin_holdings |
| `db/nfts.ts` | 14 | vote_nfts, votes (resolution) |
| `db/merch.ts` | 5 | merch_orders |
| `db/municipality.ts` | 4 | municipalities (RPC), votes |

The module boundaries are `db.ts`'s own existing section banners (`// USER OPERATIONS`,
`// === Treasury Functions ===`, …), which already mark 14 domains. The only judgement call is
splitting `// VOTE OPERATIONS` (22 exports) into a public catalogue half (`db/votes.ts`) and a
user-owned ballot half (`db/ballots.ts`), because those two halves have opposite privacy postures
and belong to different slices.

### D2 — The migration rule: reads move, writes stay, system stays

This is the single decision every slice applies. It is Claude's discretion (issue and roadmap are
silent) and it is justified as follows.

A `db` export is **user-initiated** when every one of its call chains begins at a request carrying
a verified `sync-session`, and the rows it touches either belong to that user or are public.
Otherwise it is **system**.

| Kind | Target client | Reason |
|---|---|---|
| User-initiated **read** of user-owned rows | `createUserScopedClient(session.userId)` | This is where the enumeration risk lives. SEC-02's full-ledger exposure was a read. RLS is a real second line of defence here and a wrong policy fails visibly (zero rows in a test), not silently in production. |
| Read of **public** data with no session (public pages, server components) | `createAnonClient()` — new in this phase | A public page cannot mint a user token because there is no user. Today these reads use the service-role key, which means one SQL-injection or one careless `.from()` reaches everything. An anon-key client reading `USING (true)` tables can reach exactly the public tables and nothing else. |
| User-initiated **write** | **stays privileged**, with justification — *unless* a matching `WITH CHECK` policy already exists | Adding write policies across 25 tables is a far larger blast radius than reads, and a wrong `WITH CHECK` rejects legitimate writes in production rather than returning an obviously-empty list in a test. `push_tokens` is the exception: it already carries INSERT/UPDATE/DELETE policies (`20250115000001:41-54`), so its writes migrate. |
| System — webhook, cron, mint, notification fan-out, cross-user aggregate | stays privileged, with justification | No session exists. This is MIG-03's explicitly legitimate set. |

Deliberately conservative on writes. Phase 7's job is to make privileged access *visible*, not to
maximise the number of migrated call sites at the cost of a production write outage.

### D2b — How a read is migrated without changing a single call site

A user-scoped client needs a user id. The obvious implementations both cost more than they are
worth: threading a client parameter through every function changes 62 importers, and adding an
`actorUserId` parameter changes every call site of every migrated function.

**Decision — the owner-parameter swap.** Migrate only those reads whose *existing parameter already
is the owner id*, and swap the client inside the function body. The signature does not change and no
caller changes:

```ts
// before
export async function getSocialProofsByUserId(userId: string) {
  const { data } = await supabaseAdmin.from('social_proofs').select('*').eq('user_id', userId);
  …
}

// after — same signature, same call sites, RLS now enforces
export async function getSocialProofsByUserId(userId: string) {
  const { data } = await createUserScopedClient(userId)
    .from('social_proofs').select('*').eq('user_id', userId);
  …
}
```

The `.eq('user_id', userId)` filter stays. Belt and braces: the filter is the app's intent, the
policy is the enforcement, and keeping both means a policy regression surfaces as a *test* failure
rather than as a data leak.

Three consequences every slice must respect:

1. **A function whose parameter is not an owner id does not qualify.** `getVoteById(voteId)` has no
   caller identity to build a client from. Such a read is either public (`createAnonClient`) or
   stays privileged. Do not invent an actor.
2. **A caller passing someone else's id now gets zero rows.** That is the enforcement working. It is
   also a breaking change for any admin or fan-out path that legitimately reads another user's rows
   — `getVoteParticipantsWithEmails` is the obvious one. Grep every caller before swapping; a
   function with even one cross-user caller stays privileged and is tagged `@privileged`.
3. **A function called before a session exists does not qualify.** `getUserById` runs in
   `apps/web/src/app/api/auth/callback/route.ts` during sign-in, potentially before the row exists.
   Minting a token for a user that is mid-creation is a bug waiting to happen. Check the callers,
   and if any is pre-session, leave it privileged and say so in the tag.

Rule of thumb: **grep the callers before you swap the client.** `DB-ACCESS-CLASSIFICATION.md` has
already done this once; a slice that disagrees with it should say so in its summary rather than
silently diverging.

### D3 — All DDL for this phase lands in exactly two migrations

Slices **must not write DDL.** If a slice discovers it needs a policy that does not exist, it stops
and reports rather than adding a migration, because a migration written in wave 4 cannot be applied
before the wave-4 tests that depend on it.

- `supabase/migrations/20260803000001_webhook_events_rls_hotfix.sql` — wave 1, FINDING-1 only.
- `supabase/migrations/20260803000002_rls_policy_audit.sql` — wave 2, every other replace verdict
  plus every policy the classification requires.

Both are applied at the wave-3 checkpoint (plan 07-07), before any slice runs. This is the
roadmap's instruction — *"sequence the `USING (true)` policy audit so the keep-or-replace decisions
land before the routes that depend on them are migrated"* — made mechanical.

### D4 — Justification is enforced by a test, not by good intentions

MIG-03 says every remaining privileged call site carries a written justification. A rule nobody
checks is a rule that decays on the first hurried PR.

**Decision:** every file importing `supabaseAdmin` must contain a `PRIVILEGED:` justification
block, and inside the `db/` modules every exported function that still touches `supabaseAdmin` must
carry an `@privileged` JSDoc tag with a reason on the same line. A guard test
(`apps/web/src/__tests__/lib/privileged-access.test.ts`, plan 07-15) walks the source tree, finds
every privileged call site, and fails when one has no justification. Adding a new unjustified
`supabaseAdmin` use then fails CI.

The justification accretes slice by slice: each slice tags the functions in *its own* module that
stay privileged. The guard test lands last and proves completeness.

### D5 — Phase 5's harness is generalized, never forked

`05-04-PLAN.md` hardcodes a three-table union on `expectAnonReadsNothing` and
`expectCrossUserInvisible`:

```ts
table: 'role_grants' | 'community_manager_applications' | 'role_grant_events'
```

Phase 7 widens that to an `RlsTable` type covering all 28 RLS-enabled tables and adds the
primitives the slices need (`expectUserWriteDenied`, `seedOwnedRows`). It does **not** copy the
harness. `05-04-PLAN.md`'s own "Phase 7" section in `apps/web/docs/RLS-TESTING.md` prescribes
exactly this.

A slice is not done until a test proves user A cannot read user B's rows **for the tables that
slice touched**. That is MIG-04, restated as an execution rule.

### D6 — What "public read" means for tables with no owner

Six of the 14 `USING (true)` policies are deliberately public and stay: `treasury` balances,
`issue_coins` metadata, `vote_sources`, `knesset_items`, `knesset_rankings`, `municipalities`.
`.planning/STATE.md` already records the treasury/issue-coins decision from Phase 1. Six more are
`TO service_role USING (true)` no-ops — service-role bypasses RLS, so those policies do nothing.
They are kept (dropping them is churn with no security value) but each is recorded in the audit as
"no-op, retained for explicitness."

That leaves exactly two to replace: FINDING-1 and FINDING-2.

### Claude's Discretion

The planner has already exercised discretion on D1 (the split), D2 (reads-move/writes-stay), and
D4 (the guard test). Remaining open to the executor:

- Exact module file names within `db/` (the table above is a strong default).
- Whether the `vote_nfts` public gallery is served by a projection view or by a privileged
  aggregate endpoint — decide in plan 07-01 and record the reason.
- Whether the six `TO service_role USING (true)` no-op policies are dropped or retained.

</decisions>

---

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` — Phase 7 section, including "Measured scope" and "Framing"
- `.planning/REQUIREMENTS.md` — MIG-01..04, and the RLS-01..05 block Phase 5 builds
- `.planning/STATE.md` — Blockers/Concerns and the Phase 1 decision that treasury/issue-coin public reads are intentional

### The transport this phase migrates onto (Phase 5, already built)
- `apps/web/src/lib/supabase/user-token.ts` — `mintSupabaseAccessToken(userId, options?)`, TTL 300s
- `apps/web/src/lib/supabase/user-client.ts` — `createUserScopedClient(userId)`
- `apps/web/src/lib/supabase/server.ts` — `supabaseAdmin`, the explicitly-privileged lazy proxy
- `.planning/phases/05-rbac-admin-review/05-01-SUMMARY.md` — signatures, TTL, and the two unverified gates
- `.planning/phases/05-rbac-admin-review/05-02-SUMMARY.md` — the six Phase 5 policy names the harness asserts
- `.planning/phases/05-rbac-admin-review/05-04-PLAN.md` — the harness this phase extends, verbatim
- `.planning/phases/05-rbac-admin-review/05-RESEARCH.md` — why RLS was never an enforcement layer

### The surface being migrated
- `apps/web/src/lib/supabase/db.ts` — 2441 lines, 114 exports, 112 `supabaseAdmin` references
- `supabase/migrations/20240101000001_rls_policies.sql` — 13 of the 36 live policies, and the `public.user_id()` convention
- `supabase/migrations/20260628000002_fix_rls_user_id_helper.sql` — **the `public.user_id()` vs `auth.uid()` trap.** Mandatory read; this is a repeat offence.
- `supabase/migrations/20250115000002_webhook_events.sql` — FINDING-1
- `supabase/migrations/20250118000001_vote_nfts.sql` — FINDING-2

### Project conventions
- `CLAUDE.md` — design tokens, RTL/Hebrew-only, naming, import order
- `.planning/codebase/TESTING.md` — `vi.mock` ordering, the dynamic-import pattern for env-sensitive routes, fixture style
- `.planning/codebase/CONVENTIONS.md`, `ARCHITECTURE.md`, `CONCERNS.md`

### Repo mechanics (non-negotiable)
- pnpm monorepo. Typecheck: `pnpm --filter @sync/web typecheck`. Lint: `pnpm --filter @sync/web lint`. Tests: `pnpm --filter @sync/web test`.
- vitest 1.6.1, `environment: 'node'`, **no jsdom, no `@testing-library/react`**. The include glob is `src/**/*.test.ts` — `.tsx` is never collected.
- **Never write a task whose verify command runs a test file a later task in the same plan creates.** vitest exits 1 with "No test files found". Gate on `pnpm --filter @sync/web typecheck` plus a positive grep instead.
- **Never add Claude or Anthropic as a git co-author, trailer, or collaborator on any commit.**
- **Never print or copy a secret value.** `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and the anon key are referenced by name only.

</canonical_refs>

---

<specifics>
## Specific Ideas

- The phase's single most important test is `ballots.rls.test.ts` proving that user A's
  `createUserScopedClient` cannot read user B's `user_votes` row. That is the product's secret
  ballot, expressed as an assertion. If exactly one test from this phase survives, it is that one.
- `role.repo.ts` (Phase 5 plan 05-03) already carries a comment saying its reads move to
  `createUserScopedClient()` in Phase 7. Closing that loop is plan 07-15 — the phase should not
  leave its own predecessor's TODO open.
- SEC-02 (treasury transactions scoped to the caller) shipped out of phase in `35b0709` and has a
  test at `apps/web/src/__tests__/services/treasury-transaction-scoping.test.ts`. Plan 07-13 must
  not regress it; migrating that read to the user-scoped client makes the scoping enforced in two
  places instead of one.
- The `db/` split is the plan most likely to be rushed. It is mechanical, it is boring, and it
  touches 2441 lines. It is also the plan that makes the other seven parallel. Verify it by test
  count, not by eyeball.

</specifics>

---

<deferred>
## Deferred Ideas

- **Write policies at scale.** Adding `WITH CHECK` INSERT/UPDATE policies across the 25 tables so
  user-initiated writes can also run RLS-enforced. Deliberately out of scope per D2 — the blast
  radius of a wrong `WITH CHECK` is a production write outage, and the enumeration risk this phase
  exists to close is on the read side.
- **Migrating `apps/mobile` off the API client onto direct Supabase access.** Not in scope; mobile
  goes through `@sync/api-client` and inherits whatever the web routes enforce.
- **Replacing `supabaseAdmin` with a per-domain privileged client** (e.g. `webhookDb`, `mintDb`)
  so that a privileged handle can only reach the tables its domain needs. A real improvement, and a
  natural Phase 9. This phase makes it possible by localising each domain into its own module.
- **Pinning `@supabase/supabase-js` to `^2.90.0`.** `05-01-SUMMARY.md` flags that `package.json`
  declares `^2.39.0` while the lockfile resolves 2.90.1, and the entire transport depends on
  `accessToken` existing. Out of this phase's file scope; belongs with dependency hygiene.

</deferred>

---

*Phase: 07-service-role-migration*
*Context gathered: 2026-08-03. All scope figures re-counted against the tree on that date; drift from the roadmap's 2026-08-02 counts is recorded in the Measured scope table above.*
