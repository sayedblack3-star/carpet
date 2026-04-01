import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'react-hot-toast';
import { ShieldCheck, LogIn, Mail, Lock, Sparkles } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // 1. Authenticate user
    const { data: { user }, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      toast.error(error.message || 'فشل تسجيل الدخول');
      setLoading(false);
      return;
    }

    if (user) {
      // 2. Auto-Heal: Ensure identity sync
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) {
        // Try finding by email instead
        const { data: profileByEmail } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();

        if (profileByEmail) {
          await supabase.from('profiles').update({ id: user.id, role: 'admin', is_approved: true, is_active: true }).eq('email', user.email);
          toast.success('تمت مزامنة الهوية بنجاح');
        } else {
          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email,
            full_name: user.email?.split('@')[0] || 'User',
            role: 'admin',
            is_approved: true,
            is_active: true
          });
          toast.success('تم إنشاء بروفايلك كأدمن تلقائياً');
        }
      } else if (user.email === 'sayed@carpetland.com' && profile.role !== 'admin') {
         // Auto-promote Sayed to Admin if needed
         await supabase.from('profiles').update({ role: 'admin', is_approved: true }).eq('id', user.id);
      }
      toast.success('مرحباً بك في أرض السجاد');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0a0f] pharaonic-pattern p-6" dir="rtl">
      {/* Premium Neon Accents */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-red-600/20 blur-[150px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-amber-600/10 blur-[120px] rounded-full delay-1000"></div>

      {/* Main Glassmorphism Portal */}
      <div className="relative z-10 w-full max-w-[460px]">
        <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[3.5rem] p-12 shadow-[0_35px_120px_-20px_rgba(0,0,0,0.8)] relative overflow-hidden group">
          {/* Subtle Inner Glow */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          
          {/* Branding Section */}
          <div className="text-center mb-12 relative">
            <div className="w-24 h-24 bg-gradient-to-tr from-red-600/90 to-amber-500/90 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-red-600/30 -rotate-2 hover:rotate-2 transition-transform duration-700 ease-out cursor-default">
              <ShieldCheck className="w-12 h-12 text-white drop-shadow-lg" />
            </div>
            <h1 className="text-4xl font-black text-white mb-3 tracking-tighter pharaonic-font">أرض السجاد</h1>
            <p className="text-slate-400 font-medium text-lg opacity-80">نظام الإدارة الفردي الفاخر</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-5">
              {/* Email Input Field */}
              <div className="relative group/input">
                <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500 group-focus-within/input:text-red-500 transition-all duration-300" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full bg-black/40 border-2 border-white/5 rounded-3xl py-5 pr-14 pl-6 text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-red-600/10 focus:border-red-600/50 transition-all text-base font-semibold"
                  placeholder="البريد الإلكتروني"
                />
              </div>

              {/* Password Input Field */}
              <div className="relative group/input">
                <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500 group-focus-within/input:text-amber-500 transition-all duration-300" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full bg-black/40 border-2 border-white/5 rounded-3xl py-5 pr-14 pl-6 text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/50 transition-all text-base font-semibold"
                  placeholder="كلمة المرور"
                />
              </div>
            </div>

            {/* Premium Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full relative group/btn rounded-3xl p-[2px] transition-transform active:scale-95 touch-manipulation"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 rounded-3xl animate-gradient-xy group-hover:animate-none opacity-80 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative w-full bg-[#0d0d12] hover:bg-transparent py-5 text-white font-bold text-xl transition-all rounded-3xl flex items-center justify-center gap-3">
                {loading ? (
                  <div className="w-7 h-7 border-[4px] border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <LogIn className="w-6 h-6 transition-transform group-hover/btn:translate-x-1" />
                    دخول للنظام الملكي
                  </>
                )}
              </div>
            </button>
          </form>

          {/* Footer Branding */}
          <div className="mt-12 pt-8 border-t border-white/5 text-center">
             <div className="inline-flex items-center gap-2 text-amber-500/90 bg-amber-500/5 border border-amber-500/20 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-4">
               <Sparkles className="w-4 h-4 animate-pulse" /> الإصدار الذهبي v4.0.1
             </div>
             <p className="text-xs text-slate-600 font-bold opacity-60">© 2026 CARPET LAND ERP. نظام إدارة حطيم</p>
          </div>
        </div>

        {/* Floating Decorative Orbs */}
        <div className="absolute -top-4 -right-4 w-12 h-12 bg-red-600/30 blur-2xl rounded-full"></div>
        <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-amber-600/20 blur-2xl rounded-full"></div>
      </div>

      {/* Cyberpunk Static Accents */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600/40 to-transparent"></div>
      <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-600/20 to-transparent"></div>
    </div>
  );
};

export default Login;
