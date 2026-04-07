import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from './supabase';
import { Profile, UserRole } from './types';
import { Users, Store, BarChart3, Package, ShoppingCart, History, ShieldAlert, LogOut, Menu, X } from 'lucide-react';
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

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const role = profile?.role || 'seller';
  const allowedTabs = useMemo(() => TABS.filter(tab => tab.roles.includes(role as UserRole)), [role]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (profile && !allowedTabs.find(t => t.id === activeTab)) {
      const defaultTab = allowedTabs[0]?.id || 'pos';
      setActiveTab(defaultTab);
    }
  }, [profile, activeTab, allowedTabs]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

      if (error) {
        // PGRST116 means zero rows returned from .single()
        if (error.code === 'PGRST116') {
          console.log('Profile not found, attempting to auto-create...');
          const { data: authData } = await supabase.auth.getUser();
          const email = authData.user?.email || '';
          // Ensure the master admin account operates correctly even if trigger failed
          const isAdmin = email === 'admin@carpetland.com' || email === 'sayed@carpetland.com';
          const newRole = isAdmin ? 'admin' : 'seller';
          
          const { data: newProfile, error: insertError } = await supabase.from('profiles').insert({
            id: userId,
            email: email,
            role: newRole,
            full_name: isAdmin ? 'المدير العام' : 'مستخدم جديد',
            is_approved: isAdmin,
            is_active: true
          }).select().single();

          if (insertError) throw insertError;

          if (newProfile) {
            setProfile(newProfile as Profile);
            setActiveTab(isAdmin ? 'dashboard' : 'pos');
          }
          return;
        }
        
        throw error;
      }

      if (data) {
        setProfile(data as Profile);
        if (data.role === 'seller') setActiveTab('pos');
        else if (data.role === 'cashier') setActiveTab('cashier');
        else setActiveTab('dashboard');
      } else {
        setProfile(null);
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      toast.error('خطأ في تحميل بيانات الملف الشخصي: ' + (err.message || 'Error'));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
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

  if (!profile.is_approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border text-center">
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-10 h-10 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-4">حسابك قيد المراجعة</h1>
          <p className="text-slate-500 mb-8">
            أهلاً بك يا <b>{profile.full_name}</b>. يجب على المدير تفعيل حسابك. يرجى الانتظار.
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
      case 'dashboard': return <DashboardView />;
      case 'pos': return <SalespersonView />;
      case 'cashier': return <CashierView />;
      case 'inventory': return <ProductManager />;
      case 'sales': return <SalesHistory />;
      case 'users': return <UserManager />;
      case 'audit': return <AuditLogsView />;
      case 'shortages': return <ShortagesView userName={profile.full_name} />;
      default: return null;
    }
  };

  const roleName = role === 'admin' ? 'المدير العام' : role === 'seller' ? 'بائع' : 'كاشير';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col sm:flex-row overflow-hidden" dir="rtl">
      <Toaster position="top-center" richColors />
      {/* Sidebar Desktop */}
      <aside className="hidden sm:flex flex-col w-72 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-2xl z-50">
        <div className="p-8 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wider">CARPET LAND</h1>
              <span className="text-[10px] text-amber-500 font-black tracking-[2.5px] uppercase">ERP v5.0</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {allowedTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === tab.id ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/25' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-slate-500'}`} />
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/5 space-y-4">
          <div className="px-4 py-3 bg-white/5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-black ring-2 ring-amber-500/30">
                {profile.full_name?.[0] || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-black truncate">{profile.full_name}</p>
                <p className="text-[10px] text-slate-500 font-bold truncate">{profile.email}</p>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded-md text-[9px] font-black uppercase">{roleName}</span>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-bold text-red-400 hover:bg-red-400/10 transition-all">
            <LogOut className="w-5 h-5" /><span className="text-sm">خروج آمن</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="sm:hidden bg-slate-900 text-white p-4 flex items-center justify-between shadow-lg z-50">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 bg-white/10 rounded-lg"><Menu className="w-6 h-6" /></button>
            <h1 className="text-lg font-black tracking-tight">Carpet Land</h1>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center font-black text-xs">{profile.full_name?.[0]}</div>
        </header>
        <div className="flex-1 overflow-y-auto bg-[#fafbfc]">{renderContent()}</div>
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] sm:hidden" onClick={() => setMobileMenuOpen(false)}>
            <div className="w-80 h-full bg-slate-900 border-l border-white/5 p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-black text-white">القائمة</h2>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-white/10 rounded-xl text-white"><X className="w-6 h-6" /></button>
              </div>
              <nav className="space-y-2">
                {allowedTabs.map(tab => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === tab.id ? 'bg-amber-500 text-white shadow-xl' : 'text-slate-400 hover:bg-white/5'}`}>
                    <tab.icon className="w-5 h-5" />{tab.label}
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
