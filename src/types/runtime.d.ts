export {};

declare global {
  interface Window {
    desktopBridge?: {
      isDesktop?: boolean;
      getRuntimeInfo?: () => Promise<{
        platform: string;
        isPackaged: boolean;
        version: string;
      }>;
      checkForUpdates?: () => Promise<{ ok: boolean; reason?: string }>;
      getUpdateStatus?: () => Promise<unknown>;
      onUpdateStatus?: (callback: (payload: unknown) => void) => () => void;
    };
  }
}
