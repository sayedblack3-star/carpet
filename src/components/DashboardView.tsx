import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Branch, Order, Product, Profile, Shift } from '../types';
import { AlertCircle, Clock3, Package, RotateCw, ShieldCheck, ShoppingCart, Store, Users } from 'lucide-react';
import { format, startOfDay, subDays } from 'date-fns';
import { LoadingCardGrid } from './ui/LoadingState';
import { SectionCard, StatTile } from './dashboard/DashboardUi';
import {
  DASHBOARD_POLL_INTERVAL_MS,
  canRefreshDashboard,
  fetchDashboardSnapshot,
  type DashboardDateRange,
} from '../lib/dashboardService';

type DateRange = DashboardDateRange;

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'اليوم',
  week: '7 أيام',
  month: '30 يوم',
  all: 'كل الفترة',
};

const formatMoney = (value: number) => `${Math.round(value || 0).toLocaleString()} ج.م`;

const statusLabel = (status: Order['status']) => {
  if (status === 'confirmed') return 'تم التأكيد';
  if (status === 'cancelled') return 'ملغي';
  if (status === 'under_review') return 'قيد المراجعة';
  return 'بانتظار الكاشير';
};

const DashboardView: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isFetchingRef = useRef(false);
  const pollTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const fetchData = async (isManualRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setLoadError(null);

    try {
      const snapshot = await fetchDashboardSnapshot(dateRange);

      if (!mountedRef.current) return;

      if (snapshot.hasPartialFailure) {
        setLoadError('تم تحميل جزء من البيانات فقط. سنحاول التحديث تلقائيًا.');
      }

      setOrders(snapshot.orders);
      setProducts(snapshot.products);
      setUsers(snapshot.users);
      setShifts(snapshot.shifts);
      setBranches(snapshot.branches);
      setLastUpdated(snapshot.lastUpdated);
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    const refreshIfAvailable = (manual = false) => {
      if (!canRefreshDashboard() || isFetchingRef.current) return;
      void fetchData(manual);
    };

    const clearPoll = () => {
      if (pollTimeoutRef.current) {
        window.clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };

    const scheduleNextPoll = () => {
      clearPoll();
      pollTimeoutRef.current = window.setTimeout(() => {
        refreshIfAvailable();
        scheduleNextPoll();
      }, DASHBOARD_POLL_INTERVAL_MS);
    };

    mountedRef.current = true;
    refreshIfAvailable();
    scheduleNextPoll();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshIfAvailable();
        scheduleNextPoll();
      }
    };

    const handleOnline = () => {
      refreshIfAvailable();
      scheduleNextPoll();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      mountedRef.current = false;
      clearPoll();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [dateRange]);

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status === 'sent_to_cashier' || order.status === 'under_review'),
    [orders],
  );
  const recentOrders = useMemo(() => orders.slice(0, 6), [orders]);
  const lowStock = useMemo(
    () => products.filter((product) => product.is_active && product.stock_quantity <= product.min_stock_level),
    [products],
  );
  const pendingApprovals = useMemo(() => users.filter((user) => !user.is_approved).length, [users]);
  const activeShifts = useMemo(() => shifts.filter((shift) => shift.status === 'open'), [shifts]);
  const closedToday = useMemo(
    () => shifts.filter((shift) => shift.status === 'closed' && shift.end_time && new Date(shift.end_time) >= startOfDay(new Date())),
    [shifts],
  );
  const branchNames = useMemo(
    () =>
      branches.reduce<Record<string, string>>((acc, branch) => {
        acc[branch.id] = branch.name;
        return acc;
      }, {}),
    [branches],
  );

  if (loading) {
    return (
      <div className="min-h-full px-4 py-4 sm:px-6 sm:py-8" dir="rtl">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-slate-900">لوحة التشغيل السريع</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">نظرة تشغيلية لحظية على الطلبات والوردية والتنبيهات.</p>
        </div>
        <LoadingCardGrid count={4} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" />
      </div>
    );
  }

  return (
    <div className="min-h-full px-4 py-4 sm:px-6 sm:py-8" dir="rtl">
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900">لوحة التشغيل السريع</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">تشغيل يومي سريع بدون تفاصيل تقارير ثقيلة.</p>
          {lastUpdated ? <p className="mt-3 text-xs font-black text-slate-400">آخر تحديث {lastUpdated}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-2xl bg-white p-1 shadow-sm border border-slate-200">
            {(['today', 'week', 'month', 'all'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDateRange(range)}
                className={`rounded-[1rem] px-4 py-2 text-xs font-black transition ${
                  dateRange === range ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {DATE_RANGE_LABELS[range]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void fetchData(true)}
            disabled={refreshing}
            className="motion-button rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              تحديث
            </span>
          </button>
        </div>
      </header>

      {loadError ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={ShoppingCart}
          title="طلبات تنتظر الكاشير"
          value={pendingOrders.length.toLocaleString()}
          caption="طلبات تحتاج متابعة أو مراجعة"
          tone="amber"
        />
        <StatTile
          icon={ShieldCheck}
          title="ورديات مفتوحة"
          value={activeShifts.length.toLocaleString()}
          caption={`${closedToday.length} ورديات أغلقت اليوم`}
          tone="emerald"
        />
        <StatTile
          icon={Package}
          title="نواقص حرجة"
          value={lowStock.length.toLocaleString()}
          caption="منتجات وصلت للحد الأدنى"
          tone="rose"
        />
        <StatTile
          icon={Users}
          title="حسابات بانتظار التفعيل"
          value={pendingApprovals.toLocaleString()}
          caption="حسابات جديدة تحتاج موافقة"
          tone="slate"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="تنبيهات عاجلة" subtitle="أهم العناصر التي تحتاج تدخل سريع" icon={AlertCircle}>
          <div className="space-y-4">
            <div className="rounded-[1.6rem] border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-black tracking-[0.16em] text-amber-700">حسابات تنتظر التفعيل</p>
              <p className="mt-2 text-2xl font-black text-amber-900">{pendingApprovals}</p>
            </div>

            <div className="rounded-[1.6rem] border border-rose-100 bg-rose-50 p-4">
              <p className="text-xs font-black tracking-[0.16em] text-rose-700">منتجات تحت الحد الأدنى</p>
              <p className="mt-2 text-2xl font-black text-rose-900">{lowStock.length}</p>
            </div>

            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black tracking-[0.16em] text-slate-500">أقرب عناصر بحاجة متابعة</p>
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

        <SectionCard title="طلبات تحتاج متابعة" subtitle="أقرب الطلبات التي لم تُغلق بعد" icon={Store}>
          <div className="space-y-3">
            {pendingOrders.slice(0, 6).map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-4 rounded-[1.6rem] border border-slate-100 bg-slate-50 px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">طلب #{order.order_number}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {order.salesperson_name || 'موظف غير محدد'}
                    {order.branch_id ? ` • ${branchNames[order.branch_id] || 'فرع غير معروف'}` : ''}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-slate-900">{formatMoney(order.total_final_price || 0)}</p>
                  <p className="mt-1 text-xs font-bold text-amber-600">{statusLabel(order.status)}</p>
                </div>
              </div>
            ))}
            {pendingOrders.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm font-bold text-slate-400">
                لا توجد طلبات معلقة في الوقت الحالي.
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="آخر الطلبات" subtitle="آخر حركة وصلت للنظام حسب الفترة المختارة" icon={ShoppingCart}>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="rounded-[1.6rem] border border-slate-100 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">طلب #{order.order_number}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {order.customer_name || 'بدون اسم عميل'} • {order.salesperson_name || 'موظف غير محدد'}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">
                    {statusLabel(order.status)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>{format(new Date(order.created_at), 'yyyy-MM-dd HH:mm')}</span>
                  <span>{formatMoney(order.total_final_price || 0)}</span>
                </div>
              </div>
            ))}
            {recentOrders.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm font-bold text-slate-400">
                لا توجد طلبات لعرضها في الفترة الحالية.
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="حالة اليوم" subtitle="ملخص سريع لحركة التشغيل خلال اليوم" icon={Clock3}>
          <div className="space-y-4">
            <div className="rounded-[1.6rem] border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-black tracking-[0.16em] text-blue-700">ورديات أغلقت اليوم</p>
              <p className="mt-2 text-2xl font-black text-blue-900">{closedToday.length}</p>
            </div>
            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black tracking-[0.16em] text-slate-500">إجمالي الطلبات في الفترة</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{orders.length.toLocaleString()}</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

export default DashboardView;
