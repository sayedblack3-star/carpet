-- =============================================
-- Carpet Land ERP - Orders Compatibility Fix
-- Purpose:
--   Align the live Supabase "orders" table with the current frontend code.
-- Safe to run multiple times.
-- =============================================

BEGIN;

-- Keep the current app contract:
-- The frontend still uses salesperson_id / salesperson_name.
-- Do NOT rename them to seller_id / seller_name here.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS salesperson_name TEXT DEFAULT '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS total_original_price NUMERIC DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS total_final_price NUMERIC DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sent_to_cashier_at TIMESTAMPTZ;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

ALTER TABLE public.orders
  ALTER COLUMN status SET DEFAULT 'sent_to_cashier';

ALTER TABLE public.orders
  ALTER COLUMN payment_status SET DEFAULT 'unpaid';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'draft',
    'sent_to_cashier',
    'under_review',
    'confirmed',
    'cancelled'
  ));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN (
    'unpaid',
    'paid',
    'partial'
  ));

COMMIT;

NOTIFY pgrst, 'reload schema';
