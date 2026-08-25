-- =============================================================================
-- No table in `public` carries two indexes that do the same job.
--
-- WHY THIS IS A TEST AND NOT A MIGRATION
--
-- Stage 4 set out to remove duplicate indexes. Run against production
-- read-only on 2026-08-25, the detector below returned thirteen -- and they are
-- the same thirteen that `20260903000001_drop_duplicate_indexes.sql` (PR #142,
-- open and unmerged) already drops, name for name. There is nothing left to
-- drop, so writing a second migration would either collide with that one or
-- duplicate it.
--
-- What is missing is the thing that stops the class coming back. Every one of
-- the thirteen was created the same way: someone wrote
-- `CREATE INDEX idx_<table>_<column>` next to a column that already carried a
-- UNIQUE constraint, and PostgreSQL builds an index for a UNIQUE constraint
-- automatically. The duplicate is invisible in the migration that creates it,
-- because the constraint is usually in a different file. That is a pattern, and
-- a pattern needs a guard rather than one more cleanup.
--
-- The assertion is a SUBSET check against a named allowlist, not an
-- is-empty check, so that it is correct in all three states this repository
-- passes through:
--
--   * today, on this branch:   the thirteen are present  -> passes
--   * after PR #142 merges:    the set is empty          -> passes
--   * a fourteenth appears:    not on the allowlist      -> FAILS
--   * one of the thirteen is put back after that migration dropped it -> FAILS,
--     on its oid: an index recreated later necessarily sorts after one built by
--     a migration that runs after the cleanup. `scripts/db-test.sh` applies
--     migration files directly and keeps no ledger, so ordinality in the
--     catalog is the only signal available for "has the cleanup already run".
--   * the whole allowlist is present but only some of it -> FAILS. The thirteen
--     are dropped by one migration, so they are all there or none are.
--
-- An allowlist that is never checked is a comment. Section 1 therefore builds a
-- fixture table with a dozen deliberate near-misses and asserts exactly which
-- of them the detector reports, so a detector that silently stopped matching
-- anything cannot pass by returning nothing.
--
-- WHAT COUNTS AS A DUPLICATE HERE
--
-- Exact duplicates only: same table, same key columns in the same order, same
-- INCLUDE payload, same operator classes, same collations, same sort options,
-- same access method, same storage parameters, same tablespace, same predicate,
-- same expressions
-- -- and, between two unique indexes, the same uniqueness rule and the same
-- checking time.
--
-- The bias throughout is toward saying nothing. A duplicate this misses costs
-- some write throughput; a non-duplicate it names costs whatever the index was
-- enforcing, because someone will act on the report. So:
--
--   * A narrower index a wider one could serve -- (a) beside (a, b) -- is NOT
--     flagged. Whether the narrow one earns its keep depends on write rates and
--     on which queries exist; a guard that makes judgement calls gets switched
--     off.
--   * A descending index is NOT flagged against its ascending twin, even though
--     a B-tree scans backward and one usually does cover the other. "Usually"
--     is the problem: the equivalence holds for a globally reversed
--     single-column index and breaks as soon as a multi-column index reverses
--     only some of its columns, or NULLS ordering diverges. `indoption` is
--     compared exactly instead.
--   * Exclusion constraints are left out on both sides. What they enforce lives
--     in their operator list, which no column of `pg_index` records.
--
-- Two indexes that are structurally identical are still not always
-- interchangeable. The detector never nominates for removal:
--
--   * a UNIQUE index whose twin is not unique -- the unique one is the only
--     thing enforcing the invariant, and ordering by oid alone would nominate
--     it whenever it happened to be created second;
--   * an index serving as the table's REPLICA IDENTITY, one the table is
--     CLUSTERed on, or one a FOREIGN KEY points at. Those are operational
--     attachments that survive nothing but an explicit decision -- and in the
--     foreign-key case, `DROP INDEX` simply fails;
--   * a constraint's index in favour of a constraint of a DIFFERENT kind. A
--     PRIMARY KEY and a UNIQUE over the same columns do enforce the same
--     uniqueness, but one is the row's identity and other tables point at it.
--
-- A constraint-backed index is not reported as removable against a plain one
-- either, because dropping it means dropping the constraint. But a PAIR of
-- identical same-kind constraints IS reported, separately and under its own
-- name: that is the same waste arriving through a different door, and
-- excluding it outright would let a second redundant UNIQUE constraint rebuild
-- the class this guard exists to prevent.
--
-- HOW THIS RUNS
--
-- `scripts/db-test.sh` globs `supabase/tests/*.sql` and pipes each file through
-- psql with ON_ERROR_STOP, so a RAISE EXCEPTION fails the file and the script.
-- The `database` job in .github/workflows/agent-verification.yml runs that
-- script against a postgres:16 service on every pull request. No wiring is
-- needed for a new file, which is why this change adds none.
-- =============================================================================

BEGIN;

-- ── The detector, as a view so every section uses one definition ────────────
-- A temp view: it disappears with the transaction and cannot leak into the
-- database this test runs against.

