# COIN-01 - Live Token Claim Inventory (Bags.fm / BAG)

> **Status: PENDING** - external human track. **This document is the QUESTION, not the answer.**
> It is the companion to `COIN-LEGAL-CHECKLIST.md`; section 3 of that checklist
> (`## מה מותר ומה אסור לומר לקונים`) is answered by ruling on the table below, row by row.
> COIN-01 is not satisfied until a written sign-off is on file; until then COIN-02, COIN-03 and
> COIN-04 remain blocked.

**Derived by source sweep on 2026-08-04**, at commit `676d1e4` on branch `feat/phase-3-payment-rails`.
Every `file:line` below was verified against the working tree at that moment. Paths are relative to
`apps/web/src/`.

## These surfaces are live now, ahead of the sign-off

`/he/coin`, `/he/coin/[id]`, `/he/economics`, `/he/explore`, `/he/treasury`, `/he/terms`, `/he/faq`
and `/he/privacy` all returned **HTTP 200** to an unauthenticated request against `taruu.co.il`
on 2026-08-04. `POST /api/bags/quote` and `POST /api/bags/swap` returned **401** unauthenticated,
i.e. they are deployed and session-gated. `GET /api/bags/trending` is deployed and currently returns
**500**.

ROADMAP Phase 3 success criterion #6 reads *"No token surface is live without written Israeli legal
sign-off."* **That criterion does not hold today.** This document records the fact; it does not
recommend a course of action.

One asymmetry is worth stating plainly, because it changes who has to wait for whom: **removing a
claim is not gated on the lawyer. Only keeping one, or rewording one, is.** A takedown or a deletion
of any row below is available immediately and is the owner's decision, not counsel's and not this
repository's.

## What the code can and cannot back today

These are engineering facts, verified in the tree at the commit above. They are the basis of the
**Backable today?** column. None of them is a legal position.

- **F1 - No code path can create a BAG today.** `services/treasury/bagSeeding.ts:70` (`seedVoteBag`)
  requires accrued funds, read by `lib/supabase/db.ts:1559` (`getAccruedIlsForVote`) as the sum of
  `treasury_transactions` rows of type `deposit` tagged with the vote. The only function that wrote
  such rows, `lib/supabase/db.ts:1530` (`recordTreasuryDeposit`), has had **zero production callers**
  since plan 03-02 removed it from the payments webhook. Accrual is therefore `0` for every vote and
  `seedVoteBag` returns `no_accrued_funds`.
- **F2 - The implemented flow runs opposite to the copy.** Where the copy says outside buyers fund the
  pool, the code converts pool fiat into SOL and uses it to *seed* the bag
  (`services/treasury/bagSeeding.ts:51`, `:70`). Money flows treasury → token, not token → treasury.
- **F3 - Nothing resolves votes or mints certificates on a schedule.** `seedVoteBag`'s only caller is
  vote resolution (`services/nft/index.ts:458`), driven by `/api/cron/resolve-votes`.
  `apps/web/wrangler.jsonc` schedules exactly one cron, `"0 */6 * * *"`, which `apps/web/worker.ts:39-42`
  maps to `/api/cron/knesset-agenda`. `resolve-votes` and `mint-nfts` are **not scheduled**.
- **F4 - There is no per-vote or per-municipality civic pool ledger.** That ledger is COIN-02, in plan
  `03-11`, which is blocked on this sign-off.
- **F5 - No trading-fee claim is implemented.** `services/bags/index.ts:326`
  (`createDefaultFeeShareConfig`, written as platform 10% / creator 10% / municipality 80%) is applied
  at launch only when `BAGS_PLATFORM_PROVIDER_ID` is set, and nothing calls `getClaimablePositions` or
  `createClaimTransactions` on any scheduled or user-triggered path.
- **F6 - Two market columns are placeholders.** `app/api/bags/trending/route.ts:70-71` hardcodes
  `priceChange24h: 0` and `volume24h: 0`; the `/coin` market table prints both as though measured.
  `app/[locale]/explore/components/BagsRow.tsx:31-35` documents a deliberate decision *not* to print
  them - the two surfaces disagree.
- **F7 - Taruu holds the wallet keys.** `BAGS_MASTER_WALLET_PRIVATE_KEY` and
  `BAGS_MASTER_WALLET_ADDRESS` are Worker secrets (names only; no value appears in this repository or
  in this document), and `apps/web/wrangler.jsonc:75` sets `QUBIK_NETWORK: "mainnet"`.
