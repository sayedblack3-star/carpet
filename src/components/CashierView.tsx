import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { Order, OrderItem, Product } from '../types';
import { format } from 'date-fns';
import {
  Search,
  Printer,
  CheckCircle,
  Trash2,
  CreditCard,
  ChevronRight,
  ShoppingCart,
  User,
  X,
  Minus,
  Plus,
  BadgeInfo,
  ScanSearch,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { setupRealtimeFallback } from '../lib/realtimeFallback';

type SellerMeta = Record<string, { employee_code?: string; full_name?: string }>;

interface CashierViewProps {
  branchId?: string | null;
  branchName?: string;
  branchEnabled?: boolean;
}

const CashierView: React.FC<CashierViewProps> = ({ branchId, branchName, branchEnabled = false }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [productSearch, setProductSearch] = useState('');
  const [sellerMeta, setSellerMeta] = useState<SellerMeta>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionUser(session.user);
    });

    fetchOrders();
    fetchProducts();
    fetchSellerMeta();

    return setupRealtimeFallback({
      fetchNow: fetchOrders,
      createChannel: () =>
        supabase
          .channel('cashier_orders')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders()),
      pollIntervalMs: 15000,
    });
  }, [branchId, branchEnabled]);

  const fetchOrders = async () => {
    setLoading(true);
    let query = supabase.from('orders').select('*').in('status', ['sent_to_cashier', 'under_review', 'confirmed']);
    if (branchEnabled && branchId) {
      query = query.eq('branch_id', branchId);
    }
    const { data } = await query.order('created_at', { ascending: false }).limit(50);
    if (data) setOrders(data as Order[]);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).eq('is_deleted', false);
    if (data) setProducts(data as Product[]);
  };

  const fetchSellerMeta = async () => {
    let query = supabase.from('profiles').select('id, full_name, employee_code');
    if (branchEnabled && branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data } = await query;
    if (!data) return;

    const mapped = (data as Array<{ id: string; full_name?: string; employee_code?: string }>).reduce<SellerMeta>((acc, profile) => {
      acc[profile.id] = {
        full_name: profile.full_name,
        employee_code: profile.employee_code,
      };
      return acc;
    }, {});

    setSellerMeta(mapped);
  };

  const fetchOrderItems = async (orderId: string) => {
    const { data } = await supabase.from('order_items').select('*').eq('order_id', orderId);
    if (data) setOrderItems(data as OrderItem[]);
  };

  const markOrderAsUnderReview = async (orderId: string) => {
    await supabase.from('orders').update({ status: 'under_review' }).eq('id', orderId).neq('status', 'confirmed');
    if (selectedOrder?.id === orderId && selectedOrder.status !== 'confirmed') {
      setSelectedOrder({ ...selectedOrder, status: 'under_review' });
    }
    fetchOrders();
  };

  const updateItemQuantity = async (itemId: string, newQty: number) => {
    if (!selectedOrder || newQty <= 0) return;

    const item = orderItems.find((entry) => entry.id === itemId);
    if (!item) return;

    const newTotal = item.unit_price * newQty;
    const unitDiscount = item.quantity > 0 ? (item.discount_amount || 0) / item.quantity : 0;
    const newDiscountAmount = unitDiscount * newQty;

    const { error } = await supabase.from('order_items').update({
      quantity: newQty,
      total_price: newTotal,
      discount_amount: newDiscountAmount,
    }).eq('id', itemId);

    if (!error) {
      await markOrderAsUnderReview(selectedOrder.id);
      await fetchOrderItems(selectedOrder.id);
      await recalcOrderTotal(selectedOrder.id);
      toast.success('تم تحديث الكمية');
    }
  };

  const removeItem = async (itemId: string) => {
    if (!selectedOrder) return;

    const { error } = await supabase.from('order_items').delete().eq('id', itemId);
    if (!error) {
      await markOrderAsUnderReview(selectedOrder.id);
      await fetchOrderItems(selectedOrder.id);
      await recalcOrderTotal(selectedOrder.id);
      toast.success('تم حذف الصنف');
    }
  };

  const addProductToOrder = async (product: Product) => {
    if (!selectedOrder) return;

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

    if (!error) {
      await markOrderAsUnderReview(selectedOrder.id);
      await fetchOrderItems(selectedOrder.id);
      await recalcOrderTotal(selectedOrder.id);
      setProductSearch('');
      toast.success('تمت إضافة الصنف إلى الفاتورة');
    }
  };

  const recalcOrderTotal = async (orderId: string) => {
    const { data: items } = await supabase.from('order_items').select('total_price, discount_amount').eq('order_id', orderId);
    if (!items) return;

    const totalFinal = items.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0);
    const totalOriginal = items.reduce((sum: number, item: any) => sum + (item.total_price || 0) + (item.discount_amount || 0), 0);

    await supabase.from('orders').update({
      total_final_price: totalFinal,
      total_original_price: totalOriginal,
    }).eq('id', orderId);

    fetchOrders();
    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) => prev ? { ...prev, total_final_price: totalFinal, total_original_price: totalOriginal } : null);
    }
  };

  const markAsConfirmed = async (order: Order) => {
    try {
      const { error } = await supabase.from('orders').update({
        status: 'confirmed',
        payment_status: 'paid',
        cashier_id: sessionUser?.id,
        confirmed_at: new Date().toISOString(),
      }).eq('id', order.id);

      if (error) throw error;

      toast.success('تم تأكيد التحصيل بنجاح');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      toast.error(`خطأ: ${err.message}`);
    }
  };

  const cancelOrder = async (order: Order) => {
    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    if (!error) {
      toast.warning('تم إلغاء الطلب');
      setSelectedOrder(null);
      fetchOrders();
    }
  };

  const handlePrint = () => {
    if (!selectedOrder) return;

    const sellerCode = sellerMeta[selectedOrder.salesperson_id]?.employee_code;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<html lang="ar" dir="rtl"><head><title>فاتورة #${selectedOrder.order_number}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;direction:rtl}
        table{width:100%;border-collapse:collapse;margin:16px 0}
        th,td{border:1px solid #ddd;padding:8px;text-align:right}
        th{background:#f5f5f5}
        .header{text-align:center;margin-bottom:20px}
        h1{margin:0}
      </style></head><body>`);
    printWindow.document.write(`<div class="header"><h1>كاربت لاند</h1><p>فاتورة رقم: ${selectedOrder.order_number}</p><p>${format(new Date(selectedOrder.created_at), 'yyyy-MM-dd HH:mm')}</p></div>`);
    if (selectedOrder.customer_name) {
      printWindow.document.write(`<p><b>العميل:</b> ${selectedOrder.customer_name}${selectedOrder.customer_phone ? ` - ${selectedOrder.customer_phone}` : ''}</p>`);
    }
    printWindow.document.write(`<p><b>البائع:</b> ${selectedOrder.salesperson_name}${sellerCode ? ` - كود: ${sellerCode}` : ''}</p>`);
    if (branchEnabled && branchName) {
      printWindow.document.write(`<p><b>الفرع:</b> ${branchName}</p>`);
    }
    printWindow.document.write('<table><thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>');
    orderItems.forEach((item) => {
      printWindow.document.write(`<tr><td>${item.product_name}</td><td>${item.quantity}</td><td>${item.unit_price} ج.م</td><td>${item.total_price} ج.م</td></tr>`);
    });
    printWindow.document.write(`</tbody></table><h2 style="text-align:left">الإجمالي: ${selectedOrder.total_final_price} ج.م</h2>`);
    printWindow.document.write('<p style="text-align:center;margin-top:40px;color:#999">شكرا لتعاملكم مع كاربت لاند</p>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
  };

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const sellerCode = sellerMeta[order.salesperson_id]?.employee_code || '';
        return (
          order.order_number?.toString().includes(searchTerm) ||
          (order.salesperson_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (order.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          sellerCode.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }),
    [orders, searchTerm, sellerMeta],
  );

  const matchingProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    return products
      .filter((product) => product.name.toLowerCase().includes(productSearch.toLowerCase()) || product.code.toLowerCase().includes(productSearch.toLowerCase()))
      .slice(0, 6);
  }, [productSearch, products]);

  const sellerCodeForSelected = selectedOrder ? sellerMeta[selectedOrder.salesperson_id]?.employee_code : '';

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-slate-50" dir="rtl">
      <div className="w-full lg:w-[430px] bg-white border-l border-slate-100 flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-slate-50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">الحسابات / الكاشير</h2>
              <p className="text-slate-400 text-xs font-bold">الفواتير الواردة من البائعين</p>
            </div>
          </div>

          {branchEnabled && branchName && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-900 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> {branchName}
            </div>
          )}

          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث برقم الفاتورة أو البائع أو كوده..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-12 pl-4 py-3 bg-slate-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-10 text-slate-400 animate-pulse font-bold">جاري التحميل...</div>
          ) : (
            filteredOrders.map((order) => {
              const sellerCode = sellerMeta[order.salesperson_id]?.employee_code;
              return (
                <div
                  key={order.id}
                  onClick={() => {
                    setSelectedOrder(order);
                    fetchOrderItems(order.id);
                  }}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${selectedOrder?.id === order.id ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-white border-slate-100 hover:border-blue-200 shadow-sm'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className={`text-lg font-black ${selectedOrder?.id === order.id ? 'text-white' : 'text-slate-800'}`}>#{order.order_number}</h4>
                      <p className={`text-xs font-bold ${selectedOrder?.id === order.id ? 'text-blue-100' : 'text-slate-400'}`}>
                        {format(new Date(order.created_at), 'hh:mm a')} - {order.salesperson_name}
                      </p>
                      {sellerCode && <p className={`text-[11px] mt-1 font-black ${selectedOrder?.id === order.id ? 'text-blue-100' : 'text-blue-600'}`}>كود البائع: {sellerCode}</p>}
                      {order.customer_name && <p className={`text-xs mt-1 ${selectedOrder?.id === order.id ? 'text-blue-200' : 'text-slate-400'}`}>{order.customer_name}</p>}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${order.status === 'confirmed' ? 'bg-emerald-500 text-white' : order.status === 'under_review' ? selectedOrder?.id === order.id ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700' : selectedOrder?.id === order.id ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
                      {order.status === 'confirmed' ? 'مدفوع' : order.status === 'under_review' ? 'قيد المراجعة' : 'جاهز'}
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className={`text-xl font-black ${selectedOrder?.id === order.id ? 'text-white' : 'text-slate-800'}`}>
                      {order.total_final_price?.toLocaleString()} <small className="text-[10px] opacity-60">ج.م</small>
                    </span>
                    <ChevronRight className="w-5 h-5 opacity-40" />
                  </div>
                </div>
              );
            })
          )}
          {!loading && filteredOrders.length === 0 && <p className="text-center py-10 text-slate-400 font-bold">لا توجد طلبات</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        {selectedOrder ? (
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="bg-white rounded-3xl p-8 border shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <p className="text-slate-400 text-xs font-black uppercase mb-1">تفاصيل الفاتورة</p>
                  <h1 className="text-2xl font-black text-slate-800">طلب رقم: {selectedOrder.order_number}</h1>
                </div>
                <div className="flex gap-3">
                  <button onClick={handlePrint} className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold flex items-center gap-2">
                    <Printer className="w-5 h-5" /> طباعة
                  </button>
                  <button onClick={() => setSelectedOrder(null)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 p-6 bg-slate-50 rounded-2xl">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">البائع</p>
                  <p className="font-black text-slate-800 text-sm flex items-center gap-1"><User className="w-3 h-3 text-blue-500" /> {selectedOrder.salesperson_name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">كود البائع</p>
                  <p className="font-black text-slate-800 text-sm">{sellerCodeForSelected || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">العميل</p>
                  <p className="font-black text-slate-800 text-sm">{selectedOrder.customer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">الهاتف</p>
                  <p className="font-black text-slate-800 text-sm">{selectedOrder.customer_phone || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">التوقيت</p>
                  <p className="font-black text-slate-800 text-sm">{format(new Date(selectedOrder.created_at), 'HH:mm - yyyy/MM/dd')}</p>
                </div>
              </div>

              {selectedOrder.notes && <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100"><p className="text-sm text-amber-800 font-bold">{selectedOrder.notes}</p></div>}
            </div>

            {selectedOrder.status !== 'confirmed' && (
              <div className="bg-white rounded-3xl border shadow-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <ScanSearch className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800">إضافة صنف إلى الفاتورة</h3>
                    <p className="text-slate-500 text-sm">أي تعديل هنا سيحوّل الطلب إلى حالة "قيد المراجعة" حتى تأكيد الكاشير.</p>
                  </div>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ابحث بكود المنتج أو الاسم لإضافته..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pr-12 pl-4 py-3 bg-slate-50 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {matchingProducts.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {matchingProducts.map((product) => (
                      <button key={product.id} onClick={() => addProductToOrder(product)} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-right hover:border-blue-200 hover:bg-blue-50 transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-slate-800 line-clamp-1">{product.name}</p>
                            <p className="text-[11px] font-bold text-slate-400 mt-1">{product.code}</p>
                          </div>
                          <span className="rounded-xl bg-white px-3 py-1 text-[11px] font-black text-blue-600 shadow-sm">{(product.price_sell_after || product.price_sell_before).toLocaleString()} ج.م</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {productSearch.trim() && matchingProducts.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-400 font-bold">
                    لا توجد منتجات مطابقة لهذا البحث
                  </div>
                )}
              </div>
            )}

            <div id="invoice-print" className="bg-white rounded-3xl border shadow-lg overflow-hidden">
              <div className="p-6 bg-slate-50 border-b flex items-center justify-between">
                <h3 className="font-black text-slate-800 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-blue-500" /> محتويات الفاتورة</h3>
                <span className="text-xs font-bold text-slate-400">{orderItems.length} صنف</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="px-6 py-4 text-slate-400 text-[10px] font-bold">المنتج</th>
                      <th className="px-6 py-4 text-slate-400 text-[10px] font-bold">السعر</th>
                      <th className="px-6 py-4 text-slate-400 text-[10px] font-bold">الكمية</th>
                      <th className="px-6 py-4 text-slate-400 text-[10px] font-bold">الإجمالي</th>
                      {selectedOrder.status !== 'confirmed' && <th className="px-6 py-4 text-slate-400 text-[10px] font-bold">إجراء</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {orderItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4"><p className="font-bold text-slate-800">{item.product_name}</p></td>
                        <td className="px-6 py-4 font-bold text-slate-700">{item.unit_price} ج.م</td>
                        <td className="px-6 py-4">
                          {selectedOrder.status !== 'confirmed' ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => updateItemQuantity(item.id, item.quantity - 1)} className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-slate-200"><Minus className="w-3 h-3" /></button>
                              <span className="w-8 text-center font-black">{item.quantity}</span>
                              <button onClick={() => updateItemQuantity(item.id, item.quantity + 1)} className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-slate-200"><Plus className="w-3 h-3" /></button>
                            </div>
                          ) : <span className="font-black">{item.quantity}</span>}
                        </td>
                        <td className="px-6 py-4 font-black text-slate-900">{item.total_price} ج.م</td>
                        {selectedOrder.status !== 'confirmed' && (
                          <td className="px-6 py-4">
                            <button onClick={() => removeItem(item.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-8 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                  <p className="text-white/40 text-xs font-bold uppercase">إجمالي المبلغ</p>
                  <span className="text-4xl font-black text-amber-500">{selectedOrder.total_final_price?.toLocaleString()}</span>
                  <span className="text-lg font-bold text-white/60 mr-2">ج.م</span>
                  {selectedOrder.total_original_price > selectedOrder.total_final_price && (
                    <p className="text-[11px] font-black text-emerald-300">الخصم الحالي: {(selectedOrder.total_original_price - selectedOrder.total_final_price).toLocaleString()} ج.م</p>
                  )}
                </div>

                {selectedOrder.status !== 'confirmed' ? (
                  <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={() => cancelOrder(selectedOrder)} className="flex-1 md:flex-none px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-2xl font-bold flex items-center justify-center gap-2 border border-red-500/20">
                      <X className="w-5 h-5" /> إلغاء
                    </button>
                    <button onClick={() => markAsConfirmed(selectedOrder)} className="flex-1 md:flex-none px-10 py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl active:scale-95">
                      <CheckCircle className="w-5 h-5" /> تأكيد التحصيل
                    </button>
                  </div>
                ) : (
                  <span className="px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-black flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> تم الدفع بنجاح
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
            <ShoppingCart className="w-20 h-20 text-slate-200 mb-6" />
            <h2 className="text-3xl font-black text-slate-800 mb-3">في انتظار العمليات</h2>
            <p className="text-slate-400 font-medium text-lg max-w-md">اختر فاتورة من القائمة لمراجعتها وتحصيلها أو إضافة أصناف عليها</p>
            <div className="mt-5 rounded-2xl bg-white border border-slate-100 px-5 py-4 shadow-sm flex items-center gap-3">
              <BadgeInfo className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-bold text-slate-600">التعديلات التي يقوم بها الكاشير تظهر للبائع في متابعة مبيعاتي.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashierView;