CREATE TEMP VIEW duplicate_indexes AS
WITH idx AS (
  SELECT i.indrelid::regclass::TEXT                                   AS tbl,
         c.relname                                                    AS idx_name,
         c.oid                                                        AS idx_oid,
         i.indkey::TEXT                                               AS cols,
         -- Key columns only are what a UNIQUE index constrains; INCLUDE
         -- payload columns also appear in indkey. Without indnkeyatts,
         -- `UNIQUE (a) INCLUDE (b)` and a plain index on `(a, b)` share a
         -- signature and would be called duplicates of each other.
         i.indnkeyatts                                                AS key_atts,
         coalesce(pg_get_expr(i.indpred, i.indrelid), '')             AS pred,
         coalesce(pg_get_expr(i.indexprs, i.indrelid), '')            AS exprs,
         i.indclass::TEXT                                             AS opclass,
         i.indoption::TEXT                                            AS opts,
         -- Two text indexes on one column under different collations sort
         -- differently and serve different queries; neither is redundant.
         i.indcollation::TEXT                                         AS colls,
         c.relam                                                      AS am,
         -- Storage parameters are part of what an index IS. Two BRIN indexes
         -- differing only in `pages_per_range`, or two GiST indexes with
         -- different operator-class parameters, match on every pg_index column
         -- above while differing in size and scan behaviour by an order of
         -- magnitude. Nominating a deliberately tuned index as a duplicate of
         -- an untuned one is precisely the kind of confident wrong answer this
         -- file is built to avoid.
         coalesce(c.reloptions::TEXT, '')                              AS relopts,
         -- Placement counts as identity too: a tablespace can carry its own
         -- planner cost settings, and an index put somewhere on purpose was put
         -- there for a reason this file cannot see.
         c.reltablespace                                               AS tblspc,
         -- Rendered to text per column and joined, rather than aggregated as
         -- arrays: attoptions is NULL for almost every column and empty for
         -- most of the rest, and array_agg refuses to accumulate either.
         -- attstattarget rides along: `ALTER INDEX … SET STATISTICS` is stored
         -- there rather than in attoptions, and two expression indexes that
         -- differ only in it give the planner materially different estimates.
         coalesce((SELECT string_agg(coalesce(at.attoptions::TEXT, '') || '/' ||
                                     coalesce(at.attstattarget::TEXT, ''), ','
                                     ORDER BY at.attnum)
                     FROM pg_attribute at
                    WHERE at.attrelid = c.oid AND at.attnum > 0), '')  AS attopts,
         i.indisunique                                                AS is_unique,
         -- NULLS NOT DISTINCT is a different uniqueness rule, not a stricter
         -- spelling of the same one: it forbids the second NULL the default
         -- permits.
         i.indnullsnotdistinct                                        AS nulls_nd,
         -- Whether uniqueness is checked at statement end or at commit, and --
         -- for a deferrable one -- which of those it does by default.
         i.indimmediate                                               AS immediate,
         -- REPLICA IDENTITY and CLUSTER are operational attachments: an index
         -- carrying one survives nothing but an explicit decision. Collapsed
         -- into one flag because the tie-break treats them identically -- an
         -- attached index is always the keeper, never the nominee.
         -- A foreign key's `conindid` names the exact unique index it depends
         -- on: DROP INDEX against it fails outright. Such an index is a keeper
         -- for the same reason a clustered one is, so it joins the same flag
         -- rather than getting a separate rule.
         (i.indisreplident
          OR i.indisclustered
          OR EXISTS (SELECT 1 FROM pg_constraint f
                      WHERE f.contype = 'f' AND f.conindid = c.oid))  AS attached,
         -- The constraint that OWNS this index, if any -- not merely one that
         -- mentions it. `conindid` is also set on every FOREIGN KEY, pointing
         -- at the index on the PARENT it references, so an unqualified EXISTS
         -- marks a plain unique index as constraint-backed the moment anything
         -- references it. Restricting to constraints on this same relation, and
         -- to the types that actually own an index, is what makes the flag mean
         -- what the rest of this file assumes it means.
         k.contype                                                    AS con_type,
         k.condeferred                                                AS con_deferred,
         -- Whether the check CAN be postponed with SET CONSTRAINTS at all, as
         -- distinct from whether it is postponed by default. DEFERRABLE
         -- INITIALLY IMMEDIATE and NOT DEFERRABLE look identical in both
         -- indimmediate and condeferred, and are not interchangeable: only one
         -- of them can have its check moved to end-of-transaction.
         k.condeferrable                                              AS con_deferrable
    FROM pg_index i
    JOIN pg_class c     ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN LATERAL (
      SELECT k2.contype, k2.condeferred, k2.condeferrable
        FROM pg_constraint k2
       WHERE k2.conindid = c.oid
         AND k2.conrelid = i.indrelid
         AND k2.contype IN ('p', 'u', 'x')
       LIMIT 1
    ) k ON TRUE
   WHERE n.nspname = 'public'
     AND i.indisvalid
     AND i.indislive
     AND coalesce(k.contype, '-') <> 'x'   -- exclusion constraints: see header
)
SELECT a.tbl,
       a.idx_name AS redundant,
       b.idx_name AS covered_by,
       CASE WHEN a.con_type IS NOT NULL THEN 'constraint' ELSE 'index' END AS kind
  FROM idx a
  JOIN idx b
    ON a.tbl      = b.tbl
   AND a.cols     = b.cols
   AND a.key_atts = b.key_atts
   AND a.pred     = b.pred
   AND a.exprs    = b.exprs
   AND a.opclass  = b.opclass
   AND a.opts     = b.opts
   AND a.colls    = b.colls
   AND a.am       = b.am
   AND a.relopts  = b.relopts
   AND a.attopts  = b.attopts
   AND a.tblspc   = b.tblspc
   AND a.idx_oid <> b.idx_oid
 WHERE NOT a.attached
   -- Never nominate a unique index in favour of a non-unique one.
   AND (NOT a.is_unique OR b.is_unique)
   -- How uniqueness is spelled matters only when BOTH sides are enforcing it.
   -- A plain index IS fully covered by an otherwise identical
   -- `UNIQUE ... NULLS NOT DISTINCT` or DEFERRABLE index -- the unique one
   -- answers every query the plain one does -- so requiring these to match
   -- unconditionally would hide exactly the redundant plain indexes this file
   -- is about.
   AND (NOT (a.is_unique AND b.is_unique)
        OR (a.nulls_nd = b.nulls_nd
            AND a.immediate = b.immediate
            -- coalesce, not IS NOT DISTINCT FROM: a plain unique index has no
            -- owning constraint and so a NULL here, while an identical
            -- NOT DEFERRABLE UNIQUE constraint has false. They check at the
            -- same moment; treating NULL as its own value would let a plain
            -- unique index beside a UNIQUE constraint evade the detector, and
            -- that pair is one of the commonest duplicates there is.
            AND coalesce(a.con_deferred, false) = coalesce(b.con_deferred, false)
            AND coalesce(a.con_deferrable, false)
              = coalesce(b.con_deferrable, false)))
   AND (
         (a.con_type IS NULL AND b.con_type IS NOT NULL)
      OR (a.con_type IS NULL AND b.is_unique AND NOT a.is_unique)
         -- Two constraints count as the same job only if they are the same
         -- KIND of constraint; otherwise neither is reported. Same standing on
         -- both sides tie-breaks on oid, so exactly one row comes back for the
         -- pair rather than one per join direction.
      OR (a.con_type IS NOT DISTINCT FROM b.con_type
          AND a.is_unique = b.is_unique
          -- An attached twin is always the keeper. Tie-breaking on oid alone
          -- would filter out the one direction that could be reported whenever
          -- the NEWER of a pair is the attached one: that direction is barred
          -- by `NOT a.attached`, and the other fails the oid test, so a real
          -- duplicate would vanish entirely.
          AND (b.attached OR (NOT b.attached AND a.idx_oid > b.idx_oid)))
       );

