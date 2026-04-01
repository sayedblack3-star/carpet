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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Add/Edit Product Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              {isEditing ? <Edit className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
              {isEditing ? 'تعديل بيانات المنتج' : 'إضافة منتج للمخزن'}
            </h2>
            {isEditing && (
              <button type="button" onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">كود المنتج *</label>
              <input required value={code} onChange={e=>setCode(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm mb-1">اسم المنتج *</label>
              <input required value={name} onChange={e=>setName(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm mb-1">السعر *</label>
              <input required type="number" value={price} onChange={e=>setPrice(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm mb-1">نسبة الخصم %</label>
              <input type="number" value={discountPercentage} onChange={e=>setDiscountPercentage(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm mb-1">المقاس</label>
              <input value={size} onChange={e=>setSize(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="مثال: 2x3 متر" />
            </div>
            <div>
              <label className="block text-sm mb-1">الكمية المتاحة</label>
              <input type="number" value={quantity} onChange={e=>setQuantity(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm mb-1">حالة التوفر</label>
              <select value={inStock ? 'true' : 'false'} onChange={e=>setInStock(e.target.value === 'true')} className="w-full p-2 border rounded-lg">
                <option value="true">متوفر في المخزن</option>
                <option value="false">غير متوفر</option>
              </select>
            </div>
            <button type="submit" className={`w-full text-white py-2 rounded-lg font-bold transition ${isEditing ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isEditing ? 'حفظ التعديلات' : 'إضافة المنتج'}
            </button>
          </form>
        </div>

        {/* Products List */}
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-slate-600" />
              المنتجات المسجلة ({filteredProducts.length})
            </h2>
          </div>

          <div className="mb-4 relative">
            <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بكود أو اسم المنتج..."
              className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b text-sm text-slate-500">
                  <th className="pb-2">الكود</th>
                  <th className="pb-2">الاسم</th>
                  <th className="pb-2">السعر</th>
                  <th className="pb-2">الخصم</th>
                  <th className="pb-2">الكمية</th>
                  <th className="pb-2">الحالة</th>
                  <th className="pb-2">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50 transition">
                    <td className="py-3 font-bold">{p.code}</td>
                    <td className="py-3">{p.name}</td>
                    <td className="py-3 text-blue-600 font-medium">{p.price_before || p.price} ج.م</td>
                    <td className="py-3 text-red-500 font-medium">{p.price_after ? `${p.price_after} ج.م` : p.discountPercentage ? `${p.discountPercentage}%` : '-'}</td>
                    <td className="py-3 font-medium">{p.quantity || 0}</td>
                    <td className="py-3">
                      <button 
                        onClick={() => toggleStock(p.id!, p.inStock !== false)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition hover:opacity-80 ${p.inStock !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {p.inStock !== false ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {p.inStock !== false ? 'متوفر' : 'غير متوفر'}
                      </button>
                    </td>
                    <td className="py-3 flex gap-2">
                      <button onClick={() => handleEdit(p)} className="text-blue-500 p-1.5 hover:bg-blue-100 rounded transition" title="تعديل">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id!)} className="text-red-500 p-1.5 hover:bg-red-100 rounded transition" title="حذف">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      لا توجد منتجات مطابقة للبحث
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
