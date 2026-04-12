import { getApiUrl } from './appUrl';
import { getSafeSession, supabase } from '../supabase';
import { Branch, Profile, UserRole } from '../types';

export type AdminCreateUserPayload = {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  branch_id: string | null;
};

export type AdminDeleteUserPayload = {
  user_id: string;
};

type AdminUsersApiPayload = AdminCreateUserPayload | AdminDeleteUserPayload;

export type ProfileMutationPayload = {
  role: UserRole;
  full_name: string;
  employee_code?: string | null;
  is_approved: boolean;
  is_active: boolean;
  branch_id?: string | null;
};

const getFreshAdminAccessToken = async () => {
  const session = await getSafeSession();

  if (!session?.access_token) {
    throw new Error('انتهت الجلسة الحالية. يرجى تسجيل الدخول مرة أخرى.');
  }

  return session.access_token;
};

const refreshAdminAccessToken = async () => {
  const { data, error } = await supabase.auth.refreshSession();

  if (error || !data.session?.access_token) {
    throw new Error('انتهت الجلسة الحالية. يرجى تسجيل الدخول مرة أخرى.');
  }

  return data.session.access_token;
};

const callAdminUsersApi = async (method: 'POST' | 'DELETE', payload: AdminUsersApiPayload) => {
  const executeRequest = async (accessToken: string) =>
    fetch(getApiUrl('/api/admin/users'), {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

  let accessToken = await getFreshAdminAccessToken();
  let response = await executeRequest(accessToken);

  if (response.status === 401) {
    accessToken = await refreshAdminAccessToken();
    response = await executeRequest(accessToken);
  }

  return response;
};

const parseApiResponse = async <T,>(response: Response, fallbackMessage: string) => {
  const payload = await response
    .json()
    .catch(() => ({ error: response.status === 404 ? 'Admin user provisioning endpoint is not available.' : fallbackMessage }));

  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }

  return payload as T;
};

export const fetchManagedUsers = async (): Promise<Profile[]> => {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Profile[];
};

export const fetchActiveBranches = async (): Promise<Branch[]> => {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, slug, is_active')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return (data || []) as Branch[];
};

export const createManagedUser = async (payload: AdminCreateUserPayload) => {
  const response = await callAdminUsersApi('POST', payload);
  const result = await parseApiResponse<{ user?: { id: string } }>(response, 'تعذر إنشاء الحساب الجديد.');

  if (!result.user?.id) {
    throw new Error('فشل في إنشاء المستخدم');
  }

  return result.user;
};

export const syncManagedUserProfile = async (
  userId: string,
  email: string,
  payload: ProfileMutationPayload,
) => {
  const { error: profileErr } = await supabase.from('profiles').update(payload).eq('id', userId);

  if (!profileErr) return;

  const { error: upsertError } = await supabase.from('profiles').upsert({
    id: userId,
    email,
    full_name: payload.full_name,
    role: payload.role,
    branch_id: payload.branch_id ?? null,
    is_approved: payload.is_approved,
    is_active: payload.is_active,
    employee_code: payload.employee_code ?? null,
  });

  if (upsertError) throw upsertError;
};

export const updateManagedProfile = async (userId: string, payload: ProfileMutationPayload) => {
  const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
  if (error) throw error;
};

export const updateUserApproval = async (userId: string, isApproved: boolean) => {
  const { error } = await supabase.from('profiles').update({ is_approved: isApproved }).eq('id', userId);
  if (error) throw error;
};

export const updateUserStatus = async (userId: string, isActive: boolean) => {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', userId);
  if (error) throw error;
};

export const deleteManagedUser = async (userId: string) => {
  const response = await callAdminUsersApi('DELETE', { user_id: userId });
  await parseApiResponse(response, 'تعذر حذف المستخدم المحدد.');
};
