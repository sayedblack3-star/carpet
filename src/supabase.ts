import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

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

const AUTH_LOCK_RETRY_DELAY_MS = 120;
const AUTH_LOCK_MAX_RETRIES = 4;
let activeSessionRequest: Promise<Session | null> | null = null;
let cachedSession: Session | null = null;
let authStateHydrated = false;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isAuthLockContentionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /released because another request stole it|lock ".*" was released/i.test(message);
};

const readSessionOnce = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
};

const readSessionWithRetry = async (attempt = 0): Promise<Session | null> => {
  try {
    return await readSessionOnce();
  } catch (error) {
    if (attempt >= AUTH_LOCK_MAX_RETRIES || !isAuthLockContentionError(error)) {
      throw error;
    }

    await wait(AUTH_LOCK_RETRY_DELAY_MS * (attempt + 1));
    return readSessionWithRetry(attempt + 1);
  }
};

export const getSafeSession = async (): Promise<Session | null> => {
  if (authStateHydrated) {
    return cachedSession;
  }

  if (!activeSessionRequest) {
    activeSessionRequest = readSessionWithRetry()
      .then((session) => {
        cachedSession = session;
        authStateHydrated = true;
        return session;
      })
      .finally(() => {
        activeSessionRequest = null;
      });
  }

  return activeSessionRequest;
};

if (!supabaseConfigError) {
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedSession = session;
    authStateHydrated = true;
  });
}
