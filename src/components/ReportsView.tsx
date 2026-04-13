import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  BarChart3,
  Building2,
  CreditCard,
  DollarSign,
  Package,
  RefreshCw,
  ShoppingBag,
  Store,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { LoadingCardGrid } from './ui/LoadingState';
import { ReportMetric, SectionCard, StatTile } from './dashboard/DashboardUi';
import { fetchDashboardSnapshot, type DashboardDateRange } from '../lib/dashboardService';
import type { Branch, Order, OrderItem, Product, Profile } from '../types';
import { getPaymentMethodLabel, parseOrderNotes } from '../lib/orderMetadata';

const DATE_RANGE_OPTIONS: Array<{ value: DashboardDateRange; label: string }> = [
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: '7 أيام' },
  { value: 'month', label: '30 يوم' },
  { value: 'all', label: 'كل الفترة' },
];

const moneyFormatter = new Intl.NumberFormat('ar-EG');

const formatMoney = (value: number) => `${moneyFormatter.format(Math.round(value || 0))} ج.م`;

const getOrderStatusLabel = (status: Order['status']) => {
  if (status === 'confirmed') return 'مؤكد';
  if (status === 'cancelled') return 'ملغي';
  if (status === 'under_review') return 'قيد المراجعة';
  return 'بانتظار الكاشير';
};

