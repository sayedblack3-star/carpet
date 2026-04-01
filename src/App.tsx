import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { 
  TrendingUp, 
  Package, 
  Monitor, 
  Smartphone, 
  Shield, 
  Activity, 
  LogOut, 
  WifiOff, 
  ClipboardList,
  ArrowLeft
} from 'lucide-react';
import { supabase } from './supabase';
import UserManager from './components/UserManager';
import ProductManager from './components/ProductManager';
import DashboardView from './components/DashboardView';
import CashierView from './components/CashierView';
import SalespersonView from './components/SalespersonView';
import AuditLogsView from './components/AuditLogsView';
import ShortagesView from './components/ShortagesView';
import OwnerWelcome from './components/OwnerWelcome';
import Login from './components/Login';

const Logo = () => (
    <svg viewBox="0 0 100 100" className="w-8 h-8 sm:w-10 sm:h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 80C10 80 25 70 50 70C75 70 90 80 90 80V30C90 30 75 20 50 20C25 20 10 30 10 30V80Z" fill="url(#grad1)" stroke="#B45309" strokeWidth="2" />
        <path d="M20 35C20 35 35 28 50 28C65 28 80 35 80 35" stroke="#F59E0B" strokeWidth="1" strokeDasharray="2 2" />
        <path d="M20 75C20 75 35 68 50 68C65 68 80 75 80 75" stroke="#F59E0B" strokeWidth="1" strokeDasharray="2 2" />
        <circle cx="50" cy="45" r="12" fill="#F59E0B" fillOpacity="0.2" stroke="#B45309" strokeWidth="1" />
        <path d="M45 45L55 45M50 40L50 50" stroke="#B45309" strokeWidth="2" strokeLinecap="round" />
        <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#FDE68A', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#D97706', stopOpacity: 1 }} />
            </linearGradient>
        </defs>
    </svg>
);

