-- =============================================================================
-- 20260904000010 — close the contract 20260904000008 opened
--
-- WHAT THIS IS
--
--   The CONTRACT half of an expand/contract pair. 20260904000008 added
--   `verification_schedule.user_id` in a form both the old and the new writer
--   can satisfy: nullable, with a trigger that derives the value from the run
--   when a writer omits it. This file states the invariant permanently and
--   removes the two single-column keys the composite ones have superseded.
--
-- DO NOT APPLY THIS UNTIL ALL THREE ARE TRUE
--
--   1. The application carrying `user_id` on the verification_schedule write
--      is deployed and serving. That is apps/web at the commit that merged
--      pull request #145 - `generateCheckInWindows(run.id, run.user_id, …)` in
--      apps/web/src/app/api/verification/start/route.ts.
--
--   2. Production has confirmed that new rows arrive with a user_id:
--
--        SELECT count(*) FILTER (WHERE user_id IS NULL) AS still_null,
--               count(*)                                AS total
--          FROM public.verification_schedule
--         WHERE created_at > '<the deploy timestamp>';
--
--      `still_null` must be 0. Zero total rows is NOT confirmation - it means
--      the writer has not run yet, and the answer is to wait, not to apply.
--
--   3. The backfill in 20260904000008 has completed. It runs inline in that
--      migration and covers every row that existed when it was applied; the
--      trigger covers every row written since. The preflight below is what
--      proves both, and it refuses rather than repairs.
--
--   Applying this early is safe for DATA - the preflight refuses - but it will
--   break the old writer the moment it succeeds, which is the whole reason the
--   split exists.
--
-- PRODUCTION SHAPE (read-only, 2026-08-30)
--
--   verification_runs 0 rows, verification_schedule 0 rows,
--   verification_attempts 0 rows. Every statement below touches nothing today.
--
-- ROLLBACK
--   ALTER TABLE public.verification_schedule
--     ALTER COLUMN user_id DROP NOT NULL;
--   ...and restore verification_schedule_run_id_fkey and
--   verification_attempts_schedule_id_fkey as single-column CASCADE keys:
--   ALTER TABLE public.verification_schedule
--     ADD CONSTRAINT verification_schedule_run_id_fkey
--     FOREIGN KEY (run_id) REFERENCES public.verification_runs (id)
--     ON DELETE CASCADE;
--   ALTER TABLE public.verification_attempts
--     ADD CONSTRAINT verification_attempts_schedule_id_fkey
--     FOREIGN KEY (schedule_id) REFERENCES public.verification_schedule (id)
--     ON DELETE CASCADE;
--
--   The trigger is not restored by a rollback because this file does not drop
--   it; see section 3.
-- =============================================================================

-- ── 0. Preflight: refuse rather than clean ──────────────────────────────────
--
-- Three separate questions, reported separately, because the fix differs. A
-- NULL means the writer is not deployed yet. A drifted pair means the trigger
-- or the composite key was bypassed. An unattributed attempt means the
-- residency evidence itself disagrees, and that is not a schema problem.

DO $preflight$
DECLARE
  unfilled  BIGINT;
  drifted   UUID[];
  orphaned  UUID[];
BEGIN
  SELECT count(*) INTO unfilled
    FROM public.verification_schedule
   WHERE user_id IS NULL;

  IF unfilled > 0 THEN
    RAISE EXCEPTION
      'verification_schedule still has % row(s) with no user_id', unfilled
      USING HINT = 'The application that writes user_id is not deployed, or '
                   'the 20260904000008 trigger was dropped. Deploy first, '
                   'confirm new rows carry a user_id, then re-run. Do not '
                   'backfill by hand to make this pass.';
  END IF;

  -- The composite key already forbids this, so a row here means the key was
  -- added NOT VALID and never validated, or was dropped. Checked anyway: this
  -- migration is about to make the column permanent.
  SELECT coalesce(array_agg(s.id ORDER BY s.id), '{}')
    INTO drifted
    FROM public.verification_schedule s
    JOIN public.verification_runs     r ON r.id = s.run_id
   WHERE s.user_id IS DISTINCT FROM r.user_id;

  IF array_length(drifted, 1) > 0 THEN
    RAISE EXCEPTION
      'verification_schedule rows disagree with their run''s resident: %',
      drifted
      USING HINT = 'verification_schedule_belongs_to_its_run should have made '
                   'this impossible. Check that it exists and is validated '
                   'before going further.';
  END IF;

  SELECT coalesce(array_agg(a.id ORDER BY a.id), '{}')
    INTO orphaned
    FROM public.verification_attempts a
    LEFT JOIN public.verification_schedule s
           ON s.id = a.schedule_id AND s.user_id = a.user_id
   WHERE s.id IS NULL;

  IF array_length(orphaned, 1) > 0 THEN
    RAISE EXCEPTION
      'check-ins reference no (schedule, resident) pair: %', orphaned
      USING HINT = 'This is residency evidence. Decide per row whether the '
                   'attempt or the schedule is wrong - do not rewrite user_id '
                   'to make the constraint pass.';
  END IF;
END;
$preflight$;

-- ── 1. the invariant becomes permanent ──────────────────────────────────────
--
-- A schedule row whose run vanished cannot exist - run_id is NOT NULL with a
-- cascading foreign key - so any row still NULL would mean the backfill and
-- the trigger both missed it. The preflight above has already proved they did
-- not; this is what stops it becoming possible again.

ALTER TABLE public.verification_schedule
  ALTER COLUMN user_id SET NOT NULL;

-- ── 2. the superseded single-column keys go ─────────────────────────────────
--
-- Both are now strictly weaker than the composite keys 20260904000008 added
-- and enforce nothing those do not. They were kept through the expand window
-- because that file was only allowed to add. Two constraints that can be read
-- as disagreeing is worse than one.
--
-- Dropping them is only safe once user_id is NOT NULL, which is why it happens
-- after section 1 and not before: a composite foreign key under the default
-- MATCH SIMPLE is not enforced AT ALL while any of its columns is NULL, so
-- until the line above ran, the single-column keys were the only thing
-- standing between a NULL-user row and a nonexistent parent.

ALTER TABLE public.verification_schedule
  DROP CONSTRAINT IF EXISTS verification_schedule_run_id_fkey;

ALTER TABLE public.verification_attempts
  DROP CONSTRAINT IF EXISTS verification_attempts_schedule_id_fkey;

-- ── 3. the derive trigger stays ─────────────────────────────────────────────
--
-- Deliberate, and the one judgement call in this file worth stating.
--
-- The trigger existed to carry the old writer through the window, and that
-- window is over by the time this runs. Dropping it would be tidier. It is
-- kept because it does not guess: it copies the value from
-- verification_runs, the row the composite foreign key makes authoritative, so
-- the only outcomes are the correct user or no user at all. Keeping it costs
-- one catalogue entry and removes the failure mode for every future writer
-- that forgets a denormalised column.
--
-- It does not weaken section 1. A run that cannot be resolved leaves the
-- column NULL and NOT NULL still refuses the row, so the invariant is enforced
-- by the constraint, not by the trigger.

COMMENT ON COLUMN public.verification_schedule.user_id IS
  'The run''s resident, denormalised so an attempt can be pinned to both its '
  'window and its person in one foreign key. Cannot drift from '
  'verification_runs.user_id: verification_schedule_belongs_to_its_run. '
  'NOT NULL since 20260904000010; filled from the run by '
  'verification_schedule_derive_user_id when a writer omits it.';
