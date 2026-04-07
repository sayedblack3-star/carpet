import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Product } from '../types';
import { Search, Package, Tag } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductSearch() {
  const [searchCode, setSearchCode] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCode.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.from('products').select('*').eq('code', searchCode.trim()).single();

      if (error && error.code !== 'PGRST116') throw error;

      setProduct(data ? (data as Product) : null);
    } catch {
      toast.error('حدث خطأ أثناء البحث عن المنتج');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6 pt-4" dir="rtl">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-2 h-full bg-blue-500"></div>
        <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
          <Search className="w-8 h-8 text-blue-600" />
          البحث بكود المنتج
        </h2>
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="أدخل كود المنتج"
              className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-lg transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black text-lg hover:bg-slate-800 transition disabled:opacity-70 shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-3"
          >
            {loading ? (
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Search className="w-6 h-6" /> ابحث الآن
              </>
            )}
          </button>
        </form>
      </div>

      {searched && !loading && (
        product ? (
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 relative group">
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <div className="space-y-8">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-3xl font-black text-slate-800 mb-1">{product.name}</h3>
                  <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">{product.code}</p>
                </div>
                <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${product.stock_quantity > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {product.stock_quantity > 0 ? 'متوفر' : 'غير متوفر'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8 border-t border-slate-100">
                <div className="space-y-1 rounded-2xl bg-slate-50 border border-slate-100 p-5">
                  <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">التصنيف</div>
                  <div className="font-black text-lg text-slate-800">{product.category || 'غير مصنف'}</div>
                </div>
                <div className="space-y-1 rounded-2xl bg-slate-50 border border-slate-100 p-5">
                  <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">السعر قبل الخصم</div>
                  <div className="font-black text-2xl text-slate-800 tracking-tighter">{product.price_sell_before} <small className="text-xs">ج.م</small></div>
                </div>

                <div className="sm:col-span-2 rounded-[2rem] bg-blue-600 p-6 shadow-xl shadow-blue-600/20 text-white">
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <Tag className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-black uppercase tracking-widest leading-none">السعر بعد الخصم</span>
                    </div>
                    <div className="text-left">
                      <span className="text-3xl font-black tracking-tighter">
                        {(product.price_sell_after || product.price_sell_before).toLocaleString()} <small className="text-xs">ج.م</small>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Package className="w-5 h-5 text-slate-400" />
                  <p className="text-xs font-bold text-slate-500">
                    الكمية المتاحة حاليًا هي <b className="text-slate-800">{product.stock_quantity}</b> قطعة.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 text-center animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-12 h-12 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-1">لم يتم العثور على المنتج</h3>
            <p className="text-slate-500 font-medium">تأكد من الكود ثم حاول مرة أخرى.</p>
          </div>
        )
      )}
    </div>
  );
}
