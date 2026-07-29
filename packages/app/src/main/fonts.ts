import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { app } from 'electron';
import type { FontFileInfo } from '../shared/ipc-contract.js';

/**
 * Finding fonts: the ones bundled with the app, and the ones already on the
 * machine.
 *
 * The machine's own fonts are still the bulk of the list — a Windows install
 * has 150+ faces the user already owns. But a scan of a stock Windows 11
 * machine turns up only four usable handwriting faces and no formal cursive at
 * all: Brush Script, Lucida Handwriting and Monotype Corsiva arrive with
 * Microsoft Office, not with Windows. Since a cursive monogram is the single
 * most common embroidery job there is, the app now ships a set of open-licence
 * scripts of its own. See `scripts/fetch-fonts.mjs` for what and from where.
 *
 * Main only enumerates and reads the files — parsing the name tables happens
 * in the renderer, which already has opentype.js loaded for digitizing.
 */

const FONT_EXTENSIONS = ['.ttf', '.otf'];

/**
 * `.ttc`/`.ttf` collections and bitmap-only `.fon` files are skipped: a
 * collection needs a face index the picker has no way to show, and a bitmap
 * font has no outlines to digitize.
 */
function isFontFile(name: string): boolean {
  const lower = name.toLowerCase();
  return FONT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * Where the bundled fonts live.
 *
 * `extraResources` in `electron-builder.yml` copies `resources/fonts` next to
 * the packaged app, which is `process.resourcesPath`. In development there is
 * no such directory, so fall back to the folder in the source tree — otherwise
 * the cursive faces would be missing from every `npm run dev` session and the
 * font picker would look broken to whoever is working on it.
 */
export function bundledFontDirectory(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'fonts')
    : join(app.getAppPath(), 'resources', 'fonts');
}

function fontDirectories(): string[] {
  // First, deliberately: `buildFontCatalog` keeps the first path it sees for a
  // given face, so a bundled copy wins over a stale system install of the same
  // family.
  const directories: string[] = [bundledFontDirectory()];

  const windir = process.env.WINDIR ?? process.env.SystemRoot;
  if (windir) directories.push(join(windir, 'Fonts'));

  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) directories.push(join(localAppData, 'Microsoft', 'Windows', 'Fonts'));

  // Harmless on Windows, and lets the engine's own font handling be exercised
  // when the app is run on another platform during development.
  if (process.platform === 'darwin') {
    directories.push('/System/Library/Fonts', '/Library/Fonts', join(homedir(), 'Library/Fonts'));
  } else if (process.platform === 'linux') {
    directories.push('/usr/share/fonts', join(homedir(), '.local/share/fonts'));
  }
  return directories;
}

async function collectFrom(directory: string, depth: number, out: FontFileInfo[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    // A font directory that does not exist on this machine is normal.
    return;
  }

  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (depth > 0) await collectFrom(full, depth - 1, out);
      continue;
    }
    if (!entry.isFile() || !isFontFile(entry.name)) continue;
    try {
      const info = await stat(full);
      out.push({ path: full, byteSize: info.size, mtimeMs: info.mtimeMs });
    } catch {
      // Unreadable file: skip it rather than failing the whole scan.
    }
  }
}

/**
 * Every font file the user can draw on, system directories first.
 *
 * Order matters downstream: `buildFontCatalog` keeps the first path it sees
 * for a given face, so a system font wins over a per-user copy of the same
 * file.
 */
export async function listFontFiles(): Promise<FontFileInfo[]> {
  const out: FontFileInfo[] = [];
  const seen = new Set<string>();
  for (const directory of fontDirectories()) {
    const found: FontFileInfo[] = [];
    await collectFrom(directory, 1, found);
    for (const font of found) {
      const key = font.path.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(font);
    }
  }
  return out;
}

export async function readFontFile(path: string): Promise<Uint8Array | null> {
  if (!isFontFile(path)) return null;
  try {
    const buffer = await readFile(path);
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

export async function describeFontFile(path: string): Promise<FontFileInfo | null> {
  try {
    const info = await stat(path);
    return { path, byteSize: info.size, mtimeMs: info.mtimeMs };
  } catch {
    return null;
  }
}
