-- =============================================
-- CARPET LAND ERP - Full Database Migration
-- Run this in Supabase SQL Editor (Dashboard)
-- Safe to run multiple times (idempotent)
-- =============================================

-- 1. Helper function: get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- 2. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'seller',
  employee_code TEXT,
  is_approved BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns if missing
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_code TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  price_buy NUMERIC DEFAULT 0,
  price_sell_before NUMERIC NOT NULL DEFAULT 0,
  price_sell_after NUMERIC DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 5,
  product_image TEXT,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_image TEXT;
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_by UUID;
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_by UUID;
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. ORDER NUMBER SEQUENCE
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- 5. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number INTEGER DEFAULT nextval('order_number_seq'),
  seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  seller_name TEXT DEFAULT '',
  cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  total_original_price NUMERIC DEFAULT 0,
  total_final_price NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'sent_to_cashier',
  payment_status TEXT DEFAULT 'unpaid',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  sent_to_cashier_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ
);

-- Handle old column names
DO $$ BEGIN
  -- Add new columns
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT '';
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT '';
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sent_to_cashier_at TIMESTAMPTZ;
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
  -- Map old column names if they exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='salesperson_id' AND table_schema='public') THEN
    ALTER TABLE public.orders RENAME COLUMN salesperson_id TO seller_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='salesperson_name' AND table_schema='public') THEN
    ALTER TABLE public.orders RENAME COLUMN salesperson_name TO seller_name;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  message TEXT DEFAULT '',
  type TEXT DEFAULT 'system',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  entity_type TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. SHORTAGES TABLE
CREATE TABLE IF NOT EXISTS public.shortages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  product_code TEXT,
  notes TEXT,
  reported_by_id UUID,
  reported_by_name TEXT,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.shortages ADD COLUMN IF NOT EXISTS product_code TEXT;
  ALTER TABLE public.shortages ADD COLUMN IF NOT EXISTS reported_by_id UUID;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 10. SHIFTS TABLE (optional feature)
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ DEFAULT now(),
  end_time TIMESTAMPTZ,
  starting_cash NUMERIC DEFAULT 0,
  ending_cash NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- AUTO-CREATE PROFILE TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_approved, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'seller',
    false,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- RLS POLICIES (Drop all old, create new)
-- =============================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.profiles'; END LOOP;
END $$;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR public.get_user_role() = 'admin');
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (public.get_user_role() = 'admin' OR auth.uid() = id);
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (public.get_user_role() = 'admin');

-- PRODUCTS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'products' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.products'; END LOOP;
END $$;
CREATE POLICY "products_select" ON public.products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "products_insert" ON public.products FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "products_update" ON public.products FOR UPDATE USING (public.get_user_role() = 'admin');
CREATE POLICY "products_delete" ON public.products FOR DELETE USING (public.get_user_role() = 'admin');

-- ORDERS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'orders' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.orders'; END LOOP;
END $$;
CREATE POLICY "orders_select" ON public.orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "orders_insert" ON public.orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "orders_update" ON public.orders FOR UPDATE USING (
  public.get_user_role() = 'admin' OR public.get_user_role() = 'cashier' OR seller_id = auth.uid()
);

-- ORDER ITEMS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'order_items' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.order_items'; END LOOP;
END $$;
CREATE POLICY "items_select" ON public.order_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "items_insert" ON public.order_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "items_update" ON public.order_items FOR UPDATE USING (
  public.get_user_role() IN ('admin','cashier')
);
CREATE POLICY "items_delete" ON public.order_items FOR DELETE USING (
  public.get_user_role() IN ('admin','cashier')
);

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'notifications' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.notifications'; END LOOP;
END $$;
CREATE POLICY "notif_select" ON public.notifications FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- AUDIT LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'audit_logs' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.audit_logs'; END LOOP;
END $$;
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT USING (public.get_user_role() = 'admin');
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- SHORTAGES
ALTER TABLE public.shortages ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'shortages' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.shortages'; END LOOP;
END $$;
CREATE POLICY "short_select" ON public.shortages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "short_insert" ON public.shortages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "short_update" ON public.shortages FOR UPDATE USING (auth.uid() IS NOT NULL);

-- SHIFTS
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'shifts' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.shifts'; END LOOP;
END $$;
CREATE POLICY "shifts_select" ON public.shifts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "shifts_insert" ON public.shifts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "shifts_update" ON public.shifts FOR UPDATE USING (user_id = auth.uid() OR public.get_user_role() = 'admin');

-- =============================================
-- ENABLE REALTIME
-- =============================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- =============================================
-- PROMOTE ADMIN (update this email to yours)
-- =============================================
UPDATE public.profiles
SET role = 'admin', is_approved = true, is_active = true
WHERE email = 'sayed@carpetland.com';

-- Done! Your database is ready.
