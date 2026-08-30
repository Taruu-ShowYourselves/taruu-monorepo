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
-- therefore offers every access path the duplicate offered: same relation,
-- same key, same opclass, same order, so it satisfies the same predicates and
-- the same orderings.
--
-- Equivalent in what it can serve, not byte-for-byte identical. The survivor
-- is unique, so B-tree deduplication is disabled on it, and a nullable unique
-- column may hold many NULLs the non-unique twin could deduplicate -- so index
-- size and the cost of an IS NULL scan can move. What does not move is which
-- queries can be answered, or whether they are answered correctly, and that is
-- what this cleanup turns on.
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
-- lock_timeout bounds each individual lock acquisition. It does NOT bound how
-- long an already-acquired lock is held: this transaction takes users first
-- and does not release it until COMMIT. The thirteen indexes span ten tables
-- (users has three, issue_coins two), and a lock is taken once per table, so
-- after users there are at most nine further acquisitions that can wait. In
-- the worst case -- nine conflicting holders, each wait landing just under the
-- timeout -- users stays locked for far longer than three seconds. In the
-- ordinary case each DROP is a catalog update that returns as soon as the lock
-- is granted and the whole file is milliseconds. The bound to rely on is "no
-- single wait exceeds 3s", not "the tables are locked for at most 3s".
--
-- The timeout is only useful inside a transaction that actually exists. scripts/db-test.sh applies each file with plain `psql -f` and no
-- --single-transaction, so statements would otherwise autocommit one at a
-- time and a timeout on the eleventh DROP would leave ten indexes gone and
-- the file un-retryable (the bare DROPs would then fail on the missing ones).
-- The BEGIN/COMMIT below is therefore load-bearing, not decoration: it is
-- what makes the abort all-or-nothing and the retry clean, and it is what
-- lets the DROPs stay bare rather than IF EXISTS -- IF EXISTS would let a
-- renamed or already-missing index pass silently and leave this file claiming
-- to have done work it did not do.
--
-- SET LOCAL rather than SET: it is scoped to the transaction and restored by
-- both COMMIT and ROLLBACK, so it cannot leak into a later migration sharing
-- the session, and it does not clobber a non-default lock_timeout the caller
-- had already chosen (which a bare RESET would, by setting the default).
--
-- DROP INDEX CONCURRENTLY is the other option and is NOT used: it cannot run
-- inside a transaction block, so choosing it would mean giving up exactly the
-- all-or-nothing property described above, for thirteen drops that are each
-- instantaneous once the lock is in hand. The wait, not the work, is the only
-- hazard here, and lock_timeout is the direct fix for a wait.
--
-- ROLLBACK
--   Each is recreatable as a plain
--     CREATE INDEX <name> ON <table> (<same columns>);
--   using the names and tables listed above. Nothing depended on them, so
--   recreation restores redundancy, not behaviour.
-- =============================================================================

-- This file owns its transaction. Do not apply it from a session that has
-- already opened one: PostgreSQL does not nest, so the BEGIN below would only
-- warn and the COMMIT would end the caller's transaction, not this one --
-- committing whatever else it had pending and detaching these drops from any
-- ledger write meant to be atomic with them. scripts/db-test.sh is safe (a
-- fresh `psql -f` per migration); an interactive paste mid-transaction, or a
-- wrapper that opens its own BEGIN, is not.
BEGIN;
SET LOCAL lock_timeout = '3s';

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

COMMIT;