-- ── 1. The detector detects, and does not over-detect ───────────────────────
-- Without this, a detector broken into always returning zero rows would sail
-- through section 2 and the guard would be decorative.
--
-- Everything is built on a fixture table created inside the transaction rather
-- than on a real one. Earlier drafts probed `municipalities`, which made the
-- assertions depend on facts living outside this file -- and one of those facts
-- (that `council_id` is nullable) turned out to be false, quietly reducing the
-- NULLS NOT DISTINCT probe to a tautology. A table defined here cannot drift.

CREATE TABLE public.dupe_probe (
  id   INTEGER PRIMARY KEY,     -- -> dupe_probe_pkey
  code TEXT NOT NULL,
  tag  TEXT,                    -- nullable on purpose: NULLS [NOT] DISTINCT
  alt  TEXT,                    -- likewise, covered ONLY by a non-default rule
  body TEXT
);

-- 1a. A plain index duplicating the primary key's index IS reported.
CREATE INDEX idx_probe_id ON public.dupe_probe (id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM duplicate_indexes
     WHERE redundant = 'idx_probe_id' AND covered_by = 'dupe_probe_pkey'
  ) THEN
    RAISE EXCEPTION
      'the detector did not notice an index deliberately built to duplicate a '
      'primary key. Every result it reports below is worthless.';
  END IF;
END;
$$;

DROP INDEX public.idx_probe_id;

-- 1b. Near misses. Each is structurally close to `idx_probe_code` and must NOT
-- be reported, because each answers a question the others cannot.

CREATE INDEX idx_probe_code    ON public.dupe_probe (code);
CREATE INDEX idx_probe_partial ON public.dupe_probe (code) WHERE body IS NOT NULL;
CREATE INDEX idx_probe_desc    ON public.dupe_probe (code DESC);
CREATE INDEX idx_probe_opclass ON public.dupe_probe (code text_pattern_ops);
CREATE INDEX idx_probe_am      ON public.dupe_probe USING hash (code);
CREATE INDEX idx_probe_expr    ON public.dupe_probe (lower(code));
CREATE INDEX idx_probe_wider   ON public.dupe_probe (code, body);
-- Same access method, same column, different storage parameter. A BRIN index
-- summarising 32 pages per range is not the index that summarises 128.
CREATE INDEX idx_probe_brin_a  ON public.dupe_probe USING brin (code)
  WITH (pages_per_range = 32);
