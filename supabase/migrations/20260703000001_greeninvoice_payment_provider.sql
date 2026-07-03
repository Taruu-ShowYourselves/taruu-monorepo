-- Green Invoice Payment Provider Migration
--
-- Reverts the payment processor default from Paddle back to Green Invoice
-- (morning) as the merchant of record for vote fees. Green Invoice collects ILS
-- on a hosted payment page and issues a tax document on success; per-vote ILS is
-- accrued in the treasury ledger and batch-seeded into a Bags.fm bag at vote
-- resolution.
--
-- Supersedes 20250120000001_paddle_payment_provider.sql (Paddle is fully removed
-- from the application). Applied migrations are immutable, so this migration
-- resets the column default rather than editing the prior one.

-- New payments default to the 'green_invoice' provider.
ALTER TABLE payments ALTER COLUMN provider SET DEFAULT 'green_invoice';

-- Backfill is intentionally NOT applied: historical rows keep their original
-- provider value ('paddle' or 'green_invoice') for audit fidelity. New rows are
-- 'green_invoice'.

COMMENT ON COLUMN payments.provider IS 'Payment processor: ''green_invoice'' (current). ''paddle'' may appear on historical rows (legacy processor, removed).';
