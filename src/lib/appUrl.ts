import { Capacitor } from '@capacitor/core';
import { appClient } from '../config/appClient';

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

  if (appClient.webAppUrl) {
    return normalizeBaseUrl(appClient.webAppUrl);
  }

  return 'http://localhost';
};

export const getApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, `${getAppBaseUrl()}/`).toString();
};
