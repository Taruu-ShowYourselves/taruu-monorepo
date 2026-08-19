# web-api — verified facts (merged PRs only)
- server/app uses Result monads (neverthrow); routes gate via getSessionFromRequest; authz helpers in server/app/authz (PR #93/#95 line)
- Participation is free + idempotent via recordUserVoteOnce; no payment gate on any free-vote path — pinned by tests (phase 02.1)
- Voting gate after PR #110: stored score ≥ 40 AND residency, one shared votingGate — never re-derive locally
- LESSON: merge to main auto-deploys apps/web to the prod Worker — code depending on unapplied migrations or unprovisioned secrets breaks prod at merge, flags OFF or not; transition reads must be schema-tolerant or migrations pre-applied (PR #120 review)
- LESSON: when adding a strict token verifier, check the MINT path emits every claim it enforces during any legacy window — fail-closed verify + legacy mint silently cancel (PR #120 review)
