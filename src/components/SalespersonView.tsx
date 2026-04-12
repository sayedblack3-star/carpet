import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
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

import { getSafeSession, supabase } from '../supabase';
import { Order, Product, Profile } from '../types';
import { setupRealtimeFallback } from '../lib/realtimeFallback';
import ProductSearch from './ProductSearch';
import { logAction } from '../lib/logger';
import { normalizeText, validateOrderInput } from '../lib/security';
import { toFriendlyErrorMessage } from '../lib/errorMessages';
import ShiftManager from './ShiftManager';
import {
  createSalespersonOrder,
  fetchSalespersonOrders,
  fetchSalespersonProducts,
  type OrderInsertPayload,
  type SellerProfileUpdatePayload,
  updateSalespersonProfile,
} from '../lib/salespersonService';
import { serializeOrderNotes, type PaymentMethod } from '../lib/orderMetadata';

interface SalespersonViewProps {
  branchId?: string | null;
  branchName?: string;
  branchEnabled?: boolean;
}

const moneyFormatter = new Intl.NumberFormat('ar-EG');
const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'كاش' },
  { value: 'visa', label: 'فيزا' },
  { value: 'cash_and_visa', label: 'كاش + فيزا' },
];

const SalespersonView: React.FC<SalespersonViewProps> = ({ branchId, branchName, branchEnabled = false }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<(Product & { cartQuantity: number })[]>([]);
  const [notes, setNotes] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [sessionUser, setSessionUser] = useState<SupabaseUser | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<'pos' | 'history' | 'search'>('pos');
  const [sellerForm, setSellerForm] = useState({ full_name: '', employee_code: '' });
  const [savingSeller, setSavingSeller] = useState(false);
  const [realtimeFallbackActive, setRealtimeFallbackActive] = useState(false);
  const cartPanelRef = useRef<HTMLDivElement | null>(null);
  const fallbackToastShownRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const session = await getSafeSession();
        if (!isMounted) return;

        if (session) {
          setSessionUser(session.user);

          const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          if (!isMounted) return;

          if (error) {
            console.warn('Failed to load seller profile:', error);
            toast.error('تعذر تحميل بيانات البائع الحالية.');
          } else if (data) {
            const profile = data as Profile;
            setCurrentProfile(profile);
            setSellerForm({
              full_name: profile.full_name || '',
              employee_code: profile.employee_code || '',
            });
            await fetchMyOrders(session.user.id, profile.branch_id || branchId || undefined);
          } else {
            await fetchMyOrders(session.user.id, branchId || undefined);
          }
        }

        if (!isMounted) return;
        await fetchProducts();
      } catch (error) {
        console.warn('Salesperson session bootstrap skipped:', error);
      }
    };

    void init();

    return () => {
      isMounted = false;
    };
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
    try {
      const productsData = await fetchSalespersonProducts();
      setProducts(productsData);
    } catch (error) {
      console.error('Failed to fetch products for seller:', error);
      toast.error('تعذر تحميل المنتجات الآن.');
    }
  };

  const fetchMyOrders = async (userId: string, activeBranchId?: string) => {
    try {
      const ordersData = await fetchSalespersonOrders(userId, {
        branchEnabled,
        branchId: activeBranchId,
        limit: 20,
      });
      setMyOrders(ordersData);
      setRealtimeFallbackActive(false);
    } catch (error) {
      console.error('Failed to fetch seller orders:', error);
      toast.error('تعذر تحميل طلبات البائع الآن.');
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
      const payload: SellerProfileUpdatePayload = {
        full_name: normalizeText(sellerForm.full_name),
        employee_code: normalizeText(sellerForm.employee_code) || null,
      };

      await updateSalespersonProfile(sessionUser.id, payload);

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

      const orderPayload: OrderInsertPayload = {
        salesperson_id: sessionUser.id,
        salesperson_name: normalizeText(sellerForm.full_name) || currentProfile?.full_name || '',
        customer_name: normalizeText(customerName),
        customer_phone: normalizeText(customerPhone),
        status: 'sent_to_cashier',
        payment_status: 'unpaid',
        total_original_price: originalTotal,
        total_final_price: total,
        notes: serializeOrderNotes(normalizeText(notes), {
          customerAddress: normalizeText(customerAddress),
          paymentMethod,
        }),
        sent_to_cashier_at: new Date().toISOString(),
      };

      if (branchEnabled && (currentProfile?.branch_id || branchId)) {
        orderPayload.branch_id = currentProfile?.branch_id || branchId;
      }

      const items = cart.map((item) => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.cartQuantity,
        unit_price: item.price_sell_after || item.price_sell_before,
        discount_amount: (item.price_sell_before - (item.price_sell_after || item.price_sell_before)) * item.cartQuantity,
        total_price: (item.price_sell_after || item.price_sell_before) * item.cartQuantity,
      }));

      const order = await createSalespersonOrder(
        orderPayload,
        items,
      );

      await logAction(
        'order_sent_to_cashier',
        {
          order_id: order.id,
          order_number: order.order_number,
          items_count: items.length,
          total_final_price: total,
        },
        orderPayload.branch_id || undefined,
      );

      toast.success('تم إرسال الفاتورة إلى الكاشير.');
      setCart([]);
      setNotes('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setPaymentMethod('cash');
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
  const activeSellerName = sellerForm.full_name || currentProfile?.full_name || 'البائع الحالي';
  const activeBranchName = branchEnabled ? branchName || 'بدون فرع' : null;
  const scrollToCartPanel = () => cartPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="motion-page-enter flex h-full flex-col bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.07),transparent_20%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]" dir="rtl">
      <div className="motion-panel-reveal sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1900px] flex-col gap-4 p-4 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:order-2 xl:w-[24rem] 2xl:w-[28rem]">
          <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث بكود المنتج أو الاسم..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="motion-interactive-outline w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pr-12 pl-4 font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-[1.75rem] bg-slate-100/80 p-1.5 sm:flex sm:gap-2 sm:overflow-x-auto sm:pb-1 xl:order-1 xl:w-fit xl:items-center hide-scrollbar">
          <button
            onClick={() => setView('pos')}
            className={`motion-button motion-press rounded-2xl border border-transparent px-3 py-3 text-sm font-black sm:shrink-0 sm:px-4 xl:min-w-[9.75rem] ${view === 'pos' ? 'bg-white text-slate-900 shadow-[0_12px_30px_-20px_rgba(37,99,235,0.55)]' : 'text-slate-500 hover:border-white/80 hover:bg-white/70'}`}
          >
            <span className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> نقطة البيع</span>
          </button>
          <button
            onClick={() => setView('history')}
            className={`motion-button motion-press rounded-2xl border border-transparent px-3 py-3 text-sm font-black sm:shrink-0 sm:px-4 xl:min-w-[9.75rem] ${view === 'history' ? 'bg-white text-slate-900 shadow-[0_12px_30px_-20px_rgba(37,99,235,0.55)]' : 'text-slate-500 hover:border-white/80 hover:bg-white/70'}`}
          >
            <span className="flex items-center gap-2"><HistoryIcon className="h-5 w-5" /> متابعة مبيعاتي</span>
          </button>
          <button
            onClick={() => setView('search')}
            className={`motion-button motion-press rounded-2xl border border-transparent px-3 py-3 text-sm font-black sm:shrink-0 sm:px-4 xl:min-w-[9.75rem] ${view === 'search' ? 'bg-white text-slate-900 shadow-[0_12px_30px_-20px_rgba(37,99,235,0.55)]' : 'text-slate-500 hover:border-white/80 hover:bg-white/70'}`}
          >
            <span className="flex items-center gap-2"><ScanSearch className="h-5 w-5" /> البحث بالكود</span>
          </button>
        </div>
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
        <div className="mx-auto flex w-full max-w-[1900px] flex-1 flex-col overflow-hidden lg:min-h-0 lg:flex-row lg:items-start lg:gap-6 lg:px-4 lg:py-5">
          <div className="px-4 pt-4 lg:hidden">
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="motion-fade-up motion-soft-lift rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-sm">
                <p className="mb-1 text-[11px] font-black text-slate-400">البائع الحالي</p>
                <p className="line-clamp-1 text-base font-black text-slate-900">{activeSellerName}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">{sellerForm.employee_code || 'بدون كود'}</p>
              </div>
              <div className="motion-fade-up motion-fade-up-delay-1 motion-soft-lift rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-sm">
                <p className="mb-1 text-[11px] font-black text-slate-400">الفرع والطلب</p>
                <p className="line-clamp-1 text-base font-black text-slate-900">{activeBranchName || 'العمل بدون فروع'}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">{cartCount} قطعة جاهزة الآن</p>
              </div>
            </div>
            <div className="motion-panel-reveal rounded-[1.75rem] border border-blue-100 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_70%)] p-4 shadow-sm">
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
                  onClick={scrollToCartPanel}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 font-black text-white"
                >
                  <ShoppingCart className="h-4 w-4" /> عرض السلة وبيانات الطلب
                </button>
              )}
            </div>
          </div>

          <div className="order-2 flex-1 overflow-y-auto px-4 pt-4 pb-28 sm:p-6 lg:order-1 lg:min-h-0 lg:self-stretch lg:pb-6 lg:pr-0">
            <div className="mb-5 hidden lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">مساحة البيع السريعة</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">اختَر المنتجات من اليسار، وراجع الطلب النهائي في اللوحة الجانبية قبل الإرسال للكاشير.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-black text-slate-400">البائع الحالي</p>
                  <p className="text-sm font-black text-slate-900">{activeSellerName}</p>
                </div>
                {activeBranchName && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 shadow-sm">
                    <p className="text-[11px] font-black text-blue-700">الفرع</p>
                    <p className="text-sm font-black text-blue-900">{activeBranchName}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  className="motion-fade-up motion-soft-lift motion-glow group flex min-h-[14.5rem] flex-col overflow-hidden rounded-[1.85rem] border border-white/80 bg-white p-5 text-right shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_24px_55px_-34px_rgba(59,130,246,0.28)]"
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
                  {(product.size_label || product.size_code) && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {product.size_label && <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-700">{product.size_label}</span>}
                      {product.size_code && <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black text-indigo-700">{product.size_code}</span>}
                    </div>
                  )}
                  <h3 className="mb-2 line-clamp-2 text-lg font-black leading-8 text-slate-800 transition group-hover:text-blue-600">{product.name}</h3>
                  <p className="mb-5 min-h-[2.75rem] line-clamp-2 text-xs font-bold leading-6 text-slate-400">{product.description || product.category || 'منتج جاهز للإضافة مباشرة إلى الفاتورة.'}</p>
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

          <div
            ref={cartPanelRef}
            className="order-1 z-10 flex w-full flex-col border-r border-slate-100 bg-white shadow-xl lg:order-2 lg:sticky lg:top-[7.75rem] lg:max-h-[calc(100dvh-9rem)] lg:min-h-0 lg:w-[380px] lg:self-start xl:w-[410px] 2xl:w-[440px] lg:overflow-hidden lg:rounded-[2rem] lg:border lg:border-white/70 lg:shadow-[0_24px_65px_-36px_rgba(15,23,42,0.35)]"
          >
            <div className="space-y-4 border-b border-slate-50 p-4 sm:p-6">
              <div className="motion-panel-reveal rounded-[1.75rem] border border-blue-100 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_70%)] p-5">
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
                    className="motion-interactive-outline w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-blue-100"
                  />
                  <input
                    type="text"
                    value={sellerForm.employee_code}
                    onChange={(event) => setSellerForm((prev) => ({ ...prev, employee_code: event.target.value }))}
                    placeholder="كود البائع"
                    className="motion-interactive-outline w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-blue-100"
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
                  className="motion-button motion-press motion-shimmer mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 font-black text-white hover:bg-slate-800 disabled:opacity-60"
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

            <div className="space-y-4 border-t border-slate-100 bg-slate-50 p-5 sm:p-6 lg:sticky lg:bottom-0 lg:z-10 lg:mt-auto lg:shadow-[0_-20px_45px_-34px_rgba(15,23,42,0.25)]">
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
                <label className="mb-1 block text-[10px] font-bold text-slate-400"><Building2 className="ml-1 inline h-3 w-3" /> عنوان العميل</label>
                <input type="text" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} placeholder="اختياري" className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold text-slate-400">طريقة الدفع</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPaymentMethod(option.value)}
                      className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${
                        paymentMethod === option.value
                          ? 'bg-slate-900 text-white shadow'
                          : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
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
                className={`motion-button motion-press motion-shimmer flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl py-4 text-lg font-black ${
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
              <div key={order.id} className="motion-fade-up motion-soft-lift flex flex-col gap-5 rounded-2xl border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between sm:p-6">
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

      {view === 'pos' && cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-18px_45px_-25px_rgba(15,23,42,0.32)] backdrop-blur xl:hidden safe-area-bottom">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <button
              type="button"
              onClick={scrollToCartPanel}
              className="motion-button motion-press motion-shimmer flex flex-1 items-center justify-between rounded-[1.5rem] bg-slate-950 px-4 py-3 text-white"
            >
              <span>
                <span className="block text-[11px] font-bold text-slate-300">السلة الحالية</span>
                <span className="block text-base font-black">{moneyFormatter.format(subtotal)} ج.م</span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-black">
                <ShoppingCart className="h-4 w-4" /> {cartCount}
              </span>
            </button>
            <button
              type="button"
              onClick={handleSubmitOrder}
              disabled={isSubmitting}
              className={`motion-button motion-press motion-shimmer flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-[1.5rem] px-4 font-black ${
                isSubmitting ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
              }`}
            >
              <Send className="h-4 w-4" /> {isSubmitting ? 'جارٍ الإرسال' : 'إرسال'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalespersonView;

