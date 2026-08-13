# MFA Engineering Model — Issue #71 (Authenticator 2FA / Identity & Security)

> **Engineering source of truth for Issue #71 implementation.** Where
> [`specs/mfa-architecture.md`](./mfa-architecture.md) records *why the system is
> shaped this way* (decisions, rejected alternatives, threat model), this
> document records *exactly how the pieces behave together and the rules
> implementation must obey*: entities, state machines, ownership, invariants,
> API responsibilities, client contracts, and the repository conventions the
> code must follow. An engineer or coding agent with no prior conversation
> context should be able to read this file plus the architecture doc and safely
> continue implementing Issue #71.
>
> **Precedence.** On any conflict: (1) this document governs implementation
> behavior; (2) `mfa-architecture.md` governs design intent; (3) §15 of this
> document lists the known places where verified repository/production reality
> corrects the architecture doc's prose. A contract change here requires an
> explicit review and a new revision — never an in-flight edit by an
> implementation session (same rule the Campaign SEED established).
>
> Grounded in a fresh inspection (2026-08-13) of: branch
> `dolev/issue-71-m1-auth-kernel` @ `80b8202` + its 3-file uncommitted working
> tree (worktree `taruu-monorepo-wt-m1`), branch
> `dolev/issue-71-pr-a-score-unification` @ `75dc346` (draft PR #110, worktree
> `taruu-monorepo-wt-pr-a`), `origin/main` @ `248c2c1`, and the **live
> production database** (ledger, columns, policies queried 2026-08-13).

---

## 0. The whole system on one page

Six state machines, one revocation counter, three scores. Everything else is
detail on these.

**States that exist:**

```
Session:        none → live(sv=N, asr, amr) → [refreshed]* → expired | revoked(sv≠N) | signed-out
Login:          anonymous → oauth-state-minted → google-verified → { session | mfa-pending } → session
TOTP factor:    absent → pending → active → disabled          (disabled row retained forever)
Recovery batch: none → live(10 codes) → depleting → replaced | deleted-on-disable
Pending token:  minted → { consumed | expired | exhausted }   (single use, DB row is authority)
Reauth ticket:  minted → { consumed | expired }               (single use, purpose-bound, DB row is authority)
Enforcement:    OFF (seeded) → ON (one DB transaction, with score recompute) → OFF (same transaction reversed)
```

**Who owns what:**

| Fact | Authority | Never decided by |
|---|---|---|
| Is this token authentic + right purpose | app (`tokens.ts` verify) | DB |
| Is this session still alive | **DB** (`users.session_version` vs token `sv`) | token contents alone |
| Is a pending challenge / reauth ticket spendable | **DB row** (`consumed_at`, `expires_at`, `attempt_count`) | the JWT (locator only) |
| Is a recovery code spendable | **DB** (conditional UPDATE wins or loses) | app-side check |
| Has this TOTP step been used | **DB** (`last_accepted_step` monotonic guard) | app-side comparison |
| What assurance does this account require | **DB** (`user_mfa_factors` active + `security_settings`) | token claims |
| Is MFA globally enforced | **DB** (`security_settings.mfa_enforcement_enabled`) | env vars — none exists |
| `identity_score` / `security_score` | **DB triggers** (single writer) | application code |
| `displayed_trust_score` | derived in shared code, never stored | DB |
| Is enrollment / operator-reset code reachable | env flags (default OFF, `=== 'true'`) | DB |

**Invariants (each is enforced by a named mechanism, §5–§9):**

1. Session and refresh tokens are never interchangeable — distinct HKDF keys AND exact `typ` claim, two independent defences.
2. Exactly one code path mints session/refresh tokens (`services/auth/session.ts`); a guard test forbids importing the signing primitive elsewhere.
3. No authenticated application session exists while an MFA challenge is unsatisfied.
4. A `session_version` bump kills every session/refresh/legacy token of that user from the next request onward; the `sv` read is never cached.
5. Every single-use artifact (pending token, reauth ticket, recovery code, TOTP step) is consumed by a conditional `UPDATE ... RETURNING` — concurrency-safe by construction, exactly one winner.
6. MFA never increases voting eligibility. Eligibility = `identity_score >= 40` AND explicit residency; no eligibility code path reads `security_score`.
7. Secrets: TOTP secret exists in plaintext only in server memory during enroll/verify; recovery codes stored hash-only; neither ever logged or re-served.
8. `google` reauth method never satisfies reauthentication for an account with an active factor.
9. All MFA rate limits are durable (DB rows / event windows), never the in-memory limiter; no durable lockout flags.
10. MFA state lives in its own tables, never in columns on `users` (§3.1 explains the RLS reason).
11. Everything ships dark; behavior changes only at explicit runbook flips (§5.7).
12. Fail closed: unset `AUTH_LEGACY_UNTIL` = window closed; unknown enforcement state = challenge; missing env keys = loud startup failure, no fallback.

---

## 1. Verified system context

- **Auth is fully custom.** Google OIDC authorization-code flow + `jose` HS256
  JWTs + `public.users` (independent `uuid_generate_v4()` PK). Supabase Auth is
  **unused by the application**: no app code or RLS policy references `auth.*`;
  `supabase/config.toml` sets `[auth] enabled = false` for local replay.
  *Precision matters here (corrects the architecture doc, §15):* the **hosted**
  project does have a live GoTrue `auth` schema with rows
  (`auth.users` 3, `auth.refresh_tokens` 1981, `auth.sessions` 21,
  `auth.mfa_factors` 0). Nothing references it; do not design against it and do
  not claim it doesn't exist. Custom TOTP is a choice, not a forced move — and
  it stands (see architecture §17 for why).
- **Runtime: Cloudflare Workers via OpenNext** (`apps/web/wrangler.jsonc`,
  `compatibility_flags: ["nodejs_compat"]`, custom entry `apps/web/worker.ts`).
  **Web Crypto (`crypto.subtle`) is the rule** — stated in
  `services/auth/keys.ts:13` and `server/app/space-admin/audience.ts:66`.
  `node:crypto` is sanctioned only for `timingSafeEqual`, always via
  `@/lib/secureCompare`. TOTP HMAC-SHA1 must be implemented with
  `crypto.subtle` (precedent: `server/infra/crypto/hmac.ts`,
  `services/sms/otp.ts`). Never add `export const runtime = 'edge'`
  (see the comment at `app/api/jwks/route.ts:20`).
