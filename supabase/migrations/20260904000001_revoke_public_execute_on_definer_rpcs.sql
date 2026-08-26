-- =============================================================================
-- Close anonymous EXECUTE on every legacy SECURITY DEFINER mutator in `public`.
--
-- WHAT WAS WRONG
--
-- Six functions were created SECURITY DEFINER and VOLATILE without an
-- authorization clause. PostgreSQL grants EXECUTE on a new function to PUBLIC
-- by default, and the Supabase bootstrap additionally grants anon and
-- authenticated. Three of the six were later given `GRANT … TO service_role`,
-- which adds a privilege but never removes the default one — so the grant read
-- like a lock while the door stayed open.
--
-- The set is not a guess. It is the exact output of this predicate:
--
--   prosecdef                                -- runs as owner, ignores RLS
--   AND provolatile = 'v'                    -- declares that it may write
--   AND prorettype <> 'trigger'              -- reachable as a PostgREST RPC
--   AND (anon OR authenticated may EXECUTE)
--
-- Run against production read-only on 2026-08-24 it returned six rows; run
-- against a disposable database built from `supabase/migrations` at c138bf9 it
-- returned the same six, so the exposure is in the source, not in production
-- drift. After this migration both return none.
--
-- The regression guard in supabase/tests/definer_rpc_authorization.sql drops
-- the volatility term, because volatility is a developer's declaration rather
-- than an enforced property and a mutator mistakenly marked STABLE would slip
-- past it. That broader predicate also catches four read-only helpers -- three
-- RLS helpers and one deliberate public aggregate -- which the test allowlists
-- by name with the reason each is safe. None of them is touched here.
--
--   check_verification_completion(uuid)
--   cleanup_old_webhook_events()
--   get_or_create_payment(uuid,payment_type,integer,text,uuid,text)
--   get_or_create_treasury(text)
--   increment_vote_option(uuid)
--   record_treasury_deposit(text,integer,uuid,uuid,uuid,text)
--
-- Sample of the raw evidence:
--
--   increment_vote_option(uuid)
--     prosecdef = t, provolatile = v
--     proacl    = =X/postgres | postgres=X/postgres | anon=X/postgres
--                 | authenticated=X/postgres | service_role=X/postgres
--     has_function_privilege('anon', …, 'EXECUTE') = true
--
--   …identically for the other five.
--
-- `public` is the PostgREST-exposed schema (supabase/config.toml), so every one
-- of these is reachable as POST /rest/v1/rpc/<name> by any caller holding the
-- publishable anon key. Being SECURITY DEFINER, they run as the owner and RLS
-- does not apply — and RLS is otherwise the only thing protecting these tables
-- (the vote tables carry SELECT-only policies and no INSERT/UPDATE policy at
-- all). These functions are the single hole in that wall.
--
-- The sharpest case is `increment_vote_option`: it raises
-- `vote_options.votes` AND `votes.participant_count` for an option id, with no
-- ballot written and no authorization check. Option ids are handed to every
-- client by the public vote-detail API. That is unauthenticated ballot
-- stuffing on a civic voting product.
--
-- `record_treasury_deposit` is the second: it increments a municipality's
-- balance and appends the matching ledger row in one call. `cleanup_old_
-- webhook_events` is the third — it DELETEs, and the rows it deletes are what
-- makes payment webhook delivery idempotent.
--
-- WHY THIS IS AN OMISSION AND NOT THE HOUSE STYLE
--
-- Every function written since carries an explicit clause in exactly the shape
-- used below — 20260902000001_ingest_auto_activation.sql:121-124 and :205-208,
-- 20260901000002_mfa_schema.sql:6386-6395, and on the discovery side
-- 0041_publication.sql:1185-1217. Only the 2024-era file was never brought
-- into line. This migration does that and nothing else.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
--
--   * It does not touch a function body. These functions have no pinned
--     `search_path`, which is a second-order concern for a SECURITY DEFINER
--     routine. Once anon can no longer reach them the residual risk needs an
--     already-trusted caller, and the canonical cast-vote RPC that supersedes
--     `increment_vote_option` will be written with the guard from the start.
--     Changing a body here would widen a security hotfix into a refactor.
--   * It does not drop anything. `20260903000002_drop_dead_rpcs.sql` (PR #142,
--     unmerged) drops get_or_create_payment and check_verification_completion
--     as dead code. That is the better end state for both, but it is unmerged
--     and unapplied, so production is exposed *now*. A revoke that is later
--     followed by a drop costs nothing; waiting does.
--
-- ORDERING AGAINST PR #142
--
-- Both PRs are open, so either may apply first. REVOKE has no IF EXISTS, and a
-- revoke against a dropped function aborts the migration. The two functions
-- #142 drops are therefore guarded on `to_regprocedure`, which returns NULL
-- rather than raising when the signature is gone. `increment_vote_option` is
-- deliberately NOT guarded: it is live, nothing drops it, and if it were
-- missing this migration should fail loudly rather than pass in silence.
--
-- INTENDED CALLERS (verified against origin/main @ c138bf9, re-confirmed as
-- the current head of origin/main on 2026-08-25)
--
-- Every caller in either repo goes through `supabaseAdmin`, the
-- SUPABASE_SERVICE_ROLE_KEY client built in lib/supabase/server.ts:23-33.
-- There is no browser-side caller of any of the six.
--
--   increment_vote_option         db.ts:1259               service_role
--   get_or_create_treasury        db.ts:1782               service_role
--   record_treasury_deposit       db.ts:1807               service_role
--   cleanup_old_webhook_events    no caller; housekeeping  service_role (kept)
--   get_or_create_payment         no caller                — dropped by #142
--   check_verification_completion no caller                — dropped by #142
--
-- The four that stay get the explicit revoke/grant pair, so the ACL states the
-- intent rather than leaving it to a default. The two #142 drops get the
-- revoke only: nothing calls them, so nothing needs a grant, and a caller that
-- appears later should fail closed and be made to ask for one. This migration
-- never revokes service_role — those grants already exist, and removing a
-- privilege nothing is asking for is a separate decision from closing a hole.
--
-- ONE DIVERGENCE BETWEEN PRODUCTION AND A FRESH DATABASE
--
-- In production all six carry an explicit `service_role=X` entry, added by the
-- hosted project's default privileges, so revoking PUBLIC/anon/authenticated
-- leaves service_role holding EXECUTE. On a database built only from
-- `supabase/migrations` plus `supabase/tests/bootstrap.sql`, the two functions
-- that were never given their own grant (get_or_create_payment,
-- check_verification_completion) reached service_role *through* PUBLIC, so the
-- revoke takes their access with it. Both are dead in both environments and
-- #142 drops them, so nothing depends on the difference — but it is real, and
-- a reader diffing the two ACLs should not have to rediscover why. The four
-- live functions carry explicit grants in both.
--
-- ROLLBACK
--   GRANT EXECUTE ON FUNCTION public.increment_vote_option(UUID)
--     TO anon, authenticated;
--   …and likewise for the other two. Do not run this. Restoring anonymous
--   EXECUTE on a SECURITY DEFINER tally mutator re-opens ballot stuffing; if a
--   client path turns out to depend on it, that path is the defect.
-- =============================================================================

