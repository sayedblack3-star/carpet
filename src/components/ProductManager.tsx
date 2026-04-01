import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Product } from '../types';
import { Plus, Trash2, Package, Search, CheckCircle, XCircle, Edit, X, TrendingUp, DollarSign, Layers, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { logAction } from '../lib/logger';

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Product>>({
    code: '',
    name: '',
    description: '',
    price_buy: 0,
    price_sell_before: 0,
    price_sell_after: 0,
    stock_quantity: 0,
    min_stock_level: 5,
    category: '',
    is_active: true
  });

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (data) setProducts(data as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
    const channel = supabase.channel('products-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchProducts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && editingId) {
        const { error } = await supabase.from('products').update(formData).eq('id', editingId);
        if (error) throw error;
        toast.success('تم تحديث بيانات المنتج بنجاح');
      } else {
        const { error } = await supabase.from('products').insert([formData]);
        if (error) throw error;
        toast.success('تم إضافة المنتج الجديد للمخزن');
      }
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast.error('حدث خطأ: ' + error.message);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({ code: '', name: '', price_buy: 0, price_sell_before: 0, stock_quantity: 0, min_stock_level: 5, is_active: true });
  };

  const deleteProduct = async (id: string) => {
    if (!window.confirm('هل تريد أرشفة هذا المنتج؟ لن يظهر في لوحة البيع.')) return;
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (!error) toast.info('تمت أرشفة المنتج');
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
             <Package className="w-8 h-8 text-orange-500" /> إدارة المخزون الاحترافي
          </h1>
          <p className="text-slate-500 font-medium mt-1">نظام ERP لتسعير وجرد المنتجات</p>
        </div>
        
        <div className="relative group">
          <input 
            type="text" 
            placeholder="بحث بالكود أو الاسم..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full sm:w-80 px-12 py-3.5 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-orange-100 outline-none font-bold shadow-sm"
          />
          <Search className="w-5 h-5 text-slate-300 absolute right-4 top-1/2 -translate-y-1/2 group-focus-within:text-orange-500 transition-colors" />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 bg-white/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl border border-white sticky top-24">
           <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2">
             {isEditing ? <Edit className="w-6 h-6 text-orange-500" /> : <Plus className="w-6 h-6 text-orange-500" />}
             {isEditing ? 'تعديل بيانات منتج' : 'إضافة منتج جديد'}
           </h2>

           <form onSubmit={handleSubmit} className="space-y-5">
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-xs font-bold text-slate-400 mr-2 block mb-1">كود المنتج</label>
                 <input required type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold" />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-400 mr-2 block mb-1">التصنيف</label>
                 <input type="text" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold" />
               </div>
             </div>

             <div>
               <label className="text-xs font-bold text-slate-400 mr-2 block mb-1">اسم المنتج</label>
               <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold" />
             </div>

             <div className="grid grid-cols-3 gap-3">
               <div>
                 <label className="text-[10px] font-bold text-slate-400 block mb-1">سعر الشراء</label>
                 <input required type="number" value={formData.price_buy} onChange={e => setFormData({...formData, price_buy: parseFloat(e.target.value)})} className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-100 font-bold text-red-500" />
               </div>
               <div>
                 <label className="text-[10px] font-bold text-slate-400 block mb-1">السعر الأصلي</label>
                 <input required type="number" value={formData.price_sell_before} onChange={e => setFormData({...formData, price_sell_before: parseFloat(e.target.value)})} className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-100 font-bold text-slate-700" />
               </div>
               <div>
                 <label className="text-[10px] font-bold text-slate-400 block mb-1">سعر البيع</label>
                 <input type="number" value={formData.price_sell_after} onChange={e => setFormData({...formData, price_sell_after: parseFloat(e.target.value)})} className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-100 font-bold text-emerald-600" />
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-xs font-bold text-slate-400 mr-2 block mb-1">الكمية بالمخزن</label>
                 <input required type="number" value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: parseInt(e.target.value)})} className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold" />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-400 mr-2 block mb-1">أقل كمية (تنبيه)</label>
                 <input required type="number" value={formData.min_stock_level} onChange={e => setFormData({...formData, min_stock_level: parseInt(e.target.value)})} className="w-full px-5 py-3 rounded-2xl bg-amber-50 border border-amber-100 font-bold text-amber-700" />
               </div>
             </div>

             <div className="flex gap-4 pt-4">
               <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl transition shadow-xl shadow-orange-100">
                 {isEditing ? 'تحديث البيانات' : 'إضافة الآن'}
               </button>
               {isEditing && (
                 <button type="button" onClick={resetForm} className="px-6 bg-slate-100 text-slate-500 rounded-2xl"><X className="w-6 h-6"/></button>
               )}
             </div>
           </form>
        </div>

        <div className="lg:col-span-8 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                   {product.stock_quantity <= product.min_stock_level && (
                     <div className="absolute top-0 right-0 p-3 bg-amber-500 text-white rounded-bl-3xl">
                       <AlertCircle className="w-5 h-5 animate-pulse" />
                     </div>
                   )}
                   
                   <div className="flex items-start justify-between mb-6">
                     <div>
                       <span className="text-xs font-bold text-orange-500 mb-1 block uppercase tracking-widest">{product.category || 'بدون تصنيف'}</span>
                       <h3 className="text-xl font-black text-slate-800">{product.name}</h3>
                       <p className="text-slate-400 font-bold text-sm">كود: {product.code}</p>
                     </div>
                     <div className="text-left">
                       <span className="text-2xl font-black text-slate-800">{(product.price_sell_after || product.price_sell_before)} ج.م</span>
                       <div className="flex items-center gap-2 justify-end mt-1">
                          {product.price_sell_after && product.price_sell_before > product.price_sell_after && (
                            <span className="text-xs text-slate-300 line-through font-bold">{product.price_sell_before}</span>
                          )}
                          <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg text-[10px] font-black">
                            ربح {((product.price_sell_after || product.price_sell_before) - (product.price_buy || 0)).toFixed(1)} ج.م
                          </span>
                       </div>
                     </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                         <span className="text-[10px] font-bold text-slate-400 block mb-1">المخزون الحالي</span>
                         <div className="flex items-center gap-2">
                           <Layers className="w-4 h-4 text-slate-400" />
                           <span className={`text-lg font-black ${product.stock_quantity <= product.min_stock_level ? 'text-amber-500' : 'text-slate-700'}`}>
                             {product.stock_quantity} قطعة
                           </span>
                         </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                         <span className="text-[10px] font-bold text-slate-400 block mb-1">رأس مال المنتج</span>
                         <div className="flex items-center gap-2">
                           <DollarSign className="w-4 h-4 text-slate-400" />
                           <span className="text-lg font-black text-slate-700">{product.price_buy} ج.م</span>
                         </div>
                      </div>
                   </div>

                   <div className="flex gap-2">
                      <button onClick={() => setIsEditing(true) || setEditingId(product.id) || setFormData(product)} className="flex-1 bg-slate-50 hover:bg-orange-50 text-slate-400 hover:text-orange-500 py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-bold text-sm">
                        <Edit className="w-4 h-4" /> تعديل
                      </button>
                      <button onClick={() => deleteProduct(product.id)} className="p-3 bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all">
                        <Trash2 className="w-5 h-5" />
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
