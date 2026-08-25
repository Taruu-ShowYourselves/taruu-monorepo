-- =============================================================================
-- `verification_runs.municipality_id` becomes a real reference.
--
-- WHAT WAS WRONG
--
-- The column is `municipality_id TEXT NOT NULL` with no foreign key. It has
-- always been a municipality code by convention only, so nothing stopped a
-- typo, a renamed code, or a deleted municipality from leaving a run pointing
-- at a place that does not exist.
--
-- It is not the house style -- it is the single exception to it. Every other
-- municipality code in this schema is anchored to `municipalities` by a
-- declared foreign key. Seventeen point at it directly:
--
--   users.users_municipality_fk           votes.votes_municipality_fk
--   treasury.treasury_municipality_fk     spaces (ON DELETE RESTRICT)
--   role_grants, community_manager_applications, pilot_municipalities,
--   pilot_registrations (x3), pilot_audit_log, council_aliases,
--   council_role_assignments, council_adjacencies (x2),
--   council_office_holders, municipalities.parent_council_id
--
-- and three more reach it in one hop -- `pilot_campaigns`, `pilot_links` and
-- `pilot_votes` reference `pilot_municipalities`, which is itself keyed to
-- `municipalities(code)`. Their codes are guaranteed real too. Only
-- `verification_runs` is anchored to nothing.
--
-- `verification_runs` was written in the 2024 initial schema, before
-- `municipalities` was canonicalised as a table, and was never brought into
-- line.
--
-- WHY THIS CANNOT BREAK THE WRITER
--
-- There is exactly one writer, `createVerificationRun`, reached from
-- POST /api/verification/start, and it passes `user.municipality_id` straight
-- through. That column already carries `users_municipality_fk` against the same
-- `municipalities(code)`, so any value that reaches this insert has already
-- satisfied the constraint being added. A user whose municipality is NULL
-- cannot get here either -- this column is NOT NULL and would already reject
-- the row today.
--
-- PRODUCTION EVIDENCE (read-only, 2026-08-25)
--
--   verification_runs                                     0 rows
--   runs whose municipality_id is not a municipalities.code 0
--   runs with a NULL municipality_id                       0
--   municipalities                                       260 rows
--   users with a municipality_id that is not a code         0  (2 are NULL)
--
-- ADD ... NOT VALID then VALIDATE, EVEN THOUGH THE TABLE IS EMPTY
--
-- Splitting the statement is not ceremony borrowed for its own sake. `ADD
-- CONSTRAINT` on its own takes ACCESS EXCLUSIVE while it scans every row;
-- `NOT VALID` takes that lock only briefly and skips the scan, and `VALIDATE
-- CONSTRAINT` then does the scan under SHARE UPDATE EXCLUSIVE, which does not
-- block reads or writes. Here the table is empty so either form is
-- instantaneous -- but this migration is also the shape the next one copies,
-- and against a populated table the difference is an outage. The two steps are
-- kept in one migration because there is no data to reconcile between them; a
-- table with real rows would separate them so the validation could be run
-- deliberately.
--
-- ON DELETE RESTRICT, matching the newest convention in the schema (spaces,
-- pilot_municipalities, pilot_registrations, pilot_audit_log): a municipality
-- with verification history is not something to delete by accident. The 2024
-- tables use a bare FK, which is NO ACTION -- the same refusal, less clearly
-- stated.
--
-- ROLLBACK
--   ALTER TABLE public.verification_runs
--     DROP CONSTRAINT verification_runs_municipality_fk;
-- =============================================================================

-- ── 0. preflight: name the offending rows rather than failing on a scan ─────
-- VALIDATE below would reject them anyway, but with a message naming the
-- constraint rather than the data. A municipality code cannot be repaired by
-- guessing -- a run points at a real place or it is a defect -- so this
-- refuses rather than cleans.

DO $preflight$
DECLARE
  v_orphans BIGINT;
  v_sample  TEXT;
BEGIN
  SELECT count(*), string_agg(DISTINCT r.municipality_id, ', ')
    INTO v_orphans, v_sample
    FROM public.verification_runs r
   WHERE NOT EXISTS (
     SELECT 1 FROM public.municipalities m WHERE m.code = r.municipality_id
   );

  IF v_orphans > 0 THEN
    RAISE EXCEPTION
      'verification_runs holds % row(s) whose municipality_id is not a '
      'municipalities.code: %. Resolve them before applying this migration -- '
      'a run belongs to a real place, and which place is not something a '
      'migration can infer.', v_orphans, v_sample
      USING HINT = 'select id, user_id, municipality_id, status from'
                   ' public.verification_runs r where not exists (select 1 from'
                   ' public.municipalities m where m.code = r.municipality_id);';
  END IF;
END;
$preflight$;

-- ── 1. declare the reference, without scanning ──────────────────────────────

ALTER TABLE public.verification_runs
  DROP CONSTRAINT IF EXISTS verification_runs_municipality_fk;

ALTER TABLE public.verification_runs
  ADD CONSTRAINT verification_runs_municipality_fk
  FOREIGN KEY (municipality_id) REFERENCES public.municipalities(code)
  ON DELETE RESTRICT
  NOT VALID;

-- ── 2. prove it against the existing rows ───────────────────────────────────
-- Until this runs the constraint applies only to new and updated rows, and
-- `convalidated` stays false. The regression test asserts it is true, because a
-- NOT VALID constraint left unvalidated looks identical to a validated one in
-- every place except that column.

ALTER TABLE public.verification_runs
  VALIDATE CONSTRAINT verification_runs_municipality_fk;

-- ── 3. index the referencing column ─────────────────────────────────────────
-- A foreign key indexes the PARENT side automatically (it is a primary key
-- here) but never the child. Without this, every attempt to delete or re-code a
-- municipality has to sequentially scan verification_runs to prove the RESTRICT
-- holds, and it is also the index any "runs in this municipality" query wants.

-- Dropped by name first rather than `IF NOT EXISTS`, which matches on name
-- alone: an index of this name that was left invalid by a failed CREATE INDEX
-- CONCURRENTLY, or built on other columns, would be kept with only a notice
-- while the constraint above already depended on it.
--
-- Not CONCURRENTLY: a migration runs inside a transaction and CREATE INDEX
-- CONCURRENTLY cannot. The plain form holds SHARE, which blocks writers for as
-- long as the build takes -- here that is a table with zero rows, so it is
-- instantaneous. A populated table would need this index built outside the
-- migration, before the constraint that wants it.
DROP INDEX IF EXISTS public.idx_verification_runs_municipality;
CREATE INDEX idx_verification_runs_municipality
  ON public.verification_runs (municipality_id);

COMMENT ON CONSTRAINT verification_runs_municipality_fk ON public.verification_runs IS
  'A verification run belongs to a real municipality. This was the only '
  'municipality reference in the schema without a foreign key; the column '
  'predates municipalities being a table. RESTRICT: a municipality with '
  'verification history is not deleted casually.';
