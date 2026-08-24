-- Every SECURITY DEFINER function this repo creates that anon or authenticated
-- can reach must have been reviewed and named here on purpose.
--
-- `public` is the PostgREST-exposed schema (supabase/config.toml), so any
-- function in it is callable as POST /rest/v1/rpc/<name> by whoever holds the
-- matching key. A SECURITY DEFINER function runs as its owner and RLS does not
-- apply to it, so for the tables it touches it IS the authorization boundary.
-- PostgreSQL grants EXECUTE to PUBLIC by default and Supabase adds anon and
-- authenticated, which means the safe state has to be written down explicitly
-- in every migration -- forgetting to is silent, and looks identical to having
-- decided.
--
-- WHY THE PREDICATE IS NOT SCOPED TO `public`
--
-- Scoping it there would tie the test to one line of config.toml. Add a schema
-- to `schemas = [...]` and a SECURITY DEFINER mutator in it becomes an
-- authenticated RPC while a public-only test stays green. So the predicate
-- covers every schema except the platform-managed ones this repo does not
-- create, which makes the exposed-schema list irrelevant: a definer mutator
-- that anon or authenticated can execute fails here whether or not PostgREST
-- currently serves its schema.
--
-- This is deliberately a CLASS assertion rather than a list of known function
-- names. The 2026-08-24 audit named three; the discovery predicate found six. A
-- named list would have shipped the same bug back in the next migration that
-- forgets the clause. Adding such a function now fails this test with its own
-- name in the message.
--
-- WHY THE PREDICATE DOES NOT FILTER ON VOLATILITY
--
-- The obvious narrowing is `provolatile = 'v'`, on the theory that only a
-- VOLATILE function can write. That theory does not hold: volatility is
-- developer-declared metadata, not an enforced property. A function marked
-- STABLE can call a VOLATILE one, and PostgreSQL will not stop it -- the
-- declaration is a promise to the planner, and a wrong promise produces a
-- mutator that this test would wave through. So the predicate covers every
-- non-trigger SECURITY DEFINER function and the exceptions are enumerated.
--
-- Membership in the allowlist is a claim that the function was read and is
-- either read-only or authorizes its own caller. A name-only allowlist would
-- make that claim permanent: `CREATE OR REPLACE FUNCTION can_admin_space(text)`
-- can add a call to a mutating function, stay declared STABLE, keep its OID and
-- its anon grant, and sail through a predicate that only knows its name.
-- PostgreSQL does not stop a STABLE function from calling a VOLATILE one.
--
-- So the allowlist is pinned to the reviewed definition: the entire rendered
-- CREATE FUNCTION statement plus the owner, hashed together, recorded here. The
-- owner is in there because it is what SECURITY DEFINER defers to -- an
-- `ALTER FUNCTION ... OWNER TO` re-points the authority these helpers run with
-- without touching a line of their bodies.
-- Editing one of these four functions in any way -- including dropping its
-- pinned search_path, or swapping its return type for a domain whose CHECK
-- constraint runs code -- fails this test until someone re-reads it and updates
-- the hash, which is the review this allowlist is asserting happened.
--
-- WHAT THIS TEST IS NOT
--
-- It is a guard against forgetting, not against a hostile migration author.
-- Someone who can add a migration can also add a mutating trigger, a rule, or a
-- domain constraint that this predicate does not model. The control for that is
-- migration review; the control for a missing REVOKE is here.
--
-- If a future function genuinely must be callable by authenticated, prefer
-- SECURITY INVOKER and let RLS decide. Keep SECURITY DEFINER only when the
-- function must see past RLS, and then have it authorize the caller in its own
-- body (`public.user_id()`), before adding it below with the reason.
--
-- `scripts/db-test.sh` drives this in CI: it globs `supabase/tests/*.sql`
-- (line 29) after applying every migration, so this file is picked up without
-- any wiring. It reads catalogs only, writes nothing, and needs no fixtures.

BEGIN;

