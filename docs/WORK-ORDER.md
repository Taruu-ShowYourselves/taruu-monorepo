# Work Order — Grand Release Crunchtime

*Updated: 2026-08-16, v3 — priorities ingested from the board after Sahar's re-tiering. Board: [Project #2](https://github.com/orgs/Taruu-ShowYourselves/projects/2/views/1). Priority scheme: `M0` = milestone-now (user-flagged must-haves), `P0`–`P3` = severity order, `M4` = horizon.*

Owners: **S** = SaharBarak, **D** = DolevSeren.

**Production is live** on Cloudflare (taruu.co.il). Nothing below is go-live work; it is hardening, completion, and expansion of a running product.

---

## PR triage — DONE 2026-08-16

| PR | Outcome |
|----|---------|
| #104 creation-fee capture guard | **Merged** (reviewed, tests green on merged state). |
| #103 merch webhook hardening | **Reviewed, mergeable, awaiting admin merge.** Header-only secret + provider document confirmation, fails closed in prod. |
| #116 CI runner variable | **Open, fresh.** Salvaged from #109 (25 lines, `CI_RUNS_ON`). Awaiting merge. |
| #110 identity scoring (D) | **Reviewed: MERGE.** 358 tests green on merge with main. Awaiting S approval + merge. Deploy note: apply migration `20260807000001` as a targeted single migration. MEDIUM follow-up filed under #22. |
| #100 payment rails | **Reviewed: BLOCK.** Kill switch solid, but (1) HIGH webhook forgery hole — header-less path validates document *existence*, not *ownership*; (2) creation-flow rewrite conflicts with main's submit-free → review → charge-on-approval model. Rebase keeping flag/env-gate/webhook-hardening/idempotency, drop the create-page rewrite, add document→payment binding (#103's merch pattern). |
| #109 / #92 / #6 | **Closed** — superseded (#116), zero unique content, wrong host respectively. |

Issues closed in the sweep: #115, #18 (already implemented), #10 (superseded model), #13 (dup of #22), #21 (→ #102), #28 (→ #12 + #84), #11 (deployed long ago; CI-token + cron residuals → #102).

---

## Lane M0 — milestone-now (user-flagged)

| Item | Owner | Notes |
|------|-------|-------|
| **#73** React Native iOS + Android apps, web parity | S | Step 0 is unblocking the toolchain: root `pnpm.overrides` pin for `@types/react` (130 `TS2786` errors), then strip stale payment UI (`create.tsx` still pushes `/payment/checkout`), then parity build: Knesset/national arena, spaces, feed, identity score 0–140 displays (post-#110). Big track — runs parallel to the P0 lane. |
| **#25** Automatic angels reachout | S | WhatsApp + LinkedIn + angel platforms, discovery & reachout. Independent of product lanes; can start immediately. |
| **agents#75** Anti-bot in post comments | D (unassigned — assign) | Protects the Facebook surface the fleet depends on. |

## Lane P0 — security + RBAC completion (S)

