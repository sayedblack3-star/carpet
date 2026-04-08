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

type DeleteUserPayload = {
  user_id?: string;
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
    'access-control-allow-methods': 'POST, DELETE, OPTIONS',
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

const isSchemaCompatibilityError = (error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null }) => {
  const combined = [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    isMissingRelationError(error.message || '') ||
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    combined.includes('schema cache') ||
    combined.includes('could not find') ||
    combined.includes('column')
  );
};

const isPermissionDeniedError = (error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null }) => {
  const combined = [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return error.code === '42501' || combined.includes('permission denied');
};

const isReferenceConstraintError = (error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null }) => {
  const combined = [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return error.code === '23503' || combined.includes('foreign key') || combined.includes('still referenced');
};

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

  if (!url || !serviceRoleKey || !anonKey) {
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

const ensureAdminActor = async (
  adminClient: ReturnType<typeof createSupabaseServerClient>,
  actorClient: ReturnType<typeof createSupabaseServerClient>,
  accessToken: string,
) => {
  const {
    data: { user: actor },
    error: actorError,
  } = await adminClient.auth.getUser(accessToken);

  if (actorError || !actor) {
    return { actor: null, actorProfile: null, response: { error: 'Invalid session token.', status: 401 } };
  }

  const { data: actorProfile, error: actorProfileError } = await actorClient
    .from('profiles')
    .select('role, is_active, is_approved')
    .eq('id', actor.id)
    .maybeSingle();

  if (actorProfileError) {
    console.error('Admin profile verification failed:', actorProfileError.message);
    return { actor: null, actorProfile: null, response: { error: 'Unable to verify the current admin profile.', status: 500 } };
  }

  if (!actorProfile || actorProfile.role !== 'admin' || !actorProfile.is_active || !actorProfile.is_approved) {
    return { actor: null, actorProfile: null, response: { error: 'Only active approved admins can manage users.', status: 403 } };
  }

  return { actor, actorProfile, response: null };
};

const cleanupUserReferences = async (adminClient: ReturnType<typeof createSupabaseServerClient>, userId: string) => {
  const nullify = async (table: string, column: string) => {
    const { error } = await adminClient.from(table).update({ [column]: null }).eq(column, userId);
    if (error && !isSchemaCompatibilityError(error) && !isPermissionDeniedError(error)) {
      throw error;
    }
  };

  const removeRows = async (table: string, column: string) => {
    const { error } = await adminClient.from(table).delete().eq(column, userId);
    if (error && !isSchemaCompatibilityError(error) && !isPermissionDeniedError(error)) {
      throw error;
    }
  };

  await nullify('audit_logs', 'user_id');
  await nullify('shortages', 'reported_by_id');
  await nullify('orders', 'cashier_id');
  await removeRows('notifications', 'sender_id');
  await removeRows('notifications', 'receiver_id');
  await removeRows('shifts', 'user_id');
};

const finalizeProfileRecord = async (profileClient: ReturnType<typeof createSupabaseServerClient>, profile: ProfileRecord) => {
  const updatePayload = {
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    branch_id: profile.branch_id,
    is_approved: profile.is_approved,
    is_active: profile.is_active,
  };

  const { data: updatedProfiles, error: updateError } = await profileClient
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

  const { error: insertError } = await profileClient.from('profiles').insert(profile);
  return { error: insertError };
};

const readActorRest = async <T>(url: string, anonKey: string, accessToken: string) => {
  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const text = await response.text();
  let payload: T | { message?: string } | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as T;
    } catch {
      payload = { message: text };
    }
  }

  if (response.ok) {
    return { data: payload, error: null };
  }

  const message =
    payload && typeof payload === 'object' && 'message' in payload && typeof (payload as { message?: unknown }).message === 'string'
      ? (payload as { message: string }).message
      : `Supabase REST request failed with status ${response.status}.`;

  return { data: null, error: new Error(message) };
};

