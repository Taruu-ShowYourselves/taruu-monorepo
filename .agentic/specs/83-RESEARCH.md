# Research — issue #83

## Already-done check

- Daily run within defined traffic/error budgets and no persistent mutation beyond canaries: **MISSING.** No production pentest runner, target/test allowlist, scanner traffic budget, maintenance window, canary inventory, or mutation ledger exists in the tree.
- Seeded safe regression detected, deduplicated, alerted, and linked to evidence: **MISSING.** Existing Telegram notification and GitHub issue helpers are generic delivery tooling, not security-finding validation or deduplication (`scripts/agentic/telegram.mjs`, `scripts/agentic/create-issue.mjs`).
- Stop control immediately halts new tests and timeouts fail closed: **MISSING.** The OpenClaw host has a service-level emergency stop, but it controls the PR agent rather than a daily production security runner (`infra/agentic/README.md`, “Emergency stop”). Network notification requests do use a 20-second timeout (`scripts/agentic/telegram.mjs`), but there is no per-test stop check or pentest-run timeout policy.
- Reports contain no credentials, private resident data, or exploitable secret material: **MISSING.** The production logger only checks serializability and does not redact nested secrets or PII (`apps/web/src/lib/logger.ts`). This is recorded as finding 22 in `SECURITY-AUDIT.md`.

**Verdict: proceed.** The working tree does not satisfy any acceptance criterion end to end.

## Current-state map

- Production runtime and scheduling:
  - `apps/web/worker.ts` is the Cloudflare Worker entry point. Its `scheduled` handler maps exact cron expressions to authenticated HTTP cron routes and uses `ctx.waitUntil`.
  - `apps/web/wrangler.jsonc` owns production domains, environment selection, observability, and Cron Triggers. Only `0 */6 * * *` is currently declared. Comments document an account-level multi-cron deployment gate.
  - `apps/web/src/app/api/cron/*/route.ts` is the established scheduled-job boundary. Routes require `Authorization: Bearer ${CRON_SECRET}`, reject with 503 when the secret is absent, and use `secureEqual`.
  - `apps/web/src/lib/secureCompare.ts` is the existing constant-time secret comparison helper.

- Agent/process infrastructure:
  - `scripts/agentic/telegram.mjs` is the reusable owner-alert transport. It skips when configuration is absent and applies `AbortSignal.timeout(20_000)`.
  - `scripts/agentic/notify-telegram.mjs` turns missing notification configuration into a failure.
  - `scripts/agentic/create-issue.mjs` creates an `agents`-labelled GitHub issue and places it in Project #2 as Todo.
  - `.github/workflows/agent-dispatch.yml`, `scripts/agentic/dispatch-openclaw.mjs`, and `infra/agentic/README.md` enforce the human authorization model: implementation begins only after an allowlisted owner explicitly comments `openclaw work`.
  - No current module represents security targets, tests, findings, evidence, severity/confidence, deduplication, validation, or run summaries.