CREATE INDEX idx_probe_brin_b  ON public.dupe_probe USING brin (code)
  WITH (pages_per_range = 128);

DO $$
DECLARE
  v_collation      TEXT;
  v_false_positive TEXT;
BEGIN
  -- The collation probe cannot hard-code "C": if the database's default
  -- collation already IS C, `code COLLATE "C"` produces the same collation oid
  -- as the plain index, the detector correctly calls it a duplicate, and this
  -- negative fixture fails for a reason that has nothing to do with the
  -- detector. Pick a collation at runtime that differs from the column's own,
  -- and skip the probe if the database offers none.
  SELECT quote_ident(n.nspname) || '.' || quote_ident(co.collname)
    INTO v_collation
    FROM pg_collation co
    JOIN pg_namespace n ON n.oid = co.collnamespace
   WHERE co.oid <> (SELECT i.indcollation[0]
                      FROM pg_index i
                     WHERE i.indexrelid = 'public.idx_probe_code'::regclass)
     AND co.collencoding IN (-1, (SELECT encoding FROM pg_database
                                   WHERE datname = current_database()))
   ORDER BY (co.collname = 'C') DESC, co.oid
   LIMIT 1;

  IF v_collation IS NULL THEN
    RAISE NOTICE
      'no collation differs from the one on dupe_probe.code; the collation '
      'near-miss probe is skipped';
  ELSE
    EXECUTE format('CREATE INDEX idx_probe_collated ON public.dupe_probe '
                   '(code COLLATE %s)', v_collation);
  END IF;

  SELECT string_agg(format('%s ~ %s', redundant, covered_by), ', '
                    ORDER BY redundant)
    INTO v_false_positive
    FROM duplicate_indexes
   WHERE tbl = 'dupe_probe';

  IF v_false_positive IS NOT NULL THEN
    RAISE EXCEPTION
      'the detector called these duplicates: %. A partial index, a descending '
      'one, one under a different operator class, one under a different access '
      'method, one over an expression, a wider one, a differently-collated one '
      'and two BRIN indexes with different pages_per_range each differ from '
      'the others in something that changes what they can answer or what they '
      'cost.', v_false_positive;
  END IF;
END;
$$;

DROP INDEX public.idx_probe_partial;
DROP INDEX public.idx_probe_desc;
DROP INDEX public.idx_probe_opclass;
DROP INDEX public.idx_probe_am;
DROP INDEX public.idx_probe_expr;
DROP INDEX public.idx_probe_wider;
DROP INDEX public.idx_probe_brin_a;
DROP INDEX public.idx_probe_brin_b;
DROP INDEX IF EXISTS public.idx_probe_collated;

-- 1c. A UNIQUE index must never be nominated in favour of a plain one that
-- happens to share its shape. This is the branch whose regression would be
-- actively destructive: acting on the report would drop the only thing
-- enforcing the invariant.

CREATE UNIQUE INDEX uq_probe_code ON public.dupe_probe (code);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM duplicate_indexes
     WHERE redundant = 'uq_probe_code' AND covered_by = 'idx_probe_code'
  ) THEN
    RAISE EXCEPTION
      'the detector nominated a UNIQUE index for removal in favour of a plain '
      'one. Structurally identical is not semantically identical.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM duplicate_indexes
     WHERE redundant = 'idx_probe_code' AND covered_by = 'uq_probe_code'
  ) THEN
    RAISE EXCEPTION
      'the detector did not report the plain index that a UNIQUE index on the '
      'same column already covers -- it is the redundant half of that pair.';
  END IF;
END;
$$;

DROP INDEX public.idx_probe_code;
DROP INDEX public.uq_probe_code;

-- 1d. Uniqueness that is spelled differently is not the same uniqueness --
-- but only between two unique indexes. `tag` is nullable, which is what makes
-- NULLS NOT DISTINCT mean anything at all here.

CREATE UNIQUE INDEX uq_probe_tag     ON public.dupe_probe (tag);
CREATE UNIQUE INDEX uq_probe_tag_nnd ON public.dupe_probe (tag) NULLS NOT DISTINCT;
ALTER TABLE public.dupe_probe
  ADD CONSTRAINT dupe_probe_tag_deferred UNIQUE (tag) DEFERRABLE INITIALLY DEFERRED;
-- DEFERRABLE INITIALLY IMMEDIATE is the one that looks identical to a plain
-- NOT DEFERRABLE constraint in both `indimmediate` and `condeferred`: it checks
-- at statement end by default, and the difference is only that a transaction
-- CAN move the check with SET CONSTRAINTS. Dropping the wrong one of these two
-- changes when a violation surfaces, silently.
ALTER TABLE public.dupe_probe
  ADD CONSTRAINT dupe_probe_tag_deferrable UNIQUE (tag) DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX idx_probe_tag ON public.dupe_probe (tag);

