import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Clock, Play, Square, DollarSign, Wallet, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { logAction } from '../lib/logger';
import { format } from 'date-fns';

interface ShiftManagerProps {
  userId: string;
  branchId: string;
}

export default function ShiftManager({ userId, branchId }: ShiftManagerProps) {
  const [activeShift, setActiveShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startingCash, setStartingCash] = useState('');
  const [endingCash, setEndingCash] = useState('');
  const [showShiftModal, setShowShiftModal] = useState(false);

  const fetchActiveShift = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    setActiveShift(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchActiveShift();
    const channel = supabase.channel('shifts-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `user_id=eq.${userId}` }, () => fetchActiveShift())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleStartShift = async () => {
    if (!branchId) {
       toast.error('يرجى اختيار الفرع قبل بدء الوردية');
       return;
    }
    const cash = parseFloat(startingCash);
    if (isNaN(cash)) {
       toast.error('يرجى إدخال مبلغ عهدة البداية');
       return;
    }

    try {
      const { error } = await supabase.from('shifts').insert([{
        user_id: userId,
        branch_id: branchId,
        status: 'active',
        starting_cash: cash,
        start_time: new Date().toISOString()
      }]);

      if (error) throw error;
      toast.success('تم فتح الوردية بنجاح 🟢');
      setShowShiftModal(false);
      setStartingCash('');
    } catch (error: any) {
      toast.error('خطأ: ' + error.message);
    }
  };

  const handleEndShift = async () => {
    const cash = parseFloat(endingCash);
    if (isNaN(cash)) {
       toast.error('يرجى إدخال مبلغ عهدة النهاية');
       return;
    }

    try {
      const { error } = await supabase.from('shifts').update({
        status: 'closed',
        ending_cash: cash,
        end_time: new Date().toISOString()
      }).eq('id', activeShift.id);

      if (error) throw error;
      toast.error('تم إغلاق الوردية 🔴');
      setShowShiftModal(false);
      setEndingCash('');
    } catch (error: any) {
      toast.error('خطأ: ' + error.message);
    }
  };

  if (loading) return null;

  return (
    <>
      <button 
        onClick={() => setShowShiftModal(true)}
        className={`fixed bottom-4 left-4 p-4 rounded-full shadow-2xl transition-all z-[100] flex items-center gap-2 font-black ${
          activeShift ? 'bg-emerald-600 text-white animate-pulse shadow-emerald-200' : 'bg-slate-900 text-white shadow-slate-200'
        }`}
      >
        <Clock className="w-6 h-6" />
        <span className="text-sm">{activeShift ? 'وردية مفتوحة' : 'فتح وردية'}</span>
      </button>

      {showShiftModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 border border-white/20 animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-start mb-8">
               <div>
                 <h2 className="text-2xl font-black text-slate-800">إدارة الوردية</h2>
                 <p className="text-slate-500 font-medium mt-1">تتبع الوقت والعهد المالية</p>
               </div>
               <button onClick={() => setShowShiftModal(false)} className="p-2 hover:bg-slate-50 rounded-full text-slate-300">
                 <Square className="w-5 h-5" />
               </button>
             </div>

             {activeShift ? (
               <div className="space-y-6">
                 <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-center gap-4">
                   <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                     <Play className="w-6 h-6" />
                   </div>
                   <div>
                     <p className="text-emerald-700 font-bold">الوردية مفتوحة منذ</p>
                     <p className="text-sm text-emerald-600 font-black">{format(new Date(activeShift.start_time), 'HH:mm - yyyy/MM/dd')}</p>
                   </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-700 mr-2 flex items-center gap-1">
                      <DollarSign className="w-4 h-4" /> عهدة نهاية الوردية (كاش)
                    </label>
                    <input type="number" value={endingCash} onChange={e => setEndingCash(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-black text-xl text-center" placeholder="0.00" />
                 </div>

                 <button onClick={handleEndShift} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-[1.8rem] text-lg shadow-xl shadow-red-100 transition-all flex items-center justify-center gap-3">
                   <Square className="w-6 h-6" /> إغلاق الوردية وحفظ
                 </button>
               </div>
             ) : (
               <div className="space-y-6">
                 <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4">
                   <div className="w-12 h-12 bg-white text-slate-400 rounded-2xl flex items-center justify-center border border-slate-100">
                     <Wallet className="w-6 h-6" />
                   </div>
                   <div>
                     <p className="text-slate-500 font-bold">الوردية الحالية: مغلقة</p>
                     <p className="text-xs text-slate-400 font-medium">يرجى تسجيل العهدة البدائية للبدء</p>
                   </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-700 mr-2 flex items-center gap-1">
                      <DollarSign className="w-4 h-4" /> عهدة استلام الوردية (كاش)
                    </label>
                    <input type="number" value={startingCash} onChange={e => setStartingCash(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-black text-xl text-center" placeholder="0.00" />
                 </div>

                 <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                   <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                   <p className="text-xs text-amber-800 font-medium leading-relaxed">يرجى التأكد من اختيار الفرع الصحيح في الواجهة الرئيسية قبل البدء.</p>
                 </div>

                 <button onClick={handleStartShift} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-[1.8rem] text-lg shadow-xl shadow-emerald-100 transition-all flex items-center justify-center gap-3">
                   <Play className="w-6 h-6" /> بدء الوردية الآن
                 </button>
               </div>
             )}
           </div>
        </div>
      )}
    </>
  );
}
