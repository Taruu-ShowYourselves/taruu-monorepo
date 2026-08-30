-- =============================================================================
-- 20260904000008 — a check-in is attributed to the resident whose run it is
--                  (EXPAND phase; the contract is closed by 20260904000010)
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
-- WHY THIS IS SPLIT INTO EXPAND AND CONTRACT
--
--   This migration used to end with `ALTER COLUMN user_id SET NOT NULL`, and
--   that made it impossible to order against the deploy. `apps/web` and this
--   schema ship separately: merging the pull request deploys the application
--   automatically (deploy.yml matches `apps/web/**`), while migrations are
--   applied by a manual workflow_dispatch. So one of the two is always live
--   before the other, and the one-shot form broke in BOTH directions:
--
--     migration first — the deployed writer omits `user_id`, and a NOT NULL
--       column with no default refuses every INSERT into
--       verification_schedule. POST /api/verification/start fails outright.
--
--     deploy first — the new writer sends `user_id` for a column that does not
--       exist yet, and PostgREST rejects the row.
--
--   There is a third failure that is easier to miss. The composite key in
--   section 3 points verification_attempts (schedule_id, user_id) at
--   verification_schedule (id, user_id). A schedule row written by the OLD
--   writer would carry a NULL user_id, so no parent tuple matches, and the
--   check-in insert fails too - the attempts path breaks even though nothing
--   about attempts changed.
--
--   The compatibility trigger in section 2 removes all three. While both
--   writers are live, a schedule row that arrives without a user_id has one
--   derived from its run, so:
--
--     * the old writer keeps working, and writes CORRECT rows rather than
--       NULL ones,
--     * the new writer's explicit user_id is passed through untouched,
--     * no NULL accumulates, so 20260904000010's preflight is not a cleanup
--       task but an assertion that there was never anything to clean.
--
--   Everything here is therefore satisfiable by both writers at once. Nothing
--   in this file can fail against the currently deployed application.
--
-- PRODUCTION SHAPE (read-only, 2026-08-30)
--
--   verification_runs 0 rows, verification_schedule 0 rows,
--   verification_attempts 0 rows. The column add, the backfill and both
--   validations touch nothing. The preflight below still refuses rather than
--   cleans.
--
-- ROLLBACK
--   Nothing here supersedes an existing constraint, so the rollback drops only
--   what this file added and restores no key:
--
--   DROP TRIGGER verification_schedule_derive_user_id
--     ON public.verification_schedule;
--   DROP FUNCTION public.verification_schedule_derive_user_id();
--   ALTER TABLE public.verification_attempts
--     DROP CONSTRAINT verification_attempts_belongs_to_its_run;
--   ALTER TABLE public.verification_schedule
--     DROP CONSTRAINT verification_schedule_belongs_to_its_run,
--     DROP CONSTRAINT verification_schedule_id_user_id_key,
--     DROP COLUMN user_id;
--   ALTER TABLE public.verification_runs
--     DROP CONSTRAINT verification_runs_id_user_id_key;
--
--   The single-column keys verification_schedule_run_id_fkey and
--   verification_attempts_schedule_id_fkey are NOT dropped by this file - they
--   are dropped by 20260904000010 - so a rollback of this file alone leaves the
--   original referential integrity fully intact.
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

-- The column stays nullable until 20260904000010. NOT NULL here is what made
-- this migration unorderable against the deploy; see the header.
--
-- Instead, the value is derived for any writer that does not supply it. This
-- is what keeps the currently deployed application working unchanged, and it
-- is why no NULL can accumulate during the window.
--
-- INVOKER, not SECURITY DEFINER, on purpose: the only writers are server-side
-- and reach this table as service_role, which bypasses RLS, so the lookup
-- needs no privilege the caller does not already have. A definer function here
-- would be a new definer to audit for the sake of a privilege nobody needs.
CREATE OR REPLACE FUNCTION public.verification_schedule_derive_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $derive$
BEGIN
  -- Only ever fills a hole. A user_id the caller supplied is passed through
  -- untouched, so the composite foreign key below - not this trigger - remains
  -- the thing that decides whether the pair is allowed.
  IF NEW.user_id IS NULL THEN
    SELECT r.user_id
      INTO NEW.user_id
      FROM public.verification_runs r
     WHERE r.id = NEW.run_id;
  END IF;

  RETURN NEW;
END;
$derive$;

CREATE TRIGGER verification_schedule_derive_user_id
  BEFORE INSERT OR UPDATE OF run_id, user_id
  ON public.verification_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.verification_schedule_derive_user_id();

COMMENT ON FUNCTION public.verification_schedule_derive_user_id() IS
  'Fills verification_schedule.user_id from its run when a writer omits it. '
  'Added by 20260904000008 so the pre-deploy application keeps working during '
  'the expand window, and deliberately kept afterwards: it derives the value '
  'from the authoritative row rather than guessing, and removing it would '
  'reintroduce the failure for any future writer that forgets the column.';

ALTER TABLE public.verification_schedule
  ADD CONSTRAINT verification_schedule_belongs_to_its_run
  FOREIGN KEY (run_id, user_id)
  REFERENCES public.verification_runs (id, user_id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.verification_schedule
  VALIDATE CONSTRAINT verification_schedule_belongs_to_its_run;

-- verification_schedule_run_id_fkey is NOT dropped here. It is strictly weaker
-- than the composite key above, but dropping a key belongs to the contract
-- phase: while both writers are live this file must only add. 20260904000010
-- drops it.

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

-- Likewise kept until 20260904000010.

COMMENT ON COLUMN public.verification_schedule.user_id IS
  'The run''s resident, denormalised so an attempt can be pinned to both its '
  'window and its person in one foreign key. Cannot drift from '
  'verification_runs.user_id: verification_schedule_belongs_to_its_run. '
  'Nullable until 20260904000010 closes the expand/contract window.';

COMMENT ON CONSTRAINT verification_attempts_belongs_to_its_run
  ON public.verification_attempts IS
  'A check-in is attributed to the resident whose run scheduled it. This is '
  'residency evidence, and residency is the ballot gate.';
