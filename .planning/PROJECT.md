# Taruu (סינק) — Civic Consensus Platform

## What This Is

Taruu is a civic-consensus platform for Israeli municipalities: residents pay a small fee to vote on local affairs, and a fixed civic share of each vote pools into a per-vote treasury that funds the decision. It's a built, code-reviewed Next.js app (Cloudflare Workers/OpenNext + Supabase), Hebrew/RTL, web-first. This milestone makes the money rails solvent and real: swap the vote-payment rail to Green Invoice card-on-file at ₪5/vote, and go live.

## Core Value

A resident can pay for a civic vote and trust that the fixed ₪2.10 civic share reaches the treasury — every vote, provably, with the platform solvent on each transaction.

## Requirements

### Validated

<!-- Existing, working capabilities inferred from the codebase map (.planning/codebase/). -->

- ✓ Civic voting: create vote (₪50), participate (₪3 today), GPS-verified check-in — existing
- ✓ Vote payments via **Paddle** (`api/payments/create`, `api/payments/webhook`) with treasury deposit ledger — existing
- ✓ Merch checkout + fulfilment-less orders via **Green Invoice** (`api/merch/checkout`, `api/merch/webhook`) — existing (the GI pattern to model)
- ✓ Treasury ledger with idempotency (`record_treasury_deposit`, `UNIQUE uq_treasury_tx_payment`) — existing
- ✓ Auth via OAuth → custom JWT session (`public.user_id()` RLS helper); Auth0 OIDC swap in working tree — existing/in-progress
- ✓ Solana compressed-NFT vote certificates, BAGS token backing — existing
- ✓ Cloudflare Workers deploy scaffold, OTP via Workers KV, Resend email — existing

### Active

<!-- This milestone: P0 payments + go-live. Hypotheses until shipped. -->

- [ ] Land the coherent uncommitted change (Auth0 swap + Printful removal + RLS fix) as one clean commit, with the two cleanups (dead Printful `.dev.vars` entries, orphaned `merch_orders` tracking columns)
- [ ] Corrective RLS migration: `auth.uid()` → `public.user_id()` on the 3 remaining migrations (`treasury_transactions`, `issue_coin_holdings`, `phone_verifications`) — prerequisite before card-on-file writes treasury rows
- [ ] Green Invoice sandbox spike: verify off-session MIT token charge, 3DS/decline behavior, document return (gates production payment code)
- [ ] GI card-on-file vote payments: card saved once via `/payments/form`, every vote a server-side `/payments/tokens/{id}/charge` for **₪5**, GI Prime plan
- [ ] Server-side **deterministic** idempotency key (replace the `Date.now()` key) + charge-then-commit + atomic treasury accrual (mirror `markMerchOrderPaid`)
- [ ] Payments webhook with secret in **header/HMAC** (NOT `?token=` — that leaks to Workers logs) + fail-closed in prod
- [ ] Drop Paddle for the vote-payment flow; restate "70% treasury" → "fixed ₪2.10/vote"
- [ ] Go live: real creds, GI Prime provisioned, deploy, e2e money check

### Out of Scope

- Vote-bags treasury **withdrawal/execution** engine — separate later milestone; its payout is gated on a license/trust structure + accountant/legal sign-off (`growth/SPEC-vote-bags-treasury.md`)
- Prepaid wallet / top-up packs — dropped; GI card-on-file at ₪5 replaces it
- Batching — dropped; one charge + one receipt per vote
- Crypto custody of civic money (USDC) — value stays in fiat; chain is transparency-only
- Mobile app payment surfaces — web-first
- Bags.fm speculative per-vote tokens — only a non-financial collectible is ever in scope, separately

## Context

Brownfield monorepo at `/Users/saharbarak/personal/taro`. Full codebase map at `.planning/codebase/`. Payment design in `growth/PRD-P0-payments.md` (codex-reviewed); economics in `growth/FINANCIAL-MODEL.md` (₪5/vote nets +₪1.48 on GI Prime; Target take-home ₪50.6k/mo). Treasury/bags engine in `growth/SPEC-vote-bags-treasury.md`. Security baseline in `SECURITY-AUDIT.md` (22 findings) + `.planning/codebase/CONCERNS.md`.

Key codebase facts: votes are on Paddle, merch is already on Green Invoice (reuse its idempotency, NOT its `?token=` transport). `markMerchOrderPaid` atomic `WHERE status='pending'` is the idempotency template. Existing payment idempotency key uses `Date.now()` (broken). 3 RLS migrations still use `auth.uid()` (latent HIGH).

## Constraints

- **Tech stack**: Next.js on Cloudflare Workers/OpenNext, Supabase (Postgres + RLS + custom JWT), TypeScript strict. No hardcoded values; design tokens only. Hebrew/RTL.
- **Payments**: Green Invoice (morning) card-on-file, **Prime plan required** (₪0.15/receipt — economics break on cheaper tiers). ₪5/vote, ₪50 create. Treasury fixed ₪2.10/vote, invariant.
- **Hard gate (blocks production payment code)**: GI sandbox spike + accountant/legal merchant-of-record sign-off + GI Prime + real creds.
- **Security**: civic money + PII. Webhooks fail-closed in prod, constant-time secret compare, server-side idempotency, RLS correct before treasury writes.
- **Process**: never commit with Claude/Anthropic as co-author (user's global rule).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rail Paddle → Green Invoice card-on-file (vote flow) | Paddle's ₪1.85 fixed fee makes small charges lose money; GI is %+low-fixed | — Pending (spike) |
| Participation ₪3 → ₪5, no batch, no top-ups | ₪5 on GI Prime nets +₪1.48/vote, clears ≥₪1 floor with simplest UX | ✓ Good (owner-locked) |
| GI Prime plan mandatory | ₪0.15/receipt rate; economics break on Best (₪1.00/receipt) | — Pending |
| Treasury = fixed ₪2.10/vote (not 70%) | Civic promise is an amount; survives price change | ✓ Good |
| Vote-bags withdrawal deferred to later milestone | Holding/disbursing public money needs a license/trust structure | — Pending (legal) |
| Land uncommitted Auth0+Printful+RLS as one commit | Concerns audit verdict: coherent + landable | — Pending |

---
*Last updated: 2026-06-28 after initialization (brownfield, synthesized from PRD/spec/roadmap + codebase map)*
