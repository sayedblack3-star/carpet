# Archived Legacy SQL

The SQL files in this folder are archived on purpose.

They are **not** part of the approved setup path for new Supabase projects.

Why they were archived:
- some of them contain overly broad RLS policies such as `USING (true)` / `WITH CHECK (true)`
- some target an older schema shape such as `public.users`
- some can weaken the current branch isolation and security model if run by mistake

Do not use these files for:
- new client setup
- production hardening
- rebuilding the current backend

Use the documented setup path in:
- `SUPABASE_NEW_CLIENT_SETUP.md`

Archived files:
- `fix_delete_cascade.sql`
- `fix_users_table.sql`
- `schema_update.sql`
