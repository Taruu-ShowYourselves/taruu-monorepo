-- =============================================================================
-- 20260904000007 — a participation payment names a real ballot choice
--
-- WHAT THIS CLOSES
--
--   `payments` carries (vote_id, option_id) and nothing tied them together, or
--   to anything real. 20260904000006 made `option_id` a UUID, which stops the
--   value being unusable garbage; it does not stop it being a well-formed id
--   for an option in a different vote, or for an option that never existed.
--
--   The consequence is not a bad row, it is a bad charge. The ballot is not
--   cast at payment time - it is cast by the Green Invoice webhook, which calls
--   `cast_vote` AFTER `markPaymentCompleted` has atomically claimed the
--   payment. `cast_vote` does refuse a mismatched option, correctly. But by
--   then the money has moved and the provider's retry short-circuits on the
--   claim, so the refusal lands in a place no retry ever reaches. The resident
--   is charged for a ballot that cannot be cast, and only reconciliation from
--   `payments` + `webhook_events` finds it.
--
--   POST /api/payments/create now reads the vote and refuses an option that
--   does not belong to it, which closes the ordinary case at the boundary where
--   a charge can still be avoided. That check is a read-before-insert, and this
--   migration exists because a read-before-insert is not a constraint: it
--   cannot see a vote deleted between the check and the write, and it protects
--   only the callers that remember to make it.
--
--   Neither this constraint nor that check closes the ASYNCHRONOUS case, and it
--   is worth being exact about that rather than letting the header imply
--   otherwise: the hosted payment page can be paid after the vote closes, and
--   nothing here can refuse a settlement. That residual is a refund policy -
--   see docs/DATA-MODEL-OPEN-DECISIONS.md. What this migration guarantees is
--   narrower and still worth having: no row in this table names a ballot choice
--   that never belonged to the vote it was paid into.
--
-- WHY THIS IS SAFE TO STATE NOW AND WAS NOT BEFORE
--
--   The composite foreign key needs a composite key on the parent.
--   `vote_options` gained `UNIQUE (id, vote_id)` in 20260904000002, added there
--   so `user_votes` could carry the same constraint. `payments` is the second
--   consumer of that key, not a reason to invent a new one.
--
-- THE TWO HALVES, AND WHY BOTH ARE NEEDED
--
--   A foreign key alone is not enough. `payments.vote_id` is nullable - a
--   creation fee legitimately has no vote at the moment it is recorded - and a
--   multi-column foreign key under the default MATCH SIMPLE is NOT CHECKED AT
--   ALL when any of its columns is NULL. So `(option_id = <anything>, vote_id =
--   NULL)` would sail past the foreign key untouched: precisely the row that
--   most needs catching, and the one this migration would otherwise appear to
--   have fixed.
--
--   MATCH FULL is not the answer either. It demands all-null or all-non-null,
--   which would reject the creation fee `createCreationFeePort` writes today -
--   `vote_id` set, `option_id` null - and that row is correct.
--
--   So the shape is stated as a CHECK and the reference as a FOREIGN KEY. The
--   CHECK is written per payment TYPE rather than as the weaker "an option
--   implies a vote", because the weaker form still admits both shapes the route
--   now refuses: a `vote_participation` row with no ids at all (charged, and no
--   ballot can ever be cast from it - the webhook casts only
--   `if payment.vote_id AND payment.option_id`), and a `vote_creation` row
--   carrying a ballot choice for a vote the fee is paying to create. Alternate
--   writers exist - the service role, and `get_or_create_payment` - so a rule
--   the route enforces and the table does not is a rule with a way around it.
--
--     type = 'vote_participation' -> vote_id AND option_id both present
--     type = 'vote_creation'      -> option_id absent
--     FOREIGN KEY (option_id, vote_id)
--       REFERENCES vote_options (id, vote_id)    -- and it is that vote's
--
--   Together they leave exactly three legal shapes, which are the three the
--   product actually has:
--
--     creation,      (NULL, NULL)      a fee before its vote exists
--     creation,      (NULL, vote)      a fee against a known vote
--     participation, (option, vote)    a payment naming a real ballot choice
--
--   The CHECK is spelled as a disjunction of the two known types rather than a
--   CASE, so it FAILS CLOSED: `payment_type` has exactly two labels today
--   (verified 2026-08-25), and a third added later matches neither arm and is
--   refused until somebody states its contract here. A CASE with no ELSE would
--   evaluate to NULL for the new label, and a NULL CHECK passes.
--
-- ON DELETE RESTRICT, NOT CASCADE
--
--   CASCADE here would mean deleting a vote deletes the payment rows that paid
--   into it. Those are financial records; they must outlive the thing they
--   bought. RESTRICT is also the shape this schema already uses everywhere a
--   row carries value - `vote_nfts.vote_id` and `issue_coins.vote_id` are both
--   ON DELETE RESTRICT - so this is the existing convention applied to the one
--   table that most obviously belongs to it, not a new policy.
--
--   `vote_options` rows are only ever deleted by cascade from `votes`, so in
--   practice this makes a vote with payments against it undeletable. That is
--   the intended reading and it changes nothing today: no code path in this
--   repository deletes a vote (verified 2026-08-25 - `from('votes')` has no
--   `.delete()` anywhere in apps/web or packages). If a deliberate vote-removal
--   feature is ever built, it inherits an explicit decision to make about the
--   payments instead of silently destroying them.
--
-- PRODUCTION SHAPE (read-only, 2026-08-25)
--
--   `public.payments` is EMPTY - 0 rows, 0 with an option, 0 with a vote. Both
--   constraints are therefore satisfied vacuously and VALIDATE scans nothing.
--   The preflight below is still written to refuse rather than clean, because a
--   migration that is safe only because of a row count observed once is safe
--   only until that count changes.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
--   * No foreign key on `payments.vote_id` by itself. A creation fee's vote_id
--     points at a real vote and should be anchored, but the composite key above
--     already anchors every row that carries an option, and a second overlapping
--     foreign key on the same column is the kind of pair that reads as
--     disagreeing later. Recorded as a follow-up.
--   * No index. The foreign key's own lookups go to the parent's unique index;
--     nothing queries `payments` by option.
--
-- ROLLBACK
--   ALTER TABLE public.payments DROP CONSTRAINT payments_option_belongs_to_vote;
--   ALTER TABLE public.payments DROP CONSTRAINT payments_ids_match_type;
-- =============================================================================

