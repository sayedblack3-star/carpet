import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { OrderItem, Order, Branch, Product } from '../types';
import { Plus, Trash2, ShoppingCart, User, CheckCircle, Search, Clock, Receipt, Store, XCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import ProductSearch from './ProductSearch';
import ShiftManager from './ShiftManager';

interface SalespersonViewProps {
  userBranchId?: string | null;
}

export default function SalespersonView({ userBranchId }: SalespersonViewProps) {
  const [activeTab, setActiveTab] = useState<'order' | 'search' | 'history'>('order');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState(userBranchId || '');
  const [salespersonName, setSalespersonName] = useState('');
  const [sessionUser, setSessionUser] = useState<any>(null);
  
  const [productCode, setProductCode] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [customPrice, setCustomPrice] = useState('');
  
  const [items, setItems] = useState<Partial<OrderItem>[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myOrders, setMyOrders] = useState<Order[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
            setSessionUser(session.user);
            fetchProfile(session.user.id);
        }
    });

    const fetchBranches = async () => {
      const { data } = await supabase.from('branches').select('*').eq('is_active', true);
      if (data) setBranches(data);
    };
    fetchBranches();
  }, []);

  const fetchProfile = async (id: string) => {
    const { data } = await supabase.from('profiles').select('full_name, branch_id').eq('id', id).single();
    if (data) {
      setSalespersonName(data.full_name || '');
      if (!branchId) setBranchId(data.branch_id || '');
    }
  };

  useEffect(() => {
    if (productCode.trim().length >= 2) {
      const timer = setTimeout(async () => {
        const { data } = await supabase.from('products').select('*').eq('code', productCode.trim()).eq('is_active', true).single();
        if (data) {
          setSelectedProduct(data as Product);
          setCustomPrice((data.price_sell_after || data.price_sell_before).toString());
        } else {
          setSelectedProduct(null);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [productCode]);

  const addItem = () => {
    if (!selectedProduct) {
      toast.error('يرجى اختيار منتج صحيح');
      return;
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('يرجى إدخال كمية صحيحة');
      return;
    }

    const price = parseFloat(customPrice);
    const newItem: Partial<OrderItem> = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity: qty,
      unit_price: price,
      discount_amount: (selectedProduct.price_sell_before - price) * qty,
      total_price: price * qty
    };

    setItems([...items, newItem]);
    setProductCode('');
    setSelectedProduct(null);
    setQuantity('1');
    toast.success('تمت إضافة المنتج للقائمة');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmitOrder = async () => {
    if (items.length === 0) {
      toast.error('القائمة فارغة!');
      return;
    }
    if (!branchId) {
      toast.error('يرجى اختيار الفرع');
      return;
    }

    setIsSubmitting(true);
    try {
      const totalOriginal = items.reduce((sum, item) => sum + (item.unit_price! * item.quantity!), 0);
      const totalFinal = totalOriginal; // Simplified for now

      // 1. Insert Order
      const { data: order, error: orderError } = await supabase.from('orders').insert([{
        branch_id: branchId,
        salesperson_id: sessionUser.id,
        salesperson_name: salespersonName,
        status: 'sent',
        total_original_price: totalOriginal,
        total_final_price: totalFinal,
        requires_manager_approval: false
      }]).select().single();

      if (orderError) throw orderError;

      // 2. Insert Order Items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        total_price: item.total_price
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // 3. Create Notification for Cashiers in the same branch
      await supabase.from('notifications').insert([{
        branch_id: branchId,
        sender_id: sessionUser.id,
        title: 'طلب جديد 🆕',
        message: `تم إنشاء طلب جديد برقم ${order.order_number} بواسطة ${salespersonName}`,
        type: 'order_update'
      }]);

      toast.success('تم إرسال الطلب للكاشير بنجاح!');
      setItems([]);
      setActiveTab('history');
      fetchMyOrders();
    } catch (error: any) {
      toast.error('حدث خطأ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchMyOrders = async () => {
    if (!sessionUser) return;
    const { data } = await supabase.from('orders').select('*').eq('salesperson_id', sessionUser.id).order('created_at', { ascending: false }).limit(20);
    if (data) setMyOrders(data as Order[]);
  };

  useEffect(() => {
    if (activeTab === 'history') fetchMyOrders();
  }, [activeTab, sessionUser]);

  return (
    <div className="min-h-full pharaonic-bg p-4 sm:p-6" dir="rtl">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-blue-600" /> واجهة البائع الجديد
          </h1>
          <p className="text-slate-500 font-medium mt-1">نسخة ERP الاحترافية لإدارة المبيعات</p>
        </div>
        
        <div className="flex bg-white/50 backdrop-blur-md p-1 rounded-2xl border border-white/50 shadow-sm">
          <button onClick={() => setActiveTab('order')} className={`px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'order' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}>طلب جديد</button>
          <button onClick={() => setActiveTab('history')} className={`px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}>سجل مبيعاتي</button>
          <button onClick={() => setActiveTab('search')} className={`px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'search' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}>بحث</button>
        </div>
      </header>

      {activeTab === 'order' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-50">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-500" /> إعدادات الفرع
              </h2>
              <select value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-700 appearance-none">
                <option value="">اختر الفرع...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-50">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" /> إضافة منتج
              </h2>
              
              <div className="space-y-4">
                <div className="relative">
                  <input type="text" value={productCode} onChange={e => setProductCode(e.target.value)} placeholder="كود المنتج..." className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-blue-100 outline-none font-bold" />
                </div>

                {selectedProduct && (
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                    <p className="font-bold text-blue-900">{selectedProduct.name}</p>
                    <p className="text-sm text-blue-600">المخزن: {selectedProduct.stock_quantity} قطعة</p>
                    {selectedProduct.stock_quantity <= selectedProduct.min_stock_level && (
                       <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 font-bold bg-amber-50 p-2 rounded-lg">
                         <AlertTriangle className="w-4 h-4" /> مخزون منخفض!
                       </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 mr-2 mb-1 block">الكمية</label>
                    <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 mr-2 mb-1 block">السعر</label>
                    <input type="number" value={customPrice} onChange={e => setCustomPrice(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-blue-600" />
                  </div>
                </div>

                <button onClick={addItem} disabled={!selectedProduct} className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-2xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  إضافة للقائمة
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-white min-h-[600px] flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-slate-800">قائمة الطلب الحالية</h2>
                <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full font-bold">{items.length} منتجات</span>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto max-h-[450px] custom-scrollbar pr-2">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                    <ShoppingCart className="w-20 h-20 mb-4 opacity-20" />
                    <p className="font-bold text-lg">لم يتم اختيار أي منتجات بعد</p>
                  </div>
                ) : (
                  items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100 group animate-in slide-in-from-left-4">
                      <div>
                        <h4 className="font-bold text-slate-800">{item.product_name}</h4>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm font-medium text-slate-400">الكمية: <span className="text-slate-800 font-bold">{item.quantity}</span></span>
                          <span className="text-sm font-medium text-slate-400">السعر: <span className="text-blue-600 font-bold">{item.unit_price} ج.م</span></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <span className="text-lg font-black text-slate-800">{item.total_price} ج.م</span>
                        <button onClick={() => removeItem(index)} className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {items.length > 0 && (
                <div className="mt-8 pt-8 border-t-2 border-slate-50">
                  <div className="flex items-center justify-between mb-6 px-4">
                    <span className="text-slate-400 text-lg font-bold">إجمالي المبلغ:</span>
                    <span className="text-3xl font-black text-blue-600">
                      {items.reduce((sum, item) => sum + (item.total_price || 0), 0)} ج.م
                    </span>
                  </div>
                  <button onClick={handleSubmitOrder} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[2rem] text-xl transition-all shadow-xl shadow-blue-200/50 flex items-center justify-center gap-3 disabled:opacity-70">
                    {isSubmitting ? <Clock className="w-6 h-6 animate-spin" /> : <><CheckCircle className="w-7 h-7" /> إرسال الطلب للكاشير</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-white">
          <h2 className="text-2xl font-black text-slate-800 mb-8">آخر مبيعاتي</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myOrders.map(order => (
              <div key={order.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 mb-1 block">رقم الطلب</span>
                    <h3 className="font-black text-slate-800 text-lg">#{order.order_number}</h3>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                    order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' :
                    order.status === 'sent' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {order.status === 'confirmed' ? 'تم التحصيل' : 'في انتظار الكاشير'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                   <span className="text-slate-400 text-sm font-medium">{format(new Date(order.created_at), 'yyyy-MM-dd HH:mm')}</span>
                   <span className="text-lg font-black text-slate-800">{order.total_final_price} ج.م</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'search' && <ProductSearch />}
      <ShiftManager userId={sessionUser?.id} branchId={branchId} />
    </div>
  );
}
