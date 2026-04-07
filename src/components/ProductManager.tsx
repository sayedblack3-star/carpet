import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Product } from '../types';
import productsSeed from '../data.json';
import { Package, Plus, Edit2, Trash2, Search, X, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    category: '',
    price_buy: 0,
    price_sell_before: 0,
    price_sell_after: 0,
    stock_quantity: 0,
    min_stock_level: 5,
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
    if (data) setProducts(data as Product[]);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      toast.error('الكود والاسم مطلوبان');
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('products').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editingId);
        if (error) throw error;
        toast.success('تم تحديث المنتج');
      } else {
        const { error } = await supabase.from('products').insert({ ...form, is_active: true, is_deleted: false });
        if (error) throw error;
        toast.success('تمت إضافة المنتج');
      }

      resetForm();
      fetchProducts();
    } catch (err: any) {
      toast.error(`خطأ: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('products').update({ is_deleted: true }).eq('id', id);
    if (!error) {
      toast.success('تم حذف المنتج');
      fetchProducts();
    }
  };

  const importFromJSON = async () => {
    setImporting(true);
    try {
      const items = productsSeed.map((product: any) => ({
        code: product.code,
        name: product.name,
        price_sell_before: product.price_before || 0,
        price_sell_after: product.price_after || 0,
        stock_quantity: 10,
        min_stock_level: 5,
        is_active: true,
        is_deleted: false,
      }));

      for (let i = 0; i < items.length; i += 50) {
        const batch = items.slice(i, i + 50);
        const { error } = await supabase.from('products').upsert(batch, { onConflict: 'code', ignoreDuplicates: true });
        if (error) console.warn('Batch error:', error.message);
      }

      toast.success(`تم استيراد ${items.length} منتج بنجاح`);
      fetchProducts();
    } catch (err: any) {
      toast.error(`خطأ في الاستيراد: ${err.message}`);
    }
    setImporting(false);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({
      code: '',
      name: '',
      description: '',
      category: '',
      price_buy: 0,
      price_sell_before: 0,
      price_sell_after: 0,
      stock_quantity: 0,
      min_stock_level: 5,
    });
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setShowForm(true);
    setForm({
      code: product.code,
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      price_buy: product.price_buy || 0,
      price_sell_before: product.price_sell_before,
      price_sell_after: product.price_sell_after || 0,
      stock_quantity: product.stock_quantity,
      min_stock_level: product.min_stock_level || 5,
    });
  };

  const filtered = products.filter(
    (product) => product.name.toLowerCase().includes(searchTerm.toLowerCase()) || product.code.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto min-h-full" dir="rtl">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <Package className="w-8 h-8 text-purple-600" /> إدارة المنتجات وتعديل الأسعار
          </h1>
          <p className="text-slate-500 font-medium mt-1">{products.length} منتج مسجل</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={importFromJSON}
            disabled={importing}
            className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> {importing ? 'جارٍ الاستيراد...' : 'استيراد البيانات'}
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-slate-800">
            <Plus className="w-5 h-5" /> إضافة منتج
          </button>
        </div>
      </header>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-800">{editingId ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">كود المنتج</label>
                  <input required type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none focus:ring-2 focus:ring-purple-100" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">التصنيف</label>
                  <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none" placeholder="مثال: مفروشات" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">اسم المنتج</label>
                <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none focus:ring-2 focus:ring-purple-100" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">الوصف</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">سعر الشراء</label>
                  <input type="number" step="0.01" value={form.price_buy} onChange={(e) => setForm({ ...form, price_buy: +e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none text-center" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">السعر قبل الخصم</label>
                  <input required type="number" step="0.01" value={form.price_sell_before} onChange={(e) => setForm({ ...form, price_sell_before: +e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none text-center" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">السعر بعد الخصم</label>
                  <input type="number" step="0.01" value={form.price_sell_after} onChange={(e) => setForm({ ...form, price_sell_after: +e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none text-center" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">الكمية المتوفرة</label>
                  <input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: +e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none text-center" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">حد أدنى للتنبيه</label>
                  <input type="number" value={form.min_stock_level} onChange={(e) => setForm({ ...form, min_stock_level: +e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50 border font-bold outline-none text-center" />
                </div>
              </div>

              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-slate-800 active:scale-[0.98] flex items-center justify-center gap-2">
                <Save className="w-5 h-5" /> {editingId ? 'تحديث' : 'إضافة المنتج'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
        أي تحديث في الأسعار أو بيانات المنتج من هنا ينعكس على شاشات البائع والكاشير في الموقع كله بعد الضغط على تحديث.
      </div>

      <div className="relative max-w-md mb-8">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="ابحث بالاسم أو الكود..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pr-12 pl-4 py-4 bg-white border rounded-2xl shadow-sm font-bold outline-none focus:ring-4 focus:ring-purple-100"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading
          ? [1, 2, 3, 4].map((i) => <div key={i} className="h-56 bg-white animate-pulse rounded-2xl border" />)
          : filtered.map((product) => (
              <div key={product.id} className="bg-white p-5 rounded-2xl border shadow-sm hover:shadow-lg transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full">{product.code}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                      product.stock_quantity > product.min_stock_level
                        ? 'bg-emerald-50 text-emerald-600'
                        : product.stock_quantity > 0
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {product.stock_quantity} قطعة
                  </span>
                </div>

                <h3 className="font-black text-slate-800 mb-1 line-clamp-2 leading-snug">{product.name}</h3>
                <p className="text-xs text-slate-400 mb-4">{product.category || 'بدون تصنيف'}</p>

                <div className="flex items-end justify-between mb-4">
                  <div>
                    {product.price_sell_after > 0 && product.price_sell_after < product.price_sell_before ? (
                      <>
                        <span className="text-xs text-slate-400 line-through block">{product.price_sell_before}</span>
                        <span className="text-lg font-black text-blue-600">{product.price_sell_after} ج.م</span>
                      </>
                    ) : (
                      <span className="text-lg font-black text-slate-800">{product.price_sell_before} ج.م</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => startEdit(product)} className="flex-1 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1">
                    <Edit2 className="w-3 h-3" /> تعديل
                  </button>
                  <button onClick={() => handleDelete(product.id)} className="py-2 px-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
      </div>

      {!loading && filtered.length === 0 && <p className="text-center py-16 text-slate-400 font-bold">لا توجد منتجات</p>}
    </div>
  );
}