- **RLS transport**: the app is its own JWT issuer. `public.user_id()` reads
  `request.jwt.claims->>'sub'` (`20260802000001_rls_transport.sql`); user-scoped
  DB access mints a 5-minute ES256 token (`lib/supabase/user-token.ts`) whose
  claim set is exactly `iss/sub/role/aud/iat/exp` — **no assurance claims,
  ever** (architecture §4.7; guarded by test in M1 Task 9).
- **Production ledger** (queried live): 50 applied, latest
  `20260811000004_pilot_program`. Unapplied: M1's `20260901000001` and PR-A's
  `20260807000001`. PR-A additionally carries an unappliable version collision
  (§12.3).

---

## 2. Entity model (ORM / data model)

### 2.1 Existing (live in production)

| Entity | Role in this feature |
|---|---|
| `public.users` | Account root. Gains `session_version` (M1, committed, unapplied) and `security_score` (M2). All 24 current columns listed in migrations `20240101000000` → `20260811000004`. |
| `social_proofs` | Identity evidence rows; the trigger inputs to `identity_score` (PR-A). |
| `role_grants` + `users.is_platform_admin` | Operator identity. Reused for operator reset; **no new operator table** (architecture §5.8). |
| `phone_verifications` | Precedent for durable DB attempt counters. |
| `space_audit_log`, `role_grant_events`, `pilot_audit_log`, `identity_document_events` | The append-only audit molds §7 copies. |

### 2.2 New tables (M2 migration `20260901000002`, reserved — none exist yet)

Full column contracts live in architecture §5.1–§5.6; the lifecycle-relevant
shape, restated as the implementation contract:

| Table | Purpose | Key uniqueness / concurrency contract | Writer |
|---|---|---|---|
| `user_mfa_factors` | TOTP factor; AES-256-GCM-encrypted secret; replay anchor | `UNIQUE (user_id) WHERE status='active'`; `UNIQUE (user_id) WHERE status='pending'`; `last_accepted_step` monotonic | server routes (service role) |
| `user_recovery_codes` | SHA-256 hashes of one-shot codes, batch-scoped | `UNIQUE (user_id, code_hash)`; spend = conditional `UPDATE ... WHERE used_at IS NULL RETURNING` | server routes |
| `mfa_pending_tokens` | **Authoritative** login-challenge state; `id` = JWT `jti` | spend = conditional `UPDATE ... WHERE consumed_at IS NULL AND expires_at > now() AND attempt_count < 5 RETURNING` | server routes |
| `reauth_tickets` | **Authoritative** step-up ticket state; purpose-bound | same conditional-UPDATE spend; `purpose` CHECK enum | server routes |
| `security_events` | Append-only security audit (§7) | append-only trigger + REVOKE incl. `service_role` | one repo module, insert-only |
| `security_settings` | **One-row** global enforcement authority | `id boolean PK DEFAULT true CHECK (id)`; seeded `false` | runbook DML only |

DDL conventions for these tables (house style, §12): `gen_random_uuid()` (not
`uuid_generate_v4()`), `created_at timestamptz NOT NULL DEFAULT now()`
(lowercase `now()`, never `occurred_at`), **CHECK constraints, never new enum
types**, `ENABLE ROW LEVEL SECURITY` with **no policies** + `REVOKE ALL FROM
anon, authenticated` (service-role-only pattern; `newsletter_subscribers` is the
model), heavy `COMMENT ON` rationale, and — for the audit table — the
`role_grant_events` **no-FK** variant so the log outlives its subject.

### 2.3 Why MFA state must NOT live on `users` (load-bearing)

The live policy `Users can update own profile` is `UPDATE` for role `public`
with `USING (id = user_id())` and **no column restriction**. Today it's latent
(all writes go through service role), but `createUserScopedClient` exists and
migrating `db.ts` onto it is a stated plan. Any security state stored as a
`users` column would then become **self-writable by its own subject**. Factor
status, secrets, counters, tickets: own tables, service-role-only, always.
(`session_version` on `users` is exposed to the same latent hole — accepted for
M1 because no user-scoped writer exists; revisit before any `db.ts` RLS
migration. PR-A's `sync_identity_score_on_users_change` trigger does **not**
close this class of hole: it fires only `ON UPDATE OF` its three named columns.)

### 2.4 TypeScript types

`apps/web/src/lib/supabase/types.ts` is **hand-maintained** (2542 lines, no
generation script). Every new table/column needs hand-written `Row`/`Insert`/
`Update` entries with a JSDoc comment mirroring the migration's `COMMENT ON`.
`session_version` (types.ts:49,74,99) is the template.

---

## 3. Token catalog & key model

### 3.1 Implemented today (M1, committed)

Single secret `AUTH_MASTER_KEY` (≥32 chars, read at call time, loud throw if
missing — `keys.ts:35`; **only `keys.ts` reads it**). Per-purpose keys:
`HKDF-SHA256(ikm = AUTH_MASTER_KEY, salt = "taruu-auth-v1", info = <purpose>,
256 bits)` via `crypto.subtle.deriveBits`, memoized, `resetDerivedKeyCache()`
for tests. `KEY_VERSION = 1`, JWT header `kid: "v1"`.

`TokenPurpose = 'session' | 'refresh' | 'oauth_state'` — exactly three.
`mfa_pending`, `reauth`, `mfa_secret_enc` are **reserved for M2 and must not be
derived or referenced before their milestone** (stated in `keys.ts:9`).

| Token | payload `typ` | TTL | Transport | Claims beyond `iat/exp/jti` |
|---|---|---|---|---|
| Session | `session.v1` | **1h** (`SESSION_TTL_SECONDS`) | httpOnly cookie `sync-session` (+ Bearer accepted on intake) | `userId, googleId, did, email, sv, amr, asr` |
| Refresh | `refresh.v1` | 30d, rotated on use | httpOnly cookie `sync-refresh` (+ body/Bearer intake after Task 8) | `userId, sv, amr, asr` — deliberately no `did`/`email` |
| Login OAuth state | `oauth_state.v1` | 10 min | `state` param + httpOnly cookie `sync-oauth-state` (double submit) | `nonce_hash, flow:'login', redirect?` — **no userId** (pre-identity) |

Gotchas the implementation must respect:

- The purpose claim is **`typ` in the payload** (`session.v1` etc.); the
  protected *header* also carries the ordinary `typ: 'JWT'`. Two different
  fields.
- Login-state claims are **snake_case in the token** (`nonce_hash`), camelCase
  in TS. Keep that mapping; don't "fix" it.
- `verifyPurposeToken` returns `null` on any failure — never throws, never logs
  token material. All new verifiers follow this contract.
- Cookies: `httpOnly`, `sameSite:'lax'`, `secure` iff production, `path:'/'`.
  Cookie names are module-private constants in `session.ts` — never re-declare
  them elsewhere.

### 3.2 M2+ tokens (reserved, per architecture §4.2)

| Token | payload `typ` | TTL | DB authority row |
|---|---|---|---|
| MFA pending | `mfa_pending.v1` | 5 min | `mfa_pending_tokens.id` = `jti` — **JWT is a locator only** |
| Reauth ticket | `reauth.v1` | 5 min, single-use | `reauth_tickets.id` = `jti`; carried as `X-Reauth-Ticket` header |
| — (encryption) | `mfa_secret_enc` purpose | n/a | derives the AES-256-GCM key for TOTP secrets; AAD = `user_id ‖ factor_id`; `enc_key_version` stamped |

### 3.3 Two OAuth-state families coexist (transitional)

`lib/oauth-state.ts` holds both: **family 1** (social connect,
Facebook/Instagram) still signs with `JWT_SECRET` captured at module load, no
`kid`, and logs failures; **family 2** (login, M1) uses the `oauth_state`
purpose key. The header comment marks migrating family 1 onto the purpose key
as deliberate follow-up work, out of Issue #71's critical path. Consequence:
**`JWT_SECRET` cannot be deleted when the legacy window closes** until the four
social routes migrate — track as a follow-up, not an M1 blocker.

---

## 4. Environment & control surface

| Variable / control | Read by | Semantics |
|---|---|---|
| `AUTH_MASTER_KEY` | `keys.ts` only | ≥32 chars; missing = loud throw, no fallback. Operator provisions as Worker secret before M1 deploy. |
| `AUTH_LEGACY_UNTIL` | `legacy-token.ts` | ISO-8601 deadline. Unset/unparseable = window **closed** (fail-closed: forgetting it signs everyone out once rather than keeping the weak path alive). |
| `JWT_SECRET` | `legacy-token.ts` (window only) + oauth-state family 1 | Missing while window open = **throw** (operator misconfiguration surfaces loudly). Deletable only after both consumers retire. |
| `MFA_ENROLLMENT_ENABLED` | `lib/features/mfa-enrollment.ts` (M3) | Env flag, **default OFF, `=== 'true'`** — must invert the repo's existing default-ON `!== 'false'` idiom (`space-admin.ts:7`). Gates enrollment routes + UI only. |
| `OPERATOR_RESET_ENABLED` | `lib/features/operator-reset.ts` (M7) | Same OFF/`=== 'true'` semantics. Gates the admin reset endpoint + UI. |
| Global MFA enforcement | **DB only**: `security_settings.mfa_enforcement_enabled` | The single enforcement authority. **No env var for this exists anywhere** — the score trigger must read it and the flip must be transactional with the recompute. Per-request read; within-request memo OK; cross-request cache forbidden. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_TP_PRIVATE_JWK`, `SECURITY_EVENT_PEPPER` (M2) | various | Pre-existing / architecture §8.2. |

`JWT_EXPIRY` is dead for sessions (`SESSION_TTL_SECONDS` governs) — do not read
it in new code.

---

## 5. State machines

Notation: `state --[trigger / guard]--> state (effects; events)`. Everything not
listed as a transition is forbidden; forbidden transitions have no code path,
not just no caller.

### 5.1 Session & refresh lifecycle (implemented, minus Task 8)

```
                    login (§5.2)                      refresh (Task 8)
none ────────────────────────────────► live(sv=N, amr, asr) ◄──────────────┐
                                          │        │  rotate: new session + new refresh,
                                          │        │  same amr/asr, sv re-read from DB
                                          │        └────────────────────────┘
   exp reached          ┌─────────────────┼──────────────────┐
live ──────────► expired│    users.session_version ≠ sv      │ DELETE /api/auth/session
                        ▼                 ▼                  ▼
                 (silent refresh)   revoked: 401 +      signed-out (cookies cleared;
                                    cookies cleared      token itself NOT revoked — §5.1c)
```

**a) Verification path (the Model B chokepoint).** Both entry points —
`getSessionFromCookies()` and `getSessionFromRequest()` (Bearer first, cookie
fallback) — run the identical pipeline:

1. `resolveSessionPathClaims(token)` — modern verify; on failure, the
   **downgrade guard**: if the token carries *any* recognized `typ` claim it is
   dead (`null`), only a claim-less token may try `verifyLegacySessionToken`.
   This is what blocks "strip the signature to reach the weak HS256 path".
2. `assertLiveSessionVersion(claims)` — the **single** place stored version is
   read: `getUserSessionVersion(userId)` (PK-only select, `db.ts:82`,
   documented **no caching of any kind**). Strict `===` or the session is null,
   with best-effort cookie clearing.

`requireAuth(request)` wraps `getSessionFromRequest` and throws — it does
**not** re-check `sv` (that would double the per-request read). Blast radius
today: 69 route files + 7 RSC pages.

**b) Revocation semantics.** Guarantee: once a `session_version` bump commits,
every subsequent request presenting old-`sv` tokens fails 401 with cookies
cleared — bounded only by requests in flight at commit time. Bump sites (all
M2+; **nothing bumps it in M1 — the column is inert**): user MFA disable,
operator reset, sign-out-everywhere. Legacy tokens map to `sv = 1`
(`legacy-token.ts:74`), so any bump past 1 also kills every legacy token for
that user — an intentional, load-bearing transition.

**c) Sign-out edge (current, documented behavior).** `DELETE
/api/auth/session` clears cookies only. A copied bearer token **survives
sign-out** until natural expiry (≤1h). This is accepted for M1; the durable
alternative is the future sign-out-everywhere (`sv` bump). Do not claim
sign-out revokes.

**d) Legacy window.** Session path only. The refresh endpoint never imports
`legacy-token.ts` — a legacy token can authenticate a request but can never
mint fresh tokens. Window closes at `AUTH_LEGACY_UNTIL` (≤7 days after M1
deploy); removal = delete `legacy-token.ts` + one import.

**e) Refresh (Task 8 contract — the one unimplemented M1 piece).** The current
route is pre-rewrite and does not even typecheck (3 TS2345 errors, §13). Target
behavior:

1. Intake: refresh token from `sync-refresh` cookie, OR JSON body
   `refreshToken`, OR `Authorization: Bearer` (mobile has no cookie jar). Read
   the body defensively — web sends none.
2. `verifyRefreshToken` only — a session token presented here is refused
   (purpose non-interchangeability, the other half of the audited defect).
3. Order of checks: load user → `sv` strict match else 401 + cookies cleared →
   `getRequiredAssurance(userId)` vs token `asr`, refuse 401 `MFA_REQUIRED` if
   below (a no-op today — every account requires `sf` — but the M2 seam:
   only `getRequiredAssurance`'s body changes later, never this route).
4. Mint session + rotated refresh, both stamped with the **stored** `sv` and the
   presented token's `amr`/`asr` — refresh never upgrades assurance, never
   invents claims.
5. Response carries `accessToken` AND a `sessionToken` alias (mobile reads the
   latter), plus `expiresAt` derived from `SESSION_TTL_SECONDS` (never a
   hardcoded 7d).
6. Header comment must state plainly: **rotation here is not reuse
   detection** — no durable record of issued refresh tokens exists; revocation
   rests on `session_version` + the 1h session TTL (deliberate deferral,
   architecture §17).

### 5.2 Login flow

```
anonymous --[POST /api/auth/google/start]--> state-minted
    effects: 32B raw nonce (hex) → sha256 = nonce_hash
             oauth_state.v1 token minted {nonce_hash, flow:'login'}
             set-cookie sync-oauth-state (10 min) AND return {url} with same token as state param
             raw nonce leaves the server ONLY inside the authorize URL

