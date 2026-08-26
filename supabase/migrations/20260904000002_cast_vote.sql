-- =============================================================================
-- One transactional, idempotent way to cast a ballot.
--
-- WHAT WAS WRONG
--
-- Casting a vote was three independent writes issued from Next.js, with no
-- transaction around them and two different callers doing it differently.
--
--   apps/web/src/app/api/votes/[id]/participate/route.ts:144-160
--     recordUserVoteOnce()                     -- the ballot
--     increment_vote_option(option_id)         -- which already bumps BOTH
--                                                 vote_options.votes AND
--                                                 votes.participant_count
--     UPDATE votes SET participant_count = <value read earlier> + 1
--
-- The third write is a lost update on top of a double count. The RPC has
-- already incremented `participant_count` by the time the UPDATE runs, and the
-- UPDATE then overwrites it with an absolute value computed from a read taken
-- before the ballot existed. Two voters landing together resolve to one
-- increment; the RPC's own increment is erased every time. The counter is
-- wrong in both directions and the direction depends on timing.
--
--   apps/web/src/app/api/payments/webhook/route.ts:189-201
--     recordUserVote()                         -- throws on a duplicate
--     increment_vote_option(option_id)
--
-- The paid path checks nothing at all: not that the vote is open, not that the
-- option belongs to the vote, not that the ballot is new. It trusts
-- `payments.option_id`, which is TEXT. An option id belonging to a different
-- vote moves that other vote's tally -- cross-vote tally poisoning. And a
-- failure here is caught, logged, and then the webhook event is marked
-- `processed` anyway (route.ts:238), so the retry that would have fixed it
-- never comes.
--
-- Between the two of them, a crash after the ballot insert leaves a vote
-- recorded with no tally, and a crash after the tally leaves a tally with no
-- ballot. Nothing reconciles either.
--
-- WHAT THIS MIGRATION DOES
--
-- 1. A composite foreign key, so an option can only be voted for inside the
--    vote it belongs to. This is the invariant `user_votes` was missing: it
--    referenced `vote_options(id)` and `votes(id)` separately, and nothing tied
--    the two together. The database now refuses the poisoning case even if
--    every application check is bypassed.
--
-- 2. `public.cast_vote(...)` -- one function, one transaction, doing all three
--    writes or none. Idempotent on replay by the `UNIQUE (user_id, vote_id)`
--    that was already there, so a double-click, a retried request or a
--    redelivered webhook returns the ballot already cast rather than a second
--    row or a second increment.
--
-- The `user_votes` ledger stays authoritative. `vote_options.votes` and
-- `votes.participant_count` remain caches of it, moved only in the same
-- transaction as the row they count, never derived from a prior read.
--
-- APPLYING THIS
--
-- Verified read-only against production on 2026-08-25: `user_votes` is empty,
-- `payments` is empty, no option is referenced by a ballot in another vote, and
-- neither counter has drifted from the ledger. The constraint therefore
-- validates instantly and needs no NOT VALID / VALIDATE split, and there is no
-- historical drift to repair. If that is no longer true when this is applied,
-- re-run the checks in the block below before proceeding.
--
--   SELECT count(*) FROM public.user_votes uv
--     JOIN public.vote_options o ON o.id = uv.option_id
--    WHERE o.vote_id <> uv.vote_id;          -- must be 0
--
-- WHAT THIS MIGRATION DOES NOT DO
--
-- It does not drop `increment_vote_option`. After the application change that
-- accompanies this migration nothing calls it, which makes it a candidate for
-- the dead-RPC pass (20260903000002, PR #142) rather than for a migration whose
-- job is to make voting correct. Its anon exposure was already closed by
-- 20260904000001.
-- =============================================================================

-- ── 1. the columns cast_vote reasons about must actually hold a value ───────
--
-- All three carry a default and are nullable, which is not the same thing as
-- being populated. A NULL `status` makes `status <> 'active'` evaluate to NULL,
-- which PL/pgSQL reads as false -- so a vote with no status would have been
-- open to everyone. A NULL counter makes `counter + 1` NULL, so a ballot could
-- be recorded while the tally it belongs to silently emptied itself.
--
-- Verified read-only against production on 2026-08-25: no row in `votes` has a
-- NULL status or participant_count, and no row in `vote_options` has a NULL
-- tally (947 votes, 2838 options). These scans are therefore cheap and cannot
-- fail on data that exists today.

ALTER TABLE public.votes
  ALTER COLUMN status            SET NOT NULL,
  ALTER COLUMN participant_count SET NOT NULL;

ALTER TABLE public.vote_options
  ALTER COLUMN votes SET NOT NULL;

-- ── 2. an option can only be voted for inside its own vote ──────────────────

-- `id` is already the primary key; this pairs it with `vote_id` so the tuple is
-- referenceable. It admits nothing the primary key did not already admit.
-- UNIQUE cannot be added NOT VALID, but `vote_options` is small (2838 rows) and
-- is not on a hot write path, so the scan is not worth engineering around.
ALTER TABLE public.vote_options
  ADD CONSTRAINT vote_options_id_vote_id_key UNIQUE (id, vote_id);

-- Split rather than validated inline. `user_votes` is empty today, so this
-- costs nothing now -- but a migration that is safe only because of a fact
-- recorded in a comment is safe only until that fact changes. NOT VALID takes
-- the lock for the catalog change alone; VALIDATE then scans under a lock that
-- does not block reads or writes.
ALTER TABLE public.user_votes
  ADD CONSTRAINT user_votes_option_belongs_to_vote
  FOREIGN KEY (option_id, vote_id)
  REFERENCES public.vote_options (id, vote_id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.user_votes
  VALIDATE CONSTRAINT user_votes_option_belongs_to_vote;

-- The single-column foreign key is now strictly weaker than the composite one
-- and enforces nothing it does not. Dropping it leaves one constraint to reason
-- about instead of two that can be read as disagreeing.
ALTER TABLE public.user_votes
  DROP CONSTRAINT IF EXISTS user_votes_option_id_fkey;

-- ── 3. the canonical cast ───────────────────────────────────────────────────

-- Rejections are raised, not returned, so the transaction unwinds and no
-- partial write survives. The SQLSTATEs are stable and the routes map them back
-- to the HTTP codes those endpoints already return:
--
--   TV001  the vote does not exist
--   TV002  the vote has ended
--   TV003  the option does not belong to this vote
--   TV004  the vote is not open yet
--
-- TV002 and TV004 are separate because the endpoint has always told those two
-- apart, and "refresh and try again" is actively wrong advice for a vote that
-- is over. A single not-open code would have collapsed that distinction the
-- moment the database became the thing that decides.
--
-- `already voted` is not an error. It is the idempotent outcome, and callers
-- need to tell it apart from a fresh ballot without parsing a message.
CREATE OR REPLACE FUNCTION public.cast_vote(
  p_user_id    UUID,
  p_vote_id    UUID,
  p_option_id  UUID,
  p_payment_id UUID DEFAULT NULL
)
RETURNS TABLE (
  out_outcome           TEXT,
  out_ballot_id         UUID,
  out_option_id         UUID,
  out_option_votes      INTEGER,
  out_participant_count INTEGER,
  out_created_at        TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status     public.vote_status;
  v_end_date   TIMESTAMPTZ;
  v_ballot_id  UUID;
BEGIN
  -- FOR UPDATE, so that a vote being closed and a ballot being cast cannot
  -- interleave. Without it the status read and the insert are separate points
  -- in time: a close committing between them would leave a ballot recorded
  -- against a vote that was already over, since neither UPDATE below carries an
  -- open-status predicate. The lock costs nothing extra -- every accepted cast
  -- already updates this row to move participant_count, so casts into the same
  -- vote serialize here either way.
  SELECT v.status, v.end_date
    INTO v_status, v_end_date
    FROM public.votes v
   WHERE v.id = p_vote_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'vote % does not exist', p_vote_id USING ERRCODE = 'TV001';
  END IF;

  -- Mirrors the participate route exactly: a stored status can lag the clock,
  -- so a vote past its end_date is closed whatever the column says.
  --
  -- clock_timestamp(), not now(). now() is fixed at the start of the
  -- transaction, and the FOR UPDATE above can block for as long as another
  -- cast into this vote takes. A request that arrived a moment before the
  -- deadline could wait past it and still be measured against the time it
  -- arrived. The deadline has to be read after the wait, not before it.
  --
  -- IS DISTINCT FROM rather than <>: the NOT NULL above makes a NULL status
  -- impossible, and this keeps the check correct even if that is ever relaxed.
  -- With <>, a NULL status yields NULL, PL/pgSQL reads NULL as false, and the
  -- vote reads as open -- the most permissive possible answer to "is this
  -- vote's state unknown?".
  IF v_status = 'ended' OR v_end_date < clock_timestamp() THEN
    RAISE EXCEPTION 'vote % has ended', p_vote_id
      USING ERRCODE = 'TV002';
  END IF;

  IF v_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'vote % is not open yet', p_vote_id
      USING ERRCODE = 'TV004';
  END IF;

  -- The composite foreign key below would refuse this too, but as a constraint
  -- violation that reads like a bug rather than like a rejected ballot.
  PERFORM 1
     FROM public.vote_options o
    WHERE o.id = p_option_id
      AND o.vote_id = p_vote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'option % does not belong to vote %', p_option_id, p_vote_id
      USING ERRCODE = 'TV003';
  END IF;

  INSERT INTO public.user_votes (user_id, vote_id, option_id, payment_id)
       VALUES (p_user_id, p_vote_id, p_option_id, p_payment_id)
  ON CONFLICT (user_id, vote_id) DO NOTHING
    RETURNING id INTO v_ballot_id;

  IF v_ballot_id IS NOT NULL THEN
    -- Read-modify-write in one statement: the row lock is taken and released by
    -- the UPDATE itself, so concurrent voters queue rather than overwrite.
    UPDATE public.vote_options o
       SET votes = o.votes + 1
     WHERE o.id = p_option_id;

    UPDATE public.votes v
       SET participant_count = v.participant_count + 1,
           updated_at = now()
     WHERE v.id = p_vote_id;
  END IF;

  RETURN QUERY
    SELECT CASE WHEN v_ballot_id IS NOT NULL THEN 'cast' ELSE 'already_voted' END,
           uv.id,
           uv.option_id,
           o.votes,
           v.participant_count,
           uv.created_at
      FROM public.user_votes uv
      JOIN public.vote_options o ON o.id = uv.option_id
      JOIN public.votes v        ON v.id = uv.vote_id
     WHERE uv.user_id = p_user_id
       AND uv.vote_id = p_vote_id;
END;
$$;

COMMENT ON FUNCTION public.cast_vote(UUID, UUID, UUID, UUID) IS
  'The only supported way to record a ballot. Validates the vote is open and '
  'the option belongs to it, inserts the ballot idempotently, and moves both '
  'counters in the same transaction. Returns outcome ''cast'' or '
  '''already_voted''. Service-role only.';

REVOKE ALL ON FUNCTION public.cast_vote(UUID, UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_vote(UUID, UUID, UUID, UUID)
  TO service_role;
