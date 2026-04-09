const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  isDesktop: true,
  getRuntimeInfo: () => ipcRenderer.invoke('desktop:get-runtime-info'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-for-updates'),
  getUpdateStatus: () => ipcRenderer.invoke('desktop:get-update-status'),
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop:update-status', handler);
    return () => ipcRenderer.removeListener('desktop:update-status', handler);
  },
});