const loadManagedUserProfile = async (
  url: string,
  anonKey: string,
  accessToken: string,
  actorClient: ReturnType<typeof createSupabaseServerClient>,
  adminClient: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
) => {
  const actorRestResult = await readActorRest<Array<Pick<ProfileRecord, 'id' | 'email' | 'role'>>>(
    `${url}/rest/v1/profiles?select=id,email,role&id=eq.${encodeURIComponent(userId)}&limit=1`,
    anonKey,
    accessToken,
  );

  if (!actorRestResult.error) {
    return { data: actorRestResult.data?.[0] || null, error: null };
  }

  const actorResult = await actorClient
    .from('profiles')
    .select('id, email, role')
    .eq('id', userId)
    .maybeSingle();

  if (actorResult.data || !actorResult.error) {
    return actorResult;
  }

  const adminResult = await adminClient
    .from('profiles')
    .select('id, email, role')
    .eq('id', userId)
    .maybeSingle();

  if (adminResult.data || !adminResult.error) {
    return adminResult;
  }

  return actorResult;
};

const hasSellerOrderHistory = async (
  url: string,
  anonKey: string,
  accessToken: string,
  actorClient: ReturnType<typeof createSupabaseServerClient>,
  adminClient: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
) => {
  const actorRestResult = await readActorRest<Array<{ id: string }>>(
    `${url}/rest/v1/orders?select=id&salesperson_id=eq.${encodeURIComponent(userId)}&limit=1`,
    anonKey,
    accessToken,
  );

  if (!actorRestResult.error) {
    return { hasHistory: (actorRestResult.data || []).length > 0, error: null };
  }

  const actorResult = await actorClient
    .from('orders')
    .select('id')
    .eq('salesperson_id', userId)
    .limit(1);

  if (!actorResult.error) {
    return { hasHistory: (actorResult.data || []).length > 0, error: null };
  }

  const adminResult = await adminClient
    .from('orders')
    .select('id')
    .eq('salesperson_id', userId)
    .limit(1);

  if (!adminResult.error) {
    return { hasHistory: (adminResult.data || []).length > 0, error: null };
  }

  return { hasHistory: false, error: actorResult.error };
};

const hasAnotherActiveApprovedAdmin = async (
  url: string,
  anonKey: string,
  accessToken: string,
  actorClient: ReturnType<typeof createSupabaseServerClient>,
  adminClient: ReturnType<typeof createSupabaseServerClient>,
  excludedUserId: string,
) => {
  const actorRestResult = await readActorRest<Array<{ id: string }>>(
    `${url}/rest/v1/profiles?select=id&role=eq.admin&is_active=eq.true&is_approved=eq.true&id=neq.${encodeURIComponent(excludedUserId)}&limit=1`,
    anonKey,
    accessToken,
  );

  if (!actorRestResult.error) {
    return { hasAnotherAdmin: (actorRestResult.data || []).length > 0, error: null };
  }

  const actorResult = await actorClient
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true)
    .eq('is_approved', true)
    .neq('id', excludedUserId)
    .limit(1);

  if (!actorResult.error) {
    return { hasAnotherAdmin: (actorResult.data || []).length > 0, error: null };
  }

  const adminResult = await adminClient
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true)
    .eq('is_approved', true)
    .neq('id', excludedUserId)
    .limit(1);

  if (!adminResult.error) {
    return { hasAnotherAdmin: (adminResult.data || []).length > 0, error: null };
  }

  return { hasAnotherAdmin: false, error: actorResult.error };
};

