import { coerceCollectionName } from '../library/custom-shape.js';

/**
 * What a font-and-icon package is, once the zip container is off.
 *
 * A package is an ordinary archive of ordinary files: `.ttf`/`.otf` faces,
 * icon images to trace, optionally a shape-library JSON for a lossless
 * install, optionally a `manifest.json` naming the collection. This module is
 * the vocabulary — what each entry *is*, what the collection is called, and
 * the caps that keep a hostile or bloated archive from becoming anyone's
 * problem. Reading files and writing libraries stays with the caller.
 */

export type PackageEntryKind =
  | 'font'
  | 'image'
  | 'svg'
  | 'shape-library'
  | 'manifest'
  | 'other';

export const PACKAGE_FILE_EXTENSIONS = ['.zip', '.embpkg'];

/** Refused outright before reading; nothing legitimate is this big. */
export const MAX_PACKAGE_BYTES = 256 * 1024 * 1024;
/** Entries beyond this are skipped, not installed. */
export const MAX_PACKAGE_ENTRIES = 2000;
export const MAX_ENTRY_BYTES = 64 * 1024 * 1024;
export const MAX_FONT_BYTES = 32 * 1024 * 1024;
/** Longest side a package image may decode to. */
export const MAX_IMAGE_DIMENSION = 4096;

const FONT_EXTENSIONS = ['.ttf', '.otf'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];

/**
 * What an entry is, by name alone.
 *
 * Anything under `__MACOSX/` or in a dot-directory is archive litter, not
 * content. A `manifest.json` counts as the manifest only at the root — one
 * nested inside a folder of icons is somebody else's manifest.
 */
export function classifyPackageEntry(name: string): PackageEntryKind {
  const segments = name
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) return 'other';
  if (segments.some((segment) => segment.startsWith('.') || segment === '__MACOSX')) {
    return 'other';
  }

  const base = segments[segments.length - 1].toLowerCase();
  const dot = base.lastIndexOf('.');
  const extension = dot >= 0 ? base.slice(dot) : '';
  if (FONT_EXTENSIONS.includes(extension)) return 'font';
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
  if (extension === '.svg') return 'svg';
  if (extension === '.json') {
    return base === 'manifest.json' && segments.length === 1 ? 'manifest' : 'shape-library';
  }
  return 'other';
}

export interface PackageManifest {
  /** The collection the package's icons file under. */
  name?: string;
}

/** Reads a manifest, forgiving everything except non-JSON. */
export function parsePackageManifest(text: string): PackageManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) return {};
  const record = parsed as Record<string, unknown>;
  return typeof record.name === 'string' ? { name: record.name } : {};
}

/**
 * The collection a package installs into: the manifest's say if it has one,
 * else the archive's own name cleaned up into something a chip can wear.
 */
export function packageCollectionName(
  fileName: string,
  manifest?: PackageManifest | null,
): string {
  const fromManifest = coerceCollectionName(manifest?.name);
  if (fromManifest) return fromManifest;
  const base = fileName.replace(/\\/g, '/').split('/').pop() ?? '';
  const stem = base
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return coerceCollectionName(stem) ?? 'Imported package';
}