state-minted --[Google redirects to /he/sign-in; SPA POSTs {code,state} to /api/auth/callback]-->
```

Callback gate sequence — strictly ordered, **all before any side effect** (no
user row created or touched, no session minted, until state AND id_token both
verify); state cookie is deleted on *every* response after first read (single
use):

| # | Gate | Failure |
|---|---|---|
| 1 | `code` present | 400 `MISSING_CODE` |
| 2 | `state` present | 400 `MISSING_STATE` |
| 3 | `sync-oauth-state` cookie present | 400 `MISSING_STATE_COOKIE` |
| 4 | `secureEqual(state, cookie)` (double submit) | 400 `STATE_MISMATCH` |
| 5 | `verifyLoginOAuthState(state)` | 400 `INVALID_STATE` |
| 6 | code exchange; `id_token` present | 401 `MISSING_ID_TOKEN` |
| 7 | `verifyGoogleIdToken(idToken, {nonceHash})` — jose: signature/iss/aud/exp; then `email_verified === true`, nonce present, sha256(nonce) `secureEqual` state's hash | 401 (403 iff `email_not_verified`) `ID_TOKEN_VERIFICATION_FAILED` |
| 8 | catch-all | 500 `AUTH_FAILED` — generic, never echoes verification internals |

Identity authority = verified `id_token.sub`. `getGoogleUserInfo` (userinfo) is
**profile enrichment only**; its failure degrades the profile, never fails the
login, and never overrides subject or email. `sv` is read from the row just
created/read — never a literal at a mint call site.

Post-identity branch (the M2/WS-D case table; cases 1–2 are today's only live
behavior):

| # | Case (`enrolled` = active factor; `enforced` = DB flag) | Behavior |
|---|---|---|
| 1 | not enrolled | mint session `sf ["google"]` + refresh |
| 2 | enrolled, enforcement OFF | same as 1; +20 not awarded (§6.2) |
| 3 | enrolled, enforcement ON | insert `mfa_pending_tokens` row, set `sync-mfa-pending`; **no session, no refresh**; respond `MFA_REQUIRED` |
| 4 | correct TOTP at challenge | verify (§5.5b) → consume row (§5.5a) → mint `mf ["google","totp"]`; clear pending cookie |
| 5 | incorrect TOTP | `attempt_count++`, generic error; at 5 the row is exhausted forever; restart login |
| 6 | recovery code | atomic code spend → row consume → mint `mf ["google","recovery"]`; banner + email + events (§5.4) |
| 7 | expired pending | 401 `CHALLENGE_EXPIRED`; restart login |
| 8 | replayed pending (`consumed_at` set) | 401; event `mfa_challenge_replayed` |
| 9 | TOTP step replay | rejected as failure (monotonic guard) |
| 10 | refresh, `asr=mf`, `sv` match | rotate preserving `amr`/`asr` |
| 11 | refresh, `asr=sf`, account now requires `mf` | 401 `MFA_REQUIRED`, cookies cleared, full re-login |
| 12 | anything with stale `sv` | 401, cookies cleared |

### 5.3 TOTP factor lifecycle (M2/M3)

```
absent --[POST /api/security/mfa/enroll · requireAuth; MFA_ENROLLMENT_ENABLED; no reauth for first enrollment]--> pending
    effects: delete stale pending row (>15 min = treated absent)
             20-byte secret via crypto.getRandomValues
             AES-256-GCM encrypt (HKDF key 'mfa_secret_enc', AAD user_id‖factor_id)
             respond ONCE: otpauth://totp/Taruu:{email}?secret={base32}&issuer=Taruu&algorithm=SHA1&digits=6&period=30
    event: mfa_enrollment_started

pending --[POST /enroll/confirm {code} · RFC 6238 SHA-1/6/30s, window ±1, monotonic guard]--> active
    single transaction: status='active', confirmed_at (set exactly once), last_accepted_step,
                        recovery batch generated (returned ONCE), score trigger fires
    events: mfa_enrollment_confirmed, recovery_codes_regenerated
pending --[5th bad confirm]--> deleted (event mfa_enrollment_failed; user restarts)

active --[user disable · reauth ticket 'mfa_disable', method totp|recovery, NEVER google]--> disabled(reason='user')
    single transaction: retain row; delete unused recovery codes; sv+1;
                        caller re-minted sf ["google"] session with new sv in same response;
                        score → 0 via trigger
    events: mfa_disabled, session_version_revoked; email sent
