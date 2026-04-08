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

type ProfileRecord = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  branch_id: string | null;
  is_approved: boolean;
  is_active: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
const ROLE_SET = new Set<UserRole>(['admin', 'seller', 'cashier']);
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};
const CORS_ALLOWED_ORIGINS = new Set([
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
  'https://carpet-rbnd.vercel.app',
]);

const getCorsHeaders = (request: Request) => {
  const origin = request.headers.get('origin')?.trim();
  const allowOrigin = origin && CORS_ALLOWED_ORIGINS.has(origin) ? origin : '*';

  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
};

const buildHeaders = (request: Request, headers: Record<string, string> = {}) => ({
  ...getCorsHeaders(request),
  ...headers,
});

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeEmail = (value: string) => normalizeText(value).toLowerCase();

const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: buildHeaders(request, JSON_HEADERS),
  });

const empty = (request: Request, status = 204) =>
  new Response(null, {
    status,
    headers: buildHeaders(request),
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

const finalizeProfileRecord = async (adminClient: ReturnType<typeof createSupabaseServerClient>, profile: ProfileRecord) => {
  const updatePayload = {
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    branch_id: profile.branch_id,
    is_approved: profile.is_approved,
    is_active: profile.is_active,
  };

  const { data: updatedProfiles, error: updateError } = await adminClient
    .from('profiles')
    .update(updatePayload)
    .eq('id', profile.id)
    .select('id')
    .limit(1);

  if (updateError) {
    return { error: updateError };
  }

  if ((updatedProfiles || []).length > 0) {
    return { error: null };
  }

  const { error: insertError } = await adminClient.from('profiles').insert(profile);
  return { error: insertError };
};

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return empty(request);
  }

  if (request.method !== 'POST') {
    return json(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();

    if (!accessToken) {
      return json(request, { error: 'Missing authorization token.' }, 401);
    }

    let payload: CreateUserPayload;
    try {
      payload = (await request.json()) as CreateUserPayload;
    } catch {
      return json(request, { error: 'Invalid JSON body.' }, 400);
    }

    const email = normalizeEmail(payload.email || '');
    const password = payload.password || '';
    const fullName = normalizeText(payload.full_name || '');
    const role = payload.role;
    const branchId = typeof payload.branch_id === 'string' ? normalizeText(payload.branch_id) : null;

    if (!email || !password || !fullName || !role) {
      return json(request, { error: 'Email, password, full name, and role are required.' }, 400);
    }

    if (!EMAIL_PATTERN.test(email)) {
      return json(request, { error: 'Please provide a valid email address.' }, 400);
    }

    if (!STRONG_PASSWORD_PATTERN.test(password)) {
      return json(request, { error: 'Password must be at least 10 characters and include uppercase, lowercase, and a number.' }, 400);
    }

    if (!ROLE_SET.has(role)) {
      return json(request, { error: 'Unsupported role.' }, 400);
    }

    const { url, serviceRoleKey } = getSupabaseServerConfig();
    const adminClient = createSupabaseServerClient(url, serviceRoleKey);
    const actorClient = createSupabaseServerClient(url, serviceRoleKey, accessToken);

    const {
      data: { user: actor },
      error: actorError,
    } = await adminClient.auth.getUser(accessToken);

    if (actorError || !actor) {
      return json(request, { error: 'Invalid session token.' }, 401);
    }

    const { data: actorProfile, error: actorProfileError } = await actorClient
      .from('profiles')
      .select('role, is_active, is_approved')
      .eq('id', actor.id)
      .maybeSingle();

    if (actorProfileError) {
      console.error('Admin profile verification failed:', actorProfileError.message);
      return json(request, { error: 'Unable to verify the current admin profile.' }, 500);
    }

    if (!actorProfile || actorProfile.role !== 'admin' || !actorProfile.is_active || !actorProfile.is_approved) {
      return json(request, { error: 'Only active approved admins can create users.' }, 403);
    }

    const { error: branchFeatureError } = await actorClient.from('branches').select('id').limit(1);
    const branchFeatureEnabled = !branchFeatureError;

    if (branchFeatureError && !isMissingRelationError(branchFeatureError.message)) {
      console.error('Branch feature verification failed:', branchFeatureError.message);
      return json(request, { error: 'Unable to validate branch assignments.' }, 500);
    }

    let effectiveBranchId: string | null = null;
    if (role !== 'admin' && branchFeatureEnabled) {
      if (!branchId) {
        return json(request, { error: 'A branch is required for seller and cashier accounts.' }, 400);
      }

      const { data: branch, error: branchError } = await actorClient
        .from('branches')
        .select('id, is_active')
        .eq('id', branchId)
        .maybeSingle();

      if (branchError) {
        return json(request, { error: 'Unable to validate the selected branch.' }, 500);
      }

      if (!branch || branch.is_active === false) {
        return json(request, { error: 'The selected branch is invalid or inactive.' }, 400);
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
      return json(request, { error: message }, status);
    }

    const createdUserId = createdUserData.user.id;
    const profilePayload: ProfileRecord = {
      id: createdUserId,
      email,
      full_name: fullName,
      role,
      branch_id: role === 'admin' ? null : effectiveBranchId,
      is_approved: false,
      is_active: true,
    };

    const { error: profileError } = await finalizeProfileRecord(adminClient, profilePayload);

    if (profileError) {
      console.error('Profile finalization failed:', profileError.message);
      await adminClient.auth.admin.deleteUser(createdUserId);
      return json(request, { error: getErrorMessage(profileError, 'Failed to finalize the user profile.') }, 500);
    }

    return json(
      request,
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
    return json(request, { error: getErrorMessage(error, 'Unexpected server error.') }, 500);
  }
}
