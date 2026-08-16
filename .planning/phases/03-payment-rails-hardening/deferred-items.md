# Phase 03 — Deferred Items

Out-of-scope discoveries logged during execution. Recorded, not fixed.

## From plan 03-08 (SEC-04, idempotency)

**`packages/shared/src/contracts/payment.ts:35` still declares `idempotencyKey: z.string().optional()`.**

The server no longer reads it: `POST /api/payments/create` dropped the field from
`CreatePaymentRequest` and derives the key itself, so a client that sends one is ignored
rather than trusted (SEC-04 is satisfied at the enforcement point). What remains is a wire
contract that still *advertises* a field the server discards — cosmetic, not a security hole.

Not fixed here because `packages/shared` is plan **03-03**'s file and is outside 03-08's
`files_modified`. Removing the field is a one-line change plus whatever `packages/api-client`
passes through; it belongs to whoever next owns the shared payment contract.

## From plan 03-07 (SEC-03) — the MERCH rail still puts the same secret in a URL

**This is the one deferred item in this file that is a live security exposure, not cosmetics.**

Plan 03-07 removed `GREENINVOICE_WEBHOOK_SECRET` from the *payments* notify URL. The
**merch** rail still transmits the **same shared secret** as a query parameter, in two
places, both verified in the tree on 2026-08-04:

- `apps/web/src/app/api/merch/checkout/route.ts:161-163` registers
  `notifyUrl = ${origin}/api/merch/webhook?token=${encodeURIComponent(webhookSecret)}`
- `apps/web/src/app/api/merch/webhook/route.ts:37-40` reads
  `new URL(request.url).searchParams.get('token')` **first**, then the header — a verbatim
  clone of the payments verifier as it stood before this plan

Both read `process.env.GREENINVOICE_WEBHOOK_SECRET`, so the secret the payments webhook now
guards is still leaking through referrers, proxy logs, browser history and edge request
logging on every merch checkout. Rotating it for production (an unticked box on
`GI-PRIME-CHECKLIST.md`) does not help while the merch rail keeps publishing the new value.

**Not fixed here** because neither file is in 03-07's `files_modified`, both are covered by
`__tests__/api/merch-webhook.test.ts` (owned by nobody in this phase), and the merch rail has
no equivalent of `confirmDocumentIssued` — a straight header-only swap would break merch
notifies exactly the way the payments plan's own analysis says it would have broken payments.
Closing it properly needs the same two-factor treatment: header-only comparison plus an
authenticated Green Invoice document lookup before the order is marked paid.

Phase 3 success criterion "no webhook secret in a URL" is therefore **only true for the
payments rail**. Recommend a follow-up plan before Phase 4 go-live, since go-live is when the
production secret first travels these URLs.

Also observed and **benign**: `apps/web/src/app/api/user/push-token/route.ts:129` reads
`searchParams.get('token')` — that is an Expo push token identifying a device registration,
not a shared secret, and it is behind a session check.

## From plan 03-09 (PAY-08, closing sweep)

Every item below was verified in the tree on 2026-08-04, after 03-09's three commits.

### 1. `TreasuryHero.tsx` still claims an annual independent accounting audit — twice

**This is the most exposed remaining money claim on the site, and 03-09 was forbidden to touch it.**

Plan 03-09 removed `ביקורת חשבונאית עצמאית` from the treasury board's receipt footer. The same
claim survives one component away, on the same page, in a *stronger* form:

- `apps/web/src/app/[locale]/treasury/components/TreasuryHero.tsx:63` — an entire pillar,
  `no: '03'`, titled `ביקורת עצמאית`: *"הקרן עוברת ביקורת חשבונאית עצמאית מדי שנה: גורם חיצוני
  מאמת שכל שקל במקומו."* This names a cadence (annual) and an external verifier.
- `.../TreasuryHero.tsx:103` — the standfirst repeats it: *"…והקרן עוברת ביקורת חשבונאית עצמאית."*

No audit exists, none is commissioned, and nothing in `.planning/` or `apps/web/docs/` schedules
one. `GI-LEGAL-CHECKLIST.md` (0/19) is a merchant-of-record question, not an audit engagement.

