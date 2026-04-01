import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Profile, Branch, UserRole } from '../types';
import { 
  Users, UserPlus, Trash2, Edit2, Shield, X, Check, Power, PowerOff, 
  Lock, CheckCircle2, Clock, Mail, ShieldCheck, Store as BranchIcon, ChevronRight, Search, 
  Filter, MoreHorizontal, UserX, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';

const UserManager: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unapproved' | 'active'>('all');

  const [formData, setFormData] = useState<Partial<Profile>>({
    email: '',
    role: 'seller',
    full_name: '',
    branch_id: null,
    employee_code: '',
    is_approved: false,
    is_active: true
  });

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setUsers(data as Profile[]);
    setLoading(false);
  };

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('*');
    if (data) setBranches(data as Branch[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && editingId) {
        const { error } = await supabase
          .from('profiles')
          .update({
            role: formData.role,
            full_name: formData.full_name,
            branch_id: formData.branch_id || null,
            employee_code: formData.employee_code || null,
            is_approved: formData.is_approved,
            is_active: formData.is_active
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('تم تحديث بيانات المستخدم بنجاح');
      } else {
        toast.info('تنبيه: يجب تسجيل المستخدم أولاً عبر صفحة الدخول، ثم تفعيله من هنا.');
        return;
      }

      setIsEditing(false);
      setEditingId(null);
      setFormData({ email: '', role: 'seller', full_name: '', branch_id: null, employee_code: '', is_approved: false, is_active: true });
      fetchUsers();
    } catch (error: any) {
      toast.error('خطأ: ' + error.message);
    }
  };

  const toggleApproval = async (user: Profile) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_approved: !user.is_approved })
      .eq('id', user.id);
    if (!error) {
       toast.success(user.is_approved ? 'تم إلغاء تفعيل المستخدم' : 'تمت الموافقة وتفعيل الحساب بنجاح ✅');
       fetchUsers();
    }
  };

  const toggleStatus = async (user: Profile) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !user.is_active })
      .eq('id', user.id);
    if (!error) {
       toast.info(user.is_active ? 'تم إيقاف صلاحية الدخول مؤقتاً' : 'تم استعادة صلاحية الدخول');
       fetchUsers();
    }
  };

  const filteredUsers = users.filter(u => {
     const matchesSearch = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
     if (activeFilter === 'unapproved') return matchesSearch && !u.is_approved;
     if (activeFilter === 'active') return matchesSearch && u.is_active;
     return matchesSearch;
  });

  return (
    <div className="h-full flex flex-col p-6 lg:p-10 space-y-10 overflow-y-auto custom-scrollbar" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
           <h1 className="text-4xl font-black text-slate-800 tracking-tighter">إدارة الكوادر والموظفين</h1>
           <p className="text-slate-400 font-medium text-lg mt-1 tracking-tight uppercase tracking-widest text-[10px]">Enterprise Workforce Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
         <div className="xl:col-span-4">
            <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-2xl space-y-8 sticky top-0">
               <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                  <div className="w-14 h-14 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl rotate-6 transition-transform hover:rotate-0">
                     {isEditing ? <Edit2 className="w-8 h-8 text-blue-400" /> : <UserPlus className="w-8 h-8 text-amber-500" />}
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">{isEditing ? 'تعديل البيانات' : 'إدارة الملفات الشخصية'}</h2>
               </div>

               <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-1.5">
                     <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-1">اسم الموظف الثلاثي</label>
                     <input 
                       type="text" 
                       value={formData.full_name || ''} 
                       onChange={e => setFormData({...formData, full_name: e.target.value})} 
                       className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-blue-100 font-bold transition-all outline-none text-slate-800"
                       placeholder="مثال: أحمد محمد علي" 
                       required
                       disabled={!isEditing}
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-1">المسمى الوظيفي</label>
                        <select 
                          value={formData.role} 
                          onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                          className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-blue-100 font-bold transition-all outline-none appearance-none text-slate-800"
                          disabled={!isEditing}
                        >
                           <option value="owner">المالك (Owner)</option>
                           <option value="branch_manager">مدير فرع (Manager)</option>
                           <option value="seller">بائع (Seller)</option>
                           <option value="cashier">كاشير (Cashier)</option>
                           <option value="price_manager">مسؤول أسعار (Admin)</option>
                        </select>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-1">كود الموظف</label>
                        <input 
                          type="text" 
                          value={formData.employee_code || ''} 
                          onChange={e => setFormData({...formData, employee_code: e.target.value})} 
                          className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-blue-100 font-bold transition-all outline-none text-slate-800"
                          placeholder="CL-001" 
                          disabled={!isEditing}
                        />
                     </div>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-1">التبعية للفرع</label>
                     <select 
                        value={formData.branch_id || ''} 
                        onChange={e => setFormData({...formData, branch_id: e.target.value || null})} 
                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-blue-100 font-bold transition-all outline-none appearance-none text-slate-800"
                        disabled={!isEditing}
                     >
                        <option value="">غير مخصص لفرع</option>
                        {branches.map(b => (
                           <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                     </select>
                  </div>

                  {isEditing ? (
                    <div className="flex gap-3 pt-4">
                       <button type="submit" className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                          حفظ التعديلات
                       </button>
                       <button type="button" onClick={() => { setIsEditing(false); setEditingId(null); setFormData({ email: '', role: 'seller', full_name: '', branch_id: null, employee_code: '', is_approved: false }); }} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black">
                          إلغاء
                       </button>
                    </div>
                  ) : (
                    <div className="p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100 border-dashed text-center opacity-70">
                       <ShieldCheck className="w-10 h-10 text-blue-500 mx-auto mb-4" />
                       <p className="text-blue-700 text-xs font-black leading-relaxed">حدد موظفاً من القائمة لتعديل صلاحياته أو تعيينه بفرع محدد</p>
                    </div>
                  )}
               </form>
            </div>
         </div>

         <div className="xl:col-span-8 flex flex-col space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
               <div className="relative w-full md:w-96 group">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو البريد الإلكتروني..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold transition-all text-slate-800"
                  />
               </div>
               <div className="flex bg-slate-100 p-1 rounded-2xl">
                  <button onClick={() => setActiveFilter('all')} className={`px-6 py-2.5 rounded-xl font-black text-[10px] transition-all ${activeFilter === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>الكل</button>
                  <button onClick={() => setActiveFilter('unapproved')} className={`px-6 py-2.5 rounded-xl font-black text-[10px] transition-all ${activeFilter === 'unapproved' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-slate-600'}`}>طلبات المراجعة</button>
                  <button onClick={() => setActiveFilter('active')} className={`px-6 py-2.5 rounded-xl font-black text-[10px] transition-all ${activeFilter === 'active' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-600'}`}>النشطون</button>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
               {filteredUsers.map(user => (
                  <div key={user.id} className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col justify-between h-[420px]">
                     {user.is_approved ? (
                        <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500"></div>
                     ) : (
                        <div className="absolute top-0 inset-x-0 h-1 bg-amber-500 animate-pulse"></div>
                     )}

                     <div className="flex items-start justify-between">
                        <div className="flex items-center gap-5">
                           <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white relative shadow-lg">
                              <UserCheck className={`w-8 h-8 ${user.is_approved ? 'text-emerald-400' : 'text-amber-400'}`} />
                              {user.is_active && (
                                 <div className="absolute -top-1 -left-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white ring-2 ring-emerald-500/20"></div>
                              )}
                           </div>
                           <div>
                              <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-2">{user.full_name}</h3>
                              <div className="flex items-center gap-2">
                                <Mail className="w-3 h-3 text-slate-300" />
                                <span className="text-[10px] text-slate-400 font-bold tracking-tighter truncate w-32">{user.email}</span>
                              </div>
                           </div>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                              user.role === 'owner' ? 'bg-red-50 text-red-600' :
                              user.role === 'branch_manager' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'
                           }`}>
                              {user.role}
                           </span>
                           <span className="text-[9px] text-slate-300 font-black mt-2">EMP ID: {user.employee_code || '---'}</span>
                        </div>
                     </div>

                     <div className="bg-slate-50/50 p-6 rounded-[2.2rem] my-6 space-y-3 border border-slate-100/50">
                        <div className="flex items-center justify-between text-[10px]">
                           <span className="text-slate-400 font-black uppercase">التبعية الحالية</span>
                           <span className="text-slate-800 font-black flex items-center gap-2"><BranchIcon className="w-3 h-3" /> {branches.find(b => b.id === user.branch_id)?.name || 'غير مخصص'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                           <span className="text-slate-400 font-black uppercase">حالة المراجعة</span>
                           <span className={`font-black ${user.is_approved ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {user.is_approved ? 'حساب مفعّل بالكامل' : 'في انتظار الموافقة'}
                           </span>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3 mt-auto">
                        {!user.is_approved ? (
                           <button onClick={() => toggleApproval(user)} className="col-span-2 bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95">
                              <CheckCircle2 className="w-5 h-5" /> تفعيل الحساب الآن
                           </button>
                        ) : (
                           <>
                              <button onClick={() => { setIsEditing(true); setEditingId(user.id); setFormData(user); }} className="bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 active:scale-95">
                                 <Edit2 className="w-4 h-4 text-blue-400" /> تعديل
                              </button>
                              <button onClick={() => toggleStatus(user)} className={`py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 active:scale-95 ${
                                 user.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              }`}>
                                 {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                 {user.is_active ? 'تجميد' : 'تفعيل'}
                              </button>
                           </>
                        )}
                     </div>
                  </div>
               ))}
               
               {filteredUsers.length === 0 && (
                  <div className="col-span-2 text-center py-20 bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-200">
                     <Users className="w-16 h-16 text-slate-300 mx-auto mb-6" />
                     <p className="text-slate-500 font-black text-xl">لا يوجد مستخدمون ضمن هذا التصنيف</p>
                  </div>
               )}
            </div>
         </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default UserManager;
