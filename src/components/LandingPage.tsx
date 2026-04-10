import React from 'react';
import { ArrowLeft, BarChart3, MonitorSmartphone, ShieldCheck, ShoppingCart, Store, Users } from 'lucide-react';
import BrandMark from './BrandMark';
import { appClient } from '../config/appClient';

interface LandingPageProps {
  onLogin: () => void;
}

const features = [
  {
    icon: ShoppingCart,
    title: 'نقطة بيع أسرع',
    description: 'إنشاء الطلبات بسرعة، إرسالها للكاشير، ومتابعة التنفيذ لحظة بلحظة داخل نفس النظام.',
  },
  {
    icon: Store,
    title: 'تحصيل وورديات',
    description: 'إدارة الكاشير والورديات والتحصيل والطباعة بشكل منظم يناسب التشغيل اليومي داخل الفروع.',
  },
  {
    icon: Users,
    title: 'صلاحيات ومستخدمون',
    description: 'أدمن، بائع، وكاشير بصلاحيات واضحة حتى كل شخص يشوف فقط ما يخص شغله.',
  },
  {
    icon: BarChart3,
    title: 'لوحة تحكم وتقارير',
    description: 'متابعة المبيعات والفروع والمنتجات والأداء العام من واجهة واحدة واضحة وسريعة.',
  },
];

const platformCards = [
  { title: 'Web', description: 'للإدارة والمتابعة من أي متصفح.' },
  { title: 'Desktop', description: 'تشغيل ثابت داخل الفروع للكاشير والإدارة.' },
  { title: 'Mobile', description: 'سرعة ومرونة للبائع أو التشغيل الميداني.' },
];

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  return (
    <div className="min-safe-screen relative overflow-hidden bg-[#110904] text-white" dir="rtl">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at top right, rgba(245,158,11,0.24), transparent 26%), radial-gradient(circle at bottom left, rgba(120,53,15,0.35), transparent 28%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 22px)',
          backgroundSize: '30px 30px',
        }}
      />

      <div className="relative z-10 mx-auto flex min-safe-screen w-full max-w-[1440px] flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex items-center justify-between rounded-[2rem] border border-white/10 bg-white/[0.05] px-4 py-4 backdrop-blur-2xl sm:px-6">
          <BrandMark title={appClient.companyNameEn} subtitle={appClient.tagline} />
          <button
            onClick={onLogin}
            className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            دخول النظام
          </button>
        </header>

        <main className="flex-1 py-8 sm:py-10 lg:py-12">
          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
            <div className="rounded-[2.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)] backdrop-blur-3xl sm:p-8 lg:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs font-black tracking-[0.18em] text-amber-100">
                <ShieldCheck className="h-4 w-4 text-amber-300" />
                {appClient.systemName.toUpperCase()}
              </div>

              <h1 className="mt-6 text-4xl font-black leading-[1.2] text-white sm:text-5xl lg:text-6xl">
                نظام موحد لإدارة البيع والتشغيل والتحصيل داخل فروع
                <span className="text-amber-300"> {appClient.companyNameAr}</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base font-bold leading-8 text-white/72 sm:text-lg">
                سيستم واحد يجمع الإدارة، البائع، والكاشير على نفس قاعدة البيانات ونفس الصلاحيات، مع
                تشغيل متكامل على الويب والديسكتوب والموبايل.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={onLogin}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-amber-500/25 transition hover:bg-amber-400"
                >
                  دخول النظام
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-5 py-3 text-sm font-bold text-white/75">
                  مناسب للمحلات والفروع والإدارة المركزية
                </span>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {features.map((feature) => (
                  <div key={feature.title} className="rounded-[1.8rem] border border-white/8 bg-black/20 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <feature.icon className="h-5 w-5 text-amber-300" />
                      <span className="text-[11px] font-black text-white/45">ميزة تشغيلية</span>
                    </div>
                    <h2 className="text-xl font-black text-white">{feature.title}</h2>
                    <p className="mt-3 text-sm font-bold leading-7 text-white/65">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5">
              <div className="rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-slate-900/80 to-black/60 p-6 backdrop-blur-3xl sm:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-white/45">إدارة ذكية للفروع</p>
                    <h2 className="mt-2 text-3xl font-black text-white">نفس النظام على كل المنصات</h2>
                  </div>
                  <div className="rounded-[1.4rem] bg-amber-500/10 p-4 text-amber-300">
                    <MonitorSmartphone className="h-7 w-7" />
                  </div>
                </div>

                <div className="grid gap-4">
                  {platformCards.map((card) => (
                    <div key={card.title} className="rounded-[1.7rem] border border-white/8 bg-white/[0.04] p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-white">{card.title}</h3>
                        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-black text-amber-200">
                          جاهز
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-bold leading-7 text-white/65">{card.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2.5rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-3xl sm:p-8">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[1.6rem] border border-white/8 bg-black/20 p-5 text-center">
                    <p className="text-4xl font-black text-amber-300">3</p>
                    <p className="mt-2 text-sm font-black text-white">منصات تشغيل</p>
                  </div>
                  <div className="rounded-[1.6rem] border border-white/8 bg-black/20 p-5 text-center">
                    <p className="text-4xl font-black text-amber-300">9</p>
                    <p className="mt-2 text-sm font-black text-white">فروع نشطة مجربة</p>
                  </div>
                  <div className="rounded-[1.6rem] border border-white/8 bg-black/20 p-5 text-center">
                    <p className="text-4xl font-black text-amber-300">1</p>
                    <p className="mt-2 text-sm font-black text-white">قاعدة بيانات موحدة</p>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.8rem] border border-amber-400/10 bg-amber-500/10 p-5">
                  <p className="text-sm font-black text-amber-100">جاهز للتشغيل والتوسع</p>
                  <p className="mt-3 text-sm font-bold leading-7 text-white/75">
                    النظام مصمم ليخدم الإدارة اليومية داخل الفروع ويقلل الأخطاء ويوحّد دورة البيع من
                    أول إنشاء الطلب حتى التحصيل والمتابعة.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default LandingPage;
