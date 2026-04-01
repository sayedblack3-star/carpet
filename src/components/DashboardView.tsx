import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Order, Branch } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, Users, Store, DollarSign, Package, Calendar, ShoppingCart, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { toast } from 'sonner';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

interface DashboardViewProps {
  userBranchId?: string | null;
}

export default function DashboardView({ userBranchId }: DashboardViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

  useEffect(() => {
    const fetchBranches = async () => {
      const { data } = await supabase.from('branches').select('*');
      if (data) setBranches(data as Branch[]);
    };
    fetchBranches();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    let query = supabase.from('orders').select('*');
    
    if (userBranchId) query = query.eq('branch_id', userBranchId);

    const now = new Date();
    if (dateRange === 'today') {
      query = query.gte('created_at', startOfDay(now).toISOString());
    } else if (dateRange === 'week') {
      query = query.gte('created_at', subDays(now, 7).toISOString());
    } else if (dateRange === 'month') {
      query = query.gte('created_at', subDays(now, 30).toISOString());
    }

    const { data } = await query.order('created_at', { ascending: false });
    if (data) {
      setOrders(data as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
    const channel = supabase.channel('dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchDashboardData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dateRange, userBranchId]);

  const confirmedOrders = orders.filter(o => o.status === 'confirmed');
  const totalRevenue = confirmedOrders.reduce((sum, o) => sum + (o.total_final_price || 0), 0);
  const totalOrders = confirmedOrders.length;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Chart Data: Sales by Branch
  const branchData = branches.map(b => {
    const branchSales = confirmedOrders
      .filter(o => o.branch_id === b.id)
      .reduce((sum, o) => sum + (o.total_final_price || 0), 0);
    return { name: b.name, sales: branchSales };
  }).filter(d => d.sales > 0);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto pharaonic-bg min-h-full" dir="rtl">
      <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
             <TrendingUp className="w-8 h-8 text-blue-600" /> لوحة الإحصائيات العامة
          </h1>
          <p className="text-slate-500 font-medium mt-1">متابعة أداء المبيعات والعمليات في الوقت الفعلي</p>
        </div>

        <div className="flex bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-white shadow-sm">
           {(['today', 'week', 'month', 'all'] as const).map(range => (
             <button 
               key={range}
               onClick={() => setDateRange(range)}
               className={`px-6 py-2.5 rounded-xl font-bold transition-all text-xs sm:text-sm ${dateRange === range ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}
             >
               {range === 'today' ? 'اليوم' : range === 'week' ? 'أسبوع' : range === 'month' ? 'شهر' : 'الكل'}
             </button>
           ))}
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white/50 animate-pulse rounded-3xl border border-white"></div>)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-50 flex items-center gap-5">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                <DollarSign className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1">إجمالي الإيرادات</p>
                <h3 className="text-2xl font-black text-slate-800">{totalRevenue.toLocaleString()} <span className="text-xs text-slate-400">ج.م</span></h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-50 flex items-center gap-5">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1">الفواتير المحصلة</p>
                <h3 className="text-2xl font-black text-slate-800">{totalOrders} <span className="text-xs text-slate-400">فاتورة</span></h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-50 flex items-center gap-5">
              <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                <Package className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1">متوسط الفاتورة</p>
                <h3 className="text-2xl font-black text-slate-800">{Math.round(avgOrder).toLocaleString()} <span className="text-xs text-slate-400">ج.م</span></h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-50 flex items-center gap-5">
              <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0">
                <Store className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1">الفروع النشطة</p>
                <h3 className="text-2xl font-black text-slate-800">{branches.length} <span className="text-xs text-slate-400">فرع</span></h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-white">
               <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2">
                 <Store className="w-6 h-6 text-blue-500" /> المبيعات حسب الفرع
               </h3>
               <div className="h-80">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={branchData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                     <Tooltip 
                       contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }} 
                       cursor={{fill: '#f8fafc'}}
                     />
                     <Bar dataKey="sales" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={40} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-white">
               <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2">
                 <Clock className="w-6 h-6 text-amber-500" /> حالة الطلبات الأخيرة
               </h3>
               <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {orders.slice(0, 8).map(order => (
                    <div key={order.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' : 
                          order.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          <ShoppingCart className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">طلب #{order.order_number}</p>
                          <p className="text-[10px] text-slate-400 font-medium">بواسطة: {(order as any).salesperson_name || 'موظف'}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-black text-slate-700 text-sm">{order.total_final_price} ج.م</p>
                        <span className={`text-[10px] font-bold ${
                          order.status === 'confirmed' ? 'text-emerald-500' : 
                          order.status === 'cancelled' ? 'text-red-500' : 
                          order.status === 'sent_to_cashier' ? 'text-blue-500' : 'text-amber-500'
                        }`}>
                          {order.status === 'confirmed' ? 'مدفوع' : 
                           order.status === 'cancelled' ? 'ملغي' : 
                           order.status === 'sent_to_cashier' ? 'بانتظار التحصيل' : 'تحت المراجعة'}
                        </span>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
