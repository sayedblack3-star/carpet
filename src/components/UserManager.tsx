import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { AppUser, UserRole, Branch } from '../types';
import { Users, UserPlus, Trash2, Edit2, Shield, X, Check, Power, PowerOff, Lock, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { logAction } from '../lib/logger';

const UserManager: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState('');
  
  const [formData, setFormData] = useState<Partial<AppUser>>({
    email: '',
    role: 'salesperson',
    name: '',
    branch_id: null,
    is_approved: false,
    is_active: true
  });

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) {
      setUsers(data as AppUser[]);
    }
    setLoading(false);
  };

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('*');
    if (data) setBranches(data as Branch[]);
  };

  useEffect(() => {
    fetchUsers();
    fetchBranches();

    const channel = supabase.channel('profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.role) {
      toast.error('يرجى إدخال البيانات المطلوبة');
      return;
    }

    try {
      const { error } = await supabase.from('profiles').update({
        role: formData.role,
        full_name: formData.name,
        branch_id: formData.branch_id || null,
        is_approved: formData.is_approved,
        is_active: formData.is_active
      }).eq('id', editingId);

      if (error) throw error;
      
      toast.success('تم تحديث بيانات المستخدم بنجاح');
      setIsEditing(false);
      setEditingId('');
      setFormData({ email: '', role: 'salesperson', name: '', branch_id: null, is_approved: false });
    } catch (error: any) {
      toast.error('خطأ: ' + error.message);
    }
  };

  const toggleApproval = async (user: AppUser) => {
    const { error } = await supabase.from('profiles').update({ is_approved: !user.is_approved }).eq('id', user.id);
    if (!error) {
       toast.success(user.is_approved ? 'تم إلغاء تفعيل المستخدم' : 'تم تفعيل الموافقة بنجاح');
       logAction('approval_change', `User ${user.email} approval set to ${!user.is_approved}`);
    }
  };

  const toggleStatus = async (user: AppUser) => {
    const { error } = await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id);
    if (!error) {
       toast.success(user.is_active ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب');
    }
  };

  const handleDelete = async (user: AppUser) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الملف الشخصي؟ لا يمكن التراجع عن هذه الخطوة.')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', user.id);
    if (error) {
      toast.error('لا يمكن الحذف: ربما يحتاج هذا المستخدم للتواجد في تقارير المبيعات.');
    } else {
      toast.success('تم حذف الملف الشخصي بنجاح');
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" /> إدارة الكادر الوظيفي
          </h1>
          <p className="text-slate-500 mt-1 font-medium">التحكم في الصلاحيات والموافقة على المستخدمين</p>
        </div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl p-8 border border-white/20 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold flex items-center gap-3 text-slate-800">
                <Edit2 className="w-6 h-6 text-blue-500" /> تعديل بيانات المستخدم
              </h3>
              <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 mr-2">البريد الإلكتروني (للقراءة فقط)</label>
                <input type="email" value={formData.email} disabled className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 cursor-not-allowed" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 mr-2">اسم الموظف</label>
                  <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none" placeholder="الاسم بالكامل" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 mr-2">الصلاحية</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none appearance-none">
                    <option value="salesperson">بائع (Salesperson)</option>
                    <option value="cashier">كاشير (Cashier)</option>
                    <option value="manager">مدير فرع (Manager)</option>
                    <option value="admin">مسؤول نظام (Admin)</option>
                    <option value="audit">مدقق (Audit)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 mr-2">الفرع</label>
                <select value={formData.branch_id || ''} onChange={e => setFormData({...formData, branch_id: e.target.value || null})} className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none">
                  <option value="">غير محدد</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                 <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition shadow-lg shadow-blue-200">حفظ التغييرات</button>
                 <button type="button" onClick={() => setIsEditing(false)} className="px-8 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-3xl"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map(user => (
            <div key={user.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
              {!user.is_approved && (
                <div className="absolute top-0 right-0 left-0 bg-amber-500 text-white text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" /> بانتظار الموافقة
                </div>
              )}
              
              <div className="flex items-start justify-between mb-6 pt-4">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl transition-colors ${user.is_approved ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                    <Shield className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800 line-clamp-1">{user.name || 'موظف جديد'}</h3>
                    <p className="text-sm text-slate-400 font-medium">{user.email}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-slate-400 font-medium">الوظيفة:</span>
                   <span className="px-3 py-1 bg-slate-100 rounded-lg text-slate-700 font-bold">
                     {user.role === 'admin' ? 'مسؤول نظام' : 
                      user.role === 'manager' ? 'مدير فرع' :
                      user.role === 'cashier' ? 'كاشير' : 'بائع'}
                   </span>
                 </div>
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-slate-400 font-medium">الفرع:</span>
                   <span className="text-slate-800 font-bold">{branches.find(b => b.id === user.branch_id)?.name || 'غير محدد'}</span>
                 </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-50">
                {!user.is_approved ? (
                  <button onClick={() => toggleApproval(user)} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> موافقة
                  </button>
                ) : (
                  <button onClick={() => setIsEditing(true) || setEditingId(user.id) || setFormData({...user, name: (user as any).full_name})} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                    <Edit2 className="w-4 h-4" /> تعديل
                  </button>
                )}
                
                <button onClick={() => toggleStatus(user)} className={`p-2.5 rounded-xl transition-colors ${user.is_active ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                  {user.is_active ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
                </button>
                
                <button onClick={() => handleDelete(user)} className="p-2.5 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserManager;
