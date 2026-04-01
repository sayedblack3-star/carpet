import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import SalespersonView from './components/SalespersonView';
import CashierView from './components/CashierView';
import DashboardView from './components/DashboardView';
import UserManager from './components/UserManager';
import ProductManager from './components/ProductManager';
import AuditLogsView from './components/AuditLogsView';
import ShortagesView from './components/ShortagesView';
import OwnerWelcome from './components/OwnerWelcome';
import { LogOut, Monitor, Smartphone, TrendingUp, WifiOff, Package, Shield, Activity, AlertCircle, ArrowLeft, ClipboardList } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { UserRole } from './types';

// Custom Logo (سجادة وفوقها 3 أهرامات)
const Logo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* Base Carpet */}
    <path d="M 10 75 Q 50 95 90 75 L 80 60 Q 50 75 20 60 Z" fill="#d97706" />
    <path d="M 15 72 L 85 72 M 18 68 L 82 68 M 22 64 L 78 64" stroke="#fcd34d" strokeWidth="1" strokeDasharray="3,3" />
    {/* Fringes (شراشيب السجادة) */}
    <path d="M 10 75 L 5 80 M 20 80 L 15 85 M 30 83 L 25 88 M 40 85 L 35 90 M 50 86 L 45 91 M 60 85 L 55 90 M 70 83 L 65 88 M 80 80 L 75 85 M 90 75 L 85 80" stroke="#f59e0b" strokeWidth="2" />
    {/* Main Pyramid */}
    <polygon points="50,20 65,55 35,55" fill="#f59e0b" />
    <polygon points="50,20 65,55 50,55" fill="#d97706" /> {/* Shadow */}
    {/* Left Pyramid */}
    <polygon points="30,35 40,55 20,55" fill="#fcd34d" />
    <polygon points="30,35 40,55 30,55" fill="#f59e0b" />
    {/* Right Pyramid */}
    <polygon points="70,35 80,55 60,55" fill="#fcd34d" />
    <polygon points="70,35 80,55 70,55" fill="#f59e0b" />
  </svg>
);

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [unauthorized, setUnauthorized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userBranchId, setUserBranchId] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'main' | 'shortages'>('main');
  const [showOwnerWelcome, setShowOwnerWelcome] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserSession(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      handleUserSession(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUserSession = async (currentUser: User | null) => {
    if (currentUser) {
      setUser(currentUser);
      
      const email = currentUser.email?.toLowerCase() || '';
      const isRoot = email === 'szater600@gmail.com' || email === 'sika63123@gmail.com';
      
      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        
        if (isRoot) {
          setIsAdmin(true);
          setUnauthorized(false);
          setUserBranchId(userData ? userData.branch_id : null);
          // Show welcome splash only once per session for the owner
          const hasSeenWelcome = sessionStorage.getItem('ownerWelcomeSeen');
          if (!hasSeenWelcome) {
            setShowOwnerWelcome(true);
          }
          const savedRole = localStorage.getItem('appRole') as UserRole;
          if (savedRole) {
            setRole(savedRole);
          }
        } else if (userData) {
          // Update the real auth ID if it's different (user was pre-registered by admin)
          if (userData.id !== currentUser.id) {
            await supabase.from('users').update({ id: currentUser.id }).eq('email', email);
          }

          if (userData.is_active) {
            setUnauthorized(false);
            setRole(userData.role as UserRole);
            setUserBranchId(userData.branch_id || null);
            if (userData.role === 'admin') {
              setIsAdmin(true);
            }
          } else {
            setUnauthorized(true);
            setRole(null);
            setUserBranchId(null);
          }
        } else {
          // مستخدم جديد تماماً - أنشئ حساب غير مفعل ينتظر موافقة الإدارة
          const { error: insertError } = await supabase
            .from('users')
            .insert([{
              id: currentUser.id,
              email: email,
              name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '',
              role: 'salesperson',
              branch_id: null,
              is_active: false
            }]);
            
          if (insertError) throw insertError;
            
          setUnauthorized(true);
          setRole(null);
          setUserBranchId(null);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        if (isRoot) {
          setIsAdmin(true);
          setUnauthorized(false);
        } else {
          toast.error('حدث خطأ أثناء التحقق من الصلاحيات');
          setUnauthorized(true);
        }
      }
    } else {
      setUser(null);
      setRole(null);
      setIsAdmin(false);
      setUnauthorized(false);
      setUserBranchId(null);
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Error signing in", error);
      toast.error(error?.message || 'حدث خطأ أثناء تسجيل الدخول');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setIsAdmin(false);
    setUnauthorized(false);
    setUserBranchId(null);
    localStorage.removeItem('appRole');
  };

  const selectRole = (selectedRole: UserRole) => {
    setRole(selectedRole);
    localStorage.setItem('appRole', selectedRole);
    setCurrentTab('main');
  };

  const handleOwnerWelcomeDismiss = () => {
    sessionStorage.setItem('ownerWelcomeSeen', 'true');
    setShowOwnerWelcome(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50/90 pharaonic-bg">جاري التحميل...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen pharaonic-bg flex items-center justify-center p-4 relative" dir="rtl">
        <div className="absolute inset-0 bg-amber-900/10 backdrop-blur-[2px]"></div>
        <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-amber-100 max-w-md w-full text-center relative z-10">
          {isOffline && (
            <div className="absolute top-4 left-4 flex items-center gap-1 bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold">
              <WifiOff className="w-4 h-4" />
              أنت غير متصل بالإنترنت
            </div>
          )}
          <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-amber-100">
            <Logo />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-l from-amber-700 to-amber-900 bg-clip-text text-transparent mb-2">Carpet Land</h1>
          <p className="text-slate-500 mb-8 font-medium">الأصالة والفخامة في عالم السجاد</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold py-3.5 rounded-xl hover:from-amber-700 hover:to-amber-800 transition shadow-md flex items-center justify-center gap-2"
          >
            تسجيل الدخول بحساب جوجل
          </button>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen pharaonic-bg flex items-center justify-center p-4" dir="rtl">
        <div className="absolute inset-0 bg-amber-900/10 backdrop-blur-[2px]"></div>
        <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-red-100 max-w-md w-full text-center relative z-10">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">في انتظار موافقة الإدارة</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">تطبيق Carpet Land محمي. لقد تم استلام طلبك وبانتظار الموافقة من لوحة الإدارة وتعيينك لفرعك المناسب.</p>
          <button 
            onClick={handleLogout}
            className="w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 transition flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  if (!role && isAdmin) {
    const userName = user.user_metadata?.full_name?.split(' ')[0] || user.user_metadata?.name || 'المدير';
    const userPhoto = user.user_metadata?.avatar_url;
    
    return (
      <div className="min-h-screen pharaonic-bg flex flex-col items-center justify-center p-4 sm:p-8 relative" dir="rtl">
        <div className="absolute inset-0 bg-amber-900/10 backdrop-blur-[2px]"></div>
        <div className="max-w-6xl w-full relative z-10">
          {isOffline && (
            <div className="absolute -top-12 right-0 flex items-center gap-2 bg-red-100 text-red-600 px-4 py-2 rounded-full text-sm font-bold shadow-sm">
              <WifiOff className="w-4 h-4" />
              أنت غير متصل بالإنترنت
            </div>
          )}

          {/* Header Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-full shadow-lg border-4 border-amber-50 mb-6 overflow-hidden">
              {userPhoto ? (
                <img src={userPhoto} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Shield className="w-10 h-10 text-amber-600" />
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight drop-shadow-sm">
              مرحباً بك، {userName}
            </h1>
            <p className="text-lg text-slate-700 font-medium max-w-2xl mx-auto drop-shadow-sm">
              اختر واجهة العمل التي تريد الدخول إليها
            </p>
          </div>

          {/* Grid Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <button onClick={() => selectRole('admin')} className="group relative bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all text-right flex flex-col items-start hover:-translate-y-1">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Shield className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">إدارة النظام والمستخدمين</h2>
              <p className="text-slate-500 mb-6">إدارة حسابات الموظفين، تحديد الصلاحيات</p>
            </button>

            <button onClick={() => selectRole('audit')} className="group relative bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all text-right flex flex-col items-start hover:-translate-y-1">
              <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <Activity className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">سجل النشاطات</h2>
              <p className="text-slate-500 mb-6">مراقبة وتتبع جميع الإجراءات التي تمت على النظام</p>
            </button>

            <button onClick={() => selectRole('manager')} className="group relative bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all text-right flex flex-col items-start hover:-translate-y-1">
              <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <TrendingUp className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">لوحة الإدارة والمبيعات</h2>
              <p className="text-slate-500 mb-6">متابعة تقارير المبيعات، إحصائيات الفروع، والأرباح</p>
            </button>

            <button onClick={() => selectRole('pricing')} className="group relative bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all text-right flex flex-col items-start hover:-translate-y-1">
              <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                <Package className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">مسؤول الأسعار</h2>
              <p className="text-slate-500 mb-6">إضافة، تعديل، وحذف المنتجات وتحديث الأسعار</p>
            </button>

            <button onClick={() => selectRole('cashier')} className="group relative bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all text-right flex flex-col items-start hover:-translate-y-1">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Monitor className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">واجهة الكاشير</h2>
              <p className="text-slate-500 mb-6">استلام وتأكيد وإلغاء الطلبات وإصدار الفواتير</p>
            </button>

            <button onClick={() => selectRole('salesperson')} className="group relative bg-white/90 backdrop-blur-sm p-8 rounded-3xl border border-amber-100 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all text-right flex flex-col items-start hover:-translate-y-1">
              <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <Smartphone className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">واجهة البائع</h2>
              <p className="text-slate-500 mb-6">إنشاء طلبات وإرسالها ومتابعة مبيعاتي</p>
            </button>
          </div>

          <div className="mt-12 text-center">
            <button 
              onClick={handleLogout} 
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/90 backdrop-blur-sm text-red-600 border border-red-100 shadow-sm hover:bg-red-50 font-medium transition"
            >
              <LogOut className="w-5 h-5" /> تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!role) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen font-sans bg-slate-50/90 pharaonic-bg" dir="rtl">
      {showOwnerWelcome && <OwnerWelcome onDismiss={handleOwnerWelcomeDismiss} />}
      <Toaster position="top-center" richColors />
      
      <header className="bg-white/95 backdrop-blur-md border-b border-amber-100 h-16 flex items-center justify-between px-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 p-1.5 rounded-xl shadow-sm">
            <Logo />
          </div>
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-amber-700 to-amber-900 text-xl hidden sm:block tracking-wide">
            Carpet Land
          </span>
          {isOffline && (
            <div className="flex items-center gap-1 bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs font-bold mr-2">
              <WifiOff className="w-3 h-3" />
              مقطوع
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setCurrentTab('main')}
              className={`px-3 py-1.5 text-sm font-bold rounded-md transition ${currentTab === 'main' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              الرئيسية
            </button>
            <button
              onClick={() => setCurrentTab('shortages')}
              className={`px-3 py-1.5 text-sm font-bold rounded-md transition flex items-center gap-1 ${currentTab === 'shortages' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-red-500'}`}
            >
              <ClipboardList className="w-4 h-4" /> النواقص
            </button>
          </div>

          <div className="h-6 w-px bg-amber-200 hidden sm:block mx-1"></div>
          
          <div className="text-sm text-slate-500 hidden sm:block font-medium">
            {role === 'salesperson' ? 'بائع' : 
             role === 'cashier' ? 'كاشير' : 
             role === 'pricing' ? 'أسعار' : 
             role === 'admin' ? 'إدارة' : 
             role === 'audit' ? 'سجل' : 'مدير'}
          </div>
          
          {(isAdmin) && (
            <button 
              onClick={() => { setRole(null); setCurrentTab('main'); }}
              className="text-sm bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100 font-bold border border-amber-200 transition"
            >
              العودة للوحة
            </button>
          )}
          
          <button 
            onClick={handleLogout}
            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="h-[calc(100vh-64px)] overflow-y-auto">
        {currentTab === 'shortages' ? (
          <ShortagesView userBranchId={userBranchId} userName={user.user_metadata?.full_name || user.email} />
        ) : (
          <>
            {role === 'salesperson' && <SalespersonView userBranchId={userBranchId} />}
            {role === 'cashier' && <CashierView userBranchId={userBranchId} userRole={role} />}
            {role === 'manager' && <DashboardView userBranchId={userBranchId} />}
            {role === 'pricing' && <ProductManager />}
            {role === 'admin' && <UserManager />}
            {role === 'audit' && <AuditLogsView />}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
