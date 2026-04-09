import { processLock } from '@supabase/auth-js';
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

const AUTH_LOCK_RETRY_DELAY_MS = 120;
const AUTH_LOCK_MAX_RETRIES = 4;
// The app shows a setup screen when config is missing, so this client is only used once env vars exist.
export const supabase: SupabaseClient = supabaseConfigError
  ? ({} as SupabaseClient)
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Use an in-process queue instead of the browser Navigator Lock API to
        // prevent startup request storms from stealing the shared auth lock.
        lock: processLock,
      },
    });

let activeSessionRequest: Promise<Session | null> | null = null;
let cachedSession: Session | null = null;
let authStateHydrated = false;
const SESSION_EXPIRY_BUFFER_MS = 45 * 1000;

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

const isSessionUsable = (session: Session | null) => {
  if (!session) return false;
  if (!session.expires_at) return true;
  return session.expires_at * 1000 > Date.now() + SESSION_EXPIRY_BUFFER_MS;
};

export const getSafeSession = async (): Promise<Session | null> => {
  if (authStateHydrated && isSessionUsable(cachedSession)) {
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
