import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { AppUser, Shift, BRANCHES } from '../types';
import { Clock, Play, Square, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { logAction } from '../lib/logger';
import { format } from 'date-fns';

interface ShiftManagerProps {
  userRole: string;
  userBranchId: string | null;
  userName: string;
}

export default function ShiftManager({ userRole, userBranchId, userName }: ShiftManagerProps) {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingCash, setStartingCash] = useState('');
  const [endingCash, setEndingCash] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let channel: any = null;

    const setupShift = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const fetchShift = async () => {
        const { data, error } = await supabase
          .from('shifts')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1);

        if (data && data.length > 0) {
          const shiftDoc = data[0];
          setActiveShift({
            id: shiftDoc.id,
            userId: shiftDoc.user_id,
            userEmail: shiftDoc.user_email,
            userName: shiftDoc.user_name,
            branchId: shiftDoc.branch_id,
            role: shiftDoc.role,
            startTime: new Date(shiftDoc.start_time),
            status: shiftDoc.status,
            startingCash: shiftDoc.starting_cash
          } as any);
        } else {
          setActiveShift(null);
        }
        setLoading(false);
      };

      await fetchShift();

      channel = supabase.channel('shift-changes')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'shifts',
            filter: `user_id=eq.${user.id}`
        }, (payload) => {
            fetchShift();
        })
        .subscribe();
    };

    setupShift();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user || !userBranchId) {
      toast.error('يجب تحديد الفرع أولاً لبدء الوردية');
      return;
    }

    try {
      const { error } = await supabase.from('shifts').insert([{
        user_id: user.id,
        user_email: user.email,
        user_name: userName || user.user_metadata?.full_name || 'مستخدم',
        branch_id: userBranchId,
        role: userRole,
        status: 'active',
        starting_cash: startingCash ? parseFloat(startingCash) : 0,
      }]);
      
      if (error) throw error;
      
      await logAction('بدء وردية', `بدء وردية جديدة بعهدة ${startingCash || 0} ج.م`, userBranchId);
      toast.success('تم بدء الوردية بنجاح');
      setStartingCash('');
    } catch (error) {
      console.error('Error starting shift:', error);
      toast.error('حدث خطأ أثناء بدء الوردية');
    }
  };

  const handleEndShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift?.id) return;

    try {
      const { error } = await supabase.from('shifts')
        .update({
          end_time: new Date().toISOString(),
          status: 'completed',
          ending_cash: endingCash ? parseFloat(endingCash) : 0,
          notes: notes
        })
        .eq('id', activeShift.id);

      if (error) throw error;

      await logAction('إنهاء وردية', `إنهاء الوردية بعهدة ${endingCash || 0} ج.م`, activeShift.branchId);
      toast.success('تم إنهاء الوردية بنجاح');
      setEndingCash('');
      setNotes('');
      setActiveShift(null);
    } catch (error) {
      console.error('Error ending shift:', error);
      toast.error('حدث خطأ أثناء إنهاء الوردية');
    }
  };

  if (loading) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-3 rounded-xl ${activeShift ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'}`}>
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">إدارة الوردية</h2>
          <p className="text-sm text-slate-500">
            {activeShift ? 'وردية نشطة حالياً' : 'لا توجد وردية نشطة'}
          </p>
        </div>
      </div>

      {!activeShift ? (
        <form onSubmit={handleStartShift} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">العهدة الافتتاحية (اختياري)</label>
            <div className="relative">
              <DollarSign className="absolute right-3 top-2.5 w-5 h-5 text-slate-400" />
              <input
                type="number"
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
                className="w-full pl-3 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition"
          >
            <Play className="w-5 h-5" />
            تسجيل حضور وبدء الوردية
          </button>
        </form>
      ) : (
        <form onSubmit={handleEndShift} className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg mb-4">
            <p className="text-sm text-slate-600 mb-1">وقت البدء:</p>
            <p className="font-medium">
              {activeShift.startTime ? format(activeShift.startTime, 'yyyy-MM-dd hh:mm a') : 'جاري التحميل...'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">العهدة الختامية (اختياري)</label>
            <div className="relative">
              <DollarSign className="absolute right-3 top-2.5 w-5 h-5 text-slate-400" />
              <input
                type="number"
                value={endingCash}
                onChange={(e) => setEndingCash(e.target.value)}
                className="w-full pl-3 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات (اختياري)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              rows={2}
              placeholder="أي ملاحظات إضافية..."
            />
          </div>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition"
          >
            <Square className="w-5 h-5" />
            تسجيل انصراف وإنهاء الوردية
          </button>
        </form>
      )}
    </div>
  );
}