- Existing security primitives:
  - `netlify.toml` configures `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and DNS-prefetch policy. It does not configure HSTS or CSP.
  - `apps/web/src/lib/rate-limit.ts` exposes the `RateLimiter` interface and `createRateLimiter`. Production uses Upstash Redis when configured; otherwise it warns and falls back to a per-isolate in-memory map.
  - Authentication canaries would exercise the existing route layer under `apps/web/src/app/api/auth/`, `apps/web/src/app/api/user/`, `apps/web/src/app/api/space-admin/`, and `apps/web/src/app/api/votes/`.
  - `apps/web/src/lib/logger.ts` supplies structured production JSON logging and child loggers, but its `sanitizeContext` does not redact values.
  - `SECURITY-AUDIT.md` is a static, pre-deployment audit, explicitly not a live-target scanner or clean regression baseline.

- Persistence:
  - Supabase access is concentrated in `apps/web/src/lib/supabase/db.ts` and feature-specific repository modules under `apps/web/src/services/`.
  - No migrations define security runs, findings, evidence, deduplication fingerprints, target inventory, canary inventory, stop state, retention, or alert state.
  - The latest migration present is `supabase/migrations/20260811000004_pilot_program.sql`.

- Evidence and UI:
  - Existing checked-in verification evidence follows `docs/agent-evidence/issue-<n>/`, demonstrated by `docs/agent-evidence/issue-65/README.md`.
  - There is no security-run summary screen, sanitized daily report, target/test inventory screen, or example security-finding issue.

## Integration points

- Scheduler seam: add an exact cron key to `CRON_ROUTES` in `apps/web/worker.ts` and the corresponding trigger in `apps/web/wrangler.jsonc`. The existing account-level cron gate makes trigger registration an operational step, not merely a code edit.
- Scheduled endpoint seam: follow `apps/web/src/app/api/cron/knesset-agenda/route.ts`:
  - fail with 503 if `CRON_SECRET` is absent;
  - authenticate with `secureEqual`;
  - return a bounded summary;
  - log through `cronLogger`.
- Traffic-control seam: `createRateLimiter(storeName, { windowMs, maxRequests })` in `apps/web/src/lib/rate-limit.ts`. Its fallback is explicitly unsuitable for production, so scanner safety cannot depend on the fallback.
- Alert seam: `sendTelegramMessage` in `scripts/agentic/telegram.mjs`; configuration enforcement is demonstrated by `scripts/agentic/notify-telegram.mjs`.
- Remediation-issue seam: `scripts/agentic/create-issue.mjs` shows repository/project defaults and Todo placement. It validates full PRDs, so a security finding likely needs a dedicated issue writer or a finding-to-PRD adapter rather than calling it with an arbitrary report.
- Human-triage seam: `.github/workflows/agent-dispatch.yml` plus `scripts/agentic/dispatch-openclaw.mjs` ensure an issue alone cannot start implementation. An allowlisted owner, exclusive assignment, and explicit `openclaw work` command are required.
- Logging/redaction seam: `sanitizeContext` in `apps/web/src/lib/logger.ts` is the central production log guard, but currently has no recursive key/value redaction.
- Data/repository seam: new persisted security state should follow the Supabase migration → typed repository/service → route pattern. There is no existing security repository or port to extend.
- Migration numbering seam: the highest committed slot is `20260811000004`; any new migration needs a fresh timestamped slot and collision checking against active branches before planning.
- Auth canary seam: use the real API boundaries rather than direct database calls. Privileged route behavior is enforced inside the route/service/repository layers; service-role access can bypass RLS.
- Evidence seam: checked-in sanitized artifacts conventionally live under `docs/agent-evidence/issue-83/`; runtime encrypted evidence has no existing storage abstraction or retention job.

## Prior art

The nearest merged PR is **PR #117**, commit `562e4a0`, “PR autopilot scaffold — two-lane spec-gated delivery.” Copy its separation of researcher/planner/implementer/reviewer roles, durable run artifacts, explicit gates, and prohibition on unattended implementation. It is process infrastructure, not a scanner.

For production scheduling, the nearest merged shape is the Knesset cron work:

- `c464b89`, “wire Cloudflare Cron Triggers via custom OpenNext worker entry”
- `f03b490`, “mirror Knesset plenum day order into votable topics”
- `67a38fc`, “register knesset-agenda cron trigger pre-go-live”

Copy the Worker cron-expression map, authenticated cron route, bounded work-unit design, idempotent persistence, and explicit trigger-registration notes.

For human-reviewed agent delivery and alerts, copy:

- PR #59 / `9a914d2`, review-gated agentic delivery;
- PR #61 / `841c0c4`, Telegram update routing;
- PR #94 / `1c2adc1`, explicit-comment-only dispatch.

For security regression fixtures, `d3b49b3` is useful implementation-level prior art for remediating audited findings, but it is not itself a merged PR-shaped daily scanner.

The remote branch `origin/agent/84-daily-production-api-happy-flow-and-ui-m` is not merged and therefore is not valid merged prior art.

## Constraint register

- Issue #83 is explicitly sequenced after the full #22 security pass in `docs/WORK-ORDER.md`. The repository does not yet have the requested clean findings baseline.
- `SECURITY-AUDIT.md` still records findings in the claimed surface, including:
  - structured logger lacking secret/PII redaction;
  - Google OAuth state/PKCE;
  - OTP resend/reset and fail-open rate limiting;
  - `merch_orders` RLS;
  - unbounded public vote queries;
  - authorization/privacy findings around treasury and voting;
  - additional “Needs context” findings for host-derived URLs, voting eligibility, and phone uniqueness.
- `docs/WORK-ORDER.md` identifies immediate #22 RLS work for `webhook_events`, `vote_nfts`, and users’ self-update policy.
- `.planning/STATE.md` says space-governance migrations `20260802000010` through `20260802000014` are unapplied and unproven against real PostgreSQL. `docs/WORK-ORDER.md` likewise requires applying/proving them.
- `.planning/STATE.md` separately calls for targeted application of `20260807000001_identity_score_unification.sql`.
- Production deployment/operations are not clean:
  - `.planning/STATE.md` reports the Cloudflare deploy credential as missing and recent CI deploy failures.
  - `apps/web/wrangler.jsonc` documents a Cloudflare account-level cron gate and declares only one schedule.
  - Government cron routes exist in `apps/web/worker.ts` but are not registered in `wrangler.jsonc`.
- The logger is unsafe as a security-evidence sink until redaction is added and tested (`apps/web/src/lib/logger.ts`, `SECURITY-AUDIT.md` finding 22).
- Cloudflare observability is enabled (`apps/web/wrangler.jsonc`), so request URLs and emitted context must be treated as potentially retained production evidence.
- Upstash absence silently selects an in-memory limiter (`apps/web/src/lib/rate-limit.ts`). A production safety budget must fail closed rather than accept that fallback.
- Protected paths likely required:
  - `.github/workflows/`
  - `supabase/migrations/`
  - potentially privileged API routes under `apps/web/src/app/api/`
  
  `docs/PR-AUTOPILOT.md` requires a protected-path declaration and file-specific human approval for these paths.
- No checked-in schema or service exists for encrypted evidence or retention. Introducing one would create a new security-sensitive data boundary.
- No workspace changes were present during this read-only inspection.

## Open questions

1. Where must the production runner execute: inside the Cloudflare Worker schedule, on the existing Hetzner agent host, or in GitHub Actions? This determines stop semantics, network identity, secret scope, and achievable timeouts.

2. What exact production hostnames, routes, HTTP methods, and safe payload classes are authorized? “Production-only” is not an executable target allowlist.

3. Which canary accounts and records already exist, who owns them, and how are they unmistakably separated from resident data?

4. What persistent canary mutations are permitted, and what cleanup or reconciliation invariant proves that no non-canary production mutation occurred?

5. What are the numeric per-run and per-target request, concurrency, duration, bandwidth, 4xx/5xx, and latency budgets?

6. What production maintenance window and timezone should the daily run use?

7. Where is the emergency-stop state stored, who may change it, and what maximum interval qualifies as “halts new tests immediately”?

8. Should an absent or unreachable budget/stop store abort the whole run? The acceptance wording suggests fail-closed behavior, but the exact policy needs approval.

9. Which alert destinations and on-call recipients are authorized for critical/high findings, and what delivery failure behavior is required?

10. What severity and confidence rubric defines a “credible” critical/high finding and “safe validation” before alerting or issue creation?

11. What fields form the duplicate fingerprint, and when should a previously closed finding re-open after recurrence?

12. Where should encrypted evidence live, which key-management system is approved, what is the retention period, and who may read it?

13. Is checked-in `docs/agent-evidence/issue-83/` limited to manually sanitized visual evidence, with all raw runtime evidence excluded from git?

14. What seeded regression or production-equivalent fixture is approved, and who may enable and remove it?

15. Does dependency/external-surface coverage authorize only passive metadata checks against Taruu-controlled assets, or also calls to Supabase, Morning, Bags.fm, and other providers? Third-party infrastructure is out of scope without explicit permission.

16. Must #22 and the unapplied migration work be completed before implementation begins, or may #83 build only the passive runner substrate while remaining disabled?

17. Is the run-summary screen public, authenticated, or administrator-only, and which existing authorization capability should guard it?

18. Should finding issues use the existing `agents` label and Project #2 Todo workflow, or a dedicated security label/project with restricted visibility?