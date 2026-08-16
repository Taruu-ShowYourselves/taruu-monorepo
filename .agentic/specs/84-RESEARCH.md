# Research — issue #84

## Already-done check

- Seeded API, UI, and happy-flow failure is detected and reported with actionable evidence: **MISSING.** Playwright can capture failure screenshots and retry traces, but no scheduled production run, synthetic failure injection, evidence bundle, alert delivery, or incident reporter exists ([apps/web/playwright.config.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/apps/web/playwright.config.ts>), [apps/web/tests/e2e/smoke.spec.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/apps/web/tests/e2e/smoke.spec.ts>)).
- Normal runs do not create real votes, charges, resident notifications, or production pollution: **MISSING.** Existing smoke tests mostly exercise unauthenticated rejection paths. There is no dedicated production canary identity/data boundary or monitor-specific mutation guard. The real participation, proposal, payment, and notification endpoints are mutating ([participate/route.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/apps/web/src/app/api/votes/[id]/participate/route.ts>), [votes/route.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/apps/web/src/app/api/votes/route.ts>), [payments/create/route.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/apps/web/src/app/api/payments/create/route.ts>), [notifications/send/route.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/apps/web/src/app/api/space-admin/[spaceId]/notifications/send/route.ts>)).
- Repeated identical failures update one incident rather than opening duplicates: **MISSING.** The GitHub wrapper can read issues, create PRs, and comment on PRs, but has no incident create/search/update or fingerprinting API ([github.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/.agentic/runner/src/github.ts>)).
- Recovery is detected and reported without closing or moving the issue automatically: **MISSING.** No persistent monitor state or recovery transition exists. Existing mail idempotency only suppresses duplicate autopilot lifecycle emails ([mailer.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/.agentic/runner/src/mailer.ts>)).

**Verdict: proceed.** The tree contains useful test, scheduling, logging, and notification primitives, but none of the four acceptance criteria is satisfied end to end.

## Current-state map

- Production web deployment uses Next.js App Router on Cloudflare Workers. Deployment is handled by [deploy.yml](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/.github/workflows/deploy.yml>).
- Recurring Worker execution is centralized in [worker.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/apps/web/worker.ts>): `CRON_ROUTES` maps exact cron expressions to authenticated HTTP routes.
- Only `0 */6 * * *` is declared in [wrangler.jsonc](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/apps/web/wrangler.jsonc>). Other mapped schedules are documented as requiring manual Cloudflare dashboard registration because multi-schedule deployment was rejected.
- The current browser harness is Playwright under `apps/web/tests/e2e/`. Configuration supports `PLAYWRIGHT_BASE_URL`, two CI retries, first-retry traces, HTML reports, and failure screenshots ([playwright.config.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/apps/web/playwright.config.ts>)).
- [smoke.spec.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/apps/web/tests/e2e/smoke.spec.ts>) covers page availability and unauthenticated API rejection for auth, social proofs, verification, and payments. It does not log in or complete a resident happy flow.
- Council-page behavior and API-error UI are exercised with intercepted responses rather than production data in [council-public-page.spec.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/apps/web/tests/e2e/council-public-page.spec.ts>).
- The strongest visual-evidence implementation is [space-admin.spec.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/apps/web/tests/e2e/space-admin.spec.ts>) with committed desktop/mobile screenshots and a SQL fixture. It is an implementation verification suite, not a production monitor.
- Public monitorable surfaces include localized council, municipality, votes, vote-detail, feed, dashboard, verification, and space-admin pages under `apps/web/src/app/[locale]/`.
- There is no general `/api/health` route. Several mutating cron endpoints expose individual GET health responses, including NFT minting, Knesset roster, and roll-call routes.
- Production logging is structured JSON through [logger.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/apps/web/src/lib/logger.ts>). It adds timestamps and component child loggers, but does not generate or propagate correlation IDs.
- PR-only deterministic verification runs tests, typecheck, lint, and build in [agent-verification.yml](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/.github/workflows/agent-verification.yml>). It has no schedule and does not target production.
- Existing external notifications are deployment comments/Telegram in [notify-deployment.mjs](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/scripts/agentic/notify-deployment.mjs>) and idempotent Resend email in the PR autopilot’s [mailer.ts](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/.agentic/runner/src/mailer.ts>). Neither models monitoring incidents or recovery.

## Integration points

