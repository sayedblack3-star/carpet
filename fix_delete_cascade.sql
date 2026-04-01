-- Fix constraints to allow deleting users even if they have related data
-- We will set the foreign keys to ON DELETE SET NULL
-- This means if we delete a user, their records remain but the user_id becomes null (preserving history)

-- 1. Drops current constraints to avoid conflicts
ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_salesperson_id_fkey";
ALTER TABLE "public"."shifts" DROP CONSTRAINT IF EXISTS "shifts_user_id_fkey";
ALTER TABLE "public"."audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";

-- 2. Re-create them with ON DELETE SET NULL
-- For Orders
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_salesperson_id_fkey" 
    FOREIGN KEY ("salesperson_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;

-- For Shifts
ALTER TABLE "public"."shifts" ADD CONSTRAINT "shifts_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;

-- For Audit Logs
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;

-- 3. Also ensure that deleting from auth.users (if it exists) doesn't break public.users
-- This is handled by the trigger or by keeping public.users independent as seen in fix_users_table.sql

-- 4. Ensure RLS policies allow deletion
-- Some databases have RLS enabled which prevents deletion even if the query returns success (0 rows affected)
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to delete from users" ON "public"."users";
CREATE POLICY "Allow all users to delete from users" ON "public"."users"
    FOR DELETE USING (true); -- Note: In production you should limit this to admin users only

DROP POLICY IF EXISTS "Allow all users to read users" ON "public"."users";
CREATE POLICY "Allow all users to read users" ON "public"."users"
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all users to insert users" ON "public"."users";
CREATE POLICY "Allow all users to insert users" ON "public"."users"
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all users to update users" ON "public"."users";
CREATE POLICY "Allow all users to update users" ON "public"."users"
    FOR UPDATE USING (true);
