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
const AUTH_QUERY_TIMEOUT_MS = 8000;
const AUTH_TRANSIENT_MAX_RETRIES = 2;
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
const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const isAuthLockContentionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /released because another request stole it|lock ".*" was released/i.test(message);
};

const isTransientAuthError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /network|fetch|connection|timeout|timed out|temporarily unavailable/i.test(message);
};

const readSessionOnce = async () => {
  const {
    data: { session },
    error,
  } = await withTimeout(supabase.auth.getSession(), AUTH_QUERY_TIMEOUT_MS, 'Timed out while reading the current session.');

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

const refreshSessionOnce = async () => {
  const {
    data: { session },
    error,
  } = await withTimeout(supabase.auth.refreshSession(), AUTH_QUERY_TIMEOUT_MS, 'Timed out while refreshing the current session.');

  if (error) {
    throw error;
  }

  return session;
};

const refreshSessionWithRetry = async (attempt = 0): Promise<Session | null> => {
  try {
    return await refreshSessionOnce();
  } catch (error) {
    if (attempt >= AUTH_TRANSIENT_MAX_RETRIES || !isTransientAuthError(error)) {
      throw error;
    }

    await wait(AUTH_LOCK_RETRY_DELAY_MS * (attempt + 1));
    return refreshSessionWithRetry(attempt + 1);
  }
};

const isSessionUsable = (session: Session | null) => {
  if (!session) return false;
  if (!session.expires_at) return true;
  return session.expires_at * 1000 > Date.now() + SESSION_EXPIRY_BUFFER_MS;
};

export const getSafeSession = async (): Promise<Session | null> => {
  if (!activeSessionRequest) {
    activeSessionRequest = (authStateHydrated && isSessionUsable(cachedSession) ? Promise.resolve(cachedSession) : readSessionWithRetry())
      .then(async (session) => {
        if (isSessionUsable(session)) {
          cachedSession = session;
          authStateHydrated = true;
          return session;
        }

        const refreshedSession = await refreshSessionWithRetry();
        cachedSession = refreshedSession;
        authStateHydrated = true;
        return refreshedSession;
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
