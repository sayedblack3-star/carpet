-- =============================================
-- Carpet Land ERP - Security Hardening
-- Run after the main schema migrations.
-- This file tightens RLS around the current app behavior.
-- =============================================

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_user_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION public.user_branch_matches(target_branch UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR target_branch = public.get_user_branch_id()
$$;

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.profiles'; END LOOP;
END $$;

CREATE POLICY "profiles_select_strict" ON public.profiles
FOR SELECT
USING (
  public.is_admin()
  OR auth.uid() = id
);

CREATE POLICY "profiles_insert_strict" ON public.profiles
FOR INSERT
WITH CHECK (
  public.is_admin()
  OR auth.uid() = id
);

CREATE POLICY "profiles_update_admin" ON public.profiles
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "profiles_update_self_limited" ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  AND is_approved = (SELECT is_approved FROM public.profiles WHERE id = auth.uid())
  AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
  AND branch_id IS NOT DISTINCT FROM (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "profiles_delete_admin" ON public.profiles
FOR DELETE
USING (public.is_admin());

-- BRANCHES
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'branches'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.branches'; END LOOP;
END $$;

CREATE POLICY "branches_select_assigned" ON public.branches
FOR SELECT
USING (
  public.is_admin()
  OR id = public.get_user_branch_id()
);

CREATE POLICY "branches_manage_admin" ON public.branches
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- PRODUCTS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.products'; END LOOP;
END $$;

CREATE POLICY "products_select_authenticated" ON public.products
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "products_manage_admin" ON public.products
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ORDERS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.orders'; END LOOP;
END $$;

CREATE POLICY "orders_select_strict" ON public.orders
FOR SELECT
USING (
  public.is_admin()
  OR salesperson_id = auth.uid()
  OR (public.get_user_role() = 'cashier' AND public.user_branch_matches(branch_id))
);

CREATE POLICY "orders_insert_strict" ON public.orders
FOR INSERT
WITH CHECK (
  public.is_admin()
  OR (
    auth.uid() IS NOT NULL
    AND salesperson_id = auth.uid()
    AND public.user_branch_matches(branch_id)
  )
);

CREATE POLICY "orders_update_strict" ON public.orders
FOR UPDATE
USING (
  public.is_admin()
  OR (
    public.get_user_role() = 'cashier'
    AND public.user_branch_matches(branch_id)
  )
  OR salesperson_id = auth.uid()
)
WITH CHECK (
  public.is_admin()
  OR (
    public.get_user_role() = 'cashier'
    AND public.user_branch_matches(branch_id)
  )
  OR (
    salesperson_id = auth.uid()
    AND public.user_branch_matches(branch_id)
  )
);

-- ORDER ITEMS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'order_items'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.order_items'; END LOOP;
END $$;

CREATE POLICY "order_items_select_strict" ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND (
        public.is_admin()
        OR orders.salesperson_id = auth.uid()
        OR (public.get_user_role() = 'cashier' AND public.user_branch_matches(orders.branch_id))
      )
  )
);

CREATE POLICY "order_items_insert_strict" ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND (
        public.is_admin()
        OR orders.salesperson_id = auth.uid()
        OR (public.get_user_role() = 'cashier' AND public.user_branch_matches(orders.branch_id))
      )
  )
);

CREATE POLICY "order_items_update_strict" ON public.order_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND (
        public.is_admin()
        OR (public.get_user_role() = 'cashier' AND public.user_branch_matches(orders.branch_id))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND (
        public.is_admin()
        OR (public.get_user_role() = 'cashier' AND public.user_branch_matches(orders.branch_id))
      )
  )
);

CREATE POLICY "order_items_delete_strict" ON public.order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND (
        public.is_admin()
        OR (public.get_user_role() = 'cashier' AND public.user_branch_matches(orders.branch_id))
      )
  )
);

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.notifications'; END LOOP;
END $$;

CREATE POLICY "notifications_select_strict" ON public.notifications
FOR SELECT
USING (
  public.is_admin()
  OR receiver_id = auth.uid()
  OR sender_id = auth.uid()
);

CREATE POLICY "notifications_insert_strict" ON public.notifications
FOR INSERT
WITH CHECK (
  public.is_admin()
  OR sender_id = auth.uid()
);

-- AUDIT LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_logs'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.audit_logs'; END LOOP;
END $$;

CREATE POLICY "audit_select_admin" ON public.audit_logs
FOR SELECT
USING (public.is_admin());

CREATE POLICY "audit_insert_authenticated" ON public.audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- SHORTAGES
ALTER TABLE public.shortages ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shortages'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.shortages'; END LOOP;
END $$;

CREATE POLICY "shortages_select_strict" ON public.shortages
FOR SELECT
USING (
  public.is_admin()
  OR public.user_branch_matches(branch_id)
);

CREATE POLICY "shortages_insert_strict" ON public.shortages
FOR INSERT
WITH CHECK (
  public.is_admin()
  OR public.user_branch_matches(branch_id)
);

CREATE POLICY "shortages_update_strict" ON public.shortages
FOR UPDATE
USING (
  public.is_admin()
  OR public.user_branch_matches(branch_id)
)
WITH CHECK (
  public.is_admin()
  OR public.user_branch_matches(branch_id)
);

-- SHIFTS
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shifts'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.shifts'; END LOOP;
END $$;

CREATE POLICY "shifts_select_strict" ON public.shifts
FOR SELECT
USING (
  public.is_admin()
  OR user_id = auth.uid()
);

CREATE POLICY "shifts_insert_strict" ON public.shifts
FOR INSERT
WITH CHECK (
  public.is_admin()
  OR (
    user_id = auth.uid()
    AND public.user_branch_matches(branch_id)
  )
);

CREATE POLICY "shifts_update_strict" ON public.shifts
FOR UPDATE
USING (
  public.is_admin()
  OR user_id = auth.uid()
)
WITH CHECK (
  public.is_admin()
  OR user_id = auth.uid()
);

-- Recommended operational note:
-- Disable public signups in Supabase Auth settings before production.