- **F8 - The swap endpoint trusts a client-supplied quote.** `app/api/bags/swap/route.ts:47` checks
  only that `inputAmount`, `outputAmount` and `fee` are *present* on a quote object sent by the client,
  then executes it. The quote the UI shows is not provably the quote that executes. That is COIN-03,
  plan `03-12`, blocked.

---

## Claim inventory

**The `Verdict` and `Replacement wording` columns are deliberately empty. They are counsel's to fill,
not this repository's.** For each row, mark **allowed** / **allowed-with-wording** / **prohibited**,
and where a claim is salvageable supply the replacement Hebrew wording.

Rows are sorted by risk: securities analogies and implied returns first, transparency statements last.
Conservative statements are included on purpose - a confirmation that safe wording is safe is what
gives plan `03-13` an approved vocabulary to rewrite toward.

`Backable today?` is an engineering judgement about the code, not a legal one. Where a sentence is
wrapped across several JSX lines the citation is a range and the quote is the rendered text; grep a
distinctive fragment to relocate it if the lines move.

| # | Surface (file:line) | Live? | The claim, quoted in Hebrew | Category | Backable today? | Verdict | Replacement wording |
|---|---|---|---|---|---|---|---|
| 1 | `app/[locale]/economics/components/FAQ.tsx:13` | yes · `/he/economics` | `אתה לא רק תורם, אלא מחזיק נכס שמייצג את התמיכה שלך, בדיוק כמו במניה.` | securities analogy | **no** - a BAG carries no ownership, dividend, or governance right in Taruu, in the municipality, or in the vote. Nothing in the code creates a share-like entitlement | | |
| 2 | `app/[locale]/economics/components/FAQ.tsx:13` | yes · `/he/economics` | `אם יותר אנשים משקיעים, ה-BAG שווה יותר.` | implied return | **no** - price is set by a third-party market on bags.fm. Taruu implements no bonding curve, no buy-back, and no price support, and controls nothing about the price | | |
| 3 | `app/[locale]/coin/components/CoinMarket.tsx:100-105` | yes · `/he/coin` | `כל הצבעה מקבלת BAG משלה ב-bags.fm: מטבע ממים מבוסס בלוקצ׳יין, ממותג סביב הפלטפורמה, שמאפשר לאנשים מבחוץ להשקיע בתנועה הכלכלית של ההצבעה, בדיוק כמו במניה, ולתמוך בביצוע החלטת הרוב.` | securities analogy | **no** - same as row 1; and per F1 no BAG can currently be created at all | | |
| 4 | `app/[locale]/coin/components/CoinDossier.tsx:279-284` | yes · `/he/coin/[id]` | `תושבים מקומיים ואנשים מבחוץ קונים את ה-BAG ומשקיעים בתנועה הכלכלית של ההצבעה, בדיוק כמו במניה, כדי לתמוך בביצוע החלטת הרוב.` | securities analogy | **no** - same as row 1 | | |
| 5 | `app/[locale]/economics/components/HeroSection.tsx:101-106` | yes · `/he/economics` | `כל הצבעה מקבלת BAG משלה ב-bags.fm: מטבע ממים מבוסס בלוקצ׳יין שמאפשר לאנשים מבחוץ להשקיע בתנועה הכלכלית של ההצבעה, בדיוק כמו במניה, ולתמוך בביצוע ההחלטה של הרוב.` | securities analogy | **no** - same as row 1 | | |
| 6 | `app/[locale]/economics/components/FlywheelDiagram.tsx:99` | yes · `/he/economics` | `תומכים חיצוניים מקבלים נכס סחיר ושקוף` | securities analogy | **no** - per F1 no tradeable BAG exists yet; "נכס סחיר" describes an instrument that has never been issued | | |
| 7 | `app/[locale]/coin/components/CoinMarket.tsx:98` | yes · `/he/coin` | `להשקיע בהחלטה של הרוב.` (page H1) | implied return | **no** - a purchase buys a token on a third-party market; nothing routes it to the execution of any decision (F1, F3, F4) | | |
| 8 | `app/[locale]/coin/page.tsx:10` | yes · `/he/coin` `<meta name="description">` | `שוק ה-BAGS של תַּרְאוּ: כל הצבעה מקבלת BAG משלה ב-bags.fm, מטבע ממים מבוסס בלוקצ׳יין שאנשים מבחוץ קונים כדי להשקיע בתנועה הכלכלית של ההצבעה ולממן את ביצוע החלטת הרוב.` | implied return | **no** - "ולממן את ביצוע החלטת הרוב" asserts a funding path that does not exist (F1, F4); also indexed by search engines and shown in link previews | | |
| 9 | `app/[locale]/economics/page.tsx:15` | yes · `/he/economics` `<meta name="description">` | `המודל הכלכלי של תַּרְאוּ: ההצבעה חינם, כל הצבעה מקבלת BAG ב-bags.fm, והשקעות חיצוניות מזרימות כסף לקרן הקהילתית.` | implied return | **no** - the "ההצבעה חינם" half is true; the money-flow half is the reverse of what the code does (F2) and no pool ledger exists (F4) | | |
| 10 | `app/[locale]/economics/page.tsx:19` | yes · `/he/economics` openGraph | `כל הצבעה מקבלת BAG משלה ב-bags.fm: מטבע ממים מבוסס בלוקצ׳יין שמאפשר לכל אחד להשקיע בתנועה הכלכלית של הנושא ולתמוך בביצוע ההחלטה.` | implied return | **no** - same as row 9; this is the text shown when the page is shared on social platforms | | |
| 11 | `app/[locale]/economics/components/HowItWorks.tsx:125` | yes · `/he/economics` | `מסחר לפי הסנטימנט` / `הערך משקף את מידת התמיכה בנושא` | implied return | **no** - asserts a causal link between civic support and token price that Taruu neither measures nor controls | | |
| 12 | `app/[locale]/coin/components/CoinDossier.tsx:312` | yes · `/he/coin/[id]` | `הושקע · ₪` (holders-ledger column header) | implied return | **no** - the word `הושקע` frames a purchase as an investment in the ledger UI itself | | |
| 13 | `app/[locale]/dashboard/page.tsx:425` | yes · `/he/dashboard` (signed in) | `מדד ההשקעה הקהילתית יעלה בהמשך.` (note under the `שווי התיקים` card) | implied return | **no** - a forward-looking statement about a "community investment index" that does not exist | | |
| 14 | `app/[locale]/coin/components/CoinDossier.tsx:219-225` | yes · `/he/coin/[id]` | `כל אחד יכול לגבות את ה-BAG, תושב או מבחוץ. ההצבעה שמורה לתושבים מאומתים; הגיבוי הכלכלי פתוח לכולם. ככל שה-BAG גדל, לביצוע החלטת הרוב יש יותר משאבים אמיתיים מאחוריו.` | implied civic outcome | **no** - there is no executed payout path from a pool to a decision. `BAG-03` (in-house dual-control vendor payout) is recorded in `.planning/REQUIREMENTS.md:115` as gated on a licence/trust structure that does not exist | | |
| 15 | `app/[locale]/coin/components/CoinMarket.tsx:103` | yes · `/he/coin` | `ככל שה-BAG גדל, לנושא יש יותר משאבים אמיתיים מאחוריו.` | implied civic outcome | **no** - same as row 14 | | |
| 16 | `app/[locale]/economics/components/HeroSection.tsx:104-105` | yes · `/he/economics` | `ככל שה-BAG גדל, כך לנושא יותר משאבים אמיתיים מאחוריו.` | implied civic outcome | **no** - same as row 14 | | |
| 17 | `app/[locale]/coin/components/CoinDossier.tsx:283` | yes · `/he/coin/[id]` | `ה-BAG שקוף, סחיר, וחתום בבלוקצ׳יין: ככל שהוא גדל, לנושא יש יותר משאבים אמיתיים מאחוריו.` | implied civic outcome | **no** - same as row 14; `סחיר` also repeats the tradeable-asset framing of row 6 | | |
| 18 | `app/[locale]/economics/components/FAQ.tsx:48` | yes · `/he/economics` | `כשהצבעה מסתיימת: ה-BAG של ההצבעה נקפא (אי אפשר לסחור בו יותר), הכספים מועברים לקרן הקהילתית, ותעודות דיגיטליות מונפקות לכל המשתתפים` | implied civic outcome | **no** - the freeze flag exists on the token record, but no scheduled job resolves votes, transfers funds, or mints certificates (F3), and there is no pool to transfer to (F4) | | |
| 19 | `app/[locale]/economics/components/FlywheelDiagram.tsx:85` | yes · `/he/economics` | `עמלות לקרן ההצבעה` / `עמלות המסחר ב-BAG מיועדות לקרן של אותה הצבעה` | use of funds | **no** - no fee claim is implemented and no per-vote pool exists (F5, F4) | | |
| 20 | `app/[locale]/economics/components/FlywheelDiagram.tsx:91` | yes · `/he/economics` | `עמלות מסחר` / `מסחר ב-BAG של ההצבעה` / `מיועד לקרן ההצבעה` (revenue-stream table row) | use of funds | **no** - same as row 19 | | |
| 21 | `app/[locale]/economics/components/FlywheelDiagram.tsx:92` | yes · `/he/economics` | `רכישות חיצוניות` / `תמיכה → BAGS ב-bags.fm` / `מזין את קופת הקרן` | use of funds | **no** - the arrow points the wrong way against the implemented flow (F2) | | |
| 22 | `app/[locale]/terms/page.tsx:86` | yes · `/he/terms` | `הצבעה שהסתיימה עשויה להנפיק BAG, מטבע ב-bags.fm (memecoin) הנטבע על גבי בלוקצ׳יין ציבורי עבור אותה הצבעה, שגורמים חיצוניים יכולים להשקיע בו כדי לממן את ביצוע ההחלטה הזוכה.` | use of funds | partly - hedged with `עשויה` (may), which is accurate about the token issuance; the funding-of-execution clause is not backed (F1, F3, F4) | | |
| 23 | `app/[locale]/economics/components/FAQ.tsx:18` | yes · `/he/economics` | `ההשתתפות בהצבעות חינם. יצירת הצבעה חדשה עולה ₪50, שמממנים את תפעול הפלטפורמה. הקרן הקהילתית מתמלאת מהשקעות חיצוניות ב-BAG של כל הצבעה, לא מכסף של תושבים, וכל תנועה שלה גלויה.` | use of funds *(conservative)* | partly - the pricing half and `לא מכסף של תושבים` are true today (`VOTE_PARTICIPATION_COST = 0`, `CREATE_VOTE_COST = 50`, 100% platform). `מתמלאת מהשקעות חיצוניות` is present-tense about a mechanism that does not run (F1, F4) | | |
| 24 | `app/[locale]/economics/components/HowItWorks.tsx:228` | yes · `/he/economics` | `הקרן הקהילתית מתמלאת מהשקעות חיצוניות ב-BAG של ההצבעה, לא מכסף של תושבים` | use of funds *(conservative)* | partly - same as row 23 | | |
| 25 | `app/[locale]/faq/data/faqData.ts:67` | yes · `/he/faq` | `הקרן מתמלאת מהשקעות חיצוניות ב-BAG של כל הצבעה, לא מכסף של תושבים. היא מנוהלת בשקיפות מלאה, לפי כללים מוגדרים מראש, וכל תנועה שלה גלויה. הכסף חוזר לקהילה, לא אלינו.` | use of funds *(conservative)* | partly - as row 23, plus `לפי כללים מוגדרים מראש` and `הכסף חוזר לקהילה` describe governance and a return path that are not implemented (F3, F4) | | |
| 26 | `app/[locale]/terms/page.tsx:99` | yes · `/he/terms` | `הקרן הקהילתית של כל הצבעה ממומנת מהשקעות חיצוניות ב-BAG של ההצבעה ב-bags.fm, לא מכספי תושבים. תנועות הקרן מתועדות בשקיפות.` | use of funds *(conservative)* | partly - as row 23. This is the binding contractual version of the statement, so its wording matters more than the marketing copies of it | | |
| 27 | `app/[locale]/economics/components/FAQ.tsx:43` | yes · `/he/economics` | `מדמי יצירת הצבעה: ₪50 על כל הצבעה חדשה. אנחנו לא תלויים במשקיעים חיצוניים. המודל הכלכלי מתקיים מעצמו מהיום הראשון.` | use of funds *(conservative)* | partly - true of Taruu's own revenue; sits four answers away from copy stating that the civic pool depends entirely on external investment. Counsel may wish to rule on the pair, not the sentence | | |
| 28 | `app/[locale]/economics/components/FlywheelDiagram.tsx:180` | yes · `/he/economics` | `ללא תלות במשקיעים חיצוניים` | use of funds *(conservative)* | partly - same tension as row 27 | | |
| 29 | `components/sections/Features/Features.tsx:71` | **no** - exported from `components/sections/index.ts` with zero page mounts | `לכל הצבעה קופה קהילתית משלה, ברישום פתוח ושקוף, שממומנת מהשקעות חיצוניות ב-BAG של ההצבעה, המטבע ב-bags.fm. כל שקל ניתן למעקב מההשקעה ועד ההשפעה.` | use of funds | **no** - and not currently rendered. Recorded so it is not remounted later without a ruling. An English twin sits at `:70` | | |
| 30 | `app/[locale]/economics/components/FAQ.tsx:28` | yes · `/he/economics` | `הכסף, ה-BAGS והקרן רצים על בלוקצ'יין ציבורי, ולא על שרת של גורם יחיד שאפשר ללחוץ עליו או לכבות.` | custody | **no** - the pool is a fiat ledger in Postgres (`treasury_transactions`, `supabase/migrations/20250116000001_treasury_and_issue_coins.sql:64`), and Taruu holds the master wallet key (F7). `.planning/REQUIREMENTS.md` "Out of Scope" states the intended design is the opposite: value stays fiat, the chain is transparency-only | | |
| 31 | `app/[locale]/coin/components/CoinDossier.tsx:227` | yes · `/he/coin/[id]` | `המסחר רץ על bags.fm: מסילות כסף עצמאיות על בלוקצ׳יין ציבורי, מחוץ לפלטפורמה.` | custody | partly - the user-facing CTA does link out to bags.fm, but `POST /api/bags/swap` executes a swap through Taruu's own server on the caller's behalf (F8), so "מחוץ לפלטפורמה" is not the whole picture | | |
| 32 | `app/[locale]/treasury/components/TreasuryHero.tsx:101-104` | yes · `/he/treasury` | `הקרן הקהילתית פתוחה לבדיקה: כל הכנסה וכל הוצאה מתועדות בזמן אמת. הוצאות מעל סף מסוים דורשות אישור הקהילה, והקרן עוברת ביקורת חשבונאית עצמאית.` | custody | **no** - no community-approval mechanism exists in the code, and no independent accounting audit has been commissioned | | |
| 33 | `app/[locale]/treasury/components/TreasuryHero.tsx:63` | yes · `/he/treasury` | `הקרן עוברת ביקורת חשבונאית עצמאית מדי שנה: גורם חיצוני מאמת שכל שקל במקומו.` | custody | **no** - same as row 32, and stated as a recurring annual fact | | |
| 34 | `app/[locale]/terms/page.tsx:105` | yes · `/he/terms` | `BAG הוא נכס קריפטו ספקולטיבי ותנודתי המונפק באמצעות פלטפורמת הצד-השלישי bags.fm, אינו מוצר השקעה של תַּרְאוּ, ואינו נושא הבטחה לתשואה כספית; תַּרְאוּ אינה מתחייבת לערך, לנזילות או לתוצאה כלשהם.` | custody *(risk disclosure - conservative)* | yes - this is a disclaimer rather than a claim, and it is consistent with the code. The open question is **sufficiency**, and whether it must also appear at the point of purchase rather than only in the Terms | | |
| 35 | `app/[locale]/privacy/page.tsx:97` | yes · `/he/privacy` | `bags.fm: תשתית ה-BAG (מטבע ב-bags.fm לכל הצבעה) על רשת Solana.` (third-party processor list) | custody | yes - accurate description of the third party. Counsel should confirm the processor disclosure is complete for a crypto rail | | |
| 36 | `app/[locale]/coin/components/CoinDossier.tsx:230-241` | yes · `/he/coin/[id]` | `גבו ב-bags.fm` - the primary call to action, an outbound link to `https://bags.fm/{tokenMint}` | trading mechanics | partly - the link is real; it is the live buy path and carries **no risk disclaimer adjacent to it**. Rendered only when the token is tradeable and unfrozen | | |
| 37 | `app/[locale]/coin/components/CoinDossier.tsx:220-222` | yes · `/he/coin/[id]` | `כל אחד יכול לגבות את ה-BAG, תושב או מבחוץ. ההצבעה שמורה לתושבים מאומתים; הגיבוי הכלכלי פתוח לכולם.` | trading mechanics | partly - accurate about who may buy; it is also the sentence that makes the offering an unrestricted public one, which is a live question in the checklist's securities section | | |
| 38 | `app/[locale]/economics/components/FAQ.tsx:33` | yes · `/he/economics` | `אפשר לתמוך בקהילות ישראליות מכל מקום בעולם על ידי רכישת ה-BAG של ההצבעה ב-bags.fm. צריך ארנק קריפטו ומטבע לרכישה. כשההצבעה מסתיימת מתקבלת תעודת "תומך קהילתי".` | trading mechanics | partly - the wallet requirement is accurate; the offering is explicitly extended outside Israel, and the certificate half is not backed (F3) | | |
| 39 | `app/[locale]/economics/components/HowItWorks.tsx:124` | yes · `/he/economics` | `רכישת BAGS ב-bags.fm` / `תמיכה בנושאים שאתה מאמין בהם` | trading mechanics | partly - describes a purchase step for a token that cannot currently be created (F1) | | |
| 40 | `app/[locale]/coin/components/CoinMarket.tsx:136` | yes · `/he/coin` | `24ש׳` - the 24-hour price-change column, rendered at `:180` as e.g. `↗ 0.0%` | trading mechanics | **no** - `app/api/bags/trending/route.ts:70` hardcodes `priceChange24h: 0`. The column presents a placeholder as a measurement (F6) | | |
| 41 | `app/[locale]/coin/components/CoinMarket.tsx:137` | yes · `/he/coin` | `מחזור 24ש׳` - the 24-hour volume column, rendered at `:187` | trading mechanics | **no** - `app/api/bags/trending/route.ts:71` hardcodes `volume24h: 0` (F6) | | |
| 42 | `app/[locale]/coin/components/CoinDossier.tsx:245` | yes · `/he/coin/[id]` | `המסחר ב-BAG קפוא כרגע.` / `ה-BAG עדיין לא נפתח למסחר.` | trading mechanics | yes - reads the `is_frozen` / `trading_enabled` flags on the token record | | |
| 43 | `app/[locale]/coin/components/CoinMarket.tsx:246-249` | yes · `/he/coin` | `ה-BAG הראשון ייפתח ב-bags.fm עם ההצבעה הראשונה, ב-04.08.26. עדכון יישלח בקבוצת המייסדים.` | trading mechanics *(forward-looking)* | **no** - a dated commitment to open a market. Per F1 and F3 no code path currently launches a bag on any date | | |
| 44 | `app/[locale]/explore/components/BagsList.tsx:82` | yes · `/he/explore` | `עוד לא נפתחו BAGS. הראשון ייפתח עם ההצבעה הראשונה, ב-04.08.` | trading mechanics *(forward-looking)* | **no** - same as row 43 | | |
| 45 | `app/[locale]/economics/components/FAQ.tsx:38` | yes · `/he/economics` | `התעודה (NFT) היא רשומה דיגיטלית שמוכיחה שהשתתפת בהצבעה ספציפית. היא נשארת איתך, חתומה בבלוקצ'יין.` | certificate/NFT | **no** - the minting cron is not scheduled (F3), so no certificate is issued and nothing is signed on chain | | |
| 46 | `app/[locale]/economics/components/HowItWorks.tsx:126` | yes · `/he/economics` | `תעודת תומך קהילתי` / `תג שמתקבל בסיום ההצבעה` | certificate/NFT | **no** - same as row 45; this one is promised specifically to the token buyer, so it forms part of what the buyer is offered | | |
| 47 | `app/[locale]/economics/components/CTASection.tsx:17` | yes · `/he/economics` | `תעודה` / `לכל משתתף` (trust stat) | certificate/NFT | **no** - same as row 45, stated as an unconditional per-participant fact | | |
| 48 | `app/[locale]/votes/archive/page.tsx:11` | yes · `/he/votes/archive` `<meta name="description">` | `ארכיון ההצבעות שהסתיימו - צפו בתוצאות, NFTs שהונפקו ובהשפעת התומכים החיצוניים.` | certificate/NFT | **no** - no NFTs have been issued (F3) and no supporter impact has been recorded | | |
| 49 | `app/[locale]/coin/[id]/page.tsx:10` | yes · `/he/coin/[id]` `<meta name="description">` | `תיק ה-BAG: ההצבעה שהוא מגבה ב-bags.fm, ההיצע, סכום הגיוס, מחזיקי ה-BAG והחתימה בבלוקצ׳יין. שקוף ומאומת.` | transparency | partly - describes fields that exist on the `issue_coins` record; `מאומת` is doing unstated work | | |
| 50 | `app/[locale]/coin/components/CoinDossier.tsx:200` | yes · `/he/coin/[id]` | `גויס · ₪` (headline stat, alongside `מחזיקים`, `היצע כולל`, `נרכש`) | transparency | partly - the values are read from the token record; there are no records today | | |
| 51 | `app/[locale]/coin/components/CoinDossier.tsx:255` | yes · `/he/coin/[id]` | `הטבעה על השרשרת` (on-chain mint panel, linking to `solscan.io`) | transparency | partly - renders only when a `token_mint` exists; the outbound explorer link is genuine | | |
| 52 | `app/[locale]/explore/page.tsx:22-25` | yes · `/he/explore` `<meta name="description">` | `הקרן האזרחית ושוק ה-BAGS - אינדקס אחד, שקוף ופתוח לכולם.` | transparency | partly - the index page exists; the market it indexes is empty | | |
| 53 | `app/[locale]/explore/components/MoneyDesk.tsx:45` | yes · `/he/explore` | `סה״כ בקרן האזרחית` (with a `בהכנה` placeholder when there is no figure) | transparency | yes - the component renders `-` / `בהכנה` rather than a fabricated zero | | |
| 54 | `app/[locale]/explore/components/MoneyDesk.tsx:62` | yes · `/he/explore` | `BAGS מובילים · TOP 5` | transparency | partly - the list is fed by `/api/bags/trending`, which currently returns 500 in production | | |
| 55 | `app/[locale]/economics/components/LiveDashboard.tsx:88` | yes · `/he/economics` | `סה״כ גויס לקרנות` (stat card) | transparency | partly - reads a stats endpoint; falls back to `₪0` rather than to a placeholder | | |
| 56 | `app/[locale]/economics/components/LiveDashboard.tsx:127` | yes · `/he/economics` | `כשהקרן הקהילתית הראשונה תיפתח, כל גיוס, עסקה ומגמה יופיעו כאן בזמן אמת.` | transparency *(forward-looking)* | partly - an honest empty state that still promises a real-time board | | |
| 57 | `app/[locale]/privacy/page.tsx:106` | yes · `/he/privacy` | `הוכחות הצבעה ו-BAGS (מטבעות ב-bags.fm, BAG אחד לכל הצבעה) נרשמים על גבי בלוקצ׳יין ציבורי. רישומים אלה הם פסאודונימיים, ציבוריים ואינם ניתנים למחיקה.` | transparency | yes - accurate and correctly warns that on-chain records cannot be erased. Counsel should confirm it satisfies the erasure-right disclosure under Israeli privacy law | | |

