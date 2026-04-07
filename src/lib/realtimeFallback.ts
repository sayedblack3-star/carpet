import type { RealtimeChannel } from '@supabase/supabase-js';

const REALTIME_FALLBACK_DELAY_MS = 1500;

interface RealtimeFallbackOptions {
  fetchNow: () => void | Promise<void>;
  createChannel: () => RealtimeChannel;
  pollIntervalMs?: number;
  onFallback?: () => void;
}

export const setupRealtimeFallback = ({
  fetchNow,
  createChannel,
  pollIntervalMs = 30000,
  onFallback,
}: RealtimeFallbackOptions) => {
  let channel: RealtimeChannel | null = null;
  let pollingId: number | null = null;
  let fallbackTimerId: number | null = null;
  let fallbackStarted = false;
  let disposed = false;

  const startPolling = () => {
    if (disposed || fallbackStarted) return;
    fallbackStarted = true;
    onFallback?.();
    pollingId = window.setInterval(() => {
      void fetchNow();
    }, pollIntervalMs);
  };

  channel = createChannel();
  channel.subscribe((status) => {
    if (disposed) return;

    if (status === 'SUBSCRIBED' && fallbackTimerId) {
      window.clearTimeout(fallbackTimerId);
      fallbackTimerId = null;
    }

    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      startPolling();
    }
  });

  fallbackTimerId = window.setTimeout(() => {
    startPolling();
  }, REALTIME_FALLBACK_DELAY_MS);

  return () => {
    disposed = true;

    if (fallbackTimerId) {
      window.clearTimeout(fallbackTimerId);
    }

    if (pollingId) {
      window.clearInterval(pollingId);
    }

    channel?.unsubscribe();
  };
};
