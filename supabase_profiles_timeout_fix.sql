-- ==========================================================
-- Carpet Land - Profiles/RLS timeout mitigation
-- Run this in Supabase SQL Editor if profile loading stays slow.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT branch_id
  FROM public.profiles
  WHERE id = auth.uid()
$$;

CREATE INDEX IF NOT EXISTS profiles_branch_id_idx ON public.profiles(branch_id);
CREATE INDEX IF NOT EXISTS orders_branch_id_idx ON public.orders(branch_id);
CREATE INDEX IF NOT EXISTS shortages_branch_id_idx ON public.shortages(branch_id);
CREATE INDEX IF NOT EXISTS shifts_branch_id_idx ON public.shifts(branch_id);

NOTIFY pgrst, 'reload schema';
