import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Product, Order, OrderItem, Branch, Profile } from '../types';
import { 
  Search, ShoppingCart, Plus, Minus, Trash2, Send, Clock, Package, 
  CheckCircle2, CreditCard, ChevronRight, AlertCircle, Store, User, Filter, 
  TrendingUp, ArrowLeft, MoreVertical, X, Check, History as HistoryIcon
} from 'lucide-react';
import { toast } from 'sonner';

const SalespersonView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<(Product & { cartQuantity: number })[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [loadingShift, setLoadingShift] = useState(true);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<'pos' | 'history'>('pos');
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionUser(session.user);
        fetchProfile(session.user.id);
        checkShift(session.user.id);
        fetchMyOrders(session.user.id);
      }
    };
    init();
    fetchProducts();
    fetchBranches();
  }, []);

  const checkShift = async (userId: string) => {
    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    setActiveShift(data);
    setLoadingShift(false);
  };

  const fetchProfile = async (id: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (data) setCurrentProfile(data as Profile);
  };

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('*');
    if (data) setBranches(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).eq('is_deleted', false);
    if (data) setProducts(data);
  };

  const fetchMyOrders = async (userId: string) => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('salesperson_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setMyOrders(data as Order[]);
  };

  const addToCart = (product: Product) => {
    const isManagement = currentProfile?.role === 'admin';
    if (!activeShift && !isManagement) {
       toast.error('يجب عليك بـدء وردية عمل أولاً قبل تحصيل الأموال');
       return;
    }
    if (product.stock_quantity <= 0) {
      toast.error('هذا المنتج غير متوفر في المخزن حالياً');
      return;
    }
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.cartQuantity >= product.stock_quantity) {
        toast.error('لا يمكن إضافة كمية أكبر من المتاح في المخزن');
        return;
      }
      setCart(cart.map(item => item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, cartQuantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQty = item.cartQuantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.stock_quantity) {
            toast.error('الكمية المطلوبة تتجاوز المتاح بالمخزن');
            return item;
        }
        return { ...item, cartQuantity: newQty };
      }
      return item;
    }));
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;
    if (!currentProfile?.branch_id) {
      toast.error('لم يتم تحديد فرع لك، يرجى مراجعة الإدارة');
      return;
    }

    setIsSubmitting(true);
    try {
      const subtotal = cart.reduce((sum, item) => sum + (item.price_sell_after || item.price_sell_before) * item.cartQuantity, 0);
      const total = subtotal;
      const branchId = currentProfile.branch_id;
      const userId = sessionUser.id;

      // 1. Create the Order Header (Task 4: sent_to_cashier)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          branch_id: branchId,
          salesperson_id: userId,
          salesperson_name: currentProfile.full_name,
          status: 'sent_to_cashier',
          total_original_price: subtotal,
          total_final_price: total,
          notes: notes,
          sent_to_cashier_at: new Date().toISOString()
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert Order Items with Snapshots
      const orderItems = cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.cartQuantity,
        unit_price: item.price_sell_after || item.price_sell_before,
        discount_amount: (item.price_sell_before - (item.price_sell_after || item.price_sell_before)) * item.cartQuantity,
        total_price: (item.price_sell_after || item.price_sell_before) * item.cartQuantity,
        price_before_snapshot: item.price_sell_before,
        price_after_snapshot: item.price_sell_after,
        discount_percentage_snapshot: item.price_sell_after ? Math.round(((item.price_sell_before - item.price_sell_after) / item.price_sell_before) * 100) : 0
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // 3. Create Notification for Cashiers (Task 5)
      await supabase.from('notifications').insert({
        branch_id: branchId,
        sender_id: userId,
        order_id: order.id,
        title: 'طلب مبيعات جديد 🛒',
        message: `تم إرسال طلب جديد بقيمة ${total} ج.م من ${currentProfile.full_name}`,
        type: 'sale'
      });

      toast.success('تم إرسال الطلب بنجاح للكاشير لمراجعته');
      setCart([]);
      setNotes('');
      fetchMyOrders(userId);
    } catch (error: any) {
      toast.error('حدث خطأ أثناء إرسال الطلب: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const subtotal = cart.reduce((sum, item) => sum + (item.price_sell_after || item.price_sell_before) * item.cartQuantity, 0);

  // Task 6: Block if no active shift (Bypass for Admin)
  const isManagement = currentProfile?.role === 'admin';
  if (!activeShift && !loadingShift && !isManagement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 pharaonic-bg p-4" dir="rtl">
        <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl border border-red-100 text-center relative overflow-hidden">
           <div className="absolute top-0 inset-x-0 h-2 bg-red-500"></div>
           <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
             <Clock className="w-12 h-12" />
           </div>
           <h1 className="text-3xl font-black text-slate-800 mb-4">الوردية مغلقة</h1>
           <p className="text-slate-500 font-medium mb-10 leading-relaxed">
             يا <b>{currentProfile?.full_name}</b>، يجب عليك فتح وردية جديدة وبدء يوم العمل قبل التمكن من إنشاء أي فواتير. يرجى التوجه لمدير الفرع أو فتح وردية من القائمة الجانبية إذا كان متاحاً لك.
           </p>
           <button 
             onClick={() => window.location.reload()}
             className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-5 rounded-3xl transition shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3"
           >
             تحديث الحالة
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" dir="rtl">
      {/* Search Header */}
      <div className="bg-white border-b border-slate-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-40">
        <div className="relative w-full sm:w-96 group">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="ابحث بكود المنتج أو الاسم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none font-bold transition-all"
          />
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => setView('pos')}
            className={`px-6 py-3.5 rounded-2xl font-black transition-all flex items-center gap-2 ${view === 'pos' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <ShoppingCart className="w-5 h-5" /> نقطة البيع
          </button>
          <button 
            onClick={() => setView('history')}
            className={`px-6 py-3.5 rounded-2xl font-black transition-all flex items-center gap-2 ${view === 'history' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <HistoryIcon className="w-5 h-5" /> طلباتي الأخيرة
          </button>
        </div>
      </div>

      {view === 'pos' ? (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProducts.map(product => (
                <div 
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-[4rem] -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500 opacity-50"></div>
                  
                  <div className="relative">
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">{product.code}</span>
                      <span className={`px-3 py-1.5 rounded-full text-[10px] font-black ${product.stock_quantity > product.min_stock_level ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {product.stock_quantity > 0 ? `متاح: ${product.stock_quantity}` : 'نفذ'}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-black text-slate-800 mb-2 truncate group-hover:text-blue-600 transition-colors">{product.name}</h3>
                    <p className="text-slate-400 text-sm font-medium mb-6 line-clamp-2 h-10 leading-relaxed">{product.description}</p>
                    
                    <div className="flex items-end justify-between">
                      <div>
                        {product.price_sell_after ? (
                          <div className="flex flex-col">
                            <span className="text-slate-400 text-xs line-through mb-0.5">{product.price_sell_before} ج.م</span>
                            <span className="text-2xl font-black text-blue-600 tracking-tight">{product.price_sell_after} ج.م</span>
                          </div>
                        ) : (
                          <span className="text-2xl font-black text-slate-800 tracking-tight">{product.price_sell_before} ج.م</span>
                        )}
                      </div>
                      <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all shadow-sm">
                        <Plus className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="w-full lg:w-[450px] bg-white border-r border-slate-100 flex flex-col shadow-2xl z-10">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800">تفاصيل البيع</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{cart.length} منتجات في السلة</p>
                </div>
              </div>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="p-3 text-red-500 hover:bg-red-50 rounded-2xl transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <ShoppingCart className="w-12 h-12 text-slate-400" />
                  </div>
                  <p className="text-slate-500 font-bold text-lg">سلة البيع فارغة</p>
                  <p className="text-slate-400 text-sm">اختر منتجاً من القائمة لبدء البيع</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 group transition-all hover:bg-white hover:shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h4 className="font-black text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">{item.name}</h4>
                        <span className="text-[10px] text-slate-400 font-black">{item.code}</span>
                      </div>
                      <span className="text-lg font-black text-slate-800">{(item.price_sell_after || item.price_sell_before) * item.cartQuantity} ج.م</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-lg transition-colors">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center font-black text-slate-800">{item.cartQuantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-lg transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">الإجمالي الفرعي</span>
                  <span className="text-xl font-black text-slate-800 underline decoration-blue-500/30 decoration-4 underline-offset-4">{subtotal} ج.م</span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-1">ملاحظات الطلب</label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أضف أي ملاحظات خاصة بالعميل أو الطلب..."
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none text-slate-600 font-medium h-24 resize-none transition-all"
                  ></textarea>
                </div>
              </div>

              <button
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleSubmitOrder}
                className={`w-full py-5 rounded-3xl font-black text-lg shadow-2xl transition-all flex items-center justify-center gap-3 ${
                  cart.length === 0 || isSubmitting 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                  : 'bg-blue-600 text-white shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] hover:bg-blue-700'
                }`}
              >
                {isSubmitting ? (
                   <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send className="w-6 h-6" /> إرسال الطلب للكاشير
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
           <div className="max-w-5xl mx-auto space-y-8">
             <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-slate-800">سجل طلباتي</h2>
                  <p className="text-slate-500 font-medium">أحدث 10 مبيعات قمت بها اليوم</p>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl text-emerald-600 border border-emerald-100">
                   <TrendingUp className="w-5 h-5" />
                   <span className="font-black">مستوى أدائك اليوم ممتاز!</span>
                </div>
             </div>

             <div className="grid grid-cols-1 gap-6">
                {myOrders.map(order => (
                  <div key={order.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-8 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2 h-full bg-slate-100 group-hover:bg-blue-500 transition-colors"></div>
                    <div className="flex items-center gap-6">
                      <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg ${
                        order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600 shadow-emerald-200/50' : 
                        order.status === 'sent_to_cashier' ? 'bg-blue-100 text-blue-600 shadow-blue-200/50' : 'bg-slate-100 text-slate-400 shadow-slate-200/50'
                      }`}>
                         {order.status === 'confirmed' ? <CheckCircle2 className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Order #{order.order_number}</h4>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                            order.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 
                            order.status === 'sent_to_cashier' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
                          }`}>
                            {order.status === 'confirmed' ? 'تم التحصيل' : 
                             order.status === 'sent_to_cashier' ? 'بانتظار الكاشير' : 'تحت المراجعة'}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm font-bold flex items-center gap-2">
                           {new Date(order.created_at).toLocaleTimeString('ar-EG')} • {new Date(order.created_at).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-12">
                      <div className="text-left md:text-right">
                        <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">مبلغ الفاتورة</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">{order.total_final_price} ج.م</p>
                      </div>
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-blue-500 transition-all cursor-pointer">
                        <MoreVertical className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                ))}

                {myOrders.length === 0 && (
                   <div className="text-center py-20 bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-200">
                     <Package className="w-16 h-16 text-slate-300 mx-auto mb-6" />
                     <p className="text-slate-400 font-bold text-lg">لم تقم بإجراء أي مبيعات اليوم حتى الآن</p>
                   </div>
                )}
             </div>
           </div>
        </div>
      )}

      <style>{`
        .pharaonic-bg {
          background-image: 
            radial-gradient(circle at 1px 1px, rgba(0,0,0,0.02) 1px, transparent 0);
          background-size: 32px 32px;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default SalespersonView;
