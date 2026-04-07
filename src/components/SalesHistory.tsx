import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Order } from '../types';
import { History, Search, DollarSign, CheckCircle, Clock, XCircle, Filter } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';

export default function SalesHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

  const fetchOrders = async () => {
    setLoading(true);
    let query = supabase.from('orders').select('*');
    const now = new Date();
    if (dateRange === 'today') query = query.gte('created_at', startOfDay(now).toISOString());
    else if (dateRange === 'week') query = query.gte('created_at', subDays(now, 7).toISOString());
    else if (dateRange === 'month') query = query.gte('created_at', subDays(now, 30).toISOString());
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query.order('created_at', { ascending: false });
    if (data) setOrders(data as Order[]);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [dateRange, statusFilter]);

  const filtered = orders.filter(o =>
    o.order_number?.toString().includes(search) ||
    (o.seller_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.customer_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = filtered.filter(o => o.status === 'confirmed').reduce((s, o) => s + (o.total_final_price || 0), 0);

  const statusIcon = (status: string) => {
    if (status === 'confirmed') return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    if (status === 'cancelled') return <XCircle className="w-5 h-5 text-red-500" />;
    return <Clock className="w-5 h-5 text-amber-500" />;
  };

  const statusLabel = (status: string) => {
    if (status === 'confirmed') return 'مدفوع';
    if (status === 'cancelled') return 'ملغي';
    if (status === 'sent_to_cashier') return 'بانتظار الكاشير';
    return 'قيد المراجعة';
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto min-h-full" dir="rtl">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3"><History className="w-8 h-8 text-indigo-600" /> سجل المبيعات</h1>
          <p className="text-slate-500 font-medium mt-1">عرض وتتبع جميع المبيعات السابقة</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white px-5 py-3 rounded-2xl border shadow-sm flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <span className="font-black text-slate-800 text-lg">{totalRevenue.toLocaleString()}</span>
            <span className="text-xs text-slate-400 font-bold">ج.م</span>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm mb-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" placeholder="ابحث برقم الفاتورة أو اسم العميل..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-slate-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['today', 'week', 'month', 'all'] as const).map(r => (
            <button key={r} onClick={() => setDateRange(r)} className={`px-4 py-2 rounded-lg font-bold text-xs ${dateRange === r ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}>
              {r === 'today' ? 'اليوم' : r === 'week' ? 'أسبوع' : r === 'month' ? 'شهر' : 'الكل'}
            </button>
          ))}
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {[{ v: 'all', l: 'الكل' }, { v: 'confirmed', l: 'مدفوع' }, { v: 'sent_to_cashier', l: 'معلق' }, { v: 'cancelled', l: 'ملغي' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)} className={`px-4 py-2 rounded-lg font-bold text-xs ${statusFilter === s.v ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead><tr className="bg-slate-50 border-b">
              <th className="px-6 py-4 text-xs font-bold text-slate-400">#</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400">التاريخ</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400">البائع</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400">العميل</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400">الإجمالي</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400">الحالة</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? <tr><td colSpan={6} className="p-12 text-center text-slate-400 font-bold">جاري التحميل...</td></tr> :
                filtered.length === 0 ? <tr><td colSpan={6} className="p-12 text-center text-slate-400 font-bold">لا توجد مبيعات</td></tr> :
                  filtered.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-black text-slate-800">{order.order_number}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-medium">{format(new Date(order.created_at), 'yyyy-MM-dd HH:mm')}</td>
                      <td className="px-6 py-4 font-bold text-slate-700">{order.seller_name}</td>
                      <td className="px-6 py-4 font-bold text-slate-700">{order.customer_name || '—'}</td>
                      <td className="px-6 py-4 font-black text-slate-800">{order.total_final_price?.toLocaleString()} ج.م</td>
                      <td className="px-6 py-4"><span className="flex items-center gap-2">{statusIcon(order.status)}<span className="text-sm font-bold">{statusLabel(order.status)}</span></span></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
