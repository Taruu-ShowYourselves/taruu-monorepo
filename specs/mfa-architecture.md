# Issue #71 — Authenticator 2FA & Identity/Security Architecture (Canonical)

Status: REVISION 2 — review points resolved; ready to be marked CANONICAL v1
Supersedes all prior Issue #71 planning fragments.
Grounded in: `origin/main` @248c2c1 · draft PR #110 @75dc346 · live prod DB (audit 2026-08-12). **Update 2026-08-16:** PR #110 is now MERGED to main (squash `bc7defe`); the M1 branch is rebased onto it. Migration `20260807000001` is present on main but NOT yet applied to production.
Suggested repo destination once approved: `specs/mfa-architecture.md`

---

## 1. Executive summary

Issue #71 adds interoperable authenticator-app TOTP to a platform whose entire MFA surface is currently greenfield. The audit found zero MFA code, zero MFA tables, and — decisively — that Supabase Auth is disabled (`supabase/config.toml` `[auth] enabled = false`), so Supabase's native MFA/AAL stack is unreachable. All MFA behavior specified here is custom application infrastructure built on the existing custom Google-OIDC + `jose`-JWT session system.

The design has four pillars:

1. **Auth kernel hardening (prerequisite):** purpose-typed JWTs with HKDF-derived per-purpose keys, a `session_version` revocation column checked in the central authenticated-request path (effectively-immediate revocation, §4.4), server-verified OAuth state + nonce, local Google id_token verification via JWKS, and a refresh path that can never re-mint assurance the account no longer permits.
2. **MFA persistence + TOTP lifecycle:** five new tables (`user_mfa_factors`, `user_recovery_codes`, `security_events`, `reauth_tickets`, `mfa_pending_tokens`) plus a `security_settings` singleton, following the repo's proven append-only and service-role-only patterns.
3. **Login challenge state machine:** an MFA-pending interstitial between verified Google identity and full session issuance; the DB pending row is the sole authority; no authenticated application session exists while the challenge is unsatisfied.
4. **Three-score model (approved invariant):** `identity_score` (max 140, eligibility), `security_score` (max 20, formula locked in §10.2), `displayed_trust_score` = derived sum (max 160, display only). MFA never increases voting eligibility.

Everything ships dark behind three default-OFF controls; production behavior changes only at explicit, runbook-driven flips (Milestone M8). The enforcement flip is additionally gated on first-party-client challenge coverage (§12, §16).

Hard dependency: PR #110 ("PR-A", identity-score unification) must land and its migration `20260807000001` must be applied before any scoring work here stacks on it (§13).

---

## 2. Current-state constraints (verified)

