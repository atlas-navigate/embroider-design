import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type EmbroiderApi,
  type ExportRequest,
  type FontInstallFile,
  type MenuCommand,
  type SaveRequest,
  type UpdateState,
} from '../shared/ipc-contract.js';

/**
 * The only thing the renderer can reach outside its sandbox.
 *
 * Every method is a named operation with a fixed shape — there is no generic
 * "invoke anything" or "read any path" escape hatch, so a bug in the UI cannot
 * turn into arbitrary filesystem access.
 */

const api: EmbroiderApi = {
  getVersion: () => ipcRenderer.invoke(IPC.version),

  openProject: () => ipcRenderer.invoke(IPC.openProject),
  saveProject: (request: SaveRequest, text: string) =>
    ipcRenderer.invoke(IPC.saveProject, request, text),

  openImage: () => ipcRenderer.invoke(IPC.openImage),
  openEmbroidery: () => ipcRenderer.invoke(IPC.openEmbroidery),
  openPackage: () => ipcRenderer.invoke(IPC.openPackage),
  exportPattern: (request: ExportRequest, data: Uint8Array) =>
    ipcRenderer.invoke(IPC.exportPattern, request, data),

  listFontFiles: () => ipcRenderer.invoke(IPC.listFontFiles),
  readFontFile: (path: string) => ipcRenderer.invoke(IPC.readFontFile, path),
  pickFontFile: () => ipcRenderer.invoke(IPC.pickFontFile),
  installFonts: (files: FontInstallFile[]) => ipcRenderer.invoke(IPC.installFonts, files),
  readFontCache: () => ipcRenderer.invoke(IPC.readFontCache),
  writeFontCache: (text: string) => ipcRenderer.invoke(IPC.writeFontCache, text),

  readCustomShapes: () => ipcRenderer.invoke(IPC.readCustomShapes),
  writeCustomShapes: (text: string) => ipcRenderer.invoke(IPC.writeCustomShapes, text),

  setDocumentEdited: (edited: boolean, title: string) => {
    ipcRenderer.send(IPC.setDocumentEdited, edited, title);
  },
  confirmDiscard: (name: string) => ipcRenderer.invoke(IPC.confirmDiscard, name),

  getUpdateState: () => ipcRenderer.invoke(IPC.getUpdateState),
  checkForUpdates: () => ipcRenderer.invoke(IPC.checkForUpdates),
  installUpdate: () => {
    ipcRenderer.send(IPC.installUpdate);
  },
  onUpdateState: (handler: (state: UpdateState) => void) => {
    const listener = (_event: unknown, state: UpdateState): void => handler(state);
    ipcRenderer.on(IPC.updateState, listener);
    return () => ipcRenderer.removeListener(IPC.updateState, listener);
  },

  onMenuCommand: (handler: (command: MenuCommand) => void) => {
    const listener = (_event: unknown, command: MenuCommand): void => handler(command);
    ipcRenderer.on(IPC.menuCommand, listener);
    return () => ipcRenderer.removeListener(IPC.menuCommand, listener);
  },
  onCloseRequested: (handler: () => void) => {
    const listener = (): void => handler();
    ipcRenderer.on(IPC.closeRequested, listener);
    return () => ipcRenderer.removeListener(IPC.closeRequested, listener);
  },
  closeWindow: () => {
    ipcRenderer.send(IPC.closeWindow);
  },
};

contextBridge.exposeInMainWorld('embroider', api);
