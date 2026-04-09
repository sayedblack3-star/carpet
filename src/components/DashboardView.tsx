import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { Branch, Order, OrderItem, Product, Profile, Shift } from '../types';
import { BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock3,
  DollarSign,
  Package,
  RotateCw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { format, startOfDay, subDays } from 'date-fns';

const QUERY_TIMEOUT_MS = 6000;
const QUERY_RETRY_DELAY_MS = 700;

type DateRange = 'today' | 'week' | 'month' | 'all';
type StatTone = 'blue' | 'emerald' | 'amber' | 'slate' | 'rose';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'اليوم',
  week: '7 أيام',
  month: '30 يوم',
  all: 'كل الفترة',
};

const formatMoney = (value: number) => `${Math.round(value || 0).toLocaleString()} ج.م`;

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

const toneStyles: Record<StatTone, string> = {
  blue: 'border-blue-100 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  slate: 'border-slate-200 bg-slate-100 text-slate-700',
  rose: 'border-rose-100 bg-rose-50 text-rose-700',
};

type StatTileProps = {
  icon: React.ElementType;
  title: string;
  value: string;
  caption: string;
  tone: StatTone;
  trend?: string;
};

const StatTile = ({ icon: Icon, title, value, caption, tone, trend }: StatTileProps) => (
  <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white p-5 shadow-[0_18px_45px_-26px_rgba(15,23,42,0.35)]">
    <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-l from-transparent via-slate-200 to-transparent" />
    <div className="flex items-start justify-between gap-4">
      <div className={`flex h-14 w-14 items-center justify-center rounded-[1.4rem] border ${toneStyles[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      {trend ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-600">
          <ArrowUpRight className="h-3.5 w-3.5" />
          {trend}
        </span>
      ) : null}
    </div>
    <div className="mt-5">
      <p className="text-xs font-black tracking-[0.18em] text-slate-400">{title}</p>
      <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-2 text-sm font-bold text-slate-500">{caption}</p>
    </div>
  </div>
);

const SectionCard = ({ title, subtitle, icon: Icon, children }: { title: string; subtitle?: string; icon: React.ElementType; children: React.ReactNode }) => (
  <section className="rounded-[2.2rem] border border-white/70 bg-white p-5 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.28)] sm:p-7">
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h3 className="flex items-center gap-2 text-xl font-black text-slate-900">
          <Icon className="h-5 w-5 text-amber-500" />
          {title}
        </h3>
        {subtitle ? <p className="mt-2 text-sm font-bold text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
    {children}
  </section>
);

const ReportMetric = ({
  label,
  value,
  helper,
  tone = 'slate',
}: {
  label: string;
  value: string;
  helper: string;
  tone?: StatTone;
}) => (
  <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50 p-4">
    <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.16em] ${toneStyles[tone]}`}>{label}</div>
    <p className="mt-4 text-2xl font-black text-slate-900">{value}</p>
    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{helper}</p>
  </div>
);

