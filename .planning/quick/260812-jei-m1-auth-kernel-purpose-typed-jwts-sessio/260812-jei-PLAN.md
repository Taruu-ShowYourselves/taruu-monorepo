---
phase: quick-260812-jei
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements:
  - "#71-M1-01"   # migration 20260901000001_session_version (reserved string, not applied)
  - "#71-M1-02"   # AUTH_MASTER_KEY + HKDF-SHA256 per-purpose keys, kid v1
  - "#71-M1-03"   # purpose-typed JWTs (session.v1 / refresh.v1 / oauth_state.v1), non-interchangeable
  - "#71-M1-04"   # session claims userId, googleId, email, sv, amr, asr; 1h TTL
  - "#71-M1-05"   # refresh.v1 own key, 30d, rotated, assurance re-check, no reuse-detection claim
  - "#71-M1-06"   # Model B central session_version check in getSessionFromRequest/requireAuth
  - "#71-M1-07"   # Google id_token verified locally via JWKS (iss/aud/exp/email_verified/nonce)
  - "#71-M1-08"   # server-minted signed oauth_state + nonce, double-submit cookie
  - "#71-M1-09"   # bounded legacy HS256 acceptance window, session path only
  - "#71-M1-10"   # mobile/web compat strictly necessary for M1
  - "#71-M1-11"   # tests per canonical 16b for all of the above
files_modified:
  - supabase/migrations/20260901000001_session_version.sql
  - apps/web/src/lib/supabase/types.ts
  - apps/web/src/lib/supabase/db.ts
  - apps/web/src/lib/oauth-state.ts
  - apps/web/src/services/auth/keys.ts
  - apps/web/src/services/auth/tokens.ts
  - apps/web/src/services/auth/tokens.test.ts
  - apps/web/src/services/auth/legacy-token.ts
  - apps/web/src/services/auth/legacy-token.test.ts
  - apps/web/src/services/auth/assurance.ts
  - apps/web/src/services/auth/session.ts
  - apps/web/src/services/auth/session.test.ts
  - apps/web/src/services/auth/google-oidc.ts
  - apps/web/src/services/auth/google-oidc.test.ts
  - apps/web/src/services/auth/google.ts
  - apps/web/src/services/auth/origin.ts
  - apps/web/src/services/auth/index.ts
  - apps/web/src/services/auth/mint-path-guard.test.ts
  - apps/web/src/app/api/auth/google/start/route.ts
  - apps/web/src/app/api/auth/callback/route.ts
  - apps/web/src/app/api/auth/session/refresh/route.ts
  - apps/web/src/providers/AuthProvider.tsx
  - apps/web/src/__tests__/api/auth-callback.test.ts
  - apps/web/src/__tests__/api/auth-refresh.test.ts
  - apps/web/src/__tests__/api/auth-google-start.test.ts
  - apps/web/src/lib/supabase/user-token.test.ts
  - .env.example

user_setup:
  - service: deployment-env
    why: "AUTH_MASTER_KEY is the root of every M1 signing key; there is no fallback and the app fails loudly without it. AUTH_LEGACY_UNTIL bounds the pre-M1 token window."
    env_vars:
      - name: AUTH_MASTER_KEY
        source: "Generate locally: openssl rand -hex 32. Set in .env.local for dev and via `wrangler secret put AUTH_MASTER_KEY` for the Cloudflare Worker before the M1 deploy."
      - name: AUTH_LEGACY_UNTIL
        source: "ISO-8601 UTC instant ~7 days after the M1 deploy, e.g. 2026-09-08T00:00:00Z. Unset means legacy acceptance is OFF and every existing user is signed out at deploy."

must_haves:
  truths:
    - "A user completes Google sign-in and receives a session cookie whose token carries typ session.v1 plus userId, googleId, email, did, sv, amr and asr."
    - "A refresh token presented on the session path is rejected, and a session token presented on the refresh path is rejected."
    - "After users.session_version is incremented, the very next authenticated request presenting a token with the old sv is refused with 401 and its cookies are cleared."
    - "A Google id_token with a wrong issuer, wrong audience, expired exp, email_verified false, or a nonce that does not match the signed state mints no session."
    - "An OAuth callback whose state parameter is missing, unsigned, expired, or unequal to the sync-oauth-state cookie mints no session."
    - "Pre-M1 HS256 tokens still authenticate on the session path until AUTH_LEGACY_UNTIL, are subject to the same session_version check, and are never accepted on the refresh path."
    - "A missing or too-short AUTH_MASTER_KEY makes token operations throw; no weak or derived-from-JWT_SECRET default is ever used."
    - "The Supabase RLS transport token still claims nothing beyond iss, sub, role, aud, iat and exp."
  artifacts:
    - supabase/migrations/20260901000001_session_version.sql
    - apps/web/src/services/auth/keys.ts
    - apps/web/src/services/auth/tokens.ts
    - apps/web/src/services/auth/legacy-token.ts
    - apps/web/src/services/auth/assurance.ts
    - apps/web/src/services/auth/google-oidc.ts
    - apps/web/src/services/auth/origin.ts
    - apps/web/src/app/api/auth/google/start/route.ts
  key_links:
    - "getSessionFromRequest -> getUserSessionVersion(users PK read) -> 401 on mismatch. This is the single revocation chokepoint; 108 modules import getSessionFromRequest and 8 import getSessionFromCookies, so the check must live here and nowhere else."
    - "/api/auth/google/start sets sync-oauth-state cookie <-> /api/auth/callback compares it to the state parameter (double submit)."
    - "signed state nonce_hash <-> Google id_token nonce claim (hash-bound, raw nonce only ever leaves in the authorize URL)."
    - "AUTH_MASTER_KEY -> HKDF(salt taruu-auth-v1, info purpose) -> the three purpose keys used by every mint and verify."
    - "refresh route -> assurance re-check -> mint. Mint of session/refresh tokens exists only in services/auth/session.ts."
---

<objective>
Implement Milestone M1 (WS-A Auth Kernel) of Issue #71: purpose-typed JWTs on HKDF-derived per-purpose keys, a `session_version` revocation column checked in the central authenticated-request path (Model B), locally verified Google id_tokens with server-minted signed state + nonce, refresh rotation that cannot elevate assurance, and a bounded legacy-token window.