const deleteManagedProfile = async (
  url: string,
  anonKey: string,
  accessToken: string,
  actorClient: ReturnType<typeof createSupabaseServerClient>,
  adminClient: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
) => {
  const actorRestDelete = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'return=minimal',
    },
  });

  if (actorRestDelete.ok) {
    return { error: null };
  }

  const actorResult = await actorClient.from('profiles').delete().eq('id', userId);
  if (!actorResult.error) {
    return { error: null };
  }

  const adminResult = await adminClient.from('profiles').delete().eq('id', userId);
  return { error: adminResult.error || actorResult.error };
};

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return empty(request);
  }

  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return json(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();

    if (!accessToken) {
      return json(request, { error: 'Missing authorization token.' }, 401);
    }

    let payload: CreateUserPayload | DeleteUserPayload;
    try {
      payload = (await request.json()) as CreateUserPayload | DeleteUserPayload;
    } catch {
      return json(request, { error: 'Invalid JSON body.' }, 400);
    }

    const { url, anonKey, serviceRoleKey } = getSupabaseServerConfig();
    const adminClient = createSupabaseServerClient(url, serviceRoleKey);
    const actorClient = createSupabaseServerClient(url, anonKey, accessToken);
    const { actor, response } = await ensureAdminActor(adminClient, actorClient, accessToken);
    if (response) {
      return json(request, { error: response.error }, response.status);
    }

    if (request.method === 'DELETE') {
      const targetUserId = normalizeText((payload as DeleteUserPayload).user_id || '');
      if (!targetUserId) {
        return json(request, { error: 'User id is required.' }, 400);
      }

      if (targetUserId === actor?.id) {
        return json(request, { error: 'You cannot delete the currently signed-in admin.' }, 400);
      }

      const { data: targetProfile, error: targetProfileError } = await loadManagedUserProfile(
        url,
        anonKey,
        accessToken,
        actorClient,
        adminClient,
        targetUserId,
      );

      if (targetProfileError) {
        console.error('Managed profile lookup failed:', targetProfileError.message);
        return json(request, { error: 'Unable to load the selected user profile.' }, 500);
      }

      if (!targetProfile) {
        return json(request, { error: 'The selected user could not be found.' }, 404);
      }

      if (targetProfile.role === 'admin') {
        const { hasAnotherAdmin, error: adminCountError } = await hasAnotherActiveApprovedAdmin(
          url,
          anonKey,
          accessToken,
          actorClient,
          adminClient,
          targetUserId,
        );

        if (adminCountError) {
          console.error('Remaining admin validation failed:', adminCountError.message);
          return json(request, { error: 'Unable to validate the remaining admin accounts.' }, 500);
        }

        if (!hasAnotherAdmin) {
          return json(request, { error: 'At least one active approved admin account must remain.' }, 409);
        }
      }

      const { hasHistory: salespersonOrderHistory, error: salespersonOrdersError } = await hasSellerOrderHistory(
        url,
        anonKey,
        accessToken,
        actorClient,
        adminClient,
        targetUserId,
      );

      if (salespersonOrdersError) {
        console.error('Seller history lookup failed:', salespersonOrdersError.message);
        return json(request, { error: 'Unable to verify seller order history for this user.' }, 500);
      }

      if (salespersonOrderHistory) {
        return json(request, { error: 'This user has sales history. Deactivate the account instead of deleting it.' }, 409);
      }

      try {
        let { error: profileDeleteError } = await deleteManagedProfile(
          url,
          anonKey,
          accessToken,
          actorClient,
          adminClient,
          targetUserId,
        );

        if (profileDeleteError && isReferenceConstraintError(profileDeleteError)) {
          await cleanupUserReferences(adminClient, targetUserId);
          ({ error: profileDeleteError } = await deleteManagedProfile(
            url,
            anonKey,
            accessToken,
            actorClient,
            adminClient,
            targetUserId,
          ));
        }

        if (profileDeleteError) {
          throw profileDeleteError;
        }

        const { error: deleteAuthUserError } = await adminClient.auth.admin.deleteUser(targetUserId);
        if (deleteAuthUserError) {
          throw deleteAuthUserError;
        }

        return json(request, { success: true, user_id: targetUserId }, 200);
      } catch (error) {
        return json(request, { error: getErrorMessage(error, 'Failed to delete the selected user.') }, 500);
      }
    }

    const email = normalizeEmail((payload as CreateUserPayload).email || '');
    const password = (payload as CreateUserPayload).password || '';
    const fullName = normalizeText((payload as CreateUserPayload).full_name || '');
    const role = (payload as CreateUserPayload).role;
    const branchId = typeof (payload as CreateUserPayload).branch_id === 'string' ? normalizeText((payload as CreateUserPayload).branch_id as string) : null;

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

    const { error: profileError } = await finalizeProfileRecord(actorClient, profilePayload);

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
