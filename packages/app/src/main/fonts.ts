import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { app } from 'electron';
import type { FontFileInfo, FontInstallFile } from '../shared/ipc-contract.js';

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

/**
 * Where fonts the user installs through the app live: under `userData`, for
 * the same reasons the custom shape library does — per-user, writable without
 * elevation, and it survives an upgrade. These are app-private; nothing here
 * registers them with Windows.
 */
export function userFontDirectory(): string {
  return join(app.getPath('userData'), 'fonts');
}

function fontDirectories(): string[] {
  // First, deliberately: `buildFontCatalog` keeps the first path it sees for a
  // given face, so a bundled copy wins over a stale system install of the same
  // family. The user's own installs come next — ahead of the system, because a
  // face somebody installed on purpose beats a stale system copy of it.
  const directories: string[] = [bundledFontDirectory(), userFontDirectory()];

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

/** Bigger than any real font; a package entry claiming more is not one. */
const INSTALLED_FONT_MAX_BYTES = 32 * 1024 * 1024;

/**
 * Only ever a base name. The bytes may come out of a zip whose entry names are
 * attacker-chosen, so everything path-like is stripped before the name touches
 * the filesystem, and anything that is not a plain `.ttf`/`.otf` name after
 * that is refused.
 */
function sanitizedFontFileName(name: string): string | null {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim();
  if (cleaned.startsWith('.') || !isFontFile(cleaned)) return null;
  return cleaned;
}

/**
 * Copies fonts into `userFontDirectory`, where the next scan will find them.
 *
 * A name collision gets a ` (2)` suffix rather than an overwrite: replacing a
 * font file another design is using, silently, with different outlines, is the
 * kind of favour nobody asked for. Unwritable or refused files are skipped —
 * the caller compares what it sent with what came back.
 */
export async function installFontFiles(
  files: readonly FontInstallFile[],
): Promise<FontFileInfo[]> {
  const directory = userFontDirectory();
  await mkdir(directory, { recursive: true });

  const installed: FontFileInfo[] = [];
  for (const file of files) {
    const cleaned = sanitizedFontFileName(file.name);
    if (!cleaned || file.data.length === 0 || file.data.length > INSTALLED_FONT_MAX_BYTES) {
      continue;
    }
    const dot = cleaned.lastIndexOf('.');
    const stem = cleaned.slice(0, dot);
    const extension = cleaned.slice(dot);
    let target = join(directory, cleaned);
    for (let attempt = 2; existsSync(target); attempt++) {
      target = join(directory, `${stem} (${attempt})${extension}`);
    }
    try {
      await writeFile(target, Buffer.from(file.data));
    } catch {
      continue;
    }
    const info = await describeFontFile(target);
    if (info) installed.push(info);
  }
  return installed;
}
