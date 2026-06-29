# Taruu (סינק) — Civic Consensus Platform

## What This Is

Taruu is a civic-consensus platform for Israeli municipalities: residents pay **₪6 once a month** (on their first vote) to vote freely on local affairs the rest of the month, and a civic share pools monthly to fund the decisions that execute. It's a built, code-reviewed Next.js app (Cloudflare Workers/OpenNext + Supabase), Hebrew/RTL, web-first. This milestone makes the money rails real: move vote payments to a Green Invoice card-on-file **monthly membership** (first vote of the month = ₪6, rest free), and go live.

## Core Value

A resident pays ₪6 once a month to vote freely on their city's affairs, and trusts that the civic pool funds the decisions that actually execute.

## Requirements

### Validated

<!-- Existing, working capabilities inferred from the codebase map (.planning/codebase/). -->

- ✓ Civic voting: create vote (₪50), participate (₪3 today), GPS-verified check-in — existing
- ✓ Vote payments via **Paddle** (`api/payments/create`, `api/payments/webhook`) with treasury deposit ledger — existing
- ✓ Merch checkout + fulfilment-less orders via **Green Invoice** (`api/merch/checkout`, `api/merch/webhook`) — existing (the GI pattern to model)
- ✓ Treasury ledger with idempotency (`record_treasury_deposit`, `UNIQUE uq_treasury_tx_payment`) — existing
- ✓ Auth via OAuth → custom JWT session (`public.user_id()` RLS helper); Auth0 OIDC swap landed — existing
- ✓ Solana compressed-NFT vote certificates, BAGS token backing — existing
- ✓ Cloudflare Workers deploy scaffold, OTP via Workers KV, Resend email — existing
- ✓ Clean foundation landed (Validated in Phase 1): Auth0 swap + Printful removal + RLS fixes committed as one clean commit (`44961e0`); corrective RLS migration `auth.uid()`→`public.user_id()` on treasury_transactions/issue_coin_holdings/phone_verifications (`31d6860`) — LAND-01, SEC-01

### Active

<!-- This milestone: P0 payments + go-live. Hypotheses until shipped. -->

- [x] Land the coherent uncommitted change (Auth0 swap + Printful removal + RLS fix) as one clean commit, with the two cleanups (dead Printful `.dev.vars` entries, orphaned `merch_orders` tracking columns) — ✓ Phase 1 (LAND-01)
- [x] Corrective RLS migration: `auth.uid()` → `public.user_id()` on the 3 remaining migrations (`treasury_transactions`, `issue_coin_holdings`, `phone_verifications`) — prerequisite before card-on-file writes treasury rows — ✓ Phase 1 (SEC-01)
- [ ] Green Invoice sandbox spike: verify off-session MIT token charge, 3DS/decline behavior, document return (gates production payment code)
- [ ] GI card-on-file **membership** payments: card saved once via `/payments/form`; the **first vote of each calendar month** charges the saved token **₪6** via `/payments/tokens/{id}/charge`, rest of month free; GI Prime plan
- [ ] Server-side **deterministic** idempotency key (replace the `Date.now()` key) + once-per-calendar-month charge gate + charge-then-commit + atomic accrual of ₪2.10 to the **monthly civic pool** (mirror `markMerchOrderPaid`)
- [ ] Payments webhook with secret in **header/HMAC** (NOT `?token=` — that leaks to Workers logs) + fail-closed in prod
- [ ] Drop Paddle for the vote-payment flow; restate pricing as "₪6/month, first vote then free" and civic share as "₪2.10/member/month → civic pool"
- [ ] Go live: real creds, GI Prime provisioned, deploy, e2e money check

### Out of Scope

- Vote-bags treasury **withdrawal/execution** engine — separate later milestone; its payout is gated on a license/trust structure + accountant/legal sign-off (`growth/SPEC-vote-bags-treasury.md`)
- Prepaid wallet / top-up packs — dropped; GI card-on-file ₪6/month membership replaces it
- Batching — dropped; one charge + one receipt per vote
- Crypto custody of civic money (USDC) — value stays in fiat; chain is transparency-only
- Mobile app payment surfaces — web-first
- Bags.fm speculative per-vote tokens — only a non-financial collectible is ever in scope, separately

## Context

Brownfield monorepo at `/Users/saharbarak/personal/taro`. Full codebase map at `.planning/codebase/`. Payment design in `growth/PRD-P0-payments.md` (codex-reviewed); economics in `growth/FINANCIAL-MODEL.md` (membership: ₪6/mo, net +₪2.47/member/mo on GI Prime; Target take-home ₪40k/mo at ~8,000 members + 900 creates — a growth bet). Treasury/bags engine in `growth/SPEC-vote-bags-treasury.md`. Security baseline in `SECURITY-AUDIT.md` (22 findings) + `.planning/codebase/CONCERNS.md`.

Key codebase facts: votes are on Paddle, merch is already on Green Invoice (reuse its idempotency, NOT its `?token=` transport). `markMerchOrderPaid` atomic `WHERE status='pending'` is the idempotency template. Existing payment idempotency key uses `Date.now()` (broken). 3 RLS migrations still use `auth.uid()` (latent HIGH).

## Constraints

- **Tech stack**: Next.js on Cloudflare Workers/OpenNext, Supabase (Postgres + RLS + custom JWT), TypeScript strict. No hardcoded values; design tokens only. Hebrew/RTL.
- **Payments**: Green Invoice (morning) card-on-file, **Prime plan required** (₪0.15/receipt). **Membership: ₪6 on the first vote of a calendar month, rest of month free**; ₪50 create. The ₪6 splits ₪2.10 → monthly civic pool / ₪3.90 → platform.
- **Hard gate (blocks production payment code)**: GI sandbox spike + accountant/legal merchant-of-record sign-off + GI Prime + real creds.
- **Security**: civic money + PII. Webhooks fail-closed in prod, constant-time secret compare, server-side idempotency, RLS correct before treasury writes.
- **Process**: never commit with Claude/Anthropic as co-author (user's global rule).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rail Paddle → Green Invoice card-on-file (vote flow) | Paddle's ₪1.85 fixed fee makes small charges lose money; GI is %+low-fixed | — Pending (spike) |
| **Membership model: ₪6 first vote of month, rest free** (was ₪5/vote) | Lower friction → more participation; bet free voting grows the funnel. Net ₪2.47/member/mo | ✓ Owner-locked 2026-06-29 |
| GI Prime plan mandatory | ₪0.15/receipt rate; economics break on Best (₪1.00/receipt) | — Pending |
| Treasury = **₪2.10/member/month → monthly pool** (not per-vote, not 70%) | Free votes can't fund per-vote treasury; pool funds the month's executed decisions | ✓ Owner-locked 2026-06-29 |
| Vote-bags withdrawal deferred to later milestone | Holding/disbursing public money needs a license/trust structure | — Pending (legal) |
| Land uncommitted Auth0+Printful+RLS as one commit | Concerns audit verdict: coherent + landable | ✓ Done Phase 1 (`44961e0`) |

---
*Last updated: 2026-06-29 — Phase 1 (Clean Foundation) complete: LAND-01 + SEC-01 validated.*