-- ── 0. Preflight: refuse rather than clean ──────────────────────────────────

DO $preflight$
DECLARE
  mismatched  UUID[];
  danglers    UUID[];
BEGIN
  SELECT coalesce(array_agg(p.id ORDER BY p.id), '{}')
    INTO mismatched
    FROM public.payments p
   WHERE NOT (
     (p.type = 'vote_participation'
        AND p.vote_id IS NOT NULL AND p.option_id IS NOT NULL)
     OR
     (p.type = 'vote_creation' AND p.option_id IS NULL)
   );

  IF array_length(mismatched, 1) > 0 THEN
    RAISE EXCEPTION
      'payments carry ids that do not match what they paid for: %',
      mismatched
      USING HINT = 'A participation payment with no option was charged and can '
                   'never produce a ballot; a creation fee with one names a '
                   'choice in a vote it is paying to create. Decide per row '
                   'before re-running. Do not null the option to make the '
                   'constraint pass: it is the only record of what the '
                   'resident paid to choose.';
  END IF;

  SELECT coalesce(array_agg(p.id ORDER BY p.id), '{}')
    INTO danglers
    FROM public.payments p
   WHERE p.option_id IS NOT NULL
     AND p.vote_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.vote_options o
        WHERE o.id = p.option_id AND o.vote_id = p.vote_id
     );

  IF array_length(danglers, 1) > 0 THEN
    RAISE EXCEPTION
      'payments name an option that does not belong to their vote: %',
      danglers
      USING HINT = 'These are charges whose ballot could never have been cast. '
                   'Reconcile them (refund or re-point) before anchoring.';
  END IF;
END;
$preflight$;

-- ── 1. the ids a payment carries match what it is paying for ────────────────
-- Stated first. The foreign key below is silent on NULL-bearing rows, so
-- without this every NULL-carrying shape would remain legal and unanchored.

ALTER TABLE public.payments
  ADD CONSTRAINT payments_ids_match_type
  CHECK (
    (type = 'vote_participation'
       AND vote_id IS NOT NULL AND option_id IS NOT NULL)
    OR
    (type = 'vote_creation' AND option_id IS NULL)
  )
  NOT VALID;

ALTER TABLE public.payments
  VALIDATE CONSTRAINT payments_ids_match_type;

-- ── 2. and it is that vote's option ─────────────────────────────────────────
-- Split into ADD NOT VALID + VALIDATE for the usual reason: ADD alone takes a
-- brief ACCESS EXCLUSIVE lock for the catalog change, VALIDATE then scans under
-- SHARE UPDATE EXCLUSIVE, which does not block readers or writers. The table is
-- empty today; the split costs nothing and stops being optional the moment it
-- is not.

ALTER TABLE public.payments
  ADD CONSTRAINT payments_option_belongs_to_vote
  FOREIGN KEY (option_id, vote_id)
  REFERENCES public.vote_options (id, vote_id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.payments
  VALIDATE CONSTRAINT payments_option_belongs_to_vote;

COMMENT ON CONSTRAINT payments_ids_match_type ON public.payments IS
  'A participation payment names a vote AND an option; a creation fee names no '
  'option. Paired with payments_option_belongs_to_vote, which under MATCH '
  'SIMPLE does not check a row carrying a NULL at all. Fails closed on a '
  'payment_type label that is neither.';

COMMENT ON CONSTRAINT payments_option_belongs_to_vote ON public.payments IS
  'A participation payment names an option of the vote it is paying into. '
  'ON DELETE RESTRICT: payment records outlive the vote they bought.';