DO $$
DECLARE
  v_wrong TEXT;
BEGIN
  -- Different uniqueness rule, or different checking time: not interchangeable.
  SELECT string_agg(format('%s ~ %s', redundant, covered_by), ', '
                    ORDER BY redundant)
    INTO v_wrong
    FROM duplicate_indexes
   WHERE (redundant  IN ('uq_probe_tag_nnd', 'dupe_probe_tag_deferred',
                         'dupe_probe_tag_deferrable')
      AND covered_by = 'uq_probe_tag')
      OR (redundant  = 'uq_probe_tag'
      AND covered_by IN ('uq_probe_tag_nnd', 'dupe_probe_tag_deferred',
                         'dupe_probe_tag_deferrable'));

  IF v_wrong IS NOT NULL THEN
    RAISE EXCEPTION
      'the detector matched unique indexes enforcing different rules: %. '
      'NULLS NOT DISTINCT, DEFERRABLE INITIALLY DEFERRED and DEFERRABLE '
      'INITIALLY IMMEDIATE are each a different guarantee, not a different '
      'spelling of the default.', v_wrong;
  END IF;

  -- The two deferrable constraints are not each other's duplicate either:
  -- INITIALLY DEFERRED and INITIALLY IMMEDIATE differ in when the check runs
  -- unless a transaction says otherwise.
  SELECT string_agg(format('%s ~ %s', redundant, covered_by), ', ')
    INTO v_wrong
    FROM duplicate_indexes
   WHERE redundant  IN ('dupe_probe_tag_deferred', 'dupe_probe_tag_deferrable')
     AND covered_by IN ('dupe_probe_tag_deferred', 'dupe_probe_tag_deferrable');

  IF v_wrong IS NOT NULL THEN
    RAISE EXCEPTION
      'the detector matched DEFERRABLE INITIALLY DEFERRED against DEFERRABLE '
      'INITIALLY IMMEDIATE: %', v_wrong;
  END IF;

  -- …but a PLAIN index is covered by any of them.
  IF NOT EXISTS (
    SELECT 1 FROM duplicate_indexes WHERE redundant = 'idx_probe_tag'
  ) THEN
    RAISE EXCEPTION
      'the detector did not report a plain index on `tag` even though four '
      'unique indexes on `tag` each already cover it.';
  END IF;
END;
$$;

-- 1e. The case an earlier draft got wrong, isolated so it cannot pass by
-- accident. `alt` carries exactly one unique index and it is spelled
-- NULLS NOT DISTINCT; a plain index beside it is fully covered, because the
-- unique one answers every query the plain one does. A detector that compares
-- the uniqueness spelling even when one side is not unique at all reports
-- nothing here -- and in 1d it still passed, because `tag` also had a
-- default-spelled unique index to be matched against.

CREATE UNIQUE INDEX uq_probe_alt_nnd ON public.dupe_probe (alt) NULLS NOT DISTINCT;
CREATE INDEX idx_probe_alt ON public.dupe_probe (alt);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM duplicate_indexes
     WHERE redundant = 'idx_probe_alt' AND covered_by = 'uq_probe_alt_nnd'
  ) THEN
    RAISE EXCEPTION
      'the detector did not report a plain index whose only cover is a UNIQUE '
      'index spelled NULLS NOT DISTINCT. How uniqueness is spelled matters '
      'between two unique indexes; it says nothing about whether a plain index '
      'beside one is redundant.';
  END IF;
END;
$$;

-- 1f. The third branch of the tie-break: two indexes of EQUAL standing. This
-- is the commonest real duplicate of all -- the same plain index created twice
-- -- and until now no fixture reached it, because every pair above differs in
-- constraint ownership or uniqueness on one side and so routes through one of
-- the first two branches. A flipped comparison here would have gone unnoticed.

CREATE INDEX idx_probe_body_older ON public.dupe_probe (body);
CREATE INDEX idx_probe_body_newer ON public.dupe_probe (body);

DO $$
DECLARE
  v_rows TEXT;
BEGIN
  SELECT string_agg(format('%s ~ %s [%s]', redundant, covered_by, kind), ', '
                    ORDER BY redundant)
    INTO v_rows
    FROM duplicate_indexes
   WHERE redundant LIKE 'idx\_probe\_body\_%';

  -- Exactly one row, naming the newer one: two identical plain indexes are one
  -- duplicate, not two, and the pair must not be reported once per join
  -- direction.
  IF v_rows IS DISTINCT FROM 'idx_probe_body_newer ~ idx_probe_body_older [index]'
  THEN
    RAISE EXCEPTION
      'two identical plain indexes should be reported exactly once, naming the '
      'newer as redundant. Got: %', coalesce(v_rows, '(nothing)');
  END IF;
END;
$$;

-- …and the same pair once the NEWER one is operationally attached. The older
-- one is now the removable half, and reporting must follow the attachment
-- rather than the creation order. `ALTER TABLE ... CLUSTER ON` records the
-- choice in the catalog without rewriting the table.

ALTER TABLE public.dupe_probe CLUSTER ON idx_probe_body_newer;

