const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

const DEV_SERVER_URL = process.env.ELECTRON_DEV_URL || process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:3000';

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1280,
    minHeight: 800,
    autoHideMenuBar: true,
    backgroundColor: '#120b07',
    title: 'Carpet Land ERP',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    mainWindow.loadURL(DEV_SERVER_URL);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('desktop:get-runtime-info', () => ({
  platform: process.platform,
  isPackaged: app.isPackaged,
  version: app.getVersion(),
}));
