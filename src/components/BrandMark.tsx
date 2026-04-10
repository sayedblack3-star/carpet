import React from 'react';
import { getRuntimePlatform, resolveRuntimeAssetPath, type RuntimePlatform } from '../lib/runtimePlatform';
import { appClient } from '../config/appClient';

interface BrandMarkProps {
  className?: string;
  iconOnly?: boolean;
  title?: string;
  subtitle?: string;
  platform?: RuntimePlatform;
}

const PLATFORM_PRESETS: Record<
  RuntimePlatform,
  {
    markSrc: string;
    title: string;
    subtitle: string;
    wrapperClassName: string;
    titleClassName: string;
    subtitleClassName: string;
  }
> = {
  web: {
    markSrc: '/brand/web/carpet-land-mark.png',
    title: appClient.companyNameAr,
    subtitle: appClient.tagline,
    wrapperClassName: 'h-16 w-16 rounded-[1.35rem]',
    titleClassName: 'text-[1.35rem]',
    subtitleClassName: 'text-[11px] tracking-[0.22em]',
  },
  desktop: {
    markSrc: '/brand/desktop/carpet-land-mark.png',
    title: appClient.systemName,
    subtitle: appClient.desktopSubtitle,
    wrapperClassName: 'h-14 w-14 rounded-[1.25rem]',
    titleClassName: 'text-xl',
    subtitleClassName: 'text-[10px] tracking-[0.26em]',
  },
  mobile: {
    markSrc: '/brand/mobile/carpet-land-mark.png',
    title: appClient.companyNameAr,
    subtitle: appClient.mobileSubtitle,
    wrapperClassName: 'h-12 w-12 rounded-[1rem]',
    titleClassName: 'text-lg',
    subtitleClassName: 'text-[9px] tracking-[0.18em]',
  },
};

const BrandMark: React.FC<BrandMarkProps> = ({
  className = '',
  iconOnly = false,
  title,
  subtitle,
  platform,
}) => {
  const runtimePlatform = platform || getRuntimePlatform();
  const preset = PLATFORM_PRESETS[runtimePlatform];
  const resolvedTitle = title || preset.title;
  const resolvedSubtitle = subtitle || preset.subtitle;
  const resolvedMarkSrc = resolveRuntimeAssetPath(preset.markSrc);

  return (
    <div className={`motion-fade-up flex items-center gap-3 ${className}`} dir="rtl">
      <div
        className={`motion-soft-lift motion-glow motion-shimmer relative shrink-0 overflow-hidden shadow-[0_22px_50px_-28px_rgba(245,158,11,0.7)] ring-1 ring-white/10 ${preset.wrapperClassName}`}
      >
        <img
          src={resolvedMarkSrc}
          alt={`${appClient.companyNameEn} mark`}
          className="h-full w-full object-cover"
          loading="eager"
        />
      </div>

      {!iconOnly && (
        <div className="min-w-0">
          <h1 className={`truncate font-black tracking-tight text-white ${preset.titleClassName}`}>{resolvedTitle}</h1>
          <p className={`truncate font-black text-amber-300/85 ${preset.subtitleClassName}`}>{resolvedSubtitle}</p>
        </div>
      )}
    </div>
  );
};

export default BrandMark;
