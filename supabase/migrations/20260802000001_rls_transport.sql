-- Phase 5 (RLS-03): remove the dead RLS transport and make public.user_id()
-- read only from the channel that actually works.
--
-- History: `public.user_id()` (20240101000001) resolved
--   COALESCE(request.jwt.claims->>'sub', app.current_user_id)::UUID
-- The first branch was always right and was never fed — no client ever sent a
-- token PostgREST could verify. The second branch was fed by `set_claim`, which
-- (a) wrote `app.user_id`, not `app.current_user_id`, and (b) used
-- set_config(..., true), i.e. transaction-local, which cannot survive
-- PostgREST's stateless HTTP. Its only caller, withUserContext(), had zero call
-- sites. Every per-user policy in this database has therefore matched zero rows
-- since it was written, including the SEC-01 corrections.
--
-- Phase 5 feeds the JWT branch (apps/web/src/lib/supabase/user-client.ts mints a
-- short-lived Supabase-signed token and passes it via supabase-js's accessToken
-- callback). The session-variable branch is now deleted rather than left in
-- place: unreachable security plumbing is worse than none, because the next
-- reader assumes it works.

-- === public.user_id(): JWT claim only =====================================

CREATE OR REPLACE FUNCTION public.user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::json->>'sub')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.user_id() IS
  'Current user id from the verified PostgREST JWT (sub). NULL for anon and for '
  'the service role. Never use auth.uid() here: this project sets '
  '[auth] enabled = false, so it always returns NULL (SEC-01, 20260628000002). '
  'STABLE so RLS policies can wrap it as (SELECT public.user_id()) and have '
  'Postgres evaluate it once per statement instead of once per row.';

-- === Drop the dead transport ==============================================
--
-- Its only caller (apps/web/src/lib/supabase/server.ts withUserContext) is
-- deleted in the same plan. Signature-qualified so the DROP is unambiguous.

DROP FUNCTION IF EXISTS public.set_claim(TEXT, TEXT);
DROP FUNCTION IF EXISTS set_claim(TEXT, TEXT);
