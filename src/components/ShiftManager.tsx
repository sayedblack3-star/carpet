import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, Clock3, DollarSign, Play, ReceiptText, Square } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '../supabase';
import { setupRealtimeFallback } from '../lib/realtimeFallback';
import { logAction } from '../lib/logger';
import { toFriendlyErrorMessage } from '../lib/errorMessages';
import { Shift } from '../types';

interface ShiftManagerProps {
  userId: string;
  branchId?: string | null;
  variant?: 'card' | 'floating';
  className?: string;
}

const moneyFormatter = new Intl.NumberFormat('ar-EG');

const ShiftManager: React.FC<ShiftManagerProps> = ({ userId, branchId, variant = 'card', className = '' }) => {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [lastClosedShift, setLastClosedShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [startingCash, setStartingCash] = useState('');
  const [endingCash, setEndingCash] = useState('');
  const [realtimeFallbackActive, setRealtimeFallbackActive] = useState(false);
  const fallbackToastShownRef = useRef(false);

  const fetchShiftState = async () => {
    if (!userId) return;

    try {
      const [activeResult, lastClosedResult] = await Promise.all([
        supabase
          .from('shifts')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('shifts')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'closed')
          .order('end_time', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (activeResult.error) throw activeResult.error;
      if (lastClosedResult.error) throw lastClosedResult.error;

      setActiveShift((activeResult.data as Shift | null) || null);
      setLastClosedShift((lastClosedResult.data as Shift | null) || null);
      setRealtimeFallbackActive(false);
    } catch (error) {
      console.warn('Failed to fetch shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void fetchShiftState();

    return setupRealtimeFallback({
      fetchNow: fetchShiftState,
      createChannel: () =>
        supabase
          .channel(`shifts-sync-${userId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `user_id=eq.${userId}` }, () => {
            void fetchShiftState();
          }),
      pollIntervalMs: 20000,
      onFallback: () => {
        setRealtimeFallbackActive(true);
        if (!fallbackToastShownRef.current) {
          fallbackToastShownRef.current = true;
          toast.info('تحديث الوردية يعمل الآن بالمزامنة الدورية كحل احتياطي.');
        }
      },
    });
  }, [userId]);

  const handleStartShift = async () => {
    if (!branchId) {
      toast.error('اختر الفرع أولًا قبل بدء الوردية.');
      return;
    }

    const cash = Number.parseFloat(startingCash);
    if (Number.isNaN(cash) || cash < 0) {
      toast.error('أدخل مبلغ عهدة بداية صحيح.');
      return;
    }

    try {
      const { error } = await supabase.from('shifts').insert([
        {
          user_id: userId,
          branch_id: branchId,
          status: 'active',
          starting_cash: cash,
          start_time: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      await logAction('shift_started', { branch_id: branchId, starting_cash: cash }, branchId);
      toast.success('تم فتح الوردية بنجاح.');
      setStartingCash('');
      setShowShiftModal(false);
      await fetchShiftState();
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, 'تعذر بدء الوردية الآن.'));
    }
  };

  const handleEndShift = async () => {
    if (!activeShift) return;

    const cash = Number.parseFloat(endingCash);
    if (Number.isNaN(cash) || cash < 0) {
      toast.error('أدخل مبلغ عهدة نهاية صحيح.');
      return;
    }

    try {
      const { error } = await supabase
        .from('shifts')
        .update({
          status: 'closed',
          ending_cash: cash,
          end_time: new Date().toISOString(),
        })
        .eq('id', activeShift.id);

      if (error) throw error;

      await logAction(
        'shift_closed',
        {
          shift_id: activeShift.id,
          branch_id: activeShift.branch_id || branchId || null,
          starting_cash: activeShift.starting_cash ?? null,
          ending_cash: cash,
        },
        activeShift.branch_id || branchId || undefined,
      );

      toast.success('تم إغلاق الوردية وحفظ بياناتها.');
      setEndingCash('');
      setShowShiftModal(false);
      await fetchShiftState();
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, 'تعذر إغلاق الوردية الآن.'));
    }
  };

  const statusLabel = activeShift ? 'وردية مفتوحة' : 'لا توجد وردية مفتوحة';
  const shiftSummary = useMemo(() => {
    if (activeShift) {
      return {
        title: 'جاري العمل الآن',
        timestamp: format(new Date(activeShift.start_time), 'HH:mm - yyyy/MM/dd'),
        tone: 'border-emerald-100 bg-emerald-50 text-emerald-900',
      };
    }

    if (lastClosedShift?.end_time) {
      return {
        title: 'آخر وردية مغلقة',
        timestamp: format(new Date(lastClosedShift.end_time), 'HH:mm - yyyy/MM/dd'),
        tone: 'border-slate-200 bg-slate-50 text-slate-700',
      };
    }

    return {
      title: 'لم تبدأ وردية بعد',
      timestamp: 'ابدأ الوردية عندما تكون جاهزًا للعمل.',
      tone: 'border-slate-200 bg-slate-50 text-slate-700',
    };
  }, [activeShift, lastClosedShift]);

  if (!userId || loading) {
    return (
      <div className={`rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const trigger = variant === 'floating' ? (
    <button
      type="button"
      onClick={() => setShowShiftModal(true)}
      className={`fixed bottom-4 left-4 z-[90] flex items-center gap-2 rounded-full px-5 py-4 font-black text-white shadow-2xl transition-all ${
        activeShift ? 'bg-emerald-600 shadow-emerald-200' : 'bg-slate-900 shadow-slate-200'
      } ${className}`}
    >
      <Clock3 className="h-5 w-5" />
      <span className="text-sm">{activeShift ? 'وردية مفتوحة' : 'إدارة الوردية'}</span>
    </button>
  ) : (
    <div className={`rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${activeShift ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
            <Clock3 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">إدارة الوردية</h3>
            <p className="text-xs font-bold text-slate-500">{statusLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowShiftModal(true)}
          className={`rounded-2xl px-4 py-2.5 text-sm font-black transition-colors ${
            activeShift ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {activeShift ? 'إغلاق الوردية' : 'بدء الوردية'}
        </button>
      </div>

      <div className={`mt-4 rounded-2xl border px-4 py-3 ${shiftSummary.tone}`}>
        <p className="text-[11px] font-black opacity-80">{shiftSummary.title}</p>
        <p className="mt-1 text-sm font-black">{shiftSummary.timestamp}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-black text-slate-400">عهدة البداية</p>
          <p className="mt-1 text-lg font-black text-slate-900">
            {activeShift?.starting_cash != null
              ? `${moneyFormatter.format(activeShift.starting_cash)} ج.م`
              : lastClosedShift?.starting_cash != null
                ? `${moneyFormatter.format(lastClosedShift.starting_cash)} ج.م`
                : 'غير محددة'}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-black text-slate-400">عهدة النهاية</p>
          <p className="mt-1 text-lg font-black text-slate-900">
            {activeShift?.ending_cash != null
              ? `${moneyFormatter.format(activeShift.ending_cash)} ج.م`
              : lastClosedShift?.ending_cash != null
                ? `${moneyFormatter.format(lastClosedShift.ending_cash)} ج.م`
                : activeShift
                  ? 'بانتظار الإغلاق'
                  : 'غير محددة'}
          </p>
        </div>
      </div>

      {realtimeFallbackActive && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>التحديث المباشر للوردية غير متاح الآن، لذلك يتم تحديث الحالة تلقائيًا كل بضع ثوانٍ.</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {trigger}

      {showShiftModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setShowShiftModal(false)}>
          <div
            className="w-full max-w-md rounded-[2rem] border border-white/20 bg-white p-6 shadow-2xl sm:p-8"
            dir="rtl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">إدارة الوردية</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">تسجيل عهدة البداية والنهاية وحالة العمل الحالية.</p>
              </div>
              <button type="button" onClick={() => setShowShiftModal(false)} className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
                <Square className="h-4 w-4" />
              </button>
            </div>

            {activeShift ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                      <Play className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-emerald-800">الوردية مفتوحة منذ</p>
                      <p className="text-sm font-bold text-emerald-700">{format(new Date(activeShift.start_time), 'HH:mm - yyyy/MM/dd')}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3">
                    <p className="text-[11px] font-black text-emerald-700">عهدة البداية</p>
                    <p className="mt-1 text-xl font-black text-emerald-900">{moneyFormatter.format(activeShift.starting_cash || 0)} ج.م</p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <DollarSign className="h-4 w-4" /> عهدة نهاية الوردية
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={endingCash}
                    onChange={(event) => setEndingCash(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-lg font-black outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    placeholder="0.00"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleEndShift}
                  className="flex w-full items-center justify-center gap-3 rounded-[1.6rem] bg-red-600 py-4 text-lg font-black text-white shadow-xl shadow-red-100 transition hover:bg-red-700"
                >
                  <Square className="h-5 w-5" /> إغلاق الوردية وحفظها
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
                      <ReceiptText className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">لا توجد وردية مفتوحة الآن</p>
                      <p className="text-sm font-medium text-slate-500">ابدأ الوردية قبل استقبال العمليات النقدية.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <DollarSign className="h-4 w-4" /> عهدة بداية الوردية
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={startingCash}
                    onChange={(event) => setStartingCash(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-lg font-black outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>تأكد من اختيار الفرع الصحيح قبل بدء الوردية حتى تُربط كل حركة بالفرع المناسب.</span>
                </div>

                <button
                  type="button"
                  onClick={handleStartShift}
                  className="flex w-full items-center justify-center gap-3 rounded-[1.6rem] bg-emerald-600 py-4 text-lg font-black text-white shadow-xl shadow-emerald-100 transition hover:bg-emerald-700"
                >
                  <Play className="h-5 w-5" /> بدء الوردية الآن
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ShiftManager;