Purpose: today a refresh token and a session token are the same HS256 artifact under one secret, OAuth state is validated only in the browser, identity is trusted from `/v1/userinfo` rather than a verified id_token, and there is no revocation mechanism at all. Every later Issue #71 milestone (MFA persistence, login challenge, reauth) stacks on these primitives, so they must be correct before any MFA code exists.

Output: new key/token/OIDC modules under `apps/web/src/services/auth/`, a rewritten session service, a hardened callback and refresh route, a new `/api/auth/google/start` route, migration `20260901000001_session_version.sql` (written, NOT applied), and a test suite covering the canonical §16b M1 items.

Behavior change in production: none intended. Login, authenticated APIs, and sign-out must work exactly as before; existing sessions survive via the legacy window.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/quick/260812-jei-m1-auth-kernel-purpose-typed-jwts-sessio/CANONICAL-ARCHITECTURE.md
@apps/web/src/services/auth/session.ts
@apps/web/src/services/auth/google.ts
@apps/web/src/app/api/auth/callback/route.ts
@apps/web/src/app/api/auth/session/refresh/route.ts
@apps/web/src/lib/oauth-state.ts
@apps/web/src/lib/supabase/user-token.ts
@apps/web/src/providers/AuthProvider.tsx

The canonical architecture document is the contract. §4 (token/session model), §4.3 (OIDC verification), §4.4 (Model B revocation), §4.6 (legacy window), §14.1 (migration registry), §15 (WS-A scope and acceptance), §16b (test strategy) govern this plan. Do not reopen its decisions.
</context>

<repo_reality_notes>
Findings from the audit of this worktree that differ from the canonical document's description of the code, and how to adapt without weakening any invariant. Read these before starting: three of them change what the code must look like.

1. **The chokepoint is `getSessionFromRequest`, not `requireAuth`.** The canonical §4.4 says "172 per-route `requireAuth()` sites". In this tree `requireAuth` is imported by exactly 1 module; `getSessionFromRequest` by 108 and `getSessionFromCookies` by 8. `requireAuth` is a thin wrapper over `getSessionFromRequest`. The Model B check therefore goes inside `getSessionFromRequest` and `getSessionFromCookies` (so `requireAuth` inherits it), and must NOT be added separately in `requireAuth` or it runs twice per request.

2. **The session carries a `did` claim that the canonical claim list omits.** `SessionPayload` has `did`, and `apps/web/src/app/api/auth/session/route.ts:53` and `apps/web/src/app/api/user/profile/route.ts:100` read `session.did`. Keep `did` in the session token and in the `Session` type; add `sv`/`amr`/`asr` alongside it. Dropping it would break two live responses. `did` is not added to the refresh token.

3. **The mobile client's silent refresh is already broken, before this plan.** `apps/mobile/src/lib/auth.ts:242` POSTs `{refreshToken}` in the body and then reads `data.sessionToken`, while `/api/auth/session/refresh` reads the refresh token only from the `sync-refresh` cookie and returns `accessToken`. Mobile also expects sign-in to hand it `session_token`/`refresh_token` as deep-link query parameters (`auth.ts:130`), and no server route produces that redirect. So mobile login/refresh cannot work today at all. Dropping the session TTL from 7d to 1h would make that latent breakage acute the moment mobile login is ever repaired. Task 8 makes the refresh endpoint accept a body/bearer refresh token and emit a `sessionToken` alias so the mobile store's refresh path works when reached; the deep-link login gap is out of M1 scope and is reported, not fixed.

4. **`GOOGLE_CLIENT_ID` is spelled `NEXT_PUBLIC_GOOGLE_CLIENT_ID` here** (`google.ts:27`). The id_token `aud` check uses that variable. `.env.example` currently has it commented out under a stale Auth0 section; leave that section alone except for the additions Task 1 specifies.

5. **Runtime is Cloudflare Workers via OpenNext** (`apps/web/wrangler.jsonc`, `compatibility_flags: ["nodejs_compat"]`). Precedent in `apps/web/src/server/app/space-admin/audience.ts:66` prefers Web Crypto over `node:crypto` for exactly this reason. Derive keys with `crypto.subtle` HKDF, not `node:crypto`'s `hkdfSync`.

6. **`lib/oauth-state.ts` currently serves the Facebook/Instagram connect flows** (4 route importers plus 2 test files) and signs with `JWT_SECRET`, carrying `userId`+`platform`. The login flow's state carries `nonce_hash`+`flow` and no user. Generalize the module by adding the login-flow functions there on the new purpose key; leave the social functions signing as they do today, with a comment recording that their migration to the `oauth_state` key is deliberate follow-up work, not an oversight. Do not fork a second state module.

7. **No migration collision.** `supabase/migrations/` currently ends at `20260811000004_pilot_program.sql`; `20260901000001` is unused. Nothing in this plan applies a migration to any database.
</repo_reality_notes>

<tasks>

<task type="auto">
  <name>Task 1: AUTH_MASTER_KEY and HKDF per-purpose key derivation</name>
  <files>apps/web/src/services/auth/keys.ts, .env.example</files>
  <action>
