import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Product, Order, Profile } from '../types';
import { Search, ShoppingCart, Plus, Minus, Trash2, Send, Clock, Package, CheckCircle2, User, Phone, FileText, History as HistoryIcon } from 'lucide-react';
import { toast } from 'sonner';

const SalespersonView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<(Product & { cartQuantity: number })[]>([]);
  const [notes, setNotes] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<'pos' | 'history'>('pos');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionUser(session.user);
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (data) setCurrentProfile(data as Profile);
        fetchMyOrders(session.user.id);
      }
    };
    init();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).eq('is_deleted', false);
    if (data) setProducts(data);
  };

  const fetchMyOrders = async (userId: string) => {
    const { data } = await supabase.from('orders').select('*').eq('seller_id', userId).order('created_at', { ascending: false }).limit(20);
    if (data) setMyOrders(data as Order[]);
  };

  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) { toast.error('المنتج غير متوفر في المخزن'); return; }
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
      if (existing.cartQuantity >= product.stock_quantity) { toast.error('الكمية تتجاوز المتاح'); return; }
      setCart(cart.map(i => i.id === product.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i));
    } else {
      setCart([...cart, { ...product, cartQuantity: 1 }]);
    }
  };

  const removeFromCart = (id: string) => setCart(cart.filter(i => i.id !== id));

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id !== id) return item;
      const newQty = item.cartQuantity + delta;
      if (newQty <= 0) return item;
      if (newQty > item.stock_quantity) { toast.error('الكمية تتجاوز المتاح'); return item; }
      return { ...item, cartQuantity: newQty };
    }));
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const total = cart.reduce((s, i) => s + (i.price_sell_after || i.price_sell_before) * i.cartQuantity, 0);
      const originalTotal = cart.reduce((s, i) => s + i.price_sell_before * i.cartQuantity, 0);

      const { data: order, error } = await supabase.from('orders').insert({
        seller_id: sessionUser.id,
        seller_name: currentProfile?.full_name || '',
        customer_name: customerName,
        customer_phone: customerPhone,
        status: 'sent_to_cashier',
        payment_status: 'unpaid',
        total_original_price: originalTotal,
        total_final_price: total,
        notes,
        sent_to_cashier_at: new Date().toISOString()
      }).select().single();

      if (error) throw error;

      const items = cart.map(i => ({
        order_id: order.id,
        product_id: i.id,
        product_name: i.name,
        quantity: i.cartQuantity,
        unit_price: i.price_sell_after || i.price_sell_before,
        discount_amount: (i.price_sell_before - (i.price_sell_after || i.price_sell_before)) * i.cartQuantity,
        total_price: (i.price_sell_after || i.price_sell_before) * i.cartQuantity
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(items);
      if (itemsErr) throw itemsErr;

      toast.success('تم إرسال الطلب للكاشير بنجاح');
      setCart([]); setNotes(''); setCustomerName(''); setCustomerPhone('');
      fetchMyOrders(sessionUser.id);
    } catch (err: any) {
      toast.error('خطأ: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const subtotal = cart.reduce((s, i) => s + (i.price_sell_after || i.price_sell_before) * i.cartQuantity, 0);

  return (
    <div className="h-full flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-40">
        <div className="relative w-full sm:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input type="text" placeholder="ابحث بكود المنتج أو الاسم..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none font-bold" />
        </div>
        <div className="flex gap-3">
          <button onClick={() => setView('pos')} className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 ${view === 'pos' ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>
            <ShoppingCart className="w-5 h-5" /> نقطة البيع
          </button>
          <button onClick={() => setView('history')} className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 ${view === 'history' ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>
            <HistoryIcon className="w-5 h-5" /> طلباتي
          </button>
        </div>
      </div>

      {view === 'pos' ? (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(product => (
                <div key={product.id} onClick={() => addToCart(product)}
                  className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-3">
                    <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full uppercase">{product.code}</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${product.stock_quantity > product.min_stock_level ? 'bg-emerald-50 text-emerald-600' : product.stock_quantity > 0 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                      {product.stock_quantity > 0 ? `متاح: ${product.stock_quantity}` : 'نفذ'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 mb-1 truncate group-hover:text-blue-600">{product.name}</h3>
                  <p className="text-slate-400 text-xs mb-4 line-clamp-1">{product.description || product.category}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      {product.price_sell_after && product.price_sell_after < product.price_sell_before ? (
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-xs line-through">{product.price_sell_before} ج.م</span>
                          <span className="text-xl font-black text-blue-600">{product.price_sell_after} ج.م</span>
                        </div>
                      ) : (
                        <span className="text-xl font-black text-slate-800">{product.price_sell_before} ج.م</span>
                      )}
                    </div>
                    <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all">
                      <Plus className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-16 text-slate-400">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="font-bold text-lg">لا توجد منتجات مطابقة</p>
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="w-full lg:w-[420px] bg-white border-r border-slate-100 flex flex-col shadow-xl z-10">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white"><ShoppingCart className="w-5 h-5" /></div>
                <div><h2 className="text-xl font-black text-slate-800">سلة البيع</h2><p className="text-slate-400 text-xs font-bold">{cart.length} منتج</p></div>
              </div>
              {cart.length > 0 && <button onClick={() => setCart([])} className="p-2 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 className="w-5 h-5" /></button>}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                  <ShoppingCart className="w-16 h-16 text-slate-400 mb-4" />
                  <p className="text-slate-500 font-bold">سلة البيع فارغة</p>
                </div>
              ) : cart.map(item => (
                <div key={item.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1"><h4 className="font-black text-slate-800 text-sm line-clamp-1">{item.name}</h4><span className="text-[10px] text-slate-400 font-bold">{item.code}</span></div>
                    <span className="text-sm font-black text-slate-800">{((item.price_sell_after || item.price_sell_before) * item.cartQuantity).toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center bg-white rounded-xl border p-1">
                      <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-lg"><Minus className="w-4 h-4" /></button>
                      <span className="w-10 text-center font-black">{item.cartQuantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-lg"><Plus className="w-4 h-4" /></button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 mb-1 block"><User className="w-3 h-3 inline ml-1" />اسم العميل</label>
                  <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="اختياري" className="w-full px-3 py-2.5 bg-white border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 mb-1 block"><Phone className="w-3 h-3 inline ml-1" />رقم الهاتف</label>
                  <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="اختياري" className="w-full px-3 py-2.5 bg-white border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 mb-1 block"><FileText className="w-3 h-3 inline ml-1" />ملاحظات</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات الطلب..." className="w-full px-3 py-2.5 bg-white border rounded-xl text-sm font-bold h-16 resize-none outline-none focus:ring-2 focus:ring-blue-100"></textarea>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 font-bold">الإجمالي</span>
                <span className="text-xl font-black text-slate-800">{subtotal.toLocaleString()} ج.م</span>
              </div>
              <button disabled={cart.length === 0 || isSubmitting} onClick={handleSubmitOrder}
                className={`w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 ${cart.length === 0 || isSubmitting ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 hover:bg-blue-700 active:scale-[0.98]'}`}>
                {isSubmitting ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div> : <><Send className="w-5 h-5" /> إرسال للكاشير</>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 sm:p-10">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-2xl font-black text-slate-800 mb-4">سجل طلباتي</h2>
            {myOrders.map(order => (
              <div key={order.id} className="bg-white p-6 rounded-2xl border shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                    {order.status === 'confirmed' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800">طلب #{order.order_number}</h4>
                    <p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleString('ar-EG')}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-black text-slate-700">{order.total_final_price?.toLocaleString()} ج.م</p>
                  <span className={`text-[10px] font-bold ${order.status === 'confirmed' ? 'text-emerald-500' : order.status === 'cancelled' ? 'text-red-500' : 'text-amber-500'}`}>
                    {order.status === 'confirmed' ? 'مكتمل' : order.status === 'cancelled' ? 'ملغي' : 'بانتظار الكاشير'}
                  </span>
                </div>
              </div>
            ))}
            {myOrders.length === 0 && (
              <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed"><Package className="w-16 h-16 text-slate-300 mx-auto mb-4" /><p className="text-slate-400 font-bold">لم تقم بأي مبيعات حتى الآن</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalespersonView;
