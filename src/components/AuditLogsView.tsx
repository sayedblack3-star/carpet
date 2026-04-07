import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { format } from 'date-fns';
import { Activity, Search, ShieldAlert, User, Clock, Store } from 'lucide-react';
import { setupRealtimeFallback } from '../lib/realtimeFallback';

interface Log {
  id: string;
  action: string;
  user_id: string;
  user_email: string;
  details: any;
  created_at: string;
}

export default function AuditLogsView() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (data) setLogs(data as Log[]);
    setLoading(false);
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
  }, []);

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <tr><td colSpan={4} className="p-12 text-center text-slate-400">جاري تحميل السجلات...</td></tr>
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
                         <span className="font-bold text-slate-700">{log.user_email}</span>
                       </div>
                    </td>
                    <td className="p-6">
                       <span className="bg-slate-100 px-4 py-1.5 rounded-full text-xs font-black text-slate-600">
                         {log.action}
                       </span>
                    </td>
                    <td className="p-6 text-slate-500 font-medium text-sm">
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
