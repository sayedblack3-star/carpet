import React, { useEffect, useMemo, useState } from 'react';
import { getSafeSession } from '../supabase';
import { Branch, Profile, UserRole } from '../types';
import { Users, Edit2, Shield, X, Mail, ShieldCheck, Search, UserPlus, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { logAction } from '../lib/logger';
import { normalizeEmail, normalizeText, validateEmail, validateStrongPassword } from '../lib/security';
import { toFriendlyErrorMessage } from '../lib/errorMessages';
import { LoadingCardGrid } from './ui/LoadingState';
import { BranchSelect, UserCard, UserFilterTabs, UserStatsCards } from './user-management/UserManagerUi';
import {
  createManagedUser,
  deleteManagedUser,
  fetchActiveBranches,
  fetchManagedUsers,
  syncManagedUserProfile,
  updateManagedProfile,
  updateUserApproval,
  updateUserStatus,
  type AdminCreateUserPayload,
  type ProfileMutationPayload,
} from '../lib/userManagementService';

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

const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

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
    try {
      const data = await fetchManagedUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('تعذر تحميل المستخدمين الآن.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const data = await fetchActiveBranches();
      setBranchFeatureEnabled(true);
      setBranches(data);
    } catch (error) {
      console.warn('Failed to fetch branches for user manager:', error);
      setBranchFeatureEnabled(false);
      setBranches([]);
    }
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
      const userPayload: AdminCreateUserPayload = {
        email: cleanEmail,
        password: newPassword,
        full_name: cleanName,
        role: newRole,
        branch_id: branchFeatureEnabled && newRole !== 'admin' ? newBranchId || null : null,
      };

      const user = await createManagedUser(userPayload);

      const payload: ProfileMutationPayload = {
        role: newRole,
        is_approved: false,
        is_active: true,
        full_name: cleanName,
      };

      if (branchFeatureEnabled) {
        payload.branch_id = newRole === 'admin' ? null : newBranchId || null;
      }

      await syncManagedUserProfile(user.id, cleanEmail, payload);

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
      await fetchUsers();
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'تعذر إنشاء الحساب الجديد.');
      if (message.includes('already registered') || message.includes('already exists')) {
        toast.error('هذا البريد الإلكتروني مسجل بالفعل');
      } else {
        toast.error(`خطأ: ${message}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing || !editingId) return;

    try {
      const payload: ProfileMutationPayload = {
        role: formData.role || 'seller',
        full_name: normalizeText(formData.full_name || ''),
        employee_code: normalizeText(formData.employee_code || '') || null,
        is_approved: formData.is_approved ?? false,
        is_active: formData.is_active ?? true,
      };

      if (branchFeatureEnabled) {
        payload.branch_id = formData.role === 'admin' ? null : formData.branch_id || null;
      }

      await updateManagedProfile(editingId, payload);

      await logAction('user_updated', {
        target_user_id: editingId,
        role: payload.role,
        branch_id: payload.branch_id ?? null,
        is_approved: payload.is_approved,
        is_active: payload.is_active,
      });

      toast.success('تم تحديث بيانات المستخدم');
      resetForm();
      await fetchUsers();
    } catch (error: unknown) {
      toast.error(`خطأ: ${getErrorMessage(error, 'تعذر تحديث بيانات المستخدم الآن.')}`);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  };

  const toggleApproval = async (user: Profile) => {
    try {
      await updateUserApproval(user.id, !user.is_approved);
      await logAction('user_approval_changed', {
        target_user_id: user.id,
        email: user.email,
        is_approved: !user.is_approved,
      });
      toast.success(user.is_approved ? 'تم إلغاء التفعيل' : 'تم تفعيل الحساب');
      await fetchUsers();
    } catch (error) {
      toast.error(`خطأ: ${getErrorMessage(error, 'تعذر تحديث حالة التفعيل الآن.')}`);
    }
  };

  const toggleStatus = async (user: Profile) => {
    try {
      await updateUserStatus(user.id, !user.is_active);
      await logAction('user_status_changed', {
        target_user_id: user.id,
        email: user.email,
        is_active: !user.is_active,
      });
      toast.info(user.is_active ? 'تم تجميد الحساب' : 'تم تفعيل الحساب');
      await fetchUsers();
    } catch (error) {
      toast.error(`خطأ: ${getErrorMessage(error, 'تعذر تحديث حالة المستخدم الآن.')}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleting(true);
    try {
      await deleteManagedUser(userToDelete.id);

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

      <UserStatsCards stats={userStats} />

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
                  <BranchSelect value={newBranchId} branches={branches} onChange={setNewBranchId} />
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
                    <BranchSelect value={formData.branch_id} branches={branches} onChange={(value) => setFormData({ ...formData, branch_id: value || null })} />
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
            <UserFilterTabs activeFilter={activeFilter} onChange={setActiveFilter} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading
              ? <LoadingCardGrid count={4} minHeightClassName="h-48" className="contents" />
                : filtered.map((user) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      currentUserId={currentUserId}
                      branchFeatureEnabled={branchFeatureEnabled}
                      branchLookup={branchLookup}
                      roleLabels={ROLE_LABELS}
                      onEdit={(nextUser) => {
                        setIsEditing(true);
                        setEditingId(nextUser.id);
                        setFormData({ ...nextUser });
                      }}
                      onToggleApproval={toggleApproval}
                      onToggleStatus={toggleStatus}
                      onDelete={setUserToDelete}
                    />
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

