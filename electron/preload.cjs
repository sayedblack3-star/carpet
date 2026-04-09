const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  isDesktop: true,
  getRuntimeInfo: () => ipcRenderer.invoke('desktop:get-runtime-info'),
});
