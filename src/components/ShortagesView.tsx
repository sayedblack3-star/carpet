import React, { useEffect, useState } from 'react';
import { getSafeSession, supabase } from '../supabase';
import { Shortage } from '../types';
import { ClipboardList, Plus, CheckCircle, Clock, Search, Copy, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { setupRealtimeFallback } from '../lib/realtimeFallback';

interface ShortagesViewProps {
  userName: string;
  branchId?: string | null;
  branchName?: string;
  branchEnabled?: boolean;
}

export default function ShortagesView({ userName, branchId, branchName, branchEnabled = false }: ShortagesViewProps) {
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [notes, setNotes] = useState('');

  const fetchShortages = async () => {
    setLoading(true);
    let query = supabase.from('shortages').select('*');
    if (branchEnabled && branchId) {
      query = query.eq('branch_id', branchId);
    }
    const { data } = await query.order('is_resolved', { ascending: true }).order('created_at', { ascending: false });
    if (data) setShortages(data as Shortage[]);
    setLoading(false);
  };

  useEffect(() => {
    void fetchShortages();
    return setupRealtimeFallback({
      fetchNow: fetchShortages,
      createChannel: () =>
        supabase.channel('shortages-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'shortages' }, () => fetchShortages()),
      pollIntervalMs: 20000,
    });
  }, [branchId, branchEnabled]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName) {
      toast.error('يرجى إدخال اسم المنتج');
      return;
    }

    const session = await getSafeSession();

    const payload: Record<string, any> = {
      product_name: productName,
      product_code: productCode,
      notes,
      reported_by_name: userName,
      reported_by_id: session?.user?.id,
    };

    if (branchEnabled && branchId) {
      payload.branch_id = branchId;
    }

    const { error } = await supabase.from('shortages').insert(payload);
    if (error) {
      toast.error(`خطأ: ${error.message}`);
      return;
    }

    toast.success('تم تسجيل المنتج الناقص');
    setProductName('');
    setProductCode('');
    setNotes('');
    setActiveTab('list');
  };

  const toggleResolved = async (shortage: Shortage) => {
    await supabase.from('shortages').update({ is_resolved: !shortage.is_resolved }).eq('id', shortage.id);
    toast.success(shortage.is_resolved ? 'أعيد تسجيله كنقص' : 'تم توفير المنتج');
  };

  const copyShortage = async (shortage: Shortage) => {
    const text = [`اسم المنتج: ${shortage.product_name}`, shortage.product_code ? `الكود: ${shortage.product_code}` : '', shortage.notes ? `ملاحظات: ${shortage.notes}` : '']
      .filter(Boolean)
      .join('\n');

    await navigator.clipboard.writeText(text);
    toast.success('تم نسخ بيانات المنتج الناقص');
  };

  const filtered = shortages.filter(
    (shortage) =>
      shortage.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (shortage.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (shortage.product_code || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto pb-24" dir="rtl">
      <header className="mb-8 flex items-center gap-4">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shadow-sm">
          <ClipboardList className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-800">قائمة النواقص</h1>
          <p className="text-slate-500 font-medium">متابعة المنتجات غير المتوفرة وإرسالها للإدارة</p>
        </div>
      </header>

      {branchEnabled && branchName && (
        <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-black text-blue-900 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> {branchName}
        </div>
      )}

      <div className="flex bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border shadow-sm mb-10 w-full sm:w-[400px]">
        <button onClick={() => setActiveTab('list')} className={`flex-1 py-3 text-sm font-black rounded-xl transition flex items-center justify-center gap-2 ${activeTab === 'list' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}>
          عرض النواقص
        </button>
        <button onClick={() => setActiveTab('add')} className={`flex-1 py-3 text-sm font-black rounded-xl transition flex items-center justify-center gap-2 ${activeTab === 'add' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}>
          تسجيل منتج
        </button>
      </div>

      {activeTab === 'add' ? (
        <div className="bg-white p-8 rounded-3xl shadow-xl border max-w-2xl mx-auto">
          <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2">
            <Plus className="w-6 h-6 text-red-500" /> تسجيل نقص جديد
          </h2>
          <form onSubmit={handleAdd} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-slate-700">اسم المنتج</label>
                <input required type="text" value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border font-bold focus:ring-4 focus:ring-red-100 outline-none" placeholder="مثال: سجادة 2×3" />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700">كود المنتج</label>
                <input type="text" value={productCode} onChange={(e) => setProductCode(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border font-bold focus:ring-4 focus:ring-red-100 outline-none" placeholder="اختياري" />
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700">تفاصيل إضافية</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border font-bold h-32 resize-none focus:ring-4 focus:ring-red-100 outline-none" placeholder="أي معلومات أخرى..." />
            </div>
            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-2xl text-lg shadow-xl shadow-red-100">
              إرسال الطلب
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="relative max-w-md">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="ابحث بالاسم أو الكود..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pr-12 pl-4 py-4 rounded-2xl bg-white border shadow-sm focus:ring-4 focus:ring-red-100 outline-none font-bold" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading
              ? [1, 2, 3].map((i) => <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-2xl" />)
              : filtered.map((shortage) => (
                  <div key={shortage.id} className={`bg-white p-6 rounded-2xl border transition-all ${shortage.is_resolved ? 'opacity-60 grayscale' : 'shadow-sm hover:shadow-xl'}`}>
                    <div className="flex justify-between items-start mb-4 gap-3">
                      <div>
                        <h4 className={`text-lg font-black text-slate-800 ${shortage.is_resolved ? 'line-through' : ''}`}>{shortage.product_name}</h4>
                        {shortage.product_code && <span className="text-xs text-slate-400 font-bold">كود: {shortage.product_code}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => copyShortage(shortage)} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100" title="نسخ">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleResolved(shortage)} className={`p-2 rounded-xl ${shortage.is_resolved ? 'bg-slate-50 text-slate-400' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                          {shortage.is_resolved ? <Clock className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-4 line-clamp-2 italic">{shortage.notes || 'لا توجد ملاحظات'}</p>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400">{shortage.reported_by_name}</span>
                      <span className="text-[10px] font-bold text-slate-300">{format(new Date(shortage.created_at), 'yyyy-MM-dd')}</span>
                    </div>
                  </div>
                ))}
          </div>
          {!loading && filtered.length === 0 && <p className="text-center py-12 text-slate-400 font-bold">لا توجد نواقص مسجلة</p>}
        </div>
      )}
    </div>
  );
}
