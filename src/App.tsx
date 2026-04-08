import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSafeSession, supabase, supabaseConfigError } from './supabase';
import { Branch, Profile, UserRole } from './types';
import { Users, Store, BarChart3, Package, ShoppingCart, History, ShieldAlert, LogOut, Menu, X, Building2, WifiOff } from 'lucide-react';
import { Toaster, toast } from 'sonner';

import UserManager from './components/UserManager';
import ProductManager from './components/ProductManager';
import DashboardView from './components/DashboardView';
import CashierView from './components/CashierView';
import SalespersonView from './components/SalespersonView';
import AuditLogsView from './components/AuditLogsView';
import ShortagesView from './components/ShortagesView';
import SalesHistory from './components/SalesHistory';
import Login from './components/Login';
import BrandMark from './components/BrandMark';

const TABS = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: BarChart3, roles: ['admin'] as UserRole[] },
  { id: 'pos', label: 'نظام البيع', icon: ShoppingCart, roles: ['admin', 'seller'] as UserRole[] },
  { id: 'cashier', label: 'نظام التحصيل', icon: Store, roles: ['admin', 'cashier'] as UserRole[] },
  { id: 'inventory', label: 'إدارة المنتجات', icon: Package, roles: ['admin'] as UserRole[] },
  { id: 'sales', label: 'سجل المبيعات', icon: History, roles: ['admin', 'cashier'] as UserRole[] },
  { id: 'shortages', label: 'النواقص', icon: ShieldAlert, roles: ['admin', 'seller', 'cashier'] as UserRole[] },
  { id: 'users', label: 'إدارة المستخدمين', icon: Users, roles: ['admin'] as UserRole[] },
  { id: 'audit', label: 'سجل العمليات', icon: History, roles: ['admin'] as UserRole[] },
];

const AUTH_BOOTSTRAP_TIMEOUT_MS = 6000;
const AUTH_BOOTSTRAP_TIMEOUT_MESSAGE = 'Timed out while restoring the current session.';
const PROFILE_LOAD_TIMEOUT_MS = 10000;
const PROFILE_LOAD_TIMEOUT_MESSAGE = 'Timed out while loading the current profile.';
const PROFILE_CACHE_KEY = 'carpet-land-profile-cache-v1';

const readCachedProfile = (userId: string): Profile | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;

    const cache = JSON.parse(raw) as Record<string, Profile>;
    return cache[userId] || null;
  } catch {
    return null;
  }
};

const writeCachedProfile = (profile: Profile) => {
  if (typeof window === 'undefined') return;

  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    const cache = raw ? (JSON.parse(raw) as Record<string, Profile>) : {};
    cache[profile.id] = profile;
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache write failures to keep auth flow resilient.
  }
};

const clearCachedProfile = (userId?: string | null) => {
  if (typeof window === 'undefined' || !userId) return;

  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return;

    const cache = JSON.parse(raw) as Record<string, Profile>;
    delete cache[userId];
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache cleanup failures.
  }
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const SetupErrorScreen: React.FC = () => (
  <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6" dir="rtl">
    <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl p-8 sm:p-10 shadow-2xl">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-6">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-black mb-3">إعدادات Supabase غير مكتملة</h1>
      <p className="text-slate-300 leading-8 mb-6">
        التطبيق لم يتمكن من البدء لأن متغيرات البيئة الخاصة بـ Supabase غير موجودة.
      </p>
      <div className="rounded-2xl bg-black/30 border border-white/10 p-5 mb-6">
        <p className="text-sm text-amber-300 font-bold mb-3">المتغيرات المطلوبة</p>
        <pre className="text-sm sm:text-base text-slate-100 whitespace-pre-wrap break-all">{`VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...`}</pre>
      </div>
      <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-5 mb-6">
        <p className="text-sm text-slate-300 font-bold mb-2">رسالة النظام</p>
        <p className="text-sm text-slate-400 break-words">{supabaseConfigError}</p>
      </div>
      <ol className="text-slate-300 space-y-2 text-sm sm:text-base">
        <li>1. أنشئ ملفًا باسم <code className="text-amber-300">.env.local</code>.</li>
        <li>2. أضف قيم <code className="text-amber-300">VITE_SUPABASE_URL</code> و<code className="text-amber-300">VITE_SUPABASE_ANON_KEY</code>.</li>
        <li>3. أعد تشغيل <code className="text-amber-300">npm run dev</code>.</li>
      </ol>
    </div>
  </div>
);

