---
phase: 05
slug: space-governance-substrate-and-space-admin-operations-dashboard
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-02
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `05-RESEARCH.md` § Validation Architecture and reconciled against
> the 16 plan files as they stand after the round-2 revision (47 tasks).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^1.6.0` — **do not upgrade**. Registry current is 4.x; the repo pins 1.x and `parse()` in `server/http/respond.ts` depends on zod v3's `error.issues` shape |
| **Config file** | `apps/web/vitest.config.ts` — `environment: 'node'`, `globals: true`, `include: ['src/**/*.test.ts','src/**/*.spec.ts']`, `exclude: ['node_modules','tests/e2e/**']`, alias `@ → ./src`, `testTimeout: 10000` |
| **Second suite** | `packages/api-client` has its own `vitest run` (`packages/api-client/src/__tests__/`). Plan 05-10 Task 2 is the only task in the phase that runs it |
| **E2E** | Playwright, `apps/web/playwright.config.ts` (exists). Used only by 05-16, and only `--list` runs unattended — the screenshot run is the wave-6 checkpoint |
| **Quick run command** | `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin` |
| **Full suite command** | `pnpm --filter @sync/web test && pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint` |
| **Estimated runtime** | quick ~10-20s · full suite ~60-90s over 59 existing test files plus the 12 this phase adds (estimate, not measured) |

---

## Sampling Rate

- **After every task commit:** the task's own `<automated>` block. Every one of the 47 tasks has a non-empty one; none is a watch-mode invocation.
- **Within a wave:** targeted runs only. Sibling plans in a wave share one working tree, so a full-suite run mid-wave observes another plan's half-written files. Every plan states this in its own acceptance criteria, naming its wave-mates.
- **After every wave merge:** `pnpm --filter @sync/web test` plus `typecheck`. The `vote_status` widening in wave 1 reaches shared types, so regressions surface at this boundary rather than at the phase gate.
- **Phase gate:** the single full-suite run in the phase is 05-16 Task 2 — `typecheck && test && lint` — alone in wave 6, plus the manual SQL immutability probe recorded as evidence, before `/gsd:verify-work`.
- **Max feedback latency:** under 30 seconds for any single task's verify.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | SPACE-01, SPACE-04, SPACE-09 | unit/static | `grep -c "CREATE TABLE public.spaces\\|CREATE TABLE public.space_capability_grants\\|CREATE TABLE public.space_member_suspensions\\|CREATE TABLE public.space_audit_log\\|CREATE TABLE public.platform_escalations" supabase/migrations/20260802000001_space_governance.sql \| grep -qx 5 && grep -q "uq_spaces_municipality" supabase/migrations/20260802000001_space_governance.sql && grep -q "space_audit_log_no_truncate" supabase/migrations/20260802000001_space_governance.sql && ! grep -qE "ON DELETE CASCADE" supabase/migrations/20260802000001_space_governance.sql && echo MIGRATION_1_OK` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | SPACE-01, SPACE-04, SPACE-09 | unit/static | `test "$(grep -cvE '^\s*(--.*)?$' supabase/migrations/20260802000002_vote_status_review_values.sql)" = "4" && grep -q "idx_votes_review_queue" supabase/migrations/20260802000003_vote_review_gating.sql && ! grep -qE "in_review\|changes_requested\|rejected\|draft" <(grep -v '^\s*--' supabase/migrations/20260802000002_vote_status_review_values.sql \| grep -v 'ALTER TYPE') && echo ENUM_SPLIT_OK` | ✅ | ⬜ pending |
| 05-01-03 | 01 | 1 | SPACE-01, SPACE-04, SPACE-09 | unit/static | `pnpm --filter @sync/web typecheck && grep -q "export type SpaceAuditRow" apps/web/src/lib/supabase/types.ts && test -f supabase/tests/audit_append_only.sql && test "$(grep -c "'in_review'" apps/web/src/lib/supabase/types.ts)" -ge 4` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 1 | SPACE-02, SPACE-04, SPACE-05 | tdd | `pnpm --filter @sync/web exec vitest run src/server/domain/space/capability.test.ts` | ✅ | ⬜ pending |
| 05-02-02 | 02 | 1 | SPACE-02, SPACE-04, SPACE-05 | tdd | `pnpm --filter @sync/web exec vitest run src/server/domain/space/review.test.ts` | ✅ | ⬜ pending |
| 05-02-03 | 02 | 1 | SPACE-02, SPACE-04, SPACE-05 | unit/static | `pnpm --filter @sync/web typecheck && grep -q "QUOTA_EXCEEDED" apps/web/src/server/http/errors.ts && grep -q "case 'QUOTA_EXCEEDED'" apps/web/src/server/http/errors.ts && grep -q "export \* from './spaceAdmin'" packages/shared/src/contracts/index.ts && pnpm --filter @sync/web exec vitest run src/server/domain/space/capability.test.ts src/server/domain/space/review.test.ts` | ✅ | ⬜ pending |
| 05-03-01 | 03 | 2 | SPACE-05 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web exec vitest run src/__tests__/api/votes.test.ts src/__tests__/api/vote-detail.test.ts` | ✅ | ⬜ pending |
| 05-03-02 | 03 | 2 | SPACE-05 | unit/static | `pnpm --filter @sync/web typecheck && grep -q "PUBLIC_VOTE_STATUSES" apps/web/src/lib/supabase/db.ts && grep -q "getVoteByIdUnfiltered" apps/web/src/lib/supabase/db.ts && pnpm --filter @sync/web exec vitest run src/__tests__/api/votes.test.ts src/__tests__/api/vote-detail.test.ts` | ✅ | ⬜ pending |
| 05-03-03 | 03 | 2 | SPACE-05 | tdd | `pnpm --filter @sync/web exec vitest run src/__tests__/services/vote-status-visibility.test.ts` | ✅ | ⬜ pending |
| 05-04-01 | 04 | 2 | SPACE-02, SPACE-03, SPACE-09 | unit/static | `pnpm --filter @sync/web typecheck && grep -q "unique symbol" apps/web/src/server/app/space-admin/authorize.ts && ! grep -qE "^export (async )?function (update\|delete)" apps/web/src/server/infra/supabase/space-audit.repo.ts && test "$(grep -c "import 'server-only'" apps/web/src/server/app/space-admin/authorize.ts apps/web/src/server/infra/supabase/space.repo.ts apps/web/src/server/infra/supabase/space-audit.repo.ts \| grep -c ':1')" = "3"` | ✅ | ⬜ pending |
| 05-04-02 | 04 | 2 | SPACE-02, SPACE-03, SPACE-09 | tdd | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-object-authz.test.ts` | ✅ | ⬜ pending |
| 05-04-03 | 04 | 2 | SPACE-02, SPACE-03, SPACE-09 | tdd | `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-object-authz.test.ts src/__tests__/api/space-admin-capability-matrix.test.ts src/__tests__/api/space-admin-suspension.test.ts` | ✅ | ⬜ pending |
| 05-04-04 | 04 | 2 | SPACE-02, SPACE-03, SPACE-09 | checkpoint | `test "$(grep -rn 'as unknown as SpaceScope' apps/web/src --include=*.ts \| grep -vc '__tests__')" = "1" && pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-object-authz.test.ts src/__tests__/api/space-admin-capability-matrix.test.ts src/__tests__/api/space-admin-suspension.test.ts` | ✅ | ⬜ pending |
| 05-05-01 | 05 | 3 | SPACE-04, SPACE-05 | unit/static | `pnpm --filter @sync/web typecheck && grep -q "\.eq('status', prior)" apps/web/src/server/infra/supabase/space-decision.repo.ts && grep -q "maybeSingle" apps/web/src/server/infra/supabase/space-decision.repo.ts && ! grep -q "select('\*')" apps/web/src/server/infra/supabase/space-decision.repo.ts` | ✅ | ⬜ pending |
| 05-05-02 | 05 | 3 | SPACE-04, SPACE-05 | tdd | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-decide.test.ts` | ✅ | ⬜ pending |
| 05-05-03 | 05 | 3 | SPACE-04, SPACE-05 | tdd | `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-decide.test.ts src/__tests__/api/space-admin-audit.test.ts` | ✅ | ⬜ pending |
| 05-06-01 | 06 | 3 | SPACE-06, SPACE-09 | unit/static | `pnpm --filter @sync/web typecheck && ! grep -qE "identity_documents\|id_number\|date_of_birth\|did_encrypted\|access_token_encrypted" apps/web/src/server/infra/supabase/space-member.repo.ts && ! grep -q "select('\*')" apps/web/src/server/infra/supabase/space-member.repo.ts && ! grep -qE "\.delete\(\)" apps/web/src/server/infra/supabase/space-member.repo.ts` | ✅ | ⬜ pending |
| 05-06-02 | 06 | 3 | SPACE-06, SPACE-09 | tdd | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-members.test.ts src/__tests__/api/space-admin-content.test.ts` | ✅ | ⬜ pending |
| 05-06-03 | 06 | 3 | SPACE-06, SPACE-09 | tdd | `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-members.test.ts src/__tests__/api/space-admin-content.test.ts` | ✅ | ⬜ pending |
| 05-07-01 | 07 | 3 | SPACE-07, SPACE-04 | unit/static | `pnpm --filter @sync/web typecheck && grep -q "SECURITY DEFINER" supabase/migrations/20260802000004_space_admin_metrics.sql && grep -q "SET search_path = ''" supabase/migrations/20260802000004_space_admin_metrics.sql && grep -q "BETWEEN 1 AND 4" supabase/migrations/20260802000004_space_admin_metrics.sql && ! grep -qE "GRANT EXECUTE.*TO (anon\|authenticated)" supabase/migrations/20260802000004_space_admin_metrics.sql && grep -q "space_admin_metrics" apps/web/src/lib/supabase/types.ts` | ✅ | ⬜ pending |
| 05-07-02 | 07 | 3 | SPACE-07, SPACE-04 | tdd | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-metrics.test.ts src/__tests__/api/space-admin-audit-read.test.ts` | ✅ | ⬜ pending |
| 05-07-03 | 07 | 3 | SPACE-07, SPACE-04 | tdd | `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-metrics.test.ts src/__tests__/api/space-admin-audit-read.test.ts` | ✅ | ⬜ pending |
| 05-08-01 | 08 | 3 | SPACE-08 | unit/static | `pnpm --filter @sync/web typecheck && grep -q "uq_delivery_once" supabase/migrations/20260802000005_space_notifications.sql && grep -q "public.user_id()" supabase/migrations/20260802000005_space_notifications.sql && ! grep -q "auth.uid()" supabase/migrations/20260802000005_space_notifications.sql && grep -q "export type SpaceNotificationCampaign" apps/web/src/lib/supabase/types.ts` | ✅ | ⬜ pending |
| 05-08-02 | 08 | 3 | SPACE-08 | tdd | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-audience.test.ts` | ✅ | ⬜ pending |
| 05-08-03 | 08 | 3 | SPACE-08 | tdd | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-audience.test.ts` | ✅ | ⬜ pending |
| 05-09-01 | 09 | 4 | SPACE-08, SPACE-09 | tdd | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-notifications.test.ts` | ✅ | ⬜ pending |
| 05-09-02 | 09 | 4 | SPACE-08, SPACE-09 | unit/static | `pnpm --filter @sync/web typecheck && grep -q "await import('@/server/infra/supabase/push.repo')" apps/web/src/server/infra/notify/space-campaign.ts && grep -q "after(task)" apps/web/src/app/api/space-admin/\[spaceId\]/notifications/send/route.ts` | ✅ | ⬜ pending |
| 05-09-03 | 09 | 4 | SPACE-08, SPACE-09 | tdd | `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-notifications.test.ts` | ✅ | ⬜ pending |
| 05-10-01 | 10 | 4 | SPACE-05 | tdd | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web exec vitest run src/__tests__/api/votes.test.ts && ! grep -q "paymentTxId" apps/web/src/server/app/votes/create-vote.ts && grep -q "submissionStatus" apps/web/src/server/app/votes/create-vote.ts` | ✅ | ⬜ pending |
| 05-10-02 | 10 | 4 | SPACE-05 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/api-client exec vitest run src/__tests__/votes.test.ts && ! grep -q "payments/create" "apps/web/src/app/[locale]/votes/create/page.tsx" && ! grep -q "pendingVote" "apps/web/src/app/[locale]/payments/return/page.tsx" && grep -q "fetch('/api/votes'" "apps/web/src/app/[locale]/votes/create/page.tsx" && ! grep -q "paymentTxId" packages/api-client/src/votes.ts` | ✅ | ⬜ pending |
| 05-10-03 | 10 | 4 | SPACE-05 | unit/static | `pnpm --filter @sync/web typecheck && grep -q "CREATION_FEE_AGOROT = 5000" apps/web/src/server/app/space-admin/ports/creation-fee.ts && grep -q ":vote_creation" apps/web/src/server/infra/payments/creation-fee.ts && ! grep -q "Date.now()" apps/web/src/server/infra/payments/creation-fee.ts` | ✅ | ⬜ pending |
| 05-10-04 | 10 | 4 | SPACE-05 | tdd | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-approve-charge.test.ts src/__tests__/api/space-admin-decide.test.ts` | ✅ | ⬜ pending |
| 05-11-01 | 11 | 2 | SPACE-10 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint && ! grep -rn "header-height" apps/web/src/components/space-admin apps/web/src/app/\[locale\]/space-admin && ! grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/web/src/components/space-admin/*.css apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/*.css && grep -q "@radix-ui/react-alert-dialog" apps/web/package.json` | ✅ | ⬜ pending |
| 05-11-02 | 11 | 2 | SPACE-10 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint && grep -q 'scope="row"' apps/web/src/components/space-admin/PressTable.tsx && grep -q "prefers-reduced-motion" apps/web/src/components/space-admin/PressTable.module.css` | ✅ | ⬜ pending |
| 05-11-03 | 11 | 2 | SPACE-10 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint && grep -q ":disabled:hover" apps/web/src/components/space-admin/ConfirmDialog.module.css && grep -q "np-red-dark" apps/web/src/components/space-admin/ConfirmDialog.module.css && ! grep -q "opacity" apps/web/src/components/space-admin/ConfirmDialog.module.css` | ✅ | ⬜ pending |
| 05-12-01 | 12 | 4 | SPACE-10, SPACE-02, SPACE-09 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint && grep -q "CAPABILITY_LABELS_HE" apps/web/src/components/space-admin/CapabilityManifest.tsx && grep -q "escalations" apps/web/src/components/space-admin/EscalationDialog.tsx && ! grep -q "mailto:" apps/web/src/components/space-admin/EscalationDialog.tsx` | ✅ | ⬜ pending |
| 05-12-02 | 12 | 4 | SPACE-10, SPACE-02, SPACE-09 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint && ! grep -nE "from '@/(lib/supabase\|server/infra)" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/page.tsx apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/loading.tsx && grep -q "getSpaceOverview" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/page.tsx && ! grep -nE "#[0-9a-fA-F]{3,8}\b" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/page.module.css` | ✅ | ⬜ pending |
| 05-13-01 | 13 | 4 | SPACE-10, SPACE-05, SPACE-06 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint && grep -q "colSpan" apps/web/src/components/space-admin/ProposalDetailPanel.tsx && grep -q "68ch" apps/web/src/components/space-admin/ProposalDetailPanel.module.css && ! grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/web/src/components/space-admin/ProposalDetailPanel.module.css` | ✅ | ⬜ pending |
| 05-13-02 | 13 | 4 | SPACE-10, SPACE-05, SPACE-06 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint && ! grep -rnE "from '@/(lib/supabase\|server/infra)" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/proposals && grep -q "aria-expanded" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/proposals/ProposalsClient.tsx && grep -q "הצעה שהגשתם" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/proposals/ProposalsClient.tsx` | ✅ | ⬜ pending |
| 05-14-01 | 14 | 4 | SPACE-10, SPACE-06, SPACE-07 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint && ! grep -rnE "from '@/(lib/supabase\|server/infra)" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/members && grep -q "מסמכי זהות אינם נגישים מלוח זה" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/members/page.tsx` | ✅ | ⬜ pending |
| 05-14-02 | 14 | 4 | SPACE-10, SPACE-06, SPACE-07 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint && grep -q "מוסתר — קבוצה קטנה מדי" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/stats/page.tsx && ! grep -nE "statCard[^{]*:hover" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/stats/page.module.css && ! grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/stats/page.module.css` | ✅ | ⬜ pending |
| 05-15-01 | 15 | 5 | SPACE-10, SPACE-08, SPACE-04 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint && grep -q "מכסה מוצתה" apps/web/src/components/space-admin/QuotaBlock.tsx && ! grep -q "np-red-ink" apps/web/src/components/space-admin/QuotaBlock.module.css && ! grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/web/src/components/space-admin/QuotaBlock.module.css` | ✅ | ⬜ pending |
| 05-15-02 | 15 | 5 | SPACE-10, SPACE-08, SPACE-04 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint && grep -q "previewToken" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/dispatch/DispatchClient.tsx && grep -q "חשבו קהל יעד כדי לאפשר שליחה." apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/dispatch/DispatchClient.tsx && ! grep -rnE "from '@/(lib/supabase\|server/infra)" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/dispatch` | ✅ | ⬜ pending |
| 05-15-03 | 15 | 5 | SPACE-10, SPACE-08, SPACE-04 | unit/static | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint && grep -q "מוצגות" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/audit/AuditClient.tsx && grep -q "?proposal=" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/audit/AuditClient.tsx && ! grep -rnE "from '@/(lib/supabase\|server/infra)" apps/web/src/app/\[locale\]/space-admin/\[spaceId\]/audit` | ✅ | ⬜ pending |
| 05-16-01 | 16 | 6 | SPACE-10, SPACE-03, SPACE-04 | unit/static | `pnpm --filter @sync/web exec playwright test tests/e2e/space-admin.spec.ts --list` | ✅ | ⬜ pending |
| 05-16-02 | 16 | 6 | SPACE-10, SPACE-03, SPACE-04 | unit/static | `test -f .planning/phases/05-space-governance-substrate-and-space-admin-operations-dashboard/05-EVIDENCE.md && grep -q "SPACE-10" .planning/phases/05-space-governance-substrate-and-space-admin-operations-dashboard/05-EVIDENCE.md && grep -q "42501" .planning/phases/05-space-governance-substrate-and-space-admin-operations-dashboard/05-EVIDENCE.md && pnpm --filter @sync/web typecheck && pnpm --filter @sync/web test && pnpm --filter @sync/web lint` | ✅ | ⬜ pending |
| 05-16-03 | 16 | 6 | SPACE-10, SPACE-03, SPACE-04 | checkpoint | `ls apps/web/tests/e2e/__screenshots__/space-admin/*.png \| wc -l \| grep -qE '^\s*(1[6-9]\|[2-9][0-9])' && grep -q "SPACE-10" .planning/phases/05-space-governance-substrate-and-space-admin-operations-dashboard/05-EVIDENCE.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity: 100%.** All 47 tasks carry an executable `<automated>` verify — there is no run of three consecutive tasks without automated feedback, and no `MISSING` reference anywhere in the phase. The two checkpoint tasks (05-04-04 decision, 05-16-03 human-verify) carry automated verifies as well, so even the blocking gates produce a machine signal before they ask for a human.

---

## Requirement → Test Map

| Req | Behavior under test | Where | Automated command |
|-----|--------------------|-------|-------------------|
| SPACE-01 | `spaces` resolves to `municipality_code`; existing municipality columns untouched; five tables created; no `ON DELETE CASCADE` in the audit chain | 05-01-01, 05-01-03 | migration greps + `pnpm --filter @sync/web typecheck` |
| SPACE-02 | Default deny; capability matrix; a grant for the wrong capability is 403; `granted_via_role` never read | 05-04-03 | `… vitest run src/__tests__/api/space-admin-capability-matrix.test.ts` |
| SPACE-02 | Preset expansion is pure and total over `CAPABILITIES`; eleven labels 1:1 with the UI manifest | 05-02-01 | `… vitest run src/server/domain/space/capability.test.ts` |
| SPACE-03 | Swapped `spaceId` ⇒ 403 on read **and** mutate; body discloses nothing; the scope predicate is in the SQL | 05-04-02, 05-04-03, 05-06-03 | `… vitest run src/__tests__/api/space-admin-object-authz.test.ts` |
| SPACE-03 | A raw `spaceId` string is untypable at the data layer | 05-04-04 (checkpoint) | `grep -rn 'as unknown as SpaceScope'` returns exactly one hit outside `__tests__` |
| SPACE-04 | Missing or blank reason ⇒ 400 before any DB call; the audit row carries actor / prior / new / object / reason | 05-05-03 | `… vitest run src/__tests__/api/space-admin-audit.test.ts` |
| SPACE-04 | The repository exports no update and no delete | 05-04-01 | `! grep -qE "^export (async )?function (update\|delete)" …/space-audit.repo.ts` |
| SPACE-04 | `UPDATE` / `DELETE` / `TRUNCATE` on `space_audit_log` raise | **manual only** — see below | `psql -f supabase/tests/audit_append_only.sql` |
| SPACE-04 | The audit log reads back newest-first by cursor, with no total | 05-07-03, 05-15-03 | `… vitest run src/__tests__/api/space-admin-audit-read.test.ts` |
| SPACE-05 | Legal and illegal transitions; `pending` is not decidable; self-review refused | 05-02-02 | `… vitest run src/server/domain/space/review.test.ts` |
| SPACE-05 | A second concurrent decision ⇒ 409, no duplicate publication | 05-05-03 | `… vitest run src/__tests__/api/space-admin-decide.test.ts` |
| SPACE-05 | Public read paths exclude the four review statuses; the predicate is in the query, not a post-fetch filter | 05-03-03 | `… vitest run src/__tests__/services/vote-status-visibility.test.ts` |
| SPACE-05 | Submission is free and lands in `in_review`; nothing in the browser opens a checkout at submit time | 05-10-01, 05-10-02 | `… vitest run src/__tests__/api/votes.test.ts` + `pnpm --filter @sync/api-client exec vitest run src/__tests__/votes.test.ts` + the create-page greps |
| SPACE-05 | Approval charges the submitter through one port **before** it publishes, or does neither | 05-10-04 | `… vitest run src/__tests__/api/space-admin-approve-charge.test.ts` |
| SPACE-06 | Member, grant, suspension and content mutations are scoped and audited | 05-06-03 | `… vitest run src/__tests__/api/space-admin-members.test.ts src/__tests__/api/space-admin-content.test.ts` |
| SPACE-07 | The metrics response matches the contract allow-list; a 1–4 bucket is suppressed; no fabricated zero | 05-07-01, 05-07-03 | migration greps + `… vitest run src/__tests__/api/space-admin-metrics.test.ts` |
| SPACE-07 | The member listing contains no identity-document field | 05-06-01, 05-06-03 | repository greps + the serialization-guard regex case |
| SPACE-08 | Delivered set === previewed set; opt-outs suppressed; an audience-hash mismatch ⇒ 409 | 05-08-03, 05-09-03 | `… vitest run src/__tests__/api/space-admin-audience.test.ts src/__tests__/api/space-admin-notifications.test.ts` |
| SPACE-08 | The DB-counted per-space quota blocks before any fan-out ⇒ 429 | 05-09-01, 05-09-03 | same files |
| SPACE-09 | `suspended_at` set ⇒ the next request is 403; historical audit rows still readable | 05-04-03 | `… vitest run src/__tests__/api/space-admin-suspension.test.ts` |
| SPACE-09 | Escalation is reachable with zero capabilities and answers identically for every space id | 05-06-03 | the escalation-opacity `it.each` in `space-admin-content.test.ts` |
| SPACE-10 | Routes compile and render under `/he/space-admin/[spaceId]`; no hardcoded colours or pixel literals | 05-11 · 05-12 · 05-13 · 05-14 · 05-15 (all tasks) | `pnpm --filter @sync/web typecheck && lint` plus the per-surface `grep -rnE "#[0-9a-fA-F]{3,8}"` guards |
| SPACE-10 | Sixteen-plus screenshots at desktop and mobile widths | 05-16-01, 05-16-03 | `playwright test … --list` unattended; the capture run is the wave-6 checkpoint |

---

## Wave 0 Requirements

Wave 0 is **complete** — there is no separate scaffolding wave in this phase, because every test file a task references is created by that same task or by an earlier plan in the dependency graph. No `<automated>` block anywhere in the phase reads `MISSING`.

- [x] `pnpm install` at the worktree root — `node_modules` present at the root and under `apps/web`, so `test` and `typecheck` run. (This was open in `05-RESEARCH.md`; it has since been closed.)
- [x] Vitest configured — no framework install needed
- [x] Playwright configured — `apps/web/playwright.config.ts` exists; 05-16 Task 1 extends it
- [ ] Capture green `test` and `typecheck` baselines before the first wave-1 commit, so a later red is attributable
- [ ] `apps/web/src/__tests__/fixtures/space.ts` — the shared scope/grant fixture factory, created by **05-04 Task 3** and consumed by six later test files. It is the one ordering constraint that behaves like a Wave 0 item: 05-05, 05-06 and 05-07 all read it, and all three depend on 05-04

### Test files this phase creates

| File | Created by | Consumed by |
|------|-----------|-------------|
| `src/server/domain/space/capability.test.ts` | 05-02-01 | — |
| `src/server/domain/space/review.test.ts` | 05-02-02 | — |
| `src/__tests__/services/vote-status-visibility.test.ts` | 05-03-03 | — |
| `src/__tests__/fixtures/space.ts` | 05-04-03 | 05-05, 05-06, 05-07 test files |
| `src/__tests__/api/space-admin-object-authz.test.ts` | 05-04-03 | — |
| `src/__tests__/api/space-admin-capability-matrix.test.ts` | 05-04-03 | — |
| `src/__tests__/api/space-admin-suspension.test.ts` | 05-04-03 | — |
| `src/__tests__/api/space-admin-decide.test.ts` | 05-05-03 | 05-10-04 re-runs it |
| `src/__tests__/api/space-admin-audit.test.ts` | 05-05-03 | — |
| `src/__tests__/api/space-admin-members.test.ts` | 05-06-03 | — |
| `src/__tests__/api/space-admin-content.test.ts` | 05-06-03 | — |
| `src/__tests__/api/space-admin-metrics.test.ts` | 05-07-03 | — |
| `src/__tests__/api/space-admin-audit-read.test.ts` | 05-07-03 | — |
| `src/__tests__/api/space-admin-audience.test.ts` | 05-08-02 | — |
| `src/__tests__/api/space-admin-notifications.test.ts` | 05-09-01 | — |
| `src/__tests__/api/space-admin-approve-charge.test.ts` | 05-10-04 | — |
| `tests/e2e/space-admin.spec.ts` | 05-16-01 | — |
| `supabase/tests/audit_append_only.sql` | 05-01-03 | the manual probe below |

Two existing files are **rewritten rather than replaced**: `src/__tests__/api/votes.test.ts` (05-03-01 widens it, 05-10-01 rewrites the paid-path cases as free-path cases) and `packages/api-client/src/__tests__/votes.test.ts` (05-10-02 drops `paymentTxId` from the `createVote` input).

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Test instructions |
|----------|-------------|------------|-------------------|
| `UPDATE` / `DELETE` / `TRUNCATE` on `space_audit_log` raise `42501` | SPACE-04 | `vitest.config.ts` is `environment: 'node'` with Supabase fully mocked, and there is no live-DB harness in this repo. CI can only assert the weaker property that `space-audit.repo.ts` exports no update or delete function — which 05-04-01 does | Run `supabase/tests/audit_append_only.sql` against a throwaway database (`docker exec … psql -d scratch -f supabase/tests/audit_append_only.sql`) and paste the `42501` output into `05-EVIDENCE.md`. 05-16 Task 2 greps for `42501` in that file |
| Sixteen-plus dashboard screenshots at 390px and 1440px | SPACE-10 | Visual judgement — contrast, RTL layout, the `<5` suppression cell, the suspended-member row | 05-16 Task 3, `checkpoint:human-verify`. The capture run is `playwright test tests/e2e/space-admin.spec.ts`; the unattended gate is `--list` plus a screenshot count |
| `SpaceScope` ergonomics go/no-go | SPACE-03 | A design judgement the type system cannot make — whether the branded scope stays readable past ten repository functions | 05-04 Task 4, `checkpoint:decision`. Evidence is scripted (the `as unknown as SpaceScope` grep, the pasted signatures, a scratch-file `tsc` error); only the verdict is human |
| Stats surface responds to no click; stale banner appears on keystroke, not blur | SPACE-07, SPACE-08 | Interaction behaviour a node-environment test cannot observe | Listed in the `<verification>` blocks of 05-14 and 05-15 as manual checks; both are also covered structurally by greps (`:hover` absent on `.statCard`, three `setState('preview_stale')` call sites) |

---

## Known Sampling Limits

- **No mid-wave full-suite run, by design.** Sibling plans in a wave share one working tree. Every plan's acceptance criteria name their wave-mates and state why the run is targeted. The cost is that a cross-plan regression inside a wave surfaces at the wave merge rather than at the task commit.
- **`packages/api-client` runs separately.** Only 05-10 Task 2 touches it. `pnpm --filter @sync/web test` will not catch a break there; the wave-4 merge must run `pnpm --filter @sync/api-client test` as well.
- **Migrations are verified by grep, not by execution.** No plan applies a migration as part of its verify. The SQL is proven at the phase gate by the manual probe and by 05-16's seeded Playwright run.

---

## Validation Sign-Off

- [x] All 47 tasks have a non-empty `<automated>` verify; no Wave 0 `MISSING` references
- [x] Sampling continuity: no three consecutive tasks without an automated verify
- [x] Wave 0 covers all `MISSING` references — there are none
- [x] No watch-mode flags anywhere; the only Playwright invocation outside the wave-6 checkpoint is `--list`
- [x] Exactly one full-suite run in the phase (05-16 Task 2), alone in wave 6
- [x] Feedback latency < 30s per task
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
