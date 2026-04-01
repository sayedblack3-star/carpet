import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Order, OrderItem, Branch } from '../types';
import { format } from 'date-fns';
import { Copy, CheckCircle, Clock, Trash2, Edit, X, ShoppingCart, Store, Printer, RotateCcw, ArrowLeft, Bell, BellRing, History } from 'lucide-react';
import { toast } from 'sonner';
import ShiftManager from './ShiftManager';

interface CashierViewProps {
  userBranchId?: string | null;
  userRole?: string;
}

export default function CashierView({ userBranchId, userRole }: CashierViewProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(userBranchId || 'all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [sessionUser, setSessionUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        setSessionUser(session?.user);
    });

    const fetchBranches = async () => {
      const { data } = await supabase.from('branches').select('*');
      if (data) setBranches(data);
    };
    fetchBranches();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50);
    if (selectedBranch !== 'all') {
      query = query.eq('branch_id', selectedBranch);
    }
    const { data } = await query;
    if (data) setOrders(data as Order[]);
    setLoading(false);
  };

  const fetchNotifications = async () => {
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5);
    if (userBranchId) query = query.eq('branch_id', userBranchId);
    const { data } = await query;
    if (data) setNotifications(data);
  };

  useEffect(() => {
    fetchOrders();
    fetchNotifications();

    const orderChannel = supabase.channel('cashier-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.new.branch_id === userBranchId || !userBranchId) {
          toast.info(payload.new.title + ': ' + payload.new.message);
          fetchNotifications();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(orderChannel); };
  }, [selectedBranch, userBranchId]);

  const viewOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id);
    if (data) setSelectedOrderItems(data as OrderItem[]);
  };

  const markAsConfirmed = async (order: Order) => {
    const { error } = await supabase.from('orders')
      .update({ 
        status: 'confirmed', 
        cashier_id: sessionUser?.id, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', order.id);

    if (!error) {
      toast.success('تم تأكيد الطلب وتحصيل المبلغ بنجاح ✅');
      setSelectedOrder(null);
      fetchOrders();
    }
  };

  const cancelOrder = async (order: Order) => {
    if (!window.confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) return;
    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    if (!error) {
      toast.error('تم إلغاء الطلب');
      setSelectedOrder(null);
      fetchOrders();
    }
  };

  return (
    <div className="min-h-full pharaonic-bg p-4 sm:p-6" dir="rtl">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <Monitor className="w-8 h-8 text-emerald-600" /> واجهة الكاشير الذكية
          </h1>
          <p className="text-slate-500 font-medium mt-1">نظام ERP المتكامل لتحصيل المبيعات</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
           {notifications.length > 0 && (
             <div className="bg-white/80 p-2 rounded-2xl border border-white flex items-center gap-3 px-4 shadow-sm">
               <BellRing className="w-5 h-5 text-amber-500 animate-bounce" />
               <span className="text-sm font-bold text-slate-600 line-clamp-1">{notifications[0].message}</span>
             </div>
           )}
           <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm font-bold text-slate-700 outline-none">
             <option value="all">كل الفروع</option>
             {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
           </select>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-[3rem] shadow-2xl border border-white overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white/50">
               <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                 <History className="w-6 h-6 text-emerald-500" /> قائمة الطلبات الأخيرة
               </h2>
               <button onClick={fetchOrders} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                 <RotateCcw className="w-5 h-5" />
               </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 text-sm font-bold">
                    <th className="p-6">رقم الطلب</th>
                    <th className="p-6">الفرع</th>
                    <th className="p-6">البائع</th>
                    <th className="p-6">الإجمالي</th>
                    <th className="p-6">الحالة</th>
                    <th className="p-6 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={6} className="p-12 text-center text-slate-300">جاري التحميل...</td></tr>
                  ) : orders.length === 0 ? (
                    <tr><td colSpan={6} className="p-12 text-center text-slate-300">لا توجد طلبات حالياً</td></tr>
                  ) : (
                    orders.map(order => (
                      <tr key={order.id} className="hover:bg-emerald-50/30 transition-colors group">
                        <td className="p-6 font-black text-slate-800">#{order.order_number}</td>
                        <td className="p-6 text-slate-500 font-medium">{branches.find(b => b.id === order.branch_id)?.name}</td>
                        <td className="p-6 font-bold text-slate-700">{(order as any).salesperson_name}</td>
                        <td className="p-6 font-black text-emerald-600">{order.total_final_price} ج.م</td>
                        <td className="p-6">
                           <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                             order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                             order.status === 'sent' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                           }`}>
                             {order.status === 'confirmed' ? 'مؤكد/مدفوع' : order.status === 'sent' ? 'بانتظار التحصيل' : 'ملغي'}
                           </span>
                        </td>
                        <td className="p-6 text-center">
                           <button onClick={() => viewOrderDetails(order)} className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm">عرض التفاصيل</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white/80 backdrop-blur-xl rounded-[3rem] shadow-2xl border border-white p-8 sticky top-24 min-h-[600px] flex flex-col">
            {selectedOrder ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">تفاصيل الطلب</h3>
                    <p className="text-slate-400 font-bold mt-1">#{selectedOrder.order_number}</p>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-300">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1 space-y-4 mb-8 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                  {selectedOrderItems.map(item => (
                    <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <h4 className="font-bold text-slate-800 mb-1">{item.product_name}</h4>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">الكمية: <b className="text-slate-800">{item.quantity}</b></span>
                        <span className="font-black text-slate-700">{item.total_price} ج.م</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto border-t-2 border-slate-100 pt-6 space-y-6">
                   <div className="flex justify-between items-center bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                     <span className="text-emerald-700 font-bold">المبلغ المطلوب تحصيله:</span>
                     <span className="text-3xl font-black text-emerald-800">{selectedOrder.total_final_price} ج.م</span>
                   </div>

                   {selectedOrder.status === 'sent' && (
                     <div className="flex gap-4">
                       <button onClick={() => markAsConfirmed(selectedOrder)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-emerald-200 transition-all flex items-center justify-center gap-2">
                         <CheckCircle className="w-6 h-6" /> تأكيد التحصيل
                       </button>
                       <button onClick={() => cancelOrder(selectedOrder)} className="p-5 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 rounded-[2rem] transition-all">
                         <Trash2 className="w-6 h-6" />
                       </button>
                     </div>
                   )}
                   
                   <button className="w-full flex items-center justify-center gap-2 text-slate-400 font-bold hover:text-blue-500 transition-colors">
                     <Printer className="w-5 h-5" /> طباعة إيصال تجريبي
                   </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 py-20">
                <ShoppingCart className="w-24 h-24 mb-6 opacity-20" />
                <p className="font-black text-lg text-center">اختر فاتورة من القائمة<br/><span className="text-sm font-medium">لعرض التفاصيل وتحصيل المبلغ</span></p>
              </div>
            )}
          </div>
        </div>
      </div>
      <ShiftManager userId={sessionUser?.id} branchId={userBranchId || ''} />
    </div>
  );
}
