import React from 'react';

interface BrandMarkProps {
  className?: string;
  iconOnly?: boolean;
  title?: string;
  subtitle?: string;
}

const BrandMark: React.FC<BrandMarkProps> = ({
  className = '',
  iconOnly = false,
  title = 'كاربت لاند',
  subtitle = 'للسجاد والمفروشات',
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`} dir="rtl">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-[1.6rem] border border-amber-300/30 bg-[linear-gradient(145deg,#f59e0b_0%,#d97706_45%,#6b3410_100%)] shadow-[0_20px_45px_-24px_rgba(245,158,11,0.85)]">
        <svg viewBox="0 0 100 100" className="h-10 w-10" aria-hidden="true">
          <defs>
            <linearGradient id="carpet-land-rug" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="55%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>
          <path d="M15 73C35 88 65 88 85 73L78 58C59 69 41 69 22 58L15 73Z" fill="url(#carpet-land-rug)" />
          <path d="M18 69H82M22 64H78M25 59H75" stroke="#fff3c4" strokeDasharray="4 3" strokeLinecap="round" strokeWidth="2" />
          <path d="M16 73L10 82M24 78L18 87M34 82L28 90M46 85L40 92M58 85L52 92M70 82L64 90M80 78L74 87M88 73L82 82" stroke="#fcd34d" strokeLinecap="round" strokeWidth="3" />
          <polygon points="50,15 68,55 32,55" fill="#f8c34b" />
          <polygon points="50,15 68,55 50,55" fill="#d97706" />
          <polygon points="28,31 40,55 16,55" fill="#fde68a" />
          <polygon points="28,31 40,55 28,55" fill="#f59e0b" />
          <polygon points="72,31 84,55 60,55" fill="#fde68a" />
          <polygon points="72,31 84,55 72,55" fill="#f59e0b" />
        </svg>
        <div className="absolute inset-x-3 bottom-2 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      </div>

      {!iconOnly && (
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black tracking-tight text-white">{title}</h1>
          <p className="truncate text-[11px] font-bold tracking-[0.25em] text-amber-300/80">{subtitle}</p>
        </div>
      )}
    </div>
  );
};

export default BrandMark;