**Not fixed here** because 03-09's own acceptance criteria require `TreasuryHero.tsx` to be
untouched (`03-09-PLAN.md` interfaces block: *"`TreasuryHero.tsx:102` make[s] no percentage
claim; leave [it]"*, plus the `git diff --stat` criterion on T1). Honouring that boundary was the
right call for a wave-2 executor sharing a worktree, but the claim outlives this phase unless
someone owns it. It is a one-component edit: drop pillar 03 or restate it as what the page can
back (*the ledger is public and every movement is itemised*), and trim the standfirst clause.

### 2. `/economics` states the platform is self-sustaining from day one — in two places

03-05 recorded one instance and left it deliberately; there are two, and both are inside
`apps/web/src/app/[locale]/economics/`, which 03-09's verification requires it not to touch.

- `economics/components/FAQ.tsx:43` — *"…אנחנו לא תלויים במשקיעים חיצוניים. **המודל הכלכלי
  מתקיים מעצמו מהיום הראשון.**"*
- `economics/components/FlywheelDiagram.tsx:96` — `sustainabilityPoints[0]`:
  *"**הפלטפורמה מתקיימת מהיום הראשון**"*

With ₪50 creation fees as the sole revenue line and no revenue collected yet (the treasury board
still renders `ComingSoonBoard`), this is a forward-looking viability claim, not a ledger fact.
It is a different class from the retired `70/30` split — that one was contradicted by code, this
one is simply unproven — which is why 03-09 recorded it rather than sweeping it: PAY-08 is about
stating the money model correctly, and this is a claim about the business's prospects.

**Recommended replacement**, true today and needing no lawyer, since it removes a claim rather
than adding one:

- FAQ.tsx:43 → *"מדמי יצירת הצבעה: ₪50 על כל הצבעה חדשה. אנחנו לא תלויים במשקיעים חיצוניים,
  ודמי היצירה הם מקור ההכנסה היחיד שלנו."*
- FlywheelDiagram.tsx:96 → *"מקור הכנסה אחד וברור: דמי יצירת הצבעה"*

Whoever next owns `/economics` (plan 03-13, behind the COIN-01 gate, is the next scheduled
editor) should land both. Note 03-05's guard `economics-fee-split-copy.test.ts` asserts
`question: '` appears exactly 9 times in `FAQ.tsx`, so an answer-only edit is safe.

### 3. `Ticker.tsx:12` still publishes a hardcoded `1,247 קולות מאומתים נחתמו השבוע`

Recorded by 03-04, re-verified live. Not a money claim, so outside PAY-08 and outside 03-09's
file set, but it is a false factual statement to every homepage and `/explore` visitor: the
figure is a literal in `DEFAULT_ITEMS`, not a count. `Ticker.tsx:13`'s
`כל קול חתום בבלוקצ׳יין · בלתי ניתן לזיוף` belongs to the separately deferred chain-copy sweep
(`02.1-VALIDATION.md`).

### 4. `components/sections/FundTransparency/` is still in the tree, unmounted, membership-era

Re-verified: zero usages outside its own directory, and `monthlyAccumulation`
(`FundTransparency.tsx:26,37,148`) is an artefact of the retired ₪6/month pool accrual. Its
sibling `MoneyTransparency` was deleted by 03-04 on the same reasoning; this one was left because
it carries no live price and no split, so 03-09's sweep does not flag it. Deleting it is the
cheaper option than maintaining a component built on a retired model.

### 5. Closed by a sibling, recorded so nobody chases it

`services/greenInvoice/index.ts:218`'s *"Use for the monthly membership fee (₪6)"* docstring —
flagged to 03-09 by 03-04 — **is already gone**. The docstring now reads that the membership is
retired and Phase 6 is `chargeToken`'s only planned consumer. No action needed.

### 6. Deliberately left, and correct as written

- `apps/mobile/app/vote/[id].tsx:159` — a block comment quoting ₪3 while describing its
  retirement. Correct in context; the sweep strips comments precisely so this reads as history.
- `PricingContent.tsx:17`'s `זהות ו-GPS · חתום בבלוקצ׳יין` — the deferred chain-seal sweep, not a
  money claim. 03-09 asserts it is still present (`grep -c` returns exactly 1) so that a future
  diff cannot pre-empt that decision silently.