function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'main' | 'shortages'>('main');
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const splashSeen = sessionStorage.getItem('splashSeen');
    if (splashSeen) {
        setShowSplash(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setActiveRole(null);
        setLoading(false);
      }
    });

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSplashFinish = () => {
    setShowSplash(false);
    sessionStorage.setItem('splashSeen', 'true');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('branchId');
    localStorage.removeItem('salespersonName');
  };

  const selectRole = (role: string) => {
    setActiveRole(role);
    setCurrentTab('main');
  };

  if (showSplash) {
    return <OwnerWelcome onFinish={handleSplashFinish} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const isMasterAdmin = session.user.email === 'sayedblack3@gmail.com' || session.user.email === 'admin@carpetland.com';
  const roleFromProfile = profile?.role || 'salesperson';
  const isApproved = profile?.is_approved || isMasterAdmin;
  const isAdminUser = roleFromProfile === 'admin' || roleFromProfile === 'manager' || isMasterAdmin;
  const userBranchId = profile?.branch_id;
  const userName = profile?.full_name || session.user.email;

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="bg-white/10 backdrop-blur-xl p-10 rounded-[2rem] border border-white/5 max-w-md w-full shadow-2xl">
          <div className="w-20 h-20 bg-amber-500/20 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">حسابك في انتظار المراجعة</h1>
          <p className="text-slate-400 mb-8 leading-relaxed">
            مرحباً بك في Carpet Land. حسابك قيد المراجعة حالياً من قبل الإدارة. يرجى التواصل مع المسؤول لتفعيل حسابك.
          </p>
          <button onClick={handleLogout} className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition border border-white/10">
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  const effectiveRole = isAdminUser ? (activeRole || roleFromProfile) : roleFromProfile;

  if (isAdminUser && !activeRole) {
    return (
      <div className="min-h-screen pharaonic-bg p-4 sm:p-8" dir="rtl">
        <Toaster position="top-center" richColors />
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex flex-col items-center mb-12">
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-amber-200 mb-6">
              <Logo />
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-amber-900 mb-4 tracking-tight">مرحباً بك في Carpet Land</h1>
            <p className="text-amber-800/80 text-lg sm:text-xl font-medium">اختر الواجهة التي ترغب في الدخول إليها</p>
          </div>
 
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
            <button onClick={() => selectRole('admin')} className="group relative bg-white/90 backdrop-blur-sm p-6 sm:p-8 rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all text-right flex flex-col items-start hover:-translate-y-1">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Shield className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2 sm:mb-3">إدارة المستخدمين</h2>
              <p className="text-sm sm:text-base text-slate-500">إدارة الحسابات والصلاحيات</p>
            </button>
 
            <button onClick={() => selectRole('audit')} className="group relative bg-white/90 backdrop-blur-sm p-6 sm:p-8 rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all text-right flex flex-col items-start hover:-translate-y-1">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <Activity className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2 sm:mb-3">سجل النشاطات</h2>
              <p className="text-sm sm:text-base text-slate-500">تتبع جميع الإجراءات</p>
            </button>
 
            <button onClick={() => selectRole('manager')} className="group relative bg-white/90 backdrop-blur-sm p-6 sm:p-8 rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all text-right flex flex-col items-start hover:-translate-y-1">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2 sm:mb-3">لوحة الإدارة</h2>
              <p className="text-sm sm:text-base text-slate-500">تقارير المبيعات والإحصائيات</p>
            </button>
 
            <button onClick={() => selectRole('pricing')} className="group relative bg-white/90 backdrop-blur-sm p-6 sm:p-8 rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all text-right flex flex-col items-start hover:-translate-y-1">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                <Package className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2 sm:mb-3">مسؤول الأسعار</h2>
              <p className="text-sm sm:text-base text-slate-500">إدارة المنتجات والمخزون</p>
            </button>
 
            <button onClick={() => selectRole('cashier')} className="group relative bg-white/90 backdrop-blur-sm p-6 sm:p-8 rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all text-right flex flex-col items-start hover:-translate-y-1">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Monitor className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2 sm:mb-3">واجهة الكاشير</h2>
              <p className="text-sm sm:text-base text-slate-500">تأكيد الطلبات وطباعة الفواتير</p>
            </button>
 
            <button onClick={() => selectRole('salesperson')} className="group relative bg-white/90 backdrop-blur-sm p-6 sm:p-8 rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all text-right flex flex-col items-start hover:-translate-y-1">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <Smartphone className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2 sm:mb-3">واجهة البائع</h2>
              <p className="text-sm sm:text-base text-slate-500">إنشاء ومتابعة طلبات المبيعات</p>
            </button>
          </div>
  
          <div className="mt-12">
            <button 
              onClick={handleLogout} 
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-white/90 backdrop-blur-sm text-red-600 border border-red-100 shadow-sm hover:bg-red-50 font-bold transition-all"
            >
              <LogOut className="w-5 h-5" /> تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-slate-50 pharaonic-bg" dir="rtl">
      <Toaster position="top-center" richColors />
      
      <header className="bg-white/95 backdrop-blur-md border-b border-amber-100 h-16 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 p-1 rounded-lg shadow-sm">
            <Logo />
          </div>
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-amber-700 to-amber-900 text-lg sm:text-xl hidden md:block">
            Carpet Land
          </span>
          {isOffline && (
            <div className="flex items-center gap-1 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
              <WifiOff className="w-3 h-3" /> مقطوع
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-4 overflow-hidden">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setCurrentTab('main')}
              className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all ${currentTab === 'main' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
            >
              الرئيسية
            </button>
            <button
              onClick={() => setCurrentTab('shortages')}
              className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all flex items-center gap-1.5 ${currentTab === 'shortages' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600'}`}
            >
              <ClipboardList className="w-4 h-4" /> <span className="hidden xs:inline">النواقص</span>
            </button>
          </div>

          {isAdminUser && (
            <button 
              onClick={() => { setActiveRole(null); setCurrentTab('main'); }}
              className="flex items-center gap-1 text-[10px] sm:text-sm bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg font-bold border border-amber-200 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
              <span className="hidden sm:inline">تبديل الواجهة</span>
            </button>
          )}
          
          <button 
            onClick={handleLogout}
            className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors shrink-0"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="h-[calc(100vh-64px)] overflow-y-auto">
        {currentTab === 'shortages' ? (
          <ShortagesView userBranchId={userBranchId} userName={userName} />
        ) : (
          <div className="h-full">
            {effectiveRole === 'salesperson' && <SalespersonView userBranchId={userBranchId} />}
            {effectiveRole === 'cashier' && <CashierView userBranchId={userBranchId} userRole={roleFromProfile} />}
            {effectiveRole === 'manager' && <DashboardView userBranchId={userBranchId} />}
            {effectiveRole === 'pricing' && <ProductManager />}
            {effectiveRole === 'admin' && <UserManager />}
            {effectiveRole === 'audit' && <AuditLogsView />}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
