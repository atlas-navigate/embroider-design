/**
 * The whole main/renderer boundary, in one file.
 *
 * The renderer does every piece of real work — geometry, digitizing, format
 * encoding — because the engine is pure TypeScript and runs happily in
 * Chromium. Main is the part of the app that needs a filesystem: dialogs,
 * reading and writing bytes, enumerating installed fonts, and the menu. So
 * nothing here passes a design across the boundary; it passes files.
 */

export interface LoadedFile {
  path: string;
  /** Base name with extension, for window titles and default export names. */
  name: string;
  data: Uint8Array;
}

export interface LoadedText {
  path: string;
  name: string;
  text: string;
}

export interface FontFileInfo {
  path: string;
  byteSize: number;
  mtimeMs: number;
}

/**
 * Where the app is in the update cycle.
 *
 * `unsupported` is not a failure: it is what a development run or an unpacked
 * build reports, and the UI should say so plainly rather than showing an error.
 */
export type UpdateState =
  | { status: 'idle'; message?: string }
  | { status: 'checking' }
  | { status: 'current'; version?: string; message?: string }
  | { status: 'downloading'; version?: string; percent: number }
  | { status: 'ready'; version?: string }
  | { status: 'error'; message: string }
  | { status: 'unsupported'; message: string };

export type MenuCommand =
  | 'new'
  | 'open'
  | 'save'
  | 'save-as'
  | 'import-image'
  | 'import-embroidery'
  | 'add-font'
  | 'export'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-fit'
  | 'toggle-preview'
  | 'delete-layer'
  | 'duplicate-layer'
  | 'select-all'
  | 'deselect'
  | 'group'
  | 'ungroup'
  | 'shapes'
  | 'check-for-updates'
  | 'about';

export interface SaveRequest {
  /** Existing path to overwrite; `null` prompts for one. */
  path: string | null;
  suggestedName: string;
}

export interface ExportRequest {
  suggestedName: string;
  /** Extension including the dot, e.g. `.pes`. */
  extension: string;
  formatName: string;
}

export interface EmbroiderApi {
  getVersion(): Promise<string>;

  openProject(): Promise<LoadedText | null>;
  saveProject(request: SaveRequest, text: string): Promise<LoadedText | null>;

  openImage(): Promise<LoadedFile | null>;
  openEmbroidery(): Promise<LoadedFile | null>;
  exportPattern(request: ExportRequest, data: Uint8Array): Promise<string | null>;

  listFontFiles(): Promise<FontFileInfo[]>;
  readFontFile(path: string): Promise<Uint8Array | null>;
  pickFontFile(): Promise<FontFileInfo | null>;
  readFontCache(): Promise<string | null>;
  writeFontCache(text: string): Promise<void>;

  /** Puts the dot in the title bar and guards the close button. */
  setDocumentEdited(edited: boolean, title: string): void;
  confirmDiscard(name: string): Promise<'save' | 'discard' | 'cancel'>;

  /** Where the app is in the update cycle right now. */
  getUpdateState(): Promise<UpdateState>;
  /** Checks GitHub now, rather than waiting for the next scheduled check. */
  checkForUpdates(): Promise<UpdateState>;
  /** Quits and installs a downloaded update. No-op unless the state is `ready`. */
  installUpdate(): void;
  /** Returns an unsubscribe function. */
  onUpdateState(handler: (state: UpdateState) => void): () => void;

  /** Returns an unsubscribe function. */
  onMenuCommand(handler: (command: MenuCommand) => void): () => void;
  /** Fired when the window is closing with unsaved work. */
  onCloseRequested(handler: () => void): () => void;
  closeWindow(): void;
}

export const IPC = {
  version: 'app:version',
  openProject: 'file:open-project',
  saveProject: 'file:save-project',
  openImage: 'file:open-image',
  openEmbroidery: 'file:open-embroidery',
  exportPattern: 'file:export-pattern',
  listFontFiles: 'fonts:list',
  readFontFile: 'fonts:read',
  pickFontFile: 'fonts:pick',
  readFontCache: 'fonts:cache-read',
  writeFontCache: 'fonts:cache-write',
  setDocumentEdited: 'window:set-edited',
  confirmDiscard: 'window:confirm-discard',
  closeWindow: 'window:close',
  menuCommand: 'menu:command',
  closeRequested: 'window:close-requested',
  getUpdateState: 'update:state',
  checkForUpdates: 'update:check',
  installUpdate: 'update:install',
  updateState: 'update:changed',
} as const;

/** Every format the export dialog offers, mirroring the engine's registry. */
export interface ExportFormatInfo {
  id: string;
  name: string;
  extension: string;
  description: string;
}
