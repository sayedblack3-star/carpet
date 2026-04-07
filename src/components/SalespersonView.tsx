import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { Product, Order, Profile } from '../types';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Send,
  Clock,
  Package,
  CheckCircle2,
  User,
  Phone,
  FileText,
  History as HistoryIcon,
  ScanSearch,
  BadgeInfo,
  Save,
  TimerReset,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import ProductSearch from './ProductSearch';

interface SalespersonViewProps {
  branchId?: string | null;
  branchName?: string;
  branchEnabled?: boolean;
}

const shiftStorageKey = (userId: string) => `carpet-land:shift-start:${userId}`;

const SalespersonView: React.FC<SalespersonViewProps> = ({ branchId, branchName, branchEnabled = false }) => {
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
  const [view, setView] = useState<'pos' | 'history' | 'search'>('pos');
  const [sellerForm, setSellerForm] = useState({ full_name: '', employee_code: '' });
  const [savingSeller, setSavingSeller] = useState(false);
  const [shiftStartedAt, setShiftStartedAt] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setSessionUser(session.user);

        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (data) {
          const profile = data as Profile;
          setCurrentProfile(profile);
          setSellerForm({
            full_name: profile.full_name || '',
            employee_code: profile.employee_code || '',
          });
          fetchMyOrders(session.user.id, profile.branch_id || branchId || undefined);
        } else {
          fetchMyOrders(session.user.id, branchId || undefined);
        }

        const savedShift = window.localStorage.getItem(shiftStorageKey(session.user.id));
        if (savedShift) setShiftStartedAt(savedShift);
      }

      fetchProducts();
    };

    init();
  }, [branchId]);

  useEffect(() => {
    if (!sessionUser?.id) return;

    const ordersChannel = supabase
      .channel(`seller-orders-${sessionUser.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `salesperson_id=eq.${sessionUser.id}` },
        (payload) => {
          const nextOrder = payload.new as Order;
          fetchMyOrders(sessionUser.id, currentProfile?.branch_id || branchId || undefined);

          if (nextOrder.status === 'confirmed') {
            toast.success(`تم تأكيد الطلب #${nextOrder.order_number} من الكاشير`);
          } else if (nextOrder.status === 'under_review') {
            toast.info(`الكاشير راجع الطلب #${nextOrder.order_number} وحدّث محتواه`);
          } else if (nextOrder.status === 'cancelled') {
            toast.warning(`تم إلغاء الطلب #${nextOrder.order_number}`);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [sessionUser?.id, currentProfile?.branch_id, branchId]);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).eq('is_deleted', false);
    if (data) setProducts(data as Product[]);
  };

  const fetchMyOrders = async (userId: string, activeBranchId?: string) => {
    let query = supabase.from('orders').select('*').eq('salesperson_id', userId);
    if (branchEnabled && activeBranchId) {
      query = query.eq('branch_id', activeBranchId);
    }
    const { data } = await query.order('created_at', { ascending: false }).limit(20);
    if (data) setMyOrders(data as Order[]);
  };

  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) {
      toast.error('المنتج غير متوفر في المخزن');
      return;
    }

    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      if (existing.cartQuantity >= product.stock_quantity) {
        toast.error('الكمية المطلوبة أكبر من المتاح');
        return;
      }
      setCart(cart.map((item) => (item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item)));
      return;
    }

    setCart([...cart, { ...product, cartQuantity: 1 }]);
  };

  const removeFromCart = (id: string) => setCart(cart.filter((item) => item.id !== id));

  const updateQuantity = (id: string, delta: number) => {
    setCart(
      cart.map((item) => {
        if (item.id !== id) return item;
        const newQty = item.cartQuantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.stock_quantity) {
          toast.error('الكمية المطلوبة أكبر من المتاح');
          return item;
        }
        return { ...item, cartQuantity: newQty };
      }),
    );
  };

  const handleSaveSellerInfo = async () => {
    if (!sessionUser?.id) return;
    if (!sellerForm.full_name.trim()) {
      toast.error('اسم البائع مطلوب');
      return;
    }

    setSavingSeller(true);
    try {
      const payload = {
        full_name: sellerForm.full_name.trim(),
        employee_code: sellerForm.employee_code.trim() || null,
      };

      const { error } = await supabase.from('profiles').update(payload).eq('id', sessionUser.id);
      if (error) throw error;

      setCurrentProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: payload.full_name,
              employee_code: payload.employee_code || undefined,
            }
          : prev,
      );

      toast.success('تم حفظ بيانات البائع');
    } catch (err: any) {
      toast.error(`تعذر حفظ البيانات: ${err.message}`);
    } finally {
      setSavingSeller(false);
    }
  };

  const handleShiftToggle = () => {
    if (!sessionUser?.id) return;

    if (shiftStartedAt) {
      window.localStorage.removeItem(shiftStorageKey(sessionUser.id));
      setShiftStartedAt(null);
      toast.info('تم إنهاء الوردية الحالية');
      return;
    }

    const now = new Date().toISOString();
    window.localStorage.setItem(shiftStorageKey(sessionUser.id), now);
    setShiftStartedAt(now);
    toast.success('تم تسجيل بداية الوردية');
  };

  const handleSubmitOrder = async () => {
    if (!sessionUser?.id || cart.length === 0) return;

    setIsSubmitting(true);
    try {
      const total = cart.reduce((sum, item) => sum + (item.price_sell_after || item.price_sell_before) * item.cartQuantity, 0);
      const originalTotal = cart.reduce((sum, item) => sum + item.price_sell_before * item.cartQuantity, 0);

      const orderPayload: Record<string, any> = {
        salesperson_id: sessionUser.id,
        salesperson_name: sellerForm.full_name.trim() || currentProfile?.full_name || '',
        customer_name: customerName,
        customer_phone: customerPhone,
        status: 'sent_to_cashier',
        payment_status: 'unpaid',
        total_original_price: originalTotal,
        total_final_price: total,
        notes,
        sent_to_cashier_at: new Date().toISOString(),
      };

      if (branchEnabled && (currentProfile?.branch_id || branchId)) {
        orderPayload.branch_id = currentProfile?.branch_id || branchId;
      }

      const { data: order, error } = await supabase.from('orders').insert(orderPayload).select().single();
      if (error) throw error;

      const items = cart.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.cartQuantity,
        unit_price: item.price_sell_after || item.price_sell_before,
        discount_amount: (item.price_sell_before - (item.price_sell_after || item.price_sell_before)) * item.cartQuantity,
        total_price: (item.price_sell_after || item.price_sell_before) * item.cartQuantity,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(items);
      if (itemsError) throw itemsError;

      toast.success('تم إرسال الفاتورة إلى الكاشير');
      setCart([]);
      setNotes('');
      setCustomerName('');
      setCustomerPhone('');
      fetchMyOrders(sessionUser.id, currentProfile?.branch_id || branchId || undefined);
      setView('history');
    } catch (err: any) {
      toast.error(`خطأ: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.code.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [products, searchTerm],
  );

  const subtotal = cart.reduce((sum, item) => sum + (item.price_sell_after || item.price_sell_before) * item.cartQuantity, 0);
  const originalSubtotal = cart.reduce((sum, item) => sum + item.price_sell_before * item.cartQuantity, 0);
  const totalDiscount = Math.max(0, originalSubtotal - subtotal);

  return (
    <div className="h-full flex flex-col bg-slate-50" dir="rtl">
      <div className="bg-white border-b border-slate-100 p-4 sm:p-6 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 sticky top-0 z-40">
        <div className="relative w-full xl:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="ابحث بكود المنتج أو الاسم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none font-bold"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={() => setView('pos')} className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 ${view === 'pos' ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>
            <ShoppingCart className="w-5 h-5" /> نقطة البيع
          </button>
          <button onClick={() => setView('history')} className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 ${view === 'history' ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>
            <HistoryIcon className="w-5 h-5" /> متابعة مبيعاتي
          </button>
          <button onClick={() => setView('search')} className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 ${view === 'search' ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>
            <ScanSearch className="w-5 h-5" /> البحث بالكود
          </button>
        </div>
      </div>

      {view === 'search' ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-6xl mx-auto grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <ProductSearch />
            <div className="bg-white rounded-[2rem] border border-slate-100 p-6 sm:p-8 shadow-sm">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <BadgeInfo className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800">بيانات البائع الحالية</h2>
                  <p className="text-slate-500 font-medium mt-1">يمكنك تحديث الاسم والكود وبدء الوردية من نفس الشاشة.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <p className="text-[11px] font-black text-slate-400 mb-2">اسم البائع</p>
                    <p className="text-lg font-black text-slate-800">{sellerForm.full_name || 'غير مسجل بعد'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <p className="text-[11px] font-black text-slate-400 mb-2">كود البائع</p>
                    <p className="text-lg font-black text-slate-800">{sellerForm.employee_code || 'بدون كود'}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                  <p className="text-[11px] font-black text-amber-700 mb-2">موعد بدء الوردية</p>
                  <p className="text-lg font-black text-amber-900">{shiftStartedAt ? new Date(shiftStartedAt).toLocaleString('ar-EG') : 'لم تبدأ ورديتك بعد'}</p>
                </div>

                {branchEnabled && branchName && (
                  <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                    <p className="text-[11px] font-black text-blue-700 mb-2">الفرع الحالي</p>
                    <p className="text-lg font-black text-blue-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5" /> {branchName}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : view === 'pos' ? (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 order-2 lg:order-1">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                <div key={product.id} onClick={() => addToCart(product)} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-3">
                    <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full uppercase">{product.code}</span>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black ${
                        product.stock_quantity > product.min_stock_level
                          ? 'bg-emerald-50 text-emerald-600'
                          : product.stock_quantity > 0
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {product.stock_quantity > 0 ? `متاح: ${product.stock_quantity}` : 'نفد'}
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

              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-16 text-slate-400">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="font-bold text-lg">لا توجد منتجات مطابقة</p>
                </div>
              )}
            </div>
          </div>

          <div className="w-full lg:w-[440px] bg-white border-r border-slate-100 flex flex-col shadow-xl z-10 order-1 lg:order-2">
            <div className="p-4 sm:p-6 border-b border-slate-50 space-y-4">
              <div className="rounded-[1.75rem] border border-blue-100 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_70%)] p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">بيانات البائع</h2>
                    <p className="text-slate-500 text-xs font-bold">الاسم والكود وموعد بداية الوردية</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <input type="text" value={sellerForm.full_name} onChange={(e) => setSellerForm((prev) => ({ ...prev, full_name: e.target.value }))} placeholder="اسم البائع" className="w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-blue-100" />
                  <input type="text" value={sellerForm.employee_code} onChange={(e) => setSellerForm((prev) => ({ ...prev, employee_code: e.target.value }))} placeholder="كود البائع" className="w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-blue-100" />
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                    <p className="text-[11px] font-black text-amber-700 mb-1">بداية الوردية</p>
                    <p className="font-black text-amber-900">{shiftStartedAt ? new Date(shiftStartedAt).toLocaleString('ar-EG') : 'لم يتم تحديد بداية الوردية بعد'}</p>
                  </div>
                  {branchEnabled && branchName && (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                      <p className="text-[11px] font-black text-blue-700 mb-1">الفرع الحالي</p>
                      <p className="font-black text-blue-900">{branchName}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button onClick={handleSaveSellerInfo} disabled={savingSeller} className="rounded-2xl bg-slate-900 text-white py-3 font-black flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-60">
                    <Save className="w-4 h-4" /> {savingSeller ? 'جارٍ الحفظ...' : 'حفظ البيانات'}
                  </button>
                  <button onClick={handleShiftToggle} className={`rounded-2xl py-3 font-black flex items-center justify-center gap-2 ${shiftStartedAt ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                    <TimerReset className="w-4 h-4" /> {shiftStartedAt ? 'إنهاء الوردية' : 'بدء الوردية'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">سلة البيع</h2>
                    <p className="text-slate-400 text-xs font-bold">{cart.length} منتج</p>
                  </div>
                </div>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="p-2 text-red-500 hover:bg-red-50 rounded-xl">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                  <ShoppingCart className="w-16 h-16 text-slate-400 mb-4" />
                  <p className="text-slate-500 font-bold">سلة البيع فارغة</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-black text-slate-800 text-sm line-clamp-1">{item.name}</h4>
                        <span className="text-[10px] text-slate-400 font-bold">{item.code}</span>
                      </div>
                      <span className="text-sm font-black text-slate-800">{((item.price_sell_after || item.price_sell_before) * item.cartQuantity).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center bg-white rounded-xl border p-1">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-lg">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center font-black">{item.cartQuantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-lg">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="p-2 text-slate-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 mb-1 block"><User className="w-3 h-3 inline ml-1" />اسم العميل</label>
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="اختياري" className="w-full px-3 py-2.5 bg-white border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 mb-1 block"><Phone className="w-3 h-3 inline ml-1" />رقم الهاتف</label>
                  <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="اختياري" className="w-full px-3 py-2.5 bg-white border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 mb-1 block"><FileText className="w-3 h-3 inline ml-1" />ملاحظات</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات الطلب..." className="w-full px-3 py-2.5 bg-white border rounded-xl text-sm font-bold h-16 resize-none outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div className="rounded-2xl bg-white border border-slate-100 p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">قبل الخصم</span>
                  <span className="font-black text-slate-800">{originalSubtotal.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">إجمالي الخصم</span>
                  <span className="font-black text-emerald-600">{totalDiscount.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-slate-700 font-black">الإجمالي النهائي</span>
                  <span className="text-xl font-black text-slate-900">{subtotal.toLocaleString()} ج.م</span>
                </div>
              </div>
              <button
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleSubmitOrder}
                className={`w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 ${
                  cart.length === 0 || isSubmitting
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 hover:bg-blue-700 active:scale-[0.98]'
                }`}
              >
                {isSubmitting ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-5 h-5" /> إرسال للكاشير</>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 sm:p-10">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-800">متابعة مبيعاتي</h2>
                <p className="text-slate-500 font-medium mt-1">الطلبات المرسلة من البائع حتى اعتمادها من الكاشير.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white border border-slate-100 px-5 py-4 shadow-sm">
                  <p className="text-[11px] font-black text-slate-400">كود البائع</p>
                  <p className="text-lg font-black text-slate-800">{sellerForm.employee_code || 'غير مسجل'}</p>
                </div>
                {branchEnabled && branchName && (
                  <div className="rounded-2xl bg-white border border-slate-100 px-5 py-4 shadow-sm">
                    <p className="text-[11px] font-black text-slate-400">الفرع</p>
                    <p className="text-lg font-black text-slate-800">{branchName}</p>
                  </div>
                )}
              </div>
            </div>

            {myOrders.map((order) => (
              <div key={order.id} className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' : order.status === 'under_review' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600'}`}>
                    {order.status === 'confirmed' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800">طلب #{order.order_number}</h4>
                    <p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleString('ar-EG')}</p>
                  </div>
                </div>

                <div className="grid gap-2 text-sm font-bold text-slate-600">
                  <p>اسم العميل: <span className="text-slate-800">{order.customer_name || 'بدون اسم'}</span></p>
                  <p>قيمة الفاتورة: <span className="text-slate-800">{order.total_final_price?.toLocaleString()} ج.م</span></p>
                </div>

                <div className="text-left">
                  <span className={`text-[11px] font-black px-3 py-2 rounded-full ${order.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : order.status === 'cancelled' ? 'bg-red-50 text-red-600' : order.status === 'under_review' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>
                    {order.status === 'confirmed' ? 'تم التأكيد من الكاشير' : order.status === 'cancelled' ? 'تم إلغاء الطلب' : order.status === 'under_review' ? 'الكاشير يراجع الفاتورة' : 'بانتظار الكاشير'}
                  </span>
                </div>
              </div>
            ))}

            {myOrders.length === 0 && (
              <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-400 font-bold">لم تقم بإرسال أي فواتير حتى الآن</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalespersonView;
