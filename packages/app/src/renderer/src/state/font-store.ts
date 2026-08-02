import { create } from 'zustand';
import {
  buildFontCatalog,
  describeFontBuffer,
  groupByFamily,
  loadFontFromBuffer,
  resolveFontReference,
  type FontCatalogEntry,
  type FontFamilyGroup,
  type FontReference,
  type LoadedFont,
} from '@embroider-design/engine';
import type { FontFileInfo } from '../../../shared/ipc-contract.js';

/**
 * The machine's fonts, parsed lazily and cached.
 *
 * Reading and parsing several hundred font files takes a few seconds, which is
 * fine once and intolerable at every launch — so the catalog is written to
 * disk keyed by path, size and modification time, and a font's actual outlines
 * are only parsed when a layer needs them.
 */

const CACHE_VERSION = 1;

interface CachedCatalog {
  version: number;
  entries: FontCatalogEntry[];
}

interface FontState {
  catalog: FontCatalogEntry[];
  families: FontFamilyGroup[];
  loading: boolean;
  progress: { done: number; total: number } | null;
  error: string | null;
  /** Parsed fonts, by file path. */
  loaded: Map<string, LoadedFont>;

  scan(): Promise<void>;
  addFontFile(): Promise<FontCatalogEntry | null>;
  ensureLoaded(path: string): Promise<LoadedFont | null>;
  fontFor(reference: FontReference): LoadedFont | null;
  entryFor(reference: FontReference): FontCatalogEntry | null;
}

function keyOf(info: FontFileInfo): string {
  return `${info.path.toLowerCase()}|${info.byteSize}|${Math.round(info.mtimeMs)}`;
}

async function readCache(): Promise<Map<string, FontCatalogEntry>> {
  const map = new Map<string, FontCatalogEntry>();
  try {
    const text = await window.embroider.readFontCache();
    if (!text) return map;
    const parsed = JSON.parse(text) as CachedCatalog;
    if (parsed.version !== CACHE_VERSION || !Array.isArray(parsed.entries)) return map;
    for (const entry of parsed.entries) {
      if (entry.byteSize === undefined || entry.mtimeMs === undefined) continue;
      map.set(
        keyOf({ path: entry.path, byteSize: entry.byteSize, mtimeMs: entry.mtimeMs }),
        entry,
      );
    }
  } catch {
    // A corrupt cache just means a slow start.
  }
  return map;
}

/** Yields to the event loop so the window keeps painting during the first scan. */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export const useFontStore = create<FontState>((set, get) => ({
  catalog: [],
  families: [],
  loading: false,
  progress: null,
  error: null,
  loaded: new Map(),

  scan: async () => {
    if (get().loading) return;
    set({ loading: true, error: null, progress: null });
    try {
      const files = await window.embroider.listFontFiles();
      const cache = await readCache();
      const entries: FontCatalogEntry[] = [];
      let parsedSinceYield = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const cached = cache.get(keyOf(file));
        if (cached) {
          entries.push(cached);
        } else {
          const bytes = await window.embroider.readFontFile(file.path);
          if (bytes) {
            try {
              const descriptor = describeFontBuffer(
                bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
              );
              entries.push({
                ...descriptor,
                path: file.path,
                byteSize: file.byteSize,
                mtimeMs: file.mtimeMs,
              });
            } catch {
              // Bitmap-only, damaged or otherwise unparseable: skip it. On a
              // full Windows font directory a handful always fail.
            }
          }
          parsedSinceYield++;
        }

        if (parsedSinceYield >= 12) {
          parsedSinceYield = 0;
          set({ progress: { done: i + 1, total: files.length } });
          await yieldToUi();
        }
      }

      const catalog = buildFontCatalog(entries);
      set({ catalog, families: groupByFamily(catalog), loading: false, progress: null });
      void window.embroider.writeFontCache(
        JSON.stringify({ version: CACHE_VERSION, entries: catalog } satisfies CachedCatalog),
      );
    } catch (error) {
      set({
        loading: false,
        progress: null,
        error: error instanceof Error ? error.message : 'Could not read the font list',
      });
    }
  },

  addFontFile: async () => {
    const file = await window.embroider.pickFontFile();
    if (!file) return null;
    const bytes = await window.embroider.readFontFile(file.path);
    if (!bytes) return null;
    try {
      const descriptor = describeFontBuffer(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      );
      // Copy the file into the app's own font directory before cataloguing
      // it. The catalog is rebuilt from disk on every launch, so a font left
      // at its original path used to vanish on the first restart — and any
      // design using it then warned that the font was not installed.
      const name = file.path.split(/[\\/]/).pop() ?? 'font.ttf';
      const [installed] = await window.embroider.installFonts([{ name, data: bytes }]);
      const source = installed ?? file;
      const entry: FontCatalogEntry = {
        ...descriptor,
        path: source.path,
        byteSize: source.byteSize,
        mtimeMs: source.mtimeMs,
      };
      const catalog = buildFontCatalog([...get().catalog, entry]);
      set({ catalog, families: groupByFamily(catalog) });
      return entry;
    } catch {
      set({ error: 'That file is not a font this app can read' });
      return null;
    }
  },

  ensureLoaded: async (path) => {
    const existing = get().loaded.get(path);
    if (existing) return existing;
    const bytes = await window.embroider.readFontFile(path);
    if (!bytes) return null;
    try {
      const font = loadFontFromBuffer(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      );
      // A new Map, so components subscribed to `loaded` actually re-render.
      set((state) => ({ loaded: new Map(state.loaded).set(path, font) }));
      return font;
    } catch {
      return null;
    }
  },

  fontFor: (reference) => {
    const entry = get().entryFor(reference);
    return entry ? (get().loaded.get(entry.path) ?? null) : null;
  },

  entryFor: (reference) => resolveFontReference(get().catalog, reference),
}));
