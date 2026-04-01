import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Product } from '../types';
import { Plus, Trash2, Package, Search, CheckCircle, XCircle, Edit, X } from 'lucide-react';
import { toast } from 'sonner';
import { logAction } from '../lib/logger';

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [size, setSize] = useState('');
  const [inStock, setInStock] = useState(true);
  const [quantity, setQuantity] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (data) {
        setProducts(data.map((d: any) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          price_before: d.price_before,
          price_after: d.price_after,
          price: d.price_before, // mapping for legacy usage
          discountPercentage: d.discount_percentage,
          size: d.size,
          inStock: d.in_stock,
          quantity: d.quantity,
          isDeleted: d.is_deleted
        })));
      }
    };
    
    fetchProducts();

    const channel = supabase.channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        fetchProducts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && editingId) {
        const { error } = await supabase.from('products').update({
          code,
          name,
          price_before: parseFloat(price),
          discount_percentage: discountPercentage ? parseFloat(discountPercentage) : 0,
          size,
          in_stock: inStock,
          quantity: quantity ? parseInt(quantity) : 0,
          updated_at: new Date().toISOString()
        }).eq('id', editingId);
        
        if (error) throw error;

        await logAction('تعديل منتج', `تم تعديل المنتج: ${name} (${code})`);
        toast.success('تم تحديث المنتج بنجاح');
        setIsEditing(false);
        setEditingId(null);
      } else {
        const { error } = await supabase.from('products').insert([{
          code,
          name,
          price_before: parseFloat(price),
          discount_percentage: discountPercentage ? parseFloat(discountPercentage) : 0,
          size,
          in_stock: inStock,
          quantity: quantity ? parseInt(quantity) : 0,
          is_deleted: false
        }]);

        if (error) throw error;

        await logAction('إضافة منتج', `تم إضافة منتج جديد: ${name} (${code})`);
        toast.success('تم إضافة المنتج بنجاح');
      }
      setCode(''); setName(''); setPrice(''); setDiscountPercentage(''); setSize(''); setQuantity(''); setInStock(true);
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء حفظ المنتج');
    }
  };

  const handleEdit = (product: Product) => {
    setIsEditing(true);
    setEditingId(product.id!);
    setCode(product.code || '');
    setName(product.name || '');
    setPrice(product.price?.toString() || product.price_before?.toString() || '');
    setDiscountPercentage(product.discountPercentage?.toString() || '');
    setSize(product.size || '');
    setQuantity(product.quantity?.toString() || '0');
    setInStock(product.inStock !== false);
    document.getElementById('product-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingId(null);
    setCode(''); setName(''); setPrice(''); setDiscountPercentage(''); setSize(''); setQuantity(''); setInStock(true);
  };

  const handleDelete = async (id: string) => {
    if(window.confirm('هل أنت متأكد من أرشفة/حذف هذا المنتج؟')) {
      try {
        const { error } = await supabase.from('products').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
        await logAction('أرشفة منتج', `تم أرشفة المنتج رقم ${id}`);
        toast.success('تم أرشفة المنتج بنجاح');
      } catch (error) {
        toast.error('حدث خطأ أثناء أرشفة المنتج');
      }
    }
  };

  const toggleStock = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('products').update({ in_stock: !currentStatus }).eq('id', id);
      if (error) throw error;
      await logAction('تغيير حالة المخزون', `تم تغيير حالة المخزون للمنتج رقم ${id} إلى ${!currentStatus ? 'متوفر' : 'غير متوفر'}`);
      toast.success(currentStatus ? 'تم تغيير الحالة إلى غير متوفر' : 'تم تغيير الحالة إلى متوفر');
    } catch (error) {
      toast.error('حدث خطأ أثناء تحديث الحالة');
    }
  };

  const filteredProducts = products.filter(p => 
    !p.isDeleted && (
      (p.code || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6" dir="rtl">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Add/Edit Product Form */}
        <div id="product-form" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit lg:sticky lg:top-4 transition-all overflow-hidden relative">
          {isEditing && <div className="absolute top-0 right-0 h-1 bg-orange-500 w-full animate-pulse" />}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
              {isEditing ? <Edit className="w-5 h-5 text-orange-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
              {isEditing ? 'تعديل المنتج' : 'إضافة منتج جديد'}
            </h2>
            {isEditing && (
              <button type="button" onClick={cancelEdit} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">كود المنتج *</label>
                <input required value={code} onChange={e=>setCode(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="مثال: A-123" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">اسم المنتج *</label>
                <input required value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="سجاد تركي مودرن" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">السعر الأساسي *</label>
                  <input required type="number" value={price} onChange={e=>setPrice(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">نسبة الخصم %</label>
                  <input type="number" value={discountPercentage} onChange={e=>setDiscountPercentage(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">المقاس</label>
                  <input value={size} onChange={e=>setSize(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="2x3" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">الكمية المتاحة</label>
                  <input type="number" value={quantity} onChange={e=>setQuantity(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">حالة التوفر</label>
                <select value={inStock ? 'true' : 'false'} onChange={e=>setInStock(e.target.value === 'true')} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer">
                  <option value="true">متوفر في المخزن</option>
                  <option value="false">غير متوفر حالياً</option>
                </select>
              </div>
            </div>
            <button type="submit" className={`w-full text-white py-4 rounded-xl font-bold transition shadow-sm ${isEditing ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isEditing ? 'حفظ التعديلات' : 'إضافة المنتج للمخزن'}
            </button>
          </form>
        </div>

        {/* Products List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <Package className="w-6 h-6 text-slate-400" />
                المنتجات المسجلة ({filteredProducts.length})
              </h2>
            </div>
 
            <div className="relative">
              <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بكود أو اسم المنتج..."
                className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
          </div>
 
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-sm text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-4 font-bold">الكود</th>
                  <th className="px-4 py-4 font-bold">الاسم</th>
                  <th className="px-4 py-4 font-bold">السعر</th>
                  <th className="px-4 py-4 font-bold">الخصم</th>
                  <th className="px-4 py-4 font-bold">الكمية</th>
                  <th className="px-4 py-4 font-bold">الحالة</th>
                  <th className="px-4 py-4 font-bold text-center">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-bold text-slate-800">{p.code}</td>
                    <td className="px-4 py-4 text-slate-600">{p.name}</td>
                    <td className="px-4 py-4 text-blue-600 font-bold">{p.price_before || p.price} ج.م</td>
                    <td className="px-4 py-4 text-red-500 font-medium">
                      {p.price_after ? `${p.price_after} ج.م` : p.discountPercentage ? `${p.discountPercentage}%` : '-'}
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-700">{p.quantity || 0}</td>
                    <td className="px-4 py-4">
                      <button 
                        onClick={() => toggleStock(p.id!, p.inStock !== false)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full transition-all font-bold ${p.inStock !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {p.inStock !== false ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {p.inStock !== false ? 'متوفر' : 'منتهي'}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEdit(p)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="تعديل">
                          <Edit className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(p.id!)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="حذف">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filteredProducts.map(p => (
              <div key={p.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">موديل: {p.code}</div>
                    <div className="text-lg font-bold text-slate-800">{p.name}</div>
                  </div>
                  <button 
                    onClick={() => toggleStock(p.id!, p.inStock !== false)}
                    className={`px-3 py-1 rounded-full text-xs font-bold ${p.inStock !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                  >
                    {p.inStock !== false ? 'متوفر' : 'منتهي'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50 mb-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-0.5">السعر</div>
                    <div className="font-bold text-blue-600">{p.price_before || p.price} ج.م</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-0.5">الخصم</div>
                    <div className="font-bold text-red-500">{p.price_after ? `${p.price_after}` : p.discountPercentage ? `${p.discountPercentage}%` : 'لا يوجد'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-0.5">المقاس</div>
                    <div className="font-bold text-slate-700">{p.size || 'غير محدد'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-0.5">الكمية</div>
                    <div className="font-bold text-slate-700">{p.quantity || 0}</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleEdit(p)} className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 py-3 rounded-xl font-bold transition">
                    <Edit className="w-4 h-4" /> تعديل
                  </button>
                  <button onClick={() => handleDelete(p.id!)} className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 py-3 rounded-xl font-bold transition">
                    <Trash2 className="w-4 h-4" /> حذف
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
              <Search className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 text-lg font-medium">لم يتم العثور على أي منتجات مطابقة</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
