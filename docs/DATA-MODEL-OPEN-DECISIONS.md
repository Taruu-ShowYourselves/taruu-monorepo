# Data-model decisions that are not engineering's to make

Each item below was investigated, is real, and was deliberately **not** changed,
because choosing an answer would be choosing a product, legal or retention
policy rather than fixing a defect. Each says what the contradiction is, what
the options cost, and what evidence would settle it.

Written 2026-08-25 at the end of a five-stage data-integrity pass. Production
row counts are read-only observations from that date.

---

## 1. Identity-document audit events vs. erasure

**Where:** `identity_document_events`, migration `20260728000004`.

The table's own header says why it exists: *"Access audit (Data Security
Regulations: retain access logs ≥24 months)."* Its foreign key says the
opposite: `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`.
Deleting the user erases the audit trail the regulation requires be kept — and
the event vocabulary includes `'deleted'`, the record of a deletion, which goes
with it.

The same tension sits on `identity_documents` itself, which stores an HMAC of
the ID number rather than the number, precisely so that it can be retained
safely.

**What is at stake either way.** Israeli PPL Amendment 13 and the Data Security
Regulations impose a retention duty on access logs; a data-subject erasure
request pulls the other way. Which wins is a question about lawful basis and
about what "erasure" means for a hashed identifier — not a schema question.

**Options, none of them free:**
- `ON DELETE RESTRICT` — the audit survives; a user cannot be deleted until
  someone decides what to do with it.
- `ON DELETE SET NULL` on a nullable `user_id` — the event survives
  de-identified; it stops being an audit of a *person*, which may be exactly
  what the regulation wants retained.
- Leave `CASCADE`, and state in the privacy documentation that erasure destroys
  the access log. This is the current behaviour, currently undocumented.

**Settled by:** counsel's reading of the retention duty against the erasure
right. Not by a migration.

**Urgency:** low today, unbounded later. `identity_documents` and
`identity_document_events` are both empty in production, and no code path
deletes a user. The decision is free to make now and expensive after the first
erasure request.

---

## 2. Payment records vs. user deletion

**Where:** `payments.user_id ... ON DELETE CASCADE`, migration `20240101000000`.

Same shape, higher stakes: deleting a user destroys their payment records.
Financial records normally carry a statutory retention period of their own, and
they are the only evidence that money moved.

Stage 5 anchored the *other* direction — `payments_option_belongs_to_vote` is
`ON DELETE RESTRICT`, so deleting a vote cannot destroy the payments made into
it (`20260904000007`). The user direction was left alone because "a resident
asked to be forgotten" is a different question from "a vote was removed", and
only the first one is about a person's rights.

**Options:** `RESTRICT`; or `SET NULL` on a nullable `user_id`, keeping the
amount and the transaction while dropping the person; or leave `CASCADE` and say
so in the retention policy.

**Settled by:** the retention period that applies to payment records, and
whether an anonymised payment row still satisfies it.

**Urgency:** low today. `payments` is empty in production (0 rows), and no code
path deletes a user.

---

## 3. `votes.status` and `votes.resolution_status`

**Where:** `votes`, columns from `20240101000000` and `20250118000001`.

Two status columns whose vocabularies overlap: `resolution_status` is one of
`pending | resolving | resolved | failed`, and `status` — through
`PUBLIC_VOTE_STATUSES` — includes `resolving`, `resolved` and `failed` as well.
A reader cannot tell from the schema which one is authoritative while a vote is
being resolved.

Collapsing them is explicitly out of scope, and correctly so: they are read by
different consumers, and merging them is a product decision about what the
public list should show mid-resolution.

**Why no invariant `CHECK` was added instead.** The obvious candidate is
"a vote cannot be resolving while it is still open" —
`resolution_status IS NULL OR status <> 'active'`. It is false against the code
as written: `getVotesNeedingResolution` selects `status IN ('active', 'ended')`
with a passed `end_date`, and `resolveVote` then writes
`resolution_status = 'resolving'` — so an `active` vote legitimately carries a
resolution status today. Any `CHECK` tight enough to be worth adding would first
require deciding whether that selection is correct, which is the same product
decision.

