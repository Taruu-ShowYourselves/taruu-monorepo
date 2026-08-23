-- =============================================================================
-- DB cleanup stage 2: drop 13 plain indexes that exactly duplicate
-- UNIQUE-constraint indexes on the same columns (2026-08-23 audit).
--
-- Every index dropped here is a non-unique btree over exactly the column set
-- of a UNIQUE constraint that remains on the table, with identical operator
-- classes and no predicate/INCLUDE difference (verified against pg_index
-- grouped by indkey/indclass/indpred/indexprs). None is attached to a
-- constraint (verified via pg_constraint.conindid). The retained unique index
-- serves every lookup the duplicate served; all 13 show idx_scan = 0 since
-- the 2026-05-22 stats reset.
--
-- Retained twin, for the record:
--   users:               users_email_key, users_did_key, users_google_id_key
--   issue_coins:         issue_coins_vote_id_key, issue_coins_token_mint_key
--   knesset_items:       knesset_items_vote_id_key
--   knesset_rankings:    knesset_rankings_vote_id_key
--   payments:            payments_idempotency_key_key
--   phone_verifications: uq_phone_verifications_user
--   treasury:            treasury_municipality_id_key
--   vote_card_art:       vote_card_art_vote_id_key
--   vote_sources:        vote_sources_vote_id_key
--   webhook_events:      webhook_events_event_id_key
--
-- Rollback: each is recreatable as a plain
--   CREATE INDEX <name> ON <table> (<same columns>);
-- =============================================================================

DROP INDEX public.idx_users_email;
DROP INDEX public.idx_users_did;
DROP INDEX public.idx_users_google_id;
DROP INDEX public.idx_issue_coins_vote;
DROP INDEX public.idx_issue_coins_mint;
DROP INDEX public.idx_knesset_items_vote;
DROP INDEX public.idx_knesset_rankings_vote;
DROP INDEX public.idx_payments_idempotency;
DROP INDEX public.idx_phone_verifications_user;
DROP INDEX public.idx_treasury_municipality;
DROP INDEX public.idx_vote_card_art_vote;
DROP INDEX public.idx_vote_sources_vote;
DROP INDEX public.idx_webhook_events_event_id;
