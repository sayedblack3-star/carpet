import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { BRANCHES } from '../types';
import { ClipboardList, Plus, Copy, CheckCircle, Clock, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ShortagesViewProps {
  userBranchId?: string | null;
  userName: string;
}

interface Shortage {
  id: string;
  product_name: string;
  notes: string;
  branch_id: string;
  reported_by_name: string;
  created_at: string;
  is_resolved: boolean;
}

export default function ShortagesView({ userBranchId, userName }: ShortagesViewProps) {
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [productName, setProductName] = useState('');
  const [notes, setNotes] = useState('');
  const [branchId, setBranchId] = useState(userBranchId || '');

  useEffect(() => {
    if (userBranchId && !branchId) setBranchId(userBranchId);
  }, [userBranchId]);

  useEffect(() => {
    const fetchShortages = async () => {
      const { data, error } = await supabase
        .from('shortages')
        .select('*')
        .order('is_resolved', { ascending: true })
        .order('created_at', { ascending: false });

      if (data) {
        setShortages(data);
      }
      setLoading(false);
    };

    fetchShortages();

    const channel = supabase.channel('shortages-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shortages' }, payload => {
        fetchShortages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAddShortage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName) {
      toast.error('يرجى إدخال اسم أو كود المنتج الناقص');
      return;
    }
    if (!branchId) {
      toast.error('يرجى اختيار الفرع');
      return;
    }

    try {
      const { error } = await supabase.from('shortages').insert([{
        product_name: productName,
        notes: notes,
        branch_id: branchId,
        reported_by_name: userName || 'غير معروف'
      }]);

      if (error) throw error;

      toast.success('تم تسجيل المنتج في قائمة النواقص');
      setProductName('');
      setNotes('');
      setActiveTab('list');
    } catch (error) {
      toast.error('حدث خطأ أثناء تسجيل النواقص');
      console.error(error);
    }
  };

  const toggleResolved = async (shortage: Shortage) => {
    try {
      const { error } = await supabase.from('shortages').update({
        is_resolved: !shortage.is_resolved
      }).eq('id', shortage.id);

      if (error) throw error;
      toast.success(shortage.is_resolved ? 'تم إعادة المنتج كمنتج ناقص' : 'تم توفير المنتج');
    } catch (error) {
      toast.error('حدث خطأ أثناء تحديث الحالة');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('تم النسخ للحافظة');
    });
  };

  const filteredShortages = shortages.filter(s => 
    s.product_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
          <ClipboardList className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">سجل النواقص</h1>
          <p className="text-slate-500">متابعة المنتجات الغير متوفرة في الفروع</p>
        </div>
      </div>

      <div className="flex p-1 bg-slate-100 rounded-xl overflow-hidden shadow-inner">
        <button 
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <ClipboardList className="w-4 h-4" /> عرض النواقص ({shortages.filter(s => !s.is_resolved).length})
        </button>
        <button 
          onClick={() => setActiveTab('add')}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${activeTab === 'add' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Plus className="w-4 h-4" /> إضافة منتج ناقص
        </button>
      </div>

      {activeTab === 'add' ? (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-red-500" /> تسجيل منتج غير متوفر
          </h2>
          <form onSubmit={handleAddShortage} className="space-y-4 max-w-xl mx-auto">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الفرع</label>
              {userBranchId ? (
                <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
                  {BRANCHES.find(b => b.id === userBranchId)?.name || 'فرع غير معروف'}
                </div>
              ) : (
                <select
                  required
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- اختر الفرع --</option>
                  {BRANCHES.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">اسم/كود المنتج الناقص</label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="تفاصيل المنتج المطلوب..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات إضافية (اختياري)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                placeholder="مقاس معين، لون معين، الخ..."
              ></textarea>
            </div>
            <button
              type="submit"
              className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              تسجيل كمنتج ناقص
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <input 
              type="text" 
              placeholder="ابحث في النواقص..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 pr-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <Search className="w-5 h-5 text-slate-400 absolute right-3 top-3.5" />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-500">جاري التحميل...</div>
              ) : filteredShortages.length === 0 ? (
                <div className="p-8 text-center text-slate-500">لا توجد نواقص مسجلة حالياً</div>
              ) : (
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="p-4 font-semibold">المنتج</th>
                      <th className="p-4 font-semibold">ملاحظات</th>
                      <th className="p-4 font-semibold">الفرع</th>
                      <th className="p-4 font-semibold">بواسطة</th>
                      <th className="p-4 font-semibold">التاريخ</th>
                      <th className="p-4 font-semibold text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredShortages.map(shortage => (
                      <tr key={shortage.id} className={`hover:bg-slate-50 transition ${shortage.is_resolved ? 'opacity-50 line-through text-slate-400' : ''}`}>
                        <td className="p-4 font-medium text-slate-800">
                          <div className="flex items-center gap-2">
                            {shortage.product_name}
                            <button onClick={() => copyToClipboard(shortage.product_name)} className="text-slate-400 hover:text-blue-500 transition">
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-slate-600">{shortage.notes || '-'}</td>
                        <td className="p-4">{BRANCHES.find(b => b.id === shortage.branch_id)?.name || shortage.branch_id}</td>
                        <td className="p-4">{shortage.reported_by_name}</td>
                        <td className="p-4">{format(new Date(shortage.created_at), 'yyyy-MM-dd HH:mm')}</td>
                        <td className="p-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() => toggleResolved(shortage)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${shortage.is_resolved ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                            >
                              {shortage.is_resolved ? <Clock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                              {shortage.is_resolved ? 'التراجع' : 'متوفر الآن'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
