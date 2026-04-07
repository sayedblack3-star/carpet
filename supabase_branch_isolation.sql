-- ==========================================================
-- Carpet Land - Branch Isolation and Branch Access
-- Run this in Supabase SQL Editor after the base migration.
-- This script is idempotent and safe to run more than once.
-- ==========================================================

-- 1. Branches table
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS branches_name_unique_idx ON public.branches(name);
CREATE UNIQUE INDEX IF NOT EXISTS branches_slug_unique_idx ON public.branches(slug);

-- 2. Seed 9 branches
INSERT INTO public.branches (name, slug)
VALUES
  ('فرع الشيخ زايد داخل سوق المرشدي', 'branch-01'),
  ('فرع مصر والسودان حدايق القبه', 'branch-02'),
  ('فرع الحلميه الجديده امام الاداره العليميه', 'branch-03'),
  ('فرع المقطم 2 مساكن اطلس', 'branch-04'),
  ('فرع التجمع الاول اعلى لولو ماركت', 'branch-05'),
  ('فرع العبور بداخل مول التقوى والنور', 'branch-06'),
  ('فرع جسر السويس مصر الجديده', 'branch-07'),
  ('فرع المقطم شارع 9', 'branch-08'),
  ('فرع التجمع الخامس', 'branch-09')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  is_active = true;

-- 3. Add branch references
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.shortages
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- 4. Helper to get current branch
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 5. Cleanup from older branch-password version if it existed
ALTER TABLE public.branches
  DROP COLUMN IF EXISTS access_code;

DROP FUNCTION IF EXISTS public.verify_branch_access(UUID, TEXT);

-- 6. Enable RLS on branches
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'branches'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.branches';
  END LOOP;
END $$;

CREATE POLICY "branches_select" ON public.branches
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "branches_manage" ON public.branches
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

-- 7. Profiles policies with branch isolation
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.profiles';
  END LOOP;
END $$;

CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT
USING (
  public.get_user_role() = 'admin'
  OR auth.uid() = id
  OR branch_id = public.get_user_branch_id()
);

CREATE POLICY "profiles_insert" ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id OR public.get_user_role() = 'admin');

CREATE POLICY "profiles_update_admin" ON public.profiles
FOR UPDATE
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "profiles_update_self" ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete" ON public.profiles
FOR DELETE
USING (public.get_user_role() = 'admin');

-- 8. Orders policies with branch isolation
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.orders';
  END LOOP;
END $$;

CREATE POLICY "orders_select" ON public.orders
FOR SELECT
USING (
  public.get_user_role() = 'admin'
  OR branch_id = public.get_user_branch_id()
);

CREATE POLICY "orders_insert" ON public.orders
FOR INSERT
WITH CHECK (
  public.get_user_role() = 'admin'
  OR (auth.uid() IS NOT NULL AND branch_id = public.get_user_branch_id())
);

CREATE POLICY "orders_update" ON public.orders
FOR UPDATE
USING (
  public.get_user_role() = 'admin'
  OR (
    branch_id = public.get_user_branch_id()
    AND (
      public.get_user_role() = 'cashier'
      OR salesperson_id = auth.uid()
    )
  )
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR branch_id = public.get_user_branch_id()
);

-- 9. Order items policies scoped through parent order
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_items'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.order_items';
  END LOOP;
END $$;

CREATE POLICY "items_select" ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND (
        public.get_user_role() = 'admin'
        OR orders.branch_id = public.get_user_branch_id()
      )
  )
);

CREATE POLICY "items_insert" ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND (
        public.get_user_role() = 'admin'
        OR orders.branch_id = public.get_user_branch_id()
      )
  )
);

CREATE POLICY "items_update" ON public.order_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND (
        public.get_user_role() = 'admin'
        OR (
          orders.branch_id = public.get_user_branch_id()
          AND public.get_user_role() = 'cashier'
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND (
        public.get_user_role() = 'admin'
        OR (
          orders.branch_id = public.get_user_branch_id()
          AND public.get_user_role() = 'cashier'
        )
      )
  )
);

CREATE POLICY "items_delete" ON public.order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND (
        public.get_user_role() = 'admin'
        OR (
          orders.branch_id = public.get_user_branch_id()
          AND public.get_user_role() = 'cashier'
        )
      )
  )
);

-- 10. Shortages policies with branch isolation
ALTER TABLE public.shortages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shortages'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.shortages';
  END LOOP;
END $$;

CREATE POLICY "shortages_select" ON public.shortages
FOR SELECT
USING (
  public.get_user_role() = 'admin'
  OR branch_id = public.get_user_branch_id()
);

CREATE POLICY "shortages_insert" ON public.shortages
FOR INSERT
WITH CHECK (
  public.get_user_role() = 'admin'
  OR branch_id = public.get_user_branch_id()
);

CREATE POLICY "shortages_update" ON public.shortages
FOR UPDATE
USING (
  public.get_user_role() = 'admin'
  OR branch_id = public.get_user_branch_id()
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR branch_id = public.get_user_branch_id()
);

-- 11. Shifts policies with branch isolation
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shifts'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.shifts';
  END LOOP;
END $$;

CREATE POLICY "shifts_select" ON public.shifts
FOR SELECT
USING (
  public.get_user_role() = 'admin'
  OR branch_id = public.get_user_branch_id()
);

CREATE POLICY "shifts_insert" ON public.shifts
FOR INSERT
WITH CHECK (
  public.get_user_role() = 'admin'
  OR (auth.uid() IS NOT NULL AND branch_id = public.get_user_branch_id())
);

CREATE POLICY "shifts_update" ON public.shifts
FOR UPDATE
USING (
  public.get_user_role() = 'admin'
  OR (
    branch_id = public.get_user_branch_id()
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR branch_id = public.get_user_branch_id()
);

-- 12. Realtime and schema refresh
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.branches;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';

-- IMPORTANT:
-- Branch isolation now depends on:
-- 1. Assigning each seller/cashier to branch_id in profiles
-- 2. RLS policies that only expose data from the assigned branch
