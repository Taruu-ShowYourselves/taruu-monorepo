# How this codebase reaches the database

There is no ORM here, and the absence is deliberate. This document describes
what is actually in the repository, so that "preserve the data-access
boundaries" means something specific to whoever reads it next.

Written 2026-08-25, at the end of a five-stage data-integrity pass. Everything
below was read out of the code rather than recalled.

## The three layers

**1. The database is the enforcement point.**

Not the last line of defence — the only one that cannot be raced. Every rule
that must hold for the data to be worth anything is a constraint, a trigger, or
a `SECURITY DEFINER` function that takes a row lock:

- one ballot per resident per vote (`user_votes` UNIQUE, and `cast_vote`
  re-reading status under `FOR UPDATE`)
- an option belongs to its vote (`vote_options (id, vote_id)`, referenced by
  both `user_votes` and `payments`)
- one NFT per holder per vote, one holding per holder
- a check-in is attributed to the resident whose run scheduled it
- a verification run points at a municipality that exists

Application checks still exist for all of these, and they are still worth
having: they produce the specific Hebrew message the resident sees, and they
refuse before a payment is taken. But they are the user experience, not the
integrity. Where the two disagree, the constraint is right.

**2. Repository functions are the only way in.**

`apps/web/src/lib/supabase/db.ts` and `apps/web/src/server/infra/**/*.repo.ts`
hold every query. They take and return typed DTOs from
`apps/web/src/lib/supabase/types.ts`, and route handlers call them. A route that
builds its own PostgREST query is the thing this layout exists to prevent —
not for tidiness, but because a security property enforced in a caller is a
security property that the next caller will not have.

That is not hypothetical. `getPaymentByIdempotencyKey` used to take a key alone
and scope nothing; the ownership check now lives in the function signature,
where it cannot be forgotten, rather than in the one route that happened to
call it.

**3. Transport is PostgREST, plus RPC where a transaction is required.**

The Supabase client speaks PostgREST. PostgREST cannot express a multi-statement
transaction, so anything that must be atomic is a `SECURITY DEFINER` function
called through `.rpc()`:

- `cast_vote` — the ballot, both counters, and the open-vote re-check, in one
  transaction, idempotent on `(user_id, vote_id)`
- `claim_vote_nft_records` — `ON CONFLICT DO NOTHING` claim so a re-run is a
  no-op rather than a duplicate or an outage
- `get_or_create_payment` — insert-or-return keyed on the idempotency key

Every such function is `SET search_path = ''` and fully qualifies its names, and
its EXECUTE grant is explicit. `20260904000001` revoked the default PUBLIC
EXECUTE from six of them; keep that in mind before adding an overload, because
a new signature is a new function with a fresh default grant.

## Errors

Two shapes coexist, on purpose.

Repository functions in `db.ts` throw. `castVote` throws a typed
`CastVoteRejected` carrying the SQLSTATE the function raised, so the route can
map `VOTE_ENDED` to the message for a vote that ended rather than to a generic
500.

Newer server code under `server/` uses `neverthrow` — `Result` / `ResultAsync`
with an `AppError` union (`server/http/errors.ts`). `createCreationFeePort` is
the reference: every database failure becomes `paymentInvalid`, a 402, because
the caller's dialog has copy for exactly one outcome and a 500 would be a lie.

Do not convert one style to the other wholesale. Convert at the boundary of the
code you are already changing.

## Idempotency

Three distinct mechanisms, and they are not interchangeable:

- **Unique constraint as the guard.** `payments.idempotency_key` is UNIQUE, and
  the creation-fee port re-reads on violation rather than pre-checking. Two
  racing approvals both read null, both insert, the loser re-reads and returns
  the winner's row.
- **Atomic claim.** `markPaymentCompleted` flips `pending → completed` in one
  statement and returns the row only to the caller that won. All fulfilment
  gates on a non-null return, because the provider retries on any non-2xx.
- **Idempotent RPC.** `cast_vote` returns the ballot already cast instead of
  writing a second one.

A check-then-act read is none of these. Where you see one, it is either
protecting a charge (and the constraint behind it is what protects the data), or
it is a bug.

## Two schemas, one database

`public` belongs to this repository. `discovery` belongs to `taruu-agents` and
has its own migration ledger with its own numbering (`NNNN_name.sql` against
this one's `YYYYMMDDNNNNNN_name.sql`).

There are no foreign keys between them, and that is a rule rather than an
accident. `discovery.municipality_bridge` is the join, and it is a table of
recorded correspondences: its discovery half is a foreign key, its public half
deliberately is not, because a cross-schema key would make a discovery migration
fail on any database without this repository's tables — including discovery's
own test containers. See `0073_municipality_bridge_slug_fk.sql`.

## Migrations

- Forward-only. An applied migration is immutable; fix it with a new one.
- `ADD CONSTRAINT ... NOT VALID` then `VALIDATE CONSTRAINT` as two statements.
  The first takes a brief `ACCESS EXCLUSIVE` lock for the catalog change; the
  second scans under `SHARE UPDATE EXCLUSIVE`, which blocks neither readers nor
  writers. Do this even when the table is empty — the split stops being
  optional exactly when someone forgets it is not.
- Preflight refuses, it does not clean. A migration that would silently null or
  delete an offending row raises with the offending ids instead, and says what
  decision the operator has to make. Ids, never values: these tables carry
  payment amounts and residency evidence.
- `supabase/tests/*.sql` runs the whole chain against a disposable
  `postgres:16` (`scripts/db-test.sh`, and the `database` job in
  `.github/workflows/agent-verification.yml`). Each file wraps itself in
  `BEGIN`/`ROLLBACK`. Assert the catalog as well as the behaviour: a `NOT VALID`
  constraint behaves exactly like a valid one for every new row, so only
  `pg_constraint.convalidated` can tell you whether the rows already in the
  table were ever checked.

## Generated types are hand-maintained

`apps/web/src/lib/supabase/types.ts` is checked in and edited by hand. It has
drifted: several columns typed non-nullable are nullable in the database — for
example `verification_schedule.completed`, `verification_runs.status`,
`payments.status` and most `created_at` columns, all of which are `DEFAULT`
without `NOT NULL`. Nothing has broken because nothing writes NULL there, but
the file is a claim the database does not currently back.

Regenerating it (`supabase gen types typescript`) would correct the nullability
in one step and produce a large diff that ripples into every consumer of those
fields. That is worth doing deliberately, on its own, and it is recorded in
`DATA-MODEL-OPEN-DECISIONS.md` rather than done as a side effect of something
else.
