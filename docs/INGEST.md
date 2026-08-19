# Discovery Ingest Contract

How the **taruu-agents discovery fleet** feeds Facebook-discovered civic
topics into the Taruu platform. The web app owns validation and vote
creation; agents only report what they saw.

## Endpoint

```
POST https://taruu.co.il/api/ingest/topics
Authorization: Bearer <INGEST_SECRET>
Content-Type: application/json
```

Local dev: `http://localhost:3777/api/ingest/topics`.

`INGEST_SECRET` must be set in the web app environment (Cloudflare secret /
`.dev.vars`) and mirrored in the discovery fleet config. Endpoint returns
`503` when unset, `401` on a bad bearer.

## Payload

```json
{
  "topics": [
    {
      "municipality": "חיפה",
      "title": "שיקום מדרגות ואדי ניסנאס והדר",
      "description": "שיפוץ ותאורה של גרמי המדרגות ההיסטוריים.",
      "options": ["בעד שיקום מלא", "בעד תאורה בלבד", "נגד"],
      "vote_days": 14,
      "source": {
        "post_count": 3,
        "comments_count": 212,
        "reactions": { "like": 340, "love": 51, "angry": 66 },
        "source_url": "https://www.facebook.com/groups/…/posts/…"
      }
    }
  ]
}
```

Rules:

- `municipality` must be one of the canonical names in
  `@sync/shared` `MUNICIPALITIES` (Hebrew display names — the same strings
  the web onboarding writes to `users.municipality_id`).
- `options` optional; defaults to `["בעד", "נגד", "נמנע"]`.
- `vote_days` optional (default 14) — only used when the call creates the vote.
- `source` is the **consolidation** across every FB post mapped to this
  topic: `post_count` posts, summed `comments_count`, summed per-kind
  `reactions`. Allowed reaction kinds: `like love haha wow sad angry`.
- Max 50 topics per call.

## Semantics

- Dedup key: (`municipality`, exact `title`) against non-ended votes.
  - Miss → creates a **pending** vote owned by the editorial system user
    (`INGEST_CREATOR_ID`, default = the desk seed user) + its options,
    attaches the source row, then atomically activates it once the database
    confirms the full publication eligibility contract.
  - Hit → refreshes the vote's `vote_sources` row only (metrics update);
    title/description/options are never overwritten.
- `vote_sources` is unique per vote — repeat calls upsert, `fetched_at`
  bumps every time. Send absolute totals, not deltas.
- A newly created vote is `pending` while its options and source are assembled.
  The same successful ingest request automatically changes it to `active`; there
  is no editor or human review step. `pending` is **not** a fully private state
  — see *Visibility of `pending`* below; what the assembly window guarantees is
  that a vote with no ballot never becomes `active`, not that nobody can see it.
- Activation is attempted for every vote the request creates **or adopts**, not
  only for newly created ones. A first attempt that dies after the vote row but
  before the source row leaves a real half-assembled vote behind; the retry
  dedups onto it, finishes the assembly, and finishes the lifecycle. There is no
  path that answers `success: true` while a current, fully assembled ingest vote
  is still `pending`.
- `INGEST_AUTOACTIVATE_SINCE` (RFC 3339 instant, **required**) bounds that.
  Only votes created at or after it are activated; the `pending` rows that
  accumulated before it are out of scope and are never touched. The bound is
  enforced inside `activate_ingest_vote`, not by the route. With the variable
  unset, unparseable, **or set to an instant still in the future**, the endpoint
  answers `503` before writing anything, rather than creating votes it has no
  rule for activating. A future cutover is refused for the same reason an unset
  one is: every vote the request would create is stamped `now`, which is before
  it, so the row could never satisfy the `created_at >= cutover` bound - the
  first attempt would answer `500` over a vote it had already written, and the
  retry would report `success: true` while that vote stayed `pending`.
- `vote_days` must be an integer between 1 and 365; `options` must contain at
  least two distinct non-empty values, and each distinct value is written once.

### Deployment order

`activate_ingest_vote` must exist before any code that calls it runs. Merging to
`main` deploys the Worker immediately and applies no migrations, so the order is
manual and strict:

1. apply `supabase/migrations/20260902000001_ingest_auto_activation.sql` to
   production and confirm the function and its grants exist;
2. set `INGEST_AUTOACTIVATE_SINCE` on the Worker to an instant at or after the
   moment the migration was applied, and **not** ahead of the Worker's clock —
   a future instant is refused with `503`, so a timezone or clock-skew slip
   stops ingest outright instead of stranding rows;
3. only then merge, which deploys the application.

Reversing 1 and 3 makes every ingest of a new topic answer `500` while leaving
the vote it just wrote stranded in `pending`.

### Visibility of `pending` — known, not addressed here

`pending` is not uniformly private. The two public read paths disagree:

| surface | serves `pending`? | why |
|---|---|---|
| `GET /api/votes` (no municipality) | no — `active` only | `vote.repo.listVotes` routes to `getActiveVotes()` and ignores the status filter |
| `GET /api/votes?municipality=<name>` | **yes** | routes to `getVotesByMunicipality`, whose default filter is `PUBLIC_VOTE_STATUSES`, which includes `pending` |

So a vote mid-assembly is invisible on the nationwide/default surfaces and
visible on its own town's. The asymmetry predates this change: it is why the
existing `pending` backlog is already publicly listable per municipality.

This is a read-path question, not a lifecycle one, and is deliberately not
touched here. Note the direction of the effect — automatic activation makes the
assembly window shorter, not longer: without it a discovery vote stays `pending`
(and municipality-visible) indefinitely, and with it for as long as one ingest
request takes.

## Response

```json
{
  "success": true,
  "ingested": [
    { "title": "…", "vote_id": "uuid", "created": true }
  ],
  "timestamp": "2026-07-23T12:00:00.000Z"
}
```

`400` names the first invalid topic (`topics[3]: unknown municipality: …`).
A mid-batch failure returns `500` with the partial `ingested` list — safe to
retry the whole batch (idempotent by the dedup key + source upsert).

## What agents must NOT do

- No direct Supabase writes to `votes` / `vote_sources` — the endpoint is
  the only door, so validation and hotness stay consistent.
- No fabricated or extrapolated engagement — send only counted values from
  collected screenshots/posts.