**Recorded here instead:** the transitional debt is real, the two columns do
overlap, and the resolution state machine is documented in the header of
`20260904000003` — including the fact that selection has no atomic claim, so
overlapping cron ticks can both enumerate one vote. That last part is a
correctness issue rather than a modelling one, and `claim_vote_nft_records`
makes the consequence idempotent.

**Production state:** 947 votes; `status` is only ever `active` or `ended`;
`resolution_status` is NULL on every row. Nothing has resolved yet, so whatever
is decided can be decided cleanly.

---

## 4. Generated Supabase types have drifted from the schema

**Where:** `apps/web/src/lib/supabase/types.ts`, hand-maintained.

Columns declared non-nullable in the types are nullable in the database —
every column defined `DEFAULT x` without `NOT NULL`. Confirmed against
production on 2026-08-25:

| Column | types.ts | database |
|---|---|---|
| `verification_schedule.completed` | `boolean` | nullable |
| `verification_schedule.reminder_sent` | `boolean` | nullable |
| `verification_runs.status` | non-null | nullable |
| `verification_runs.total_check_ins` | non-null | nullable |
| `payments.status` | non-null | nullable |
| `payments.currency` | non-null | nullable |
| most `created_at` / `updated_at` | non-null | nullable |

Nothing writes NULL to any of them, so nothing is broken. But the type is a
claim the database does not back, and it is the kind of claim that turns into a
runtime `undefined` the first time a row arrives from anywhere other than the
usual writer.

**Why this was not fixed here.** `supabase gen types typescript` corrects it in
one step and produces a wide diff touching every consumer of those fields — a
change worth making deliberately and reviewing on its own, not one to fold into
a constraint-hardening pass. Two options: regenerate and absorb the ripple, or
add `NOT NULL` to the columns that genuinely are always written (which is a
migration and a separate argument per column).

**Not a decision for counsel** — this one is purely a scheduling call.

---

## 5. Paid vote participation is a retired path that is still reachable

**Where:** `POST /api/payments/create`, `type: 'vote_participation'`.

`cfa5d25` (2026-07-29) made participation free: *"Participation is free at
launch; only vote creation (₪50) stays paid… Vote flow becomes choice → confirm
→ seal (no payment step, no payments API call)."* The endpoint that charges for
a ballot was not removed. It is still reachable by any authenticated caller, it
still creates a Green Invoice payment page, and its webhook still casts the
ballot.

Two pieces of corroborating evidence that nothing drives it any more:
`packages/api-client/src/payments.ts` sends `type: 'vote'` and
`type: 'create_vote'`, neither of which this route accepts; and the pilot
residency gate, written a week after the fee was dropped, was applied only to
the free route.

Stage 5 hardened the path rather than removing it — the option is now required,
the vote must be open, the option must belong to it, and the pilot gate applies,
all before a charge. Removing it is a product decision: whether paid
participation ever returns, or whether the endpoint should refuse
`vote_participation` outright and leave only the creation fee.

**Settled by:** product, on whether participation stays free.

---

---

## 6. A payment that settles after its ballot stopped being castable

**Where:** `POST /api/payments/create` and `POST /api/payments/webhook`.

Payment is two-phase. This route hands back a hosted Green Invoice page; the
ballot is cast by the webhook when the resident actually pays, which may be much
later. Every authorisation the route performs is therefore a **snapshot**:

- the vote is open *now* (`decideParticipationOpen`)
- the option belongs to it *now*
- the resident is in the pilot cohort *now* (`decidePilotGate`)
- the resident is eligible *now* (`checkVoterEligibility`)

Any of those can be false by the time the payment settles. The vote can end. A
municipality can join or leave the pilot. The resident can change municipality.
The `expiresAt` in the response is this route's own advertised window and is not
enforced by the provider.

