import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Shortage } from '../types';
import { ClipboardList, Plus, CheckCircle, Clock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ShortagesViewProps { userName: string; }

export default function ShortagesView({ userName }: ShortagesViewProps) {
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [notes, setNotes] = useState('');

  const fetchShortages = async () => {
    setLoading(true);
    const { data } = await supabase.from('shortages').select('*')
      .order('is_resolved', { ascending: true })
      .order('created_at', { ascending: false });
    if (data) setShortages(data as Shortage[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchShortages();
    const channel = supabase.channel('shortages-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shortages' }, () => fetchShortages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName) { toast.error('يرجى إدخال اسم المنتج'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('shortages').insert({ product_name: productName, product_code: productCode, notes, reported_by_name: userName, reported_by_id: session?.user?.id });
    if (error) { toast.error('خطأ: ' + error.message); return; }
    toast.success('تم تسجيل المنتج الناقص');
    setProductName(''); setProductCode(''); setNotes(''); setActiveTab('list');
  };

  const toggleResolved = async (s: Shortage) => {
    await supabase.from('shortages').update({ is_resolved: !s.is_resolved }).eq('id', s.id);
    toast.success(s.is_resolved ? 'أعيد تسجيله كناقص' : 'تم تزويد المنتج');
  };

  const filtered = shortages.filter(s => s.product_name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.notes || '').toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto pb-24" dir="rtl">
      <header className="mb-8 flex items-center gap-4">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shadow-sm"><ClipboardList className="w-8 h-8" /></div>
        <div><h1 className="text-3xl font-black text-slate-800">قائمة النواقص</h1><p className="text-slate-500 font-medium">متابعة المنتجات غير المتوفرة</p></div>
      </header>

      <div className="flex bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border shadow-sm mb-10 w-full sm:w-[400px]">
        <button onClick={() => setActiveTab('list')} className={`flex-1 py-3 text-sm font-black rounded-xl transition flex items-center justify-center gap-2 ${activeTab === 'list' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}>عرض النواقص</button>
        <button onClick={() => setActiveTab('add')} className={`flex-1 py-3 text-sm font-black rounded-xl transition flex items-center justify-center gap-2 ${activeTab === 'add' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}>تسجيل منتج</button>
      </div>

      {activeTab === 'add' ? (
        <div className="bg-white p-8 rounded-3xl shadow-xl border max-w-2xl mx-auto">
          <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2"><Plus className="w-6 h-6 text-red-500" /> تسجيل نقص جديد</h2>
          <form onSubmit={handleAdd} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-slate-700">اسم المنتج</label>
                <input required type="text" value={productName} onChange={e => setProductName(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border font-bold focus:ring-4 focus:ring-red-100 outline-none" placeholder="مثال: سجاد تركي 2*3" />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700">كود المنتج</label>
                <input type="text" value={productCode} onChange={e => setProductCode(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border font-bold focus:ring-4 focus:ring-red-100 outline-none" placeholder="اختياري" />
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700">تفاصيل إضافية</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border font-bold h-32 resize-none focus:ring-4 focus:ring-red-100 outline-none" placeholder="أي معلومات أخرى..." />
            </div>
            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-2xl text-lg shadow-xl shadow-red-100">إرسال الطلب</button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="relative max-w-md">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="البحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pr-12 pl-4 py-4 rounded-2xl bg-white border shadow-sm focus:ring-4 focus:ring-red-100 outline-none font-bold" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? [1, 2, 3].map(i => <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-2xl"></div>) :
              filtered.map(s => (
                <div key={s.id} className={`bg-white p-6 rounded-2xl border transition-all ${s.is_resolved ? 'opacity-60 grayscale' : 'shadow-sm hover:shadow-xl'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className={`text-lg font-black text-slate-800 ${s.is_resolved ? 'line-through' : ''}`}>{s.product_name}</h4>
                      {s.product_code && <span className="text-xs text-slate-400 font-bold">كود: {s.product_code}</span>}
                    </div>
                    <button onClick={() => toggleResolved(s)} className={`p-2 rounded-xl ${s.is_resolved ? 'bg-slate-50 text-slate-400' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                      {s.is_resolved ? <Clock className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-slate-500 text-sm font-medium mb-4 line-clamp-2 italic">{s.notes || 'لا توجد ملاحظات'}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400">{s.reported_by_name}</span>
                    <span className="text-[10px] font-bold text-slate-300">{format(new Date(s.created_at), 'yyyy-MM-dd')}</span>
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
