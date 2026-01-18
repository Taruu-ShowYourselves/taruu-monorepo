# Bags.fm Economics Page Specification

**Status:** ✅ IMPLEMENTED (v92)
**Priority:** P1 - Marketing/Education Critical (COMPLETE)
**Last Updated:** January 18, 2026

---

## Overview

A dedicated page explaining Taruu's SocialFi economics model and showing live Bags.fm data. This page explains why the model is brilliant, sustainable, and creates real-world impact.

## Implementation Scope

### 1. Dedicated Economics Page
`apps/web/src/app/[locale]/economics/page.tsx`

URL: `https://taruu.co.il/economics`

### 2. Economics Section on Main Landing Page
`apps/web/src/app/[locale]/page.tsx` - Add new section

The main landing page should include a condensed version of the economics explanation with:
- Brief "How It Works" summary (3 steps)
- The Flywheel diagram (compact version)
- "Learn More" CTA linking to full economics page
- Live mini-dashboard showing key stats (optional)

## Page Location

`apps/web/src/app/[locale]/economics/page.tsx`

URL: `https://taruu.co.il/economics`

---

## The Economics Model

### Money Flow

```
VOTE PARTICIPATION (₪3)
├── 1/3 (₪1) → Platform (sustainability)
└── 2/3 (₪2) → Vote Subject Trust Fund
                ├── Maintained on Bags.fm
                └── Persisted on Qubik blockchain

VOTE CREATION (₪200)
└── Creator receives NFT worth ₪200
    └── Tradeable like אגרות חוב (bonds)
        └── Others can buy/invest in it

ISSUE COINS
├── Created for each vote topic
├── Live on Bags.fm
├── Trade like stocks (Freedom-style)
└── Sit in user's wallet as assets
```

### Trust Fund Resolution

When vote ends, the trust fund is deployed for REAL ACTION:

```
Vote Resolves
    │
    ├── Municipality DOES its job
    │   └── Trust fund → Project implementation
    │
    └── Municipality IGNORES the vote
        └── Trust fund → LAWYERS to force action
```

**This is the teeth.** Citizens collectively fund their own advocacy. The municipality knows: ignore 1,000 voters who put ₪3 each = ₪2,000 war chest ready to sue.

---

## Why It's Brilliant

### 1. Skin in the Game Democracy

Free votes are noise. Paid votes are signal.

- Regular voting: Everyone clicks, nobody cares
- Taruu: Only issues people REALLY care about get funded
- Money = true preference signal

### 2. Speculation Serves the Public Good

Usually speculation = bad. Here, speculators accidentally FUND civic causes.

- Trader sees trending Issue Coin
- Buys hoping for profit
- Their money grows the trust fund
- Their greed = public benefit

### 3. The Market Measures Civic Engagement

No surveys needed. No polls. No guessing.

- Coin has high value? People care.
- Coin has no value? People don't.
- Price = truth about civic priorities

### 4. Global Money, Local Decisions

A Jew in New York can fund a park in Kiryat Tivon.

- He doesn't vote (only verified residents decide)
- But his money AMPLIFIES local voices
- Diaspora can support Israeli communities
- Geographic barriers disappear

### 5. The War Chest Effect

Every vote builds collective leverage:

```
1,000 voters × ₪3 = ₪3,000 total
├── ₪1,000 → Platform
└── ₪2,000 → Trust Fund (war chest)

+ External trading volume = ₪10,000+

Resolution options:
├── Fund the park renovation
└── Fund lawsuit against municipality
```

### 6. Municipality Gets What Money Can't Buy

They don't get cash. They get something more valuable:

- **Real preference data** - Not polls, not surveys
- **Weighted by conviction** - People paid to express this
- **Actionable consensus** - Clear mandate to act
- **Legal pressure** - Trust fund = accountability

### 7. No Extraction, Only Creation

Traditional civic tech:
```
Taxpayer money → Software vendor → Crappy product → Waste
```

Taruu:
```
Participation → Value creation → Real action → Impact
```

### 8. אגרות חוב for Civic Causes

Like government bonds, but for your neighborhood:

- Invest in causes you believe in
- Hold a tradeable asset
- Exit when vote resolves
- Profit if the cause was popular

---

## The Flywheel

