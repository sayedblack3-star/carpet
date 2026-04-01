import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { AppUser, UserRole, BRANCHES } from '../types';
import { Users, UserPlus, Trash2, Edit2, Shield, X, Check, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { logAction } from '../lib/logger';

const UserManager: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEmail, setEditingEmail] = useState('');
  
  const [formData, setFormData] = useState<Partial<AppUser>>({
    email: '',
    role: 'salesperson',
    name: '',
    branchId: '',
    isActive: true
  });

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase.from('users').select('*');
      if (data) {
        setUsers(data.map((d: any) => ({
          email: d.email,
          role: d.role,
          name: d.name,
          branchId: d.branch_id,
          isActive: d.is_active,
          createdAt: d.created_at
        })));
      }
      setLoading(false);
    };

    fetchUsers();

    const channel = supabase.channel('users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, payload => {
        fetchUsers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.role) {
      toast.error('يرجى إدخال البريد الإلكتروني والصلاحية');
      return;
    }

    try {
      const email = formData.email.toLowerCase().trim();
      const userData = {
        email: email,
        role: formData.role,
        name: formData.name || '',
        branch_id: formData.branchId || null,
        is_active: formData.isActive ?? true
      };

      if (!isEditing) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', userData.email)
          .maybeSingle();

        if (existingUser) {
          const { error } = await supabase.from('users').update({
            role: userData.role,
            name: userData.name,
            branch_id: userData.branch_id,
            is_active: userData.is_active
          }).eq('email', userData.email);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('users').insert([{
            email: userData.email,
            role: userData.role,
            name: userData.name,
            branch_id: userData.branch_id,
            is_active: userData.is_active
          }]);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('users').update({
           role: userData.role,
           name: userData.name,
           branch_id: userData.branch_id,
           is_active: userData.is_active
        }).eq('email', editingEmail);
        if (error) throw error;
      }
      
      await logAction(isEditing ? 'تعديل مستخدم' : 'إضافة مستخدم', `تم ${isEditing ? 'تعديل' : 'إضافة'} المستخدم: ${formData.email}`, formData.branchId);
      toast.success(isEditing ? 'تم تحديث بيانات المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح');
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء حفظ المستخدم');
    }
  };

  const handleEdit = (user: AppUser) => {
    setFormData({
      email: user.email,
      role: user.role,
      name: user.name || '',
      branchId: user.branchId || '',
      isActive: user.isActive
    });
    setEditingEmail(user.email);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (email: string) => {
    if (email === 'szater600@gmail.com' || email === 'sayedblack3@gmail.com') {
      toast.error('لا يمكن حذف المدير الرئيسي');
      return;
    }
    
    if (window.confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً؟')) {
      try {
        const { error, count } = await supabase.from('users').delete({ count: 'exact' }).ilike('email', email.trim());
        if (error) throw error;
        if (count === 0) {
          toast.error('لم يتم العثور على الحساب');
          return;
        }
        await logAction('حذف مستخدم', `تم حذف المستخدم: ${email}`);
        toast.success('تم حذف المستخدم بنجاح');
      } catch (error: any) {
        toast.error(`فشل الحذف: ${error.message || 'خطأ غير معروف'}`);
      }
    }
  };

  const toggleActive = async (user: AppUser) => {
    if (user.email === 'szater600@gmail.com' || user.email === 'sayedblack3@gmail.com') {
      toast.error('لا يمكن إيقاف حساب المدير الرئيسي');
      return;
    }

    try {
      const { error } = await supabase.from('users').update({ is_active: !user.isActive }).eq('email', user.email);
      if (error) throw error;
      await logAction('تغيير حالة مستخدم', `تم ${user.isActive ? 'إيقاف' : 'تفعيل'} حساب المستخدم: ${user.email}`, user.branchId);
      toast.success(user.isActive ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب');
    } catch (error: any) {
      toast.error('حدث خطأ أثناء تغيير حالة الحساب');
    }
  };

  const resetForm = () => {
    setFormData({ email: '', role: 'salesperson', name: '', branchId: '', isActive: true });
    setIsEditing(false);
    setEditingEmail('');
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin': return 'مدير نظام';
      case 'manager': return 'مدير';
      case 'pricing': return 'مسؤول أسعار';
      case 'cashier': return 'كاشير';
      case 'salesperson': return 'بائع';
      case 'audit': return 'مراقب';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'manager': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'pricing': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'cashier': return 'bg-green-100 text-green-800 border-green-200';
      case 'salesperson': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'audit': return 'bg-teal-100 text-teal-800 border-teal-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center shrink-0">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">إدارة الصلاحيات</h1>
          <p className="text-slate-500 text-sm">إدارة حسابات الموظفين والفرع والصلاحيات</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-20">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              {isEditing ? <Edit2 className="w-5 h-5 text-blue-500" /> : <UserPlus className="w-5 h-5 text-blue-500" />}
              {isEditing ? 'تعديل المستخدم' : 'مستخدم جديد'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">البريد الإلكتروني *</label>
                <input required disabled={isEditing} value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition disabled:opacity-50" placeholder="example@gmail.com" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">الاسم</label>
                <input value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="اسم الموظف" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">الصلاحية *</label>
                <select required value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value as UserRole})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer">
                  <option value="salesperson">بائع</option>
                  <option value="cashier">كاشير</option>
                  <option value="pricing">مسؤول أسعار</option>
                  <option value="manager">مدير</option>
                  <option value="admin">مدير نظام</option>
                  <option value="audit">مراقب</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">الفرع</label>
                <select value={formData.branchId} onChange={e=>setFormData({...formData, branchId: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer">
                  <option value="">-- بدون فرع --</option>
                  {BRANCHES.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition shadow-sm mt-2 flex items-center justify-center gap-2">
                {isEditing ? <Check className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                {isEditing ? 'حفظ التعديلات' : 'إضافة الموظف'}
              </button>
              {isEditing && (
                <button type="button" onClick={resetForm} className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition">
                  إلغاء التعديل
                </button>
              )}
            </form>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-blue-600" />
              قائمة الموظفين ({users.length})
            </h2>
          </div>

          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-sm text-slate-500 border-b border-slate-200">
                  <th className="p-4 font-bold">الموظف</th>
                  <th className="p-4 font-bold">الصلاحية</th>
                  <th className="p-4 font-bold">الفرع</th>
                  <th className="p-4 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.email} className={`hover:bg-slate-50 transition ${!u.isActive ? 'opacity-50' : ''}`}>
                    <td className="p-4">
                      <div className="font-bold text-slate-800" dir="ltr">{u.email}</div>
                      <div className="text-xs text-slate-400">{u.name || 'بدون اسم'}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getRoleColor(u.role)}`}>
                        {getRoleName(u.role)}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-medium text-slate-600">
                      {u.branchId ? BRANCHES.find(b => b.id === u.branchId)?.name : '-'}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => toggleActive(u)} className={`p-2 rounded-lg transition ${u.isActive ? 'text-orange-500 hover:bg-orange-50' : 'text-green-500 hover:bg-green-50'}`}>
                          {u.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleEdit(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(u.email)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {users.map(u => (
              <div key={u.email} className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-200 ${!u.isActive ? 'opacity-60 bg-slate-50' : ''}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-bold text-slate-800 break-all" dir="ltr">{u.email}</div>
                    <div className="text-sm text-slate-400">{u.name || 'موظف غير مسمى'}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getRoleColor(u.role)}`}>
                    {getRoleName(u.role)}
                  </span>
                </div>
                <div className="flex items-center gap-4 py-3 border-y border-slate-50 mb-4 bg-slate-50/50 -mx-5 px-5">
                   <div className="text-xs font-bold text-slate-500">الفرع: {u.branchId ? BRANCHES.find(b => b.id === u.branchId)?.name : 'غير محدد'}</div>
                   <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                     {u.isActive ? 'نشط' : 'معطل'}
                   </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => toggleActive(u)} className={`flex items-center justify-center p-3 rounded-xl transition ${u.isActive ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                    {u.isActive ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                  </button>
                  <button onClick={() => handleEdit(u)} className="flex items-center justify-center p-3 bg-blue-50 text-blue-600 rounded-xl"><Edit2 className="w-5 h-5" /></button>
                  <button onClick={() => handleDelete(u.email)} className="flex items-center justify-center p-3 bg-red-50 text-red-600 rounded-xl"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>
            ))}
          </div>

          {users.length === 0 && !loading && (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500">لا يوجد موظفين مسجلين</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManager;
