import React, { useState } from 'react';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { LogIn, Mail, Lock, Sparkles } from 'lucide-react';
import BrandMark from './BrandMark';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes('Invalid login')) {
        toast.error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('أهلًا بك في كاربت لاند');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#120b07] p-6" dir="rtl">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at top right, rgba(245,158,11,0.22), transparent 28%), radial-gradient(circle at bottom left, rgba(180,83,9,0.3), transparent 32%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-20"
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

      <div className="relative z-10 w-full max-w-[480px]">
        <div className="relative overflow-hidden rounded-[3.5rem] border border-white/10 bg-white/[0.05] p-12 shadow-[0_35px_120px_-20px_rgba(0,0,0,0.8)] backdrop-blur-3xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-x-12 top-32 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />

          <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
              <BrandMark iconOnly />
            </div>
            <h1 className="text-4xl font-black text-white mb-2">كاربت لاند</h1>
            <p className="text-amber-100/80 font-bold text-sm tracking-[0.24em] mb-3">CARPETS AND HOME TEXTILES</p>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-100">
              <Sparkles className="w-4 h-4 text-amber-300" />
              الاستاذ احمد السويفي
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
                className="block w-full bg-black/40 border-2 border-white/5 rounded-2xl py-4 pr-12 pl-5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all font-semibold"
                placeholder="البريد الإلكتروني"
              />
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full bg-black/40 border-2 border-white/5 rounded-2xl py-4 pr-12 pl-5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all font-semibold"
                placeholder="كلمة المرور"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white font-bold text-lg py-4 rounded-2xl transition-all shadow-xl shadow-amber-600/20 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-6 h-6 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" /> دخول للنظام
                </>
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-white/5 pt-6 text-center">
            <p className="text-slate-400 text-xs font-medium mb-3">نظام داخلي خاص بالسجاد والمفروشات - تواصل مع الإدارة للحصول على حساب</p>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-500/80">
              <Sparkles className="w-4 h-4" /> Carpet Land ERP v5.0
            </div>
          </div>
        </div>
      </div>

      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-600/40 to-transparent" />
    </div>
  );
};

export default Login;