DO $$
DECLARE
  v_rows TEXT;
BEGIN
  SELECT string_agg(format('%s ~ %s', redundant, covered_by), ', '
                    ORDER BY redundant)
    INTO v_rows
    FROM duplicate_indexes
   WHERE redundant LIKE 'idx\_probe\_body\_%';

  IF v_rows IS DISTINCT FROM 'idx_probe_body_older ~ idx_probe_body_newer' THEN
    RAISE EXCEPTION
      'when the newer of two identical indexes is the clustered one, the older '
      'is the removable half. Got: %', coalesce(v_rows, '(nothing)');
  END IF;
END;
$$;

ALTER TABLE public.dupe_probe SET WITHOUT CLUSTER;
DROP INDEX public.idx_probe_body_older;
DROP INDEX public.idx_probe_body_newer;

-- 1g. Two constraints of the same kind over the same columns. Section 3 reports
-- this class, and until now nothing proved it could: it asserted only that the
-- migrated schema contains none, which a detector that had stopped matching
-- would also satisfy.

ALTER TABLE public.dupe_probe ADD CONSTRAINT probe_uc_older UNIQUE (code);
ALTER TABLE public.dupe_probe ADD CONSTRAINT probe_uc_newer UNIQUE (code);

DO $$
DECLARE
  v_rows TEXT;
BEGIN
  SELECT string_agg(format('%s ~ %s [%s]', redundant, covered_by, kind), ', '
                    ORDER BY redundant)
    INTO v_rows
    FROM duplicate_indexes
   WHERE redundant LIKE 'probe\_uc\_%';

  IF v_rows IS DISTINCT FROM 'probe_uc_newer ~ probe_uc_older [constraint]' THEN
    RAISE EXCEPTION
      'two identical UNIQUE constraints should be reported exactly once, under '
      'kind=constraint, naming the newer as redundant. Got: %',
      coalesce(v_rows, '(nothing)');
  END IF;
END;
$$;

-- A plain UNIQUE INDEX beside an identical UNIQUE CONSTRAINT is redundant, and
-- the constraint is the keeper. This is the pair whose `condeferred` differs
-- only by being absent on one side.

CREATE UNIQUE INDEX uq_probe_code_plain ON public.dupe_probe (code);

DO $$
DECLARE
  v_covered TEXT;
BEGIN
  SELECT covered_by INTO v_covered
    FROM duplicate_indexes
   WHERE redundant = 'uq_probe_code_plain';

  IF v_covered IS NULL THEN
    RAISE EXCEPTION
      'the detector did not report a plain UNIQUE INDEX that an identical '
      'UNIQUE CONSTRAINT already covers. A plain index has no owning '
      'constraint and so no deferral flag at all; that absence is not a '
      'different checking time.';
  END IF;
END;
$$;

DROP INDEX public.uq_probe_code_plain;

-- A PRIMARY KEY and a UNIQUE constraint over the same column are NOT reported:
-- both enforce the same uniqueness, but one is the row's identity and other
-- tables point at it, so neither is the obvious one to drop.

ALTER TABLE public.dupe_probe DROP CONSTRAINT probe_uc_newer;
ALTER TABLE public.dupe_probe ADD CONSTRAINT probe_uc_on_pk UNIQUE (id);

DO $$
DECLARE
  v_rows TEXT;
BEGIN
  SELECT string_agg(format('%s ~ %s', redundant, covered_by), ', ')
    INTO v_rows
    FROM duplicate_indexes
   WHERE redundant  IN ('probe_uc_on_pk', 'dupe_probe_pkey')
      OR covered_by IN ('probe_uc_on_pk', 'dupe_probe_pkey');

  IF v_rows IS NOT NULL THEN
    RAISE EXCEPTION
      'the detector matched a PRIMARY KEY against a UNIQUE constraint: %. They '
      'enforce the same uniqueness but are not interchangeable.', v_rows;
  END IF;
END;
$$;

-- 1h. An index a FOREIGN KEY points at cannot be dropped -- the DROP fails --
-- so it must never be the nominee even when an identical constraint index
-- exists. `conindid` on the foreign key names it exactly.

CREATE UNIQUE INDEX uq_probe_fk_target ON public.dupe_probe (id);
CREATE TABLE public.dupe_probe_child (
  id     INTEGER PRIMARY KEY,
  parent INTEGER NOT NULL
    REFERENCES public.dupe_probe (id)   -- resolves to uq_probe_fk_target or
                                        -- dupe_probe_pkey; either way one of
                                        -- the pair becomes FK-referenced
);

DO $$
DECLARE
  v_target TEXT;
  v_bad    TEXT;
BEGIN
  SELECT c.relname INTO v_target
    FROM pg_constraint f
    JOIN pg_class c ON c.oid = f.conindid
   WHERE f.contype = 'f' AND f.conrelid = 'public.dupe_probe_child'::regclass;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'the probe foreign key did not resolve to an index';
  END IF;

  SELECT string_agg(format('%s ~ %s', redundant, covered_by), ', ')
    INTO v_bad
    FROM duplicate_indexes
   WHERE redundant = v_target;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'the detector nominated %, the index a foreign key points at: %. '
      'DROP INDEX against it fails.', v_target, v_bad;
  END IF;
