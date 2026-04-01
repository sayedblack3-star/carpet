import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Branch } from '../types';
import { ClipboardList, Plus, Copy, CheckCircle, Clock, Search, Trash2, Store } from 'lucide-react';
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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  const [productName, setProductName] = useState('');
  const [notes, setNotes] = useState('');
  const [branchId, setBranchId] = useState(userBranchId || '');

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('*').eq('is_active', true);
    if (data) setBranches(data as Branch[]);
  };

  const fetchShortages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shortages')
      .select('*')
      .order('is_resolved', { ascending: true })
      .order('created_at', { ascending: false });

    if (data) setShortages(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchBranches();
    fetchShortages();

    const channel = supabase.channel('shortages-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shortages' }, () => fetchShortages())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (userBranchId && !branchId) setBranchId(userBranchId);
  }, [userBranchId]);

  const handleAddShortage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || !branchId) {
      toast.error('يرجى إكمال البيانات المطلوبة');
      return;
    }

    try {
      const { error } = await supabase.from('shortages').insert([{
        product_name: productName,
        notes: notes,
        branch_id: branchId,
        reported_by_name: userName || 'موظف'
      }]);

      if (error) throw error;

      toast.success('تم تسجيل المنتج الناقص بنجاح');
      setProductName('');
      setNotes('');
      setActiveTab('list');
    } catch (error: any) {
      toast.error('خطأ: ' + error.message);
    }
  };

  const toggleResolved = async (shortage: Shortage) => {
    const { error } = await supabase.from('shortages').update({ is_resolved: !shortage.is_resolved }).eq('id', shortage.id);
    if (!error) toast.success(shortage.is_resolved ? 'أعيد تسجيله كناقص' : 'تم تزويد المنتج للفرع');
  };

  const filteredShortages = shortages.filter(s => 
    s.product_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto pb-24" dir="rtl">
      <header className="mb-8 flex items-center gap-4">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-[1.5rem] flex items-center justify-center shadow-sm">
          <ClipboardList className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-800">قائمة النواقص</h1>
          <p className="text-slate-500 font-medium">متابعة طلبات المنتجات غير المتوفرة</p>
        </div>
      </header>

      <div className="flex bg-white/50 backdrop-blur-md p-1.5 rounded-[1.5rem] border border-white/50 shadow-sm mb-10 w-full sm:w-[400px]">
        <button 
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-3 text-sm font-black rounded-xl transition flex items-center justify-center gap-2 ${activeTab === 'list' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}
        >
          عرض النواقص
        </button>
        <button 
          onClick={() => setActiveTab('add')}
          className={`flex-1 py-3 text-sm font-black rounded-xl transition flex items-center justify-center gap-2 ${activeTab === 'add' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}
        >
          تسجيل منتج
        </button>
      </div>

      {activeTab === 'add' ? (
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-white max-w-2xl mx-auto animate-in zoom-in-95 duration-200">
          <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2">
            <Plus className="w-6 h-6 text-red-500" /> إضافة طلب نواقص جديد
          </h2>
          <form onSubmit={handleAddShortage} className="space-y-6">
            <div className="space-y-2">
               <label className="text-sm font-bold text-slate-700 mr-2">اسم أو كود المنتج</label>
               <input required type="text" value={productName} onChange={e => setProductName(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold focus:ring-4 focus:ring-red-100 transition-all outline-none" placeholder="مثلاً: سجاد تركي 2*3 أحمر" />
            </div>

            <div className="space-y-2">
               <label className="text-sm font-bold text-slate-700 mr-2">الفرع المطلوب له</label>
               <select value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold focus:ring-4 focus:ring-red-100 transition-all outline-none appearance-none">
                 <option value="">اختر الفرع...</option>
                 {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
               </select>
            </div>

            <div className="space-y-2">
               <label className="text-sm font-bold text-slate-700 mr-2">تفاصيل إضافية</label>
               <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold h-32 resize-none focus:ring-4 focus:ring-red-100 transition-all outline-none" placeholder="أي معلومات أخرى تساعد في توفير المنتج..." />
            </div>

            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-[1.8rem] text-lg shadow-xl shadow-red-100 transition-all">إرسال الطلب الآن</button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="relative group max-w-md">
            <input 
              type="text" 
              placeholder="البحث في قائمة النواقص..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-12 py-4 rounded-2xl bg-white border border-slate-100 shadow-sm focus:ring-4 focus:ring-red-100 outline-none font-bold"
            />
            <Search className="w-5 h-5 text-slate-300 absolute right-4 top-1/2 -translate-y-1/2 group-focus-within:text-red-500 transition-colors" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {loading ? [1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-[2rem]"></div>) : 
              filteredShortages.map(shortage => (
                <div key={shortage.id} className={`bg-white p-6 rounded-[2rem] border transition-all ${shortage.is_resolved ? 'opacity-60 grayscale border-slate-50' : 'border-slate-100 shadow-sm hover:shadow-xl'}`}>
                   <div className="flex justify-between items-start mb-6">
                      <h4 className={`text-lg font-black text-slate-800 ${shortage.is_resolved ? 'line-through' : ''}`}>
                        {shortage.product_name}
                      </h4>
                      <button onClick={() => toggleResolved(shortage)} className={`p-2 rounded-xl transition-all ${shortage.is_resolved ? 'bg-slate-50 text-slate-400' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                        {shortage.is_resolved ? <Clock className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                      </button>
                   </div>
                   
                   <p className="text-slate-500 text-sm font-medium mb-6 line-clamp-2 min-h-[40px] italic">
                     {shortage.notes || 'لا توجد ملاحظات.'}
                   </p>

                   <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Store className="w-4 h-4" />
                        <span className="text-[10px] font-bold">{branches.find(b => b.id === shortage.branch_id)?.name || 'غير معروف'}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-300">{format(new Date(shortage.created_at), 'yyyy-MM-dd')}</span>
                   </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
