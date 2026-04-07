import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Order, Product, Profile } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, DollarSign, Package, ShoppingCart, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { subDays, startOfDay, format } from 'date-fns';
import { toast } from 'sonner';

export default function DashboardView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

  const fetchData = async () => {
    setLoading(true);
    let query = supabase.from('orders').select('*');
    const now = new Date();
    if (dateRange === 'today') query = query.gte('created_at', startOfDay(now).toISOString());
    else if (dateRange === 'week') query = query.gte('created_at', subDays(now, 7).toISOString());
    else if (dateRange === 'month') query = query.gte('created_at', subDays(now, 30).toISOString());
    const { data: ordersData } = await query.order('created_at', { ascending: false });
    if (ordersData) setOrders(ordersData as Order[]);

    const { data: productsData } = await supabase.from('products').select('*').eq('is_deleted', false);
    if (productsData) setProducts(productsData as Product[]);

    const { data: usersData } = await supabase.from('profiles').select('*');
    if (usersData) setUsers(usersData as Profile[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dateRange]);

  const confirmed = orders.filter(o => o.status === 'confirmed');
  const pending = orders.filter(o => o.status === 'sent_to_cashier' || o.status === 'under_review');
  const totalRevenue = confirmed.reduce((s, o) => s + (o.total_final_price || 0), 0);
  const avgOrder = confirmed.length > 0 ? totalRevenue / confirmed.length : 0;
  const lowStock = products.filter(p => p.stock_quantity <= p.min_stock_level && p.is_active);
  const sellers = users.filter(u => u.role === 'seller');
  const cashiers = users.filter(u => u.role === 'cashier');

  // Daily sales chart
  const last7days = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const dayStr = format(day, 'MM/dd');
    const daySales = confirmed
      .filter(o => format(new Date(o.created_at), 'MM/dd') === dayStr)
      .reduce((s, o) => s + (o.total_final_price || 0), 0);
    return { name: dayStr, sales: daySales };
  });

  const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
    <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-50 flex items-center gap-5">
      <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center shrink-0`}><Icon className="w-7 h-7" /></div>
      <div><p className="text-xs font-bold text-slate-400 mb-1">{label}</p><h3 className="text-2xl font-black text-slate-800">{value} <span className="text-xs text-slate-400">{sub}</span></h3></div>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto min-h-full" dir="rtl">
      <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3"><TrendingUp className="w-8 h-8 text-blue-600" /> لوحة التحكم</h1>
          <p className="text-slate-500 font-medium mt-1">متابعة الأداء في الوقت الفعلي</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl border shadow-sm">
          {(['today', 'week', 'month', 'all'] as const).map(r => (
            <button key={r} onClick={() => setDateRange(r)}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${dateRange === r ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
              {r === 'today' ? 'اليوم' : r === 'week' ? 'أسبوع' : r === 'month' ? 'شهر' : 'الكل'}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white/50 animate-pulse rounded-3xl border"></div>)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <StatCard icon={DollarSign} label="إجمالي الإيرادات" value={totalRevenue.toLocaleString()} sub="ج.م" color="bg-blue-50 text-blue-600" />
            <StatCard icon={ShoppingCart} label="الفواتير المحصلة" value={confirmed.length} sub="فاتورة" color="bg-emerald-50 text-emerald-600" />
            <StatCard icon={Clock} label="طلبات معلقة" value={pending.length} sub="طلب" color="bg-amber-50 text-amber-600" />
            <StatCard icon={Package} label="إجمالي المنتجات" value={products.length} sub="منتج" color="bg-purple-50 text-purple-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <StatCard icon={Users} label="البائعين" value={sellers.length} sub="بائع" color="bg-indigo-50 text-indigo-600" />
            <StatCard icon={Users} label="الكاشير" value={cashiers.length} sub="كاشير" color="bg-pink-50 text-pink-600" />
            <StatCard icon={DollarSign} label="متوسط الفاتورة" value={Math.round(avgOrder).toLocaleString()} sub="ج.م" color="bg-teal-50 text-teal-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div className="bg-white p-8 rounded-3xl shadow-lg border">
              <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2"><TrendingUp className="w-6 h-6 text-blue-500" /> المبيعات آخر 7 أيام</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last7days}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="sales" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={40} name="المبيعات" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-lg border">
              <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><Clock className="w-6 h-6 text-amber-500" /> آخر الطلبات</h3>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {orders.slice(0, 8).map(order => (
                  <div key={order.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                        {order.status === 'confirmed' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">طلب #{order.order_number}</p>
                        <p className="text-[10px] text-slate-400">{order.seller_name || 'موظف'}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-black text-slate-700 text-sm">{order.total_final_price} ج.م</p>
                      <span className={`text-[10px] font-bold ${order.status === 'confirmed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {order.status === 'confirmed' ? 'مدفوع' : 'معلق'}
                      </span>
                    </div>
                  </div>
                ))}
                {orders.length === 0 && <p className="text-center text-slate-400 py-8 font-bold">لا توجد طلبات في هذه الفترة</p>}
              </div>
            </div>
          </div>

          {/* Low Stock Alerts */}
          {lowStock.length > 0 && (
            <div className="bg-amber-50 p-8 rounded-3xl border border-amber-200 mb-10">
              <h3 className="text-lg font-black text-amber-800 mb-4 flex items-center gap-2"><AlertCircle className="w-6 h-6" /> تنبيهات المخزون المنخفض ({lowStock.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowStock.slice(0, 6).map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-2xl border border-amber-100 flex items-center justify-between">
                    <div><p className="font-bold text-slate-800 text-sm">{p.name}</p><p className="text-xs text-slate-400">كود: {p.code}</p></div>
                    <span className="text-amber-600 font-black text-lg">{p.stock_quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
