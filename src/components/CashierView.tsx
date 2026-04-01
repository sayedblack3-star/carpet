import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Order, OrderItem, Branch, Profile } from '../types';
import { format } from 'date-fns';
import { 
  Search, Printer, CheckCircle, Clock, Trash2, ShieldAlert, CreditCard, 
  ChevronRight, AlertCircle, ShoppingCart, User, Store as BranchIcon, ArrowLeft, Filter, 
  TrendingUp, Monitor, Edit2, Copy, X, RotateCcw, Bell, BellRing, History as HistoryIcon
} from 'lucide-react';
import { toast } from 'sonner';
import ShiftManager from './ShiftManager';

const CashierView: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeShift, setActiveShift] = useState<any>(null);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionUser(session.user);
        fetchProfile(session.user.id);
        checkShift(session.user.id);
      }
    });

    const channel = supabase
      .channel('cashier_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkShift = async (userId: string) => {
    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    setActiveShift(data);
  };

  const fetchProfile = async (id: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (data) {
      setCurrentProfile(data as Profile);
      fetchOrders(data.branch_id);
    }
  };

  const fetchOrders = async (branchId?: string | null) => {
    const bid = branchId || currentProfile?.branch_id;
    if (!bid) return;
    
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('branch_id', bid)
      .in('status', ['sent_to_cashier', 'under_review', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) setOrders(data as Order[]);
    setLoading(false);
  };

  const fetchOrderItems = async (orderId: string) => {
    const { data } = await supabase.from('order_items').select('*').eq('order_id', orderId);
    if (data) setOrderItems(data as OrderItem[]);
  };

  const markAsConfirmed = async (order: Order) => {
    const isManagement = currentProfile?.role === 'admin';
    if (!activeShift && !isManagement) {
       toast.error('يجب عليك بـدء وردية عمل أولاً قبل تحصيل الأموال');
       return;
    }

    try {
      // 1. Update Order Status (Task 4: confirmed)
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'confirmed', 
          cashier_id: sessionUser?.id, 
          confirmed_at: new Date().toISOString() 
        })
        .eq('id', order.id);

      if (error) throw error;

      // 2. Notify Salesperson (Task 5)
      await supabase.from('notifications').insert({
        branch_id: currentProfile?.branch_id!,
        sender_id: sessionUser?.id,
        receiver_id: order.salesperson_id,
        order_id: order.id,
        title: 'تم تحصيل طلبك! ✅',
        message: `تم دفع الفاتورة رقم ${order.order_number} بنجاح من قبل الكاشير`,
        type: 'sale'
      });

      toast.success('تم تأكيد عملية البيع والتحصيل بنجاح');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      toast.error('خطأ في التأكيد: ' + err.message);
    }
  };

  const markAsReview = async (order: Order) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'under_review' })
      .eq('id', order.id);
    
    if (!error) {
       toast.warning('الطلب الآن تحت المراجعة والتعديل');
       fetchOrders();
    }
  };

  const filteredOrders = orders.filter(o => 
    o.order_number.toString().includes(searchTerm) || 
    o.salesperson_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-slate-50" dir="rtl">
      {/* Sidebar - Pending Orders */}
      <div className="w-full lg:w-[450px] bg-white border-l border-slate-100 flex flex-col shadow-xl z-20">
        <div className="p-8 border-b border-slate-50 space-y-6">
           <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 ring-4 ring-blue-50">
               <CreditCard className="w-8 h-8" />
             </div>
             <div>
               <h2 className="text-2xl font-black text-slate-800 tracking-tighter">صندوق المدفوعات</h2>
               <p className="text-slate-400 text-xs font-black uppercase tracking-widest leading-none mt-1">المعاملات النشطة اليوم</p>
             </div>
           </div>

           <div className="relative group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="ابحث برقم الفاتورة أو البائع..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold transition-all"
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
           {!activeShift && (
              <div className="mb-6 p-6 bg-red-50 border border-red-100 rounded-[2rem] text-center">
                 <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                 <h4 className="text-red-700 font-black mb-1">الوردية مغلقة!</h4>
                 <p className="text-red-500 text-xs font-bold leading-relaxed">يرجى بدء وردية كاشير لتمكين تحصيل الفواتير</p>
              </div>
           )}

           {loading ? (
             <div className="flex flex-col items-center py-10 gap-3 opacity-20 animate-pulse">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                <span className="font-black text-slate-400">جاري التحديث...</span>
             </div>
           ) : (
             filteredOrders.map(order => (
               <div 
                 key={order.id}
                 onClick={() => { setSelectedOrder(order); fetchOrderItems(order.id); }}
                 className={`group p-6 rounded-[2.5rem] border transition-all cursor-pointer relative overflow-hidden ${
                   selectedOrder?.id === order.id 
                   ? 'bg-blue-600 border-blue-600 shadow-2xl shadow-blue-500/30' 
                   : 'bg-white border-slate-100 hover:border-blue-200 shadow-sm'
                 }`}
               >
                 {selectedOrder?.id === order.id && (
                   <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[4rem] -mr-8 -mt-8 rotate-12"></div>
                 )}

                 <div className="flex justify-between items-start mb-4 relative z-10">
                   <div>
                     <h4 className={`text-xl font-black ${selectedOrder?.id === order.id ? 'text-white' : 'text-slate-800'}`}>
                       #{order.order_number}
                     </h4>
                     <p className={`text-xs font-bold ${selectedOrder?.id === order.id ? 'text-blue-100' : 'text-slate-400'}`}>
                       {format(new Date(order.created_at), 'hh:mm a')} • {order.salesperson_name}
                     </p>
                   </div>
                   <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest ${
                     order.status === 'confirmed' ? 'bg-emerald-500 text-white' : 
                     order.status === 'under_review' ? 'bg-amber-500 text-white' :
                     selectedOrder?.id === order.id ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                   }`}>
                     {order.status === 'confirmed' ? 'محتمل' : 
                      order.status === 'under_review' ? 'مراجعة' : 'جاهز'}
                   </span>
                 </div>

                 <div className="flex items-end justify-between relative z-10">
                    <span className={`text-2xl font-black tracking-tighter ${selectedOrder?.id === order.id ? 'text-white' : 'text-slate-800'}`}>
                      {order.total_final_price} <small className="text-[10px] uppercase font-black opacity-60">ج.م</small>
                    </span>
                    <button className={`p-3 rounded-xl transition-all ${
                      selectedOrder?.id === order.id ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-slate-50 text-slate-400'
                    }`}>
                      <ChevronRight className={`w-6 h-6 transition-transform ${selectedOrder?.id === order.id ? 'rotate-180' : ''}`} />
                    </button>
                 </div>
               </div>
             ))
           )}
        </div>

        <div className="p-6 border-t border-slate-50">
           <ShiftManager userId={sessionUser?.id} branchId={currentProfile?.branch_id || ''} />
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12 pharaonic-pattern scroll-smooth custom-scrollbar">
         {selectedOrder ? (
           <div className="max-w-4xl mx-auto space-y-10 animate-fade-up">
              {/* Header Card */}
              <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 left-0 w-4 h-full bg-blue-500"></div>
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                       <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-xl rotate-3 group-hover:rotate-0 transition-transform duration-500 shadow-slate-900/30">
                          <Monitor className="w-10 h-10 text-amber-500" />
                       </div>
                       <div>
                          <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1 leading-none">تفاصيل الفاتورة الإلكترونية</p>
                          <h1 className="text-3xl font-black text-slate-800 tracking-tighter">ORDER NO: {selectedOrder.order_number}</h1>
                       </div>
                    </div>
                    <div className="flex gap-4">
                       <button className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black flex items-center gap-2 transition-all">
                          <Printer className="w-5 h-5" /> طباعة
                       </button>
                       <button onClick={() => setSelectedOrder(null)} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all">
                          <X className="w-6 h-6" />
                       </button>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10 p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100/50">
                    <div className="space-y-1">
                       <p className="text-slate-400 text-[10px] font-black uppercase">البائع</p>
                       <p className="font-black text-slate-800 text-sm flex items-center gap-2"><User className="w-3 h-3 text-blue-500" /> {selectedOrder.salesperson_name}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-slate-400 text-[10px] font-black uppercase">رقم الوردية</p>
                       <p className="font-black text-slate-800 text-sm">#SHT-102</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-slate-400 text-[10px] font-black uppercase">الحالة</p>
                       <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-600 rounded-lg text-[10px] font-black">
                          <Clock className="w-3 h-3" /> {selectedOrder.status === 'sent_to_cashier' ? 'بانتظار التحصيل' : 'تحت المراجعة'}
                       </span>
                    </div>
                    <div className="space-y-1">
                       <p className="text-slate-400 text-[10px] font-black uppercase">توقيت الإنشاء</p>
                       <p className="font-black text-slate-800 text-sm">{format(new Date(selectedOrder.created_at), 'hh:mm:ss a')}</p>
                    </div>
                 </div>
              </div>

              {/* Items Table */}
              <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl overflow-hidden">
                 <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-black text-slate-800 flex items-center gap-3">
                       <ShoppingCart className="w-5 h-5 text-blue-500" /> قائمة محتويات الفاتورة
                    </h3>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{orderItems.length} صنف</span>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                       <thead>
                          <tr className="border-b border-slate-50">
                             <th className="px-8 py-5 text-slate-400 text-[10px] font-black uppercase">الصنف والوصف</th>
                             <th className="px-8 py-5 text-slate-400 text-[10px] font-black uppercase">السعر</th>
                             <th className="px-8 py-5 text-slate-400 text-[10px] font-black uppercase">الكمية</th>
                             <th className="px-8 py-5 text-slate-400 text-[10px] font-black uppercase">الإجمالي</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {orderItems.map(item => (
                             <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-6">
                                   <p className="font-black text-slate-800 mb-0.5 group-hover:text-blue-600 transition-colors">{item.product_name}</p>
                                   <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-black">ID: {item.product_id.split('-')[0]}</span>
                                </td>
                                <td className="px-8 py-6 font-black text-slate-700">{item.unit_price} ج.م</td>
                                <td className="px-8 py-6">
                                   <span className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-800">{item.quantity}</span>
                                </td>
                                <td className="px-8 py-6">
                                   <span className="font-black text-lg text-slate-900">{item.total_price} ج.م</span>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>

                 {/* Action Bar */}
                 <div className="p-10 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-8">
                    <div>
                       <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-2">إجمالي المبلغ المطلوب تحصيله</p>
                       <div className="flex items-end gap-3">
                          <span className="text-5xl font-black tracking-tighter text-amber-500">{selectedOrder.total_final_price}</span>
                          <span className="text-xl font-black text-white/60 mb-2">جنيه مصري</span>
                       </div>
                    </div>

                    <div className="flex gap-4 w-full md:w-auto">
                       {selectedOrder.status !== 'confirmed' && (
                         <>
                            <button 
                              onClick={() => markAsReview(selectedOrder)}
                              className="flex-1 md:flex-none px-8 py-5 bg-white/10 hover:bg-white/20 text-white rounded-3xl font-black flex items-center justify-center gap-3 transition-all border border-white/10"
                            >
                               <Edit2 className="w-6 h-6" /> مراجعة و تعديل
                            </button>
                            <button
                              onClick={() => markAsConfirmed(selectedOrder)}
                              className="flex-1 md:flex-none px-12 py-5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-3xl font-black flex items-center justify-center gap-3 transition-all shadow-xl shadow-amber-500/20 active:scale-95"
                            >
                               <CheckCircle className="w-6 h-6" /> تأكيد التحصيل
                            </button>
                         </>
                       )}
                    </div>
                 </div>
              </div>
           </div>
         ) : (
           <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
              <div className="w-40 h-40 bg-white rounded-[4rem] flex items-center justify-center mb-8 shadow-2xl relative">
                 <div className="absolute inset-0 border-4 border-dashed border-slate-200 rounded-[4rem] animate-spin-slow"></div>
                 <ShoppingCart className="w-20 h-20 text-slate-200" />
              </div>
              <h2 className="text-4xl font-black text-slate-800 mb-4">في انتظار العمليات</h2>
              <p className="text-slate-400 font-medium text-lg max-w-md leading-relaxed">
                 اختر أحد الطلبات المعلقة من القائمة الجانبية لمباشرة عملية مراجعتها وتحصيل الأموال.
              </p>
           </div>
         )}
      </div>

      <style>{`
        .pharaonic-pattern {
          background-image: 
            radial-gradient(circle at 2px 2px, rgba(0,0,0,0.03) 1px, transparent 0);
          background-size: 24px 24px;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up {
          animation: fade-up 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default CashierView;
