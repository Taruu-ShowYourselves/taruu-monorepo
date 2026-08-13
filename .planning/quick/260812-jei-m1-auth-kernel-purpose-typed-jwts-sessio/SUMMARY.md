# SUMMARY — Issue #71: M1 Auth Kernel + full 2FA E2E continuation

Branch: `dolev/issue-71-m1-auth-kernel` (worktree `taruu-monorepo-wt-m1`, off
`origin/main` @ 248c2c1). Nothing pushed, merged, deployed, or applied to
production. Canonical sources of truth: `specs/mfa-architecture.md` (design)
and `specs/mfa-engineering-model.md` (implementation contract; its §13/§14
carry the authoritative status + deviations record).

## M1 (this plan's 9 tasks) — complete

- Tasks 1–6: as previously committed (HKDF keys, purpose-typed tokens,
  session_version, session rewrite + Model B, legacy window, server state+nonce).
- Task 7: callback hardening committed (`fee4d62`) with the rewritten
  gate-sequence test suite (18 cases).
- Task 8: refresh route rewritten (`refresh.v1`-only, cookie/body/bearer
  intake, sv check → `SESSION_REVOKED`, per-call `getRequiredAssurance` →
  `MFA_REQUIRED`, rotation preserving amr/asr, `sessionToken` alias, real 1h
  `expiresAt`; explicit not-reuse-detection header). AuthProvider now passes
  the rotated refresh token + expiry through.
- Task 9: `mint-path-guard.test.ts` (no module outside services/auth/ imports
  tokens.ts/keys.ts — it immediately caught lib/oauth-state.ts, so the login
  state family moved to `services/auth/login-state.ts`) and the RLS-token
  assurance-claims guard in `user-token.test.ts`.

## E2E continuation (M2–M7) — complete

- **M2**: migrations `20260901000002_mfa_schema` (5 tables +
  security_settings + append-only enforcement + 10 atomic SECURITY DEFINER
  RPCs) and `20260901000003_security_score` (locked formula + factor
  trigger). Proof suite `supabase/tests/security_mfa.sql`: **21 PASS** on a
  scratch replay (supabase/postgres 17.6.1.136) of the full migration chain.
  App layer: full purpose catalog, TOTP (RFC 6238 vectors green), recovery
  codes, AES-GCM secret encryption (AAD-bound), `lib/supabase/mfa.ts` RPC
  wrappers, insert-only `security-events.repo.ts`, feature gates, Hebrew
  security emails.
- **M3**: enroll / enroll-confirm / disable / recovery-regenerate routes with
  durable ceilings.
- **M4**: `/api/security/reauth` + `requireReauth` (server-derived §7.2
  matrix; tickets single-use, purpose-bound, DB-authoritative).
- **M5**: callback case-3 challenge branch + `/api/auth/mfa/verify`
  implementing case-table rows 4–9 (row = authority; verify-then-consume
  ordering; exactly-one-winner surfaced as `CHALLENGE_REPLAYED` for the loser).
- **M6**: `settings/security` page (status, QR/manual enrollment, one-time
  recovery display with explicit acknowledgement, ReauthDialog-gated disable
  and regenerate, /20 score card, recovery-login banner, own events),
  `sign-in/challenge` page, AuthProvider MFA_REQUIRED routing, api-client
  `{error, code}` surfacing for mobile.
- **M7**: `/api/security/admin/mfa-reset` (flag + requireSecurityAdmin +
  TOTP-only ticket + mandatory reason + 10/day ceiling + evidence + email).

## Verification evidence

- Web vitest: **111 files / 1397 tests** green (incl. the new MFA suites:
  case-table, reauth matrix, enrollment with real crypto, admin reset).
- Root `pnpm test` 8/8 tasks, `pnpm typecheck` 9/9, `pnpm lint` 5/5 (0
  errors), `pnpm build` 4/4 with the CI placeholder env.
- DB: full-chain migration replay + 21-case proof suite on scratch Postgres.
- Not runnable here: a browser E2E through real Google OAuth (external IdP)
  and prod-shaped Playwright flows — covered instead by route-level
  integration tests with real crypto + the SQL proof suite; note kept in the
  final report.

## Operator actions before any deploy (do NOT set now)

`AUTH_MASTER_KEY` (≥32 chars, fail-loud), `AUTH_LEGACY_UNTIL` (ISO-8601
deadline; unset = legacy window closed = everyone re-logs), and
`SECURITY_EVENT_PEPPER` as Worker secrets; then per-migration verbatim
`apply_migration` for `20260901000001/-02/-03` (never apply-all). `JWT_SECRET`
stays until the legacy window closes AND oauth-state family 1 migrates.
Rollout flips are the M8 runbook only (engineering model §5.7/§14).

## Known gaps / follow-ups (tracked, not blockers)

Mobile challenge UI (M6b) blocked on the out-of-scope mobile login redesign —
it gates only the production enforcement flip; identity/trust score-card
extraction waits for PR-A; refresh rotation is deliberately not reuse
detection; the mobile deep-link login gap is pre-existing and out of scope.
