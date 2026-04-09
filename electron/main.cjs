const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

const DEV_SERVER_URL = process.env.ELECTRON_DEV_URL || process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:3000';
const DESKTOP_APP_ID = 'com.carpetland.erp.desktop';

let mainWindow = null;
let updateStatus = {
  checking: false,
  available: false,
  downloaded: false,
  version: null,
  error: null,
};

log.initialize();
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createMainWindow() {
  const windowIconPath = path.join(__dirname, 'assets', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1280,
    minHeight: 800,
    autoHideMenuBar: true,
    backgroundColor: '#120b07',
    title: 'Carpet Land ERP',
    icon: windowIconPath,
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

function sendUpdateStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:update-status', updateStatus);
  }
}

function configureAutoUpdates() {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.on('checking-for-update', () => {
    updateStatus = { checking: true, available: false, downloaded: false, version: null, error: null };
    sendUpdateStatus();
    log.info('Checking for desktop updates');
  });

  autoUpdater.on('update-available', (info) => {
    updateStatus = {
      checking: false,
      available: true,
      downloaded: false,
      version: info.version || null,
      error: null,
    };
    sendUpdateStatus();
    log.info(`Desktop update available: ${info.version}`);
  });

  autoUpdater.on('update-not-available', () => {
    updateStatus = { checking: false, available: false, downloaded: false, version: app.getVersion(), error: null };
    sendUpdateStatus();
    log.info('Desktop update not available');
  });

  autoUpdater.on('error', (error) => {
    updateStatus = {
      checking: false,
      available: false,
      downloaded: false,
      version: null,
      error: error?.message || 'update-error',
    };
    sendUpdateStatus();
    log.error('Desktop update check failed', error);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    updateStatus = {
      checking: false,
      available: true,
      downloaded: true,
      version: info.version || null,
      error: null,
    };
    sendUpdateStatus();
    log.info(`Desktop update downloaded: ${info.version}`);

    const result = await dialog.showMessageBox({
      type: 'info',
      buttons: ['تحديث الآن', 'لاحقًا'],
      defaultId: 0,
      cancelId: 1,
      title: 'تحديث جديد جاهز',
      message: 'تم تنزيل تحديث جديد لبرنامج Carpet Land ERP.',
      detail: 'اضغط "تحديث الآن" لإعادة تشغيل البرنامج وتثبيت النسخة الجديدة.',
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId(DESKTOP_APP_ID);
  createMainWindow();
  configureAutoUpdates();

  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((error) => {
        log.error('Unable to start desktop update check', error);
      });
    }, 4000);
  }

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

ipcMain.handle('desktop:check-for-updates', async () => {
  if (!app.isPackaged) {
    return { ok: false, reason: 'not-packaged' };
  }

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    log.error('Manual desktop update check failed', error);
    return { ok: false, reason: error instanceof Error ? error.message : 'update-error' };
  }
});

ipcMain.handle('desktop:get-update-status', () => updateStatus);