END;
$$;

DROP TABLE public.dupe_probe_child;
DROP INDEX public.uq_probe_fk_target;

DROP TABLE public.dupe_probe;

-- ── 2. Every duplicate that exists is one PR #142 already removes ───────────
--
-- The allowlist is spelled out rather than counted. A count would pass if one
-- of the thirteen were replaced by a different duplicate, which is exactly the
-- regression this is meant to catch.
--
-- Each entry is a plain `CREATE INDEX` sitting on a column that already carries
-- a UNIQUE constraint, and so already has an index. The keeper in every case is
-- the constraint's own index, named in the second column of the detector.

DO $$
DECLARE
  -- Known duplicates, all dropped by 20260903000001_drop_duplicate_indexes.sql.
  -- Removing an entry makes the test stricter, never looser.
  --
  -- Each is the whole fact -- table, the redundant index, and the index that
  -- already does its job -- not just a name. An index name is reusable: allow
  -- 'idx_users_email' by name and a later `CREATE INDEX idx_users_email` on
  -- some other table, or covering something else, inherits the permission.
  v_allowed TEXT[] := ARRAY[
    'issue_coins|idx_issue_coins_mint|issue_coins_token_mint_key',
    'issue_coins|idx_issue_coins_vote|issue_coins_vote_id_key',
    'knesset_items|idx_knesset_items_vote|knesset_items_vote_id_key',
    'knesset_rankings|idx_knesset_rankings_vote|knesset_rankings_vote_id_key',
    'payments|idx_payments_idempotency|payments_idempotency_key_key',
    'phone_verifications|idx_phone_verifications_user|uq_phone_verifications_user',
    'treasury|idx_treasury_municipality|treasury_municipality_id_key',
    'users|idx_users_did|users_did_key',
    'users|idx_users_email|users_email_key',
    'users|idx_users_google_id|users_google_id_key',
    'vote_card_art|idx_vote_card_art_vote|vote_card_art_vote_id_key',
    'vote_sources|idx_vote_sources_vote|vote_sources_vote_id_key',
    'webhook_events|idx_webhook_events_event_id|webhook_events_event_id_key'
  ];
  v_unexpected TEXT;
  v_surviving  INTEGER;
  v_anchor     OID;
  v_recreated  TEXT;
BEGIN
  -- DISTINCT ON, because three structurally identical indexes on one table
  -- produce two rows for the last of them -- one per keeper. The gate below
  -- counts distinct names; the message should name each one once too.
  SELECT string_agg(format('%s.%s (already served by %s)',
                           tbl, redundant, covered_by), ', '
                    ORDER BY tbl, redundant)
    INTO v_unexpected
    FROM (SELECT DISTINCT ON (tbl, redundant) tbl, redundant, covered_by
            FROM duplicate_indexes
           WHERE kind = 'index'
             AND format('%s|%s|%s', tbl, redundant, covered_by) <> ALL (v_allowed)
           ORDER BY tbl, redundant, covered_by) d;

  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION
      'new duplicate index(es): %. PostgreSQL builds an index for every UNIQUE '
      'constraint, so a CREATE INDEX beside a UNIQUE column is dead weight on '
      'every write and in every autovacuum. Drop the plain index, or -- if it '
      'is genuinely wanted -- add it here with the reason.', v_unexpected;
  END IF;

  -- All thirteen, or none. Without this the allowlist would be a standing
  -- permit: once PR #142 drops them, nothing would stop one being re-created,
  -- and the guard would wave through the exact indexes it exists to have
  -- removed. Requiring the set to be whole or empty means the allowlist has
  -- only two legal states -- the bridge across two open PRs, and gone -- and
  -- the moment #142 lands the correct edit is to delete this block, not to
  -- prune it one name at a time.
  SELECT count(DISTINCT redundant) INTO v_surviving
    FROM duplicate_indexes
   WHERE kind = 'index'
     AND format('%s|%s|%s', tbl, redundant, covered_by) = ANY (v_allowed);

  IF v_surviving NOT IN (0, array_length(v_allowed, 1)) THEN
    RAISE EXCEPTION
      '% of the % known duplicates are present. They are dropped together by '
      '20260903000001_drop_duplicate_indexes.sql, so a partial set means one '
      'was re-created after that migration ran -- or that the migration was '
      'edited to drop only some. Either way the allowlist no longer describes '
      'anything: drop the survivors and delete it.',
      v_surviving, array_length(v_allowed, 1);
  END IF;

  -- All-or-none is still not enough on its own: recreating all thirteen after
  -- the cleanup migration lands would read as the untouched state and pass.
  -- What separates "never dropped" from "dropped and put back" is WHEN each
  -- index was created, and the catalog does record that ordinally. Every
  -- allowlisted duplicate comes from a 2024-era migration; `v_anchor` is an
  -- index created by 20260904000003, which runs after the cleanup migration.
  -- An original therefore has a lower oid than the anchor, and anything
  -- recreated after the cleanup ran necessarily has a higher one.
  --
  -- This is the only self-expiring signal available here: `scripts/db-test.sh`
  -- applies migration files directly, so there is no ledger to ask whether
  -- 20260903000001 has run.
  --
  -- It is a heuristic, and the limits are worth stating rather than implying.
  -- Oids record allocation order, not migration provenance: a dump and restore
  -- reassigns them, and a migration numbered between the cleanup and the anchor
  -- could in principle recreate all thirteen below the anchor. Neither matters
  -- where this actually runs -- a database built by applying every migration in
  -- filename order to an empty cluster, which is what `scripts/db-test.sh` and
  -- the CI job do -- because there allocation order IS migration order. The
  -- durable fix is not a better heuristic: it is deleting this allowlist in the
  -- same change that merges 20260903000001.
  SELECT c.oid INTO v_anchor
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'uq_vote_nft_user_holder';

  IF v_anchor IS NULL THEN
    RAISE EXCEPTION
      'uq_vote_nft_user_holder is missing; it is this check''s ordering anchor '
      '(20260904000003). Point the anchor at another index created after '
      '20260903000001_drop_duplicate_indexes.sql.';
  END IF;

  SELECT string_agg(format('%s.%s', d.tbl, d.redundant), ', '
                    ORDER BY d.tbl, d.redundant)
    INTO v_recreated
    FROM (SELECT DISTINCT tbl, redundant FROM duplicate_indexes
           WHERE kind = 'index'
             AND format('%s|%s|%s', tbl, redundant, covered_by) = ANY (v_allowed)
         ) d
    JOIN pg_class c     ON c.relname = d.redundant
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   WHERE c.oid > v_anchor;

  IF v_recreated IS NOT NULL THEN
    RAISE EXCEPTION
      'these duplicates were created AFTER the migration that drops them: %. '
      'The allowlist covers the originals, not a reintroduction. Drop them and '
      'delete the allowlist.', v_recreated;
  END IF;
