-- Fix: Remove FK constraint from auth.users so admin can pre-register users
-- We keep id as UUID primary key but remove the auth.users reference

-- Drop the FK to auth.users only (not the PK)
ALTER TABLE "public"."users" DROP CONSTRAINT IF EXISTS "users_id_fkey";

-- Make id auto-generate if not provided
ALTER TABLE "public"."users" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