```
┌─────────────────────────────────────────────────────────────┐
│                    THE TARUU FLYWHEEL                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Civilians vote with ₪                                     │
│          ↓                                                  │
│   Issue Coin becomes ACTIVE                                 │
│          ↓                                                  │
│   Attracts Bags.fm traders                                  │
│          ↓                                                  │
│   More buyers = Higher value                                │
│          ↓                                                  │
│   Higher value = Bigger trust fund                          │
│          ↓                                                  │
│   Bigger fund = More impact at resolution                   │
│          ↓                                                  │
│   More impact = More people want to vote                    │
│          ↓                                                  │
│   (Cycle repeats, each round bigger)                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Page Content Structure

### Hero Section

**Hebrew Headline:**
> הצבעה שמייצרת כסף. כסף שמייצר שינוי.

**English:**
> Votes that generate money. Money that creates change.

**Subheadline:**
> כל שקל שאתה משקיע בהצבעה הופך לקרן פעולה אמיתית

### Section 1: How It Works (Simple)

**For Residents:**
```
1. אמת את הזהות שלך (Google + GPS)
2. בחר נושא שחשוב לך
3. שלם ₪3 והצבע
4. הכסף שלך הולך לקרן הנושא
5. כשההצבעה נגמרת → הכסף הופך לפעולה
```

**For External Supporters:**
```
1. Connect wallet (Phantom/Solflare)
2. Browse trending civic issues
3. Buy Issue Coins of causes you support
4. Trade as sentiment changes
5. Your trading grows the trust fund
6. Get NFT when vote resolves
```

### Section 2: The Trust Fund Explained

Visual showing:
- How money accumulates during voting
- The two resolution paths (project OR lawyers)
- Real examples of trust fund sizes

### Section 3: Why Municipalities Love This

```
┌────────────────────────────────────────────┐
│  WHAT MUNICIPALITIES GET                   │
├────────────────────────────────────────────┤
│  ✗ Cash (they don't get money)            │
│  ✓ Real consensus data                     │
│  ✓ Weighted by conviction (people paid!)   │
│  ✓ Legal clarity (clear mandate)           │
│  ✓ Accountability pressure (trust fund)    │
└────────────────────────────────────────────┘
```

### Section 4: Live Dashboard

Real-time data showing:

```
┌────────────────────────────────────────────────────┐
│  TARUU NETWORK - LIVE                     🟢 Live  │
├────────────────────────────────────────────────────┤
│                                                    │
│  Active Trust Funds     Total Voters    Trades    │
│  ₪ 127,450             3,847           12,430    │
│                                                    │
│  ────────────────────────────────────────────────  │
│                                                    │
│  TRENDING ISSUE COINS                              │
│                                                    │
│  🏛️ Tivon Park Fund      ₪45,230    ↑ 23%        │
│     412 voters · 89 traders                        │
│                                                    │
│  🌳 Green Corridor        ₪32,100    ↑ 12%        │
│     298 voters · 56 traders                        │
│                                                    │
│  ────────────────────────────────────────────────  │
│                                                    │
│  RESOLVED THIS MONTH                               │
│                                                    │
│  ✓ Bike Path → ₪28,900 deployed to project        │
│  ✓ School Renovation → ₪15,200 to contractors     │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Section 5: FAQ

**Q: לאן הולך הכסף שלי?**
A: 1/3 לפלטפורמה, 2/3 לקרן הנושא שהצבעת עליו. הקרן נשמרת על בלוקצ'יין ומשוחררת כשההצבעה נגמרת.

**Q: מה קורה אם העירייה מתעלמת מההצבעה?**
A: הקרן הופכת לתקציב משפטי. יש כסף לשכור עורכי דין ולכפות פעולה.

**Q: מה זה Issue Coin?**
A: מטבע דיגיטלי שמייצג את התמיכה בנושא מסוים. אפשר לקנות, למכור ולסחור בו כמו מניה.

**Q: האם אני צריך להבין קריפטו?**
A: לא. ישראלים משלמים בשקלים. הקריפטו עובד מאחורי הקלעים.

**Q: מה ההבדל בין מצביע לתומך חיצוני?**
A: מצביעים הם תושבים מאומתים שמחליטים. תומכים חיצוניים הם משקיעים שמגדילים את הקרן אבל לא מצביעים.

**Q: למה זה עובד?**
A: כי כסף אמיתי = דעה אמיתית. אנשים לא משלמים על דברים שלא אכפת להם מהם.

---

## Technical Implementation

### Components

```
apps/web/src/app/[locale]/economics/
├── page.tsx
├── components/
│   ├── HeroSection.tsx
│   ├── HowItWorks.tsx
│   ├── TrustFundExplainer.tsx
│   ├── FlywheelDiagram.tsx        # Animated
│   ├── MunicipalityValue.tsx
│   ├── LiveDashboard.tsx          # Real-time
│   ├── TrendingCoins.tsx
│   ├── ResolvedVotes.tsx
│   ├── FAQ.tsx
│   └── CTASection.tsx
└── styles/
    └── economics.module.css
```

### API Endpoints Needed

**GET /api/stats/network**
```json
{
  "activeTrustFunds": 127450,
  "totalVoters": 3847,
  "totalTrades": 12430,
  "activeVotes": 12
}
```

**GET /api/bags/trending**
```json
{
  "coins": [
    {
      "voteId": "uuid",
      "voteTitle": "Tivon Park Fund",
      "trustFundBalance": 45230,
      "priceChange24h": 0.23,
      "voterCount": 412,
      "traderCount": 89
    }
  ]
}
```

**GET /api/votes/resolved**
```json
{
  "resolved": [
    {
      "voteId": "uuid",
      "title": "Bike Path",
      "trustFundAmount": 28900,
      "resolution": "project",
      "resolvedAt": "2025-01-15"
    }
  ]
}
```

---

## Design Notes

- Use existing design system (blue/green)
- Flywheel should animate on scroll
- Numbers count up when in view
- Live indicator pulses
- Mobile-first
- Hebrew RTL primary, English toggle

---

## SEO

```tsx
export const metadata = {
  title: 'איך תראו עובד | הכלכלה של הצבעות אמיתיות',
  description: 'הצבעה שמייצרת כסף. כסף שמייצר שינוי. גלה איך תראו הופכת כל הצבעה לקרן פעולה אמיתית.',
};
```

---

*Last Updated: January 18, 2025*
