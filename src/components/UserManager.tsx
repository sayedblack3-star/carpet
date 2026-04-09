import React, { useEffect, useMemo, useState } from 'react';
import { getSafeSession, supabase } from '../supabase';
import { Branch, Profile, UserRole } from '../types';
import { Users, Edit2, Shield, X, Mail, ShieldCheck, Search, UserX, UserCheck, CheckCircle2, UserPlus, Lock, Eye, EyeOff, Building2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { logAction } from '../lib/logger';
import { getApiUrl } from '../lib/appUrl';
import { normalizeEmail, normalizeText, validateEmail, validateStrongPassword } from '../lib/security';
import { toFriendlyErrorMessage } from '../lib/errorMessages';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مدير عام',
  seller: 'بائع',
  cashier: 'كاشير',
};

const EMPTY_FORM: Partial<Profile> = {
  role: 'seller',
  full_name: '',
  employee_code: '',
  branch_id: null,
  is_approved: false,
  is_active: true,
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

const callAdminUsersApi = async (method: 'POST' | 'DELETE', payload: Record<string, any>) => {
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

const UserManager: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFeatureEnabled, setBranchFeatureEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unapproved' | 'active'>('all');
  const [formData, setFormData] = useState<Partial<Profile>>(EMPTY_FORM);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('seller');
  const [newBranchId, setNewBranchId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const session = await getSafeSession();
        if (!isMounted) return;

        setCurrentUserId(session?.user?.id || null);
        await fetchBranches();
        if (!isMounted) return;
        await fetchUsers();
      } catch (error) {
        console.warn('UserManager session bootstrap skipped:', error);
      }
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, []);

  const branchLookup = useMemo(() => {
    return branches.reduce<Record<string, string>>((acc, branch) => {
      acc[branch.id] = branch.name;
      return acc;
    }, {});
  }, [branches]);
  const userStats = useMemo(
    () => ({
      total: users.length,
      pending: users.filter((user) => !user.is_approved).length,
      active: users.filter((user) => user.is_active && user.is_approved).length,
      admins: users.filter((user) => user.role === 'admin').length,
    }),
    [users],
  );

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data as Profile[]);
    setLoading(false);
  };

  const fetchBranches = async () => {
    const { data, error } = await supabase.from('branches').select('id, name, slug, is_active').eq('is_active', true).order('name');
    if (error) {
      setBranchFeatureEnabled(false);
      setBranches([]);
      return;
    }

    setBranchFeatureEnabled(true);
    setBranches((data || []) as Branch[]);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = normalizeEmail(newEmail);
    const cleanName = normalizeText(newName);

    if (!cleanEmail || !newPassword || !cleanName) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }

    const emailError = validateEmail(cleanEmail);
    if (emailError) {
      toast.error(emailError);
      return;
    }

    if ((newRole === 'seller' || newRole === 'cashier') && branchFeatureEnabled && !newBranchId) {
      toast.error('اختر الفرع لهذا المستخدم');
      return;
    }

    const passwordError = validateStrongPassword(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setCreating(true);
    try {
      const session = await getSafeSession();

      if (!session?.access_token) {
        throw new Error('انتهت الجلسة الحالية. يرجى تسجيل الدخول مرة أخرى.');
      }

      const response = await fetch(getApiUrl('/api/admin/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: newPassword,
          full_name: cleanName,
          role: newRole,
          branch_id: branchFeatureEnabled && newRole !== 'admin' ? newBranchId || null : null,
        }),
      });

      const result = await response
        .json()
        .catch(() => ({ error: response.status === 404 ? 'Admin user provisioning endpoint is not available.' : 'Unexpected server response.' }));
      const error = response.ok ? null : new Error(result.error || 'تعذر إنشاء الحساب الجديد.');
      const data = { user: result.user };

      if (error) throw error;
      if (!data.user) throw new Error('فشل في إنشاء المستخدم');

      const payload: Record<string, any> = {
        role: newRole,
        is_approved: false,
        is_active: true,
        full_name: cleanName,
      };

      if (branchFeatureEnabled) {
        payload.branch_id = newRole === 'admin' ? null : newBranchId || null;
      }

      const { error: profileErr } = await supabase.from('profiles').update(payload).eq('id', data.user.id);

      if (profileErr) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: cleanEmail,
          full_name: cleanName,
          role: newRole,
          branch_id: branchFeatureEnabled && newRole !== 'admin' ? newBranchId || null : null,
          is_approved: false,
          is_active: true,
        });
      }

      await logAction('user_created', {
        email: cleanEmail,
        full_name: cleanName,
        role: newRole,
        branch_id: branchFeatureEnabled && newRole !== 'admin' ? newBranchId || null : null,
        requires_approval: true,
      });

      toast.success(`تم إنشاء حساب ${cleanName} وبانتظار التفعيل`);
      setShowCreateModal(false);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewRole('seller');
      setNewBranchId('');
      fetchUsers();
    } catch (err: any) {
      if (err.message?.includes('already registered') || err.message?.includes('already exists')) {
        toast.error('هذا البريد الإلكتروني مسجل بالفعل');
      } else {
        toast.error(`خطأ: ${err.message}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing || !editingId) return;

    try {
      const payload: Record<string, any> = {
        role: formData.role,
        full_name: normalizeText(formData.full_name || ''),
        employee_code: normalizeText(formData.employee_code || '') || null,
        is_approved: formData.is_approved,
        is_active: formData.is_active,
      };

      if (branchFeatureEnabled) {
        payload.branch_id = formData.role === 'admin' ? null : formData.branch_id || null;
      }

      const { error } = await supabase.from('profiles').update(payload).eq('id', editingId);
      if (error) throw error;

      await logAction('user_updated', {
        target_user_id: editingId,
        role: payload.role,
        branch_id: payload.branch_id ?? null,
        is_approved: payload.is_approved,
        is_active: payload.is_active,
      });

      toast.success('تم تحديث بيانات المستخدم');
      resetForm();
      fetchUsers();
    } catch (err: any) {
      toast.error(`خطأ: ${err.message}`);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  };

  const toggleApproval = async (user: Profile) => {
    const { error } = await supabase.from('profiles').update({ is_approved: !user.is_approved }).eq('id', user.id);
    if (!error) {
      await logAction('user_approval_changed', {
        target_user_id: user.id,
        email: user.email,
        is_approved: !user.is_approved,
      });
      toast.success(user.is_approved ? 'تم إلغاء التفعيل' : 'تم تفعيل الحساب');
      fetchUsers();
    }
  };

  const toggleStatus = async (user: Profile) => {
    const { error } = await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id);
    if (!error) {
      await logAction('user_status_changed', {
        target_user_id: user.id,
        email: user.email,
        is_active: !user.is_active,
      });
      toast.info(user.is_active ? 'تم تجميد الحساب' : 'تم تفعيل الحساب');
      fetchUsers();
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleting(true);
    try {
      const session = await getSafeSession();

      if (!session?.access_token) {
        throw new Error('انتهت الجلسة الحالية. سجل الدخول مرة أخرى ثم أعد المحاولة.');
      }

      const response = await fetch(getApiUrl('/api/admin/users'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_id: userToDelete.id }),
      });

      const result = await response.json().catch(() => ({ error: 'Unexpected server response.' }));
      if (!response.ok) {
        throw new Error(result.error || 'تعذر حذف المستخدم المحدد.');
      }

      await logAction('user_deleted', {
        target_user_id: userToDelete.id,
        email: userToDelete.email,
        role: userToDelete.role,
      });

      toast.success(`تم حذف ${userToDelete.full_name} نهائيًا.`);
      setUserToDelete(null);
      await fetchUsers();
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, 'تعذر حذف المستخدم الآن.'));
    } finally {
      setDeleting(false);
    }
  };

  const filtered = users.filter((user) => {
    const branchLabel = user.branch_id ? branchLookup[user.branch_id] || '' : '';
    const match =
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branchLabel.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeFilter === 'unapproved') return match && !user.is_approved;
    if (activeFilter === 'active') return match && user.is_active && user.is_approved;
    return match;
  });

  const branchSelect = (value: string | null | undefined, onChange: (value: string) => void) => (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none appearance-none">
      <option value="">اختر الفرع</option>
      {branches.map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 overflow-y-auto" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800">إدارة المستخدمين</h1>
          <p className="text-slate-400 font-medium mt-1">إدارة الموظفين وصلاحياتهم وربطهم بالفروع</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto px-5 py-3.5 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-slate-800 active:scale-95 min-h-13">
          <UserPlus className="w-5 h-5" /> إضافة موظف جديد
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black text-slate-400 mb-2">إجمالي المستخدمين</p>
          <p className="text-2xl font-black text-slate-900">{userStats.total}</p>
        </div>
        <div className="rounded-[1.6rem] border border-amber-100 bg-amber-50 p-4 shadow-sm">
          <p className="text-[11px] font-black text-amber-700 mb-2">بانتظار التفعيل</p>
          <p className="text-2xl font-black text-amber-900">{userStats.pending}</p>
        </div>
        <div className="rounded-[1.6rem] border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
          <p className="text-[11px] font-black text-emerald-700 mb-2">نشط حاليًا</p>
          <p className="text-2xl font-black text-emerald-900">{userStats.active}</p>
        </div>
        <div className="rounded-[1.6rem] border border-red-100 bg-red-50 p-4 shadow-sm">
          <p className="text-[11px] font-black text-red-700 mb-2">مديرون</p>
          <p className="text-2xl font-black text-red-900">{userStats.admins}</p>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-[2rem] sm:rounded-3xl p-5 sm:p-8 max-w-md w-full shadow-2xl border mt-6 sm:mt-0 max-h-[92dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-4 z-10">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-500" /> إنشاء حساب موظف</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">الاسم الكامل</label>
                <input required type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none focus:ring-2 focus:ring-blue-100" placeholder="أحمد محمد" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none focus:ring-2 focus:ring-blue-100" placeholder="user@carpetland.com" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input required type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={10} className="w-full pr-10 pl-12 py-3 rounded-xl bg-slate-50 border font-bold outline-none focus:ring-2 focus:ring-blue-100" placeholder="10 أحرف على الأقل مع حرف كبير وصغير ورقم" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 font-bold mt-2">سينشأ الحساب فورًا لكنه سيبقى بانتظار التفعيل من الإدارة.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">الدور الوظيفي</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['seller', 'cashier', 'admin'] as UserRole[]).map((role) => (
                    <button key={role} type="button" onClick={() => setNewRole(role)} className={`py-3 rounded-xl font-bold text-sm transition-all ${newRole === role ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              </div>
              {branchFeatureEnabled && newRole !== 'admin' && (
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">الفرع</label>
                  {branchSelect(newBranchId, setNewBranchId)}
                </div>
              )}
              <button type="submit" disabled={creating} className="w-full min-h-14 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2">
                {creating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><UserPlus className="w-5 h-5" /> إنشاء الحساب</>}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8">
        <div className="xl:col-span-4">
          <div className="bg-white rounded-[2rem] sm:rounded-3xl p-5 sm:p-8 border shadow-lg xl:sticky xl:top-4">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              {isEditing ? <Edit2 className="w-5 h-5 text-blue-500" /> : <ShieldCheck className="w-5 h-5 text-amber-500" />}
              {isEditing ? 'تعديل المستخدم' : 'إدارة الصلاحيات'}
            </h2>
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">الاسم الكامل</label>
                  <input type="text" required value={formData.full_name || ''} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">الدور</label>
                    <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole, branch_id: e.target.value === 'admin' ? null : formData.branch_id || null })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none appearance-none">
                      <option value="admin">مدير عام</option>
                      <option value="seller">بائع</option>
                      <option value="cashier">كاشير</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">كود الموظف</label>
                    <input type="text" value={formData.employee_code || ''} onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none" placeholder="CL-001" />
                  </div>
                </div>
                {branchFeatureEnabled && formData.role !== 'admin' && (
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">الفرع</label>
                    {branchSelect(formData.branch_id, (value) => setFormData({ ...formData, branch_id: value || null }))}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 active:scale-[0.98]">حفظ</button>
                  <button type="button" onClick={resetForm} className="px-5 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold">إلغاء</button>
                </div>
              </form>
            ) : (
              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 border-dashed text-center">
                <Shield className="w-10 h-10 text-blue-500 mx-auto mb-3" />
                <p className="text-blue-700 text-xs font-bold leading-relaxed">اختر مستخدمًا من القائمة لتعديل صلاحياته أو ربطه بفرع.</p>
                <p className="text-blue-500 text-[10px] mt-3 font-bold">لإضافة موظف جديد استخدم الزر العلوي.</p>
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-8 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" placeholder="ابحث بالاسم أو البريد أو الفرع..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pr-12 pl-4 py-3 bg-slate-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div className="flex md:grid md:grid-cols-3 w-full md:w-auto bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto hide-scrollbar">
              {(['all', 'unapproved', 'active'] as const).map((filter) => (
                <button key={filter} onClick={() => setActiveFilter(filter)} className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-xs transition-all shrink-0 min-w-[6.75rem] ${activeFilter === filter ? filter === 'unapproved' ? 'bg-amber-500 text-white' : filter === 'active' ? 'bg-emerald-500 text-white' : 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>
                  {filter === 'all' ? 'الكل' : filter === 'unapproved' ? 'بانتظار التفعيل' : 'نشط'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading
              ? [1, 2, 3, 4].map((i) => <div key={i} className="h-48 bg-white animate-pulse rounded-2xl border"></div>)
              : filtered.map((user) => (
                  <div key={user.id} className="bg-white rounded-2xl p-5 sm:p-6 border shadow-sm hover:shadow-lg transition-all relative overflow-hidden">
                    <div className={`absolute top-0 inset-x-0 h-1 ${user.is_approved ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white relative">
                          <UserCheck className={`w-6 h-6 ${user.is_approved ? 'text-emerald-400' : 'text-amber-400'}`} />
                          {user.is_active && <div className="absolute -top-1 -left-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-black text-slate-800 truncate">{user.full_name}</h3>
                          <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 truncate"><Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{user.email}</span></p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${user.role === 'admin' ? 'bg-red-50 text-red-600' : user.role === 'cashier' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'}`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl mb-4 text-[10px] space-y-2">
                      <div className="flex justify-between gap-3"><span className="text-slate-400 font-bold shrink-0">الحالة</span><span className={`font-black text-left ${user.is_approved ? 'text-emerald-600' : 'text-amber-600'}`}>{user.is_approved ? 'مفعّل' : 'بانتظار التفعيل'}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-slate-400 font-bold shrink-0">كود الموظف</span><span className="font-black text-slate-700 text-left">{user.employee_code || '—'}</span></div>
                      {branchFeatureEnabled && (
                        <div className="flex justify-between items-center gap-3">
                          <span className="text-slate-400 font-bold shrink-0">الفرع</span>
                          <span className="font-black text-slate-700 flex items-center gap-1 text-left">
                            <Building2 className="w-3 h-3" /> {user.branch_id ? branchLookup[user.branch_id] || 'غير معروف' : user.role === 'admin' ? 'الإدارة العامة' : 'غير محدد'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {!user.is_approved ? (
                        <button onClick={() => toggleApproval(user)} className="col-span-2 min-h-12 bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-amber-500/20">
                          <CheckCircle2 className="w-4 h-4" /> تفعيل الحساب
                        </button>
                      ) : (
                        <>
                          <button onClick={() => { setIsEditing(true); setEditingId(user.id); setFormData({ ...user }); }} className="min-h-12 bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95">
                            <Edit2 className="w-4 h-4" /> تعديل
                          </button>
                          <button onClick={() => toggleStatus(user)} className={`min-h-12 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 ${user.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                            {user.is_active ? <><UserX className="w-4 h-4" /> تجميد</> : <><UserCheck className="w-4 h-4" /> تفعيل</>}
                          </button>
                        </>
                      )}
                    </div>

                    {user.id !== currentUserId && (
                      <button
                        onClick={() => setUserToDelete(user)}
                        className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100 active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" /> حذف نهائي آمن
                      </button>
                    )}
                  </div>
                ))}
            {!loading && filtered.length === 0 && (
              <div className="md:col-span-2 text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-400 font-bold">لا يوجد مستخدمون</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setUserToDelete(null)}>
          <div className="w-full max-w-md rounded-[2rem] border bg-white p-6 shadow-2xl sm:p-8" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">تأكيد حذف المستخدم</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">سيتم حذف الحساب نهائيًا إذا لم يكن مرتبطًا بمبيعات فعلية أو بقيود تمنع الحذف.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-900">
              <p className="font-black">{userToDelete.full_name}</p>
              <p className="mt-1 font-bold">{userToDelete.email}</p>
              <p className="mt-3 text-xs font-bold text-red-700">لو كان المستخدم مرتبطًا بمبيعات فعلية، سيرفض النظام الحذف ويطلب منك تعطيل الحساب بدلًا من ذلك.</p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 font-bold text-slate-600 hover:bg-slate-200"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 rounded-2xl bg-red-600 px-4 py-3 font-black text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'جارٍ الحذف...' : 'حذف نهائي'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;