-- ── 1. increment_vote_option — live, service-role only ──────────────────────

REVOKE ALL ON FUNCTION public.increment_vote_option(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_vote_option(UUID)
  TO service_role;

-- ── 2. get_or_create_payment — no caller; guarded against #142 ──────────────

DO $$
BEGIN
  -- `payment_type` is schema-qualified in both places on purpose: an unqualified
  -- type name resolves through search_path, and a session without `public` on it
  -- would make to_regprocedure return NULL, skipping the revoke on a function
  -- that is still there. A guard against a dropped function must not double as
  -- a way to fail open.
  IF to_regprocedure(
       'public.get_or_create_payment(uuid, public.payment_type, integer, text, uuid, text)'
     ) IS NOT NULL THEN
    REVOKE ALL ON FUNCTION
      public.get_or_create_payment(UUID, public.payment_type, INTEGER, TEXT, UUID, TEXT)
      FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;

-- ── 3. check_verification_completion — no caller; guarded against #142 ──────

DO $$
BEGIN
  IF to_regprocedure('public.check_verification_completion(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.check_verification_completion(UUID)
      FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;

-- ── 4. treasury: balance mutation and its ledger row ────────────────────────

REVOKE ALL ON FUNCTION public.get_or_create_treasury(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_treasury(TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION
  public.record_treasury_deposit(TEXT, INTEGER, UUID, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.record_treasury_deposit(TEXT, INTEGER, UUID, UUID, UUID, TEXT)
  TO service_role;

-- ── 5. webhook-event housekeeping ───────────────────────────────────────────
-- Deletes the rows that make payment webhook delivery idempotent, so an
-- anonymous caller could clear the replay guard and then replay a webhook.

REVOKE ALL ON FUNCTION public.cleanup_old_webhook_events()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_webhook_events()
  TO service_role;
