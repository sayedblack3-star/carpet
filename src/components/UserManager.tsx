import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Profile, UserRole } from '../types';
import { Users, Edit2, Shield, X, Check, Mail, ShieldCheck, Search, UserX, UserCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_LABELS: Record<UserRole, string> = { admin: 'مدير عام', seller: 'بائع', cashier: 'كاشير' };

const UserManager: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unapproved' | 'active'>('all');
  const [formData, setFormData] = useState<Partial<Profile>>({ role: 'seller', full_name: '', employee_code: '', is_approved: false, is_active: true });

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data as Profile[]);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing || !editingId) return;
    try {
      const { error } = await supabase.from('profiles').update({
        role: formData.role, full_name: formData.full_name,
        employee_code: formData.employee_code || null,
        is_approved: formData.is_approved, is_active: formData.is_active
      }).eq('id', editingId);
      if (error) throw error;
      toast.success('تم تحديث بيانات المستخدم');
      resetForm(); fetchUsers();
    } catch (err: any) { toast.error('خطأ: ' + err.message); }
  };

  const resetForm = () => { setIsEditing(false); setEditingId(null); setFormData({ role: 'seller', full_name: '', employee_code: '', is_approved: false, is_active: true }); };

  const toggleApproval = async (user: Profile) => {
    const { error } = await supabase.from('profiles').update({ is_approved: !user.is_approved }).eq('id', user.id);
    if (!error) { toast.success(user.is_approved ? 'تم إلغاء التفعيل' : 'تم تفعيل الحساب ✅'); fetchUsers(); }
  };

  const toggleStatus = async (user: Profile) => {
    const { error } = await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id);
    if (!error) { toast.info(user.is_active ? 'تم تجميد الحساب' : 'تم تفعيل الحساب'); fetchUsers(); }
  };

  const filtered = users.filter(u => {
    const match = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeFilter === 'unapproved') return match && !u.is_approved;
    if (activeFilter === 'active') return match && u.is_active && u.is_approved;
    return match;
  });

  return (
    <div className="h-full flex flex-col p-4 sm:p-8 space-y-8 overflow-y-auto" dir="rtl">
      <div>
        <h1 className="text-3xl font-black text-slate-800">إدارة المستخدمين</h1>
        <p className="text-slate-400 font-medium mt-1">إدارة الموظفين وصلاحياتهم</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Edit Panel */}
        <div className="xl:col-span-4">
          <div className="bg-white rounded-3xl p-8 border shadow-lg sticky top-4">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              {isEditing ? <Edit2 className="w-5 h-5 text-blue-500" /> : <ShieldCheck className="w-5 h-5 text-amber-500" />}
              {isEditing ? 'تعديل المستخدم' : 'إدارة الصلاحيات'}
            </h2>
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">الاسم الكامل</label>
                  <input type="text" required value={formData.full_name || ''} onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">الدور</label>
                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none appearance-none">
                      <option value="admin">مدير عام</option>
                      <option value="seller">بائع</option>
                      <option value="cashier">كاشير</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">كود الموظف</label>
                    <input type="text" value={formData.employee_code || ''} onChange={e => setFormData({ ...formData, employee_code: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none" placeholder="CL-001" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 active:scale-[0.98]">حفظ</button>
                  <button type="button" onClick={resetForm} className="px-5 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold">إلغاء</button>
                </div>
              </form>
            ) : (
              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 border-dashed text-center">
                <Shield className="w-10 h-10 text-blue-500 mx-auto mb-3" />
                <p className="text-blue-700 text-xs font-bold leading-relaxed">اختر مستخدم من القائمة لتعديل صلاحياته</p>
                <p className="text-blue-500 text-[10px] mt-3 font-bold">💡 المستخدمين الجدد يسجلون من صفحة الدخول ثم تفعّلهم من هنا</p>
              </div>
            )}
          </div>
        </div>

        {/* Users List */}
        <div className="xl:col-span-8 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" placeholder="ابحث بالاسم أو البريد..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pr-12 pl-4 py-3 bg-slate-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {(['all', 'unapproved', 'active'] as const).map(f => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${activeFilter === f ? (f === 'unapproved' ? 'bg-amber-500 text-white' : f === 'active' ? 'bg-emerald-500 text-white' : 'bg-white shadow text-slate-800') : 'text-slate-400'}`}>
                  {f === 'all' ? 'الكل' : f === 'unapproved' ? 'بانتظار التفعيل' : 'نشط'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? [1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-white animate-pulse rounded-2xl border"></div>) :
              filtered.map(user => (
                <div key={user.id} className="bg-white rounded-2xl p-6 border shadow-sm hover:shadow-lg transition-all relative overflow-hidden">
                  <div className={`absolute top-0 inset-x-0 h-1 ${user.is_approved ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white relative">
                        <UserCheck className={`w-6 h-6 ${user.is_approved ? 'text-emerald-400' : 'text-amber-400'}`} />
                        {user.is_active && <div className="absolute -top-1 -left-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-800">{user.full_name}</h3>
                        <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${user.role === 'admin' ? 'bg-red-50 text-red-600' : user.role === 'cashier' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'}`}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl mb-4 text-[10px] space-y-1.5">
                    <div className="flex justify-between"><span className="text-slate-400 font-bold">الحالة</span><span className={`font-black ${user.is_approved ? 'text-emerald-600' : 'text-amber-600'}`}>{user.is_approved ? 'مفعّل' : 'بانتظار التفعيل'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-bold">كود الموظف</span><span className="font-black text-slate-700">{user.employee_code || '—'}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {!user.is_approved ? (
                      <button onClick={() => toggleApproval(user)} className="col-span-2 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-amber-500/20">
                        <CheckCircle2 className="w-4 h-4" /> تفعيل الحساب
                      </button>
                    ) : (
                      <>
                        <button onClick={() => { setIsEditing(true); setEditingId(user.id); setFormData(user); }} className="bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95">
                          <Edit2 className="w-4 h-4" /> تعديل
                        </button>
                        <button onClick={() => toggleStatus(user)} className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 ${user.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                          {user.is_active ? <><UserX className="w-4 h-4" /> تجميد</> : <><UserCheck className="w-4 h-4" /> تفعيل</>}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            {!loading && filtered.length === 0 && (
              <div className="col-span-2 text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" /><p className="text-slate-400 font-bold">لا يوجد مستخدمون</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManager;
