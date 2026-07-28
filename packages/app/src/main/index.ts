import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { IPC } from '../shared/ipc-contract.js';
import { registerIpcHandlers } from './ipc.js';
import { buildMenu } from './menu.js';
import { registerUpdater } from './updater.js';

/**
 * The Electron entry point.
 *
 * Main stays small on purpose. Everything about designs — geometry, stitch
 * generation, file encoding — lives in the engine and runs in the renderer, so
 * this process only owns the window, the menu, and access to the disk.
 */

let mainWindow: BrowserWindow | null = null;
/** Set once the renderer has agreed the window may close. */
let allowClose = false;

function getWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#1b1d21',
    title: 'Embroider Design',
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // The renderer runs the engine, not Node: no filesystem, no require.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // The renderer knows whether there are unsaved changes, so closing is a
  // question asked of it rather than a decision taken here.
  mainWindow.on('close', (event) => {
    if (allowClose || !mainWindow) return;
    event.preventDefault();
    mainWindow.webContents.send(IPC.closeRequested);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.embroiderdesign.app');
  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerIpcHandlers(getWindow);

  // Sent by the renderer once it has saved, or the user chose to discard.
  ipcMain.on(IPC.closeWindow, () => {
    allowClose = true;
    mainWindow?.close();
  });

  Menu.setApplicationMenu(buildMenu(getWindow));
  createWindow();

  // After the window exists, so the first update event has somewhere to go.
  registerUpdater(getWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
