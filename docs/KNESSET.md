# Knesset Day-Order Sync (סדר יום המליאה)

The national desk mirrors the **plenum day order** from the official Knesset
OData service into votable topics, so the civic position on every agenda item
is measurable — issue #27 ("FE & BE | Day order in Knesset - with votes on it").

## Source

- `https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_PlenumSession` — plenum
  sittings (date, sitting number, Knesset number).
- `.../KNS_PlmSessionItem` — the day-order items of each sitting (`ItemID`,
  `Name`, `ItemTypeDesc`, `Ordinal`, `StatusID`, `IsDiscussion`).

The service speaks OData v2/v3 JSON (`{ "value": [...] }` envelope). The
client (`apps/web/src/services/knesset/odata.ts`) keeps `$filter` to numeric
equality and does all date logic client-side to avoid version-specific
date-literal syntax. No API key required; the data is public.

## Flow

```
Cron Trigger (0 */6 * * *)
  → POST /api/cron/knesset-agenda   (Bearer CRON_SECRET)
    → syncKnessetAgenda()           apps/web/src/services/knesset/index.ts
       1. fetch latest sittings; keep those ≤14 days old or in the future
          (recess fallback: the single latest sitting), max 4 per run
       2. fetch each sitting's day-order items (max 120 items per run)
       3. per item, dedup by upstream ItemID (knesset_items.item_id UNIQUE):
          - known item   → refresh sitting metadata (reschedules, reorders)
          - new item     → skip if an active/pending vote with the same title
                           already exists (same question, new ItemID);
                           otherwise create an ACTIVE vote scoped to
                           KNESSET_SCOPE ('כנסת ישראל') with options
                           בעד / נגד / נמנע, open 14 days, plus a
                           knesset_items row linking vote ↔ agenda item
```

Unlike discovery ingest (`docs/INGEST.md`), day-order votes are **born
`active`** — they are system-published from the official record, so there is
no editorial pending gate.

## Storage

`supabase/migrations/20260727000001_knesset_items.sql` — `knesset_items`:
one row per mirrored agenda item, `vote_id UNIQUE` → `votes`, `item_id UNIQUE`
(upstream identity), sitting metadata (`plenum_session_id`, `session_date`,
`session_number`, `knesset_num`, `item_type`, `ordinal`, `status_id`,
`is_discussion`). RLS: public read, service-role write.

## Voting on national items

`verifyCheckIn` (apps/web/src/services/verification/municipality.ts) has a
national branch: votes whose `municipality_id === KNESSET_SCOPE` accept any
GPS location inside Israel (coarse country bounding box) instead of a
municipal polygon. Everything else about participation is unchanged: session
auth, verified residency, ₪3 payment, one ballot per user.

## Frontend

- `/[locale]/knesset` — the full day order: one block per sitting (newest
  first), items in official `Ordinal` order, each with its item-type stamp,
  live consensus meters, and a link to the ballot. National topics without
  sitting metadata (e.g. discovery-found) trail under "עוד על הדסק הארצי".
  Renders the "בהכנה" plate only when there is nothing to show.
- Homepage `KnessetDesk` — unchanged; it picks up the same active
  KNESSET_SCOPE votes automatically.

## Ops

1. Apply `20260727000001_knesset_items.sql` to Supabase (after
   `20260723000001_vote_sources.sql`).
2. Add the cron in the Cloudflare dashboard (Workers → taruu-web → Settings →
   Triggers → Cron): `0 */6 * * *`. `worker.ts` already routes it.
3. Ensure the system creator user exists (the desk seed user
   `99999999-9999-4999-8999-999999999999`, or set `KNESSET_CREATOR_ID`).
4. Manual run / backfill:
   `curl -X POST https://taruu.co.il/api/cron/knesset-agenda -H "authorization: Bearer $CRON_SECRET"`
   — idempotent; re-runs refresh metadata only.
