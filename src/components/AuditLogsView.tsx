import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Search, ShieldAlert, User, Clock } from 'lucide-react';
import { setupRealtimeFallback } from '../lib/realtimeFallback';
import { toast } from 'sonner';
import { LoadingState } from './ui/LoadingState';

interface Log {
  id: string;
  action: string;
  user_id: string;
  user_email: string | null;
  details: unknown;
  created_at: string;
}

const formatDetailValue = (value: unknown): string => {
  if (value == null) return '-';
  if (Array.isArray(value)) return value.map(formatDetailValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const formatLogDetails = (details: unknown): string => {
  if (details == null) return '-';
  if (typeof details === 'string') return details;
  if (typeof details !== 'object' || Array.isArray(details)) return formatDetailValue(details);

  const entries = Object.entries(details as Record<string, unknown>);
  if (entries.length === 0) return '-';

  return entries.map(([key, value]) => `${key}: ${formatDetailValue(value)}`).join(' | ');
};

export default function AuditLogsView() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setLogs((data || []) as Log[]);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      toast.error('تعذر تحميل سجل العمليات الآن.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
    return setupRealtimeFallback({
      fetchNow: fetchLogs,
      createChannel: () =>
        supabase
          .channel('audit-sync')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => fetchLogs()),
      pollIntervalMs: 20000,
    });
  }, [page]);

  const filteredLogs = logs.filter(log => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return true;

    return [log.action, log.user_email ?? '', formatLogDetails(log.details)]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch);
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto pharaonic-bg min-h-full" dir="rtl">
      <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
             <ShieldAlert className="w-8 h-8 text-red-600" /> سجل الرقابة والنشاطات
          </h1>
          <p className="text-slate-500 font-medium mt-1">تتبع كافة العمليات الحساسة في النظام لضمان الشفافية</p>
        </div>
        
        <div className="relative group w-full sm:w-80">
          <input 
            type="text" 
            placeholder="بحث في السجل..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-12 py-3.5 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-blue-100 outline-none font-bold shadow-sm"
          />
          <Search className="w-5 h-5 text-slate-300 absolute right-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
        </div>
      </header>

      <div className="bg-white/80 backdrop-blur-xl rounded-[3rem] shadow-2xl border border-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-sm font-bold">
                <th className="p-6">الوقت والتاريخ</th>
                <th className="p-6">المستخدم</th>
                <th className="p-6">الإجراء</th>
                <th className="p-6">التفاصيل</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-6">
                      <LoadingState
                        title="جاري تحميل سجل العمليات"
                        subtitle="نسترجع أحدث الأحداث الحساسة وعمليات النظام لعرضها بشكل مرتب."
                        compact
                      />
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={4} className="p-12 text-center text-slate-400">لا توجد سجلات حالياً</td></tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="p-6 text-slate-400 font-medium">
                       <span className="flex items-center gap-2">
                         <Clock className="w-4 h-4" /> {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm')}
                       </span>
                    </td>
                    <td className="p-6">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                           <User className="w-4 h-4" />
                         </div>
                         <span className="font-bold text-slate-700">{log.user_email || 'No email'}</span>
                       </div>
                    </td>
                    <td className="p-6">
                       <span className="bg-slate-100 px-4 py-1.5 rounded-full text-xs font-black text-slate-600">
                         {log.action}
                       </span>
                    </td>
                    <td className="p-6 text-slate-500 font-medium text-sm">
                      {formatLogDetails(log.details)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-slate-500">
            صفحة {page} من {totalPages} • إجمالي السجلات {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => canGoPrev && setPage((value) => value - 1)}
              disabled={!canGoPrev}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" /> السابقة
            </button>
            <button
              type="button"
              onClick={() => canGoNext && setPage((value) => value + 1)}
              disabled={!canGoNext}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              التالية <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