**57 claims inventoried. 33 are marked `no` - not backable as currently written.**
Nineteen are `partly` and five are `yes`.

### English-locale twins, recorded but not live

The site is Hebrew-only: `apps/web/src/middleware.ts:34-38` redirects `/en/*` and every other locale
prefix to `/he`. The English strings below therefore ship in the bundle but are not reachable, and are
listed so a future locale rollout does not resurrect an unruled claim:
`app/[locale]/terms/page.tsx:27` and `:46` (the English Terms token clauses),
`app/[locale]/privacy/page.tsx:45` and `:54` (the English privacy disclosures), and
`components/sections/Features/Features.tsx:70` (the English twin of row 29).

### Landing in flight

Plan `03-09` (PAY-08, wave 2) is executing in a parallel session and adds a statement to
`app/[locale]/pricing/components/PricingContent.tsx` about what funds the civic pool. When it lands
it becomes a new row here and must be ruled on with the rest. The same plan has already removed a
computed `70% / 30%` allocation receipt from `app/[locale]/treasury/components/TreasuryDashboard.tsx`,
which is why no such row appears above.

### A note on row 1

`app/[locale]/economics/components/FAQ.tsx:9` carries a load-bearing comment placed by wave 1:
*"COIN-04 owns this answer's investment wording; it is gated on COIN-01's written legal sign-off and is
left verbatim on purpose."* Rows 1 and 2 are that wording. It was left untouched deliberately so the
gated boundary is visible in the diff - not by oversight.