| Fact | Evidence |
|---|---|
| Supabase Auth disabled; `auth.uid()` always NULL | `supabase/config.toml:19`; comment in `supabase/migrations/20260802000001_rls_transport.sql` |
| `public.users` has no FK to `auth.users`; independent `uuid_generate_v4()` PK | `supabase/migrations/20240101000000_initial_schema.sql:24-25` |
| Login = custom Google OIDC authorization-code flow; identity read from `/v1/userinfo`, id_token unused | `apps/web/src/services/auth/google.ts:44,88,164`; `apps/web/src/app/api/auth/callback/route.ts:66-99` |
| Session = HS256 JWT (`jose`), symmetric `JWT_SECRET`, cookie `sync-session`, default 7d | `apps/web/src/services/auth/session.ts:13-15,85,164` |
| Refresh = 30d HS256 JWT, same secret, cookie `sync-refresh`, no `typ`, interchangeable with session token | `session.ts:16,103,143`; `apps/web/src/app/api/auth/session/refresh/route.ts:36-67` |
| OAuth `state` client-side only; callback never validates it; no nonce | `google.ts:58-83`; `callback/route.ts:69`; proper signed-state precedent at `apps/web/src/lib/oauth-state.ts:14,28` |
| No auth middleware; 172 per-route `requireAuth()` sites — a single central chokepoint in `services/auth/session.ts` | `apps/web/src/middleware.ts:27`; `session.ts:228` |
| ES256/JWKS subsystem exists but only to publish keys for Supabase RLS transport | `apps/web/src/lib/supabase/signing-key.ts:24,76`; `apps/web/src/app/api/jwks/route.ts`; `apps/web/src/lib/supabase/user-token.ts:20,70-73` |
| No MFA tables; no session table; `20260807000001` present on main (PR #110 merged) but unapplied to prod (prod ledger 2026-08-16 has no `20260807000001` row) | live `list_migrations` |
| Append-only house pattern (BEFORE trigger + REVOKE, never RLS-only) proven 3× | `role_grant_events` (20260802000002:135,176), `space_audit_log` (20260802000010:137-174), `pilot_audit_log` (20260811000004:205-218) |
| Operator model = `role_grants` + `requireRole`/`requirePilotAdmin` + `users.is_platform_admin` | `20260802000002:33-51`; `apps/web/src/server/app/authz/require-role.ts:47-63`; `apps/web/src/server/app/pilot/authorize.ts:20-36` |
| Rate-limit substrate exists; Upstash unconfigured in prod → in-memory fallback only; no auth endpoint limited | `apps/web/src/lib/rate-limit.ts:31,139,257-308` |
| Durable DB-counter precedent | `phone_verifications.send_attempts`, `apps/web/src/app/api/user/phone/send-code/route.ts:121-163` |
| Hashed-code single-use precedent (SHA-256, MAX_ATTEMPTS=5, `safeEqual`) | `apps/web/src/services/sms/otp.ts:17,74,115-127` |
| AES-GCM precedent | `packages/shared/src/utils/did.ts:103-149` |
| `qrcode.react@4.2.0` declared, unused | `apps/web/package.json:61` |
| Resend mailer live, `noreply@taruu.co.il` | `apps/web/src/services/email/index.ts:11-68` |
| Flag convention: per-flag env module, currently default-ON | `apps/web/src/lib/features/space-admin.ts:7` |
| Identity-score UI hardcodes `/100` and %-width | `apps/web/src/app/[locale]/settings/social-connections/page.tsx:188,193` |
| Mobile app shares this auth API (no separate login path) | `apps/mobile/src/stores/authStore.ts` |

Design consequence: **do not design around `supabase.auth.mfa.*`** — it cannot work here. Everything below is custom.

---

## 3. Final architecture (overview)

```
Google OIDC ──▶ /api/auth/callback
   │  verify id_token (JWKS, iss, aud, exp, email_verified, nonce)
   │  verify signed server-side state (cookie + param)
   ▼
account requires MFA?  ──no──▶ mint session (asr=sf, amr=[google]) + refresh
   │ yes (active factor AND enforcement live)
   ▼
mint mfa_pending token (DB row = authority + cookie, 5 min, single-use)   ← NO session exists
   ▼
/sign-in/challenge  ──TOTP or recovery code──▶ verify (rate-limited, replay-guarded, atomic consume)
   ▼
mint session (asr=mf, amr=[google,totp] or [google,recovery]) + refresh
```

All tokens are purpose-typed JWTs signed with HKDF-derived per-purpose keys. `session_version` gives effectively-immediate global revocation (checked in the central `requireAuth` path, §4.4). `security_events` records every security-relevant transition, append-only. Scores are DB-owned; `security_score` is recomputed by trigger; `displayed_trust_score` is derived in shared code and never stored.

---

## 4. Token & session model (WS-A)

### 4.1 Key derivation

Single high-entropy secret `AUTH_MASTER_KEY` (≥32 bytes, new env var; `JWT_SECRET` retained only for the legacy-acceptance window). Per-purpose signing keys via HKDF-SHA256:

```
key(purpose) = HKDF-SHA256(ikm = AUTH_MASTER_KEY, salt = "taruu-auth-v1", info = purpose, len = 32)
purposes: "session" | "refresh" | "mfa_pending" | "reauth" | "oauth_state" | "mfa_secret_enc"
```

`mfa_secret_enc` derives the AES-256-GCM key for TOTP secret encryption (§6.1) — key separation between signing and encryption for free. A `key_version` (int, starts 1) is stamped into encrypted blobs and token headers (`kid: "v1"`) to allow future rotation.

### 4.2 Token catalog

| Token | `typ` claim | Signed with | TTL | Transport | Claims (beyond `sub`,`iat`,`exp`,`jti`) |
|---|---|---|---|---|---|
| Session | `session.v1` | key("session") HS256 | **1h** (was 7d — see note) | httpOnly cookie `sync-session` | `userId`, `googleId`, `email`, `sv`, `amr` (array), `asr` (`sf`\|`mf`) |
| Refresh | `refresh.v1` | key("refresh") HS256 | 30d, rotated on use | httpOnly cookie `sync-refresh` | `userId`, `sv`, `asr`, `amr` |
| MFA pending | `mfa_pending.v1` | key("mfa_pending") HS256 | 5 min | httpOnly cookie `sync-mfa-pending` | `userId`, `jti` = `mfa_pending_tokens.id`. **Locator only — the DB row is the authority (§6.4a)** |
| Reauth ticket | `reauth.v1` | key("reauth") HS256 | 5 min, single-use | response body → `X-Reauth-Ticket` header on the guarded call | `userId`, `jti` = `reauth_tickets.id`, `purpose`. DB row is the authority |
| OAuth state | `oauth_state.v1` | key("oauth_state") HS256 | 10 min | `state` query param + httpOnly cookie `sync-oauth-state` (double submit) | `nonce_hash`, `flow` (`login`\|`reauth`), `redirect` |

Verification always requires: exact `typ` match, correct purpose key, `exp`, and — for session and refresh tokens — the live `sv` check of §4.4. A session token can never pass refresh verification or vice versa — this closes the audited interchangeability defect (`session.ts:103,143`).

**Session TTL note:** sessions shorten 7d → 1h with silent refresh via the rotated 30d refresh token. With Model B revocation (§4.4) the TTL is **not** load-bearing for revocation — it exists to bound token-replay exposure and keep refresh rotation exercised. If a client is later found unable to refresh silently, the TTL may be lengthened without weakening revocation. Verifying that `apps/mobile`'s auth store handles silent refresh is a WS-A acceptance item (§15), not an open design question.

### 4.3 Google OIDC verification (replaces userinfo-only trust)

`/api/auth/callback` changes:

1. Validate `state`: param must verify as `oauth_state.v1` AND equal the `sync-oauth-state` cookie value (CSRF double submit). Server-side generation replaces the sessionStorage logic at `google.ts:58-83` / `AuthProvider.tsx:101,176`; the signed-JWT-state pattern already exists at `lib/oauth-state.ts` and is generalized, not duplicated.
2. Exchange code; take `id_token` from the token response.
3. Verify id_token **locally** with `jose` `createRemoteJWKSet("https://www.googleapis.com/oauth2/v3/certs")`: signature, `iss ∈ {https://accounts.google.com, accounts.google.com}`, `aud = GOOGLE_CLIENT_ID`, `exp`, `email_verified === true`, and `nonce` — the id_token nonce must hash to the `nonce_hash` carried in the state token (raw nonce goes only to Google in the authorize URL).
4. The existing tokeninfo-HTTP `verifyIdToken()` (`google.ts:220-241`, aud-only, dead code) is deleted. `/v1/userinfo` may remain for profile enrichment but is no longer the identity authority.

### 4.4 `session_version` & revocation semantics — Model B (decided)

New column `users.session_version INTEGER NOT NULL DEFAULT 1` (migration M1). Stamped as `sv` into session and refresh tokens at mint.

**Model choice.** Two models were compared:

- *Model A* — `sv` checked at refresh + on security-sensitive endpoints only; an already-issued ordinary session survives up to its TTL (≤1h). Revocation is therefore *bounded*, not immediate.
- *Model B* — `sv` checked inside the central authenticated-request path; revocation effectively immediate; costs one DB lookup per authenticated request.

**Decision: Model B.** Repository-backed reasons: (a) there is no auth middleware, but all 172 authenticated routes already funnel through `requireAuth`/`getSessionFromRequest` in `services/auth/session.ts` — a single chokepoint, so the check is one code change, not 172; (b) the check is a primary-key lookup (`SELECT session_version FROM users WHERE id = $1`) and nearly every authenticated route already performs at least one DB query for its own work, so the marginal cost is a cheap indexed read; (c) current scale makes the cost trivial, and at any future scale a PK lookup remains the cheapest query the app runs. **No cache initially.** If a per-instance cache is ever added, it must be documented as relaxing the guarantee from "immediate" to "≤ cache TTL", and security-sensitive endpoints must remain uncached.

**The precise guarantee:** once a `session_version` bump commits, every subsequent authenticated request presenting a token with the old `sv` fails 401 and clears cookies. Revocation is effectively immediate, bounded only by requests already in flight at commit time. (This document never claims stronger than that.)

**Behavior after each revocation event** — all bump `session_version` by 1 and write `session_version_revoked`:

| Event | Effect |
|---|---|
| User disables MFA (§6.3) | All the user's sessions and refresh tokens are rejected from the next request onward. The disabling request itself re-mints the caller a fresh `sf ["google"]` session with the new `sv` in the same response. |
| Operator resets MFA (§7.3) | All the **target's** sessions and refresh tokens rejected from the next request onward. Target must log in again (and lands in case-1 login — no factor). |
| Sign-out-everywhere | All sessions/refresh rejected from next request; caller included (they are signing out). |
| Any future account security reset | Same semantics: bump + event; no exceptions. |

Legacy-window interplay: legacy tokens (§4.6) are mapped to `sv = 1`, so any bump also kills every legacy token for that user immediately.

### 4.5 Assurance representation (`amr`/`asr`) — replaces Supabase AAL

Supabase's literal `aal1/aal2` is not reused. Two claims:

- `amr`: ordered method list. Values: `google`, `totp`, `recovery`. Examples: `["google"]`, `["google","totp"]`, `["google","recovery"]`.
- `asr` (assurance): `sf` (single factor) or `mf` (multi factor). Derived at mint: `mf` iff `amr` contains `totp` or `recovery`.

**Account-required assurance** is a DB-derivable fact, not a token fact:

```
required_asr(user) = 'mf'  iff EXISTS (user_mfa_factors WHERE user_id AND status='active')
                            AND security_settings.mfa_enforcement_enabled
                     else 'sf'
```

Rules:

- Session mint (login or refresh) must satisfy `token.asr >= required_asr(user)` — otherwise the mint is refused and the caller gets `MFA_REQUIRED`.
- **Refresh-bypass fix (audited defect):** `/api/auth/session/refresh` re-derives `required_asr` from the DB on every call. An `sf` refresh token for an account that now requires `mf` cannot re-mint a session; response is 401 `MFA_REQUIRED` and the client restarts login. (The `sv` bump at disable/reset already invalidates old tokens; this rule is defense in depth and also covers the enforcement flip, which does not bump versions.)
- Recovery-code login yields `asr=mf` with `amr=["google","recovery"]` — semantics and consequences in §6.2a.
- Reauthentication (§7) is *not* an `asr` level — it is a separate short-lived, purpose-bound ticket. Sessions never carry "recently reauthed" state.

The four states distinguish as: Google-only = `sf ["google"]`; Google+TOTP = `mf ["google","totp"]`; recovery login = `mf ["google","recovery"]`; reauthentication = no session change, a consumed `reauth_tickets` row + ticket.

### 4.6 Legacy-token migration window

Current tokens have no `typ`/`sv`/`amr`. For 7 days after the M1 deploy, session verification accepts legacy `JWT_SECRET` HS256 tokens as `{asr:'sf', amr:['google'], sv:1}` — and they pass through the same Model B `sv` check, so revocation applies to them too. The refresh endpoint always emits new-format tokens. After the window, legacy acceptance is deleted. Avoids logging out every user at deploy.

### 4.7 Non-goals for the Supabase RLS token

`lib/supabase/user-token.ts:20` documents "nothing but iss/sub/role/aud/iat/exp is claimed". That stays true: **no `asr`/`amr` claims on the RLS transport token.** Assurance is an application concern enforced in route handlers; RLS never needs it.

---

## 5. Database schema (WS-C foundation)

All tables: `RLS ENABLE` with **no policies** (service-role-only house pattern, cf. `newsletter_subscribers`), `REVOKE ALL FROM anon, authenticated`, all access through server routes guarded by `requireAuth`/`requireReauth`/`requireRole`. Timestamps `timestamptz NOT NULL DEFAULT now()` unless noted. Migration ownership per §14.

### 5.1 `user_mfa_factors`

Purpose: TOTP factor per user; encrypted secret at rest; replay anchor.

| Column | Type / constraint |
|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` |
| `user_id` | `uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `factor_type` | `text NOT NULL CHECK (factor_type = 'totp')` |
| `status` | `text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','disabled'))` |
| `secret_enc` | `bytea NOT NULL` — AES-256-GCM: `iv(12) ‖ ciphertext ‖ tag(16)`; AAD = `user_id ‖ id` |
| `enc_key_version` | `smallint NOT NULL DEFAULT 1` |
| `last_accepted_step` | `bigint` — highest accepted TOTP time-step; monotonic replay guard (§6.4b) |
| `confirm_attempts` | `smallint NOT NULL DEFAULT 0` |
| `created_at` / `confirmed_at` / `disabled_at` / `last_used_at` | timestamps; `confirmed_at` set exactly once |
| `disabled_reason` | `text CHECK (disabled_reason IN ('user','operator_reset'))`, NULL while not disabled |

Uniqueness/indexes: `UNIQUE (user_id) WHERE status = 'active'` (one live factor); `UNIQUE (user_id) WHERE status = 'pending'` (one in-flight enrollment; new enrollment deletes prior pending); `idx_user_mfa_factors_user_id`.
Lifecycle: `pending` →(confirm)→ `active` →(disable/reset)→ `disabled` (row retained for audit). Cleanup: `pending` rows older than 15 min deleted opportunistically at next enrollment (no cron dependency).
Invariant: plaintext secret exists only in server memory during enroll/verify; never logged, never in API responses after the enrollment-start response.

### 5.2 `user_recovery_codes`

| Column | Type / constraint |
|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` |
| `user_id` | `uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `batch_id` | `uuid NOT NULL` |
| `code_hash` | `text NOT NULL` — SHA-256 hex of normalized code (mold: `otp.ts:74`) |
| `used_at` | `timestamptz` NULL |
| `created_at` | timestamp |

`UNIQUE (user_id, code_hash)`; `idx_recovery_codes_user_live ON (user_id) WHERE used_at IS NULL`.
Consumption is atomic single-statement: `UPDATE … SET used_at = now() WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL RETURNING id` — the conditional row update means exactly one concurrent consumer can win; double-spend is impossible.
Regeneration: one transaction — delete all rows of previous batch (history lives in `security_events`), insert new batch, emit `recovery_codes_regenerated`.

### 5.3 `mfa_pending_tokens`

Purpose: **the authoritative server-side state** for the login challenge; replay prevention; durable attempt counting. The `mfa_pending.v1` JWT is only a signed locator for a row here (§6.4a).

| Column | Type / constraint |
|---|---|
| `id` | `uuid PK` — equals the JWT `jti` |
| `user_id` | `uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `expires_at` | `timestamptz NOT NULL` (mint + 5 min) |
| `consumed_at` | `timestamptz` NULL |
| `attempt_count` | `smallint NOT NULL DEFAULT 0` |
| `ip_hash` / `user_agent` | text (hashed IP; UA truncated 256) |
| `created_at` | timestamp |

`idx_mfa_pending_user ON (user_id, created_at)`. Cleanup: rows past `expires_at + 24h` deleted opportunistically at next mint (kept briefly for abuse forensics).

### 5.4 `reauth_tickets`

| Column | Type / constraint |
|---|---|
| `id` | `uuid PK` — JWT `jti` |
| `user_id` | `uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `purpose` | `text NOT NULL CHECK (purpose IN ('mfa_disable','recovery_regenerate','operator_reset','security_settings'))` |
| `method` | `text NOT NULL CHECK (method IN ('totp','recovery','google'))` |
| `expires_at` | `timestamptz NOT NULL` (mint + 5 min) |
| `consumed_at` | `timestamptz` NULL |
| `created_at` | timestamp |

`idx_reauth_user ON (user_id, created_at)`. Atomic consume (same conditional-UPDATE pattern as §5.2); DB row is the authority over the JWT; cleanup as §5.3. Permissible `method` per action is defined by the policy matrix in §7.2 and derived server-side.

### 5.5 `security_events`

| Column | Type / constraint |
|---|---|
| `id` | `bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY` |
| `user_id` | `uuid` NULL, **no FK** — log outlives its subject (mold: `role_grant_events`) |
| `actor_user_id` | `uuid` NULL — operator for admin actions; NULL = self |
| `event_type` | `text NOT NULL CHECK (…taxonomy §8…)` |
| `ip_hash` / `user_agent` | text NULL |
| `reason` | `text` NULL; for `mfa_reset_by_operator` enforced length 10–2000 via CHECK (mold: `space_audit_log.reason`) |
| `metadata` | `jsonb NOT NULL DEFAULT '{}'` — whitelisted keys (§8.2) |
| `created_at` | timestamp |

Append-only, exactly the `space_audit_log` mold (20260802000010:137-174): `BEFORE UPDATE OR DELETE` FOR EACH ROW trigger raising, `BEFORE TRUNCATE` FOR EACH STATEMENT trigger, **plus** `REVOKE UPDATE, DELETE, TRUNCATE FROM anon, authenticated, service_role`. Not RLS-only — service role bypasses RLS. Tamper-resistant, not WORM.
Indexes: `idx_security_events_user_type_time ON (user_id, event_type, created_at DESC)` (doubles as the rate-limit window index, §9); `idx_security_events_actor ON (actor_user_id, created_at DESC) WHERE actor_user_id IS NOT NULL`.
Retention: **indefinite (decided).** Security events are append-only audit evidence; no legal/product requirement in the repository mandates deletion (nearest precedent, `identity_document_events`, mandates a ≥24-month *minimum*, not a maximum). Any future retention change happens through a separate explicit policy decision + its own migration — never as a side effect of other work.

### 5.6 `security_settings` (singleton) — THE single source of truth for global MFA enforcement

There is exactly **one** global enforcement authority: `security_settings.mfa_enforcement_enabled`. **No `MFA_ENFORCEMENT_ENABLED` environment variable exists anywhere in this design.** (Earlier drafts implied both; that ambiguity is resolved here.)

Why a DB field rather than the env feature-flag convention — concrete, repository-backed reasons:

1. `security_score` is DB-owned by approved invariant (§10), computed by a `SECURITY DEFINER` trigger in Postgres (PR-A's exact pattern). A Postgres trigger cannot read a Next.js process env var; if enforcement lived in env, the score formula could not include it and would silently diverge from login behavior.
2. The enforcement flip must be **transactional with the score recompute** (§16 M8 step 4): one `UPDATE security_settings` + one recompute statement, atomically. An env flip is a redeploy with no transaction semantics.
3. Env flags are per-deploy-instance; the DB value is one value for every consumer (web deploy, future workers, SQL itself) — no drift window during rollouts.

| Column | Type / constraint |
|---|---|
| `id` | `boolean PK DEFAULT true CHECK (id)` — one-row table |
| `mfa_enforcement_enabled` | `boolean NOT NULL DEFAULT false` |
| `updated_at` | timestamp |

Seeded `false` in the migration. Service-role writable only. Application access keeps feature-flag ergonomics: `lib/features/mfa-enforcement.ts` exports `isMfaEnforcementEnabled()` which reads the singleton server-side (per-request; a within-request memo is fine, a cross-request cache is not — §4.4's cache rule applies, since this flag participates in `required_asr`).

### 5.7 `users` additions

- `session_version INTEGER NOT NULL DEFAULT 1` (M1 migration).
- `security_score INTEGER NOT NULL DEFAULT 0 CHECK (security_score BETWEEN 0 AND 20)` (M2 scoring migration, §14).

### 5.8 `operator_accounts` — deliberately NOT created

`role_grants` + `requireRole`/`requirePilotAdmin` + `users.is_platform_admin` already provide lifecycle-managed operator identity; its migration explicitly warns against second, weaker write paths. Operator reset (§7.3) reuses it. Recorded in §17.

---

## 6. MFA state machines

### 6.1 Enrollment (flag: `MFA_ENROLLMENT_ENABLED`)

```
[no factor] → POST /api/security/mfa/enroll          (requireAuth; reauth NOT required for first enrollment)
    server: delete stale pending row · generate 20-byte secret (crypto.randomBytes)
            encrypt AES-256-GCM with HKDF key("mfa_secret_enc"), AAD = user_id‖factor_id
            insert user_mfa_factors(status='pending')
            respond ONCE with otpauth URI + base32 secret (manual entry):
            otpauth://totp/Taruu:{email}?secret={base32}&issuer=Taruu&algorithm=SHA1&digits=6&period=30
    event: mfa_enrollment_started
[pending] → POST /api/security/mfa/enroll/confirm {code}
    verify RFC 6238 (SHA-1, 6 digits, 30s step, window ±1) + monotonic step guard (§6.4b)
    success (single transaction):
        status='active', confirmed_at=now(), last_accepted_step=accepted step
        generate recovery-code batch (§6.2) — returned ONCE in this response
        security_score recomputes via trigger (§10)
        events: mfa_enrollment_confirmed, recovery_codes_regenerated
    failure: confirm_attempts++ ; at 5 → delete pending row, event mfa_enrollment_failed; restart
[pending >15 min] → treated as absent; next enroll replaces it
```

SHA-1/6-digit/30s is the interoperable profile every mainstream authenticator (including Google Authenticator) implements. QR rendering uses the already-declared, currently unused `qrcode.react` (`apps/web/package.json:61`).

### 6.2 Recovery codes

- **Count/format:** 10 codes per batch, 16 Crockford-base32 chars grouped `XXXX-XXXX-XXXX-XXXX` (80 bits each), from `crypto.randomBytes`.
- **Presentation exactly once:** only in the enroll-confirm (or regenerate) response; UI offers copy/download and requires explicit "I stored these" confirmation. Never retrievable again — DB stores SHA-256 hashes only.
- **Verification:** normalize (strip dashes, uppercase), hash, atomic consume (§5.2); hash comparison via `timingSafeEqual` (mold: `otp.ts:125`).
- **Single use:** enforced structurally by the conditional `UPDATE`.
- **Regeneration:** `POST /api/security/mfa/recovery/regenerate`, requires reauth ticket `purpose='recovery_regenerate'` (methods per §7.2). Deletes prior batch entirely, inserts new, returns codes once, event `recovery_codes_regenerated` (metadata: `batch_id`, `previous_unused_count`).
- **Depletion:** at 2 unused, UIs surface a regenerate warning; at 0, recovery login is impossible (TOTP or operator reset only).

### 6.2a Recovery-code assurance semantics (decided)

A recovery-code login **does yield `asr=mf`**, with `amr=["google","recovery"]`. Rationale: a recovery code is a pre-provisioned possession factor — it exists only because MFA enrollment completed, it was delivered exactly once over an already-authenticated channel, and presenting one proves control of that enrollment artifact. Denying `mf` would lock the user out of exactly the security settings they need to repair a lost authenticator (disable/re-enroll require reauth, §7.2). Recovery is a *degraded* second factor, not a bypass — and the degradation is made operationally visible, never silent:

1. **Always audited:** every use writes `recovery_code_used` (success) or `recovery_code_failed`, with batch and remaining-count metadata.
2. **Atomically invalidated:** the consumed code can never be used again (§5.2 conditional UPDATE).
3. **User informed in-product:** the session carries `amr` containing `recovery`; the UI renders a persistent banner ("You signed in with a recovery code") until the user visits security settings.
4. **Security notification email:** every successful recovery-code login sends a Resend email ("A recovery code was used to sign in — if this wasn't you, review your security settings now").
5. **Regeneration/review encouraged:** security settings surface remaining-code count and a prominent regenerate prompt whenever `amr` includes `recovery` or remaining codes ≤ 2.

Operational distinction from healthy TOTP is therefore carried by `amr`, the audit trail, and the notifications — not by a weaker `asr`, which would have the perverse lockout effect above.

### 6.3 Disable

`POST /api/security/mfa/disable` — a **reauth ticket `purpose='mfa_disable'`** (§7) is mandatory; permissible methods per §7.2 (never `google`). Single transaction:

1. factor `status='disabled'`, `disabled_at=now()`, `disabled_reason='user'` (row retained).
2. `DELETE` all unused recovery codes.
3. `users.session_version + 1` — per §4.4 every other session/refresh token is rejected from the next request onward; the current response re-mints the caller's session as `asr=sf`, `amr=['google']` with the new `sv`.
4. `security_score` recomputes to 0 via trigger.
5. Events: `mfa_disabled`, `session_version_revoked`.
6. Resend email: "Two-factor authentication was disabled."

### 6.4 Login challenge (WS-D) — full case table

Precondition: Google identity verified per §4.3. `enrolled` = active factor exists; `enforced` = `security_settings.mfa_enforcement_enabled`.

#### 6.4a Pending-challenge authority (explicit)

**The `mfa_pending_tokens` row is the authoritative state; the `mfa_pending.v1` JWT is only a signed locator.** A cryptographically valid JWT is *insufficient* — the challenge is refused (401 + event) if the row identified by `jti` is missing, expired (`expires_at <= now()`), already consumed (`consumed_at IS NOT NULL`), attempt-exhausted (`attempt_count >= 5`), or otherwise invalid. Consumption and session issuance are ordered so two concurrent requests cannot both succeed:

```sql
UPDATE mfa_pending_tokens
   SET consumed_at = now()
 WHERE id = $jti AND user_id = $uid
   AND consumed_at IS NULL
   AND expires_at > now()
   AND attempt_count < 5
RETURNING id;
```

Row-level locking makes exactly one concurrent request receive the row; only that winner proceeds to mint the session. The loser gets 401 (`mfa_challenge_replayed`). Code verification (TOTP or recovery) completes **before** this UPDATE; the UPDATE is the commit point.

#### 6.4b TOTP replay protection (explicit)

`user_mfa_factors.last_accepted_step` is a monotonic high-water mark of accepted TOTP time-steps (`floor(unix_time / 30)`). Verification:

1. Compute candidate steps within the skew window: `{T-1, T, T+1}` (±1 step = ±30s clock skew allowed).
2. A candidate matches only if the code is correct for that step **and** `candidate_step > last_accepted_step`.
3. On match, persist atomically with a monotonic guard:

```sql
UPDATE user_mfa_factors
   SET last_accepted_step = $step, last_used_at = now()
 WHERE id = $factor
   AND (last_accepted_step IS NULL OR last_accepted_step < $step)
RETURNING id;
```

If the UPDATE returns no row (a concurrent request already accepted an equal-or-newer step), the verification is treated as a failure — the same code can never be accepted twice, including two simultaneous submissions of the same code. Skew interaction: after accepting step `T`, the codes for steps ≤ `T` are dead even though `T-1` is inside the skew window; only `T+1` (and later) remain acceptable. Replay within the window is thereby impossible while legitimate ±30s skew still works. The same guard runs at enrollment confirm, login challenge, and reauth — one primitive, three call sites.

#### 6.4c Case table

| # | Case | Behavior | Tokens/cookies in existence |
|---|---|---|---|
| 1 | not enrolled | mint session `sf ["google"]` + refresh | `sync-session`, `sync-refresh` |
| 2 | enrolled, enforcement OFF | same as 1 (challenge path gated by `security_settings.mfa_enforcement_enabled`; +20 not awarded, §10.2) | same |
| 3 | enrolled, enforcement ON | insert `mfa_pending_tokens` row; set `sync-mfa-pending`; **no session, no refresh**; respond `MFA_REQUIRED`; client → `/sign-in/challenge` | `sync-mfa-pending` only |
| 4 | correct TOTP | verify per §6.4b, consume row per §6.4a; mint session `mf ["google","totp"]` + refresh; clear pending cookie; event `totp_verification_success` | session + refresh |
| 5 | incorrect TOTP | `attempt_count++`; generic error; event `totp_verification_failure`; at 5 → row exhausted (per §6.4a it can never be consumed), restart login | pending until exhausted |
| 6 | recovery code | atomic code consume (§5.2) then row consume (§6.4a); mint session `mf ["google","recovery"]`; consequences per §6.2a (event + banner + email); failure → `recovery_code_failed`, same attempt counter | session + refresh |
| 7 | expired pending | 401 `CHALLENGE_EXPIRED`; event `mfa_challenge_expired`; restart login | none |
| 8 | reused pending (`consumed_at` set) | 401; event `mfa_challenge_replayed` | none |
| 9 | TOTP step replay (same/older step) | rejected as failure — §6.4b monotonic guard | — |
| 10 | refresh with `asr=mf`, `sv` matches | rotate refresh, mint 1h session preserving `amr`/`asr` | session + refresh |
| 11 | refresh with `asr=sf`, account now requires `mf` | 401 `MFA_REQUIRED`; cookies cleared; full re-login | none |
| 12 | any request or refresh with stale `sv` (MFA state changed) | 401 per §4.4; cookies cleared | none |

Invariant (issue acceptance criterion "no bypass through alternate login routes"): the **only** code path that mints a session or refresh token is the assurance-checked mint function in `services/auth/session.ts`; a repo guard test asserts no other module imports the raw signing primitive. Mobile (`apps/mobile` auth store) consumes the same API and receives the same `MFA_REQUIRED` — no alternate mint path exists.

---

## 7. Reauthentication (WS-B)

Reusable step-up for sensitive actions.

### 7.1 Mechanism

- **Challenge:** `POST /api/security/reauth {purpose, code?}`. The server derives the permissible methods from the account's factor state and the §7.2 matrix — the client never chooses a weaker method than the account permits.
- **Ticket:** DB row (§5.4, authoritative) + `reauth.v1` JWT in the response body; client sends it as `X-Reauth-Ticket` on the guarded call.
- **Semantics:** single-use (atomic consume), 5-minute expiry, bound to `(user_id, purpose)` — a `mfa_disable` ticket cannot authorize `recovery_regenerate`. The freshness window is exact: the guarded action must complete within 5 minutes of the challenge.
- **Guard helper:** `requireReauth(request, purpose)` — verifies session (`sv` checked), verifies + consumes ticket; 403 `REAUTH_REQUIRED` otherwise. Lives beside `requireAuth`.
- **Audit:** `reauth_success` / `reauth_failure` events with `purpose` and `method`.

### 7.2 Reauth policy matrix (decided)

Governing rule: **for an account with an active TOTP factor, `method='google'` never satisfies reauthentication** — a fresh Google round-trip is exactly what an attacker with a hijacked Google account can do, so accepting it would silently bypass MFA. The `google` method exists solely for accounts with no active factor. Enforced server-side (method derivation, not client choice).

| Sensitive action (purpose) | Account with NO active factor | Account WITH active factor |
|---|---|---|
| Disable TOTP (`mfa_disable`) | n/a — nothing to disable | TOTP **or** recovery code (recovery path is the lost-authenticator escape hatch; §6.2a consequences apply). Never `google`. |
| Regenerate recovery codes (`recovery_regenerate`) | n/a — codes only exist with a factor | TOTP **or** recovery code. Never `google`. |
| Operator MFA reset — the **operator's own** ticket (`operator_reset`) | not applicable in practice: operators must be enrolled before the flag turns on (§7.3) | **TOTP only.** Recovery codes do not qualify for privileged operator actions; an operator with a lost authenticator gets their own factor reset by another operator first. |
| Security-settings critical changes (`security_settings`, future) | fresh Google round-trip (`flow='reauth'`, `max_age=0`/`prompt=consent`) | TOTP **or** recovery code. Never `google`. |

### 7.3 Operator reset (flag: `OPERATOR_RESET_ENABLED`)

- **Authorization:** live `role_grants` `role='super_admin'` OR `users.is_platform_admin` — the exact predicate of `requirePilotAdmin` (`server/app/pilot/authorize.ts:20-36`), wrapped as `requireSecurityAdmin`. No new operator table, no env allowlist.
- **Operator identity:** the operator's own authenticated session (`userId` → `actor_user_id`).
- **Operator assurance (decided):** privileged operator actions require role **and** the operator's MFA assurance, layered as:
  1. Per-action: a reauth ticket `purpose='operator_reset'` with **method TOTP only** (§7.2) — always required, which means every reset is individually MFA-proven regardless of global enforcement state.
  2. Session-level: once global enforcement is live, an enrolled operator can only hold `asr='mf'` sessions anyway (`required_asr`, §4.5); `requireSecurityAdmin` additionally asserts `session.asr === 'mf'` whenever the operator has an active factor **and** enforcement is live — defense in depth, and the reason this assertion is conditional on enforcement is M8 ordering: operator reset goes live (step 3) one step before global enforcement (step 4), during which enrolled operators still hold `sf` sessions; the always-required TOTP ticket covers that window.
  - Rollout precondition (§16): every reset-capable operator must be MFA-enrolled before `OPERATOR_RESET_ENABLED` turns on.
- **Endpoint:** `POST /api/security/admin/mfa-reset {targetUserId, reason}` — `reason` mandatory, 10–2000 chars (mirrors `space_audit_log` CHECK).
- **Target semantics (one transaction):** factor `status='disabled'`, `disabled_reason='operator_reset'`; delete unused recovery codes; target `session_version + 1` (per §4.4, all target sessions/refresh rejected from the next request); `security_score` → 0 via trigger. Target returns to case-1 login and may re-enroll normally.
- **Evidence:** `mfa_reset_by_operator` event (`user_id`=target, `actor_user_id`=operator, `reason`, ip/ua) — append-only. Plus `session_version_revoked`.
- **Notification:** Resend email to target ("Your two-factor authentication was reset by support; if this wasn't you, contact us immediately") via new template in `services/email/`.

---

## 8. Security-event model

### 8.1 Taxonomy (`event_type` CHECK values)

```
mfa_enrollment_started      mfa_enrollment_confirmed    mfa_enrollment_failed
totp_verification_success   totp_verification_failure
recovery_code_used          recovery_code_failed        recovery_codes_regenerated
mfa_disabled                mfa_reset_by_operator
reauth_success              reauth_failure
mfa_challenge_expired       mfa_challenge_replayed
session_version_revoked
```

### 8.2 Evidence fields

Always: `user_id`, `event_type`, `created_at`, `ip_hash` (SHA-256 of IP + `SECURITY_EVENT_PEPPER` env — raw IPs never stored), `user_agent` (truncated). Where applicable: `actor_user_id`, `reason`. `metadata` whitelist per type — e.g. `{context:'login'|'reauth'}` on verification events; `{batch_id, previous_unused_count, remaining}` on recovery events; `{trigger:'mfa_disable'|'operator_reset'|'sign_out_all'}` on `session_version_revoked`; `{attempts}` on exhaustion.

Never stored: TOTP secrets or codes, recovery codes (even hashed — those hashes live only in their own table), raw tokens, raw IPs.

### 8.3 Writers

One server-side writer module (`server/infra/supabase/security-events.repo.ts`, mold: `space-audit.repo.ts:71` — exports insert only). Every transition in §6–§7 lists its events inline; the test suite asserts each API path writes them (§16b).

### 8.4 Retention (decided)

Indefinite. Append-only audit evidence; no repository legal/product requirement mandates deletion (`identity_document_events`' ≥24-month rule is a floor, not a ceiling). Revisiting retention requires a separate explicit policy decision and its own migration.

---

## 9. Rate limiting (WS-G)

**Decided:** durable DB-backed limits are the authoritative protection for MFA. Upstash may later be added as an additional per-IP/edge abuse layer via the existing `createRateLimiter`, but **provisioning Upstash is not a prerequisite for Issue #71 correctness**, and the current in-memory fallback (`lib/rate-limit.ts:31` — per-process, resets on deploy) must never be the sole control on any MFA endpoint.

Two durable mechanisms, both precedented:

- **Row counters** (mold: `phone_verifications.send_attempts`): `mfa_pending_tokens.attempt_count`, `user_mfa_factors.confirm_attempts`.
- **Windowed event counts**: indexed count over `security_events (user_id, event_type, created_at)` — failures are logged anyway, so the audit log doubles as the counter; no separate counter table.

| Action | Durable limit | Mechanism |
|---|---|---|
| TOTP verify (challenge) | 5 per pending token; 20 failures/account/hour | row counter + event window |
| Pending challenge mints | 10/account/hour | count of `mfa_pending_tokens` rows by `created_at` |
| Recovery-code attempts | 5 failures/account/hour, 20/day | event window (`recovery_code_failed`) |
| Enrollment start | 5/account/hour | event window (`mfa_enrollment_started`) |
| Enrollment confirm | 5 per pending factor | `confirm_attempts` |
| Reauth attempts | 5 failures/15 min/account | event window (`reauth_failure`) |
| Operator reset | 10/operator/day | event window on `actor_user_id` |

All limits are time-windowed and self-expiring — **no durable account lockout flags** (a locked column is an attacker-triggerable DoS). Responses reuse `createRateLimitResponse` (`rate-limit.ts:316`).

---

## 10. Scoring model (approved invariant — not open for redesign)

### 10.1 `identity_score` — identity evidence only, max 140, DB-owned

Google +40 · operator-approved ID/OCR +40 · GPS/residency +20 · phone +10 · Facebook +10 · Instagram +10 · X +10 (dormant until PR-X enum). Owned entirely by PR-A's triggers (`20260807000001_identity_score_unification.sql`, PR #110); this spec adds **nothing** to it. Voting eligibility = `identity_score >= 40` AND explicit residency (`hasVerifiedResidency`), exactly as PR-A defines. **MFA never appears in this formula.**

### 10.2 `security_score` — security posture only, max 20, DB-owned — FORMULA LOCKED

```
security_score(u) = 20  iff (1) EXISTS (SELECT 1 FROM user_mfa_factors f
                                        WHERE f.user_id = u.id AND f.status = 'active')
                        AND (2) (SELECT mfa_enforcement_enabled FROM security_settings)
                    else 0
```

Both conditions, nothing else. "Global MFA enforcement is live" means condition (2): the single DB authority of §5.6. There is no per-account enforcement state and no env-var input.

**Rollout consequence, explicit:** during the window where enrollment is available (`MFA_ENROLLMENT_ENABLED=true`) but enforcement is still OFF, a user can hold an active, confirmed TOTP factor and their `security_score` is **0**. The +20 appears for every enrolled user at the moment of the enforcement flip (M8 step 4, which recomputes in the same transaction) — posture is claimed only when it is enforced.

**Voting/identity authorization must never consume this score** — guardrails in §10.4.

Writers — DB only, PR-A's exact pattern (`SECURITY DEFINER SET search_path = public`, EXECUTE revoked from PUBLIC/anon/authenticated):
- `calculate_security_score(u users)` + trigger `AFTER INSERT OR UPDATE OF status OR DELETE ON user_mfa_factors` → recompute affected user.
- Enforcement flips don't fire triggers, so the flip runbook is one transaction: `UPDATE security_settings …;` then recompute `security_score` for all users with active factors (§16 M8 step 4; the reverse flip recomputes to 0 the same way).
- PR-A's repo-wide single-writer guard test is extended to cover `security_score`.

### 10.3 `displayed_trust_score` — derived, max 160, display only

**Not a column.** Derived in shared code: `getDisplayedTrustScore({identityScore, securityScore}) = identityScore + securityScore` in `packages/shared/src/utils/identityScore.ts`. No independent mutable ownership ⇒ no drift, nothing to backfill, nothing to guard in the DB.

### 10.4 Coupling guardrails

- Application: `votingGate` / `services/verification/eligibility.ts` keep signatures accepting **identity inputs only** — no `securityScore` parameter exists to misuse. A characterization test (extending PR-A's `identity-score-unification.test.ts` guard) greps the eligibility and participation modules (`eligibility.ts`, `api/votes/**`, `api/payments/**`) for `security_score|securityScore|displayed_trust|displayedTrust` and fails on any hit.
- Database: no function or view combines the two scores; the calculators are independent; checklist item pinned in the migration header comment.

---

## 11. UI architecture (WS-E)

Route placement follows the existing settings convention (`apps/web/src/app/[locale]/settings/*`), so the issue prose's `/dashboard/security` is realized as **`/[locale]/settings/security`**; the dashboard links to it (deviation recorded in §17).

| Surface | Route / component | Notes |
|---|---|---|
| Security Settings | `settings/security/page.tsx` | MFA status, enroll/disable entry, recovery-code count + regenerate, own recent `security_events`, trust-score card; recovery-used review prompt (§6.2a) |
| TOTP enrollment | `settings/security/enroll/` | QR via `qrcode.react`, manual base32 with copy, confirm-code step |
| Recovery-code presentation | step inside enroll-confirm + regenerate | shown once; copy/download; explicit confirmation before dismissal |
| MFA login challenge | `sign-in/challenge/page.tsx` | TOTP input, "use a recovery code" toggle, attempts-remaining, expired → restart |
| Reauthentication prompt | shared `ReauthDialog` | wraps §7; method options rendered per the §7.2 matrix |
| MFA disable | action in `settings/security` behind `ReauthDialog` | explicit consequence copy (score −20 once enforcement live, sessions revoked) |
| Operator reset | action within existing admin surface, behind `OPERATOR_RESET_ENABLED` | target lookup, mandatory reason (10–2000), `ReauthDialog` (TOTP only), confirmation |
| Trust-score display | new shared `IdentityScoreCard` (x/140), `SecurityScoreCard` (x/20), `TrustScoreBadge` (x/160) | replaces inlined blocks at `settings/social-connections/page.tsx:180-212` and `dashboard/page.tsx:544-575` |

Score-display correctness: the audited `/100` + `%`-width hardcoding (`social-connections/page.tsx:188,193`) overflows above 100 once PR-A's 140 scale is live. Component extraction fixes it structurally: each card renders against its own explicit maximum (140 / 20 / 160); the three metrics are visually distinct (identity = eligibility framing, security = posture framing, trust = combined display) and never conflated; explanation text extends `getIdentityLevelDescription` (`identityScore.ts:264-273`) with MFA vocabulary. Mobile consumes the same shared constants; mobile challenge UI is a rollout gate (§12/§16), shipped as its own workstream slice.

---

## 12. Rollout controls

| Control | Source | Default | Gates exactly |
|---|---|---|---|
| `MFA_ENROLLMENT_ENABLED` | env, `lib/features/mfa-enrollment.ts` | **OFF** | `/api/security/mfa/enroll*`, recovery regenerate, all enrollment/security-settings UI entries. Off ⇒ 404/hidden. Already-active factors keep working (challenge is governed by enforcement, not this flag) |
| **Global MFA enforcement** | **DB only:** `security_settings.mfa_enforcement_enabled` (§5.6 — the single source of truth; no env var) | **OFF** | login-challenge branch (§6.4c case 3), refresh assurance re-check (case 11), the +20 term of `security_score` (§10.2), the conditional operator session-`asr` assertion (§7.3) |
| `OPERATOR_RESET_ENABLED` | env, `lib/features/operator-reset.ts` | **OFF** | `/api/security/admin/mfa-reset` + its admin UI |

Audit caution: existing flag modules are default-ON (`!== 'false'`, `space-admin.ts:7`). The two env flags **must invert** to `=== 'true'` (default-OFF); the enforcement control defaults OFF by its seeded DB value.

**Mobile enforcement gate (decided):** the backend may ship full MFA support before mobile UI support, but global enforcement must **not** be enabled while any supported first-party client that uses this authentication flow cannot complete the MFA challenge. Today that means: `apps/mobile` (which consumes the same callback/refresh APIs, `apps/mobile/src/stores/authStore.ts`) must either ship challenge support or be formally retired/blocked from login **before** M8 step 4. This gate is part of the enforcement-flip runbook checklist (§16).

Rollback: flipping enforcement OFF (same one-row transaction, with recompute) instantly stops challenges and removes +20, while enrolled secrets remain stored encrypted — matching the issue's rollback requirement.

---

## 13. PR-A relationship (hard prerequisite)

PR #110 makes the DB sole writer of `identity_score` on the 0..140 scale. Every scoring element here stacks on it. Current state (2026-08-16): **MERGED to main (squash `bc7defe`); the M1 branch is rebased onto it. Migration `20260807000001` is present on main but NOT yet applied to production** (prod ledger has no such row; the app-first deploy then single-migration apply is the remaining prod step).

Before any Issue #71 MFA milestone merges, PR-A must complete, including the audit-identified hazards (dependency only — not implemented in this task):

1. **Migration-version collision:** PR-A's branch still contains two files claiming `20260806000001` (`pilot_program.sql`, `votes_live_topic_unique.sql`); main resolved this via renumbering + the retired-slot placeholder `20260806000001_version_slot_retired.sql`. Merging PR-A as-is re-introduces the exact defect. Fix = rename/drop stale duplicates during rebase.
2. **Rebase onto current main** (main moved past the branch point: #111 merged; ledger 4 migrations ahead of PR-A's base).
3. **Re-verify PR #108 ballot semantics** (`identity_score >= 40` AND `hasVerifiedResidency`) against post-#111 main.
4. **Fix `/100` UI assumptions** (PR-A updates most; residual `%`-width overflow finished by WS-E extraction).
5. **Apply the migration to prod** per its own header contract: app-first deploy, then single-migration `apply_migration` with verbatim body — never apply-all.

---

## 14. Migration plan & version ownership

Migration collisions have already occurred in this program (§13.1; the ledger keys by version, and a duplicate slot is *silently skipped* — the historical defect). Therefore version strings are **allocated here, now**, and are the only legitimate source of migration numbers for Issue #71. No workstream invents versions; renumbering happens only by editing this section.

### 14.1 Reserved version registry

| Reserved version | Owner | Contents | Status |
|---|---|---|---|
| `20260807000001_identity_score_unification` | M0 / PR-A (WS-0) | per PR #110 | exists; unapplied |
| `20260901000001_session_version` | M1 (WS-A) | `users.session_version` | reserved |
| `20260901000002_mfa_schema` | M2 (WS-C/WS-H) | 5 tables (§5.1–5.5) + `security_settings` seeded false + append-only triggers/REVOKEs + indexes | reserved |
| `20260901000003_security_score` | M2 (WS-C, scoring) | `users.security_score` + CHECK, `calculate_security_score`, factor trigger, EXECUTE revokes, guard-comment header | reserved |
| `20260901000004_operator_audit_reserved` | M7 (WS-B2) | reserved buffer for operator/audit additions **if** separation proves necessary; expected to go unused | reserved |

Rules: (a) these exact strings are reserved regardless of the calendar date on which implementation happens — the `202609…` prefix is chosen to sort after every version applied to prod today (latest: `20260811000004`) and after PR-A's `20260807000001`; (b) a reserved slot that goes unused is retired with an explicitly empty placeholder file (house precedent: `20260806000001_version_slot_retired.sql`), never silently reused; (c) each migration ships in exactly the milestone that owns it.

### 14.2 Inertness and application procedure

All Issue #71 migrations are inert on arrival (controls OFF, empty tables, score stays 0 — no factors exist and enforcement is seeded false). Non-migration data changes (the M8 enforcement-flip transaction, env flag changes) are runbook DML, never migration files. Proof suite: an `identity_score_triggers.sql`-style transactional test file (`supabase/tests/security_mfa.sql`) covering the score trigger matrix, append-only rejection (including service_role), atomic consume semantics — excluded from `pnpm test` like its precedent (CI has no live-DB harness). Prod application always follows the house procedure PR-A's header codifies: app-first, ledger snapshot, single verbatim `apply_migration`, ledger-delta verification (exactly one new version per apply).

---

## 15. Workstreams

**WS-0 — PR-A landing (prerequisite).** Objective: land PR #110 + apply migration `20260807000001`. Scope: §13. Non-scope: any MFA code. Deps: none. Acceptance: merged; ledger contains the version; zero-delta dry-run criterion met; guard test green on main.

**WS-A — Auth kernel.** Objective: purpose-typed, revocable, assurance-aware tokens + hardened OIDC callback. Scope: HKDF keys; `typ`; `sv` mint + **Model B central check** (§4.4); `amr`/`asr`; signed state + nonce; local id_token JWKS verification; refresh rotation with assurance re-check; legacy window; 1h session TTL. Non-scope: MFA tables/challenge (case-3 branch lands in WS-D); RLS-token claims (§4.7). Deps: none (parallel with WS-0). DB: `20260901000001`. API: callback, refresh, sign-out. UI: none. Invariants: tokens non-interchangeable; state validated server-side; unverified email rejected; legacy window ≤7d; revocation guarantee as stated in §4.4. Acceptance: token matrix tests (wrong typ/key/sv rejected); OIDC negative tests (iss/aud/nonce/email_verified); e2e login unchanged; stale-`sv` request AND refresh → 401 (immediacy test: bump then request); **mobile auth store verified to handle silent refresh (or TTL fallback invoked per §4.2)**.

**WS-H — Security events & notifications foundation.** Objective: `security_events` + repo writer + Resend security templates (mfa disabled / operator reset / recovery-code used / enrollment notice). Non-scope: the events firing (each WS wires its own). Ships inside `20260901000002`. Invariants: append-only proven by SQL test even for service_role. Acceptance: proof suite green; writer exports insert only.

**WS-C — MFA persistence + TOTP lifecycle.** Objective: enroll → confirm → active; recovery codes; disable; `security_score`. Scope: §5.1–5.4, §5.6, §5.7b; §6.1–6.3; §10.2 trigger; enrollment APIs behind `MFA_ENROLLMENT_ENABLED`; durable enroll/confirm limits. Non-scope: login challenge; operator reset. Deps: WS-0, WS-A, WS-H. DB: `20260901000002` + `20260901000003`. API: `/api/security/mfa/enroll`, `/enroll/confirm`, `/recovery/regenerate`, `/disable`. Invariants: secret encrypted + never logged/re-served; confirm-before-active; codes hash-only atomic single-use; disable requires reauth + bumps `sv`; §6.4b monotonic step guard. Acceptance: RFC 6238 vectors + ±1 skew; step replay rejected (incl. concurrent same-code race); 5-attempt exhaustion; concurrent recovery-consume race (exactly one wins); score trigger matrix (enroll/confirm/disable × enforcement on/off, incl. the enrolled-but-unenforced ⇒ 0 case of §10.2).

**WS-B — Reauthentication & privileged actions.** Objective: §7 step-up + §7.3 operator reset. Scope: `reauth_tickets`, `requireReauth`, §7.2 policy matrix with server-side method derivation, Google-flow reauth for non-enrolled, operator endpoint behind `OPERATOR_RESET_ENABLED`. Non-scope: new operator authorization model. Deps: WS-A, WS-C, WS-H. Invariants: tickets single-use, purpose-bound, 5-min; `google` method never satisfies reauth for an MFA-active account; operator tickets TOTP-only; reason mandatory; reset bumps target `sv`. Acceptance: full §7.2 matrix as tests (incl. google-rejected-when-enrolled); purpose mismatch rejected; replayed ticket rejected; reset e2e (factor disabled, codes gone, target 401 on next request, event + email, score 0).

**WS-D — Login challenge & session assurance.** Objective: §6.4 state machine. Scope: pending-token flows, challenge API (`/api/auth/mfa/verify`), refresh assurance re-check, all behind the DB enforcement control. Deps: WS-A, WS-C. Invariants: DB row authoritative over pending JWT (§6.4a); no session/refresh in pending state; single mint path; pending single-use with concurrent-consume race safety; TOTP failures durably limited. Acceptance: case table 1–12 as integration tests, plus a concurrent double-consume test (two parallel correct submissions → exactly one session); Playwright enroll→logout→challenge→login; bypass-hunt test (every mint call site assurance-checked).

**WS-E — Client/UX.** Objective: §11 surfaces + score-component extraction; separately scoped slice for mobile challenge UI (rollout-gating, §12). Deps: WS-C/D contracts (start once frozen). Invariants: codes rendered once; no secret in client state post-confirm; three scores rendered against explicit maxima (140/20/160), never conflated; no `/100` hardcodes remain; recovery-used banner + email verified. Acceptance: issue's screenshot evidence (security page, enrollment, recovery codes, challenge, updated score components); a11y pass.

**WS-G — Rate limiting & operational safety (cross-cutting).** Objective: §9 durable limits + runbooks (enforcement flip incl. mobile gate checklist, operator onboarding, incident rollback). Upstash provisioning explicitly out of scope (§9). Deps: WS-H. Acceptance: brute-force tests durable across process restarts; flip runbook rehearsed on scratch DB.

(Suggested WS-F "identity evidence integration" dissolved: identity evidence is wholly owned by PR-A/WS-0 and the separate PR-10 operator-approval flow.)

---

## 16. Milestones / PR sequence

| M | Content (WS) | Migration (per §14.1) | Controls state | Prod behavior change | Parallel with |
|---|---|---|---|---|---|
| M0 | PR-A landed + migration applied (WS-0) | `20260807000001` | n/a | identity-score unification (PR-A's scope) | M1 |
| M1 | Auth kernel (WS-A) | `20260901000001` | all OFF | none (transparent token upgrade; legacy window) | M0 |
| M2 | MFA schema + events + score trigger + email templates (WS-C1+WS-H) | `20260901000002`, `20260901000003` | all OFF | none (inert schema) | — |
| M3 | Enrollment/recovery/disable APIs + limits (WS-C2) | — | enrollment OFF | none (404 behind flag) | M4 |
| M4 | Reauth mechanism + policy matrix (WS-B1) | — | all OFF | none | M3 |
| M5 | Login challenge + refresh assurance (WS-D) | — | enforcement false in DB | none (dead branch) | M6 |
| M6 | Web UI (WS-E web slice) | — | enrollment OFF | none (hidden) | M5 |
| M6b | Mobile challenge UI (WS-E mobile slice) — required before step 4 unless mobile login is formally retired | — | — | none | M7 |
| M7 | Operator reset + notifications (WS-B2) | `20260901000004` only if needed | reset OFF | none | M5/M6 |
| M8 | Rollout (runbook only) | — (DML runbook) | staged flips | **yes — the only behavioral milestone** | — |

M8 staged flips:
1. `MFA_ENROLLMENT_ENABLED=true` internal/staging → founders + operators enroll; validate QR/manual/confirm/recovery against real authenticator apps.
2. Enrollment on in production for all. Still no challenge, no +20 (§10.2 rollout consequence).
3. All reset-capable operators verified enrolled → `OPERATOR_RESET_ENABLED=true`; rehearse one supervised reset end-to-end (audit row + email verified).
4. Enforcement flip — gated on the **mobile checklist item** (§12: every supported first-party client can complete the challenge, or mobile login formally retired): single DB transaction — `security_settings.mfa_enforcement_enabled=true` + `security_score` recompute. From this instant enrolled users are challenged and score +20. Rollback = same transaction with `false` (recompute to 0); secrets retained.

Nothing activates because schema/code lands; every behavior change is an M8 runbook step.

---

## 16b. Test strategy

- **TOTP unit:** RFC 6238 reference vectors; clock skew ±1 step accepted, ±2 rejected; step-replay (monotonic `last_accepted_step`, §6.4b) rejected, including the concurrent same-code race (exactly one acceptance).
- **Token matrix:** every token type against every verifier (typ/key/exp/sv permutations) — all cross-acceptances fail.
- **Revocation immediacy:** bump `sv` then issue an ordinary authenticated request with the old token → 401 (Model B guarantee, §4.4); same for refresh; same for a legacy-window token.
- **OIDC negatives:** bad iss, wrong aud, expired, `email_verified=false`, nonce mismatch, missing/mismatched state cookie.
- **State machine:** §6.4c cases 1–12 as integration tests; enrollment §6.1 including 5-attempt exhaustion and stale-pending replacement; pending-authority negatives (valid JWT + missing/expired/consumed/exhausted row → 401, §6.4a).
- **Concurrency:** parallel pending-token consume (exactly one session minted); parallel recovery-code consume (exactly one success).
- **Reauth matrix:** every cell of §7.2, including `google`-rejected-for-enrolled-account and operator TOTP-only.
- **Recovery semantics:** consumed code dead forever; banner keyed off `amr`; notification email sent on recovery login.
- **Rate limits:** brute-force to each ceiling; durability across process restart (in-memory limiter explicitly not relied on).
- **SQL proof suite** (`supabase/tests/security_mfa.sql`, transactional, PR-A mold): score trigger matrix (incl. enrolled-but-unenforced ⇒ 0), append-only rejection incl. service_role, smuggled-`security_score` INSERT blocked, enforcement-flip recompute both directions.
- **Guard tests:** single-writer guard extended to `security_score`; eligibility-coupling grep guard (§10.4); single-mint-path guard (§6.4c).
- **E2E (Playwright):** enroll → logout → challenge (TOTP) → login; recovery login; disable; operator reset; score regression (enforcement flip adds exactly +20 to enrolled users / reverse removes exactly 20 — issue acceptance criterion adapted to the approved model).
- **Event coverage:** each API path asserts its §8 events.

---

## 17. Explicitly rejected alternatives

| Alternative | Rejected because |
|---|---|
| Supabase native MFA / AAL | Supabase Auth disabled (`config.toml:19`); `public.users` unlinked to `auth.users`; `auth.uid()` documented always-NULL. Structurally unreachable. |
| Linking `public.users` to `auth.users` to unlock native MFA | Whole-platform identity migration for one feature; contradicts the deliberate custom-OIDC direction (PR #48 removed Auth0). |
| Literal `aal1/aal2` claims | `amr` + binary `asr` maps 1:1 onto this stack without importing semantics that don't exist here. |
| TOTP inside `identity_score` (issue's original "+40 within identity score") | Superseded by the approved three-score invariant: MFA must never increase voting eligibility; the second +40 in the 140 scale is the document term (PR-A). |
| `MFA_ENFORCEMENT_ENABLED` as an env feature flag (alone or alongside the DB field) | Two authorities would drift; the DB-owned `security_score` trigger cannot read env; the flip must be transactional with the recompute (§5.6). Env flags kept only for pure code-path gates (enrollment, operator reset). |
| Stored `displayed_trust_score` column | Pure derivation of two owned columns; storing creates a third writable surface + drift/backfill for zero benefit. |
| `operator_accounts` table / env allowlist | `role_grants` + `requireRole`/`requirePilotAdmin` already provide lifecycle-managed operator identity; parallel write paths explicitly warned against in that migration. |
| Model A revocation (refresh-time `sv` check only) | Would leave revoked sessions alive up to 1h and force this document to overclaim or caveat "immediate revocation"; the central `requireAuth` chokepoint makes Model B one code change + a PK lookup (§4.4). |
| `google` method satisfying reauth for MFA-active accounts | A hijacked Google account could then strip MFA — the exact attack MFA exists to stop (§7.2). |
| Recovery login demoted to `asr=sf` | Would lock users with a lost authenticator out of the reauth-gated settings needed to repair it; recovery is a provisioned possession factor, distinguished operationally via `amr` + audit + email instead (§6.2a). |
| Upstash as authoritative MFA limiter / provisioning it as a prerequisite | Unconfigured in prod; in-memory fallback per-process, resets on deploy. DB-durable authoritative; Upstash optional later abuse layer (§9). |
| Durable account lockout flags | Attacker-triggerable DoS; time-windowed self-expiring limits instead. |
| Reusing `space_audit_log`/`pilot_audit_log` for MFA events | `space_id NOT NULL` FK + domain `object_type` CHECKs make account-level auth events uninsertable; widening pollutes domain logs. New table, same enforcement mold. |
| Refresh-token family reuse-detection (server session store) | Needs a sessions table + rotation-family bookkeeping; `session_version` (Model B) + 1h sessions + refresh assurance re-check deliver the required revocation at a fraction of the complexity. Deferred, not needed for #71. |
| Retention window on `security_events` | No repository legal/product requirement mandates deletion; append-only audit evidence kept indefinitely; revisit only via explicit separate policy + migration (§8.4). |
| Enforcement before mobile challenge support | Would hard-lock every enrolled mobile user out of a supported first-party client (§12 gate). |
| `/dashboard/security` route literally | Existing settings all live under `settings/*`; `settings/security` chosen, dashboard links to it. |
| SMS 2FA, passkeys/WebAuthn | Out of scope per the issue. |

---

## 18. Open questions

**None.** All four questions from revision 1 are resolved:

1. *Mobile scope/timing* → resolved as a rollout gate (§12, §16 M6b/M8-4): backend ships first; global enforcement must not be enabled while a supported first-party client using this auth flow cannot complete the challenge.
2. *Upstash provisioning* → resolved (§9): DB-durable limits are authoritative and sufficient; Upstash is an optional later abuse layer, not a prerequisite; the in-memory fallback is never relied on for security enforcement.
3. *Session TTL sign-off* → resolved (§4.2, §4.4): Model B makes revocation independent of TTL; 1h+refresh retained for exposure-bounding, with an explicit TTL fallback if mobile silent-refresh verification (a WS-A acceptance item) fails.
4. *`security_events` retention* → resolved (§8.4): indefinite; any change requires a separate explicit policy decision + migration.

— End of document —
