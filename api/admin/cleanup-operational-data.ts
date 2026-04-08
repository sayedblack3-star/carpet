import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
};

const getSupabaseServerConfig = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url, anonKey, serviceRoleKey };
};

const createSupabaseServerClient = (url: string, key: string, accessToken?: string) =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });

const TABLES = ['order_items', 'orders', 'shortages', 'audit_logs', 'notifications', 'shifts'] as const;

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();

    if (!accessToken) {
      return json({ error: 'Missing authorization token.' }, 401);
    }

    const { url, anonKey, serviceRoleKey } = getSupabaseServerConfig();
    const adminClient = createSupabaseServerClient(url, serviceRoleKey);
    const actorClient = createSupabaseServerClient(url, anonKey, accessToken);

    const {
      data: { user: actor },
      error: actorError,
    } = await adminClient.auth.getUser(accessToken);

    if (actorError || !actor) {
      return json({ error: 'Invalid session token.' }, 401);
    }

    const { data: actorProfile, error: actorProfileError } = await actorClient
      .from('profiles')
      .select('role, is_active, is_approved')
      .eq('id', actor.id)
      .maybeSingle();

    if (actorProfileError) {
      return json({ error: 'Unable to verify the current admin profile.' }, 500);
    }

    if (!actorProfile || actorProfile.role !== 'admin' || !actorProfile.is_active || !actorProfile.is_approved) {
      return json({ error: 'Only active approved admins can clean operational data.' }, 403);
    }

    const results: Array<{ table: string; deleted: number | null }> = [];

    for (const table of TABLES) {
      const { count, error } = await adminClient.from(table).delete({ count: 'exact' }).not('id', 'is', null);
      if (error) {
        return json({ error: `Failed while cleaning ${table}: ${getErrorMessage(error, 'Unknown error.')}` }, 500);
      }

      results.push({
        table,
        deleted: count ?? null,
      });
    }

    return json({ cleaned: results }, 200);
  } catch (error) {
    return json({ error: getErrorMessage(error, 'Unexpected server error.') }, 500);
  }
}
