-- =============================================================================
-- 20260904000008 — a check-in is attributed to the resident whose run it is
--
-- WHAT THIS CLOSES
--
--   The residency chain is three tables deep:
--
--     verification_runs (user_id)
--       └── verification_schedule (run_id)          -- the check-in windows
--             └── verification_attempts (schedule_id, user_id)
--
--   `verification_attempts` carries its own `user_id`, and nothing tied it to
--   the run the schedule belongs to. Any user id was accepted against any
--   window. The two agree today because there is exactly one writer -
--   POST /api/verification/check-in derives the schedule from the caller's own
--   active run - but "correct because the only writer happens to be correct" is
--   a property of the code, not of the data, and it is not what the reader of
--   this schema is entitled to assume.
--
--   What it protects is not bookkeeping. `verification_attempts` is the GPS
--   evidence that a person lives where they claim, `verification_runs.status`
--   turns into `users.verification_status`, and that is the ballot gate: the
--   participate route refuses anyone whose residency is not verified. A check-in
--   attributed to the wrong resident is one person's physical presence counting
--   as another person's right to vote.
--
-- WHY A COLUMN IS ADDED RATHER THAN A TRIGGER
--
--   A composite foreign key needs the parent to expose the pair, and
--   `verification_schedule` did not carry a user at all. The alternative was a
--   BEFORE INSERT trigger walking schedule -> run to compare. Both work; the
--   foreign key was chosen because it is declarative, cannot be disabled per
--   session, and is the shape this branch has already used twice for exactly
--   this problem - `user_votes (option_id, vote_id)` in 20260904000002 and
--   `payments (option_id, vote_id)` in 20260904000007. A third spelling of the
--   same idea would be the thing worth objecting to.
--
--   `verification_schedule.user_id` is therefore denormalised from its run on
--   purpose, and it cannot drift: the composite foreign key in section 2 makes
--   (run_id, user_id) refer to a real (id, user_id) pair, so a schedule row
--   whose user disagrees with its run's user cannot exist.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
--   * `verification_attempts.user_id` is NOT removed. It is now derivable
--     through the schedule, and dropping it is explicitly out of scope - the
--     column is read directly by `idx_verification_attempts_user` and by
--     per-user queries that would otherwise need a two-table join on the ballot
--     gate's hot path.
--   * The `verification_attempts.user_id -> users(id)` foreign key stays. It is
--     not made redundant by the composite key: it is what makes attempts vanish
--     with a deleted user, and it anchors the column to a real person
--     independently of any schedule.
--
-- PRODUCTION SHAPE (read-only, 2026-08-25)
--
--   verification_runs 0 rows, verification_schedule 0 rows,
--   verification_attempts 0 rows. The column add, the backfill, the NOT NULL
--   and both validations touch nothing. The preflight below still refuses
--   rather than cleans.
--
-- ROLLBACK
--   ALTER TABLE public.verification_attempts
--     DROP CONSTRAINT verification_attempts_belongs_to_its_run;
--   ALTER TABLE public.verification_schedule
--     DROP CONSTRAINT verification_schedule_belongs_to_its_run,
--     DROP COLUMN user_id;
--   ...and restore verification_schedule_run_id_fkey /
--   verification_attempts_schedule_id_fkey as single-column CASCADE keys.
-- =============================================================================

-- ── 0. Preflight: refuse rather than clean ──────────────────────────────────

DO $preflight$
DECLARE
  misattributed UUID[];
BEGIN
  SELECT coalesce(array_agg(a.id ORDER BY a.id), '{}')
    INTO misattributed
    FROM public.verification_attempts a
    JOIN public.verification_schedule s ON s.id = a.schedule_id
    JOIN public.verification_runs     r ON r.id = s.run_id
   WHERE a.user_id <> r.user_id;

  IF array_length(misattributed, 1) > 0 THEN
    RAISE EXCEPTION
      'check-ins are attributed to somebody other than the run''s resident: %',
      misattributed
      USING HINT = 'This is residency evidence. Decide per row whether the '
                   'attempt or the run is wrong before anchoring - do not '
                   'rewrite user_id to make the constraint pass.';
  END IF;
END;
$preflight$;

-- ── 1. the run exposes (id, user_id) ────────────────────────────────────────

ALTER TABLE public.verification_runs
  ADD CONSTRAINT verification_runs_id_user_id_key UNIQUE (id, user_id);

-- ── 2. the schedule carries, and is pinned to, its run's resident ────────────

ALTER TABLE public.verification_schedule
  ADD COLUMN user_id UUID;

UPDATE public.verification_schedule s
   SET user_id = r.user_id
  FROM public.verification_runs r
 WHERE r.id = s.run_id
   AND s.user_id IS NULL;

-- A schedule row whose run vanished cannot exist - run_id is NOT NULL with a
-- cascading foreign key - so any row still NULL here would mean the backfill
-- above missed something, and NOT NULL is the assertion that it did not.
ALTER TABLE public.verification_schedule
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.verification_schedule
  ADD CONSTRAINT verification_schedule_belongs_to_its_run
  FOREIGN KEY (run_id, user_id)
  REFERENCES public.verification_runs (id, user_id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.verification_schedule
  VALIDATE CONSTRAINT verification_schedule_belongs_to_its_run;

-- Now strictly weaker than the composite key above and enforcing nothing it
-- does not. Two constraints that can be read as disagreeing is worse than one.
ALTER TABLE public.verification_schedule
  DROP CONSTRAINT IF EXISTS verification_schedule_run_id_fkey;

-- ── 3. the schedule exposes (id, user_id), and the attempt is pinned to it ──

ALTER TABLE public.verification_schedule
  ADD CONSTRAINT verification_schedule_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE public.verification_attempts
  ADD CONSTRAINT verification_attempts_belongs_to_its_run
  FOREIGN KEY (schedule_id, user_id)
  REFERENCES public.verification_schedule (id, user_id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.verification_attempts
  VALIDATE CONSTRAINT verification_attempts_belongs_to_its_run;

ALTER TABLE public.verification_attempts
  DROP CONSTRAINT IF EXISTS verification_attempts_schedule_id_fkey;

COMMENT ON COLUMN public.verification_schedule.user_id IS
  'The run''s resident, denormalised so an attempt can be pinned to both its '
  'window and its person in one foreign key. Cannot drift from '
  'verification_runs.user_id: verification_schedule_belongs_to_its_run.';

COMMENT ON CONSTRAINT verification_attempts_belongs_to_its_run
  ON public.verification_attempts IS
  'A check-in is attributed to the resident whose run scheduled it. This is '
  'residency evidence, and residency is the ballot gate.';
