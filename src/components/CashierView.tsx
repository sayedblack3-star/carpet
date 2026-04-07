import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Order, OrderItem, Profile } from '../types';
import { format } from 'date-fns';
import { Search, Printer, CheckCircle, Clock, Trash2, CreditCard, ChevronRight, ShoppingCart, User, X, Edit2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

const CashierView: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionUser(session.user);
        supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => {
          if (data) setCurrentProfile(data as Profile);
        });
      }
    });
    fetchOrders();
    const channel = supabase.channel('cashier_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('orders').select('*')
      .in('status', ['sent_to_cashier', 'under_review', 'confirmed'])
      .order('created_at', { ascending: false }).limit(50);
    if (data) setOrders(data as Order[]);
    setLoading(false);
  };

  const fetchOrderItems = async (orderId: string) => {
    const { data } = await supabase.from('order_items').select('*').eq('order_id', orderId);
    if (data) setOrderItems(data as OrderItem[]);
  };

  const updateItemQuantity = async (itemId: string, newQty: number) => {
    if (newQty <= 0) return;
    const item = orderItems.find(i => i.id === itemId);
    if (!item) return;
    const newTotal = item.unit_price * newQty;
    const { error } = await supabase.from('order_items').update({ quantity: newQty, total_price: newTotal }).eq('id', itemId);
    if (!error) {
      fetchOrderItems(selectedOrder!.id);
      recalcOrderTotal(selectedOrder!.id);
      toast.success('تم تحديث الكمية');
    }
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from('order_items').delete().eq('id', itemId);
    if (!error) {
      fetchOrderItems(selectedOrder!.id);
      recalcOrderTotal(selectedOrder!.id);
      toast.success('تم حذف الصنف');
    }
  };

  const recalcOrderTotal = async (orderId: string) => {
    const { data: items } = await supabase.from('order_items').select('total_price').eq('order_id', orderId);
    if (items) {
      const total = items.reduce((s: number, i: any) => s + (i.total_price || 0), 0);
      await supabase.from('orders').update({ total_final_price: total, total_original_price: total }).eq('id', orderId);
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, total_final_price: total } : null);
      }
    }
  };

  const markAsConfirmed = async (order: Order) => {
    try {
      const { error } = await supabase.from('orders').update({
        status: 'confirmed', payment_status: 'paid',
        cashier_id: sessionUser?.id, confirmed_at: new Date().toISOString()
      }).eq('id', order.id);
      if (error) throw error;
      toast.success('تم تأكيد التحصيل بنجاح');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      toast.error('خطأ: ' + err.message);
    }
  };

  const cancelOrder = async (order: Order) => {
    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    if (!error) { toast.warning('تم إلغاء الطلب'); setSelectedOrder(null); fetchOrders(); }
  };

  const handlePrint = () => {
    if (!selectedOrder) return;
    const printContent = document.getElementById('invoice-print');
    if (printContent) {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`<html dir="rtl"><head><title>فاتورة #${selectedOrder.order_number}</title>
          <style>body{font-family:Arial,sans-serif;padding:20px;direction:rtl}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #ddd;padding:8px;text-align:right}th{background:#f5f5f5}.header{text-align:center;margin-bottom:20px}h1{margin:0}@media print{body{padding:10px}}</style></head><body>`);
        w.document.write(`<div class="header"><h1>Carpet Land</h1><p>فاتورة رقم: ${selectedOrder.order_number}</p><p>${format(new Date(selectedOrder.created_at), 'yyyy-MM-dd HH:mm')}</p></div>`);
        if (selectedOrder.customer_name) w.document.write(`<p><b>العميل:</b> ${selectedOrder.customer_name} ${selectedOrder.customer_phone ? '- ' + selectedOrder.customer_phone : ''}</p>`);
        w.document.write(`<p><b>البائع:</b> ${selectedOrder.seller_name}</p>`);
        w.document.write('<table><thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>');
        orderItems.forEach(item => {
          w.document.write(`<tr><td>${item.product_name}</td><td>${item.quantity}</td><td>${item.unit_price} ج.م</td><td>${item.total_price} ج.م</td></tr>`);
        });
        w.document.write(`</tbody></table><h2 style="text-align:left">الإجمالي: ${selectedOrder.total_final_price} ج.م</h2>`);
        w.document.write('<p style="text-align:center;margin-top:40px;color:#999">شكراً لتعاملكم مع أرض السجاد</p>');
        w.document.write('</body></html>');
        w.document.close();
        w.print();
      }
    }
  };

  const filteredOrders = orders.filter(o =>
    o.order_number?.toString().includes(searchTerm) ||
    (o.seller_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-slate-50" dir="rtl">
      {/* Sidebar */}
      <div className="w-full lg:w-[420px] bg-white border-l border-slate-100 flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-slate-50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><CreditCard className="w-6 h-6" /></div>
            <div><h2 className="text-xl font-black text-slate-800">صندوق التحصيل</h2><p className="text-slate-400 text-xs font-bold">الطلبات الواردة</p></div>
          </div>
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="ابحث برقم الفاتورة أو البائع..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-12 pl-4 py-3 bg-slate-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-10 text-slate-400 animate-pulse font-bold">جاري التحميل...</div>
          ) : filteredOrders.map(order => (
            <div key={order.id} onClick={() => { setSelectedOrder(order); fetchOrderItems(order.id); }}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${selectedOrder?.id === order.id ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-white border-slate-100 hover:border-blue-200 shadow-sm'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className={`text-lg font-black ${selectedOrder?.id === order.id ? 'text-white' : 'text-slate-800'}`}>#{order.order_number}</h4>
                  <p className={`text-xs font-bold ${selectedOrder?.id === order.id ? 'text-blue-100' : 'text-slate-400'}`}>
                    {format(new Date(order.created_at), 'hh:mm a')} • {order.seller_name}
                  </p>
                  {order.customer_name && <p className={`text-xs mt-1 ${selectedOrder?.id === order.id ? 'text-blue-200' : 'text-slate-400'}`}>👤 {order.customer_name}</p>}
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${order.status === 'confirmed' ? 'bg-emerald-500 text-white' : selectedOrder?.id === order.id ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
                  {order.status === 'confirmed' ? 'مدفوع' : order.status === 'under_review' ? 'مراجعة' : 'جاهز'}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <span className={`text-xl font-black ${selectedOrder?.id === order.id ? 'text-white' : 'text-slate-800'}`}>
                  {order.total_final_price?.toLocaleString()} <small className="text-[10px] opacity-60">ج.م</small>
                </span>
                <ChevronRight className="w-5 h-5 opacity-40" />
              </div>
            </div>
          ))}
          {!loading && filteredOrders.length === 0 && <p className="text-center py-10 text-slate-400 font-bold">لا توجد طلبات</p>}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        {selectedOrder ? (
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="bg-white rounded-3xl p-8 border shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <p className="text-slate-400 text-xs font-black uppercase mb-1">تفاصيل الفاتورة</p>
                  <h1 className="text-2xl font-black text-slate-800">طلب رقم: {selectedOrder.order_number}</h1>
                </div>
                <div className="flex gap-3">
                  <button onClick={handlePrint} className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold flex items-center gap-2"><Printer className="w-5 h-5" /> طباعة</button>
                  <button onClick={() => setSelectedOrder(null)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 p-6 bg-slate-50 rounded-2xl">
                <div><p className="text-[10px] text-slate-400 font-bold">البائع</p><p className="font-black text-slate-800 text-sm flex items-center gap-1"><User className="w-3 h-3 text-blue-500" /> {selectedOrder.seller_name}</p></div>
                <div><p className="text-[10px] text-slate-400 font-bold">العميل</p><p className="font-black text-slate-800 text-sm">{selectedOrder.customer_name || '—'}</p></div>
                <div><p className="text-[10px] text-slate-400 font-bold">الهاتف</p><p className="font-black text-slate-800 text-sm">{selectedOrder.customer_phone || '—'}</p></div>
                <div><p className="text-[10px] text-slate-400 font-bold">التوقيت</p><p className="font-black text-slate-800 text-sm">{format(new Date(selectedOrder.created_at), 'HH:mm - yyyy/MM/dd')}</p></div>
              </div>
              {selectedOrder.notes && <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100"><p className="text-sm text-amber-800 font-bold">📝 {selectedOrder.notes}</p></div>}
            </div>

            {/* Items */}
            <div id="invoice-print" className="bg-white rounded-3xl border shadow-lg overflow-hidden">
              <div className="p-6 bg-slate-50 border-b flex items-center justify-between">
                <h3 className="font-black text-slate-800 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-blue-500" /> محتويات الفاتورة</h3>
                <span className="text-xs font-bold text-slate-400">{orderItems.length} صنف</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead><tr className="border-b border-slate-50">
                    <th className="px-6 py-4 text-slate-400 text-[10px] font-bold">المنتج</th>
                    <th className="px-6 py-4 text-slate-400 text-[10px] font-bold">السعر</th>
                    <th className="px-6 py-4 text-slate-400 text-[10px] font-bold">الكمية</th>
                    <th className="px-6 py-4 text-slate-400 text-[10px] font-bold">الإجمالي</th>
                    {selectedOrder.status !== 'confirmed' && <th className="px-6 py-4 text-slate-400 text-[10px] font-bold">إجراء</th>}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {orderItems.map(item => (
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
                            <button onClick={() => removeItem(item.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Bar */}
              <div className="p-8 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <p className="text-white/40 text-xs font-bold uppercase mb-1">إجمالي المبلغ</p>
                  <span className="text-4xl font-black text-amber-500">{selectedOrder.total_final_price?.toLocaleString()}</span>
                  <span className="text-lg font-bold text-white/60 mr-2">ج.م</span>
                </div>
                {selectedOrder.status !== 'confirmed' && (
                  <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={() => cancelOrder(selectedOrder)} className="flex-1 md:flex-none px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-2xl font-bold flex items-center justify-center gap-2 border border-red-500/20">
                      <X className="w-5 h-5" /> إلغاء
                    </button>
                    <button onClick={() => markAsConfirmed(selectedOrder)} className="flex-1 md:flex-none px-10 py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl active:scale-95">
                      <CheckCircle className="w-5 h-5" /> تأكيد التحصيل
                    </button>
                  </div>
                )}
                {selectedOrder.status === 'confirmed' && (
                  <span className="px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-black flex items-center gap-2"><CheckCircle className="w-5 h-5" /> تم الدفع بنجاح</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
            <ShoppingCart className="w-20 h-20 text-slate-200 mb-6" />
            <h2 className="text-3xl font-black text-slate-800 mb-3">في انتظار العمليات</h2>
            <p className="text-slate-400 font-medium text-lg max-w-md">اختر طلب من القائمة لمراجعته وتحصيله</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashierView;
