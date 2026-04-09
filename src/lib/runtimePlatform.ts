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
