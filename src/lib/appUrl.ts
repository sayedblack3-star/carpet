import { Capacitor } from '@capacitor/core';

const FALLBACK_APP_URL = 'https://carpet-rbnd.vercel.app';

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, '');

export const getAppBaseUrl = () => {
  const configuredUrl = import.meta.env.VITE_APP_URL;
  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl);
  }

  if (typeof window !== 'undefined') {
    const isNativeShell =
      Capacitor.isNativePlatform() ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:';

    if (!isNativeShell && window.location.origin) {
      return normalizeBaseUrl(window.location.origin);
    }
  }

  return FALLBACK_APP_URL;
};

export const getApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, `${getAppBaseUrl()}/`).toString();
};
