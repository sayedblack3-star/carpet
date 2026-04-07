import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

type UserRole = 'admin' | 'seller' | 'cashier';

type CreateUserPayload = {
  email?: string;
  password?: string;
  full_name?: string;
  role?: UserRole;
  branch_id?: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
const ROLE_SET = new Set<UserRole>(['admin', 'seller', 'cashier']);
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeEmail = (value: string) => normalizeText(value).toLowerCase();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });

const isMissingRelationError = (message: string) => /relation .* does not exist/i.test(message);

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const getSupabaseServerConfig = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url, serviceRoleKey };
};

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

    let payload: CreateUserPayload;
    try {
      payload = (await request.json()) as CreateUserPayload;
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const email = normalizeEmail(payload.email || '');
    const password = payload.password || '';
    const fullName = normalizeText(payload.full_name || '');
    const role = payload.role;
    const branchId = typeof payload.branch_id === 'string' ? normalizeText(payload.branch_id) : null;

    if (!email || !password || !fullName || !role) {
      return json({ error: 'Email, password, full name, and role are required.' }, 400);
    }

    if (!EMAIL_PATTERN.test(email)) {
      return json({ error: 'Please provide a valid email address.' }, 400);
    }

    if (!STRONG_PASSWORD_PATTERN.test(password)) {
      return json({ error: 'Password must be at least 10 characters and include uppercase, lowercase, and a number.' }, 400);
    }

    if (!ROLE_SET.has(role)) {
      return json({ error: 'Unsupported role.' }, 400);
    }

    const { url, serviceRoleKey } = getSupabaseServerConfig();
    const adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const {
      data: { user: actor },
      error: actorError,
    } = await adminClient.auth.getUser(accessToken);

    if (actorError || !actor) {
      return json({ error: 'Invalid session token.' }, 401);
    }

    const { data: actorProfile, error: actorProfileError } = await adminClient
      .from('profiles')
      .select('role, is_active, is_approved')
      .eq('id', actor.id)
      .maybeSingle();

    if (actorProfileError) {
      return json({ error: 'Unable to verify the current admin profile.' }, 500);
    }

    if (!actorProfile || actorProfile.role !== 'admin' || !actorProfile.is_active || !actorProfile.is_approved) {
      return json({ error: 'Only active approved admins can create users.' }, 403);
    }

    const { error: branchFeatureError } = await adminClient.from('branches').select('id').limit(1);
    const branchFeatureEnabled = !branchFeatureError;

    if (branchFeatureError && !isMissingRelationError(branchFeatureError.message)) {
      return json({ error: 'Unable to validate branch assignments.' }, 500);
    }

    let effectiveBranchId: string | null = null;
    if (role !== 'admin' && branchFeatureEnabled) {
      if (!branchId) {
        return json({ error: 'A branch is required for seller and cashier accounts.' }, 400);
      }

      const { data: branch, error: branchError } = await adminClient
        .from('branches')
        .select('id, is_active')
        .eq('id', branchId)
        .maybeSingle();

      if (branchError) {
        return json({ error: 'Unable to validate the selected branch.' }, 500);
      }

      if (!branch || branch.is_active === false) {
        return json({ error: 'The selected branch is invalid or inactive.' }, 400);
      }

      effectiveBranchId = branch.id;
    }

    const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createUserError || !createdUserData.user) {
      const message = createUserError?.message || 'Failed to create the auth user.';
      const status = /already registered|already exists|duplicate/i.test(message) ? 409 : 400;
      return json({ error: message }, status);
    }

    const createdUserId = createdUserData.user.id;
    const profilePayload = {
      id: createdUserId,
      email,
      full_name: fullName,
      role,
      branch_id: role === 'admin' ? null : effectiveBranchId,
      is_approved: false,
      is_active: true,
    };

    const { error: profileError } = await adminClient.from('profiles').upsert(profilePayload, { onConflict: 'id' });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(createdUserId);
      return json({ error: 'Failed to finalize the user profile.' }, 500);
    }

    return json(
      {
        user: {
          id: createdUserId,
          email,
          full_name: fullName,
          role,
          branch_id: profilePayload.branch_id,
          is_approved: false,
          is_active: true,
        },
      },
      201
    );
  } catch (error) {
    return json({ error: getErrorMessage(error, 'Unexpected server error.') }, 500);
  }
}
