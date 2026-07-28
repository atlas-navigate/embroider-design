import type { FontDescriptor } from './font-loader.js';

/**
 * Organising the fonts already installed on the machine.
 *
 * No fonts ship with this application. A Windows install has 150+ faces
 * sitting in `C:\Windows\Fonts` that the user already has the right to use,
 * and bundling half a dozen more would only add a licensing surface and a
 * shorter list. The app enumerates and parses those files; everything here is
 * the pure part — dedupe, group, sort, search — so it can be tested without a
 * filesystem.
 */

export interface FontCatalogEntry extends FontDescriptor {
  /** Absolute path. The app reads the bytes from here when the font is used. */
  path: string;
  /** File size in bytes, for invalidating a cached catalog. */
  byteSize?: number;
  /** Modification time in epoch ms, for the same reason. */
  mtimeMs?: number;
}

export interface FontFamilyGroup {
  family: string;
  styles: FontCatalogEntry[];
}

const REGULAR_NAMES = new Set(['regular', 'normal', 'book', 'roman', 'plain', '']);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Sort key: weight first, upright before italic. */
function styleOrder(entry: FontCatalogEntry): number {
  return entry.weight * 2 + (entry.italic ? 1 : 0);
}

/**
 * Deduplicates and sorts a raw scan. The same face routinely appears in both
 * the machine-wide and per-user font directories; the first path wins, which
 * given the app scans the system directory first means system fonts are
 * preferred over per-user copies of the same file.
 */
export function buildFontCatalog(entries: readonly FontCatalogEntry[]): FontCatalogEntry[] {
  const byPath = new Map<string, FontCatalogEntry>();
  const byIdentity = new Set<string>();
  for (const entry of entries) {
    const pathKey = normalizeKey(entry.path);
    if (byPath.has(pathKey)) continue;
    const identity = `${normalizeKey(entry.family)}|${normalizeKey(entry.subfamily)}|${entry.weight}|${entry.italic}`;
    if (byIdentity.has(identity)) continue;
    byIdentity.add(identity);
    byPath.set(pathKey, entry);
  }
  return [...byPath.values()].sort(
    (a, b) => a.family.localeCompare(b.family) || styleOrder(a) - styleOrder(b),
  );
}

export function groupByFamily(entries: readonly FontCatalogEntry[]): FontFamilyGroup[] {
  const groups = new Map<string, FontFamilyGroup>();
  for (const entry of entries) {
    const key = normalizeKey(entry.family);
    let group = groups.get(key);
    if (!group) {
      group = { family: entry.family, styles: [] };
      groups.set(key, group);
    }
    group.styles.push(entry);
  }
  const out = [...groups.values()];
  for (const group of out) group.styles.sort((a, b) => styleOrder(a) - styleOrder(b));
  out.sort((a, b) => a.family.localeCompare(b.family));
  return out;
}

export function isRegularStyle(entry: FontCatalogEntry): boolean {
  return !entry.italic && REGULAR_NAMES.has(normalizeKey(entry.subfamily));
}

/** The style to show first for a family: Regular if it has one, else the closest weight to 400. */
export function preferredStyle(styles: readonly FontCatalogEntry[]): FontCatalogEntry | null {
  if (styles.length === 0) return null;
  const regular = styles.find(isRegularStyle);
  if (regular) return regular;
  const upright = styles.filter((style) => !style.italic);
  const candidates = upright.length > 0 ? upright : styles;
  return candidates.reduce((best, style) =>
    Math.abs(style.weight - 400) < Math.abs(best.weight - 400) ? style : best,
  );
}

/**
 * The heaviest upright style in a family. Worth surfacing: at any given
 * letter height a bolder weight gives a wider satin column, which is the
 * single easiest fix for lettering that measures too thin to stitch.
 */
export function boldestStyle(styles: readonly FontCatalogEntry[]): FontCatalogEntry | null {
  if (styles.length === 0) return null;
  const upright = styles.filter((style) => !style.italic);
  const candidates = upright.length > 0 ? upright : styles;
  return candidates.reduce((best, style) => (style.weight > best.weight ? style : best));
}

/** Free-text match over family, style and PostScript name. */
export function searchFonts(
  entries: readonly FontCatalogEntry[],
  query: string,
): FontCatalogEntry[] {
  const needle = normalizeKey(query);
  if (!needle) return [...entries];
  return entries.filter((entry) =>
    `${entry.family} ${entry.subfamily} ${entry.fullName} ${entry.postScriptName}`
      .toLowerCase()
      .includes(needle),
  );
}

export function findByPath(
  entries: readonly FontCatalogEntry[],
  path: string,
): FontCatalogEntry | null {
  const key = normalizeKey(path);
  return entries.find((entry) => normalizeKey(entry.path) === key) ?? null;
}

/** Best match for a saved project's font, which may not exist on this machine. */
export function resolveFontReference(
  entries: readonly FontCatalogEntry[],
  reference: { path?: string; family?: string; subfamily?: string; postScriptName?: string },
): FontCatalogEntry | null {
  if (reference.path) {
    const byPath = findByPath(entries, reference.path);
    if (byPath) return byPath;
  }
  if (reference.postScriptName) {
    const key = normalizeKey(reference.postScriptName);
    const match = entries.find((entry) => normalizeKey(entry.postScriptName) === key);
    if (match) return match;
  }
  if (reference.family) {
    const key = normalizeKey(reference.family);
    const family = entries.filter((entry) => normalizeKey(entry.family) === key);
    if (family.length > 0) {
      if (reference.subfamily) {
        const styleKey = normalizeKey(reference.subfamily);
        const exact = family.find((entry) => normalizeKey(entry.subfamily) === styleKey);
        if (exact) return exact;
      }
      return preferredStyle(family);
    }
  }
  return null;
}

export function styleLabel(entry: FontCatalogEntry): string {
  const subfamily = entry.subfamily.trim();
  return subfamily.length > 0 ? subfamily : 'Regular';
}

export function catalogDisplayName(entry: FontCatalogEntry): string {
  return isRegularStyle(entry) ? entry.family : `${entry.family} ${styleLabel(entry)}`;
}