export default function ReportsView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dateRange, setDateRange] = useState<DashboardDateRange>('month');
  const [selectedBranchId, setSelectedBranchId] = useState<'all' | string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadReports = async () => {
      setLoadError(null);
      setLoading(true);

      try {
        const snapshot = await fetchDashboardSnapshot(dateRange);
        if (!isMounted) return;

        setOrders(snapshot.orders);
        setProducts(snapshot.products);
        setUsers(snapshot.users);
        setOrderItems(snapshot.orderItems);
        setBranches(snapshot.branches);
        setLastUpdated(snapshot.lastUpdated);

        if (snapshot.hasPartialFailure) {
          setLoadError('تم تحميل جزء من البيانات فقط. بعض مؤشرات التقارير قد تكون أقدم قليلًا.');
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to fetch reports snapshot:', error);
        setLoadError('تعذر تحميل بيانات التقارير الآن. حاول التحديث بعد قليل.');
        toast.error('تعذر تحميل قسم التقارير الآن.');
      } finally {
        if (!isMounted) return;
        setLoading(false);
        setRefreshing(false);
      }
    };

    void loadReports();

    return () => {
      isMounted = false;
    };
  }, [dateRange]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      const snapshot = await fetchDashboardSnapshot(dateRange);
      setOrders(snapshot.orders);
      setProducts(snapshot.products);
      setUsers(snapshot.users);
      setOrderItems(snapshot.orderItems);
      setBranches(snapshot.branches);
      setLastUpdated(snapshot.lastUpdated);
      if (snapshot.hasPartialFailure) {
        setLoadError('تم تحديث جزء من البيانات، لكن بعض المصادر لم تستجب بالكامل.');
      } else {
        toast.success('تم تحديث التقارير بنجاح');
      }
    } catch (error) {
      console.error('Failed to refresh reports snapshot:', error);
      setLoadError('تعذر تحديث بيانات التقارير الآن.');
      toast.error('تعذر تحديث قسم التقارير الآن.');
    } finally {
      setRefreshing(false);
    }
  };

  const branchNames = useMemo(
    () =>
      branches.reduce<Record<string, string>>((acc, branch) => {
        acc[branch.id] = branch.name;
        return acc;
      }, {}),
    [branches],
  );

  const filteredOrders = useMemo(() => {
    if (selectedBranchId === 'all') return orders;
    return orders.filter((order) => order.branch_id === selectedBranchId);
  }, [orders, selectedBranchId]);

  const confirmedOrders = useMemo(
    () => filteredOrders.filter((order) => order.status === 'confirmed'),
    [filteredOrders],
  );
  const pendingOrders = useMemo(
    () => filteredOrders.filter((order) => order.status === 'sent_to_cashier' || order.status === 'under_review'),
    [filteredOrders],
  );
  const cancelledOrders = useMemo(
    () => filteredOrders.filter((order) => order.status === 'cancelled'),
    [filteredOrders],
  );
  const confirmedOrderIds = useMemo(() => new Set(confirmedOrders.map((order) => order.id)), [confirmedOrders]);
  const relevantOrderItems = useMemo(
    () => orderItems.filter((item) => confirmedOrderIds.has(item.order_id)),
    [orderItems, confirmedOrderIds],
  );

  const totalRevenue = confirmedOrders.reduce((sum, order) => sum + (order.total_final_price || 0), 0);
  const totalOriginalRevenue = confirmedOrders.reduce((sum, order) => sum + (order.total_original_price || 0), 0);
  const totalDiscount = Math.max(0, totalOriginalRevenue - totalRevenue);
  const averageOrderValue = confirmedOrders.length ? totalRevenue / confirmedOrders.length : 0;

  const sellerPerformance = useMemo(
    () =>
      Object.values(
        confirmedOrders.reduce<Record<string, { name: string; orders: number; revenue: number }>>((acc, order) => {
          const key = order.salesperson_id || order.salesperson_name || 'unknown';
          if (!acc[key]) {
            acc[key] = { name: order.salesperson_name || 'موظف غير محدد', orders: 0, revenue: 0 };
          }
          acc[key].orders += 1;
          acc[key].revenue += order.total_final_price || 0;
          return acc;
        }, {}),
      )
        .map((item) => ({
          ...item,
          avgTicket: item.orders ? item.revenue / item.orders : 0,
        }))
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 6),
    [confirmedOrders],
  );

  const branchPerformance = useMemo(
    () =>
      Object.values(
        confirmedOrders.reduce<Record<string, { name: string; orders: number; revenue: number }>>((acc, order) => {
          const key = order.branch_id || 'unassigned';
          if (!acc[key]) {
            acc[key] = {
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
    [branchNames, confirmedOrders],
  );

  const topProducts = useMemo(
    () =>
      Object.values(
        relevantOrderItems.reduce<Record<string, { name: string; quantity: number; revenue: number }>>((acc, item) => {
          const key = item.product_id || item.product_name;
          if (!acc[key]) {
            acc[key] = { name: item.product_name, quantity: 0, revenue: 0 };
          }
          acc[key].quantity += item.quantity || 0;
          acc[key].revenue += item.total_price || 0;
          return acc;
        }, {}),
      )
        .sort((left, right) => right.quantity - left.quantity)
        .slice(0, 6),
    [relevantOrderItems],
  );

  const soldProductIds = useMemo(() => new Set(relevantOrderItems.map((item) => item.product_id)), [relevantOrderItems]);
  const lowStockProducts = useMemo(
    () =>
      products
        .filter((product) => product.is_active && product.stock_quantity <= product.min_stock_level)
        .slice(0, 5),
    [products],
  );
  const slowProducts = useMemo(
    () =>
      products
        .filter((product) => product.is_active && !soldProductIds.has(product.id))
        .slice(0, 5),
    [products, soldProductIds],
  );

  const paymentBreakdown = useMemo(() => {
    const summary = confirmedOrders.reduce<Record<string, { label: string; count: number; amount: number }>>((acc, order) => {
      const paymentMethod = parseOrderNotes(order.notes).metadata.paymentMethod;
      const label = getPaymentMethodLabel(paymentMethod);
      if (!acc[label]) {
        acc[label] = { label, count: 0, amount: 0 };
      }
      acc[label].count += 1;
      acc[label].amount += order.total_final_price || 0;
      return acc;
    }, {});

    return Object.values(summary).sort((left, right) => right.amount - left.amount);
  }, [confirmedOrders]);

  const recentOrders = useMemo(() => filteredOrders.slice(0, 5), [filteredOrders]);
  const activeSellers = users.filter((user) => user.role === 'seller' && user.is_active).length;

  if (loading) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto min-h-full" dir="rtl">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900">قسم التقارير</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">نجمع المؤشرات التشغيلية والبيعية في شاشة واحدة للإدارة.</p>
        </div>
        <LoadingCardGrid count={4} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto min-h-full" dir="rtl">
      <header className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black text-slate-900">
            <BarChart3 className="h-8 w-8 text-amber-500" />
            قسم التقارير
          </h1>
          <p className="mt-2 text-sm font-bold text-slate-500">
            نظرة موحدة على المبيعات، أداء البائعين، الفروع، المنتجات، والتحصيل.
          </p>
          {lastUpdated ? <p className="mt-3 text-xs font-black text-slate-400">آخر تحديث {lastUpdated}</p> : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex rounded-2xl bg-white p-1 shadow-sm border border-slate-200">
            {DATE_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDateRange(option.value)}
                className={`rounded-[1rem] px-4 py-2 text-xs font-black transition ${
                  dateRange === option.value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <select
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm outline-none focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">كل الفروع</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="motion-button rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
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
          icon={DollarSign}
          title="إجمالي المبيعات"
          value={formatMoney(totalRevenue)}
          caption={`${confirmedOrders.length} فاتورة مؤكدة في الفترة المختارة`}
          tone="emerald"
        />
        <StatTile
          icon={ShoppingBag}
          title="متوسط الفاتورة"
          value={formatMoney(averageOrderValue)}
          caption="مفيد لتقييم جودة الطلب وليس العدد فقط"
          tone="blue"
        />
        <StatTile
          icon={TrendingUp}
          title="إجمالي الخصومات"
          value={formatMoney(totalDiscount)}
          caption="الفارق بين السعر قبل وبعد الخصم في الطلبات المؤكدة"
          tone="amber"
        />
        <StatTile
          icon={Store}
          title="طلبات بانتظار الكاشير"
          value={pendingOrders.length.toString()}
          caption={`${cancelledOrders.length} طلب ملغي و${activeSellers} بائع نشط`}
          tone="slate"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="تقرير المبيعات" subtitle="ملخص الفترة المختارة مع أهم مؤشرات التنفيذ" icon={DollarSign}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ReportMetric label="الفواتير" value={filteredOrders.length.toString()} helper="جميع الطلبات في الفترة والفرع المحددين" tone="blue" />
            <ReportMetric label="المؤكد" value={confirmedOrders.length.toString()} helper="طلبات تم اعتمادها من الكاشير" tone="emerald" />
            <ReportMetric label="قيد الانتظار" value={pendingOrders.length.toString()} helper="تحتاج مراجعة أو تأكيد من شاشة الكاشير" tone="amber" />
            <ReportMetric label="الملغي" value={cancelledOrders.length.toString()} helper="طلبات لم تكتمل وتم إلغاؤها" tone="rose" />
          </div>
        </SectionCard>

        <SectionCard title="تقرير التحصيل" subtitle="توزيع المبيعات المؤكدة حسب طريقة الدفع" icon={CreditCard}>
          <div className="space-y-3">
            {paymentBreakdown.length > 0 ? (
              paymentBreakdown.map((entry) => (
                <div key={entry.label} className="flex items-center justify-between rounded-[1.5rem] border border-slate-100 bg-slate-50 px-4 py-4">
                  <div>
                    <p className="text-sm font-black text-slate-900">{entry.label}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{entry.count} عملية تحصيل مؤكدة</p>
                  </div>
                  <p className="text-base font-black text-slate-900">{formatMoney(entry.amount)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-bold text-slate-500">
                لا توجد بيانات تحصيل مؤكدة في الفترة الحالية.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="تقرير المبيعات حسب البائع" subtitle="من يحقق أعلى مبيعات ومتوسط تذكرة أفضل" icon={UserCheck}>
          <div className="space-y-3">
            {sellerPerformance.length > 0 ? (
              sellerPerformance.map((seller, index) => (
                <div key={`${seller.name}-${index}`} className="flex items-center justify-between rounded-[1.5rem] border border-slate-100 bg-white px-4 py-4 shadow-sm">
                  <div>
                    <p className="text-sm font-black text-slate-900">{seller.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{seller.orders} طلب • متوسط {formatMoney(seller.avgTicket)}</p>
                  </div>
                  <p className="text-base font-black text-slate-900">{formatMoney(seller.revenue)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-bold text-slate-500">
                لا توجد مبيعات مؤكدة للبائعين في الفترة الحالية.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="تقرير المبيعات حسب الفرع" subtitle="مقارنة سريعة بين الفروع من ناحية الطلبات والإيراد" icon={Building2}>
          <div className="space-y-3">
            {branchPerformance.length > 0 ? (
              branchPerformance.map((branch) => (
                <div key={branch.name} className="flex items-center justify-between rounded-[1.5rem] border border-slate-100 bg-white px-4 py-4 shadow-sm">
                  <div>
                    <p className="text-sm font-black text-slate-900">{branch.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{branch.orders} طلب مؤكد</p>
                  </div>
                  <p className="text-base font-black text-slate-900">{formatMoney(branch.revenue)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-bold text-slate-500">
                لا توجد بيانات فروع كافية في الفترة الحالية.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="تقرير المنتجات" subtitle="الأكثر مبيعًا، القريب من النفاد، والمنتجات الراكدة" icon={Package}>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-400">الأكثر مبيعًا</p>
              <div className="mt-4 space-y-3">
                {topProducts.length > 0 ? (
                  topProducts.map((product) => (
                    <div key={product.name} className="rounded-[1.2rem] bg-white px-3 py-3 shadow-sm">
                      <p className="text-sm font-black text-slate-900">{product.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{product.quantity} قطعة • {formatMoney(product.revenue)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-bold text-slate-500">لا توجد حركة مبيعات مؤكدة حتى الآن.</p>
                )}
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-400">قريب من النفاد</p>
              <div className="mt-4 space-y-3">
                {lowStockProducts.length > 0 ? (
                  lowStockProducts.map((product) => (
                    <div key={product.id} className="rounded-[1.2rem] bg-white px-3 py-3 shadow-sm">
                      <p className="text-sm font-black text-slate-900">{product.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{product.stock_quantity} متاح • الحد الأدنى {product.min_stock_level}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-bold text-slate-500">لا توجد منتجات حرجة في المخزون الآن.</p>
                )}
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-400">منتجات راكدة</p>
              <div className="mt-4 space-y-3">
                {slowProducts.length > 0 ? (
                  slowProducts.map((product) => (
                    <div key={product.id} className="rounded-[1.2rem] bg-white px-3 py-3 shadow-sm">
                      <p className="text-sm font-black text-slate-900">{product.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{product.code} • بدون حركة في الفترة</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-bold text-slate-500">جميع المنتجات المسجلة عليها حركة خلال الفترة الحالية.</p>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="آخر العمليات البيعية" subtitle="آخر الطلبات لمراجعة سرعة الدورة البيعية" icon={Store}>
          <div className="space-y-3">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order.id} className="rounded-[1.5rem] border border-slate-100 bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">طلب #{order.order_number}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{order.customer_name || 'بدون اسم عميل'} • {order.salesperson_name}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">{getOrderStatusLabel(order.status)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>{format(new Date(order.created_at), 'yyyy-MM-dd HH:mm')}</span>
                    <span>{formatMoney(order.total_final_price || 0)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-bold text-slate-500">
                لا توجد طلبات لعرضها في التقرير الحالي.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
