import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const missingSupabaseEnv = [
  !supabaseUrl && 'VITE_SUPABASE_URL',
  !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean) as string[];

export const supabaseConfigError = missingSupabaseEnv.length
  ? `Missing Supabase environment variables: ${missingSupabaseEnv.join(', ')}`
  : null;

// The app shows a setup screen when config is missing, so this client is only used once env vars exist.
export const supabase: SupabaseClient = supabaseConfigError
  ? ({} as SupabaseClient)
  : createClient(supabaseUrl, supabaseAnonKey);
