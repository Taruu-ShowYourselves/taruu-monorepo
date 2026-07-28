# Taruu — Financial Model & Expectancy

_Updated 2026-06-29. All ₪. Rate USD/ILS = 3.7 (assumption). Recompute: `python3 growth/build_financial_model.py` → `growth/financial-model.xlsx`. Payment design: [`PRD-P0-payments.md`](./PRD-P0-payments.md) · treasury/bags: [`SPEC-vote-bags-treasury.md`](./SPEC-vote-bags-treasury.md)._

> **Changed 2026-06-29 — MEMBERSHIP model.** Only the **first vote of a calendar month costs money (₪6)**; every other vote that month is **free**. One charge/member/month, card-on-file. The ₪6 splits **₪2.10 → civic treasury pool / ₪3.90 → platform**. Treasury is now a **monthly pool** allocated to the decisions executed that month — NOT a per-vote ₪2.10 (free votes can't fund per-vote treasury). Strategic bet: free voting expands the funnel.

## Locked inputs

| Lever | Value | Note |
|---|---|---|
| Member fee | **₪6 / month** | charged on the first vote of the calendar month; rest of month free; ₪0 in months with no vote |
| Treasury share | **₪2.10 / member / month** | into a monthly civic **pool** (not per-vote) |
| Platform share | ₪3.90 / member / month | before GI fee |
| Create-vote fee | ₪50 | 100% platform (unchanged) |
| Payment rail | Green Invoice (Prime), card-on-file | 1.4% + ₪1.2 + ₪0.15 receipt per charge |
| Take-home target | ₪30–45k/mo combined | midpoint ₪37.5k → ~₪52.7k/mo gross profit |
| Fixed costs | ~₪1,355/mo + treasury-ops salary | infra + tooling + GI Prime; in-house treasury hire scales |

## Unit economics

```
Member ₪6/mo:  GI fee ₪1.43 | treasury ₪2.10 | platform NET ₪2.47 / member / month
Create ₪50:    GI fee ₪2.05 | platform NET ₪47.95 (100% platform)
```

A paid create nets **₪47.95** vs **₪2.47** per active member/month — a ~19× gap. The P&L is now **heavily create-led**; membership is a low-friction engagement+treasury layer, not the income engine.

## What the membership model costs vs the old per-vote model

This is a deliberate trade: lower friction (most voting free) for less collected revenue per unit of engagement. At equal engagement the old ₪5/vote model collected far more. The new model only reaches the band by **growing the funnel** — free voting must pull in more members and more creators.

- **Cover fixed costs (zero salary):** ~**28 paid creates/mo (~1/day)** — break-even stays trivial.
- **Hit the band:** needs roughly **1.5–2× the engagement** of the old Target (see Target row) — more members *and* more creates. That's the bet.

## Scenarios (monthly)

Driver = active paying members/month + paid creates/month. "Votes" column is context only (assumes ~8 votes/member/month) — votes are free, they fuel the funnel, they don't earn directly.

| Scenario | Ambassadors | Paying members | Votes (ctx) | Paid creates | Member rev | Create rev | Treasury ops | Gross | Gross profit | Take-home | Civic pool |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Break-even | 8 | 250 | 2,000 | 30 | ₪617 | ₪1,439 | ₪0 | ₪2,055 | ₪500 | ₪365 | ₪525 |
| Lean (ramp) | 20 | 1,500 | 12,000 | 150 | ₪3,699 | ₪7,193 | ₪2,500 | ₪10,892 | ₪6,536 | ₪4,772 | ₪3,150 |
| **Target (band)** | **60** | **8,000** | **64,000** | **900** | **₪19,728** | **₪43,155** | **₪5,000** | **₪62,883** | **₪55,328** | **₪40,389** | **₪16,800** |
| Scale | 150 | 30,000 | 240,000 | 3,000 | ₪73,980 | ₪143,850 | ₪8,000 | ₪217,830 | ₪205,975 | ₪150,362 | ₪63,000 |

Target take-home **₪40.4k/mo** lands inside the ₪30–45k band — but it requires **8,000 active monthly members + 900 paid creates** (vs the old Target's ~4,000 member-equivalent + 600 creates). The civic pool at Target is **₪16,800/mo**, allocated across the month's executed decisions.

## Costs

- **GI per-charge fee (₪1.43 on ₪6)** is inside the ₪2.47 member-net above. One charge/member/month → far fewer transactions than per-vote, so total GI fees are low.
- **GI Prime plan ₪155/mo** — fixed.
- **In-house treasury-ops salary** ([`SPEC-vote-bags-treasury.md`](./SPEC-vote-bags-treasury.md)) — scaling opex (₪0 → ₪8k across scenarios; **estimate**, refine with a hire).
- **Growth CAC** (not in fixed): ambassador first-create comps (waived ₪50 → ₪0 cash) + amplification. Throttle-able.

## Three things that most move the model

1. **Grow the member + creator base.** Free voting is the top-of-funnel unlock; revenue follows only if it converts to ₪6 members and ₪50 creators at scale. The whole model is a growth bet.
2. **Drive creates.** ₪47.95 vs ₪2.47 — creates are ~19× a member-month. Every free voter should be nudged toward creating a ₪50 vote.
3. **Watch treasury-ops cost + civic-pool size.** The pool (₪2.10/member/mo) is the civic-impact story; it's much smaller per-unit than the old per-vote model, so volume is what makes the "we fund real decisions" promise real.
