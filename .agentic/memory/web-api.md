# web-api — verified facts (merged PRs only)
- server/app uses Result monads (neverthrow); routes gate via getSessionFromRequest; authz helpers in server/app/authz (PR #93/#95 line)
- Participation is free + idempotent via recordUserVoteOnce; no payment gate on any free-vote path — pinned by tests (phase 02.1)
- Voting gate after PR #110: stored score ≥ 40 AND residency, one shared votingGate — never re-derive locally
