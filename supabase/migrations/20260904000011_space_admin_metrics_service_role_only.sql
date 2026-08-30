-- =============================================================================
-- 20260904000011 — restore the intended ACL of space_admin_metrics
--
-- WHAT IS WRONG, AND WHERE
--
--   This is a PRODUCTION-ONLY drift. The source has always been correct.
--
--   20260802000013_space_admin_metrics.sql created the function and said, in
--   both code and comment, that only the service role may execute it:
--
--     REVOKE ALL ON FUNCTION public.space_admin_metrics(UUID) FROM PUBLIC;
--     -- Only the service role. Unlike the council RPC this is an
--     -- administrative surface, reached exclusively through a capability check
--     -- in the application layer, so no public-facing database role is given
--     -- execute privilege here.
--     GRANT EXECUTE ON FUNCTION public.space_admin_metrics(UUID) TO service_role;
--
--   A database built from supabase/migrations agrees:
--
--     postgres=X/postgres | service_role=X/postgres
--
--   Production does not:
--
--     postgres=X/postgres | anon=X/postgres | authenticated=X/postgres
--                         | service_role=X/postgres
--
--   `REVOKE … FROM PUBLIC` removes the PUBLIC default. It does not remove an
--   explicit grant to a named role, and Supabase's bootstrap grants anon and
--   authenticated on functions in `public` separately. So the revoke read like
--   a lock while the door stayed open - the identical mistake
--   20260904000001_revoke_public_execute_on_definer_rpcs.sql was written to
--   correct for six other functions.
--
-- WHY 20260904000001 DID NOT ALREADY CATCH IT
--
--   That migration's predicate carries `provolatile = 'v'`: it swept the
--   mutators. `space_admin_metrics` is STABLE, so it fell outside. The
--   regression test in supabase/tests/definer_rpc_authorization.sql drops the
--   volatility term precisely because volatility is a developer's declaration
--   rather than an enforced property - which is why that test would have caught
--   this against production, and why it passes against a fresh database, where
--   there is nothing to catch.
--
-- WHAT THIS DOES NOT CHANGE
--
--   Nothing about the function: not its body, its signature, its owner, its
--   volatility or its pinned search_path. Only the grant. The function is
--   read-only and returns nine aggregates with small-bucket suppression, so
--   this is not a leak being closed in a panic - it is a stated intent being
--   restored, and the reason it matters is that `proposals_submitted` counts
--   every vote in the municipality including draft, in_review and rejected
--   ones, which is administrative information the public page does not show.
--
-- WHY THE FUNCTION IS NOT ADDED TO THE TEST'S ALLOWLIST
--
--   The allowlist names four functions that are intentionally caller-reachable.
--   Adding a fifth would record this drift as a reviewed decision and make the
--   test agree with the leak instead of reporting it. The allowlist is correct;
--   production was not.
--
-- APPLYING THIS
--
--   Independent of the verification expand/contract pair and of every other
--   Stage 4/5 migration. It can be applied before or after any of them, and it
--   needs no application deploy: the one caller,
--   apps/web/src/server/infra/supabase/space-metrics.repo.ts, already goes
--   through `supabaseAdmin` (service role) and is gated on SpaceScope.
--
-- ROLLBACK
--   GRANT EXECUTE ON FUNCTION public.space_admin_metrics(UUID)
--     TO anon, authenticated;
--   ...which should never be needed. If some caller turns out to depend on it,
--   that caller is reaching an administrative surface without the capability
--   check, and the fix is the caller.
-- =============================================================================

-- ── 1. the revoke ───────────────────────────────────────────────────────────
--
-- Named roles as well as PUBLIC, which is the whole point: the original
-- migration revoked only PUBLIC and that is why this is necessary. service_role
-- is not named here and keeps the explicit grant it already holds.

REVOKE ALL ON FUNCTION public.space_admin_metrics(UUID)
  FROM PUBLIC, anon, authenticated;

-- Re-granted rather than assumed. On a database where the bootstrap never ran,
-- service_role's privilege may have come from the PUBLIC entry the line above
-- just removed, and this migration must not be the thing that breaks the space
-- admin dashboard. GRANT on a privilege already held is a no-op.
GRANT EXECUTE ON FUNCTION public.space_admin_metrics(UUID)
  TO service_role;

-- ── 2. the assertion ────────────────────────────────────────────────────────
--
-- The migration is idempotent in effect but this proves the effect, on the
-- database it was actually applied to, at the moment it was applied. A revoke
-- that silently did nothing - wrong signature, wrong schema, a grant restored
-- between statements - fails here rather than being discovered by the next
-- audit.

DO $assert$
BEGIN
  IF to_regprocedure('public.space_admin_metrics(uuid)') IS NULL THEN
    RAISE EXCEPTION 'space_admin_metrics(uuid) does not exist'
      USING HINT = 'This migration expects 20260802000013 to have been applied.';
  END IF;

  IF has_function_privilege('anon', 'public.space_admin_metrics(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated',
                               'public.space_admin_metrics(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION
      'space_admin_metrics(uuid) is still reachable by anon or authenticated'
      USING HINT = 'Something re-granted it between the REVOKE above and this '
                   'check, or the privilege is inherited from a role these two '
                   'are members of.';
  END IF;

  IF NOT has_function_privilege('service_role',
                                'public.space_admin_metrics(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION
      'service_role lost EXECUTE on space_admin_metrics(uuid)'
      USING HINT = 'The space admin dashboard reads this through supabaseAdmin '
                   'and would 500 without it.';
  END IF;
END;
$assert$;

COMMENT ON FUNCTION public.space_admin_metrics(UUID) IS
  'Aggregate-only space metrics. Never returns user, payment, or identity rows. Buckets of 1-4 are suppressed in SQL so the true value never leaves the database, and the participation rate is withheld whenever either side of it is below the floor. A space that does not exist, or has no municipality_code, returns no row (the WHERE EXISTS guard) rather than a fabricated zero, and the caller renders every figure as unavailable. Service-role only: 20260802000013 intended this, 20260904000011 enforced it after production was found granting anon and authenticated.';