const App: React.FC = () => {
  if (supabaseConfigError) {
    return <SetupErrorScreen />;
  }

  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFeatureEnabled, setBranchFeatureEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const authStateHandledRef = useRef(false);
  const profileRef = useRef<Profile | null>(null);
  const networkStateRef = useRef(isOnline);

  const role = profile?.role || 'seller';
  const allowedTabs = useMemo(() => TABS.filter((tab) => tab.roles.includes(role as UserRole)), [role]);
  const currentBranch = useMemo(() => branches.find((branch) => branch.id === profile?.branch_id) || null, [branches, profile?.branch_id]);
  const isAdminEmail = (email?: string | null) => email === 'admin@carpetland.com' || email === 'sayed@carpetland.com';
  const buildFallbackProfile = (userId: string, email: string): Profile => ({
    id: userId,
    email,
    full_name: isAdminEmail(email) ? 'المدير العام' : 'مستخدم النظام',
    role: isAdminEmail(email) ? 'admin' : 'seller',
    branch_id: null,
    is_approved: true,
    is_active: true,
    created_at: new Date().toISOString(),
  });

  useEffect(() => {
    profileRef.current = profile;
    if (profile) writeCachedProfile(profile);
  }, [profile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      if (!networkStateRef.current) {
        toast.success('عاد الاتصال بالإنترنت. يتم تحديث البيانات الآن.');
      }
      networkStateRef.current = true;
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (networkStateRef.current) {
        toast.warning('أنت الآن دون اتصال. بعض العمليات ستتأخر حتى يعود الإنترنت.');
      }
      networkStateRef.current = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!isMounted) return;

      authStateHandledRef.current = true;
      setSession(nextSession);

      if (nextSession) {
        const currentProfile = profileRef.current;
        const shouldRefreshProfile =
          !currentProfile ||
          currentProfile.id !== nextSession.user.id ||
          event === 'USER_UPDATED';

        if (shouldRefreshProfile) {
          if (!currentProfile || currentProfile.id !== nextSession.user.id) {
            setLoading(true);
          }

          await fetchProfile(nextSession.user);
        } else {
          setLoading(false);
        }

        void fetchBranches();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const bootstrapAuth = async () => {
      try {
        const session = await withTimeout(getSafeSession(), AUTH_BOOTSTRAP_TIMEOUT_MS, AUTH_BOOTSTRAP_TIMEOUT_MESSAGE);

        if (!isMounted || authStateHandledRef.current) return;

        setSession(session);
        if (session) {
          const cachedProfile = readCachedProfile(session.user.id);

          if (cachedProfile) {
            setProfile(cachedProfile);
            setLoading(false);
            void fetchProfile(session.user);
          } else {
            setLoading(true);
            await fetchProfile(session.user);
          }

          void fetchBranches();
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        const isSessionTimeout = err instanceof Error && err.message === AUTH_BOOTSTRAP_TIMEOUT_MESSAGE;
        if (!isSessionTimeout) {
          console.error('Error restoring session:', err);
        }
        if (!isMounted || authStateHandledRef.current) return;
        setSession(null);
        setProfile(null);
        setLoading(false);
        if (!isSessionTimeout) {
          toast.error('تعذر استعادة الجلسة الحالية. يمكنك تسجيل الدخول يدويًا.');
        }
      }
    };

    bootstrapAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (profile && !allowedTabs.find((tab) => tab.id === activeTab)) {
      setActiveTab(allowedTabs[0]?.id || 'pos');
    }
  }, [profile, activeTab, allowedTabs]);

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase.from('branches').select('id, name, slug, is_active').eq('is_active', true).order('name');

      if (error) {
        console.warn('Branch system not available yet:', error.message);
        setBranchFeatureEnabled(false);
        setBranches([]);
        return;
      }

      setBranches((data || []) as Branch[]);
      setBranchFeatureEnabled(true);
    } catch (err) {
      console.warn('Branch system not available yet:', err);
      setBranchFeatureEnabled(false);
      setBranches([]);
    }
  };

  const fetchProfile = async (user: { id: string; email?: string | null }) => {
    const email = user.email || '';
    const adminUser = isAdminEmail(email);
    const currentProfile = profileRef.current;
    const cachedProfile = currentProfile?.id === user.id ? currentProfile : readCachedProfile(user.id);

    try {
      const { data, error } = await withTimeout(
        Promise.resolve(supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()),
        PROFILE_LOAD_TIMEOUT_MS,
        PROFILE_LOAD_TIMEOUT_MESSAGE
      );

      if (error) {
        throw error;
      }

      if (!data) {
        if (adminUser) {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email,
              role: 'admin',
              full_name: 'المدير العام',
              is_approved: true,
              is_active: true,
            })
            .select()
            .single();

          if (insertError) throw insertError;
          if (newProfile) setProfile(newProfile as Profile);
          return;
        }

        throw new Error('لم يتم العثور على ملف المستخدم. يجب أن يقوم المدير بإنشاء الحساب أو تفعيله أولًا.');
      }

      setProfile(data as Profile);
    } catch (err: any) {
      const isProfileTimeout = err instanceof Error && err.message === PROFILE_LOAD_TIMEOUT_MESSAGE;

      if (adminUser) {
        setProfile(buildFallbackProfile(user.id, email));
        return;
      }

      if (isProfileTimeout && cachedProfile && cachedProfile.id === user.id) {
        setProfile(cachedProfile);
        return;
      }

      if (!isProfileTimeout) {
        console.error('Error fetching profile:', err);
      }

      clearCachedProfile(user.id);
      toast.error(`خطأ في تحميل بيانات الملف الشخصي: ${err.message || 'Error'}`);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearCachedProfile(session?.user?.id || profile?.id);
    setProfile(null);
    toast.success('تم تسجيل الخروج بنجاح');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-bold">جاري تحميل النظام...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Login />;

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border text-center">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-4">الملف الشخصي غير موجود</h1>
          <p className="text-slate-500 mb-8">تم تسجيل دخولك ولكن لم يتم العثور على ملفك الشخصي. يرجى التواصل مع الإدارة.</p>
          <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2">
            <LogOut className="w-5 h-5" /> تسجيل خروج
          </button>
        </div>
      </div>
    );
  }

  if (!profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border text-center">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-4">الحساب موقوف</h1>
          <p className="text-slate-500 mb-8">تم تعليق هذا الحساب من الإدارة. يرجى التواصل مع المدير لإعادة التفعيل.</p>
          <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2">
            <LogOut className="w-5 h-5" /> تسجيل خروج
          </button>
        </div>
      </div>
    );
  }

  if (!profile.is_approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border text-center">
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-10 h-10 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-4">حسابك قيد المراجعة</h1>
          <p className="text-slate-500 mb-8">
            أهلًا بك يا <b>{profile.full_name}</b>. يجب على المدير تفعيل حسابك أولًا.
          </p>
          <button onClick={handleLogout} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2">
            <LogOut className="w-5 h-5" /> تسجيل خروج
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'pos':
        return <SalespersonView branchId={profile.branch_id} branchName={currentBranch?.name} branchEnabled={branchFeatureEnabled} />;
      case 'cashier':
        return <CashierView branchId={profile.branch_id} branchName={currentBranch?.name} branchEnabled={branchFeatureEnabled} />;
      case 'inventory':
        return <ProductManager />;
      case 'sales':
        return <SalesHistory branchId={profile.branch_id} branchEnabled={branchFeatureEnabled} isAdmin={profile.role === 'admin'} />;
      case 'users':
        return <UserManager />;
      case 'audit':
        return <AuditLogsView />;
      case 'shortages':
        return <ShortagesView userName={profile.full_name} branchId={profile.branch_id} branchName={currentBranch?.name} branchEnabled={branchFeatureEnabled} />;
      default:
        return null;
    }
  };

  const roleName = role === 'admin' ? 'المدير العام' : role === 'seller' ? 'بائع' : 'كاشير';

  return (
    <div className="pharaonic-shell min-safe-screen flex flex-col sm:flex-row overflow-hidden" dir="rtl">
      <Toaster position="top-center" richColors />

      <aside className="hidden sm:flex flex-col w-72 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-2xl z-50">
        <div className="p-8 border-b border-white/5 bg-white/5">
          <BrandMark title="Carpet Land" subtitle="CARPETS • HOME TEXTILES" />
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {allowedTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-bold transition-all ${
                activeTab === tab.id ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/25' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-slate-500'}`} />
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/5 space-y-4">
          <div className="px-4 py-3 bg-white/5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-black ring-2 ring-amber-500/30">
                {profile.full_name?.[0] || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-black truncate">{profile.full_name}</p>
                <p className="text-[10px] text-slate-500 font-bold truncate">{profile.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded-md text-[9px] font-black uppercase">{roleName}</span>
              {branchFeatureEnabled && currentBranch && (
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-md text-[9px] font-black flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {currentBranch.name}
                </span>
              )}
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-bold text-red-400 hover:bg-red-400/10 transition-all">
            <LogOut className="w-5 h-5" />
            <span className="text-sm">خروج آمن</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-safe-screen sm:h-screen overflow-hidden relative">
        <header className="sm:hidden sticky top-0 bg-slate-900 text-white p-4 flex items-center justify-between shadow-lg z-50 safe-area-top safe-area-x">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 bg-white/10 rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
            <BrandMark iconOnly className="gap-0" />
            <h1 className="text-lg font-black tracking-tight">كاربت لاند</h1>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center font-black text-xs">{profile.full_name?.[0]}</div>
        </header>

        {!isOnline && (
          <div className="mx-3 mt-3 sm:mx-6 sm:mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 flex items-center gap-2 shadow-sm">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>الاتصال بالإنترنت غير متاح الآن. يمكنك التصفح، لكن العمليات الجديدة قد لا تُحفظ حتى يعود الاتصال.</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-[#fafbfc] safe-area-bottom">{renderContent()}</div>

        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] sm:hidden" onClick={() => setMobileMenuOpen(false)}>
            <div className="w-[min(22rem,100vw)] h-full bg-slate-900 border-l border-white/5 p-6 safe-area-top safe-area-bottom" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-2xl font-black text-white">القائمة</h2>
                  {branchFeatureEnabled && currentBranch && <p className="text-[11px] font-black text-blue-300 mt-1">{currentBranch.name}</p>}
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-white/10 rounded-xl text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="space-y-2">
                {allowedTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${
                      activeTab === tab.id ? 'bg-amber-500 text-white shadow-xl' : 'text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                ))}
              </nav>
              <button onClick={handleLogout} className="w-full mt-8 flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-red-400 hover:bg-red-400/10">
                <LogOut className="w-5 h-5" /> خروج آمن
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;


