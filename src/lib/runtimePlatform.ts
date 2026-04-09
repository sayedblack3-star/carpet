import { Capacitor } from '@capacitor/core';

export type RuntimePlatform = 'web' | 'desktop' | 'mobile';

export const getRuntimePlatform = (): RuntimePlatform => {
  if (typeof window !== 'undefined' && window.desktopBridge?.isDesktop) {
    return 'desktop';
  }

  if (Capacitor.isNativePlatform()) {
    return 'mobile';
  }

  return 'web';
};

export const resolveRuntimeAssetPath = (assetPath: string): string => {
  const sanitizedPath = assetPath.replace(/^\/+/, '');
  const baseUrl = import.meta.env.BASE_URL || './';

  if (!baseUrl || baseUrl === '/') {
    return `/${sanitizedPath}`;
  }

  return `${baseUrl}${sanitizedPath}`;
};
