import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { format } from 'date-fns';
import { Activity, Search } from 'lucide-react';

interface Log {
  id: string;
  action: string;
  userId: string;
  userEmail: string;
  details: string;
  branchId: string | null;
  createdAt: Date;
}

export default function AuditLogsView() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        setLogs(data.map((d: any) => ({
          id: d.id,
          action: d.action,
          userId: d.user_id,
          userEmail: d.user_email,
          details: d.details?.message || JSON.stringify(d.details || {}),
          branchId: d.details?.branchId || null,
          createdAt: new Date(d.created_at)
        })));
      }
    };

    fetchLogs();

    const channel = supabase.channel('audit_logs-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
        const d: any = payload.new;
        setLogs(prev => [{
            id: d.id,
            action: d.action,
            userId: d.user_id,
            userEmail: d.user_email,
            details: d.details?.message || JSON.stringify(d.details || {}),
            branchId: d.details?.branchId || null,
            createdAt: new Date(d.created_at)
        }, ...prev].slice(0, 100));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-600" />
          سجل النشاطات (Audit Trail)
        </h1>
        <div className="relative w-64">
          <Search className="w-5 h-5 absolute right-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="بحث في السجل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold text-slate-700">التاريخ والوقت</th>
                <th className="p-4 font-semibold text-slate-700">المستخدم</th>
                <th className="p-4 font-semibold text-slate-700">الإجراء</th>
                <th className="p-4 font-semibold text-slate-700">التفاصيل</th>
                <th className="p-4 font-semibold text-slate-700">الفرع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-sm text-slate-600">
                    {log.createdAt.getTime() ? format(log.createdAt, 'yyyy-MM-dd HH:mm:ss') : 'جاري التحميل...'}
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-800" dir="ltr">
                    {log.userEmail}
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    {log.details}
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    {log.branchId || 'الكل'}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    لا توجد سجلات مطابقة للبحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
