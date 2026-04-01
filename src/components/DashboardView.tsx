import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Order, BRANCHES } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, Users, Store, DollarSign, Package, Calendar, ShoppingCart, AlertCircle, CheckCircle } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { logAction } from '../lib/logger';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

interface DashboardViewProps {
  userBranchId?: string | null;
}

export default function DashboardView({ userBranchId }: DashboardViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<Order[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

  useEffect(() => {
    setLoading(true);
    
    const fetchDashboardData = async () => {
      let query = supabase.from('orders').select('*');
      
      const now = new Date();
      if (dateRange === 'today') {
        query = query.gte('created_at', startOfDay(now).toISOString());
      } else if (dateRange === 'week') {
        query = query.gte('created_at', subDays(now, 7).toISOString());
      } else if (dateRange === 'month') {
        query = query.gte('created_at', subDays(now, 30).toISOString());
      }

      const { data, error } = await query;
      if (data) {
        const completedData: Order[] = [];
        const cancelledData: Order[] = [];
        const approvalsData: Order[] = [];
        
        data.forEach((d: any) => {
          const order = {
            id: d.id,
            branchId: d.branch_id,
            salespersonId: d.salesperson_id,
            salespersonName: d.salesperson_name,
            items: d.items,
            totalOriginalPrice: d.total_original_price,
            totalFinalPrice: d.total_final_price,
            status: d.status,
            requiresManagerApproval: d.requires_manager_approval,
            createdAt: new Date(d.created_at)
          };
          if (order.status === 'completed') completedData.push(order);
          if (order.status === 'cancelled') cancelledData.push(order);
          if (order.status === 'pending' && order.requiresManagerApproval) approvalsData.push(order);
        });

        setOrders(completedData);
        setCancelledOrders(cancelledData);
        setPendingApprovals(approvalsData);
      }
      setLoading(false);
    };

    fetchDashboardData();

    const channel = supabase.channel('dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        fetchDashboardData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dateRange]);

  // Filter orders based on selected date range and branch (date range already applied in query but keeping client filter logic as fallback)
  const filteredOrders = orders.filter(order => {
    if (userBranchId && order.branchId !== userBranchId) return false;
    return true; 
  });

  // Calculate KPIs
  const filteredCancelledOrders = cancelledOrders.filter(order => !userBranchId || order.branchId === userBranchId);
  const filteredApprovals = pendingApprovals.filter(order => !userBranchId || order.branchId === userBranchId);

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalFinalPrice, 0);
  const totalOrders = filteredOrders.length;
  const totalItemsSold = filteredOrders.reduce((sum, order) => sum + order.items.length, 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Process data for Sales by Branch chart
  const salesByBranchMap = new Map<string, number>();
  filteredOrders.forEach(order => {
    const branchName = BRANCHES.find(b => b.id === order.branchId)?.name || 'فرع غير معروف';
    salesByBranchMap.set(branchName, (salesByBranchMap.get(branchName) || 0) + order.totalFinalPrice);
  });
  const salesByBranchData = Array.from(salesByBranchMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Process data for Top Salespersons chart
  const salesByPersonMap = new Map<string, number>();
  filteredOrders.forEach(order => {
    const personName = order.salespersonName || 'غير معروف';
    salesByPersonMap.set(personName, (salesByPersonMap.get(personName) || 0) + order.totalFinalPrice);
  });
  const salesByPersonData = Array.from(salesByPersonMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5); // Top 5

  const handleApproveOrder = async (orderId: string) => {
    try {
      const { error } = await supabase.from('orders').update({
        requires_manager_approval: false
      }).eq('id', orderId);

      if (error) throw error;
      
      await logAction('موافقة مدير', `تمت الموافقة على الخصم للطلب رقم ${orderId}`, userBranchId || 'all');
      toast.success('تمت الموافقة على الطلب بنجاح');
    } catch (error) {
      console.error('Error approving order:', error);
      toast.error('حدث خطأ أثناء الموافقة على الطلب');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-500">جاري تحميل البيانات...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          لوحة تحكم الإدارة والمبيعات
        </h1>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
          <button 
            onClick={() => setDateRange('today')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${dateRange === 'today' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            اليوم
          </button>
          <button 
            onClick={() => setDateRange('week')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${dateRange === 'week' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            آخر 7 أيام
          </button>
          <button 
            onClick={() => setDateRange('month')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${dateRange === 'month' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            آخر 30 يوم
          </button>
          <button 
            onClick={() => setDateRange('all')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${dateRange === 'all' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            الكل
          </button>
        </div>
      </div>

      {/* Pending Approvals */}
      {filteredApprovals.length > 0 && (
        <div className="bg-orange-50 p-6 rounded-2xl shadow-sm border border-orange-200 mb-6">
          <h2 className="text-xl font-bold text-orange-800 flex items-center gap-2 mb-4">
            <AlertCircle className="w-6 h-6" />
            طلبات بانتظار موافقة الإدارة (خصم يتجاوز 25%)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApprovals.map(order => (
              <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-orange-100">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-slate-800">بائع: {order.salespersonName}</div>
                    <div className="text-xs text-slate-500 mt-1">{BRANCHES.find(b => b.id === order.branchId)?.name}</div>
                  </div>
                  <div className="text-orange-600 font-bold">{order.totalFinalPrice.toFixed(2)} ج.م</div>
                </div>
                <div className="text-sm text-slate-600 mb-4">
                  {order.items.map(item => (
                    <div key={item.id} className="flex justify-between mt-1">
                      <span>{item.productName}</span>
                      <span className="text-red-500 font-medium">خصم {item.discountPercentage}%</span>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => handleApproveOrder(order.id!)}
                  className="w-full bg-orange-500 text-white font-bold py-2 rounded-lg hover:bg-orange-600 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  موافقة على الخصم
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium mb-1">إجمالي المبيعات</div>
            <div className="text-2xl font-bold text-slate-800">{totalRevenue.toLocaleString()} ج.م</div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium mb-1">عدد الطلبات المكتملة</div>
            <div className="text-2xl font-bold text-slate-800">{totalOrders} طلب</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium mb-1">المنتجات المباعة</div>
            <div className="text-2xl font-bold text-slate-800">{totalItemsSold} منتج</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium mb-1">الطلبات الملغية</div>
            <div className="text-2xl font-bold text-slate-800">{filteredCancelledOrders.length} طلب</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium mb-1">متوسط قيمة الطلب</div>
            <div className="text-2xl font-bold text-slate-800">{averageOrderValue.toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Branch */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Store className="w-5 h-5 text-slate-400" />
            المبيعات حسب الفرع
          </h2>
          <div className="h-80 w-full" dir="ltr">
            {salesByBranchData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByBranchData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fontSize: 12}} tickMargin={10} />
                  <YAxis tickFormatter={(value) => `${value / 1000}k`} tick={{fontSize: 12}} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString()} ج.م`, 'المبيعات']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40}>
                    {salesByBranchData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">لا توجد بيانات كافية</div>
            )}
          </div>
        </div>

        {/* Top Salespersons */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-400" />
            أفضل 5 بائعين
          </h2>
          <div className="h-80 w-full" dir="ltr">
            {salesByPersonData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesByPersonData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {salesByPersonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString()} ج.م`, 'المبيعات']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">لا توجد بيانات كافية</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
