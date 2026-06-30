# GI Prime + Credentials + Clearing Terms Checklist (SPIKE-03)

> **Status: PENDING** — external human track; gates Phase 4 go-live, not Phase 3 build.
> Work through this with the Green Invoice account rep when staging production secrets.

## Context

The unit economics depend on the GI **Prime** plan at **₪0.15 per receipt**. Per-charge
breakdown: ₪6 membership → ₪2.10 civic pool + ₪3.90 platform (net ~₪2.47/member/mo after
the ₪0.15 receipt fee + clearing). A standard per-receipt fee above ₪0.15, or a
percentage-based clearing cost the model did not assume, collapses the platform margin.
Additionally, a **~3.5% tourist/foreign-card surcharge** on the ₪6 charge erodes more
than half the ₪3.90 platform margin — this must be resolved (block or flag) before
go-live. Prime rate + clearing terms must be confirmed in writing before any production
traffic is enabled.

---

## GI Prime plan

- [ ] **Written confirmation at ₪0.15/receipt:** Obtain a written statement (email,
  contract, or GI account portal export) from the GI account rep confirming the
  **Prime plan is active**, the per-receipt fee is exactly **₪0.15**, and no
  percentage-of-transaction fee applies on top of it.
- [ ] **Effective date:** Confirm in writing the date from which the Prime rate applies —
  specifically that it is in effect from the first go-live transaction, not from a later
  billing cycle.
- [ ] **Volume minimum / monthly platform fee:** Confirm in writing whether Prime carries
  a minimum monthly receipt volume, a monthly platform fee, or any other recurring cost.
  Record the exact figures: ₪____ monthly fee / ____ receipts minimum. If none, confirm
  that in writing.
- [ ] **Both receipt types at Prime rate:** Explicitly confirm that both the **₪6
  membership charge receipt** (חשבונית קבלה, first vote of the month) and the **₪50
  vote-creation receipt** are billed at the ₪0.15 Prime rate — not at a higher tier,
  a percentage rate, or a different plan tier.

---

## Real credentials staged

Stage all of the following in the Cloudflare Workers secret store via
`./scripts/sync-secrets.sh` (run from `apps/web/`). Tick each checkbox after
`node_modules/.bin/wrangler secret list` confirms the key is present.

**Green Invoice production credentials:**
- [ ] `GREENINVOICE_API_KEY_ID` — production API key ID from GI Settings → API
- [ ] `GREENINVOICE_API_SECRET` — production API secret from GI Settings → API
- [ ] `GREENINVOICE_PLUGIN_ID` — production plugin ID from GI account settings
- [ ] `GREENINVOICE_WEBHOOK_SECRET` — regenerated for production (do not reuse the
  sandbox value; update the webhook endpoint in GI dashboard to match)

**Green Invoice runtime flag (wrangler.jsonc `vars` block — not a secret):**
- [ ] `GREENINVOICE_ENV=production` — flip from `sandbox` in `wrangler.jsonc` before
  deploying; `sync-secrets.sh` skips `GREENINVOICE_ENV` by design (it is in `SKIP`)

**Supabase production credentials:**
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — production Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — production anon key (build-time; push for parity)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — production service-role key (server-side only; never
  exposed to the client)

**Verification steps:**
- [ ] Run `./scripts/sync-secrets.sh --dry-run` to confirm all keys above are non-empty
  and would be pushed (empty/placeholder lines are skipped automatically)
- [ ] Run `./scripts/sync-secrets.sh` to push, then `node_modules/.bin/wrangler secret list`
  to confirm every key appears in the Worker's secret store
- [ ] Confirm `isGreenInvoiceConfigured()` returns `true` against the production
  configuration (or run the spike harness guard) before enabling live traffic

---

## Written clearing terms

Obtain the following in writing from GI and/or the acquiring bank before go-live.
Leave blank lines filled in once confirmed.

- [ ] **Clearing percentage (עמלת סליקה):** What is the exact percentage fee per settled
  transaction? Record: ____%. Confirm whether this applies on top of the ₪0.15 Prime
  receipt fee or substitutes it for percentage-billed transactions.
- [ ] **Hard minimum per transaction:** Is there a minimum clearing fee per transaction
  regardless of amount? Record: ₪____. A hard minimum above ~₪0.15 breaks the ₪6
  unit economics at low volumes — confirm the figure and model the impact.
- [ ] **Card-brand surcharges:** Does the clearing rate vary by card brand (Visa,
  Mastercard, Diners, Amex)? Obtain the surcharge schedule for each brand the platform
  will accept and record them.
- [ ] **Tourist / foreign-card surcharge:** Confirm the exact surcharge for non-Israeli /
  tourist / foreign-issued cards. Current estimate: ~3.5%. At this rate a ₪6 foreign-card
  charge incurs ~₪0.21 in surcharge, consuming more than 5% of the platform margin.
  **Decision required before go-live (pick one and record):**
  - Block foreign-card charges at `POST /payments/form` card-entry (detect card BIN
    country, reject non-IL cards with a localized error); or
  - Flag the surcharge to the user at card-entry time and allow them to proceed.
  Decision on file: ___________________________
- [ ] **Settlement payout threshold:** What is the minimum accumulated balance that
  triggers a payout from GI to the bank account? Record: ₪____. Confirm this is
  reachable at expected launch-week volumes.
- [ ] **Settlement cadence:** How frequently does GI settle to the bank account?
  Record: ___________________________ (daily / weekly / monthly / threshold-triggered).

---

## Sign-off

**GI account rep name:** ___________________________

**Date:** ___________________________

- [ ] Prime plan confirmed in writing at ₪0.15/receipt (effective date on file)
- [ ] All production credentials (`GREENINVOICE_API_KEY_ID`, `GREENINVOICE_API_SECRET`,
  `GREENINVOICE_PLUGIN_ID`, `GREENINVOICE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) staged in the
  Cloudflare Workers secret store and verified via `wrangler secret list`
- [ ] Written clearing terms on file: clearing %, hard minimum, brand surcharges,
  foreign-card surcharge decision (block or flag), settlement threshold + cadence

> Once all three boxes above are ticked: update `SPIKE-03` to Complete in
> `.planning/REQUIREMENTS.md` and remove from Phase 4 blockers in `.planning/STATE.md`.