| Order | Item | Notes |
|-------|------|-------|
| 1 | **RLS hotfixes** (part of **#22**) | Three migrations, immediately: scope `webhook_events` policies (anon can delete the replay guard); restrict `vote_nfts` SELECT (user↔wallet leak); column-restrict the `users` self-UPDATE policy (PR #110 follow-up). |
| 2 | **Apply + prove space migrations 0010–0014** | Clears `.planning/STATE.md:263`; capture transcript, run `supabase/tests/audit_append_only.sql`. |
| 3 | **#101** Finish RBAC Phase 5 (plans 05-04…05-09) | Isolation harness → applicant API → admin review API → applicant screen → `/admin/manager-applications` → manual gate + first `super_admin`. Unblocks #68, #69, #76, #113. |
| 4 | **#22** full security pass | Beyond hotfixes: SECURITY-AUDIT findings 1/2/4/6, then Phase 7 service-role migration (16 plans) as its own block. |

## Lane P1 — hardening + near features

| Order | Item | Owner | Notes |
|-------|------|-------|-------|
| 1 | **#68** moderation dashboard close-out | S | Lands with #101's 05-08 console; verify acceptance criteria, close. |
| 2 | **#71** TOTP 2FA + score | D | After PR #110 merges. Zero TOTP code exists today. |
| 3 | **#12** backend e2e | S | Playwright beyond smoke: participate flow, RBAC role matrix, no-payment paths; add CI e2e job. |
| 4 | **#72** mobile-web audit | S | Route-by-route viewport matrix; P0/P1 defect fixes; regression specs. Feeds the M0 RN-parity work. |
| 5 | **#23 / #69** payments ON | S | Blocked external: SPIKE-02 legal + SPIKE-03 Grow approval. Then: rebase+fix #100 per review, GI sandbox matrix (SPIKE-01), Phase 3 plans, flip the flag, PAY-06 capture, #69 research packet. Delete stale `/pricing` copy. |
| 6 | **#106** gamification | S | Bumped by Sahar to P1. Score model is now canonical per #110 (0–140, DB-owned) — badges/rewards/credits build on it; keep rewards strictly separate from identity confidence per the issue spec. Store-credit redemption depends on payments/merch state. |
| 7 | **#40** pitch deck A+B | S | Parallel business track. |
| 8 | **agents#68** admin stats dashboard | D | Bumped to P1. |
| 9 | **agents#73** private-groups bug · **agents#71** poster agent | D | In progress. |

## Lane P2 — product depth + ops

| Order | Item | Owner | Notes |
|-------|------|-------|-------|
| 1 | **#102** observability + ops umbrella | S | In progress. Absorbs #21 war-room + #11 residuals (CI deploy token, cron registration). Sentry-class layer + `/api/health` + admin dashboard + Expo push alerts. Consumes agents#72 + #84 signals. |
| 2 | **#74** spaces, orgs, notifications | S | Creation path for `organization`/`urban_area`/`nationwide_civic` types, authz fix (non-municipal spaces refused by `authorize()`), notifications inbox UI. |
| 3 | **#113** Knesset public-agenda promotion | S | Category taxonomy + promotion mechanic — neither exists. Depends on #101 + #74. |
| 4 | **#70** (monorepo) survey-gated ballot | S | No survey schema exists; reuse knesset-ranker infra. Depends on #101. |
| 5 | **#76** municipality authority dashboard | S | Phase 8 (13 plans) written; hard-depends on #101. |
| 6 | **#79** manager billing | S | Phase 6 (11 plans); needs payments ON + RBAC done. |
| 7 | **#80** developer data API | S | After #22/Phase 7 so the data boundary is trustworthy. |
| 8 | **#81** authority/court escalation workspace | — | Depends on #76 authority model. |
| 9 | **#84** daily monitoring agent | D | Feeds #102. |
| 10 | **#83** daily pentest agent | S | After #22 pass, clean findings baseline. |
| 11 | **agents#70** consensus pipeline · **agents#74** fleet to 10 | D | Fleet expansion after agents#73 private-groups bug. |

## Lane P3 — later

**#77** government dashboard · **#78** NGO toolkit · **agents#69** civic marketing/ads (demoted by Sahar; blocked on approval flows anyway) · **#14–#17, #19, #20** marketing backlog (off-board).

## Lane M4 — horizon

**#86** discovery roadmap (Rant, Cherry, municipal platform) — doc-only, no implementation authorized by it.

## Dependency spine

```
[done] PR triage
M0: #73 RN apps (S, typecheck pin first) ∥ #25 angels (S) ∥ agents#75 anti-bot (D)
   → RLS hotfixes + prove space migrations
      → #101 RBAC finish ──→ #68 close ──→ #113, #70, #76 ──→ #79, #81
      → #12 e2e / #72 mobile audit / #22 full pass ──→ #83, #80
      → [external: SPIKE-02 legal, SPIKE-03 Grow] ──→ #100 rebase+fix → #23 payments ON ──→ #69, #79, #106 credits
      → #74 spaces ──→ #102 observability ←── #84 (D), agents#72 (D)
      → #110 merge ──→ #71 TOTP (D), #106 badges (S)
```
