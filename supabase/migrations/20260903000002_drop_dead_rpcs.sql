-- =============================================================================
-- DB cleanup stage 3: drop 9 dead public RPCs (2026-08-23 audit).
--
-- Each function below has, verified on origin/main at commit c138bf9:
--   * zero references in apps/ and packages/ (web, mobile, agents) — the web
--     app reads and writes phone_verifications / payments / vote_nfts through
--     the tables directly in src/lib/supabase/db.ts;
--   * zero references from any other SQL function body, view definition,
--     trigger, RLS policy, or pg_cron job;
--   * no Supabase Edge Functions exist in this project at all;
--   * zero production invocations from ANY deployed client (old mobile or
--     web builds included): pg_stat_statements, tracking since its
--     2026-06-20 reset (4,762 distinct statements, under the eviction cap),
--     contains no call to any of the nine — the only entries mentioning
--     them are their own historical CREATE/GRANT DDL.
--
-- Origins, for the record:
--   20240101000002_functions.sql:      check_verification_completion,
--                                      get_or_create_payment
--   20250118000001_vote_nfts.sql:      get_vote_nft_stats, user_has_vote_nft
--   20250119000001_phone_verifications.sql:
--                                      can_send_phone_verification,
--                                      can_verify_phone_code,
--                                      record_phone_verification_send,
--                                      record_phone_verification_attempt,
--                                      mark_phone_verified
--
-- Each name has exactly one overload (verified via pg_proc /
-- pg_get_function_identity_arguments); the signatures below are those exact
-- overloads, so nothing broader can be dropped. Several are SECURITY DEFINER
-- and grant-executable to authenticated/anon — removing them also retires
-- their Supabase security-advisor warnings.
--
-- Rollback: recreate from the origin migrations listed above.
-- =============================================================================

DROP FUNCTION public.can_send_phone_verification(p_user_id uuid, p_phone text, p_max_per_hour integer, p_max_per_day integer);
DROP FUNCTION public.can_verify_phone_code(p_user_id uuid, p_max_attempts integer);
DROP FUNCTION public.record_phone_verification_send(p_user_id uuid, p_phone text);
DROP FUNCTION public.record_phone_verification_attempt(p_user_id uuid);
DROP FUNCTION public.mark_phone_verified(p_user_id uuid, p_phone text);
DROP FUNCTION public.check_verification_completion(run_uuid uuid);
DROP FUNCTION public.get_or_create_payment(p_user_id uuid, p_type payment_type, p_amount integer, p_idempotency_key text, p_vote_id uuid, p_option_id text);
DROP FUNCTION public.get_vote_nft_stats(p_vote_id uuid);
DROP FUNCTION public.user_has_vote_nft(p_user_id uuid, p_vote_id uuid);