Create `apps/web/src/services/auth/keys.ts`, the only module that reads `AUTH_MASTER_KEY` (requirement #71-M1-02, canonical §4.1).

Export a `TokenPurpose` union with exactly three members for M1: `session`, `refresh`, `oauth_state`. The canonical §4.1 list also contains mfa_pending, reauth and mfa_secret_enc; those belong to M2 and must not be declared, derived, or referenced here.

Export named constants for the derivation parameters rather than inline literals: the HKDF salt string `taruu-auth-v1`, the derived key length in bytes (32), the hash name (SHA-256), the numeric key version (1) and the JWT header key id (`v1`).

`getAuthMasterKey()` reads `process.env.AUTH_MASTER_KEY` at call time (not at module load — the test suite and the Workers runtime both populate env after import). Throw a descriptive `Error` when it is absent, empty, or shorter than 32 characters. There is no fallback: never read `JWT_SECRET`, never synthesize a default, never degrade in development. The error message names the variable but must never include any part of its value.

`deriveAuthKey(purpose)` returns a `Promise<Uint8Array>` of the 32-byte derived key using Web Crypto: import the master key bytes as raw HKDF key material with `crypto.subtle.importKey`, then `crypto.subtle.deriveBits` with `{ name: 'HKDF', hash: 'SHA-256', salt, info }` where `info` is the UTF-8 purpose string. Use Web Crypto, not `node:crypto` — see repo reality note 5.

Memoize derived keys in a module-level `Map<TokenPurpose, Promise<Uint8Array>>` keyed by purpose, and export a `resetDerivedKeyCache()` used only by tests so an env change between cases takes effect. The memo is a deterministic derivation cache, not a security cache; it holds no user state.

Add to `.env.example`, in a new section beside the existing JWT section: `AUTH_MASTER_KEY` (documented as ≥32 chars, generated with `openssl rand -hex 32`, the root of all M1 signing keys, no fallback) and `AUTH_LEGACY_UNTIL` (documented as the ISO-8601 UTC instant after which pre-M1 tokens stop being accepted; unset means legacy acceptance is off). Update the `JWT_SECRET` comment to record that it now exists only to verify pre-M1 tokens during that window and is deleted with the window.
  </action>
  <verify>
    <automated>cd apps/web && npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>`keys.ts` exports the three M1 purposes and derives distinct 32-byte keys per purpose; a missing or short `AUTH_MASTER_KEY` throws; no code path reads `JWT_SECRET` from this module; `.env.example` documents both new variables.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Purpose-typed token mint and verify</name>
  <files>apps/web/src/services/auth/tokens.ts, apps/web/src/services/auth/tokens.test.ts</files>
  <behavior>
    - A token minted for one purpose verifies for that purpose and returns its claims.
    - A token minted for purpose A fails verification for purpose B, for every ordered pair of the three purposes (six cases) — the key differs and so does the type claim.
    - A token whose type claim is stripped or altered fails verification even when signed with the right key.
    - An expired token fails verification.
    - A token signed with the raw master key rather than a derived key fails verification.
    - Verification returns null on failure and never throws to the caller.
    - Minting with no `AUTH_MASTER_KEY` set rejects with the loud error from Task 1.
  </behavior>
  <action>
Create `apps/web/src/services/auth/tokens.ts` implementing requirement #71-M1-03 (canonical §4.2). This module owns the `jose` signing and verification primitives; nothing outside `services/auth/` may import it (enforced by the guard test in Task 9).

Export a frozen map from `TokenPurpose` to its type-claim string: session to `session.v1`, refresh to `refresh.v1`, oauth_state to `oauth_state.v1`. Note the distinction the reviewer will look for: this is a `typ` **claim in the payload**, set alongside the application claims; the JWT protected header keeps the ordinary media type `JWT` plus `alg: HS256` and `kid` from Task 1's key-version constant. Both defences are present at once — a distinct key per purpose and an exact type-claim match — so a bug in either one alone cannot make two token kinds interchangeable.

`signPurposeToken(purpose, claims, ttlSeconds)`: derive the purpose key, build the payload as the caller's claims plus the type claim, set issued-at, set expiration from `ttlSeconds`, set a random `jti` from `crypto.randomUUID()`, sign HS256. Return the compact token.

`verifyPurposeToken(purpose, token)`: derive the same purpose key, `jwtVerify`, then require the payload's type claim to equal the expected string for that purpose; return the payload on success and `null` on any failure. Catch verification errors internally. Never log the token, any claim value, or key material — on failure log nothing at all from this module; the caller decides what to report.

Export `decodeTokenTypeUnverified(token)` returning the payload's type claim (or null) using `jose`'s unverified decode. Task 5 needs it to tell "a new-format token that failed verification" apart from "an old-format token", and it must never be used to make an authorization decision.

Write `tokens.test.ts` covering every bullet in the behavior block. Stub `AUTH_MASTER_KEY` with `vi.stubEnv` and call `resetDerivedKeyCache()` in `beforeEach`. The cross-purpose matrix is the load-bearing test: iterate all ordered purpose pairs and assert every mismatched pair verifies to null.
  </action>
  <verify>
    <automated>pnpm --filter @sync/web test -- src/services/auth/tokens.test.ts</automated>
  </verify>
  <done>All six cross-purpose verifications return null; same-purpose round trip returns the claims; altered type claim, expired token, and master-key-signed token all fail; missing `AUTH_MASTER_KEY` rejects.</done>
</task>

<task type="auto">
  <name>Task 3: session_version column, generated types, and the PK read helper</name>
  <files>supabase/migrations/20260901000001_session_version.sql, apps/web/src/lib/supabase/types.ts, apps/web/src/lib/supabase/db.ts</files>
  <action>
Write `supabase/migrations/20260901000001_session_version.sql` (requirement #71-M1-01). The version string is reserved by canonical §14.1 and must be used verbatim — do not renumber it to today's date. Confirm before writing that no file in `supabase/migrations/` already starts with that version.

Contents: `ALTER TABLE public.users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1;` plus a `COMMENT ON COLUMN`. Follow the house header style of `20260811000004_pilot_program.sql`: a prose header explaining what the column is and why. The header must state that the column is the global revocation counter, that every session and refresh token is stamped with the value current at mint, that the check happens in the central authenticated-request path so a bump takes effect on the next request, and that this migration is inert — nothing bumps the column in M1.

Do NOT apply this migration to any database, local or remote. No `supabase db push`, no `apply_migration`, no MCP call. Writing the file is the whole deliverable.

Add `session_version: number` to the `users` `Row` in `apps/web/src/lib/supabase/types.ts`, and `session_version?: number` to its `Insert` and `Update` shapes, matching how `identity_score` is declared there.

Add `getUserSessionVersion(userId: string): Promise<number | null>` to `apps/web/src/lib/supabase/db.ts` in the user-operations section. It selects only the `session_version` column for that id via `supabaseAdmin` — a primary-key read, deliberately narrower than `getUserById`, because it runs on every authenticated request. Return `null` when the row is missing or the query errors; the caller treats null as "cannot authenticate" and never as "matches". Add no cache of any kind (canonical §4.4 forbids one, and a cache would silently relax the revocation guarantee).
  </action>
  <verify>
    <automated>test -f supabase/migrations/20260901000001_session_version.sql &amp;&amp; grep -c 'session_version' supabase/migrations/20260901000001_session_version.sql &amp;&amp; cd apps/web &amp;&amp; npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>The migration file exists at the reserved version, adds the column with `NOT NULL DEFAULT 1`, and has not been applied anywhere; `types.ts` declares the column; `getUserSessionVersion` compiles and reads a single column by primary key.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Typed session and refresh mint plus the central session_version check</name>
  <files>apps/web/src/services/auth/session.ts, apps/web/src/services/auth/assurance.ts, apps/web/src/services/auth/session.test.ts</files>
  <behavior>
    - A minted session token carries userId, googleId, did, email, sv, amr ["google"] and asr "sf", expires in 1 hour, and verifies as session.v1.
    - A minted refresh token carries userId, sv, amr and asr, expires in 30 days, verifies as refresh.v1, and carries no did or email.
    - getSessionFromRequest with a valid token whose sv equals the stored session_version returns the session.
    - getSessionFromRequest with a valid token whose sv is lower than the stored session_version returns null (the 401 case).
    - Incrementing the stored session_version between two calls turns an accepted token into a rejected one with no other change.
    - getSessionFromRequest returns null when the user row is missing or the version read fails.
    - A refresh token presented to getSessionFromRequest returns null.
    - getSessionFromCookies enforces the same version check.
  </behavior>
  <action>
Rewrite `apps/web/src/services/auth/session.ts` for requirements #71-M1-04 and #71-M1-06 (canonical §4.2, §4.4, §4.5).

Types: extend `Session` and `SessionPayload` with `sv: number`, `amr: string[]` and `asr: 'sf' | 'mf'`, keeping the existing `userId`, `googleId`, `did` and `email` (repo reality note 2). Export named constants for the TTLs — one hour for the session, thirty days for the refresh — as seconds. The session TTL is a code constant now; `JWT_EXPIRY` no longer governs it, so stop reading that variable and delete `parseDuration` if nothing else uses it.

Create `apps/web/src/services/auth/assurance.ts` first. It exports the `Assurance` type (`sf` | `mf`), the M1 login defaults (`amr` `['google']`, `asr` `sf`), a rank comparison helper where mf outranks sf, and `getRequiredAssurance(userId): Promise<Assurance>`. In M1 that function returns `sf` unconditionally, with a header comment stating that it is the §4.5 primitive and that M2 replaces its body with the `user_mfa_factors` + `security_settings` derivation; it takes the userId parameter now so no call site has to change later.

`createSessionToken(payload)` and `createRefreshToken(payload)` both go through `signPurposeToken` from Task 2 with their own purpose. `createRefreshToken` changes signature from a bare `userId` string to an object carrying `userId`, `sv`, `amr` and `asr`; update its two callers in Task 7 and Task 8. Callers pass `sv` explicitly — the mint functions never read the database themselves, so a caller cannot accidentally mint a token stamped with a version it did not verify.

`verifySessionToken(token)` and `verifyRefreshToken(token)` verify against their own purpose only and return typed claims or null. `verifyRefreshToken` returns the full claim set now, not just a userId string, because the refresh route needs `sv`, `amr` and `asr`.

The revocation check (canonical §4.4, Model B) lives in exactly one private helper, `assertLiveSessionVersion(claims)`: call `getUserSessionVersion(claims.userId)` from Task 3 and return the session only when the stored value strictly equals `claims.sv`; on mismatch, missing row, or read failure return null. Call it from `getSessionFromCookies` and `getSessionFromRequest` — and from nowhere else. Do not add it to `requireAuth`, which already delegates to `getSessionFromRequest`; a second call would double the per-request read (repo reality note 1).

On a version mismatch, also attempt to clear the session cookies so the browser stops re-presenting a dead token, wrapped in try/catch: `cookies()` is mutable inside route handlers but throws in a React Server Component render, and the authentication result must not depend on which context called it. Whether or not the clear succeeds, return null so every one of the 108 call sites produces its existing unauthenticated response.

Never log tokens, claims, or the derived keys anywhere in this module.

Write `session.test.ts` covering the behavior block. Mock `@/lib/supabase/db` for `getUserSessionVersion` and mock `next/headers` so the module's cookie import is inert; drive `getSessionFromRequest` with a plain `Request` carrying an `Authorization: Bearer` header and, separately, a `Cookie` header. The revocation-immediacy case — accept, bump the mocked stored version, reject — is the canonical §16b test and must assert both outcomes with the same token instance.
  </action>
  <verify>
    <automated>pnpm --filter @sync/web test -- src/services/auth/session.test.ts</automated>
  </verify>
  <done>Session and refresh tokens mint with the specified claims and TTLs; the stored-version check runs in both session entry points and in neither `requireAuth` nor the mint functions; a stale sv yields null; a refresh token never authenticates a request.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Bounded legacy-token acceptance window</name>
  <files>apps/web/src/services/auth/legacy-token.ts, apps/web/src/services/auth/legacy-token.test.ts, apps/web/src/services/auth/session.ts</files>
  <behavior>
    - Inside the window, a pre-M1 HS256 token signed with JWT_SECRET authenticates and is surfaced as asr "sf", amr ["google"], sv 1.
    - A legacy token whose user has a stored session_version greater than 1 is rejected.
    - Past AUTH_LEGACY_UNTIL, the same legacy token is rejected.
    - With AUTH_LEGACY_UNTIL unset or unparseable, legacy acceptance is off.
    - A legacy token is rejected on the refresh path in every case, window open or not.
    - A new-format token that fails verification — wrong key, tampered payload, expired — is rejected outright and is never retried as a legacy token.
    - An expired legacy token is rejected.
  </behavior>
  <action>
Create `apps/web/src/services/auth/legacy-token.ts` implementing requirement #71-M1-09 (canonical §4.6). Putting it in its own file makes the end of the window a file deletion plus one import removal; say so in the header comment, and record there that the whole module and the `JWT_SECRET` variable are removed once the deadline passes.

`isLegacyWindowOpen(now = new Date())` parses `AUTH_LEGACY_UNTIL` as an ISO-8601 instant and returns true only when it parses and is still in the future. Unset, empty, or unparseable means closed. This is a deliberate fail-closed choice: an operator who forgets the variable signs users out once, whereas a fail-open default would silently keep the weakest verification path alive forever. The header comment must state that choice and its consequence.

`verifyLegacySessionToken(token)` returns claims or null. It returns null immediately when the window is closed. Otherwise it verifies HS256 against `JWT_SECRET` (throwing loudly if that variable is missing while the window is open) and maps the old payload onto the current shape: userId, googleId, did and email from the token; `sv` fixed at 1; `amr` `['google']`; `asr` `sf`. The constants come from `assurance.ts`, not from literals here.

Wire it into `session.ts` at exactly one place: inside the session-path verification helper, after `verifySessionToken` returns null. Before attempting legacy verification, call `decodeTokenTypeUnverified` from Task 2 — if the token carries any recognized type claim, it is a new-format token that failed a real check, so return null immediately and never fall through. This is the "malformed new-format token must not silently become a legacy token" rule and it is what stops an attacker from stripping a signature to reach the weaker path.

The legacy result then goes through the same `assertLiveSessionVersion` as a modern token, so a version bump kills legacy tokens too (canonical §4.6, last line).

The refresh path never imports this module. Assert that in the test file with a static import check on `apps/web/src/app/api/auth/session/refresh/route.ts` source text, in addition to the behavioral case.
  </action>
  <verify>
    <automated>pnpm --filter @sync/web test -- src/services/auth/legacy-token.test.ts</automated>
  </verify>
  <done>Legacy tokens authenticate on the session path only, only while the deadline is in the future, and only when the stored session_version is 1; an unset deadline disables the path; a failed new-format token never reaches it.</done>
</task>

<task type="auto">
  <name>Task 6: Server-minted signed OAuth state and nonce</name>
  <files>apps/web/src/lib/oauth-state.ts, apps/web/src/services/auth/origin.ts, apps/web/src/app/api/auth/google/start/route.ts, apps/web/src/providers/AuthProvider.tsx, apps/web/src/__tests__/api/auth-google-start.test.ts</files>
  <action>
Implement requirement #71-M1-08 (canonical §4.3 step 1). Replace the browser-generated, browser-checked state with a server-minted signed one, and introduce the nonce that Task 7's id_token check binds against.

Extend `apps/web/src/lib/oauth-state.ts` rather than adding a second state module (repo reality note 6). Add `createLoginOAuthState({ nonceHash, redirect })` and `verifyLoginOAuthState(state)` built on `signPurposeToken`/`verifyPurposeToken` with the `oauth_state` purpose and a ten-minute lifetime; the payload carries the nonce hash, a flow discriminator whose only M1 value is the login flow, and the optional redirect. Leave the existing social-connect functions signing as they do — four live routes and two test suites depend on their current behavior — and add a comment recording that moving them onto the purpose key is deliberate follow-up work rather than an omission.

Extract the origin-resolution logic currently inlined at `apps/web/src/app/api/auth/callback/route.ts:42-64` into `apps/web/src/services/auth/origin.ts` unchanged in behavior, so the new start route and the callback build the identical `redirect_uri`. A byte-different redirect URI between authorize and exchange is the failure Google reports as `redirect_uri_mismatch`, so a single implementation is the point.

Create `POST /api/auth/google/start`. It generates 32 random bytes as the raw nonce (hex), computes its SHA-256 hex digest with `crypto.subtle.digest`, mints the state token carrying only the digest, sets the state token as an httpOnly cookie named `sync-oauth-state` (secure in production, sameSite lax, path `/`, ten-minute max age), and returns the Google authorize URL built server-side with client_id, the resolved redirect URI, response_type code, the openid/email/profile scopes, the state token, the raw nonce, and prompt select_account. The raw nonce leaves the server only inside that URL; it is never stored, never returned in the JSON body, and never logged. The cookie and the state parameter carry the same value — that is the double submit.

Change `signInWithGoogle` in `AuthProvider.tsx` to an async function that POSTs to the new route with `credentials: 'include'` and assigns `window.location.href` from the returned authorize URL. Delete the client-side state generation and both `sessionStorage` state accesses, including the comparison in the callback effect — the server is the only validator now. The callback effect keeps reading `state` from the query string and must now forward it in the POST body to `/api/auth/callback` alongside `code`. The context type for `signInWithGoogle` becomes `() => Promise<void>`; its two callers in the sign-in and sign-up pages invoke it without awaiting, which stays correct.

Write `auth-google-start.test.ts`: the route returns an authorize URL whose host is Google and whose state parameter equals the value set on the `sync-oauth-state` cookie; the URL carries a nonce parameter; the raw nonce does not appear anywhere in the JSON body; the state token verifies as the oauth_state purpose and its payload contains the SHA-256 of the nonce from the URL.
  </action>
  <verify>
    <automated>pnpm --filter @sync/web test -- src/__tests__/api/auth-google-start.test.ts</automated>
  </verify>
  <done>The authorize URL is built server-side with a signed state and a nonce; the state is also an httpOnly cookie; the client no longer generates or validates state; the raw nonce appears only in the authorize URL.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 7: Local Google id_token verification and callback hardening</name>
  <files>apps/web/src/services/auth/google-oidc.ts, apps/web/src/services/auth/google-oidc.test.ts, apps/web/src/services/auth/google.ts, apps/web/src/services/auth/index.ts, apps/web/src/app/api/auth/callback/route.ts, apps/web/src/__tests__/api/auth-callback.test.ts</files>
  <behavior>
    - A well-formed id_token signed by the mocked JWKS with the right issuer, audience, expiry, verified email and matching nonce verifies and yields the subject.
    - An issuer other than the two accepted Google issuers is rejected.
    - An audience other than the configured client id is rejected.
    - An expired id_token is rejected.
    - email_verified false is rejected.
    - A nonce whose digest does not equal the state's nonce hash is rejected.
    - A missing nonce claim is rejected.
    - The callback with a missing state parameter, a state that does not verify, an expired state, or a state unequal to the cookie mints no session.
    - The callback with a valid state but no id_token in the exchange response mints no session.
    - A successful callback still returns the canonical user profile shape and sets cookies.
  </behavior>
  <action>
Implement requirement #71-M1-07 (canonical §4.3 steps 2-4). The verified Google `sub` becomes the identity authority; `/v1/userinfo` drops to non-authoritative enrichment.

Create `apps/web/src/services/auth/google-oidc.ts` with a module-level `createRemoteJWKSet` over Google's JWKS URI (`https://www.googleapis.com/oauth2/v3/certs`) — module level so `jose` caches keys across requests instead of refetching per login. Export `verifyGoogleIdToken(idToken, { nonceHash })` which calls `jwtVerify` against that key set with the issuer set to both accepted Google issuer strings and the audience set to `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (repo reality note 4), then applies three checks the library does not: the `email_verified` claim is strictly `true`; a `nonce` claim exists; the SHA-256 hex digest of that nonce equals the supplied hash, compared with a constant-time comparison (reuse `apps/web/src/lib/secureCompare.ts`). Signature, issuer, audience and expiry come from `jwtVerify` itself. Return a small typed identity object (subject, email, emailVerified, given/family name, picture) or throw a typed error naming the failed check by category. Never log the id_token, the nonce, or any claim value.

Delete the dead tokeninfo-based verifier from `apps/web/src/services/auth/google.ts` (it fetches Google's HTTP introspection endpoint and checks only the audience) and remove its re-export from `apps/web/src/services/auth/index.ts`. Nothing else imports it. Also delete the now-unused browser state helpers in `google.ts` that Task 6 replaced, and the `buildGoogleAuthUrl`/`redirectToGoogleAuth` pair if nothing imports them after Task 6 — check before deleting; keep `exchangeCodeForTokens`, `getGoogleUserInfo`, `refreshAccessToken` and `GOOGLE_REDIRECT_PATH`.
<!-- planner-discipline-allow: tokeninfo -->

Rewrite the callback route body in this order, refusing before any side effect:
1. Read `code` and `state` from the JSON body. Missing either is a 400 with a stable error code.
2. Read the `sync-oauth-state` cookie. Missing is a 400. Compare it to the `state` parameter with the constant-time comparison; unequal is a 400. Verify the state as an `oauth_state` token; failure or expiry is a 400. Delete the cookie once consumed, on both the success and failure paths, so a state cannot be replayed.
3. Exchange the code (unchanged), then require `id_token` in the response; its absence is a 401.
4. Verify the id_token with the nonce hash from the state. Any failure is a 401 for verification categories and a 403 for the unverified-email case, with no session minted and no user row created or touched.
5. Use the verified subject as `externalSubject` in place of the userinfo `sub`, and the id_token email as the account email. Keep the `getGoogleUserInfo` call for profile enrichment only — picture and names — wrapped so that a failure degrades the profile rather than failing the login, and never let it override the subject or the email.
6. Mint the session and refresh tokens with the M1 assurance defaults and the freshly read `users.session_version` for `sv`. For the new-user branch, `createUser` returns the row including its default version. Pass the value explicitly; never default it to a literal at the call site.

Error responses stay generic to the client. Do not echo the id_token, the state, the nonce, or verification internals into the response body or the logs; the existing catch-all currently returns `error.message` in a `details` field — remove that for the authentication failures introduced here so a verification message cannot leak.

Extend `auth-callback.test.ts`: the existing regression cases must keep passing with the new required inputs (add a valid state and id_token to their fixtures), plus one case per behavior bullet. Mock `@/services/auth/google-oidc` for the callback-level cases and test the real verification logic in `google-oidc.test.ts` against a locally generated key pair served through a mocked `createRemoteJWKSet`.
  </action>
  <verify>
    <automated>pnpm --filter @sync/web test -- src/services/auth/google-oidc.test.ts src/__tests__/api/auth-callback.test.ts</automated>
  </verify>
  <done>Identity comes from a locally verified id_token bound to the state's nonce; bad issuer, audience, expiry, unverified email, nonce mismatch, and every state failure each mint no session; the HTTP-introspection verifier is gone; a valid login still returns the canonical profile.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 8: Refresh rotation, assurance re-check, and client compatibility</name>
  <files>apps/web/src/app/api/auth/session/refresh/route.ts, apps/web/src/__tests__/api/auth-refresh.test.ts</files>
  <behavior>
    - A valid refresh token whose sv matches mints a new session and a new refresh token, both stamped with the same sv.
    - A session token presented to the refresh endpoint is refused.
    - A refresh token whose sv is stale is refused with 401 and cookies cleared.
    - The rotated refresh token differs from the presented one and carries the same amr and asr.
    - The minted session preserves the presented token's amr and asr rather than resetting them.
    - A refresh token whose asr ranks below the account's required assurance is refused with an MFA_REQUIRED code (a no-op today, since every account requires sf).
    - The refresh token is accepted from the cookie, from a JSON body field, or from a bearer header.
    - The response carries both the existing accessToken field and a sessionToken alias.
  </behavior>
  <action>
Implement requirements #71-M1-05 and #71-M1-10 (canonical §4.5, §6.4c cases 10-12).

Rewrite `/api/auth/session/refresh` to verify the presented token with `verifyRefreshToken`, which now accepts only the refresh purpose — a session token can no longer be replayed here, which is half of closing the audited interchangeability defect.

Order of checks after verification: load the user; compare the token's `sv` to the stored `session_version` and refuse with 401 plus cleared cookies on mismatch; call `getRequiredAssurance(userId)` and refuse with 401 and an `MFA_REQUIRED` code when the token's `asr` ranks below it. The assurance comparison is the §4.5 refresh-bypass fix. In M1 it can never fire because every account requires single-factor assurance; implement it anyway and say so in a comment, because M2 changes only the body of `getRequiredAssurance`, not this route.

Mint a fresh session and a fresh refresh token, both carrying the stored `sv` and the presented token's `amr` and `asr` — the refresh path never upgrades assurance and never invents claims the presented token did not have.

Record explicitly in the route header comment that rotation here is not refresh-token reuse detection: there is no durable record of issued refresh tokens, so a stolen-and-replayed old token is not detectable, and the revocation guarantee rests entirely on `session_version` plus the one-hour session lifetime. Canonical §17 defers reuse detection deliberately; do not imply the code provides it.

Client compatibility (repo reality note 3): accept the refresh token from the `sync-refresh` cookie as today, and additionally from a `refreshToken` field in a JSON body or an `Authorization: Bearer` header, because the mobile store posts it in the body and has no cookie jar. Read the body defensively — the web client sends no body at all. Include `sessionToken` in the response alongside the existing `accessToken` (same value) so the mobile store's assignment stops writing undefined. Set `expiresAt` from the actual one-hour session TTL constant instead of the hardcoded seven-day expression currently in the response.

Do not attempt to fix mobile's deep-link login in this task; it is out of M1 scope. Report it in the summary instead.

Extend `auth-refresh.test.ts` with one case per behavior bullet, keeping the existing canonical-profile-shape regression case green.
  </action>
  <verify>
    <automated>pnpm --filter @sync/web test -- src/__tests__/api/auth-refresh.test.ts</automated>
  </verify>
  <done>Only refresh-purpose tokens are accepted; stale sv and insufficient assurance both refuse; rotation issues a different token preserving amr/asr; the endpoint reads the token from cookie, body, or bearer header and answers with both field names.</done>
</task>

<task type="auto">
  <name>Task 9: Invariant guard tests and full-suite regression</name>
  <files>apps/web/src/services/auth/mint-path-guard.test.ts, apps/web/src/lib/supabase/user-token.test.ts</files>
  <action>
Close requirement #71-M1-11 with the two structural guards the canonical §16b calls for, then prove nothing else regressed.

Create `mint-path-guard.test.ts`. Reading the source tree from disk (not by importing the modules), assert that no file outside `apps/web/src/services/auth/` imports the token-signing module from Task 2, so the only way to obtain a session or refresh token is through the mint functions in `session.ts`. Allow the auth directory's own files and test files. This is the guard that keeps every future MFA milestone from growing a second, unchecked mint path.

Extend `apps/web/src/lib/supabase/user-token.test.ts` with an assurance-claims guard: mint a Supabase transport token, decode it, and assert its claim set is exactly the documented six (issuer, subject, role, audience, issued-at, expiry) — in particular that no assurance or method claim appears. Assert the same by reading `user-token.ts` source and confirming the assurance claim names are absent from it. Canonical §4.7 makes this a standing invariant: assurance is an application concern and the database never sees it.
<!-- planner-discipline-allow: amr -->
<!-- planner-discipline-allow: asr -->

Then run the whole web suite and the type checker, and fix fallout in existing tests that mocked the old session API — `auth-session.test.ts` and `integration/auth.test.ts` are the likely ones, since the session module's exports changed shape. Fix them by updating the mocks to the new signatures, never by weakening an assertion or skipping a case.

Finally, confirm the three regression behaviors by inspection of the passing suite: login mints cookies, an authenticated API route still resolves a session through `getSessionFromRequest`, and the sign-out DELETE still clears cookies. If any of the three lacks coverage after the earlier tasks, add the missing case here rather than leaving it to the manual check.
  </action>
  <verify>
    <automated>pnpm --filter @sync/web test &amp;&amp; pnpm --filter @sync/web typecheck</automated>
  </verify>
  <done>The full web vitest suite and typecheck both pass; no module outside `services/auth/` imports the signing primitive; the Supabase transport token carries no assurance claims.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /api/auth/google/start | Unauthenticated caller obtains a signed state and an authorize URL |
| Google → browser → /api/auth/callback | Attacker-controllable `code` and `state` values cross into token exchange |
| Google JWKS → server | Remote key material used to decide identity |
| browser/mobile → every authenticated route | Bearer or cookie token crosses into `getSessionFromRequest` |
| browser → /api/auth/session/refresh | Long-lived credential crosses into a mint operation |
| server → Supabase (service role) | Per-request `session_version` read; RLS transport token minting |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-M1-01 | Spoofing | session/refresh token interchangeability (`session.ts` mint+verify) | critical | mitigate | Task 2: distinct HKDF key per purpose plus exact type-claim match; Task 4/8 verify each path against its own purpose only; six-way cross-purpose matrix test |
| T-M1-02 | Elevation of privilege | `/api/auth/callback` identity source | critical | mitigate | Task 7: identity is the `sub` of a locally JWKS-verified id_token with issuer, audience, expiry, `email_verified` and nonce checks; userinfo demoted to enrichment that cannot override subject or email |
| T-M1-03 | Tampering | OAuth `state` (login CSRF / code injection) | high | mitigate | Task 6: server-minted `oauth_state.v1` token, httpOnly double-submit cookie, 10-minute lifetime, constant-time comparison, single-use via cookie deletion |
| T-M1-04 | Spoofing | id_token replay from another login attempt | high | mitigate | Task 6/7: raw nonce only in the authorize URL, its SHA-256 bound into the signed state, digest compared constant-time at verification |
| T-M1-05 | Elevation of privilege | revoked session still accepted | high | mitigate | Task 3/4: `session_version` stamped at mint and re-read by primary key on every authenticated request; mismatch returns null and clears cookies; no cache |
| T-M1-06 | Spoofing | legacy-window downgrade (strip signature to reach the weak path) | high | mitigate | Task 5: legacy attempted only after a null modern verify AND only when the token carries no recognized type claim; session path only; deadline enforced; fail-closed when unset |
| T-M1-07 | Elevation of privilege | refresh re-mints assurance the account no longer permits | high | mitigate | Task 8: `getRequiredAssurance` re-derived per call and compared before mint; presented `amr`/`asr` copied, never upgraded |
| T-M1-08 | Information disclosure | secrets or credentials in logs | high | mitigate | Tasks 1-8: no module logs tokens, claims, state, nonce, id_token, or key material; the callback stops echoing exception messages in its response body |
| T-M1-09 | Elevation of privilege | weak key from a missing secret | high | mitigate | Task 1: `AUTH_MASTER_KEY` absent, empty, or under 32 chars throws; no `JWT_SECRET` fallback, no development relaxation |
| T-M1-10 | Elevation of privilege | a second, unchecked token mint path added later | medium | mitigate | Task 9: source-level guard test forbids importing the signing primitive outside `services/auth/` |
| T-M1-11 | Information disclosure | assurance claims leaking into the database transport token | medium | mitigate | Task 9: claim-set assertion plus source assertion on `user-token.ts` (canonical §4.7) |
| T-M1-12 | Denial of service | one extra database read per authenticated request | low | accept | Canonical §4.4 weighs this explicitly: a primary-key read on a table every authenticated route already queries; caching is forbidden because it would relax the revocation guarantee |
| T-M1-13 | Repudiation | no audit trail for authentication events | low | accept | `security_events` is M2 (canonical §5.5, WS-H); M1 deliberately adds no logging table |
| T-M1-14 | Spoofing | stolen refresh token replayed after rotation | medium | accept | Canonical §17 defers reuse detection: no durable issued-token store exists. Bounded by `session_version` revocation and the 1h session TTL; Task 8 documents the limit rather than implying detection |
| T-M1-SC | Tampering | dependency supply chain | low | accept | Zero new packages: `jose` is already a declared dependency and HKDF comes from the platform's Web Crypto. No package-manager install task exists in this plan, so no legitimacy audit is required |
</threat_model>

<source_coverage_audit>
Every INCLUDE item from the M1 scope, mapped to the task that delivers it. No item is deferred, simplified, or reduced.

| # | Scope item | Covered by | Status |
|---|---|---|---|
| 1 | Migration `20260901000001_session_version`, written not applied | Task 3 | COVERED |
| 2 | `AUTH_MASTER_KEY` + HKDF per-purpose keys, kid v1 | Task 1 | COVERED |
| 3 | Purpose-typed JWTs, exact typ verification, non-interchangeable | Task 2 (+4, 6) | COVERED |
| 4 | Session claims userId/googleId/email/sv/amr/asr, 1h TTL | Task 4 | COVERED |
| 5 | Refresh: own key, 30d, rotation, assurance re-check, no reuse-detection claim | Task 8 | COVERED |
| 6 | Central Model B `session_version` check | Task 4 (read helper in Task 3) | COVERED |
| 7 | Google OIDC hardening via JWKS; dead introspection verifier deleted | Task 7 | COVERED |
| 8 | Server-minted signed state + nonce replacing sessionStorage | Task 6 | COVERED |
| 9 | Bounded legacy window, session path only, no silent fallthrough | Task 5 | COVERED |
| 10 | Web/mobile compat strictly necessary for M1 | Task 6 (web), Task 8 (mobile refresh) | COVERED |
| 11 | Tests per canonical §16b for all of the above | Tasks 2,4,5,6,7,8,9 | COVERED |

EXCLUDED per scope and absent from this plan: `user_mfa_factors`, TOTP, QR, recovery codes, `mfa_pending_tokens`, login challenge, `security_score`, `displayed_trust_score`, security settings UI, reauth tickets, operator reset, MFA emails, MFA rate limits, MFA enforcement, `security_settings`, and the HKDF purposes `mfa_pending`, `reauth` and `mfa_secret_enc`.

One M2 seam is created deliberately and is not scope creep: `assurance.ts` exists in M1 with `getRequiredAssurance` returning single-factor unconditionally, because §4.5's refresh rule needs the comparison primitive now. It reads no MFA table and declares no MFA type.
</source_coverage_audit>

<verification>
Automated, all from the repository root:

1. `pnpm --filter @sync/web test` — the full web suite, including every new file.
2. `pnpm --filter @sync/web typecheck` — no type errors after the session and refresh signature changes.
3. `pnpm --filter @sync/web lint`.
4. Migration inertness: `supabase/migrations/20260901000001_session_version.sql` exists and no `supabase` CLI or MCP apply command appears in the session's command history.

Canonical §15 acceptance items covered by the suite: token matrix (Task 2), revocation immediacy for request, refresh, and legacy token (Tasks 4, 5, 8), OIDC negatives (Task 7), state negatives (Tasks 6, 7), unchanged end-to-end login (Task 7 regression cases).

Manual check before any deploy, which the suite cannot perform:
- Set `AUTH_MASTER_KEY` and `AUTH_LEGACY_UNTIL` locally, run the app, and complete a real Google sign-in end to end; confirm the browser holds `sync-session` and `sync-refresh`, that a page requiring authentication loads, and that sign-out clears both cookies.
- Confirm with a token minted before the change that the legacy window accepts it, and that setting `AUTH_LEGACY_UNTIL` to a past instant rejects it.

Deployment ordering, to record in the summary and not to execute here: `AUTH_MASTER_KEY` and `AUTH_LEGACY_UNTIL` must exist as Worker secrets before the app deploy, and the migration is applied separately per the house procedure (app first, ledger snapshot, single verbatim apply, ledger-delta verification). Nothing in this plan applies it.
</verification>

<success_criteria>
- Session and refresh tokens are signed with different HKDF-derived keys, carry distinct type claims, and fail verification for each other in both directions.
- Every authenticated request re-reads `users.session_version` and refuses a token stamped with an older value, with no cache anywhere in the path.
- Google identity comes from a locally verified id_token whose nonce is bound to a server-minted, cookie-double-submitted state; the HTTP-introspection verifier no longer exists in the tree.
- Pre-M1 tokens keep working on the session path until a configured deadline, are subject to the same revocation check, and cannot be used to refresh.
- Refresh rotates and re-checks required assurance before minting, and its documentation claims no reuse detection.
- A missing `AUTH_MASTER_KEY` fails loudly; no weak default exists in any environment.
- No MFA table, column, endpoint, flag, or HKDF purpose from M2 appears anywhere in the diff.
- `pnpm --filter @sync/web test` and `pnpm --filter @sync/web typecheck` both pass; migration `20260901000001` exists on disk and has been applied to nothing.
</success_criteria>

<output>
Create `.planning/quick/260812-jei-m1-auth-kernel-purpose-typed-jwts-sessio/260812-jei-SUMMARY.md` when done.

The summary must record: the operator actions required before deploy (both new environment variables, and the separate migration application), the mobile deep-link login gap found during Task 8 and left unfixed, and the explicit statement that refresh rotation is not reuse detection.
</output>