active --[operator reset (§5.6b)]--> disabled(reason='operator_reset')
```

Uniqueness makes invalid states unrepresentable: at most one `active` and one
`pending` row per user (partial unique indexes); a new enrollment replaces the
prior pending row; `disabled` rows accumulate as audit history.

Interop profile is fixed: SHA-1, 6 digits, 30s — what every mainstream
authenticator implements. QR via the already-declared `qrcode.react`.

### 5.4 Recovery-code batch lifecycle (M2/M3)

```
none --[enroll confirm | regenerate]--> live (10 codes, 16 Crockford-base32 chars XXXX-XXXX-XXXX-XXXX,
                                              crypto.randomBytes, SHA-256 hashes stored, shown exactly once)
live --[code used]--> depleting        spend: UPDATE ... SET used_at=now()
                                              WHERE user_id=$1 AND code_hash=$2 AND used_at IS NULL RETURNING id
live --[POST /recovery/regenerate · reauth 'recovery_regenerate']--> replaced
                                       one transaction: delete prior batch, insert new, return once
live --[MFA disabled/reset]--> deleted (history lives in security_events)
```

Recovery login yields `asr=mf`, `amr=["google","recovery"]` (decided — see
architecture §6.2a for the full rationale). The degradation is made visible,
never silent: `recovery_code_used` event, persistent UI banner keyed off `amr`,
Resend notification email, regenerate prompt at ≤2 remaining. At 0 remaining,
recovery login is impossible (TOTP or operator reset only).

### 5.5 Pending-challenge state machine (M2/WS-D) — the two concurrency guards

**a) Row consumption is the commit point.** Code verification (TOTP or
recovery) completes first; then:

```sql
UPDATE mfa_pending_tokens
   SET consumed_at = now()
 WHERE id = $jti AND user_id = $uid
   AND consumed_at IS NULL AND expires_at > now() AND attempt_count < 5
RETURNING id;
```

Row-level locking → exactly one concurrent request gets the row; only the
winner mints a session; the loser gets 401 (`mfa_challenge_replayed`). A
cryptographically valid `mfa_pending.v1` JWT with a missing/expired/consumed/
exhausted row is refused — **the row is the authority, the JWT a locator.**

**b) TOTP replay guard.** `last_accepted_step` is a monotonic high-water mark
of accepted time-steps (`floor(unix/30)`). Candidates `{T-1, T, T+1}` (±30s
skew); a candidate matches only if the code is correct for that step AND
`step > last_accepted_step`; persistence guards again:

```sql
UPDATE user_mfa_factors
   SET last_accepted_step = $step, last_used_at = now()
 WHERE id = $factor AND (last_accepted_step IS NULL OR last_accepted_step < $step)
RETURNING id;
```

No row returned = concurrent acceptance won = treat as failure. Same code can
never be accepted twice, including simultaneous submissions. One primitive,
three call sites: enroll confirm, login challenge, reauth.

### 5.6 Reauthentication & operator reset (M4/M7)

**a) Ticket lifecycle.** `POST /api/security/reauth {purpose, code?}` — the
server derives permissible methods from account factor state + the policy
matrix; the client never chooses. Ticket = DB row (authority) + `reauth.v1` JWT
in the response body, replayed as `X-Reauth-Ticket` on the guarded call.
Single-use (conditional-UPDATE consume), 5-min expiry, bound to
`(user_id, purpose)` — a `mfa_disable` ticket cannot authorize
`recovery_regenerate`. Guard helper `requireReauth(request, purpose)` lives
beside `requireAuth`; 403 `REAUTH_REQUIRED` otherwise.

Policy matrix (governing rule: **`google` never satisfies reauth for an account
with an active factor** — a hijacked Google account could otherwise strip MFA):

| purpose | no active factor | active factor |
|---|---|---|
| `mfa_disable` | n/a | TOTP or recovery; never google |
| `recovery_regenerate` | n/a | TOTP or recovery; never google |
| `operator_reset` (operator's own ticket) | n/a (operators enroll before flag-on) | **TOTP only** |
| `security_settings` (future) | fresh Google round-trip (`flow='reauth'`) | TOTP or recovery; never google |

**b) Operator reset.** Authorization = `requireSecurityAdmin` — the exact
`requirePilotAdmin` predicate (`role_grants` `super_admin` OR
`users.is_platform_admin`) plus: always a TOTP-only reauth ticket, plus
`session.asr === 'mf'` asserted whenever the operator is enrolled AND
enforcement is live (conditionality explained by M8 ordering — architecture
§7.3). Endpoint `POST /api/security/admin/mfa-reset {targetUserId, reason}`,
reason mandatory 10–2000 chars. One transaction on the target: factor
`disabled(reason='operator_reset')`, unused recovery codes deleted, `sv+1`,
score → 0. Events `mfa_reset_by_operator` (`user_id`=target,
`actor_user_id`=operator) + `session_version_revoked`; Resend email to target.
Target lands in login case 1 and may re-enroll.

### 5.7 Rollout state machine (M8 — the only behavioral milestone)

```
everything dark
  --1--> MFA_ENROLLMENT_ENABLED=true (staging/internal) : founders+operators enroll, real-app validation
  --2--> enrollment on in production                    : still no challenge, still no +20
  --3--> all reset-capable operators verified enrolled → OPERATOR_RESET_ENABLED=true; one rehearsed reset
  --4--> ENFORCEMENT FLIP: single DB transaction
             UPDATE security_settings SET mfa_enforcement_enabled = true;
             <recompute security_score for all users with active factors>
         gated on: every supported first-party client can complete the challenge
                   (today: apps/mobile ships challenge UI, or mobile login formally retired)
  --rollback--> same transaction with false + recompute-to-0; secrets retained encrypted
