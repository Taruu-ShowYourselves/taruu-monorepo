-- Drop orphaned Printful/POD columns from merch_orders.
-- POD fulfilment was removed (Printful service + fulfilment webhook deleted in
-- the same change); pod_order_id, tracking_number, tracking_url and carrier are
-- now permanently NULL. CONCERNS.md §1/§8. Revert: re-add as TEXT NULL columns.
ALTER TABLE public.merch_orders DROP COLUMN IF EXISTS pod_order_id;
ALTER TABLE public.merch_orders DROP COLUMN IF EXISTS tracking_number;
ALTER TABLE public.merch_orders DROP COLUMN IF EXISTS tracking_url;
ALTER TABLE public.merch_orders DROP COLUMN IF EXISTS carrier;
