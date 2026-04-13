import type { Profile } from '../types';

const PROFILE_CACHE_KEY = 'carpet-land-profile-cache-v1';
const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000;

type CachedProfileEntry = {
  profile: Profile;
  cachedAt: number;
};

const isBrowser = () => typeof window !== 'undefined';

const readCacheMap = (): Record<string, CachedProfileEntry> | null => {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CachedProfileEntry>) : {};
  } catch {
    return null;
  }
};

const writeCacheMap = (cache: Record<string, CachedProfileEntry>) => {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache persistence issues to keep auth flow resilient.
  }
};

export const readCachedProfile = (userId: string): Profile | null => {
  const cache = readCacheMap();
  if (!cache) return null;

  const entry = cache[userId];
  if (!entry) return null;

  if (!entry.cachedAt || Date.now() - entry.cachedAt > PROFILE_CACHE_TTL_MS) {
    delete cache[userId];
    writeCacheMap(cache);
    return null;
  }

  return entry.profile || null;
};

export const writeCachedProfile = (profile: Profile) => {
  const cache = readCacheMap();
  if (!cache) return;

  cache[profile.id] = {
    profile,
    cachedAt: Date.now(),
  };
  writeCacheMap(cache);
};

export const clearCachedProfile = (userId?: string | null) => {
  if (!userId) return;

  const cache = readCacheMap();
  if (!cache) return;

  delete cache[userId];
  writeCacheMap(cache);
};
