---
phase: quick-260812-jei-m1-auth-kernel
verified: 2026-08-13T13:05:00Z
status: gaps_found
score: 8/8 plan must-have truths verified; 11/12 engineering-model §0 invariants fully enforced
behavior_unverified: 0
overrides_applied: 0
verdict: achieved-with-notes
gaps:
  - truth: "Invariant 6 (MFA never increases voting eligibility) is enforced by a named mechanism"
    status: partial
    reason: >-
      The invariant HOLDS in the code today - no eligibility, votes, or payments
      path reads security_score - but the enforcing mechanism the engineering
      model §6.2 names ("a characterization test greps eligibility.ts,
      api/votes/**, api/payments/** for security_score|securityScore|
      displayed_trust|displayedTrust and fails on any hit") does not exist.
      Migration 20260901000003_security_score.sql:18 additionally asserts "the
      repo-wide guard test greps for it", which is currently a false statement
      about the codebase. Compare invariant 2, whose guard
      (services/auth/mint-path-guard.test.ts) does exist and does fail on
      violation - that is the standard this one should meet.
    artifacts:
      - path: "supabase/migrations/20260901000003_security_score.sql"
        issue: "Line 18 comment claims a repo-wide guard test that does not exist"
      - path: "apps/web/src/services/auth/mint-path-guard.test.ts"
        issue: "The pattern to copy - no sibling eligibility-isolation guard was written"
    missing:
      - "A characterization test (mold: mint-path-guard.test.ts) that walks apps/web/src/services/verification/eligibility.ts, app/api/votes/**, app/api/payments/** and packages/shared/src/utils/identityScore.ts and fails on any security_score|securityScore|displayed_trust|displayedTrust hit"
      - "Either write that test, or correct the 20260901000003 header comment so it does not claim a guard that is absent"
  - truth: "All §8 durable rate limits are implemented as specified"
    status: partial
    reason: >-
      Six of the seven §8 rows are implemented exactly. The "Recovery attempts"
      row specifies "5 failures/hour, 20/day"; only the hourly half exists
      (MAX_RECOVERY_FAILURES_PER_HOUR = 5). There is no daily ceiling, so a
      patient attacker gets up to 120 recovery-code failures per day rather
      than 20. This divergence is NOT recorded in the engineering model §13
      deviations list, which is what makes it a finding rather than an accepted
      trade-off.
    artifacts:
      - path: "apps/web/src/app/api/auth/mfa/verify/route.ts"
        issue: "Line 58 defines only the hourly recovery ceiling; no DAY_MS window is read for recovery failures"
    missing:
      - "A 20/day recovery-failure window (countSecurityEventsSince with DAY_MS, mirroring the operator-reset ceiling), OR an explicit entry in engineering-model §13 recording the daily half as deliberately dropped"
human_verification:
  - test: "Run supabase/tests/security_mfa.sql against a scratch Postgres with the full migration chain applied, and READ the RAISE NOTICE output line by line"
    expected: "21 PASS lines, zero FAIL lines - covering the score formula and both flip directions, the monotonic TOTP step guard, single-use recovery/pending/ticket consumes, the append-only triggers including the service_role REVOKE, the operator-reason CHECK, and the settings singleton"
    why_human: >-
      The suite reports outcomes via RAISE NOTICE 'PASS'/'FAIL' and never
      raises on failure, so its exit code is always success - a machine cannot
      distinguish a green run from an all-FAIL run. It also needs a live
      Postgres, which is unavailable here (the repo has no live-DB CI harness
      by design, engineering model §11). The SUMMARY's "21 PASS on a scratch
      replay" claim is therefore unverified by this report.
  - test: "Complete a real Google sign-in end to end in a browser against a deployed preview"
    expected: "Session cookie set, /api/auth/session returns the profile, silent refresh rotates without signing the user out"
    why_human: >-
      The OAuth round trip needs the external Google IdP. Route-level tests
      cover every gate with real crypto, but not the live redirect.
---

# Issue #71 (Authenticator 2FA / Identity & Security) — Goal-Backward Verification

**Verified:** 2026-08-13
**Branch:** `dolev/issue-71-m1-auth-kernel` @ `3440304` (worktree `taruu-monorepo-wt-m1`, clean tree)
**Canonical documents:** `specs/mfa-engineering-model.md` (implementation contract), `specs/mfa-architecture.md` (design intent)
**Verdict:** **achieved-with-notes** — the implementation delivers what the specs promise; two minor divergences are recorded below.

## Method

Goal-backward: started from what the specs promise and checked the codebase for
it, treating SUMMARY.md claims as unverified assertions. Every route file,
migration, and kernel module named in this report was read in full. All four CI
gates were executed independently.

## Gate results (run by this verifier, not quoted from SUMMARY)

| Gate | Command | Result |
|---|---|---|
| Tests | `pnpm --filter @sync/web test` | **111 files / 1397 tests passed**, 0 failed |
| Typecheck | `pnpm --filter @sync/web typecheck` | clean (`tsc --noEmit`, no output) |
| Lint | `pnpm --filter @sync/web lint` | 0 errors, 2 pre-existing warnings (`postcss.config.mjs`, `worker.ts` — anonymous default export) |
| Build | `pnpm --filter @sync/web build` | **passes** with the CI placeholder env |

Build note: a bare `pnpm build` fails at prerender of `/he/store/tote-bag` with
"Missing Supabase environment variables". This is environmental, not a
regression — the store page imports the browser Supabase client at prerender,
and `.github/workflows/agent-verification.yml:51-52` supplies
`NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` placeholders for exactly this reason.
Re-running with those two variables produces a full green build. Nothing in
Issue #71 touches that path.

## 1. §9.1 route responsibility table — 13/13 present, guards match

| Route | Expected guard (§9.1) | Actual guard in code | Status |
|---|---|---|---|
| `POST /api/auth/google/start` | none (pre-identity) | none; mints signed state, sets cookie, 10-min TTL | ✓ |
| `POST /api/auth/callback` | state + id_token gates | gates 1-8 in the specified order, all before any side effect | ✓ |
| `POST /api/auth/session` | session verify | pre-existing, unchanged | ✓ |
| `DELETE /api/auth/session` | none | clears cookies only (no revocation — §5.1c honoured) | ✓ |
| `POST /api/auth/session/refresh` | refresh verify + sv + assurance | `verifyRefreshToken` → sv strict → `getRequiredAssurance` | ✓ |
| `POST /api/auth/mfa/verify` | pending row (§5.5) | locator verify → row classification → verify → consume | ✓ |
| `POST /api/security/mfa/enroll` | `requireAuth` + enrollment flag | `isMfaEnrollmentEnabled()` → 404; `getSessionFromRequest` | ✓ |
| `POST /api/security/mfa/enroll/confirm` | `requireAuth` + pending row | same flag + session; `mfa_activate_factor` | ✓ |
| `POST /api/security/mfa/disable` | reauth(`mfa_disable`), NOT flag-gated | `requireReauth(request,'mfa_disable')`; no flag check | ✓ |
| `POST /api/security/mfa/recovery/regenerate` | flag + reauth(`recovery_regenerate`) | both present | ✓ |
| `POST /api/security/reauth` | session + server-derived matrix | session then `derivePermittedReauthMethods` | ✓ |
| `POST /api/security/admin/mfa-reset` | flag + `requireSecurityAdmin` + TOTP-only reauth | all three, in that order | ✓ |
| `GET /api/security/status` | session, deliberately not flag-gated | `getSessionFromRequest` only | ✓ |

The two "deliberately not flag-gated" cases (`disable`, `status`) are
implemented as deliberate, with the reasoning in their file headers — matching
§9.1 and deviation 6.

## 2. §0 invariants — each traced to its enforcing mechanism

| # | Invariant | Enforcing mechanism found | Status |
|---|---|---|---|
| 1 | Session/refresh never interchangeable | `keys.ts` HKDF `info=<purpose>` + `tokens.ts:82` exact `typ` match — two independent defences; `tokens.test.ts:34` proves every ordered cross-purpose pair fails | ✓ |
| 2 | Exactly one mint path | `mint-path-guard.test.ts` walks the source tree from disk and fails on any import of `tokens.ts`/`keys.ts` outside `services/auth/`, plus a self-sanity assertion. Independently confirmed: exactly 4 mint call sites exist (callback, mfa/verify, refresh, disable) | ✓ |
| 3 | No session while a challenge is unsatisfied | Verified by auditing all 4 mint sites: callback mints only on `requiresMfa === false`; `mfa/verify` mints only after `consumePendingToken` returns true | ✓ |
| 4 | `sv` bump kills every token; the read is never cached | `assertLiveSessionVersion` is the single reader, called from both entry points, never from `requireAuth`; `getUserSessionVersion` (db.ts:82) is an uncached PK select. `session.test.ts:134` proves revocation immediacy on a live token instance | ✓ |
| 5 | Every single-use artifact consumed by conditional `UPDATE ... RETURNING` | All 5 in `20260901000002`: `mfa_consume_pending_token`, `mfa_consume_recovery_code`, `reauth_consume_ticket`, `mfa_accept_totp_step`, `mfa_disable_factor` — SECURITY DEFINER, `SET search_path = public`, EXECUTE revoked from PUBLIC/anon/authenticated | ✓ |
| 6 | MFA never increases eligibility | State holds (grep of eligibility/votes/payments/identityScore is clean; no SQL combines the scores) but the **named guard test is absent** | ⚠ see gap 1 |
| 7 | Secrets: plaintext only in memory; codes hash-only | `mfa-secret.ts` AES-256-GCM, key from the `mfa_secret_enc` HKDF label (excluded from `SigningPurpose` so signing with it is a type error), AAD = user_id‖factor_id; `user_recovery_codes` stores SHA-256 only; secret returned exactly once from enroll | ✓ |
| 8 | `google` never satisfies reauth for an account with a factor | `derivePermittedReauthMethods` returns `[]` (no factor), `['totp']` (operator_reset), `['totp','recovery']` — it can never return `google` | ✓ |
| 9 | All MFA rate limits durable | `durable-limits.ts` + `security_events` windows + row counters; the in-memory limiter is not imported by any MFA route; no lockout columns exist | ✓ (one sub-limit missing — gap 2) |
| 10 | MFA state never on `users` | 5 dedicated tables; only `session_version` and `security_score` land on `users`, both documented with the §2.3 reasoning | ✓ |
| 11 | Everything ships dark | Both env flags `=== 'true'` (default OFF); `security_settings` seeded `FALSE`; no code path writes that table | ✓ |
| 12 | Fail closed | `AUTH_LEGACY_UNTIL` unset = window closed; `userRequiresMfa` returns null on a failed read and every caller throws rather than degrading to `sf`; `overLimit(null, n) === true`; `getAuthMasterKey` throws with no fallback | ✓ |

## 3. State machines §5.1–§5.7

| Machine | Verification |
|---|---|
| §5.1 Session/refresh | Both entry points run `resolveSessionPathClaims` → `assertLiveSessionVersion`. The downgrade guard (`decodeTokenTypeUnverified !== null → dead`) blocks the strip-the-signature attack; `legacy-token.test.ts:186` proves it. `requireAuth` does not re-check `sv`. Sign-out clears cookies only, as §5.1c documents. |
| §5.1e Refresh | `verifyRefreshToken` only; cookie→body→bearer intake; sv strict; per-call `getRequiredAssurance`; mints with the **stored** sv and the presented `amr`/`asr`; `sessionToken` alias and real `expiresAt` from `SESSION_TTL_SECONDS`; header states plainly that rotation is not reuse detection. The route never imports `legacy-token.ts` — asserted by a source-reading test (`legacy-token.test.ts:206`). |
| §5.2 Login | All 8 gates present in the specified order with the specified codes; the state cookie is deleted on every response after first read; identity authority is the verified `id_token.sub`, userinfo is enrichment whose failure is caught and logged; `sv` read from the user row, never a literal. |
| §5.2 case table | Cases 1-2 (mint), 3 (challenge, no session/refresh), 4-9 all have passing tests in `auth-mfa-verify.test.ts` named by case number; 10-12 in `auth-refresh.test.ts`. Recovery login yields `amr ["google","recovery"]`, `asr 'mf'` (`route.ts:167`). |
| §5.3 TOTP factor | Partial unique indexes make two active / two pending factors unrepresentable; `mfa_activate_factor` sets `confirmed_at` and inserts the batch in one transaction; 5th bad confirm deletes the pending row; disable retains the row, deletes unused codes, bumps `sv`, and the caller re-mints an `sf ["google"]` session read back **after** the transaction (`disable/route.ts:50-62`) — never a locally computed +1. |
| §5.4 Recovery batch | 10 codes, Crockford base32 `XXXX-XXXX-XXXX-XXXX`, SHA-256 stored, returned once; regenerate replaces in one transaction and reports the previous unused count; visible degradation via event + email + banner. |
| §5.5 Pending challenge | Verify-then-consume ordering is explicit and correct; the consume RPC is the commit point; the loser of a concurrent race receives `CHALLENGE_REPLAYED` and no session (tested). |
| §5.6 Reauth + operator reset | Ticket = row + locator; `requireReauth` binds user + purpose then consumes atomically; a `mfa_disable` ticket is refused for `recovery_regenerate` (tested). Operator reset: flag + `requireSecurityAdmin` + always-TOTP ticket + 10-2000 char reason (enforced in code AND by a DB CHECK) + 10/operator/day + two evidence rows carrying actor identity + target email. |
| §5.7 Rollout | Migrations are inert: `security_settings` seeded FALSE, `security_score` defaults 0, both flags default OFF. **No application code writes `security_settings`** — confirmed by grep; the only reference is the `getSecuritySettings` read. The flip lives only in the `20260901000003` header as runbook DML. |

## 4. Scoring model §6

- Formula locked in `20260901000003`: 20 iff active factor **AND** enforcement enabled; else 0. Single writer is the DB (`sync_security_score_on_factor_change`, `SECURITY DEFINER SET search_path = public`, EXECUTE revoked from PUBLIC/anon/authenticated).
- The trigger deliberately cannot see settings flips, and the header carries the transactional recompute runbook for both directions — matching §5.7.
- Eligibility isolation: grep over `services/verification/eligibility.ts`, `app/api/votes/**`, `app/api/payments/**`, `packages/shared/src/utils/identityScore.ts` returns **zero** hits for `security_score|securityScore|displayed_trust|displayedTrust`. No SQL function or view combines the two scores. **State correct; regression guard missing — gap 1.**
- Note (not a gap): `votingGate()` on this branch is main's pre-PR-A shape (`MINIMUM_VOTING_SCORE`, capped at 100). The `identity_score >= 40 AND explicit residency` shape described in §6.2 is PR-A's deliverable on `dolev/issue-71-pr-a-score-unification`, which §12.3 correctly records as unmerged and as not a dependency of M1.
  - **Update 2026-08-16:** PR #110 (PR-A) is now MERGED to main (`bc7defe`) and this branch is rebased onto it, so `votingGate()` here is now PR-A's `MINIMUM_IDENTITY_SCORE_FOR_VOTING = 40 AND explicit residency` shape (140 cap), inherited from main — not the old `MINIMUM_VOTING_SCORE`/100 shape. The eligibility-isolation grep above still returns zero security_score/MFA hits post-rebase.

## 5. Test coverage vs §16b

| Required | Found | Status |
|---|---|---|
| RFC 6238 reference vectors | `totp.test.ts` — Appendix B SHA-1 rows via `it.each`, plus ±1 accepted / ±2 rejected / malformed / whitespace | ✓ |
| Cross-purpose matrix | `tokens.test.ts:34` all ordered pairs; plus stripped-`typ`, altered-`typ`, raw-master-key-signed, expired, garbage | ✓ |
| Case-table rows | `auth-mfa-verify.test.ts` cases 4-9 named explicitly; `auth-callback.test.ts` case 3; `auth-refresh.test.ts` cases 10-12 | ✓ |
| Reauth matrix | `security-reauth.test.ts` — factor-less refusal, TOTP-only for operator_reset, purpose binding, single use, durable ceiling | ✓ |
| Guard tests | `mint-path-guard.test.ts` (single mint path) and `user-token.test.ts:103` (RLS token carries no assurance or method claims) | ✓ |
| SQL proof suite | `supabase/tests/security_mfa.sql` exists, ~21 cases covering score/flip/step-guard/consumes/append-only incl. service_role/reason CHECK/singleton | ⚠ exists; result needs a human (see `human_verification`) |

Gate-sequence coverage in `auth-callback.test.ts` is complete: every one of the
8 gates has a test asserting its specific status and code, plus single-use
cookie deletion, enrichment-failure tolerance, and fail-closed 500 when the
enforcement derivation is unreadable.

## 6. Recorded deviations (§13) — all six are accurate

| # | Claim | Verification |
|---|---|---|
| 1 | Login OAuth state moved to `services/auth/login-state.ts` | File exists there; the mint-path guard would fail if it had stayed in `lib/` | ✓ accurate |
| 2 | `google` reauth refused everywhere | `derivePermittedReauthMethods` returns `[]` for factor-less accounts; the route answers `REAUTH_UNAVAILABLE` | ✓ accurate |
| 3 | Events written app-side after the atomic RPCs | `recordSecurityEvent` calls follow the RPC calls in every route; write failures return `false` and never throw; count readers fail closed via `overLimit(null, n)` | ✓ accurate |
| 4 | Score-card extraction partial (/20 only) | `settings/security/page.tsx:221` renders `securityScore/SECURITY_SCORE_MAX`; no /140 or /160 rendering exists | ✓ accurate |
| 5 | Callback answers HTTP 200 with `{success:false, mfaRequired:true, code:'MFA_REQUIRED'}` | `callback/route.ts:240-248`, locator in the body for cookie-less clients | ✓ accurate |
| 6 | `GET /api/security/status` added, requireAuth-only | Confirmed | ✓ accurate |

Pre-existing warts listed in §13 were also confirmed still present and still
unfixed as described: the callback's `identity_score: 40` literal
(`callback/route.ts:194`), `isSessionExpiringSoon`'s 1h-horizon tautology
(`session.ts:257`), and oauth-state family 1 on `JWT_SECRET`.

**Silent divergences beyond the recorded six:** one found — the missing daily
recovery-failure ceiling (gap 2).

## 7. Anti-pattern scan

No debt markers (`TBD`, `FIXME`, `XXX`) in any Issue #71 file. The `XXX` grep
hits are all legitimate input placeholders for the recovery-code format
(`XXXX-XXXX-XXXX-XXXX`) in the challenge page, ReauthDialog, and
`recovery-codes.ts`. No stubs, no empty handlers, no hardcoded empty props.
UI data flow traced end to end: `settings/security` fetches
`/api/security/status` in a `useEffect` and renders live state; the challenge
page POSTs to `/api/auth/mfa/verify` and routes on success; `ReauthDialog`
POSTs to `/api/security/reauth` and hands the ticket to the caller, which
replays it as `X-Reauth-Ticket`.

Minor observation (not a gap): `getActiveFactor` collapses a failed read into
"no active factor". Every consumer fails closed on that except
`requireSecurityAdmin`, where a transient read failure would skip the
defence-in-depth `session.asr === 'mf'` assertion — the always-required
TOTP-only reauth ticket still gates the action, so the reset stays MFA-proven.

## 8. Rollout safety

Migrations are inert on arrival; controls default OFF; no code path flips
enforcement. The three reserved versions (`20260901000001/-02/-03`) match the
§12.1 registry, carry verbatim rollback scripts in their headers, and are
uncommitted to any database. `AUTH_MASTER_KEY`, `AUTH_LEGACY_UNTIL`, and
`SECURITY_EVENT_PEPPER` are documented as operator-provisioned Worker secrets
and are not set anywhere in the repo.

## Gaps summary

Neither gap blocks the phase goal. Both are "the spec describes a mechanism the
code does not have":

1. **Invariant 6 has no guard.** The eligibility-isolation property is true
   today but nothing fails when someone breaks it, and migration
   `20260901000003:18` states that a guard exists. Every other §0 invariant
   with a named mechanism has that mechanism in the tree. Fix is ~30 lines
   modelled on `mint-path-guard.test.ts`, or correct the migration comment.
2. **The §8 recovery daily ceiling is missing.** 5/hour is enforced, 20/day is
   not, and §13 does not record the omission.

---

_Verified: 2026-08-13_
_Verifier: Claude (gsd-verifier), goal-backward against `specs/mfa-engineering-model.md` and `specs/mfa-architecture.md`_
