-- Enable Row Level Security on merch_orders.
-- The table is written/read ONLY server-side via the service role (which bypasses
-- RLS), so enabling RLS with no policies denies the public anon key entirely —
-- closing the shipping-address PII exposure flagged in SECURITY-AUDIT.md without
-- breaking any app path. Revert: ALTER TABLE public.merch_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY;