```

Nothing activates because schema or code lands. Migrations are inert on
arrival; every behavior change is a runbook step. The flip is runbook DML,
never a migration file.

---

## 6. Scoring model (approved invariant — not open for redesign)

### 6.1 Three scores, three owners

| Score | Max | Storage | Writer | Consumers |
|---|---|---|---|---|
| `identity_score` | 140 | `users` column | **DB triggers only** (PR-A `20260807000001`) | eligibility, display |
| `security_score` | 20 | `users` column (M2) | **DB trigger only** (`calculate_security_score`, PR-A's exact `SECURITY DEFINER SET search_path = public` + REVOKE pattern) | display |
| `displayed_trust_score` | 160 | **not a column** | derived: `identityScore + securityScore` in `packages/shared/src/utils/identityScore.ts` | display only |

`security_score = 20` iff active factor exists AND
`security_settings.mfa_enforcement_enabled`; else 0. Both conditions, nothing
else — an enrolled user under enforcement-OFF scores 0; the +20 appears for
every enrolled user at the flip (which recomputes in the same transaction).
Posture is claimed only when it is enforced.

### 6.2 Eligibility never touches security

Ballot gate (PR-A, `votingGate()` in `identityScore.ts:164`):
`identity_score >= MINIMUM_IDENTITY_SCORE_FOR_VOTING (40)` **AND**
`residencyVerified` as an explicit boolean — residency is not substitutable by
score points. **MFA appears in neither term.** Guards: eligibility/participation
modules keep identity-only signatures; a characterization test greps
`eligibility.ts`, `api/votes/**`, `api/payments/**` for
`security_score|securityScore|displayed_trust|displayedTrust` and fails on any
hit; no DB function or view combines the two scores.

Constants live in `@sync/shared` (`identityScore.ts`): weights google 40 / ID
document 40 / GPS 20 / phone 10 / FB 10 / IG 10 / X 10 (dormant), cap
`LEAST(..., 140)`. **Never hardcode a weight or threshold** — the callback's
`identity_score: 40` literal is the one live violation (§13) and PR-A removes
it.

---

## 7. Security events (M2/WS-H)

Taxonomy (CHECK values): `mfa_enrollment_started/confirmed/failed`,
`totp_verification_success/failure`, `recovery_code_used/failed`,
`recovery_codes_regenerated`, `mfa_disabled`, `mfa_reset_by_operator`,
`reauth_success/failure`, `mfa_challenge_expired/replayed`,
`session_version_revoked`.

Shape: the `role_grant_events` no-FK variant (log outlives subject) enforced by
the `space_audit_log` mechanism (BEFORE UPDATE/DELETE row trigger + BEFORE
TRUNCATE statement trigger raising `insufficient_privilege`, **plus** `REVOKE
UPDATE, DELETE, TRUNCATE FROM anon, authenticated, service_role` — RLS is never
the append-only mechanism because service role bypasses it; tamper-resistant,
not WORM). `actor_user_id` NULL = self/system. `reason` length-checked 10–2000
for operator resets. `ip_hash` = SHA-256(ip + `SECURITY_EVENT_PEPPER`), raw IPs
never stored. `metadata jsonb` with per-type whitelisted keys. Never stored:
secrets, codes (even hashed), raw tokens, raw IPs.

**One writer module** — `server/infra/supabase/security-events.repo.ts` (mold:
`space-audit.repo.ts`), exports insert only. Every transition in §5 lists its
events inline; tests assert each API path writes them. Retention: indefinite
(decided); changing that requires a separate policy decision + migration.

Doubles as the rate-limit substrate:
`idx_security_events_user_type_time (user_id, event_type, created_at DESC)`.

---

## 8. Rate limiting (durable only)

The in-memory limiter (`lib/rate-limit.ts`) is per-process and resets on deploy
— it must never be the sole control on any MFA endpoint. Upstash is optional
later hardening, not a prerequisite. Two durable mechanisms: row counters
(`attempt_count`, `confirm_attempts` — mold `phone_verifications.send_attempts`)
and windowed counts over `security_events` (failures are logged anyway; the
audit log is the counter — no separate counter table).

| Action | Limit | Mechanism |
|---|---|---|
| TOTP verify (challenge) | 5/pending token; 20 failures/account/hour | row counter + event window |
| Pending-token mints | 10/account/hour | row count by `created_at` |
| Recovery attempts | 5 failures/hour, 20/day | event window |
| Enrollment start | 5/account/hour | event window |
| Enrollment confirm | 5/pending factor | `confirm_attempts` |
| Reauth attempts | 5 failures/15 min | event window |
| Operator reset | 10/operator/day | event window on `actor_user_id` |

All limits time-windowed and self-expiring. **No durable lockout flags** — a
locked column is an attacker-triggerable DoS. Responses reuse
`createRateLimitResponse`.

---

## 9. API surface

### 9.1 Route responsibility table

| Route | Milestone | Guard | Responsibility |
|---|---|---|---|
| `POST /api/auth/google/start` | M1 ✅ | none (pre-identity) | mint signed state + nonce, set state cookie, return authorize URL |
| `POST /api/auth/callback` | M1 ✅ (uncommitted) | state + id_token gates (§5.2) | verified identity → user row → session mint (M2: or pending challenge) |
| `POST /api/auth/session` | pre-existing | session verify | validate + return profile |
| `DELETE /api/auth/session` | pre-existing | none | clear cookies (no revocation — §5.1c) |
| `POST /api/auth/session/refresh` | M1 Task 8 ⏳ | refresh verify + sv + assurance | rotate per §5.1e |
| `POST /api/auth/mfa/verify` | M5/WS-D | pending row (§5.5) | challenge: TOTP or recovery → session |
| `POST /api/security/mfa/enroll` | M3 | `requireAuth` + enrollment flag | §5.3 |
| `POST /api/security/mfa/enroll/confirm` | M3 | `requireAuth` + pending row | §5.3 |
| `POST /api/security/mfa/disable` | M3 | `requireAuth` + reauth(`mfa_disable`) | §5.3 |
| `POST /api/security/mfa/recovery/regenerate` | M3 | `requireAuth` + reauth(`recovery_regenerate`) | §5.4 |
| `POST /api/security/reauth` | M4 | session + method matrix | §5.6a |
| `POST /api/security/admin/mfa-reset` | M7 | `requireSecurityAdmin` + reauth(TOTP only) + flag | §5.6b |

### 9.2 Error responses

Every auth/MFA route answers `{ error: string, code: string }` with generic,
non-oracular messages (the M1 callback is the template; codes like
`MISSING_STATE_COOKIE`, `STATE_MISMATCH`, `MFA_REQUIRED`). Never echo
verification internals, token material, or which specific check failed inside
id_token verification. The repo's newer taxonomy (`server/http/errors.ts` +
`respond.ts`, neverthrow `ResultAsync`, "route handlers stay ~15 lines") is the
preferred shape for **new** `/api/security/*` routes; the `/api/auth/*` routes
follow the M1 hand-rolled `{error, code}` idiom for consistency with their
existing neighbors. Machine-readable `code` is mandatory either way — mobile
keys on it (§10.2).

---

## 10. Client contracts

### 10.1 Web (`apps/web`)

- `AuthProvider.tsx`: sign-in calls `POST /api/auth/google/start`, redirects to
  the returned URL; the sign-in page (`/he/sign-in` = `GOOGLE_REDIRECT_PATH` —
  an app page, never the API route) POSTs `{code, state}` to the callback.
  sessionStorage state logic is gone (server-minted state).
- Silent refresh: `fetch('/api/auth/session/refresh', {method:'POST',
  credentials:'include'})`. Known wart (§13): the provider currently passes only
  `accessToken` to `setTokens` on refresh, wiping stored refreshToken/expiresAt
  — Task 8's response contract plus a provider touch-up fix this.
- M6 UI surfaces (challenge page, settings/security, enroll flow, ReauthDialog,
  score cards at explicit maxima 140/20/160) — architecture §11 owns the
  inventory. Hebrew user-facing strings go in `@sync/shared`
  `constants/errors.ts` as `AUTH_*` keys.

### 10.2 Mobile (`apps/mobile`) — ground truth and contract

**Mobile auth cannot succeed today** — the client was written against a
contract the server never implemented (wrong redirect_uri, GET vs POST-only
callback, raw-JSON state vs signed-state + cookie double submit, no nonce, and
a deep-link redirect `sync://auth/callback?session_token=…` that no route
produces). Refresh is independently broken (server reads cookie only, mobile
posts body; mobile reads `sessionToken`, server returns `accessToken`).
Sign-out is local-only.

What Issue #71 commits to, by milestone:

- **M1 (Task 8) fixes only refresh intake/response**: body/Bearer accept,
  `sessionToken` alias, real `expiresAt`. The mobile *login* path (a mobile
  start endpoint + a state carrier that works without a cookie jar + a redirect
  the app can catch) is **out of M1 scope, formally flagged** — it is its own
  design decision, to be settled before or with M6b.
- **Mobile challenge UI (M6b) is a hard gate on the enforcement flip** (§5.7
  step 4): either mobile can complete the challenge or mobile login is formally
  retired first.
- **Server-side gating only.** Mobile's screens gate on a Zustand flag
  rehydrated from plaintext AsyncStorage — trivially bypassable. An enrolled
  user who hasn't completed the challenge is blocked by the *server* (no
  session exists in the pending state; `MFA_REQUIRED` on refresh), never by a
  client flag.
- **`MFA_REQUIRED` must be visible to mobile.** `ApiError` currently surfaces
  only `error.message`, and routes return `{error, code}` with no `message` —
  so every server error reads as literal `'Request failed'`. The api-client
  mapping must surface `code` before any mobile challenge work lands.
- Known mobile debts recorded for later milestones, not M1: duplicated
  hardcoded vote gate (`score >= 40`, no residency, no named constant) in
  `authStore.ts`; no `expiresAt` handling/proactive refresh; refresh clears all
  tokens on any non-OK including network blips; client-side OAuth URL builders
  to be deleted, not patched.

---

## 11. Coding conventions & quality gates (repo-verified)

**TypeScript.** `strict: true`, alias `@/* → src/*`. Files ideally <500 lines
(hard outliers exist; don't add new ones). Comment style is distinctive and
expected: prose JSDoc headers explaining *why* and naming the failure
prevented, citing spec sections (`tokens.test.ts:1-6` cites "canonical §4.2");
no mechanical what-it-does comments.

**Tests.** Vitest, `environment: 'node'`, no jsdom. New auth/MFA modules use
**co-located** `*.test.ts` beside the source (the M1 convention); route tests
may live in `src/__tests__/api/<kebab>.test.ts`. Mock shape: `vi.mock('@/…',
() => ({ fn: vi.fn() }))` at top + second import block of mocked symbols; route
handlers imported by name and invoked with a real `NextRequest`. Modules that
read env at module scope are tested with `vi.stubEnv` in `beforeEach` +
**dynamic `await import()` inside each test** (see `tokens.test.ts:16-32`) plus
cache resets (`resetDerivedKeyCache`). Importing anything under `server/**`
works only because vitest aliases `server-only` to a stub — keep that alias
intact. Playwright e2e lives in `apps/web/tests/e2e`, excluded from vitest.
SQL proof suites (`supabase/tests/*.sql`, transactional; molds
`identity_score_triggers.sql`, `audit_append_only.sql`) are excluded from
`pnpm test` (no live-DB harness in CI) but required for trigger/append-only/
consume semantics.

**Commands / CI.** `pnpm test`, `pnpm typecheck` (`tsc --noEmit`), `pnpm lint`,
`pnpm build` — all four run on every PR (`agent-verification.yml`, tests first,
after the `docs/agent-evidence/` gate). Lint is light
(`no-explicit-any: off`) — don't rely on it to catch anything; typecheck and
tests are the real gates.

**Crypto.** Web Crypto only (§1); `@/lib/secureCompare` for constant-time
comparison; `jose` for all JWTs; never log token/secret/nonce material.

**Commits.** `type(scope): lowercase imperative` — `feat(auth-kernel):`,
`docs(security):`. TDD pairs where practiced: failing-test commit then
implementation commit (see the M1 history).

---

## 12. Migrations: registry & discipline

### 12.1 Reserved version registry (the only legitimate source of Issue #71 versions)

| Version | Owner | Contents | Status |
|---|---|---|---|
| `20260807000001_identity_score_unification` | PR-A (M0) | per PR #110 | exists on PR-A branch; **unapplied**; branch needs rebase (§12.3) |
| `20260901000001_session_version` | M1 | `users.session_version` | **committed on m1 branch; unapplied; inert** |
| `20260901000002_mfa_schema` | M2 | 5 tables + `security_settings` seeded false + append-only enforcement + indexes | reserved |
| `20260901000003_security_score` | M2 | `users.security_score` + CHECK, `calculate_security_score`, factor trigger, REVOKEs | reserved |
| `20260901000004_operator_audit_reserved` | M7 | buffer; expected unused | reserved |

Rules: versions are burned once reserved; an unused slot is retired with an
explicitly empty placeholder file (house precedent:
`20260806000001_version_slot_retired.sql`), never silently reused; no workstream
invents versions; renumbering happens only by editing this section.

### 12.2 Apply discipline (house procedure, stated in-repo)

Production's ledger has intentional drift; the ledger keys on **version only**
and a duplicate slot is *silently skipped* (the historical `pilot_program`
defect). Therefore: app-first deploy where ordering matters, ledger snapshot,
**single verbatim `apply_migration` per file — never "apply all pending"**,
ledger-delta verification (exactly one new row per apply). Raw SQL, no down
migrations — every migration header records its own rollback script. Recent
security migrations use bare DDL + single-apply discipline rather than
`IF NOT EXISTS`. Two further hard rules from PR-A's header: adding an enum
value takes two separately-applied migrations (`ADD VALUE` can't share a
transaction with DML using it); and while `calculate_identity_score(users)`
exists, **no `users` column can be DROPPED** without first dropping/redefining
that function in the same migration.

### 12.3 PR-A preconditions (M0 — hard prerequisite for all scoring work)

PR #110 as-is cannot merge/apply: (a) it still carries **two files claiming
`20260806000001`** — a slot production already owns — and must be rebased onto
main's resolution (retired slot + renumbered files); (b) its
`[storage] enabled = false` breaks local replay at `20260805000002`; (c) the
app-side writer removal (`updateUserIdentityScore` deleted) must deploy
**before** the migration applies, or an old deployment overwrites canonical
scores on the next social callback. M1 does not depend on PR-A; M2+ scoring
does.

---

## 13. Current implementation status vs this model (2026-08-13)

**M1 auth kernel: 8 of 9 tasks landed on `dolev/issue-71-m1-auth-kernel`.**

| Piece | State |
|---|---|
| keys / tokens / assurance / session (Model B) / legacy window / google start / oauth login state / google-oidc JWKS | ✅ committed, tested (11 commits) |
| Callback hardening (Task 7) | ✅ implemented + reviewed, **uncommitted** — 3 files: `callback/route.ts`, `services/auth/google.ts`, `services/auth/index.ts` |
| Refresh route (Task 8) | ❌ untouched pre-M1 code; **does not typecheck** (3 × TS2345 at `refresh/route.ts:46,56,64`); all 7 flaws of §5.1e's "before" state present; its tests still mock the old string-returning contract |
| Guard tests + full-suite regression (Task 9) | ❌ not started (`mint-path-guard.test.ts`, `user-token.test.ts` assurance-claims guard) |
| Migration `20260901000001` | committed, **not applied to prod** (correct — operator runbook step) |

**No material conflicts between existing implementation and this model.** The
implementation *is* this model's M1 slice. Recorded warts (fix in their named
milestone, don't let them drift):

1. `callback/route.ts:192` hardcodes `identity_score: 40` — pre-existing; PR-A
   removes it; **leave it in M1** (removing it early would race PR-A's
   two-stage rollout).
2. `isSessionExpiringSoon` uses a 1h horizon = the whole session TTL, so it is
   effectively always true. Harmless; tidy in Task 8/9.
3. `user-token.ts:16-18` header still says the session cookie "lives for 7
   days" — stale comment; fix when Task 8 lands.
4. `.env.example` still lists `JWT_EXPIRY=7d` (dead for sessions).
5. `types.ts` types `identity_score: number` while production has the column
   nullable — hand-maintained-types drift; PR-A territory.
6. oauth-state family 1 (social connect) still on `JWT_SECRET`, logs failures —
   deliberate follow-up (§3.3).

---

## 14. Remaining work to complete Issue #71 E2E

Order per architecture §16; every milestone lands dark.

| Milestone | Work | Depends on |
|---|---|---|
| **M1 finish** | commit Task 7; rewrite refresh route per §5.1e + rewrite its tests; Task 9 guard tests; full vitest + typecheck green; SUMMARY | nothing |
| **M0** | rebase + land PR-A; apply `20260807000001` (app-first) | §12.3 |
| **M2** | migrations `20260901000002` + `...03`; SQL proof suite; security-events repo writer; Resend security templates; hand-written types | M1, M0 |
| **M3** | enroll / confirm / disable / recovery APIs behind `MFA_ENROLLMENT_ENABLED`; durable limits | M2 |
| **M4** | reauth tickets + `requireReauth` + method matrix | M1, M2 |
| **M5** | login-challenge branch (case 3) + `/api/auth/mfa/verify` + refresh assurance re-check goes live-but-dark | M1, M2, M3 |
| **M6 / M6b** | web UI surfaces; mobile: api-client `code` surfacing + challenge UI (or formal mobile-login retirement) — M6b gates the flip | M3, M5 |
| **M7** | operator reset + notifications behind `OPERATOR_RESET_ENABLED` | M4, M2 |
| **M8** | runbook flips only (§5.7) | all above + mobile gate |

Out of Issue #71 (tracked separately): mobile login deep-link redesign beyond
the challenge requirement; oauth-state family-1 migration + `JWT_SECRET`
retirement; refresh reuse-detection (deliberately deferred); Upstash.

---

## 15. Corrections to `mfa-architecture.md` (verified against production)

The architecture doc stays as approved; these are the places its prose is
superseded by verified reality. Its *decisions* are unaffected.

1. **§2 "Supabase Auth disabled; auth.uid() always NULL"** — true for the
   application and for local replay, but the hosted project runs a live GoTrue
   `auth` schema with rows (see §1). The design consequence (don't build on
   `supabase.auth.mfa.*`) stands unchanged; only the factual claim is
   sharpened.
2. **§2 "prod ledger = 49/49"** — now 50 applied, latest `20260811000004`
   (audit predates the pilot_program apply).
3. **Suggested destination realized**: the architecture doc now lives at
   `specs/mfa-architecture.md`, which resolves the previously dangling path
   citations in `20260901000001_session_version.sql` and gives the bare
   "canonical §4.x" references in `keys.ts`, `assurance.ts`, and the M1 test
   headers a resolvable target.
4. **§2 "No auth middleware ... 172 per-route requireAuth sites"** — current
   count on the m1 branch is 69 route files + 7 RSC pages funneling through the
   session chokepoint; the architectural point (single chokepoint, Model B is
   one code change) is unchanged.
5. This document adds the `users` self-UPDATE RLS finding (§2.3) as an explicit
   design constraint the architecture doc implied but did not state.
