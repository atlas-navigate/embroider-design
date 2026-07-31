import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import {
  IPC,
  type ExportRequest,
  type LoadedFile,
  type LoadedText,
  type SaveRequest,
} from '../shared/ipc-contract.js';
import { describeFontFile, listFontFiles, readFontFile } from './fonts.js';
import { checkForUpdates, currentUpdateState, installUpdate } from './updater.js';

/**
 * Everything that needs a filesystem.
 *
 * Each handler is deliberately dumb: pick a path, move bytes, return. No
 * design data crosses this boundary, so there is nothing here that can
 * disagree with what the renderer thinks the document is.
 */

const PROJECT_FILTER = { name: 'Embroider Design project', extensions: ['embd'] };
const IMAGE_FILTER = {
  name: 'Images',
  extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'],
};
const EMBROIDERY_FILTER = {
  name: 'Embroidery files',
  extensions: ['pes', 'dst', 'exp', 'jef', 'vp3', 'xxx', 'pec'],
};

const FONT_CACHE_FILE = 'font-catalog.json';

/**
 * The user's own shapes, in their profile rather than beside the app.
 *
 * `userData` is created by Electron before the app is ready, survives an
 * upgrade, and is per-user — all three matter for a library someone builds up
 * over months. Installing next to the binary would put it under Program Files,
 * where a per-user install cannot reliably write and an uninstall would take it
 * with it.
 */
const CUSTOM_SHAPES_FILE = 'custom-shapes.json';

async function loadFile(path: string): Promise<LoadedFile> {
  const buffer = await readFile(path);
  return { path, name: basename(path), data: new Uint8Array(buffer) };
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.version, () => app.getVersion());

  ipcMain.handle(IPC.openProject, async (): Promise<LoadedText | null> => {
    const window = getWindow();
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      title: 'Open design',
      filters: [PROJECT_FILTER],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const path = result.filePaths[0];
    return { path, name: basename(path), text: await readFile(path, 'utf8') };
  });

  ipcMain.handle(
    IPC.saveProject,
    async (_event, request: SaveRequest, text: string): Promise<LoadedText | null> => {
      const window = getWindow();
      let path = request.path;
      if (!path) {
        if (!window) return null;
        const result = await dialog.showSaveDialog(window, {
          title: 'Save design',
          defaultPath: request.suggestedName,
          filters: [PROJECT_FILTER],
        });
        if (result.canceled || !result.filePath) return null;
        path = result.filePath;
      }
      await writeFile(path, text, 'utf8');
      return { path, name: basename(path), text };
    },
  );

  ipcMain.handle(IPC.openImage, async (): Promise<LoadedFile | null> => {
    const window = getWindow();
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      title: 'Import image',
      filters: [IMAGE_FILTER],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return loadFile(result.filePaths[0]);
  });

  ipcMain.handle(IPC.openEmbroidery, async (): Promise<LoadedFile | null> => {
    const window = getWindow();
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      title: 'Open embroidery file',
      filters: [EMBROIDERY_FILTER],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return loadFile(result.filePaths[0]);
  });

  ipcMain.handle(
    IPC.exportPattern,
    async (_event, request: ExportRequest, data: Uint8Array): Promise<string | null> => {
      const window = getWindow();
      if (!window) return null;
      const extension = request.extension.replace(/^\./, '');
      const result = await dialog.showSaveDialog(window, {
        title: `Export ${request.formatName}`,
        defaultPath: request.suggestedName,
        filters: [{ name: request.formatName, extensions: [extension] }],
      });
      if (result.canceled || !result.filePath) return null;
      await writeFile(result.filePath, Buffer.from(data));
      return result.filePath;
    },
  );

  ipcMain.handle(IPC.listFontFiles, () => listFontFiles());
  ipcMain.handle(IPC.readFontFile, (_event, path: string) => readFontFile(path));

  ipcMain.handle(IPC.pickFontFile, async () => {
    const window = getWindow();
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      title: 'Add a font file',
      filters: [{ name: 'Fonts', extensions: ['ttf', 'otf'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return describeFontFile(result.filePaths[0]);
  });

  // Parsing several hundred fonts takes a few seconds; doing it once and
  // caching by path, size and mtime makes every later launch instant.
  ipcMain.handle(IPC.readFontCache, async (): Promise<string | null> => {
    try {
      return await readFile(join(app.getPath('userData'), FONT_CACHE_FILE), 'utf8');
    } catch {
      return null;
    }
  });

  ipcMain.handle(IPC.writeFontCache, async (_event, text: string) => {
    try {
      await writeFile(join(app.getPath('userData'), FONT_CACHE_FILE), text, 'utf8');
    } catch {
      // A cache that cannot be written is a slow start, not a failure.
    }
  });

  ipcMain.handle(IPC.readCustomShapes, async (): Promise<string | null> => {
    try {
      return await readFile(join(app.getPath('userData'), CUSTOM_SHAPES_FILE), 'utf8');
    } catch {
      // No file yet is the normal state of a fresh install, not an error.
      return null;
    }
  });

  // Written whole rather than appended: the library is small, and replacing it
  // in one call means a crash mid-save leaves either the old file or the new
  // one, never half of each.
  ipcMain.handle(IPC.writeCustomShapes, async (_event, text: string): Promise<boolean> => {
    try {
      await writeFile(join(app.getPath('userData'), CUSTOM_SHAPES_FILE), text, 'utf8');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC.getUpdateState, () => currentUpdateState());
  ipcMain.handle(IPC.checkForUpdates, () => checkForUpdates(true));
  ipcMain.on(IPC.installUpdate, () => installUpdate());

  ipcMain.on(IPC.setDocumentEdited, (_event, edited: boolean, title: string) => {
    const window = getWindow();
    if (!window) return;
    window.setDocumentEdited(edited);
    window.setTitle(`${edited ? '• ' : ''}${title} - Embroider Design`);
  });

  ipcMain.handle(IPC.confirmDiscard, async (_event, name: string) => {
    const window = getWindow();
    if (!window) return 'discard';
    const result = await dialog.showMessageBox(window, {
      type: 'warning',
      buttons: ['Save', "Don't save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: `Save changes to "${name}" before closing?`,
      detail: 'Your changes will be lost if you do not save them.',
    });
    return result.response === 0 ? 'save' : result.response === 1 ? 'discard' : 'cancel';
  });
}
