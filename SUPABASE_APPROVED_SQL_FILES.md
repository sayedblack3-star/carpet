# Supabase Approved SQL Files

Use only these SQL files for the current approved backend setup:

1. `supabase_migration.sql`
2. `supabase_orders_compat_fix.sql`
3. `supabase_branch_isolation.sql`
4. `supabase_profiles_timeout_fix.sql`
5. `supabase_security_hardening.sql`
6. `add_product_size_fields.sql` (only when product sizing is needed)
7. `import_products.sql` (optional sample/product import)

## Do not run

Do **not** use any SQL file from:

- `sql-legacy-dangerous/`

These files were archived because they are unsafe or outdated for the current system.

Examples of problems in archived files:
- permissive RLS like `USING (true)` or `WITH CHECK (true)`
- references to older schema shapes such as `public.users`
- compatibility logic that can weaken the current security model

## Rule for new client setup

If you are preparing a new client backend:
- follow `SUPABASE_NEW_CLIENT_SETUP.md`
- use only the approved SQL files listed above
- ignore everything inside `sql-legacy-dangerous/`
