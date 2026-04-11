import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export type StatTone = 'blue' | 'emerald' | 'amber' | 'slate' | 'rose';

const toneStyles: Record<StatTone, string> = {
  blue: 'border-blue-100 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  slate: 'border-slate-200 bg-slate-100 text-slate-700',
  rose: 'border-rose-100 bg-rose-50 text-rose-700',
};

type StatTileProps = {
  icon: React.ElementType;
  title: string;
  value: string;
  caption: string;
  tone: StatTone;
  trend?: string;
};

export const StatTile: React.FC<StatTileProps> = ({ icon: Icon, title, value, caption, tone, trend }) => (
  <div className="motion-fade-up motion-soft-lift motion-glow relative overflow-hidden rounded-[2rem] border border-white/70 bg-white p-5 shadow-[0_18px_45px_-26px_rgba(15,23,42,0.35)]">
    <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-l from-transparent via-slate-200 to-transparent" />
    <div className="flex items-start justify-between gap-4">
      <div className={`flex h-14 w-14 items-center justify-center rounded-[1.4rem] border ${toneStyles[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      {trend ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-600">
          <ArrowUpRight className="h-3.5 w-3.5" />
          {trend}
        </span>
      ) : null}
    </div>
    <div className="mt-5">
      <p className="text-xs font-black tracking-[0.18em] text-slate-400">{title}</p>
      <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-2 text-sm font-bold text-slate-500">{caption}</p>
    </div>
  </div>
);

export const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}> = ({ title, subtitle, icon: Icon, children }) => (
  <section className="motion-fade-up motion-fade-up-delay-1 rounded-[2.2rem] border border-white/70 bg-white p-5 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.28)] sm:p-7">
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h3 className="flex items-center gap-2 text-xl font-black text-slate-900">
          <Icon className="h-5 w-5 text-amber-500" />
          {title}
        </h3>
        {subtitle ? <p className="mt-2 text-sm font-bold text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
    {children}
  </section>
);

export const ReportMetric: React.FC<{
  label: string;
  value: string;
  helper: string;
  tone?: StatTone;
}> = ({ label, value, helper, tone = 'slate' }) => (
  <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50 p-4">
    <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.16em] ${toneStyles[tone]}`}>{label}</div>
    <p className="mt-4 text-2xl font-black text-slate-900">{value}</p>
    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{helper}</p>
  </div>
);