DO $test$
DECLARE
  leaked TEXT;
  -- Namespaces owned by PostgreSQL or by the Supabase platform. This repo's
  -- migrations create none of them and cannot change their grants, so their
  -- definer functions are not ours to assert on. Everything else is in scope,
  -- including any schema a future migration adds.
  platform_schemas CONSTANT TEXT[] := ARRAY[
    'pg_catalog', 'pg_toast', 'information_schema',
    'auth', 'storage', 'extensions', 'graphql', 'graphql_public',
    'realtime', 'vault', 'pgsodium', 'pgsodium_masks', 'pgbouncer',
    'supabase_functions', 'supabase_migrations', 'cron', 'net',
    '_analytics', '_realtime'
  ];
  -- Reviewed 2026-08-24. Each is LANGUAGE sql/plpgsql, STABLE, no write of any
  -- kind, with a pinned search_path:
  --
  --   user_id()                  reads the JWT `sub` claim. The identity every
  --                              RLS policy is written against.
  --   is_platform_admin()        EXISTS over role_grants for the caller. Must
  --                              be DEFINER: the policies that gate role_grants
  --                              are themselves written in terms of it.
  --   can_admin_space(text)      same shape, scoped to one space.
  --   public_council_metrics(text)  deliberately public aggregate read. DEFINER
  --                              so the counts are complete rather than
  --                              silently filtered to the caller's own rows.
  --
  -- Resolved to OIDs rather than compared as text: `oid::regprocedure::text`
  -- renders minimally qualified, so the same function reads as `user_id()` or
  -- `public.user_id()` depending on the session search_path, and a textual
  -- allowlist would silently stop matching. Signatures absent from this
  -- database drop out instead of poisoning the array with NULL.
  -- signature, md5 of the reviewed definition. Regenerate a hash only after
  -- re-reading the function, with:
  --   SELECT md5(pg_get_functiondef(p.oid) || '|' || pg_get_userbyid(p.proowner))
  --     FROM pg_proc p WHERE p.oid = 'public.<sig>'::regprocedure;
  --
  -- `pg_get_functiondef` is the whole CREATE FUNCTION statement -- arguments and
  -- their defaults, return type, language, volatility, STRICT, LEAKPROOF,
  -- PARALLEL, SECURITY DEFINER, every SET clause and the body -- rendered from
  -- the catalog with stable names rather than cluster-local OIDs. Ownership is
  -- the one security-relevant thing it omits, so it is appended. CI runs
  -- postgres:16 (.github/workflows/agent-verification.yml), which is what these
  -- hashes were taken on; a major-version bump may reformat the rendering and
  -- require regenerating them once.
  reviewed CONSTANT TEXT[][] := ARRAY[
    ['public.user_id()',                   '1c4b3a101e028021445a55ae3a30e8f1'],
    ['public.is_platform_admin()',         '36898ef00e3d3650763e55b60e099857'],
    ['public.can_admin_space(text)',       '3a8ca75573a90e856c6d580f9c659af8'],
    ['public.public_council_metrics(text)', '179f500c0d40b5f9d22cb6ef56dd1e82']
  ];
  allowlist CONSTANT oid[] := ARRAY(
    SELECT to_regprocedure(reviewed[i][1])::oid
      FROM generate_subscripts(reviewed, 1) AS i
     WHERE to_regprocedure(reviewed[i][1]) IS NOT NULL
  );
  drifted TEXT;
