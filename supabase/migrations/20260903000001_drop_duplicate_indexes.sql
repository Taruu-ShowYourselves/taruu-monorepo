-- =============================================================================
-- DB cleanup stage 2: drop 13 plain indexes that exactly duplicate
-- UNIQUE-constraint indexes on the same columns (2026-08-23 audit,
-- re-verified against production 2026-08-30).
--
-- WHY EACH DROP IS SAFE
--
-- Every index dropped here is a non-unique btree over exactly the column set
-- of a UNIQUE constraint that remains on the table, with identical operator
-- classes and no predicate/INCLUDE difference (verified against pg_index
-- grouped by indkey/indclass/indpred/indexprs). None is attached to a
-- constraint (verified via pg_constraint.conindid). The retained unique index
-- is therefore a perfect substitute: same relation, same key, same opclass,
-- same order, so every access path the duplicate served the twin serves at
-- the same cost.
--
-- That structural equivalence is the whole argument. It does not depend on
-- usage statistics, which is just as well -- these indexes are NOT unused.
-- Read counts as of 2026-08-30 (pg_stat_user_indexes.idx_scan, since the
-- 2026-05-22 stats reset):
--
--   idx_vote_sources_vote          3,825,847     idx_users_email            0
--   idx_knesset_items_vote            28,842     idx_users_did              0
--   idx_knesset_rankings_vote          4,769     idx_users_google_id        0
--   idx_vote_card_art_vote             2,760     idx_issue_coins_mint       0
--   idx_issue_coins_vote                 359     idx_payments_idempotency   0
--   idx_phone_verifications_user          32
--   idx_treasury_municipality             16
--   idx_webhook_events_event_id            4
--
-- A non-zero count means those lookups happen, not that this particular index
-- is required to serve them; after the drop the planner uses the unique twin,
-- which is indexed identically. An earlier revision of this header claimed all
-- thirteen were at idx_scan = 0. That was wrong, and correcting it does not
-- change the decision.
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
--   Note on payments: 20260904000009 (merged, NOT yet applied) replaces
--   payments_idempotency_key_key with a per-user unique on
--   (user_id, idempotency_key). That migration was written knowing this one
--   drops idx_payments_idempotency and says so in its own header: the only
--   reader by bare key was get_or_create_payment, which the sibling migration
--   in this PR deletes. Either apply order is fine.
--
-- LOCK SAFETY
--
-- DROP INDEX (non-concurrent) takes ACCESS EXCLUSIVE on the parent table. The
-- drop itself is a catalog update and returns immediately, but acquiring the
-- lock does not: if any transaction is holding a conflicting lock the DROP
-- queues, and every query arriving after it queues behind the DROP. On
-- vote_sources and users that convoy would be user-visible.
--
-- lock_timeout bounds that wait. On timeout the statement errors, the
-- migration's transaction rolls back with nothing committed, and it can be
-- retried at a quieter moment -- which is the correct outcome, and the reason
-- the DROPs below are deliberately bare rather than IF EXISTS: a clean
-- all-or-nothing abort is safe to re-run, whereas IF EXISTS would let a
-- renamed or already-missing index pass silently and leave this file claiming
-- to have done work it did not do.
--
-- DROP INDEX CONCURRENTLY is the other option and is NOT used: it cannot run
-- inside a transaction block, so it would forfeit the all-or-nothing property
-- for thirteen drops that are individually instantaneous once the lock is in
-- hand. The wait, not the work, is the only hazard here, and lock_timeout is
-- the direct fix for a wait.
--
-- ROLLBACK
--   Each is recreatable as a plain
--     CREATE INDEX <name> ON <table> (<same columns>);
--   using the names and tables listed above. Nothing depended on them, so
--   recreation restores redundancy, not behaviour.
-- =============================================================================

SET lock_timeout = '3s';

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

-- Scoped to this file: if the runner shares one session across migrations,
-- an unreset lock_timeout would silently apply to every later migration.
RESET lock_timeout;