- **Scheduler:** add an exact expression-to-route entry to `CRON_ROUTES` in `apps/web/worker.ts` and mirror it in `apps/web/wrangler.jsonc`. The existing invariant is that both mappings remain synchronized.
- **Alternative scheduler:** a scheduled GitHub Actions workflow would live under `.github/workflows/`, but that is a declared protected path.
- **Browser/API harness:** extend or isolate the Playwright configuration around `PLAYWRIGHT_BASE_URL`. Existing artifact primitives are HTML reports, retry traces, console access, request/response observation, and screenshots.
- **Auth:** authenticated API routes consistently use `getSessionFromRequest` from `apps/web/src/services/auth/session.ts`. No canary-session provisioning or storage seam currently exists.
- **Database access:** legacy operations use `apps/web/src/lib/supabase/db.ts` through the service-role client in `apps/web/src/lib/supabase/server.ts`. Newer modules use application services in `apps/web/src/server/app/` and repositories in `apps/web/src/server/infra/supabase/`.
- **Safe submission staging:** `POST /api/space-admin/[spaceId]/notifications/preview` performs audience costing without sending. The adjacent `/send` route dispatches real notifications and must remain outside a normal monitor.
- **Vote discovery:** public `GET /api/votes` is read-only and aggregate-only. `POST /api/votes` creates a proposal; `POST /api/votes/[id]/participate` records a real ballot and changes tallies.
- **Payments:** `POST /api/payments/create` is a real payment-creation boundary. All files under `apps/web/src/app/api/payments/` are protected.
- **Incident GitHub seam:** extend the `gh` CLI wrapper pattern in `.agentic/runner/src/github.ts` with issue search/create/comment operations. It currently has no incident-label, fingerprint, recurrence, or recovery functions.
- **Notification seam:** `.agentic/runner/src/mailer.ts` demonstrates event-key idempotency through `lane.emailsSent`; `scripts/agentic/notify-deployment.mjs` demonstrates best-effort GitHub/Telegram delivery. Monitor state cannot reuse `LaneState` unchanged because it is PR-lifecycle-specific.
- **Logging/evidence:** `apps/web/src/lib/logger.ts` supplies structured timestamps but not route-level correlation IDs. Playwright must capture response correlation headers if they exist or document their absence.
- **Migration numbering:** the latest checked-in migration is `supabase/migrations/20260811000004_pilot_program.sql`. Any new migration must sort after `20260811000004`; no monitor schema exists.
- **Mutation ports:** the space-admin approval path isolates charging behind `CreationFeePort` in `apps/web/src/server/app/space-admin/ports/creation-fee.ts`. Production canaries must not bind the real implementation merely to prove staging behavior.

## Prior art

The nearest merged PR is **#117**, commit `562e4a0`, “PR autopilot scaffold — two-lane spec-gated delivery.” Copy its explicit state model, GitHub CLI wrapper, event-key notification idempotency, configuration boundary, and human-controlled lifecycle. Do not copy its PR-specific assumption that every report belongs to a lane or draft PR.

For visual evidence specifically, merged PR **#93**, commit `9d6bc53`, is the closest pattern: seeded fixtures, deterministic desktop/mobile Playwright projects, committed screenshots, API failure states, and separation between preview and irreversible actions.

For Cloudflare scheduling, commit `c464b89` is the exact precedent for the custom Worker `scheduled` handler and mirrored Wrangler trigger configuration.

## Constraint register

- `.github/workflows/`, `supabase/migrations/`, and `apps/web/src/app/api/payments/` are protected paths in [.agentic/config.json](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/.agentic/config.json>). A workflow scheduler, persistent incident schema, or payment canary may trigger protected-path approval.
- Live database migration state is not represented in the working tree, so whether all checked-in migrations through `20260811000004` are applied cannot be verified read-only.
- Cloudflare schedules are partially unapplied operationally: `worker.ts` maps six schedules, while `wrangler.jsonc` registers only the Knesset agenda schedule. Comments explicitly record an account-level multi-schedule deployment gate.
- Issue #84 is downstream of the still-described observability/operations umbrella #102 in [docs/WORK-ORDER.md](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/docs/WORK-ORDER.md>). That document assigns `/api/health`, an admin dashboard, and alerting to #102, creating an ownership overlap.
- Existing smoke tests accept broad response ranges, including HTTP 500 for malformed JSON. Those assertions are unsuitable as production health contracts without tightening.
- Existing UI tests use mocked API data or local SQL seeds. They do not prove production canary isolation.
- No dedicated canary account, municipality/space, vote, notification audience, secret names, labels, or cleanup policy is checked into the tree.
- No visual regression matcher or stored baseline threshold exists; current screenshots are evidence captures, not pixel-diff baselines.
- The structured logger has an open defense-in-depth finding: it does not redact secret, token, or PII keys ([SECURITY-AUDIT.md](</Users/dolevseren/Desktop/projects/taruu-monorepo-autopilot/.agentic/worktrees/84/SECURITY-AUDIT.md>)). Monitor evidence must not log cookies, authorization headers, canary credentials, or resident data.
- The security audit also records open findings around cron authentication and raw error handling. A monitor must not normalize those behaviors into its own security design.
- GitHub workflow tokens may receive organization-policy `403` responses when posting issue comments; deployment notification already treats this as best-effort in `deploy.yml`.
- The working tree is clean. No uncommitted implementation or partially completed issue #84 files were found.

## Open questions

1. Does issue #84 own `/api/health`, the monitoring dashboard, and alert transport, or must those remain in issue #102 with #84 consuming them?
2. Should scheduling run from Cloudflare Worker cron, GitHub Actions, the existing agent VM/systemd infrastructure, or an external monitoring service?
3. Which exact production regions must be measured, and what execution platform provides those regions?
4. What are the approved canary account IDs, canary municipality/space IDs, authentication method, secret store, and rotation owner?
5. Which exact “survey/ballot dry-run” endpoint is authorized? The tree exposes real proposal and ballot mutations but no monitor-only dry-run contract.
6. Is notification preview sufficient for the notification canary, or is delivery to a canary-only recipient required?
7. What latency SLOs, retry count, controlled-confirmation interval, timeout, and visual-difference threshold define a credible failure?
8. What stable fingerprint fields define identical incidents, and which GitHub label/title convention identifies monitor-owned issues?
9. Which immediate alert destinations are required—email, Telegram, GitHub, or another channel—and who receives recovery notifications?
10. Where should run history, screenshots, traces, and dashboard data be retained, and what are their retention and access-control requirements?
11. How will seeded failure injection be activated safely in production without exposing a public failure switch or affecting resident traffic?
12. Does “without closing or moving the issue automatically” permit adding/removing labels or editing the issue body on recovery, or only posting a comment?