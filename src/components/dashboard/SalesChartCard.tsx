import React from 'react';
import { BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { LoadingState } from '../ui/LoadingState';
import { SectionCard } from './DashboardUi';

export type SalesChartPoint = {
  name: string;
  sales: number;
};

interface SalesChartCardProps {
  chartContainerRef: React.RefObject<HTMLDivElement>;
  chartSize: { width: number; height: number };
  data: SalesChartPoint[];
  loading: boolean;
  hasRecentSales: boolean;
  formatMoney: (value: number) => string;
}

export const SalesChartCard: React.FC<SalesChartCardProps> = ({
  chartContainerRef,
  chartSize,
  data,
  loading,
  hasRecentSales,
  formatMoney,
}) => (
  <SectionCard title="منحنى المبيعات" subtitle="حركة آخر 7 أيام بشكل سريع وواضح." icon={TrendingUp}>
    <div ref={chartContainerRef} className="h-80 min-w-0">
      {chartSize.width > 0 && hasRecentSales ? (
        <BarChart width={chartSize.width} height={chartSize.height} data={data}>
          <defs>
            <linearGradient id="salesGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              borderRadius: '18px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 18px 40px rgba(15,23,42,0.12)',
            }}
            formatter={(value) => [formatMoney(Number(value || 0)), 'المبيعات']}
          />
          <Bar dataKey="sales" fill="url(#salesGradient)" radius={[12, 12, 4, 4]} barSize={34} />
        </BarChart>
      ) : loading ? (
        <LoadingState
          title="جاري تجهيز الرسم"
          subtitle="نجمع مؤشرات المبيعات ونبني نظرة سريعة للأداء."
          compact
          className="h-full min-h-[18rem]"
        />
      ) : (
        <div className="motion-fade-up flex h-full min-h-[18rem] flex-col items-center justify-center rounded-[1.9rem] border border-dashed border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-amber-50 text-amber-500 shadow-[0_18px_35px_-28px_rgba(245,158,11,0.55)]">
            <TrendingUp className="h-8 w-8" />
          </div>
          <h4 className="text-xl font-black text-slate-800">لا توجد مبيعات كافية لعرض المنحنى الآن</h4>
          <p className="mt-3 max-w-md text-sm font-bold leading-7 text-slate-500">
            أول ما تبدأ الفواتير المؤكدة في التحرك خلال آخر 7 أيام، سيظهر الرسم هنا تلقائيًا بشكل واضح.
          </p>
        </div>
      )}
    </div>
  </SectionCard>
);