---

## Trading surfaces

What a user can actually **do**, as distinct from what they are **told**. All verified deployed on
`taruu.co.il` on 2026-08-04.

| Surface | What it does | Gate | Notes |
|---|---|---|---|
| `POST /api/bags/quote` | Requests a swap quote from bags.fm for an input/output mint pair and returns price impact, fee and route | session required (`401` unauthenticated, verified) | `app/api/bags/quote/route.ts:20`. Validates mints, a positive amount, and `slippageBps` within `0-5000` |
| `POST /api/bags/swap` | Executes a swap on bags.fm against the caller's Solana wallet, falling back to the user's stored `qubik_wallet_address` | session required (`401` unauthenticated, verified) | `app/api/bags/swap/route.ts:19`. **Accepts a client-supplied `quote` object and checks only that three fields are present (`:47`) before executing it** - the quote shown is not provably the quote that executes. This is COIN-03, plan `03-12` |
| `GET /api/bags/trending` | Lists issue coins ordered by total value invested, for the market and explore surfaces | **public, no authentication** | `app/api/bags/trending/route.ts:15`. Returns hardcoded `priceChange24h: 0` and `volume24h: 0` (`:70-71`). Currently returns **500** in production |
| `GET /api/votes/[id]/issue-coin` | Returns the bags.fm token record for a vote | **public, no authentication** (stated at `route.ts:8`) | Supply, raise, holder count |
| `GET /api/votes/[id]/issue-coin/holders` | Returns the holder ledger for a vote's token | **public**, anonymised for unauthenticated callers (`route.ts:18-19`) | Feeds the `פנקס המחזיקים` panel on `/coin/[id]` |
| `/he/coin` | The BAGS market page: table of tokens by municipality with raise, 24h change and volume | public | Rows 3, 7, 15, 40, 41, 43 above |
| `/he/coin/[id]` | The single-token dossier, including the outbound **`גבו ב-bags.fm`** buy CTA to `https://bags.fm/{tokenMint}` | public | Rows 4, 12, 14, 17, 31, 36, 37, 42, 49-51 above. No risk disclaimer adjacent to the buy control |
| `/he/economics` | The economics explainer: hero, flywheel, live dashboard, how-it-works, FAQ, CTA | public | The largest concentration of rows above |
| `/he/explore` | Index page carrying the civic-fund total and a top-5 BAGS list | public | Rows 44, 52-54 |
| `/he/treasury` | The fund transparency board | public | Rows 32, 33 |
| Navigation | `components/press/Masthead/Masthead.tsx:46` puts **`BAGS`** in the primary `הכלכלה` menu on `/he`, `/he/explore`, `/he/knesset` and `/he/how-it-works` | public | The market is one click from the homepage |

