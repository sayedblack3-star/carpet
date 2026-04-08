import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  BadgeInfo,
  BellRing,
  Building2,
  CheckCircle,
  ChevronRight,
  CreditCard,
  Minus,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  ScanSearch,
  Search,
  ShoppingCart,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { getSafeSession, supabase } from '../supabase';
import { Order, OrderItem, Product } from '../types';
import { setupRealtimeFallback } from '../lib/realtimeFallback';
import { logAction } from '../lib/logger';
import { toFriendlyErrorMessage } from '../lib/errorMessages';
import ShiftManager from './ShiftManager';

type SellerMeta = Record<string, { employee_code?: string; full_name?: string }>;

interface CashierViewProps {
  branchId?: string | null;
  branchName?: string;
  branchEnabled?: boolean;
}

const moneyFormatter = new Intl.NumberFormat('ar-EG');

const CashierView: React.FC<CashierViewProps> = ({ branchId, branchName, branchEnabled = false }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [productSearch, setProductSearch] = useState('');
  const [sellerMeta, setSellerMeta] = useState<SellerMeta>({});
  const [realtimeFallbackActive, setRealtimeFallbackActive] = useState(false);
  const fallbackToastShownRef = useRef(false);

  useEffect(() => {
    void getSafeSession()
      .then((session) => {
        if (session) setSessionUser(session.user);
      })
      .catch((error) => {
        console.warn('Cashier session bootstrap skipped:', error);
      });

    void Promise.all([fetchOrders(), fetchProducts(), fetchSellerMeta()]);

    return setupRealtimeFallback({
      fetchNow: () => fetchOrders(false),
      createChannel: () =>
        supabase
          .channel('cashier_orders')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
            void fetchOrders(false);
          }),
      pollIntervalMs: 15000,
      onFallback: () => {
        setRealtimeFallbackActive(true);
        if (!fallbackToastShownRef.current) {
          fallbackToastShownRef.current = true;
          toast.info('التحديث المباشر لطلبات الكاشير غير متاح الآن، لذلك نستخدم تحديثًا دوريًا كحل احتياطي.');
        }
      },
    });
  }, [branchId, branchEnabled]);

  const fetchOrders = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setRefreshing(true);

    try {
      let query = supabase.from('orders').select('*').in('status', ['sent_to_cashier', 'under_review', 'confirmed']);

      if (branchEnabled && branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
      if (error) throw error;

      const nextOrders = (data || []) as Order[];
      setOrders(nextOrders);
      setRealtimeFallbackActive(false);
      setSelectedOrder((current) => {
        if (!current) return current;
        return nextOrders.find((order) => order.id === current.id) || null;
      });
    } catch (error) {
      console.warn('Failed to fetch cashier orders:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').eq('is_active', true).eq('is_deleted', false);
      if (error) throw error;
      setProducts((data || []) as Product[]);
    } catch (error) {
      console.warn('Failed to fetch products for cashier:', error);
    }
  };

  const fetchSellerMeta = async () => {
    try {
      let query = supabase.from('profiles').select('id, full_name, employee_code');
      if (branchEnabled && branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped = ((data || []) as Array<{ id: string; full_name?: string; employee_code?: string }>).reduce<SellerMeta>((acc, profile) => {
        acc[profile.id] = {
          full_name: profile.full_name,
          employee_code: profile.employee_code,
        };
        return acc;
      }, {});

      setSellerMeta(mapped);
    } catch (error) {
      console.warn('Failed to fetch seller meta:', error);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    try {
      const { data, error } = await supabase.from('order_items').select('*').eq('order_id', orderId);
      if (error) throw error;
      setOrderItems((data || []) as OrderItem[]);
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, 'تعذر تحميل أصناف الفاتورة.'));
    }
  };

  const selectOrder = async (order: Order) => {
    setSelectedOrder(order);
    await fetchOrderItems(order.id);
  };

  const refreshSelectedOrder = async () => {
    if (!selectedOrder) return;
    await Promise.all([fetchOrders(false), fetchOrderItems(selectedOrder.id)]);
    toast.success('تم تحديث بيانات الفاتورة.');
  };

  const markOrderAsUnderReview = async (orderId: string) => {
    await supabase.from('orders').update({ status: 'under_review' }).eq('id', orderId).neq('status', 'confirmed');
    if (selectedOrder?.id === orderId && selectedOrder.status !== 'confirmed') {
      setSelectedOrder({ ...selectedOrder, status: 'under_review' });
    }
    await logAction('order_marked_under_review', { order_id: orderId }, branchId || undefined);
    await fetchOrders(false);
  };

  const recalcOrderTotal = async (orderId: string) => {
    const { data: items, error } = await supabase.from('order_items').select('total_price, discount_amount').eq('order_id', orderId);
    if (error || !items) return;

    const totalFinal = items.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0);
    const totalOriginal = items.reduce((sum: number, item: any) => sum + (item.total_price || 0) + (item.discount_amount || 0), 0);

    await supabase
      .from('orders')
      .update({
        total_final_price: totalFinal,
        total_original_price: totalOriginal,
      })
      .eq('id', orderId);

    await fetchOrders(false);
    setSelectedOrder((current) =>
      current?.id === orderId
        ? { ...current, total_final_price: totalFinal, total_original_price: totalOriginal }
        : current,
    );
  };

  const updateItemQuantity = async (itemId: string, newQty: number) => {
    if (!selectedOrder || newQty <= 0) return;

    const item = orderItems.find((entry) => entry.id === itemId);
    if (!item) return;

    try {
      const newTotal = item.unit_price * newQty;
      const unitDiscount = item.quantity > 0 ? (item.discount_amount || 0) / item.quantity : 0;
      const newDiscountAmount = unitDiscount * newQty;

      const { error } = await supabase
        .from('order_items')
        .update({
          quantity: newQty,
          total_price: newTotal,
          discount_amount: newDiscountAmount,
        })
        .eq('id', itemId);

      if (error) throw error;

      await markOrderAsUnderReview(selectedOrder.id);
      await fetchOrderItems(selectedOrder.id);
      await recalcOrderTotal(selectedOrder.id);
      await logAction('order_item_quantity_updated', { order_id: selectedOrder.id, item_id: itemId, quantity: newQty }, branchId || undefined);
      toast.success('تم تحديث كمية الصنف داخل الفاتورة.');
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, 'تعذر تحديث الكمية.'));
    }
  };

  const removeItem = async (itemId: string) => {
    if (!selectedOrder) return;

    try {
      const { error } = await supabase.from('order_items').delete().eq('id', itemId);
      if (error) throw error;

      await markOrderAsUnderReview(selectedOrder.id);
      await fetchOrderItems(selectedOrder.id);
      await recalcOrderTotal(selectedOrder.id);
      await logAction('order_item_deleted', { order_id: selectedOrder.id, item_id: itemId }, branchId || undefined);
      toast.success('تم حذف الصنف من الفاتورة.');
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, 'تعذر حذف الصنف.'));
    }
  };

  const addProductToOrder = async (product: Product) => {
    if (!selectedOrder) return;

    try {
      const existing = orderItems.find((item) => item.product_id === product.id);
      const unitPrice = product.price_sell_after || product.price_sell_before;
      const unitDiscount = Math.max(0, product.price_sell_before - unitPrice);

      if (existing) {
        await updateItemQuantity(existing.id, existing.quantity + 1);
        return;
      }

      const { error } = await supabase.from('order_items').insert({
        order_id: selectedOrder.id,
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: unitPrice,
        discount_amount: unitDiscount,
        total_price: unitPrice,
      });

      if (error) throw error;

      await markOrderAsUnderReview(selectedOrder.id);
      await fetchOrderItems(selectedOrder.id);
      await recalcOrderTotal(selectedOrder.id);
      setProductSearch('');
      await logAction('order_item_added', { order_id: selectedOrder.id, product_id: product.id, product_name: product.name }, branchId || undefined);
      toast.success('تمت إضافة الصنف إلى الفاتورة.');
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, 'تعذر إضافة الصنف إلى الفاتورة.'));
    }
  };

  const markAsConfirmed = async (order: Order) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          cashier_id: sessionUser?.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      await logAction('order_confirmed', { order_id: order.id, order_number: order.order_number, cashier_id: sessionUser?.id }, branchId || undefined);
      toast.success('تم تأكيد التحصيل بنجاح، ويمكن الآن طباعة الفاتورة.');
      setSelectedOrder(null);
      setOrderItems([]);
      await fetchOrders(false);
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, 'تعذر تأكيد التحصيل الآن.'));
    }
  };

  const cancelOrder = async (order: Order) => {
    try {
      const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
      if (error) throw error;

      await logAction('order_cancelled', { order_id: order.id, order_number: order.order_number }, branchId || undefined);
      toast.warning('تم إلغاء الطلب وإزالته من قائمة التحصيل.');
      setSelectedOrder(null);
      setOrderItems([]);
      await fetchOrders(false);
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, 'تعذر إلغاء الطلب الآن.'));
    }
  };

  const handlePrint = () => {
    if (!selectedOrder) return;

    const sellerCode = sellerMeta[selectedOrder.salesperson_id]?.employee_code;
    const invoiceTotal = orderItems.reduce((sum, item) => sum + (item.total_price || 0), 0) || selectedOrder.total_final_price || 0;
    const invoiceDiscount = Math.max(0, (selectedOrder.total_original_price || 0) - invoiceTotal);
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      toast.error('تعذر فتح نافذة الطباعة. تأكد من السماح بالنوافذ المنبثقة.');
      return;
    }

    const rows = orderItems
      .map(
        (item) => `
          <tr>
            <td>${item.product_name}</td>
            <td>${item.quantity}</td>
            <td>${moneyFormatter.format(item.unit_price)} ج.م</td>
            <td>${moneyFormatter.format(item.total_price)} ج.م</td>
          </tr>`,
      )
      .join('');

    printWindow.document.write(`
      <html lang="ar" dir="rtl">
        <head>
          <title>فاتورة رقم ${selectedOrder.order_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            .sheet { max-width: 900px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 24px; }
            .brand { background: linear-gradient(135deg, #0f172a, #1d4ed8); color: white; border-radius: 24px; padding: 20px 24px; min-width: 280px; }
            .brand h1 { margin: 0 0 8px; font-size: 28px; }
            .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; width: 100%; }
            .meta-card { border: 1px solid #e2e8f0; border-radius: 18px; padding: 14px 16px; background: #f8fafc; }
            .meta-card small { display: block; color: #64748b; margin-bottom: 6px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; margin: 24px 0; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 14px 12px; text-align: right; }
            th { background: #eff6ff; color: #1e3a8a; font-size: 13px; }
            .summary { margin-top: 20px; margin-right: auto; width: min(320px, 100%); }
            .summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: 700; }
            .summary-row.total { font-size: 24px; color: #0f172a; border-bottom: none; }
            .note { margin-top: 16px; padding: 14px 16px; border-radius: 18px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-weight: 700; }
            .footer { margin-top: 36px; text-align: center; color: #64748b; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div class="brand">
                <h1>Carpet Land</h1>
                <div>فاتورة تحصيل رقم #${selectedOrder.order_number}</div>
                <div>${format(new Date(selectedOrder.created_at), 'yyyy-MM-dd HH:mm')}</div>
              </div>
              <div class="meta"></div>
            </div>
          </div>
        </body>
      </html>
    `);

    const metaContainer = printWindow.document.querySelector('.meta');
    if (metaContainer) {
      metaContainer.innerHTML = `
        <div class="meta-card"><small>البائع</small><div>${selectedOrder.salesperson_name || '-'}</div></div>
        <div class="meta-card"><small>كود البائع</small><div>${sellerCode || '-'}</div></div>
        <div class="meta-card"><small>اسم العميل</small><div>${selectedOrder.customer_name || '-'}</div></div>
        <div class="meta-card"><small>الهاتف</small><div>${selectedOrder.customer_phone || '-'}</div></div>
        <div class="meta-card"><small>الفرع</small><div>${branchEnabled && branchName ? branchName : 'غير محدد'}</div></div>
        <div class="meta-card"><small>حالة الطلب</small><div>${selectedOrder.status === 'confirmed' ? 'تم التحصيل' : 'قيد المعالجة'}</div></div>
      `;
    }

    printWindow.document.body.insertAdjacentHTML(
      'beforeend',
      `
        <table>
          <thead>
            <tr>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>سعر الوحدة</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="summary">
          <div class="summary-row"><span>الإجمالي قبل الخصم</span><span>${moneyFormatter.format(selectedOrder.total_original_price || invoiceTotal)} ج.م</span></div>
          <div class="summary-row"><span>إجمالي الخصم</span><span>${moneyFormatter.format(invoiceDiscount)} ج.م</span></div>
          <div class="summary-row total"><span>الإجمالي النهائي</span><span>${moneyFormatter.format(invoiceTotal)} ج.م</span></div>
        </div>
        ${selectedOrder.notes ? `<div class="note">ملاحظات: ${selectedOrder.notes}</div>` : ''}
        <div class="footer">شكرًا لتعاملكم مع كاربت لاند</div>
      `,
    );

    printWindow.document.close();
    printWindow.print();
  };

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const sellerCode = sellerMeta[order.salesperson_id]?.employee_code || '';
        const normalizedSearch = searchTerm.toLowerCase();

        return (
          order.order_number?.toString().includes(searchTerm) ||
          (order.salesperson_name || '').toLowerCase().includes(normalizedSearch) ||
          (order.customer_name || '').toLowerCase().includes(normalizedSearch) ||
          sellerCode.toLowerCase().includes(normalizedSearch)
        );
      }),
    [orders, searchTerm, sellerMeta],
  );

  const matchingProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const normalizedSearch = productSearch.toLowerCase();

    return products
      .filter((product) => product.name.toLowerCase().includes(normalizedSearch) || product.code.toLowerCase().includes(normalizedSearch))
      .slice(0, 6);
  }, [productSearch, products]);

  const sellerCodeForSelected = selectedOrder ? sellerMeta[selectedOrder.salesperson_id]?.employee_code : '';
  const pendingCount = orders.filter((order) => order.status === 'sent_to_cashier').length;
  const reviewCount = orders.filter((order) => order.status === 'under_review').length;
  const confirmedCount = orders.filter((order) => order.status === 'confirmed').length;
  const selectedOrderTotal = orderItems.reduce((sum, item) => sum + (item.total_price || 0), 0) || selectedOrder?.total_final_price || 0;
  const selectedOrderDiscount = Math.max(0, (selectedOrder?.total_original_price || 0) - selectedOrderTotal);

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_18%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] lg:flex-row"
      dir="rtl"
    >
      <div className="z-20 flex w-full flex-col border-l border-slate-200/70 bg-white/90 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-xl lg:w-[430px] xl:w-[460px]">
        <div className="space-y-4 border-b border-slate-100 p-5 sm:p-6">
          <div className="rounded-[2rem] bg-[#120b07] p-5 text-white shadow-[0_25px_60px_-30px_rgba(15,23,42,0.9)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] bg-white/10 text-amber-300">
              <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">مركز التحصيل</h2>
                <p className="text-xs font-bold text-white/60">مراجعة الطلبات واعتماد الدفع وطباعة الفاتورة</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-3 py-3">
                <p className="text-[10px] font-black text-white/60">جاهزة</p>
                <p className="mt-2 text-2xl font-black text-white">{pendingCount}</p>
              </div>
              <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-3 py-3">
                <p className="text-[10px] font-black text-white/60">مراجعة</p>
                <p className="mt-2 text-2xl font-black text-amber-300">{reviewCount}</p>
              </div>
              <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-3 py-3">
                <p className="text-[10px] font-black text-white/60">مؤكدة</p>
                <p className="mt-2 text-2xl font-black text-emerald-300">{confirmedCount}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {branchEnabled && branchName && (
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white">
                  <Building2 className="h-4 w-4 text-amber-300" /> {branchName}
                </div>
              )}

              <button
                type="button"
                onClick={() => void fetchOrders(false)}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white/85 transition hover:bg-white/15"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> تحديث
              </button>
            </div>
          </div>

          {realtimeFallbackActive && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
              <span>التحديث المباشر غير متاح الآن. قائمة الطلبات تُحدّث تلقائيًا كل بضع ثوانٍ.</span>
            </div>
          )}

          <div className="relative">
            <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث برقم الفاتورة أو اسم البائع أو العميل أو كود البائع..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-[1.6rem] border border-white/70 bg-gradient-to-l from-slate-50 to-white py-3.5 pr-12 pl-4 font-bold text-slate-700 shadow-[0_16px_35px_-24px_rgba(15,23,42,0.28)] outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100/70"
            />
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading ? (
            <div className="py-10 text-center font-bold text-slate-400">جاري تحميل طلبات الكاشير...</div>
          ) : (
            filteredOrders.map((order) => {
              const sellerCode = sellerMeta[order.salesperson_id]?.employee_code;
              const isSelected = selectedOrder?.id === order.id;

              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    void selectOrder(order);
                  }}
                  className={`group relative w-full overflow-hidden rounded-[1.8rem] border p-5 text-right transition-all duration-200 ${
                    isSelected
                      ? 'border-slate-900 bg-[#120b07] text-white shadow-[0_24px_50px_-28px_rgba(15,23,42,0.7)]'
                      : 'border-white/80 bg-white/95 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.32)] hover:-translate-y-0.5 hover:border-amber-100 hover:shadow-[0_26px_50px_-30px_rgba(245,158,11,0.3)]'
                  }`}
                >
                  <div
                    className={`absolute inset-x-0 top-0 h-1 ${
                      isSelected ? 'bg-gradient-to-l from-amber-300 via-orange-300 to-amber-500' : 'bg-gradient-to-l from-transparent via-slate-200 to-transparent'
                    }`}
                  />

                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className={`text-lg font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>#{order.order_number}</h4>
                      <p className={`text-xs font-bold ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
                        {format(new Date(order.created_at), 'hh:mm a')} - {order.salesperson_name}
                      </p>
                      {sellerCode && (
                        <p className={`mt-1 text-[11px] font-black ${isSelected ? 'text-blue-100' : 'text-blue-600'}`}>كود البائع: {sellerCode}</p>
                      )}
                      {order.customer_name && (
                        <p className={`mt-1 text-xs ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>{order.customer_name}</p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black ${
                        order.status === 'confirmed'
                          ? 'bg-emerald-500 text-white'
                          : order.status === 'under_review'
                            ? isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-amber-50 text-amber-700'
                            : isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {order.status === 'confirmed' ? 'مدفوع' : order.status === 'under_review' ? 'قيد المراجعة' : 'جاهز'}
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className={`text-[10px] font-black tracking-[0.2em] ${isSelected ? 'text-white/40' : 'text-slate-400'}`}>TOTAL</p>
                      <span className={`mt-1 block text-2xl font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {moneyFormatter.format(order.total_final_price || 0)} <small className="text-[10px] opacity-60">ج.م</small>
                    </span>
                    </div>
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-2xl transition ${
                        isSelected ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-amber-50 group-hover:text-amber-600'
                      }`}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                </button>
              );
            })
          )}

          {!loading && filteredOrders.length === 0 && (
            <div className="rounded-[2rem] border border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50 px-5 py-10 text-center shadow-[0_18px_40px_-32px_rgba(15,23,42,0.3)]">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-slate-100 text-slate-400">
                <Receipt className="h-8 w-8" />
              </div>
              <p className="font-bold text-slate-500">لا توجد طلبات تطابق البحث الحالي.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {sessionUser?.id && branchId && <ShiftManager userId={sessionUser.id} branchId={branchId} variant="card" />}

          {selectedOrder ? (
            <>
              <div className="rounded-[2.25rem] border border-white/70 bg-white p-6 shadow-[0_30px_70px_-42px_rgba(15,23,42,0.38)] sm:p-8">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="mb-1 text-xs font-black uppercase tracking-[0.24em] text-slate-400">Invoice Review</p>
                    <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">طلب رقم #{selectedOrder.order_number}</h1>
                    <p className="mt-2 text-sm font-bold text-slate-500">راجع الأصناف، أكد التحصيل، أو اطبع الفاتورة النهائية.</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={refreshSelectedOrder}
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 font-bold text-slate-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                    >
                      <RefreshCw className="h-4 w-4" /> تحديث الأصناف
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Printer className="h-4 w-4" /> طباعة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(null);
                        setOrderItems([]);
                      }}
                      className="rounded-2xl border border-red-100 bg-red-50 p-3 text-red-500 transition hover:border-red-200 hover:bg-red-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 rounded-[1.9rem] bg-gradient-to-b from-slate-50 to-white p-5 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-[1.4rem] border border-slate-100 bg-white px-4 py-4 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.28)]">
                    <p className="text-[10px] font-bold text-slate-400">البائع</p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-black text-slate-800">
                      <User className="h-3 w-3 text-blue-500" /> {selectedOrder.salesperson_name}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-slate-100 bg-white px-4 py-4 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.28)]">
                    <p className="text-[10px] font-bold text-slate-400">كود البائع</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{sellerCodeForSelected || '-'}</p>
                  </div>
                  <div className="rounded-[1.4rem] border border-slate-100 bg-white px-4 py-4 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.28)]">
                    <p className="text-[10px] font-bold text-slate-400">العميل</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{selectedOrder.customer_name || '-'}</p>
                  </div>
                  <div className="rounded-[1.4rem] border border-slate-100 bg-white px-4 py-4 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.28)]">
                    <p className="text-[10px] font-bold text-slate-400">الهاتف</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{selectedOrder.customer_phone || '-'}</p>
                  </div>
                  <div className="rounded-[1.4rem] border border-slate-100 bg-white px-4 py-4 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.28)]">
                    <p className="text-[10px] font-bold text-slate-400">التوقيت</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{format(new Date(selectedOrder.created_at), 'HH:mm - yyyy/MM/dd')}</p>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div className="mt-4 flex items-start gap-3 rounded-[1.6rem] border border-amber-100 bg-gradient-to-l from-amber-50 to-orange-50 px-4 py-4 text-amber-900 shadow-[0_18px_36px_-30px_rgba(245,158,11,0.4)]">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-[11px] font-black text-amber-700">ملاحظات الفاتورة</p>
                      <p className="mt-1 text-sm font-bold">{selectedOrder.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {selectedOrder.status !== 'confirmed' && (
                <div className="rounded-[2.1rem] border border-white/70 bg-white p-6 shadow-[0_28px_60px_-38px_rgba(15,23,42,0.32)]">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600">
                      <ScanSearch className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800">إضافة صنف إلى الفاتورة</h3>
                      <p className="text-sm font-bold text-slate-500">أي تعديل هنا سيحوّل الطلب إلى حالة "قيد المراجعة" حتى يعتمد الكاشير الفاتورة.</p>
                    </div>
                  </div>

                  <div className="relative mb-4">
                    <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ابحث بكود المنتج أو الاسم لإضافته..."
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      className="w-full rounded-[1.6rem] border border-white/70 bg-gradient-to-l from-slate-50 to-white py-3.5 pr-12 pl-4 font-bold text-slate-700 shadow-[0_16px_35px_-24px_rgba(15,23,42,0.28)] outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-100/70"
                    />
                  </div>

                  {matchingProducts.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {matchingProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            void addProductToOrder(product);
                          }}
                          className="rounded-[1.5rem] border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-4 text-right shadow-[0_16px_35px_-28px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="line-clamp-1 font-black text-slate-800">{product.name}</p>
                              <p className="mt-1 text-[11px] font-bold text-slate-400">{product.code}</p>
                            </div>
                            <span className="rounded-xl border border-blue-100 bg-white px-3 py-1 text-[11px] font-black text-blue-600 shadow-sm">
                              {moneyFormatter.format(product.price_sell_after || product.price_sell_before)} ج.م
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {productSearch.trim() && matchingProducts.length === 0 && (
                    <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 text-center font-bold text-slate-400">
                      لا توجد منتجات مطابقة لهذا البحث.
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-hidden rounded-[2.1rem] border border-white/70 bg-white shadow-[0_30px_70px_-42px_rgba(15,23,42,0.35)]">
                <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-l from-slate-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="flex items-center gap-2 font-black text-slate-800">
                    <ShoppingCart className="h-5 w-5 text-amber-500" /> محتويات الفاتورة
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-black text-slate-500">
                    <span>{orderItems.length} صنف</span>
                    <span>{moneyFormatter.format(selectedOrderTotal)} ج.م إجمالي</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[42rem] text-right">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400">المنتج</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400">السعر</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400">الكمية</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400">الإجمالي</th>
                        {selectedOrder.status !== 'confirmed' && <th className="px-6 py-4 text-[10px] font-bold text-slate-400">إجراء</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orderItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/60">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800">{item.product_name}</p>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700">{moneyFormatter.format(item.unit_price)} ج.م</td>
                          <td className="px-6 py-4">
                            {selectedOrder.status !== 'confirmed' ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void updateItemQuantity(item.id, item.quantity - 1);
                                  }}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 transition hover:bg-slate-200"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-8 text-center font-black">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void updateItemQuantity(item.id, item.quantity + 1);
                                  }}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 transition hover:bg-slate-200"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="font-black">{item.quantity}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-black text-slate-900">{moneyFormatter.format(item.total_price)} ج.م</td>
                          {selectedOrder.status !== 'confirmed' && (
                            <td className="px-6 py-4">
                              <button
                                type="button"
                                onClick={() => {
                                  void removeItem(item.id);
                                }}
                                className="rounded-lg p-2 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-6 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_24%),linear-gradient(135deg,#120b07_0%,#0f172a_100%)] p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-white/40">Settlement Total</p>
                    <span className="text-4xl font-black text-amber-500">{moneyFormatter.format(selectedOrderTotal)}</span>
                    <span className="mr-2 text-lg font-bold text-white/60">ج.م</span>
                    {selectedOrderDiscount > 0 && (
                      <p className="text-[11px] font-black text-emerald-300">إجمالي الخصم الحالي: {moneyFormatter.format(selectedOrderDiscount)} ج.م</p>
                    )}
                  </div>

                  {selectedOrder.status !== 'confirmed' ? (
                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          void cancelOrder(selectedOrder);
                        }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-6 py-4 font-bold text-red-200 transition hover:bg-red-500/20"
                      >
                        <X className="h-5 w-5" /> إلغاء الطلب
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void markAsConfirmed(selectedOrder);
                        }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-8 py-4 font-black text-slate-950 shadow-[0_20px_45px_-18px_rgba(245,158,11,0.65)] transition hover:bg-amber-300"
                      >
                        <CheckCircle className="h-5 w-5" /> تأكيد التحصيل
                      </button>
                    </div>
                  ) : (
                    <span className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/15 px-6 py-3 font-black text-emerald-300">
                      <CheckCircle className="h-5 w-5" /> تم الدفع بنجاح
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-[2.2rem] border border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50 px-6 py-12 text-center shadow-[0_25px_60px_-40px_rgba(15,23,42,0.25)]">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-slate-100 text-slate-400">
                <ShoppingCart className="h-10 w-10" />
              </div>
              <h2 className="mb-3 text-3xl font-black text-slate-800">في انتظار عملية جديدة</h2>
              <p className="mx-auto max-w-xl text-lg font-bold text-slate-400">
                اختر فاتورة من القائمة لمراجعتها وتحصيلها أو لإضافة أصناف عليها قبل التأكيد.
              </p>
              <div className="mx-auto mt-6 flex max-w-2xl items-start gap-3 rounded-[1.7rem] border border-blue-100 bg-gradient-to-l from-blue-50 to-sky-50 px-5 py-4 text-right text-sm font-bold text-blue-900 shadow-[0_18px_38px_-30px_rgba(59,130,246,0.35)]">
                <BadgeInfo className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <span>أي تعديل يقوم به الكاشير على الفاتورة ينتقل مباشرة إلى البائع في شاشة متابعة مبيعاتي، لذلك ستبقى حالة الطلب "قيد المراجعة" حتى يتم التحصيل النهائي.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CashierView;
