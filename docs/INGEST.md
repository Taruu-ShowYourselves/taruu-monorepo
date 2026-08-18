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

- Dedup key: (`municipality`, exact `title`) against non-ended votes. The
  window covers the review states, so a topic still waiting for a reviewer is
  refreshed rather than filed a second time.
  - Miss → creates an **`in_review`** vote owned by the editorial system user
    (`INGEST_CREATOR_ID`, default = the desk seed user) + its options,
    then attaches the source row.
  - Hit → refreshes the vote's `vote_sources` row only (metrics update);
    title/description/options are never overwritten.
- `vote_sources` is unique per vote — repeat calls upsert, `fetched_at`
  bumps every time. Send absolute totals, not deltas.

## Lifecycle — what an ingested topic can become

A topic posted here is a machine summary of Facebook posts. It is **never
public on arrival**, and no code path here can make it public.

| Status | Means | Who writes it |
|---|---|---|
| `in_review` | **Awaiting editorial review.** Where every ingested topic lands. Invisible to every public read path (`PUBLIC_VOTE_STATUSES` excludes it). | this endpoint |
| `changes_requested` / `rejected` | A reviewer declined to publish it. | a reviewer holding `proposal.reject` |
| `pending` | **Approved and scheduled** — a reviewer said yes, but `start_date` has not arrived. Publicly readable. Never means "awaiting approval". | approval, via `initialStatus()` |
| `active` | **Approved and open now.** On the desk, votable. | approval, via `initialStatus()` |

Release is a human decision:
`POST /api/space-admin/{spaceId}/proposals/{voteId}/decide`, by an account
holding `proposal.approve` in that municipality's space. The decision writes an
immutable `space_audit_log` row.

**No creation fee is charged for ingested topics.** The ₪50 approval fee is
billed to the submitter, and the submitter here is a synthetic desk account —
see `apps/web/src/lib/ingest-creator.ts`. A resident's proposal still pays.

> History, so this is not "fixed" back: until 2026-08-18 this endpoint wrote
> `pending`, and this document claimed such rows waited for "an editor" to
> activate them. No such editor tool ever existed, and `pending` is not a state
> the review workflow can act on — `isDecidableFrom` accepts only `in_review`.
> 380 topics accumulated with no way forward and no way onto the site. They are
> still there; migrating them is a separate, deliberate step.

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
