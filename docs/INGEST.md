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
- A newly created vote stays private as `pending` while its options and source
  are assembled. The same successful ingest request automatically changes it
  to `active`; there is no editor or human review step.
- Existing pending rows are never activated by this path. A dedup hit refreshes
  source metrics only, so deploying this change does not modify the backlog.

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