---

## Open engineering questions the answer will decide

Each of the three implementation plans is blocked on the sign-off, and each is waiting on a specific
part of the answer.

- **COIN-02 - the per-municipality civic pool ledger** (`.planning/phases/03-payment-rails-hardening/03-11-PLAN.md`).
  Blocked on the **custody** answer. The shape of an append-only pool ledger and its on-chain
  reconciliation depends on who legally owns the pool, whether segregation or a trust is required, and
  whether the pool may accrue at all before the payout structure exists. Rows 19-33 above cannot be
  restated honestly until this ledger exists.
- **COIN-03 - server-side quote authority** (`03-12-PLAN.md`). Blocked on the **securities** answer, which
  determines what the buy path is allowed to be at all. The defect is concrete and independent of the
  legal question: `app/api/bags/swap/route.ts:47` trusts a client-supplied quote, so the quote the UI
  shows is not provably the quote that executes (F8). Rows 36, 40 and 41 are its user-facing face.
- **COIN-04 - rewriting every claim to approved wording** (`03-13-PLAN.md`). Blocked on the
  **permissible-claims** answer, i.e. on the `Verdict` and `Replacement wording` columns of this table.
  That plan turns the ruled table into a mechanically enforced register - prohibited strings absent
  from the source, approved strings present - so the answer stays enforced after it is given.
- **Whether the certificate is part of the offering.** Rows 45-48 promise an on-chain certificate to
  buyers and participants, and nothing currently mints one (F3). If the certificate forms part of what
  the buyer is offered, its wording is inside the securities question rather than beside it.

---

## Sign-off

**Lawyer name:** ___________________________

**Firm:** ___________________________

**Date:** ___________________________

- [ ] Every row above carries a written verdict - **allowed** / **allowed-with-wording** / **prohibited** -
  and replacement wording where a claim is salvageable
- [ ] The trading surfaces listed above have been reviewed for what a user can *do*, not only for what
  they are *told*
- [ ] Written sign-off filed together with `COIN-LEGAL-CHECKLIST.md`

> Once filled in: transcribe the verdicts into the `Verdict` and `Replacement wording` columns above
> **before** plan `03-13` runs - that plan reads this table as its source of truth. Then update
> `COIN-01` to Complete in `.planning/REQUIREMENTS.md` and unblock `03-11`, `03-12` and `03-13`.