const DashboardView: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 320 });

  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

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

    const failedResults = [ordersResult, productsResult, usersResult, orderItemsResult, shiftsResult, branchesResult].filter(
      (result) => result.status === 'rejected',
    );

    if (failedResults.length > 0) {
      setLoadError('تعذر تحميل بعض بيانات لوحة التحكم. البيانات المعروضة قد تكون أقدم قليلًا وسيتم التحديث تلقائيًا.');
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

    setLastUpdated(format(new Date(), 'HH:mm'));
    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => {
    void fetchData();

    const intervalId = window.setInterval(() => {
      void fetchData();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [dateRange]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width > 0 && height > 0) {
        setChartSize((current) => (current.width === width && current.height === height ? current : { width, height }));
      }
    };

    updateSize();

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
    observer?.observe(container);
    window.addEventListener('resize', updateSize);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const confirmed = useMemo(() => orders.filter((order) => order.status === 'confirmed'), [orders]);
  const pending = useMemo(() => orders.filter((order) => order.status === 'sent_to_cashier' || order.status === 'under_review'), [orders]);
  const totalRevenue = confirmed.reduce((sum, order) => sum + (order.total_final_price || 0), 0);
  const avgOrder = confirmed.length > 0 ? totalRevenue / confirmed.length : 0;
  const lowStock = products.filter((product) => product.stock_quantity <= product.min_stock_level && product.is_active);
  const sellers = users.filter((user) => user.role === 'seller');
  const cashiers = users.filter((user) => user.role === 'cashier');
  const pendingApprovals = users.filter((user) => !user.is_approved).length;
  const inactiveUsers = users.filter((user) => !user.is_active).length;
  const activeShifts = shifts.filter((shift) => shift.status === 'active');
  const closedToday = shifts.filter(
    (shift) => shift.status === 'closed' && shift.end_time && new Date(shift.end_time) >= startOfDay(new Date()),
  );
  const fulfillmentRate = orders.length > 0 ? Math.round((confirmed.length / orders.length) * 100) : 0;
  const inventoryCoverage = products.length > 0 ? Math.max(0, Math.round(((products.length - lowStock.length) / products.length) * 100)) : 100;
  const confirmedOrderIds = new Set(confirmed.map((order) => order.id));
  const cancelledOrders = orders.filter((order) => order.status === 'cancelled');
  const underReviewOrders = orders.filter((order) => order.status === 'under_review');
  const sentToCashierOrders = orders.filter((order) => order.status === 'sent_to_cashier');
  const paidOrders = orders.filter((order) => order.payment_status === 'paid');
  const unpaidOrders = orders.filter((order) => order.payment_status === 'unpaid');
  const cancellationRate = orders.length > 0 ? Math.round((cancelledOrders.length / orders.length) * 100) : 0;
  const paymentCollectionRate = orders.length > 0 ? Math.round((paidOrders.length / orders.length) * 100) : 0;

  const topProducts = useMemo(
    () =>
      Object.values(
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
        .slice(0, 5),
    [confirmedOrderIds, orderItems],
  );

  const branchNames = useMemo(
    () =>
      branches.reduce<Record<string, string>>((acc, branch) => {
        acc[branch.id] = branch.name;
        return acc;
      }, {}),
    [branches],
  );

  const branchPerformance = useMemo(
    () =>
      Object.values(
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
      ).sort((left, right) => right.revenue - left.revenue),
    [branchNames, confirmed],
  );

  const sellerPerformance = useMemo(
    () =>
      Object.values(
        confirmed.reduce<Record<string, { name: string; orders: number; revenue: number; avgTicket: number }>>((acc, order) => {
          const key = order.salesperson_id || order.salesperson_name || 'unknown';
          if (!acc[key]) {
            acc[key] = {
              name: order.salesperson_name || 'موظف غير محدد',
              orders: 0,
              revenue: 0,
              avgTicket: 0,
            };
          }

          acc[key].orders += 1;
          acc[key].revenue += order.total_final_price || 0;
          acc[key].avgTicket = acc[key].orders > 0 ? acc[key].revenue / acc[key].orders : 0;
          return acc;
        }, {}),
      )
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 5),
    [confirmed],
  );

  const branchQueue = useMemo(
    () =>
      Object.values(
        pending.reduce<Record<string, { name: string; pending: number; review: number }>>((acc, order) => {
          const key = order.branch_id || 'unassigned';
          if (!acc[key]) {
            acc[key] = {
              name: order.branch_id ? branchNames[order.branch_id] || 'فرع غير معروف' : 'بدون فرع',
              pending: 0,
              review: 0,
            };
          }

          if (order.status === 'under_review') {
            acc[key].review += 1;
          } else {
            acc[key].pending += 1;
          }

          return acc;
        }, {}),
      ).sort((left, right) => right.pending + right.review - (left.pending + left.review)),
    [branchNames, pending],
  );

  const executiveReport = useMemo(
    () => [
      {
        label: 'الطلبات الكلية',
        value: orders.length.toLocaleString(),
        helper: confirmed.length > 0 ? `${confirmed.length} مؤكدة و${pending.length} ما زالت في المسار التشغيلي` : 'ابدأ أول دورة بيع ليظهر التقرير التنفيذي',
        tone: 'blue' as StatTone,
      },
      {
        label: 'نسبة التحصيل',
        value: `${paymentCollectionRate}%`,
        helper: paidOrders.length > 0 ? `${paidOrders.length} طلبات مدفوعة مقابل ${unpaidOrders.length} غير مدفوعة` : 'لا توجد طلبات مدفوعة في الفترة الحالية',
        tone: paidOrders.length > 0 ? ('emerald' as StatTone) : ('slate' as StatTone),
      },
      {
        label: 'معدل الإلغاء',
        value: `${cancellationRate}%`,
        helper: cancelledOrders.length > 0 ? `${cancelledOrders.length} طلبات ملغاة تحتاج مراجعة السبب` : 'لا توجد طلبات ملغاة في الفترة الحالية',
        tone: cancelledOrders.length > 0 ? ('rose' as StatTone) : ('slate' as StatTone),
      },
      {
        label: 'الضغط على الكاشير',
        value: pending.length.toLocaleString(),
        helper: underReviewOrders.length > 0 ? `${underReviewOrders.length} تحت المراجعة و${sentToCashierOrders.length} بانتظار الاستلام` : 'قائمة التحصيل مستقرة الآن',
        tone: pending.length > 0 ? ('amber' as StatTone) : ('emerald' as StatTone),
      },
    ],
    [
      cancelledOrders.length,
      cancellationRate,
      confirmed.length,
      paidOrders.length,
      paymentCollectionRate,
      pending.length,
      sentToCashierOrders.length,
      underReviewOrders.length,
      unpaidOrders.length,
      orders.length,
    ],
  );

  const last7Days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = subDays(new Date(), 6 - index);
        const dayKey = format(day, 'MM/dd');
        const sales = confirmed
          .filter((order) => format(new Date(order.created_at), 'MM/dd') === dayKey)
          .reduce((sum, order) => sum + (order.total_final_price || 0), 0);

        return { name: dayKey, sales };
      }),
    [confirmed],
  );

  const spotlight = useMemo(() => {
    const leadingBranch = branchPerformance[0];
    const strongestProduct = topProducts[0];

    return [
      {
        icon: Store,
        title: 'الفرع الأقوى حاليًا',
        value: leadingBranch ? leadingBranch.name : 'لا توجد مبيعات مؤكدة',
        note: leadingBranch ? `${formatMoney(leadingBranch.revenue)} من ${leadingBranch.orders} طلبات` : 'ابدأ الفترة الحالية بأول طلب مؤكد',
      },
      {
        icon: Package,
        title: 'المنتج الأبرز',
        value: strongestProduct ? strongestProduct.product_name : 'لا توجد بيانات كافية',
        note: strongestProduct ? `${strongestProduct.quantity} قطعة • ${formatMoney(strongestProduct.revenue)}` : 'سيظهر هنا أفضل منتج بعد أول عملية بيع مؤكدة',
      },
      {
        icon: ShieldCheck,
        title: 'جاهزية التشغيل',
        value: `${inventoryCoverage}%`,
        note: lowStock.length > 0 ? `${lowStock.length} منتج يحتاج متابعة مخزون` : 'المخزون تحت السيطرة في الوقت الحالي',
      },
    ];
  }, [branchPerformance, inventoryCoverage, lowStock.length, topProducts]);

  const latestShift = shifts[0];

  return (
    <div className="min-h-full px-4 py-4 sm:px-6 sm:py-8" dir="rtl">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="relative overflow-hidden rounded-[2.8rem] border border-white/20 bg-[#120b07] px-6 py-7 text-white shadow-[0_40px_120px_-42px_rgba(15,23,42,0.9)] sm:px-8 sm:py-9">
          <div
            className="absolute inset-0 opacity-80"
            style={{
              backgroundImage:
                'radial-gradient(circle at top right, rgba(245,158,11,0.24), transparent 24%), radial-gradient(circle at bottom left, rgba(14,165,233,0.16), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.05), transparent 48%)',
            }}
          />
          <div className="absolute -left-12 top-8 h-36 w-36 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black tracking-[0.18em] text-amber-100">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  CARPET LAND CONTROL CENTER
                </span>
                {lastUpdated ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/80">
                    <Clock3 className="h-4 w-4 text-white/60" />
                    آخر تحديث {lastUpdated}
                  </span>
                ) : null}
              </div>

              <div className="mt-6 max-w-3xl">
                <h1 className="text-3xl font-black leading-tight sm:text-4xl xl:text-[2.8rem]">
                  لوحة قيادة أوضح لاتخاذ القرار أسرع في المبيعات والتشغيل.
                </h1>
                <p className="mt-4 max-w-2xl text-sm font-bold leading-7 text-white/75 sm:text-base">
                  المؤشرات الأهم، حالة التشغيل، وأداء الفروع في واجهة واحدة أنظف، بحيث تعرف أين البيع يتحرك وأين تحتاج تدخل خلال ثوانٍ.
                </p>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                {(['today', 'week', 'month', 'all'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                      dateRange === range
                        ? 'bg-white text-slate-900 shadow-lg'
                        : 'border border-white/10 bg-white/5 text-white/75 hover:bg-white/10'
                    }`}
                  >
                    {DATE_RANGE_LABELS[range]}
                  </button>
                ))}

                <button
                  onClick={() => void fetchData(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
                >
                  <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  تحديث الآن
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              {spotlight.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.9rem] border border-white/10 bg-white/10 p-5 backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] bg-white/10 text-amber-300">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <Activity className="h-5 w-5 text-white/25" />
                  </div>
                  <p className="mt-4 text-xs font-black tracking-[0.14em] text-white/55">{item.title}</p>
                  <p className="mt-2 text-lg font-black leading-7 text-white">{item.value}</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-white/70">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {loadError ? (
          <div className="rounded-[1.8rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
            {loadError}
          </div>
        ) : null}

        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((card) => (
              <div key={card} className="h-40 animate-pulse rounded-[2rem] border border-slate-100 bg-white/70" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={DollarSign}
                title="إجمالي الإيراد"
                value={formatMoney(totalRevenue)}
                caption={`خلال ${DATE_RANGE_LABELS[dateRange]}`}
                tone="blue"
                trend={`${confirmed.length} فواتير مؤكدة`}
              />
              <StatTile
                icon={ShoppingCart}
                title="الطلبات المعلقة"
                value={pending.length.toLocaleString()}
                caption="تحتاج تدخل الكاشير أو مراجعة"
                tone="amber"
                trend={orders.length > 0 ? `${fulfillmentRate}% معدل الإغلاق` : 'لا توجد حركة بعد'}
              />
              <StatTile
                icon={UserCheck}
                title="الفريق النشط"
                value={(sellers.length + cashiers.length).toLocaleString()}
                caption={`${sellers.length} بائع • ${cashiers.length} كاشير`}
                tone="emerald"
                trend={pendingApprovals > 0 ? `${pendingApprovals} بانتظار التفعيل` : 'كل الحسابات الأساسية جاهزة'}
              />
              <StatTile
                icon={Package}
                title="المخزون تحت الضغط"
                value={lowStock.length.toLocaleString()}
                caption={`${products.length} منتج ظاهر في النظام`}
                tone={lowStock.length > 0 ? 'rose' : 'slate'}
                trend={inventoryCoverage > 0 ? `${inventoryCoverage}% تغطية آمنة` : 'يحتاج مراجعة عاجلة'}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <SectionCard title="التقرير التنفيذي" subtitle="ملخص مباشر للإدارة قبل الدخول في التفاصيل." icon={Activity}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {executiveReport.map((item) => (
                    <ReportMetric key={item.label} label={item.label} value={item.value} helper={item.helper} tone={item.tone} />
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="صحة التحصيل والتدفق" subtitle="أين يقف مسار البيع الآن، وأين يتجمع الضغط." icon={DollarSign}>
                <div className="space-y-4">
                  <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black tracking-[0.16em] text-slate-400">طلبات جاهزة للكاشير</p>
                        <p className="mt-2 text-2xl font-black text-slate-900">{sentToCashierOrders.length}</p>
                        <p className="mt-2 text-sm font-bold text-slate-500">طلبات وصلت للكاشير ولم يبدأ إغلاقها بعد.</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-amber-50 text-amber-600">
                        <Clock3 className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black tracking-[0.16em] text-slate-400">طلبات تحت المراجعة</p>
                        <p className="mt-2 text-2xl font-black text-slate-900">{underReviewOrders.length}</p>
                        <p className="mt-2 text-sm font-bold text-slate-500">تحتاج قرارًا من الكاشير قبل التأكيد أو الإلغاء.</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-blue-50 text-blue-600">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black tracking-[0.16em] text-slate-400">الإغلاق الناجح</p>
                        <p className="mt-2 text-2xl font-black text-slate-900">{fulfillmentRate}%</p>
                        <p className="mt-2 text-sm font-bold text-slate-500">نسبة الطلبات التي انتهت بمبيعات مؤكدة.</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_0.9fr]">
              <SectionCard title="منحنى المبيعات" subtitle="حركة آخر 7 أيام بشكل سريع وواضح." icon={TrendingUp}>
                <div ref={chartContainerRef} className="h-80 min-w-0">
                  {chartSize.width > 0 ? (
                    <BarChart width={chartSize.width} height={chartSize.height} data={last7Days}>
                      <defs>
                        <linearGradient id="salesGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#0f172a" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#eef2f7" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '18px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 18px 40px rgba(15,23,42,0.12)',
                        }}
                        formatter={(value: number) => [formatMoney(value), 'المبيعات']}
                      />
                      <Bar dataKey="sales" fill="url(#salesGradient)" radius={[12, 12, 4, 4]} barSize={34} />
                    </BarChart>
                  ) : (
                    <div className="h-full animate-pulse rounded-[1.6rem] bg-slate-100" />
                  )}
                </div>
              </SectionCard>

              <SectionCard title="نبض التشغيل" subtitle="لقطات سريعة تساعدك تعرف أين تركز الآن." icon={ShieldCheck}>
                <div className="space-y-4">
                  <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black tracking-[0.16em] text-slate-400">متوسط الفاتورة</p>
                        <p className="mt-2 text-2xl font-black text-slate-900">{formatMoney(avgOrder)}</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-white text-blue-600 shadow-sm">
                        <DollarSign className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-[1.6rem] border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-xs font-black tracking-[0.16em] text-emerald-600">الورديات المفتوحة</p>
                      <p className="mt-2 text-2xl font-black text-emerald-900">{activeShifts.length}</p>
                      <p className="mt-2 text-sm font-bold text-emerald-700">
                        {closedToday.length} ورديات أغلقت اليوم
                      </p>
                    </div>
                    <div className="rounded-[1.6rem] border border-blue-100 bg-blue-50 p-4">
                      <p className="text-xs font-black tracking-[0.16em] text-blue-600">الفروع النشطة</p>
                      <p className="mt-2 text-2xl font-black text-blue-900">{branches.length}</p>
                      <p className="mt-2 text-sm font-bold text-blue-700">
                        {inactiveUsers} حسابات غير نشطة تحتاج مراجعة
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-amber-100 bg-[linear-gradient(135deg,#fff7ed_0%,#fffbeb_100%)] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black tracking-[0.16em] text-amber-700">آخر وردية مرصودة</p>
                        <p className="mt-2 text-base font-black text-slate-900">
                          {latestShift ? format(new Date(latestShift.start_time), 'yyyy-MM-dd HH:mm') : 'لا توجد ورديات حديثة'}
                        </p>
                        <p className="mt-2 text-sm font-bold text-amber-800">
                          {latestShift ? `الحالة: ${latestShift.status === 'active' ? 'نشطة' : 'مغلقة'}` : 'ابدأ أول وردية لتظهر هنا'}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] bg-white text-amber-500 shadow-sm">
                        <Clock3 className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <SectionCard title="الطلبات الأخيرة" subtitle="آخر حركة وصلت للنظام بحسب الفلتر الحالي." icon={ShoppingCart}>
                <div className="space-y-3">
                  {orders.slice(0, 6).map((order) => {
                    const isConfirmed = order.status === 'confirmed';
                    return (
                      <div key={order.id} className="flex flex-col gap-4 rounded-[1.6rem] border border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] ${
                              isConfirmed ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                            }`}
                          >
                            {isConfirmed ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">طلب #{order.order_number}</p>
                            <p className="mt-1 truncate text-xs font-bold text-slate-500">
                              {order.salesperson_name || 'موظف غير محدد'}
                              {order.branch_id ? ` • ${branchNames[order.branch_id] || 'فرع غير معروف'}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 sm:block sm:text-left">
                          <p className="text-base font-black text-slate-900">{formatMoney(order.total_final_price || 0)}</p>
                          <span className={`text-xs font-black ${isConfirmed ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {isConfirmed ? 'مدفوع ومؤكد' : 'بانتظار الإقفال'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {orders.length === 0 ? (
                    <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm font-bold text-slate-400">
                      لا توجد طلبات في هذه الفترة.
                    </div>
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard title="تنبيهات تحتاج متابعة" subtitle="أهم ما يحتاج قرارًا سريعًا من الإدارة." icon={AlertCircle}>
                <div className="space-y-4">
                  <div className="rounded-[1.6rem] border border-amber-100 bg-amber-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black tracking-[0.16em] text-amber-700">حسابات تنتظر التفعيل</p>
                        <p className="mt-2 text-2xl font-black text-amber-900">{pendingApprovals}</p>
                      </div>
                      <Users className="h-6 w-6 text-amber-500" />
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-rose-100 bg-rose-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black tracking-[0.16em] text-rose-700">منتجات تحت الحد الأدنى</p>
                        <p className="mt-2 text-2xl font-black text-rose-900">{lowStock.length}</p>
                      </div>
                      <Package className="h-6 w-6 text-rose-500" />
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black tracking-[0.16em] text-slate-500">أقرب عناصر تحتاج تدخل</p>
                    <div className="mt-4 space-y-3">
                      {lowStock.slice(0, 4).map((product) => (
                        <div key={product.id} className="flex items-center justify-between gap-4 rounded-[1.2rem] bg-white px-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-800">{product.name}</p>
                            <p className="mt-1 text-[11px] font-bold text-slate-400">كود {product.code}</p>
                          </div>
                          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-600">
                            {product.stock_quantity}
                          </span>
                        </div>
                      ))}

                      {lowStock.length === 0 ? (
                        <p className="rounded-[1.2rem] bg-white px-4 py-4 text-sm font-bold text-slate-500">
                          لا توجد تنبيهات مخزون حرجة الآن.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <SectionCard title="أداء البائعين" subtitle="من يحرك الإيراد أكثر، ومن يحتاج دعمًا أو متابعة." icon={Users}>
                <div className="space-y-3">
                  {sellerPerformance.length > 0 ? (
                    sellerPerformance.map((seller, index) => (
                      <div key={`${seller.name}-${index}`} className="rounded-[1.6rem] border border-slate-100 bg-slate-50 px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-[#120b07] font-black text-white">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-900">{seller.name}</p>
                              <p className="mt-1 text-xs font-bold text-slate-500">{seller.orders} طلبات مؤكدة</p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-black text-slate-900">{formatMoney(seller.revenue)}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">متوسط {formatMoney(seller.avgTicket)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm font-bold text-slate-400">
                      لا توجد مبيعات مؤكدة كافية لإظهار ترتيب البائعين.
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="ضغط الفروع على الكاشير" subtitle="الفروع التي عندها طوابير أو طلبات تحتاج متابعة أسرع." icon={Store}>
                <div className="space-y-3">
                  {branchQueue.length > 0 ? (
                    branchQueue.slice(0, 6).map((branch) => (
                      <div key={branch.name} className="rounded-[1.6rem] border border-slate-100 bg-slate-50 px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">{branch.name}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {branch.pending} بانتظار التحصيل • {branch.review} تحت المراجعة
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="text-xl font-black text-slate-900">{branch.pending + branch.review}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">إجمالي المعلق</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm font-bold text-slate-400">
                      لا توجد طلبات معلقة على الفروع في الفترة الحالية.
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <SectionCard title="أفضل المنتجات" subtitle="الأعلى عائدًا في الفترة المختارة." icon={Package}>
                <div className="space-y-3">
                  {topProducts.length > 0 ? (
                    topProducts.map((product, index) => (
                      <div key={product.product_name} className="flex items-center justify-between rounded-[1.6rem] border border-slate-100 bg-slate-50 px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-[#120b07] font-black text-white">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">{product.product_name}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">{product.quantity} قطعة مباعة</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-slate-900">{formatMoney(product.revenue)}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">إيراد</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm font-bold text-slate-400">
                      لا توجد بيانات كافية لعرض المنتجات الأقوى.
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="أداء الفروع" subtitle="ترتيب الفروع حسب الإيراد المؤكد." icon={Building2}>
                <div className="space-y-3">
                  {branchPerformance.length > 0 ? (
                    branchPerformance.slice(0, 6).map((branch, index) => (
                      <div key={branch.branch_id} className="rounded-[1.6rem] border border-slate-100 bg-slate-50 px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-blue-50 font-black text-blue-600">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-900">{branch.name}</p>
                              <p className="mt-1 text-xs font-bold text-slate-500">{branch.orders} طلبات مؤكدة</p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-black text-slate-900">{formatMoney(branch.revenue)}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">إيراد</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm font-bold text-slate-400">
                      لا توجد بيانات فروع مؤكدة في هذه الفترة.
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardView;
