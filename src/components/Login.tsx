import React, { useState } from 'react';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { LogIn, Mail, Lock, Sparkles, Eye, EyeOff, ShieldCheck, Wifi } from 'lucide-react';
import BrandMark from './BrandMark';
import { logAction } from '../lib/logger';
import { normalizeEmail } from '../lib/security';
import { appClient } from '../config/appClient';

const LOGIN_TIMEOUT_MS = 7000;
const loginOperatorLabel = appClient.webBadgeLabel;

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = normalizeEmail(email);

    try {
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({ email: normalizedEmail, password }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('انتهت مهلة تسجيل الدخول. تحقق من اتصال الإنترنت وحاول مرة أخرى.')), LOGIN_TIMEOUT_MS);
        }),
      ]);

      if (error) {
        console.warn('Login failed:', error.message);
        if (error.message.includes('Invalid login')) {
          toast.error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        } else {
          toast.error(error.message);
        }
        return;
      }

      const loginUserId = data?.user?.id;
      window.setTimeout(() => {
        void logAction('login_success', { email: normalizedEmail, user_id: loginUserId }).catch((logError) => {
          console.warn('Login audit skipped:', logError);
        });
      }, 800);

      toast.success(`أهلًا بك في ${appClient.companyNameAr}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر إكمال تسجيل الدخول الآن.';
      console.warn('Login request failed:', message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="motion-page-enter min-safe-screen safe-area-x safe-area-top safe-area-bottom relative overflow-hidden bg-[#120b07] px-4 py-5 sm:p-6" dir="rtl">
      <div
        className="motion-ambient-float absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at top right, rgba(245,158,11,0.22), transparent 28%), radial-gradient(circle at bottom left, rgba(180,83,9,0.3), transparent 32%)',
        }}
      />
      <div
        className="motion-ambient-float-delayed absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 18px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.16),transparent_65%)]" />

      <svg className="absolute right-[6%] top-[12%] h-40 w-40 opacity-10 text-amber-200" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <path d="M60 14L92 88H28L60 14Z" fill="currentColor" />
        <path d="M28 40L48 88H8L28 40Z" fill="currentColor" />
        <path d="M92 40L112 88H72L92 40Z" fill="currentColor" />
      </svg>
      <svg className="absolute left-[4%] bottom-[10%] h-52 w-52 opacity-10 text-amber-100" viewBox="0 0 160 160" fill="none" aria-hidden="true">
        <path d="M18 112C55 136 105 136 142 112L130 84C94 101 66 101 30 84L18 112Z" fill="currentColor" />
        <path d="M28 108H132M34 98H126M42 88H118" stroke="currentColor" strokeDasharray="5 5" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[1480px] items-center justify-center xl:px-8">
        <div className="grid w-full items-center gap-8 xl:grid-cols-[1.08fr_0.72fr] 2xl:grid-cols-[1.18fr_0.68fr]">
          <section className="hidden xl:block">
            <div className="motion-panel-reveal motion-hero-grid relative overflow-hidden rounded-[3rem] border border-white/10 bg-white/[0.04] p-8 text-white shadow-[0_35px_120px_-32px_rgba(0,0,0,0.8)] backdrop-blur-3xl 2xl:p-10">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="absolute -left-12 bottom-0 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
              <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl" />

              <div className="relative">
                <div className="motion-fade-up inline-flex items-center gap-3 rounded-full border border-amber-400/20 bg-amber-500/10 px-5 py-2 text-xs font-black tracking-[0.2em] text-amber-100">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  {appClient.systemName.toUpperCase()}
                </div>

                <div className="mt-8 max-w-2xl">
                  <div className="motion-fade-up motion-fade-up-delay-1 mb-6 flex items-center gap-4">
                    <BrandMark iconOnly />
                    <div>
                      <p className="text-4xl font-black leading-none text-white">{appClient.companyNameAr}</p>
                      <p className="mt-2 text-sm font-black tracking-[0.24em] text-amber-100/75">{appClient.tagline}</p>
                    </div>
                  </div>

                  <h1 className="motion-fade-up motion-fade-up-delay-2 max-w-3xl text-5xl font-black leading-[1.15] text-white 2xl:text-6xl">
                    نظام تشغيل موحد للبيع والتحصيل والإدارة داخل فروع
                    <span className="text-amber-300"> {appClient.companyNameAr}</span>
                  </h1>
                  <p className="motion-fade-up motion-fade-up-delay-3 mt-6 max-w-2xl text-lg font-bold leading-9 text-white/72">
                    نفس الحسابات، نفس الصلاحيات، ونفس قاعدة البيانات على الويب والموبايل مع تجربة دخول سريعة وآمنة تناسب الاستخدام اليومي داخل النظام.
                  </p>
                </div>

                <div className="mt-10 grid gap-4 2xl:grid-cols-3">
                  <div className="motion-fade-up motion-soft-lift motion-glow rounded-[2rem] border border-white/8 bg-black/20 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <ShieldCheck className="h-5 w-5 text-emerald-300" />
                      <span className="text-[11px] font-black text-white/55">دخول آمن</span>
                    </div>
                    <p className="text-xl font-black text-white">نفس حساب الويب</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-white/60">الدخول من أي جهاز بنفس الصلاحيات والبيانات.</p>
                  </div>

                  <div className="motion-fade-up motion-fade-up-delay-1 motion-soft-lift motion-glow rounded-[2rem] border border-white/8 bg-black/20 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <Wifi className="h-5 w-5 text-amber-300" />
                      <span className="text-[11px] font-black text-white/55">استجابة أوضح</span>
                    </div>
                    <p className="text-xl font-black text-white">تنبيهات واضحة</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-white/60">رسائل مباشرة لو النت ضعيف أو العملية تحتاج إعادة محاولة.</p>
                  </div>

                  <div className="motion-fade-up motion-fade-up-delay-2 motion-soft-lift motion-glow rounded-[2rem] border border-white/8 bg-black/20 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <LogIn className="h-5 w-5 text-sky-300" />
                      <span className="text-[11px] font-black text-white/55">وصول أسرع</span>
                    </div>
                    <p className="text-xl font-black text-white">واجهة مهيأة للويب</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-white/60">مساحة أوضح على الشاشات الكبيرة بدون فقدان هوية النظام.</p>
                  </div>
                </div>

                <div className="motion-fade-up motion-fade-up-delay-4 motion-soft-lift mt-10 flex items-center justify-between rounded-[2rem] border border-white/8 bg-black/20 px-6 py-5">
                  <div>
                    <p className="text-sm font-black text-white/55">الحساب النشط</p>
                    <p className="mt-2 text-xl font-black text-white">{appClient.companyNameAr}</p>
                  </div>
                  <div className="rounded-full border border-amber-400/20 bg-amber-500/10 px-5 py-2 text-sm font-black text-amber-200">
                    {appClient.versionLabel}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="relative mx-auto w-full max-w-[520px] xl:max-w-none">
        <div className="motion-panel-reveal motion-shimmer relative overflow-hidden rounded-[2rem] sm:rounded-[3.5rem] border border-white/10 bg-white/[0.05] p-6 sm:p-12 shadow-[0_35px_120px_-20px_rgba(0,0,0,0.8)] backdrop-blur-3xl xl:p-10 2xl:p-12">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-x-12 top-32 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />

          <div className="text-center mb-8 sm:mb-10">
            <div className="motion-fade-up flex justify-center mb-5 sm:mb-6">
              <BrandMark iconOnly />
            </div>
            <h1 className="motion-fade-up motion-fade-up-delay-1 text-3xl sm:text-4xl font-black text-white mb-2">{appClient.companyNameAr}</h1>
            <p className="motion-fade-up motion-fade-up-delay-2 text-amber-100/80 font-bold text-[11px] sm:text-sm tracking-[0.18em] sm:tracking-[0.24em] mb-4">{appClient.tagline}</p>
            <div className="motion-fade-up motion-fade-up-delay-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-100">
              <Sparkles className="w-4 h-4 text-amber-300" />
              {loginOperatorLabel}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="motion-soft-lift rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-right">
              <div className="flex items-center justify-between mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span className="text-[10px] font-black text-white/60">دخول آمن</span>
              </div>
              <p className="text-sm font-black text-white">بنفس حساب الويب</p>
            </div>
            <div className="motion-soft-lift rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-right">
              <div className="flex items-center justify-between mb-2">
                <Wifi className="w-4 h-4 text-amber-300" />
                <span className="text-[10px] font-black text-white/60">استجابة أسرع</span>
              </div>
              <p className="text-sm font-black text-white">رسالة واضحة لو النت ضعيف</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                className="motion-interactive-outline block w-full bg-black/40 border-2 border-white/5 rounded-2xl py-4 pr-12 pl-5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all font-semibold text-base"
                placeholder="البريد الإلكتروني"
              />
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="motion-interactive-outline block w-full bg-black/40 border-2 border-white/5 rounded-2xl py-4 pr-12 pl-12 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all font-semibold text-base"
                placeholder="كلمة المرور"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="motion-button absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 hover:text-white transition"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="motion-button motion-press motion-shimmer w-full min-h-14 bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white font-bold text-lg py-4 rounded-2xl transition-all shadow-xl shadow-amber-600/20 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-6 h-6 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" /> دخول للنظام
                </>
              )}
            </button>
            <p className="text-center text-[11px] leading-6 text-slate-400 font-bold">استخدم البريد الوظيفي نفسه على الويب والموبايل لتظهر لك نفس الصلاحيات والبيانات.</p>
          </form>

          <div className="mt-8 border-t border-white/5 pt-6 text-center">
            <p className="text-slate-400 text-xs font-medium mb-3">نظام داخلي خاص بالسجاد والمفروشات - تواصل مع الإدارة للحصول على حساب</p>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-500/80">
              <Sparkles className="w-4 h-4" /> {appClient.versionLabel}
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>

      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-600/40 to-transparent" />
    </div>
  );
};

export default Login;
