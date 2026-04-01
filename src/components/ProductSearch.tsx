import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Product } from '../types';
import { Search, Package } from 'lucide-react';
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
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setProduct({ 
          id: data.id, 
          code: data.code,
          name: data.name,
          price_sell_before: data.price_sell_before,
          price_sell_after: data.price_sell_after,
          stock_quantity: data.stock_quantity,
          min_stock_level: data.min_stock_level,
          category: data.category,
          is_active: data.is_active
        });
      } else {
        setProduct(null);
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء البحث');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Search className="w-6 h-6 text-blue-600" />
          البحث برقم الكود
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder="أدخل كود السجادة (مثال: A-123)"
            className="flex-1 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-70"
          >
            {loading ? 'جاري...' : 'بحث'}
          </button>
        </form>
      </div>

      {searched && !loading && (
        product ? (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <h3 className="text-2xl font-bold text-slate-800">{product.name}</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${product.stock_quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {product.stock_quantity > 0 ? 'متوفر' : 'غير متوفر'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <div className="text-sm text-slate-500">كود الموديل</div>
                  <div className="font-bold text-lg text-slate-800">{product.code}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">السعر الأساسي</div>
                  <div className="font-bold text-lg text-blue-600">{product.price_sell_before} ج.م</div>
                </div>
                {product.price_sell_after && product.price_sell_after < product.price_sell_before && (
                  <div className="col-span-2 bg-blue-50 p-3 rounded-lg border border-blue-100 flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-800">السعر بعد الخصم:</span>
                    <span className="text-lg font-bold text-blue-600">
                      {product.price_sell_after} ج.م
                    </span>
                  </div>
                )}
                {product.category && (
                  <div className="col-span-2">
                    <div className="text-sm text-slate-500">التصنيف</div>
                    <div className="font-medium text-slate-800">{product.category}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 text-center">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">لم يتم العثور على المنتج</h3>
            <p className="text-slate-500">تأكد من كتابة الكود بشكل صحيح وحاول مرة أخرى.</p>
          </div>
        )
      )}
    </div>
  );
}
