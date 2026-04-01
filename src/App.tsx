import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Profile, UserRole } from './types';
import { Layout, Users, Store, BarChart3, Package, ShoppingCart, History, ShieldAlert, LogOut, Settings, Bell, Menu, X, ArrowLeft, Store as BranchIcon, UserCheck, ShieldCheck, Clock } from 'lucide-react';
import { Toaster, toast } from 'sonner';

// Components
import UserManager from './components/UserManager';
import ProductManager from './components/ProductManager';
import DashboardView from './components/DashboardView';
import CashierView from './components/CashierView';
import SalespersonView from './components/SalespersonView';
import AuditLogsView from './components/AuditLogsView';
import ShortagesView from './components/ShortagesView';
import OwnerWelcome from './components/OwnerWelcome';
import Login from './components/Login';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSplash, setShowSplash] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (data) {
        setProfile(data as Profile);
        // Default tabs based on role
        if (data.role === 'seller') setActiveTab('pos');
        else if (data.role === 'cashier') setActiveTab('cashier');
        else if (data.role === 'price_manager') setActiveTab('inventory');
        else setActiveTab('dashboard');
      } else if (session?.user?.email === 'sayed@carpetland.com') {
        // Master Admin Bypass: Synthesis an admin profile in memory if DB fails
        console.log('Master Admin Bypass Activated');
        setProfile({
          id: userId,
          email: session.user.email,
          full_name: 'Sayed Admin (Master Bypass)',
          role: 'admin',
          is_approved: true,
          is_active: true,
          created_at: new Date().toISOString(),
          branch_id: null
        });
        setActiveTab('dashboard');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      // Fallback for Master Admin even on network error
      if (session?.user?.email === 'sayed@carpetland.com') {
        setProfile({
          id: userId,
          email: session.user.email,
          full_name: 'Sayed Admin (Network Fallback)',
          role: 'admin',
          is_approved: true,
          is_active: true,
          created_at: new Date().toISOString(),
          branch_id: null
        });
      } else {
        toast.error('خطأ في تحميل بيانات الملف الشخصي');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSplashFinish = () => setShowSplash(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('تم تسجيل الخروج بنجاح');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 pharaonic-bg">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-bold">جاري تحميل النظام...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Login />;
  
  if (!profile && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 pharaonic-bg p-4" dir="rtl">
        <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl border border-red-100 text-center relative overflow-hidden">
           <div className="absolute top-0 inset-x-0 h-2 bg-red-500"></div>
           <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
             <ShieldAlert className="w-10 h-10" />
           </div>
           <h1 className="text-2xl font-black text-slate-800 mb-4">الملف الشخصي غير مفقود</h1>
           <p className="text-slate-500 font-medium mb-8 leading-relaxed">
             نعتذر منك. لقد تم تسجيل دخولك ولكن لم يتم العثور على ملفك الشخصي في قاعدة البيانات. برجاء التواصل مع الإدارة.
           </p>
           <button 
             onClick={handleLogout}
             className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2"
           >
             <LogOut className="w-5 h-5" /> تسجيل خروج
           </button>
        </div>
      </div>
    );
  }

  if (showSplash) {
    return <OwnerWelcome onFinish={handleSplashFinish} />;
  }

  // Mandatory Approval Check (Task 7)
  if (profile && !profile.is_approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 pharaonic-bg p-4" dir="rtl">
        <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl border border-amber-100 text-center relative overflow-hidden">
           <div className="absolute top-0 inset-x-0 h-2 bg-amber-500"></div>
           <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
             <Clock className="w-10 h-10 animate-pulse" />
           </div>
           <h1 className="text-2xl font-black text-slate-800 mb-4">حسابك قيد المراجعة</h1>
           <p className="text-slate-500 font-medium mb-8 leading-relaxed">
             أهلاً بك يا <b>{profile.full_name}</b>. لقد تم تسجيل حسابك بنجاح، ولكن يجب على المدير العام تفعيل حسابك كـ <b>{profile.role}</b> قبل أن تتمكن من العمل.
           </p>
           <button 
             onClick={handleLogout}
             className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2"
           >
             <LogOut className="w-5 h-5" /> تسجيل خروج
           </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'الإحصائيات', icon: BarChart3, roles: ['admin', 'branch_manager'] },
    { id: 'pos', label: 'نظام البيع', icon: ShoppingCart, roles: ['admin', 'branch_manager', 'seller'] },
    { id: 'cashier', label: 'نظام التحصيل', icon: Store, roles: ['admin', 'branch_manager', 'cashier'] },
    { id: 'inventory', label: 'المخزن والأسعار', icon: Package, roles: ['admin', 'branch_manager', 'price_manager'] },
    { id: 'shortages', label: 'النواقص', icon: ShieldAlert, roles: ['admin', 'branch_manager', 'seller', 'cashier'] },
    { id: 'users', label: 'الموظفين والفروع', icon: Users, roles: ['admin'] },
    { id: 'audit', label: 'سجل العمليات', icon: History, roles: ['admin', 'branch_manager'] },
  ];

  const role = profile?.role || 'seller';
  const allowedTabs = tabs.filter(tab => tab.roles.includes(role as any));

  useEffect(() => {
    if (profile && !allowedTabs.find(t => t.id === activeTab)) {
      setActiveTab(allowedTabs[0]?.id || 'pos');
    }
  }, [profile, activeTab, allowedTabs]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView userBranchId={profile?.branch_id} />;
      case 'pos': return <SalespersonView />;
      case 'cashier': return <CashierView />;
      case 'inventory': return <ProductManager />;
      case 'users': return <UserManager />;
      case 'audit': return <AuditLogsView />;
      case 'shortages': return <ShortagesView userName={profile?.full_name || ''} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col sm:flex-row overflow-hidden" dir="rtl">
      <Toaster position="top-center" richColors />

      {/* Sidebar - Desktop */}
      <aside className="hidden sm:flex flex-col w-72 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-2xl z-50">
        <div className="p-8 border-b border-white/5 bg-white/5 backdrop-blur-md">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
               <Store className="w-6 h-6 text-white" />
             </div>
             <div>
               <h1 className="text-xl font-black tracking-wider">CARPET LAND</h1>
               <span className="text-[10px] text-amber-500 font-black tracking-[2.5px] uppercase">ERP Suite v4.0</span>
             </div>
           </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {allowedTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-bold transition-all ${
                activeTab === tab.id ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/25 ring-1 ring-white/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-slate-500'}`} />
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-4">
           <div className="px-4 py-3 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-black ring-2 ring-amber-500/30">
                  {profile?.full_name?.[0] || 'U'}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-black truncate">{profile?.full_name}</p>
                  <p className="text-[10px] text-slate-500 font-bold truncate">{profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded-md text-[9px] font-black uppercase">
                  {profile?.role === 'admin' ? 'المدير العام / Admin' : 
                   profile?.role === 'branch_manager' ? 'مدير فرع' : 
                   profile?.role === 'seller' ? 'بائع' : 
                   profile?.role === 'cashier' ? 'كاشير' : 'مسؤول الأسعار'}
                </span>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-500 rounded-md text-[9px] font-black uppercase">
                  ACTIVE
                </span>
              </div>
           </div>
           
           <button
             onClick={handleLogout}
             className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-bold text-red-400 hover:bg-red-400/10 transition-all border border-transparent hover:border-red-400/20"
           >
             <LogOut className="w-5 h-5" />
             <span className="text-sm">خروج آمن</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
         {/* Top Header Mobile */}
         <header className="sm:hidden bg-slate-900 text-white p-4 flex items-center justify-between shadow-lg z-50">
            <div className="flex items-center gap-3">
               <button onClick={() => setMobileMenuOpen(true)} className="p-2 bg-white/10 rounded-lg">
                 <Menu className="w-6 h-6" />
               </button>
               <h1 className="text-lg font-black tracking-tight">Carpet Land</h1>
            </div>
            <div className="flex items-center gap-4">
               <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center font-black text-xs">A</div>
            </div>
         </header>

         <div className="flex-1 overflow-y-auto bg-[#fafbfc] pharaonic-pattern">
            {renderContent()}
         </div>

         {/* Mobile Menu Overlay */}
         {mobileMenuOpen && (
           <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] sm:hidden" onClick={() => setMobileMenuOpen(false)}>
             <div className="w-80 h-full bg-slate-900 border-l border-white/5 p-6 animate-slide-left shadow-2xl" onClick={e => e.stopPropagation()}>
               <div className="flex items-center justify-between mb-10">
                 <h2 className="text-2xl font-black text-white">القائمة</h2>
                 <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-white/10 rounded-xl text-white">
                   <X className="w-6 h-6" />
                 </button>
               </div>
               <nav className="space-y-2">
                 {allowedTabs.map(tab => (
                   <button
                     key={tab.id}
                     onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                     className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${
                       activeTab === tab.id ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/25' : 'text-slate-400 hover:bg-white/5'
                     }`}
                   >
                     <tab.icon className="w-5 h-5" />
                     {tab.label}
                   </button>
                 ))}
               </nav>
             </div>
           </div>
         )}
      </main>

      <style>{`
        .pharaonic-pattern {
          background-image: 
            radial-gradient(circle at 2px 2px, rgba(217,119,6,0.03) 1px, transparent 0);
          background-size: 24px 24px;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        @keyframes slide-left {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-left {
          animation: slide-left 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default App;
