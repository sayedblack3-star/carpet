import React, { useState } from 'react';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { ShieldCheck, LogIn, Mail, Lock, Sparkles, UserPlus } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');

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
      toast.success('مرحباً بك في أرض السجاد');
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { toast.error('يرجى إدخال الاسم الكامل'); return; }
    if (password.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('تم إنشاء حسابك بنجاح! يرجى انتظار موافقة المدير لتفعيل حسابك.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0a0f] p-6" dir="rtl">
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-amber-600/15 blur-[150px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-amber-600/10 blur-[120px] rounded-full"></div>

      <div className="relative z-10 w-full max-w-[460px]">
        <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[3.5rem] p-12 shadow-[0_35px_120px_-20px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-gradient-to-tr from-amber-600/90 to-yellow-500/90 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-amber-600/30 -rotate-2 hover:rotate-2 transition-transform duration-700 cursor-default">
              <ShieldCheck className="w-12 h-12 text-white drop-shadow-lg" />
            </div>
            <h1 className="text-4xl font-black text-white mb-2">أرض السجاد</h1>
            <p className="text-slate-400 font-medium text-sm">نظام إدارة المبيعات</p>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-white/5 rounded-2xl p-1 mb-8 border border-white/5">
            <button onClick={() => setMode('login')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${mode === 'login' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
              <LogIn className="w-4 h-4" /> دخول
            </button>
            <button onClick={() => setMode('register')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${mode === 'register' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
              <UserPlus className="w-4 h-4" /> تسجيل جديد
            </button>
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-5">
            {mode === 'register' && (
              <div className="relative">
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="block w-full bg-black/40 border-2 border-white/5 rounded-2xl py-4 px-5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all font-semibold"
                  placeholder="الاسم الكامل" />
              </div>
            )}
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-500" />
              </div>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="block w-full bg-black/40 border-2 border-white/5 rounded-2xl py-4 pr-12 pl-5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all font-semibold"
                placeholder="البريد الإلكتروني" />
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="block w-full bg-black/40 border-2 border-white/5 rounded-2xl py-4 pr-12 pl-5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all font-semibold"
                placeholder="كلمة المرور" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white font-bold text-lg py-4 rounded-2xl transition-all shadow-xl shadow-amber-600/20 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-3">
              {loading ? (
                <div className="w-6 h-6 border-[3px] border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : mode === 'login' ? (
                <><LogIn className="w-5 h-5" /> دخول للنظام</>
              ) : (
                <><UserPlus className="w-5 h-5" /> إنشاء حساب</>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <div className="inline-flex items-center gap-2 text-amber-500/80 bg-amber-500/5 border border-amber-500/20 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest">
              <Sparkles className="w-4 h-4" /> Carpet Land ERP v5.0
            </div>
          </div>
        </div>
      </div>

      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-600/40 to-transparent"></div>
    </div>
  );
};

export default Login;