BEGIN
  -- Rendered from the catalog rather than via `oid::regprocedure::text`, which
  -- qualifies or not depending on the session search_path.
  SELECT string_agg(
           format('%s.%s(%s) (anon=%s authenticated=%s)',
                  n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid),
                  has_function_privilege('anon', p.oid, 'EXECUTE'),
                  has_function_privilege('authenticated', p.oid, 'EXECUTE')),
           E'\n  ' ORDER BY n.nspname, p.proname,
                            pg_get_function_identity_arguments(p.oid))
    INTO leaked
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE NOT (n.nspname = ANY (platform_schemas))
     AND p.prosecdef                                   -- runs as owner
     AND p.prorettype <> 'trigger'::regtype            -- callable as an RPC
     AND NOT (p.oid = ANY (allowlist))
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));

  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION
      'SECURITY DEFINER functions reachable by anon/authenticated:%  %',
      E'\n', leaked
      USING HINT = 'Add REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated '
                   'and GRANT EXECUTE ... TO service_role, as in '
                   '20260904000001_revoke_public_execute_on_definer_rpcs.sql. '
                   'If the function must stay caller-reachable, add it to the '
                   'allowlist in this file with the reason it is safe.';
  END IF;

  -- An allowlisted function whose definition no longer hashes to the reviewed
  -- one has not been reviewed, whatever the comment above says. Missing counts
  -- as drift too: a signature that vanished should be removed from the list
  -- deliberately, not silently tolerated.
  SELECT string_agg(entry, E'\n  ' ORDER BY entry)
    INTO drifted
    FROM (
      SELECT CASE
               WHEN p.oid IS NULL THEN format('%s (absent)', reviewed[i][1])
               ELSE format('%s (expected md5 %s, found %s)',
                           reviewed[i][1], reviewed[i][2],
                           md5(pg_get_functiondef(p.oid) || '|'
                               || pg_get_userbyid(p.proowner)))
             END AS entry
        FROM generate_subscripts(reviewed, 1) AS i
        LEFT JOIN pg_proc p ON p.oid = to_regprocedure(reviewed[i][1])::oid
       WHERE p.oid IS NULL
          OR md5(pg_get_functiondef(p.oid) || '|'
                 || pg_get_userbyid(p.proowner))
             IS DISTINCT FROM reviewed[i][2]
    ) AS d;

  IF drifted IS NOT NULL THEN
    RAISE EXCEPTION
      'allowlisted SECURITY DEFINER helpers no longer match their reviewed definition:%  %',
      E'\n', drifted
      USING HINT = 'Re-read the function. If it is still read-only and still '
                   'pins search_path, update its md5 in this file. If it now '
                   'writes, drop it from the allowlist and revoke '
                   'anon/authenticated EXECUTE instead.';
  END IF;
END;
$test$;

-- The allowlisted helpers are excluded from the predicate above, and the
-- definition hash says nothing about privileges -- so a revoke on one of them
-- would sail through both. That direction matters as much as the other: every
-- RLS policy on role_grants, community_manager_applications and
-- role_grant_events is written in terms of these helpers, and an authenticated
-- caller who cannot execute them reads nothing rather than reading what they
-- are entitled to. `public_council_metrics` is the public council page.
DO $test$
DECLARE
  fn TEXT;
  caller_reachable CONSTANT TEXT[] := ARRAY[
    'public.user_id()',
    'public.is_platform_admin()',
    'public.can_admin_space(text)',
    'public.public_council_metrics(text)'
  ];
BEGIN
  FOREACH fn IN ARRAY caller_reachable LOOP
    IF to_regprocedure(fn) IS NULL THEN
      RAISE EXCEPTION 'allowlisted helper is missing: %', fn;
    END IF;
    IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION
        'authenticated lost EXECUTE on %, which RLS policies depend on', fn
        USING HINT = 'If the revoke was deliberate, remove the function from '
                     'the allowlist and from this assertion together.';
    END IF;
  END LOOP;

  IF NOT has_function_privilege('anon', 'public.public_council_metrics(text)', 'EXECUTE') THEN
    RAISE EXCEPTION
      'anon lost EXECUTE on public.public_council_metrics(text), a deliberately public read';
  END IF;
END;
$test$;

-- The live callers must keep working. The first three are reached from
-- apps/web/src/lib/supabase/db.ts through the service-role client; the fourth
-- is service-role housekeeping the migration deliberately preserves. If a
-- revoke above were written too broadly, this is what would catch it.
DO $test$
DECLARE
  fn TEXT;
  required CONSTANT TEXT[] := ARRAY[
    'public.increment_vote_option(uuid)',
    'public.get_or_create_treasury(text)',
    'public.record_treasury_deposit(text,integer,uuid,uuid,uuid,text)',
    'public.cleanup_old_webhook_events()'
  ];
BEGIN
  FOREACH fn IN ARRAY required LOOP
    IF to_regprocedure(fn) IS NULL THEN
      RAISE EXCEPTION 'expected function is missing: %', fn;
    END IF;
    IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role lost EXECUTE on %', fn;
    END IF;
  END LOOP;
END;
$test$;

ROLLBACK;
