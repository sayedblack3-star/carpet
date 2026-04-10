import React from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';

interface LoadingStateProps {
  title: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
}

interface LoadingCardGridProps {
  count?: number;
  minHeightClassName?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ title, subtitle, compact = false, className = '' }) => {
  return (
    <div
      className={`loading-shell ${compact ? 'rounded-[1.75rem] px-5 py-6' : 'rounded-[2rem] px-6 py-8'} ${className}`}
      dir="rtl"
    >
      <div className="flex flex-col items-center justify-center text-center">
        <div className="loading-orb mb-4">
          <LoaderCircle className="h-8 w-8 animate-spin text-amber-500" />
          <span className="loading-orb-ping" />
          <span className="loading-orb-dot">
            <Sparkles className="h-3 w-3" />
          </span>
        </div>
        <p className={`${compact ? 'text-base' : 'text-lg'} font-black text-slate-800`}>{title}</p>
        {subtitle ? <p className="mt-2 max-w-md text-sm font-bold leading-6 text-slate-500">{subtitle}</p> : null}
        <div className="mt-4 flex items-center gap-1.5">
          <span className="loading-dot" />
          <span className="loading-dot loading-dot-delay-1" />
          <span className="loading-dot loading-dot-delay-2" />
        </div>
      </div>
    </div>
  );
};

export const LoadingCardGrid: React.FC<LoadingCardGridProps> = ({ count = 4, minHeightClassName = 'h-40', className = '' }) => {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`loading-card-skeleton ${minHeightClassName}`}>
          <div className="loading-line h-3 w-24" />
          <div className="mt-5 loading-line h-9 w-2/3" />
          <div className="mt-3 loading-line h-3 w-1/2" />
          <div className="mt-8 flex items-center justify-between">
            <div className="loading-line h-10 w-10 rounded-2xl" />
            <div className="loading-line h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
};