END;
$$;

-- ── 3. No two constraints of the same kind enforce the same thing ───────────
-- The allowlist above covers plain indexes. A second UNIQUE constraint over an
-- already-unique column rebuilds the same waste and needs DROP CONSTRAINT
-- rather than DROP INDEX, so it is reported apart rather than excluded.

DO $$
DECLARE
  v_pairs TEXT;
BEGIN
  SELECT string_agg(format('%s.%s (duplicates %s)', tbl, redundant, covered_by),
                    ', ' ORDER BY tbl, redundant)
    INTO v_pairs
    FROM (SELECT DISTINCT ON (tbl, redundant) tbl, redundant, covered_by
            FROM duplicate_indexes
           WHERE kind = 'constraint'
           ORDER BY tbl, redundant, covered_by) d;

  IF v_pairs IS NOT NULL THEN
    RAISE EXCEPTION
      'two constraints enforce the same thing: %. Drop the redundant '
      'CONSTRAINT -- dropping its index alone is not possible.', v_pairs;
  END IF;
END;
$$;

-- ── 4. No index is being kept without being usable ──────────────────────────
-- The detector skips `indisvalid = false`, which is right for duplicate
-- matching -- an invalid index answers no query, so nothing is redundant
-- against it. But it is the wrong thing to be silent about: a failed
-- `CREATE INDEX CONCURRENTLY` leaves exactly that. It is the same dead weight
-- the rest of this file is about, reached from the other direction.
--
-- `indislive` is not filtered here, deliberately -- unlike in the detector,
-- where a half-dropped index is correctly ignored because nothing can be
-- redundant against it. An interrupted `DROP INDEX CONCURRENTLY` leaves a
-- not-live, not-valid catalog entry that still occupies storage until someone
-- finishes the drop, and it is exactly as invisible as the failed-create case.

DO $$
DECLARE
  v_invalid TEXT;
BEGIN
  -- `indisready` is what says writes maintain the index, and a CREATE INDEX
  -- CONCURRENTLY can fail on either side of it: fail early and the index is
  -- neither ready nor valid (storage only), fail late and it is ready but not
  -- valid (storage AND a write cost on every insert). Both are reported,
  -- labelled, because the second is the more expensive one and the distinction
  -- is invisible from the name.
  SELECT string_agg(format('%s on %s (%s)',
                           c.relname, i.indrelid::regclass::TEXT,
                           CASE WHEN NOT i.indislive
                                THEN 'a DROP INDEX CONCURRENTLY that never '
                                     'finished; storage only'
                                WHEN i.indisready
                                THEN 'maintained on every write'
                                ELSE 'not maintained; storage only' END),
                    ', ' ORDER BY c.relname)
    INTO v_invalid
    FROM pg_index i
    JOIN pg_class c     ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND NOT i.indisvalid;

  IF v_invalid IS NOT NULL THEN
    RAISE EXCEPTION
      'invalid index(es): %. A failed CREATE INDEX CONCURRENTLY leaves this: '
      'occupying storage, usable by no query. Drop it and rebuild.', v_invalid;
  END IF;
END;
$$;

ROLLBACK;
