import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { Branch, Order, OrderItem, Product, Profile, Shift } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, DollarSign, Package, ShoppingCart, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { subDays, startOfDay, format } from 'date-fns';

const QUERY_TIMEOUT_MS = 6000;
const QUERY_RETRY_DELAY_MS = 700;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isTransientNetworkError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('fetch') ||
    message.includes('timeout')
  );
};

const queryWithRetry = async <T,>(runQuery: () => Promise<T>, retries = 1): Promise<T> => {
  try {
    return await withTimeout(runQuery(), QUERY_TIMEOUT_MS);
  } catch (error) {
    if (retries <= 0 || !isTransientNetworkError(error)) {
      throw error;
    }

    await delay(QUERY_RETRY_DELAY_MS);
    return queryWithRetry(runQuery, retries - 1);
  }
};

const DashboardView: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

  const fetchData = async () => {
    setLoading(true);
    setLoadError(null);

    let ordersQuery = supabase.from('orders').select('*');
    const now = new Date();

    if (dateRange === 'today') {
      ordersQuery = ordersQuery.gte('created_at', startOfDay(now).toISOString());
    } else if (dateRange === 'week') {
      ordersQuery = ordersQuery.gte('created_at', subDays(now, 7).toISOString());
    } else if (dateRange === 'month') {
      ordersQuery = ordersQuery.gte('created_at', subDays(now, 30).toISOString());
    }

    const [ordersResult, productsResult, usersResult, orderItemsResult, shiftsResult, branchesResult] = await Promise.allSettled([
      queryWithRetry(() => Promise.resolve(ordersQuery.order('created_at', { ascending: false }))),
      queryWithRetry(() => Promise.resolve(supabase.from('products').select('*').eq('is_deleted', false))),
      queryWithRetry(() => Promise.resolve(supabase.from('profiles').select('*'))),
      queryWithRetry(() => Promise.resolve(supabase.from('order_items').select('*'))),
      queryWithRetry(() => Promise.resolve(supabase.from('shifts').select('*').order('start_time', { ascending: false }).limit(50))),
      queryWithRetry(() => Promise.resolve(supabase.from('branches').select('id, name, slug, is_active').eq('is_active', true).order('name'))),
    ]);

    const failedResults = [ordersResult, productsResult, usersResult, orderItemsResult, shiftsResult, branchesResult].filter((result) => result.status === 'rejected');
    if (failedResults.length > 0) {
      setLoadError('تعذر تحميل بعض بيانات لوحة التحكم. تم الاحتفاظ بالعرض وسيتم إعادة المحاولة تلقائيًا.');
    }

    if (ordersResult.status === 'fulfilled' && !ordersResult.value.error) {
      setOrders((ordersResult.value.data || []) as Order[]);
    } else if (orders.length === 0) {
      setOrders([]);
    }

    if (productsResult.status === 'fulfilled' && !productsResult.value.error) {
      setProducts((productsResult.value.data || []) as Product[]);
    } else if (products.length === 0) {
      setProducts([]);
    }

    if (usersResult.status === 'fulfilled' && !usersResult.value.error) {
      setUsers((usersResult.value.data || []) as Profile[]);
    } else if (users.length === 0) {
      setUsers([]);
    }

    if (orderItemsResult.status === 'fulfilled' && !orderItemsResult.value.error) {
      setOrderItems((orderItemsResult.value.data || []) as OrderItem[]);
    } else if (orderItems.length === 0) {
      setOrderItems([]);
    }

    if (shiftsResult.status === 'fulfilled' && !shiftsResult.value.error) {
      setShifts((shiftsResult.value.data || []) as Shift[]);
    } else if (shifts.length === 0) {
      setShifts([]);
    }

    if (branchesResult.status === 'fulfilled' && !branchesResult.value.error) {
      setBranches((branchesResult.value.data || []) as Branch[]);
    } else if (branches.length === 0) {
      setBranches([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void fetchData();

    const intervalId = window.setInterval(() => {
      void fetchData();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [dateRange]);

  const confirmed = useMemo(() => orders.filter((order) => order.status === 'confirmed'), [orders]);
  const pending = useMemo(() => orders.filter((order) => order.status === 'sent_to_cashier' || order.status === 'under_review'), [orders]);
  const totalRevenue = confirmed.reduce((sum, order) => sum + (order.total_final_price || 0), 0);
  const avgOrder = confirmed.length > 0 ? totalRevenue / confirmed.length : 0;
  const lowStock = products.filter((product) => product.stock_quantity <= product.min_stock_level && product.is_active);
  const sellers = users.filter((user) => user.role === 'seller');
  const cashiers = users.filter((user) => user.role === 'cashier');
  const activeShifts = shifts.filter((shift) => shift.status === 'active');
  const closedToday = shifts.filter((shift) => shift.status === 'closed' && shift.end_time && new Date(shift.end_time) >= startOfDay(new Date()));
  const confirmedOrderIds = new Set(confirmed.map((order) => order.id));
  const topProducts = Object.values(
    orderItems
      .filter((item) => confirmedOrderIds.has(item.order_id))
      .reduce<Record<string, { product_name: string; quantity: number; revenue: number }>>((acc, item) => {
        const key = item.product_id || item.product_name;
        if (!acc[key]) {
          acc[key] = { product_name: item.product_name, quantity: 0, revenue: 0 };
        }
        acc[key].quantity += item.quantity || 0;
        acc[key].revenue += item.total_price || 0;
        return acc;
      }, {}),
  )
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 5);
  const branchNames = branches.reduce<Record<string, string>>((acc, branch) => {
    acc[branch.id] = branch.name;
    return acc;
  }, {});
  const branchPerformance = Object.values(
    confirmed.reduce<Record<string, { branch_id: string; name: string; orders: number; revenue: number }>>((acc, order) => {
      const key = order.branch_id || 'unassigned';
      if (!acc[key]) {
        acc[key] = {
          branch_id: key,
          name: order.branch_id ? branchNames[order.branch_id] || 'فرع غير معروف' : 'بدون فرع',
          orders: 0,
          revenue: 0,
        };
      }

      acc[key].orders += 1;
      acc[key].revenue += order.total_final_price || 0;
      return acc;
    }, {}),
  ).sort((left, right) => right.revenue - left.revenue);

  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const day = subDays(new Date(), 6 - index);
    const dayKey = format(day, 'MM/dd');
    const sales = confirmed
      .filter((order) => format(new Date(order.created_at), 'MM/dd') === dayKey)
      .reduce((sum, order) => sum + (order.total_final_price || 0), 0);

    return { name: dayKey, sales };
  });

  const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
    <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-lg border border-slate-50 flex items-center gap-4 sm:gap-5">
      <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center shrink-0`}>
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 mb-1">{label}</p>
        <h3 className="text-xl sm:text-2xl font-black text-slate-800">
          {value} <span className="text-xs text-slate-400">{sub}</span>
        </h3>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto min-h-full" dir="rtl">
      <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            لوحة التحكم
          </h1>
          <p className="text-slate-500 font-medium mt-1">متابعة الأداء في الوقت الفعلي</p>
        </div>

        <div className="grid grid-cols-2 sm:flex bg-white p-1.5 rounded-2xl border shadow-sm gap-1 w-full sm:w-auto">
          {(['today', 'week', 'month', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                dateRange === range ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {range === 'today' ? 'اليوم' : range === 'week' ? 'أسبوع' : range === 'month' ? 'شهر' : 'الكل'}
            </button>
          ))}
        </div>
      </header>

      {loadError && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[1, 2, 3, 4].map((card) => (
            <div key={card} className="h-32 bg-white/50 animate-pulse rounded-3xl border" />
          ))}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <StatCard icon={Clock} label="الورديات المفتوحة" value={activeShifts.length} sub="وردية" color="bg-orange-50 text-orange-600" />
            <StatCard icon={CheckCircle} label="ورديات مغلقة اليوم" value={closedToday.length} sub="وردية" color="bg-emerald-50 text-emerald-600" />
            <StatCard icon={Package} label="الفروع النشطة" value={branches.length} sub="فرع" color="bg-cyan-50 text-cyan-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-lg border min-w-0">
              <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-blue-500" />
                المبيعات آخر 7 أيام
              </h3>
              <ResponsiveContainer width="100%" height={288}>
                <BarChart data={last7Days}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="sales" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={40} name="المبيعات" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-lg border">
              <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                <Clock className="w-6 h-6 text-amber-500" />
                آخر الطلبات
              </h3>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {orders.slice(0, 8).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                        {order.status === 'confirmed' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">طلب #{order.order_number}</p>
                        <p className="text-[10px] text-slate-400">{order.salesperson_name || 'موظف'}</p>
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

          {lowStock.length > 0 && (
            <div className="bg-amber-50 p-5 sm:p-8 rounded-3xl border border-amber-200 mb-10">
              <h3 className="text-lg font-black text-amber-800 mb-4 flex items-center gap-2">
                <AlertCircle className="w-6 h-6" />
                تنبيهات المخزون المنخفض ({lowStock.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowStock.slice(0, 6).map((product) => (
                  <div key={product.id} className="bg-white p-4 rounded-2xl border border-amber-100 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{product.name}</p>
                      <p className="text-xs text-slate-400">كود: {product.code}</p>
                    </div>
                    <span className="text-amber-600 font-black text-lg">{product.stock_quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-lg border">
              <h3 className="text-xl font-black text-slate-800 mb-6">أفضل المنتجات في الفترة</h3>
              <div className="space-y-3">
                {topProducts.length > 0 ? (
                  topProducts.map((product, index) => (
                    <div key={product.product_name} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-black">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm">{product.product_name}</p>
                          <p className="text-[11px] font-bold text-slate-400">عدد القطع: {product.quantity}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-black text-slate-900">{Math.round(product.revenue).toLocaleString()} ج.م</p>
                        <p className="text-[11px] font-bold text-slate-400">إيراد</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center font-bold text-slate-400">لا توجد بيانات كافية لعرض أفضل المنتجات في هذه الفترة.</p>
                )}
              </div>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-lg border">
              <h3 className="text-xl font-black text-slate-800 mb-6">أداء الفروع</h3>
              <div className="space-y-3">
                {branchPerformance.length > 0 ? (
                  branchPerformance.slice(0, 6).map((branch) => (
                    <div key={branch.branch_id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-black text-slate-800 text-sm">{branch.name}</p>
                          <p className="text-[11px] font-bold text-slate-400">عدد الطلبات المؤكدة: {branch.orders}</p>
                        </div>
                        <div className="text-left">
                          <p className="font-black text-slate-900">{Math.round(branch.revenue).toLocaleString()} ج.م</p>
                          <p className="text-[11px] font-bold text-slate-400">إجمالي المبيعات</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center font-bold text-slate-400">لا توجد بيانات فروع مؤكدة في هذه الفترة.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardView;