What happens then is well-defined but unsatisfying: `markPaymentCompleted`
claims the payment atomically, `castVote` refuses, the error propagates, the
webhook event is marked `failed` with the reason — and the provider's retry
short-circuits on the claim, so it never reaches fulfilment again. The money
moved and no ballot exists. It is discoverable (`payments` + `webhook_events`
carry everything needed) and it is not silent, but it is not resolved either.

Neither the webhook nor `cast_vote` re-applies the pilot gate at all, so the
cohort case does not even fail — it settles into a ballot that the free route
would have refused.

**What the fix requires, and why it was not done here:**

- *Re-check at fulfilment.* Straightforward for the pilot gate, and it should be
  done. It converts the cohort case from a wrong ballot into the same
  charged-and-refused state as the others — which is progress, and still leaves
  the money question open.
- *Decide what happens to the money.* Automatic refund, a `refunded` status
  reconciled by hand, or credit against a future vote. `payment_status` already
  has a `refunded` label and nothing writes it. This is the refund policy, and
  it is a product and finance decision.
- *Or shorten the window.* Only if the provider can be told to expire a form at
  a specific time; the current `expiresAt` does not do that.

**Settled by:** product/finance, on the refund. Engineering can do the
fulfilment-time re-check independently and should.

**Urgency:** low today — participation is free (see §5) and `payments` is empty
— but this becomes live the moment paid participation does.

---

## Engineering follow-ups (no decision required, just work)

- **An idempotency key is not bound to the request it identifies.** The caller
  supplies the key, and a replay is matched on `(user_id, idempotency_key)`
  alone — `type`, `voteId` and `optionId` are never compared against the stored
  row. Reusing your own key for a semantically different request therefore
  returns `200 { idempotent: true }` describing the *original* payment. It is
  scoped to one user since `20260904000009`, so it is not a cross-resident
  issue; it is an API-correctness one. The conventional fix is to store a
  fingerprint of the request alongside the key and return `409` when a replay
  disagrees with it.
- **Re-apply the pilot gate at fulfilment.** See §6; the webhook has the vote
  and the user and calls `castVote` already.
- **`get_or_create_payment` was scoped to the caller's own payments** in
  `20260904000009`, by a body-only `CREATE OR REPLACE` that keeps the signature
  byte-identical so the revoked ACL from `20260904000001` survives. It was dead
  code with a bug rather than a live hole — no grant, no caller, and PR #142
  drops it — but it was repaired rather than left, because "#142 will delete it"
  is a plan, not a property of the database. Nothing outstanding here; the entry
  stays so the repair is not mistaken for an oversight when #142 lands.
- **`payments.vote_id` has no foreign key of its own.** The composite key added
  in `20260904000007` anchors every row that carries an option; a creation fee
  carrying only a vote id is still unanchored. A second overlapping key on the
  same column reads as a competing rule, so this wants doing as one deliberate
  change.
- **`getPaymentById` and `getPaymentByProviderId` are unscoped.** Both are
  currently called only from the webhook, which is authenticated as the provider
  and legitimately needs any payment. `getPaymentByIdempotencyKey` was scoped in
  Stage 5 because it is reachable from a resident-facing route. If either of the
  other two ever gains a caller behind a user session, it needs the same
  treatment.
- **Vote resolution has no atomic claim.** `getVotesNeedingResolution` reads
  `resolution_status IS NULL` and `resolveVote` writes `'resolving'` only
  afterwards, so overlapping cron ticks enumerate the same vote.
  `claim_vote_nft_records` makes the *consequence* idempotent; the selection race
  itself is still open.
- **The duplicate-index allowlist in `supabase/tests/no_duplicate_indexes.sql`
  should be deleted** in the same change that merges PR #142. Its ordinal
  recreation check is anchored on a migration number, which is a heuristic that
  holds only while the cleanup has not yet been applied.
