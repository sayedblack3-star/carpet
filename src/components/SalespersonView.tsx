import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeInfo,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  History as HistoryIcon,
  Package,
  Phone,
  Plus,
  Save,
  ScanSearch,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '../supabase';
import { Order, Product, Profile } from '../types';
import { setupRealtimeFallback } from '../lib/realtimeFallback';
import ProductSearch from './ProductSearch';
import { logAction } from '../lib/logger';
import { normalizeText, validateOrderInput } from '../lib/security';
import { toFriendlyErrorMessage } from '../lib/errorMessages';
import ShiftManager from './ShiftManager';

interface SalespersonViewProps {
  branchId?: string | null;
  branchName?: string;
  branchEnabled?: boolean;
}

const moneyFormatter = new Intl.NumberFormat('ar-EG');

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
  const [realtimeFallbackActive, setRealtimeFallbackActive] = useState(false);
  const cartPanelRef = useRef<HTMLDivElement | null>(null);
  const fallbackToastShownRef = useRef(false);

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
          void fetchMyOrders(session.user.id, profile.branch_id || branchId || undefined);
        } else {
          void fetchMyOrders(session.user.id, branchId || undefined);
        }
      }

      void fetchProducts();
    };

    void init();
  }, [branchId]);

  useEffect(() => {
    if (!sessionUser?.id) return;

    return setupRealtimeFallback({
      fetchNow: () => fetchMyOrders(sessionUser.id, currentProfile?.branch_id || branchId || undefined),
      createChannel: () =>
        supabase
          .channel(`seller-orders-${sessionUser.id}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'orders', filter: `salesperson_id=eq.${sessionUser.id}` },
            (payload) => {
              const nextOrder = payload.new as Order;
              void fetchMyOrders(sessionUser.id, currentProfile?.branch_id || branchId || undefined);

              if (nextOrder.status === 'confirmed') {
                toast.success(`تم تأكيد الطلب #${nextOrder.order_number} من الكاشير.`);
              } else if (nextOrder.status === 'under_review') {
                toast.info(`الكاشير راجع الطلب #${nextOrder.order_number} وحدّث محتواه.`);
              } else if (nextOrder.status === 'cancelled') {
                toast.warning(`تم إلغاء الطلب #${nextOrder.order_number}.`);
              }
            },
          ),
      pollIntervalMs: 15000,
      onFallback: () => {
        setRealtimeFallbackActive(true);
        if (!fallbackToastShownRef.current) {
          fallbackToastShownRef.current = true;
          toast.info('تحديث حالة الطلبات يعمل الآن بالمزامنة الدورية لأن التحديث اللحظي غير متاح مؤقتًا.');
        }
      },
    });
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
    if (data) {
      setMyOrders(data as Order[]);
      setRealtimeFallbackActive(false);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) {
      toast.error('هذا المنتج غير متوفر في المخزن.');
      return;
    }

    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      if (existing.cartQuantity >= product.stock_quantity) {
        toast.error('الكمية المطلوبة أكبر من المتاح.');
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
          toast.error('الكمية المطلوبة أكبر من المتاح.');
          return item;
        }

        return { ...item, cartQuantity: newQty };
      }),
    );
  };

  const handleSaveSellerInfo = async () => {
    if (!sessionUser?.id) return;
    if (!sellerForm.full_name.trim()) {
      toast.error('اسم البائع مطلوب.');
      return;
    }

    setSavingSeller(true);
    try {
      const payload = {
        full_name: normalizeText(sellerForm.full_name),
        employee_code: normalizeText(sellerForm.employee_code) || null,
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

      await logAction(
        'seller_profile_updated',
        {
          full_name: payload.full_name,
          employee_code: payload.employee_code,
        },
        currentProfile?.branch_id || branchId || undefined,
      );

      toast.success('تم حفظ بيانات البائع.');
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, 'تعذر حفظ بيانات البائع الآن.'));
    } finally {
      setSavingSeller(false);
    }
  };

  const handleSubmitOrder = async () => {
    if (!sessionUser?.id || cart.length === 0) return;

    const orderInputError = validateOrderInput({ customerName, customerPhone, notes });
    if (orderInputError) {
      toast.error(orderInputError);
      return;
    }

    if (cart.some((item) => item.cartQuantity <= 0)) {
      toast.error('كل كميات الطلب يجب أن تكون أكبر من صفر.');
      return;
    }

    setIsSubmitting(true);
    try {
      const total = cart.reduce((sum, item) => sum + (item.price_sell_after || item.price_sell_before) * item.cartQuantity, 0);
      const originalTotal = cart.reduce((sum, item) => sum + item.price_sell_before * item.cartQuantity, 0);

      const orderPayload: Record<string, any> = {
        salesperson_id: sessionUser.id,
        salesperson_name: normalizeText(sellerForm.full_name) || currentProfile?.full_name || '',
        customer_name: normalizeText(customerName),
        customer_phone: normalizeText(customerPhone),
        status: 'sent_to_cashier',
        payment_status: 'unpaid',
        total_original_price: originalTotal,
        total_final_price: total,
        notes: normalizeText(notes),
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

      await logAction(
        'order_sent_to_cashier',
        {
          order_id: order.id,
          order_number: order.order_number,
          items_count: items.length,
          total_final_price: total,
        },
        orderPayload.branch_id,
      );

      toast.success('تم إرسال الفاتورة إلى الكاشير.');
      setCart([]);
      setNotes('');
      setCustomerName('');
      setCustomerPhone('');
      await fetchMyOrders(sessionUser.id, currentProfile?.branch_id || branchId || undefined);
      setView('history');
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, 'تعذر إرسال الفاتورة إلى الكاشير.'));
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
  const cartCount = cart.reduce((sum, item) => sum + item.cartQuantity, 0);

  return (
    <div className="flex h-full flex-col bg-slate-50" dir="rtl">
      <div className="sticky top-0 z-40 flex flex-col gap-4 border-b border-slate-100 bg-white p-4 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:w-96">
          <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث بكود المنتج أو الاسم..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pr-12 pl-4 font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
          <button
            onClick={() => setView('pos')}
            className={`shrink-0 rounded-2xl px-5 py-3 font-black ${view === 'pos' ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}
          >
            <span className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> نقطة البيع</span>
          </button>
          <button
            onClick={() => setView('history')}
            className={`shrink-0 rounded-2xl px-5 py-3 font-black ${view === 'history' ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}
          >
            <span className="flex items-center gap-2"><HistoryIcon className="h-5 w-5" /> متابعة مبيعاتي</span>
          </button>
          <button
            onClick={() => setView('search')}
            className={`shrink-0 rounded-2xl px-5 py-3 font-black ${view === 'search' ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}
          >
            <span className="flex items-center gap-2"><ScanSearch className="h-5 w-5" /> البحث بالكود</span>
          </button>
        </div>
      </div>

      {realtimeFallbackActive && (
        <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 sm:mx-6">
          حالة الطلبات تُحدّث دوريًا الآن لأن التحديث الفوري غير متاح مؤقتًا.
        </div>
      )}

      {view === 'search' ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <ProductSearch />
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <BadgeInfo className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">بيانات البائع الحالية</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">يمكنك مراجعة الاسم والكود والفرع من نفس الشاشة.</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="mb-2 text-[11px] font-black text-slate-400">اسم البائع</p>
                    <p className="text-lg font-black text-slate-800">{sellerForm.full_name || 'غير مسجل بعد'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="mb-2 text-[11px] font-black text-slate-400">كود البائع</p>
                    <p className="text-lg font-black text-slate-800">{sellerForm.employee_code || 'بدون كود'}</p>
                  </div>
                </div>

                {branchEnabled && branchName && (
                  <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <p className="mb-2 text-[11px] font-black text-blue-700">الفرع الحالي</p>
                    <p className="flex items-center gap-2 text-lg font-black text-blue-900">
                      <Building2 className="h-5 w-5" /> {branchName}
                    </p>
                  </div>
                )}
              </div>

              {sessionUser?.id && <ShiftManager userId={sessionUser.id} branchId={currentProfile?.branch_id || branchId || null} variant="card" />}
            </div>
          </div>
        </div>
      ) : view === 'pos' ? (
        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="px-4 pt-4 lg:hidden">
            <div className="rounded-[1.75rem] border border-blue-100 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_70%)] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mb-1 text-[11px] font-black text-blue-700">ملخص سريع</p>
                  <h2 className="text-lg font-black text-slate-900">{cartCount} قطعة في السلة</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">{moneyFormatter.format(subtotal)} ج.م إجمالي حالي</p>
                </div>
                {branchEnabled && branchName && (
                  <div className="rounded-2xl bg-white/70 px-3 py-2 text-[11px] font-black text-blue-900">{branchName}</div>
                )}
              </div>
              {cartCount > 0 && (
                <button
                  type="button"
                  onClick={() => cartPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 font-black text-white"
                >
                  <ShoppingCart className="h-4 w-4" /> عرض السلة وبيانات الطلب
                </button>
              )}
            </div>
          </div>

          <div className="order-2 flex-1 overflow-y-auto p-4 sm:p-6 lg:order-1">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  className="group flex min-h-[12.5rem] flex-col rounded-2xl border border-slate-100 bg-white p-5 text-right shadow-sm transition-all hover:border-blue-200 hover:shadow-xl"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-500">{product.code}</span>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black ${
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
                  <h3 className="mb-1 truncate text-lg font-black text-slate-800 group-hover:text-blue-600">{product.name}</h3>
                  <p className="mb-4 min-h-10 line-clamp-2 text-xs text-slate-400">{product.description || product.category}</p>
                  <div className="mt-auto flex items-end justify-between">
                    <div>
                      {product.price_sell_after && product.price_sell_after < product.price_sell_before ? (
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400 line-through">{moneyFormatter.format(product.price_sell_before)} ج.م</span>
                          <span className="text-xl font-black text-blue-600">{moneyFormatter.format(product.price_sell_after)} ج.م</span>
                        </div>
                      ) : (
                        <span className="text-xl font-black text-slate-800">{moneyFormatter.format(product.price_sell_before)} ج.م</span>
                      )}
                    </div>
                    <div className="flex h-12 min-w-12 items-center justify-center gap-1 rounded-xl bg-blue-50 px-3 text-blue-500 transition-all group-hover:bg-blue-500 group-hover:text-white">
                      <Plus className="h-5 w-5" />
                      <span className="text-[11px] font-black">إضافة</span>
                    </div>
                  </div>
                </button>
              ))}

              {filteredProducts.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-400">
                  <Package className="mx-auto mb-4 h-16 w-16 opacity-30" />
                  <p className="text-lg font-bold">لا توجد منتجات مطابقة</p>
                </div>
              )}
            </div>
          </div>

          <div ref={cartPanelRef} className="order-1 z-10 flex w-full flex-col border-r border-slate-100 bg-white shadow-xl lg:order-2 lg:w-[440px]">
            <div className="space-y-4 border-b border-slate-50 p-4 sm:p-6">
              <div className="rounded-[1.75rem] border border-blue-100 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_70%)] p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">بيانات البائع</h2>
                    <p className="text-xs font-bold text-slate-500">الاسم، الكود، والفرع الحالي قبل إرسال الفاتورة.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={sellerForm.full_name}
                    onChange={(event) => setSellerForm((prev) => ({ ...prev, full_name: event.target.value }))}
                    placeholder="اسم البائع"
                    className="w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-blue-100"
                  />
                  <input
                    type="text"
                    value={sellerForm.employee_code}
                    onChange={(event) => setSellerForm((prev) => ({ ...prev, employee_code: event.target.value }))}
                    placeholder="كود البائع"
                    className="w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-blue-100"
                  />
                  {branchEnabled && branchName && (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                      <p className="mb-1 text-[11px] font-black text-blue-700">الفرع الحالي</p>
                      <p className="font-black text-blue-900">{branchName}</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSaveSellerInfo}
                  disabled={savingSeller}
                  className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 font-black text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> {savingSeller ? 'جارٍ الحفظ...' : 'حفظ البيانات'}
                </button>
              </div>

              {sessionUser?.id && <ShiftManager userId={sessionUser.id} branchId={currentProfile?.branch_id || branchId || null} variant="card" />}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">سلة البيع</h2>
                    <p className="text-xs font-bold text-slate-400">{cartCount} قطعة</p>
                  </div>
                </div>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="rounded-xl p-2 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center opacity-40">
                  <ShoppingCart className="mb-4 h-16 w-16 text-slate-400" />
                  <p className="font-bold text-slate-500">سلة البيع فارغة</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="line-clamp-1 text-sm font-black text-slate-800">{item.name}</h4>
                        <span className="text-[10px] font-bold text-slate-400">{item.code}</span>
                      </div>
                      <span className="text-sm font-black text-slate-800">
                        {moneyFormatter.format((item.price_sell_after || item.price_sell_before) * item.cartQuantity)} ج.م
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center rounded-xl border bg-white p-1">
                        <button onClick={() => updateQuantity(item.id, -1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50">
                          -
                        </button>
                        <span className="w-10 text-center text-sm font-black">{item.cartQuantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50">
                          +
                        </button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="p-2 text-slate-300 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-4 border-t border-slate-100 bg-slate-50 p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-400"><User className="ml-1 inline h-3 w-3" /> اسم العميل</label>
                  <input type="text" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="اختياري" className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-400"><Phone className="ml-1 inline h-3 w-3" /> رقم الهاتف</label>
                  <input type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="اختياري" className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-400"><FileText className="ml-1 inline h-3 w-3" /> ملاحظات</label>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="ملاحظات الطلب..." className="h-16 w-full resize-none rounded-xl border bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">قبل الخصم</span>
                  <span className="font-black text-slate-800">{moneyFormatter.format(originalSubtotal)} ج.م</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">إجمالي الخصم</span>
                  <span className="font-black text-emerald-600">{moneyFormatter.format(totalDiscount)} ج.م</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="font-black text-slate-700">الإجمالي النهائي</span>
                  <span className="text-xl font-black text-slate-900">{moneyFormatter.format(subtotal)} ج.م</span>
                </div>
              </div>
              <button
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleSubmitOrder}
                className={`flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl py-4 text-lg font-black ${
                  cart.length === 0 || isSubmitting
                    ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                    : 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 hover:bg-blue-700'
                }`}
              >
                <Send className="h-5 w-5" /> {isSubmitting ? 'جارٍ إرسال الفاتورة...' : 'إرسال للكاشير'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 sm:p-10">
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-800">متابعة مبيعاتي</h2>
                <p className="mt-1 font-medium text-slate-500">الطلبات المرسلة من البائع حتى اعتمادها أو تعديلها من الكاشير.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
                  <p className="text-[11px] font-black text-slate-400">كود البائع</p>
                  <p className="text-lg font-black text-slate-800">{sellerForm.employee_code || 'غير مسجل'}</p>
                </div>
                {branchEnabled && branchName && (
                  <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
                    <p className="text-[11px] font-black text-slate-400">الفرع</p>
                    <p className="text-lg font-black text-slate-800">{branchName}</p>
                  </div>
                )}
              </div>
            </div>

            {myOrders.map((order) => (
              <div key={order.id} className="flex flex-col gap-5 rounded-2xl border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between sm:p-6">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' : order.status === 'under_review' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600'}`}>
                    {order.status === 'confirmed' ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800">طلب #{order.order_number}</h4>
                    <p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleString('ar-EG')}</p>
                  </div>
                </div>

                <div className="grid gap-2 text-sm font-bold text-slate-600">
                  <p>اسم العميل: <span className="text-slate-800">{order.customer_name || 'بدون اسم'}</span></p>
                  <p>قيمة الفاتورة: <span className="text-slate-800">{moneyFormatter.format(order.total_final_price || 0)} ج.م</span></p>
                </div>

                <div className="text-left">
                  <span className={`rounded-full px-3 py-2 text-[11px] font-black ${order.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : order.status === 'cancelled' ? 'bg-red-50 text-red-600' : order.status === 'under_review' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>
                    {order.status === 'confirmed'
                      ? 'تم التأكيد من الكاشير'
                      : order.status === 'cancelled'
                        ? 'تم إلغاء الطلب'
                        : order.status === 'under_review'
                          ? 'الكاشير يراجع الفاتورة'
                          : 'بانتظار الكاشير'}
                  </span>
                </div>
              </div>
            ))}

            {myOrders.length === 0 && (
              <div className="rounded-3xl border-2 border-dashed bg-slate-50 py-20 text-center">
                <Package className="mx-auto mb-4 h-16 w-16 text-slate-300" />
                <p className="font-bold text-slate-400">لم تقم بإرسال أي فواتير حتى الآن.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalespersonView;
