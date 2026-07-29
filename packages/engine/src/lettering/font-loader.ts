import opentype from 'opentype.js';
import type { Font, PathCommand } from 'opentype.js';
import { flattenCubic, flattenQuadratic } from '../geometry/bezier.js';
import { dedupeConsecutivePoints, openRing } from '../geometry/path.js';
import type { Point } from '../geometry/point.js';
import { DEFAULT_GLYPH_TOLERANCE, type EmbroideryFont, type FontMetrics } from './font.js';

/**
 * The one file that knows opentype.js exists.
 *
 * Everything else in `lettering/` talks to `EmbroideryFont`, so swapping the
 * parser — or feeding in a fake font in a test — costs nothing.
 */

/** Rings with fewer than this many points are parser noise, not contours. */
const MIN_RING_POINTS = 3;

/**
 * Turns opentype path commands into closed rings, applying the font-unit
 * scale and the Y flip in one pass.
 *
 * Doing the transform here rather than via `glyph.getPath(x, y, size)` is
 * deliberate: `getPath` derives its scale from `path.unitsPerEm`, a field that
 * is populated in different places depending on how the font was constructed.
 * Reading `glyph.path` raw and scaling it ourselves is one less thing that can
 * silently be 2048/1000 out.
 */
export function pathCommandsToRings(
  commands: readonly PathCommand[],
  scale: number,
  tolerance = DEFAULT_GLYPH_TOLERANCE,
): Point[][] {
  const rings: Point[][] = [];
  let current: Point[] = [];
  let cursor: Point = { x: 0, y: 0 };

  // Font outlines are Y-up; ours are Y-down.
  const at = (x: number, y: number): Point => ({ x: x * scale, y: -y * scale });

  const finish = (): void => {
    const ring = openRing(dedupeConsecutivePoints(current, 1e-9));
    if (ring.length >= MIN_RING_POINTS) rings.push(ring);
    current = [];
  };

  for (const command of commands) {
    switch (command.type) {
      case 'M':
        finish();
        cursor = at(command.x, command.y);
        current.push({ ...cursor });
        break;
      case 'L':
        cursor = at(command.x, command.y);
        current.push({ ...cursor });
        break;
      case 'C': {
        const c1 = at(command.x1, command.y1);
        const c2 = at(command.x2, command.y2);
        const end = at(command.x, command.y);
        for (const point of flattenCubic(cursor, c1, c2, end, tolerance)) current.push(point);
        cursor = end;
        break;
      }
      case 'Q': {
        const c = at(command.x1, command.y1);
        const end = at(command.x, command.y);
        for (const point of flattenQuadratic(cursor, c, end, tolerance)) current.push(point);
        cursor = end;
        break;
      }
      case 'Z':
        finish();
        break;
    }
  }
  // Fonts always close their contours, but a truncated file might not.
  finish();
  return rings;
}

function localizedName(entry: Record<string, string> | undefined, fallback: string): string {
  if (!entry) return fallback;
  if (typeof entry.en === 'string' && entry.en.trim()) return entry.en.trim();
  for (const value of Object.values(entry)) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
}

function metricsOf(font: Font): FontMetrics {
  const unitsPerEm = font.unitsPerEm > 0 ? font.unitsPerEm : 1000;
  const os2 = font.tables.os2 as Record<string, number> | undefined;
  const hhea = font.tables.hhea as Record<string, number> | undefined;
  const metrics: FontMetrics = {
    unitsPerEm,
    ascender: font.ascender || unitsPerEm * 0.8,
    // A positive descender means the font stored it the OS/2 way round.
    descender: font.descender > 0 ? -font.descender : font.descender || -unitsPerEm * 0.2,
    lineGap: hhea?.lineGap ?? 0,
  };
  if (os2?.sCapHeight) metrics.capHeight = os2.sCapHeight;
  if (os2?.sxHeight) metrics.xHeight = os2.sxHeight;
  return metrics;
}

/** What the app needs to list a font without keeping the parsed font around. */
export interface FontDescriptor {
  family: string;
  subfamily: string;
  fullName: string;
  postScriptName: string;
  /** OS/2 usWeightClass, 100-900. 400 is regular, 700 bold. */
  weight: number;
  italic: boolean;
  monospace: boolean;
  /**
   * OS/2 PANOSE, ten bytes classifying the design. Byte 0 is the family kind,
   * and it is the most reliable single signal for "is this a script face" that
   * a font carries about itself. Empty when the font omits the table.
   */
  panose?: number[];
  /** OS/2 sFamilyClass; the high byte is the IBM family class. */
  familyClass?: number;
}

export function describeFont(font: Font): FontDescriptor {
  const names = font.names as unknown as Record<string, Record<string, string> | undefined>;
  const family = localizedName(names.fontFamily, 'Unknown');
  const subfamily = localizedName(names.fontSubfamily, 'Regular');
  const os2 = font.tables.os2 as Record<string, number> | undefined;
  const head = font.tables.head as Record<string, number> | undefined;
  const post = font.tables.post as Record<string, number> | undefined;
  // macStyle bit 1 and fsSelection bit 0 both mean italic; fonts set either.
  const italic = ((head?.macStyle ?? 0) & 0x02) !== 0 || ((os2?.fsSelection ?? 0) & 0x01) !== 0;
  const panose = (os2 as unknown as { panose?: unknown })?.panose;
  return {
    family,
    subfamily,
    fullName: localizedName(names.fullName, `${family} ${subfamily}`.trim()),
    postScriptName: localizedName(names.postScriptName, family),
    weight: os2?.usWeightClass ?? 400,
    italic,
    monospace: (post?.isFixedPitch ?? 0) !== 0,
    ...(Array.isArray(panose) ? { panose: panose.map(Number) } : {}),
    ...(os2?.sFamilyClass === undefined ? {} : { familyClass: os2.sFamilyClass }),
  };
}

class OpentypeEmbroideryFont implements EmbroideryFont {
  readonly family: string;
  readonly subfamily: string;
  readonly metrics: FontMetrics;
  readonly descriptor: FontDescriptor;

  private readonly font: Font;
  /** Glyph rings are re-requested constantly while a size slider moves. */
  private readonly ringCache = new Map<string, Point[][]>();

  constructor(font: Font) {
    this.font = font;
    this.descriptor = describeFont(font);
    this.family = this.descriptor.family;
    this.subfamily = this.descriptor.subfamily;
    this.metrics = metricsOf(font);
  }

  hasGlyph(char: string): boolean {
    try {
      return this.font.charToGlyphIndex(char) > 0;
    } catch {
      return false;
    }
  }

  advanceWidth(char: string): number {
    try {
      return this.font.charToGlyph(char).advanceWidth ?? 0;
    } catch {
      return 0;
    }
  }

  kerning(left: string, right: string): number {
    try {
      const a = this.font.charToGlyph(left);
      const b = this.font.charToGlyph(right);
      return this.font.getKerningValue(a, b) || 0;
    } catch {
      return 0;
    }
  }

  glyphRings(char: string, size: number, tolerance = DEFAULT_GLYPH_TOLERANCE): Point[][] {
    const key = `${char}\u0000${size}\u0000${tolerance}`;
    const cached = this.ringCache.get(key);
    if (cached) return cached.map((ring) => ring.map((p) => ({ ...p })));

    let rings: Point[][] = [];
    try {
      const glyph = this.font.charToGlyph(char);
      const scale = size / Math.max(1, this.metrics.unitsPerEm);
      rings = pathCommandsToRings(glyph.path.commands, scale, tolerance);
    } catch {
      rings = [];
    }
    this.ringCache.set(key, rings);
    return rings.map((ring) => ring.map((p) => ({ ...p })));
  }
}

export interface LoadedFont extends EmbroideryFont {
  readonly descriptor: FontDescriptor;
}

/**
 * Parses a `.ttf`/`.otf` buffer. Throws on anything opentype.js cannot read,
 * which for a font directory scan is the expected outcome often enough that
 * callers should catch and skip rather than abort.
 */
export function loadFontFromBuffer(buffer: ArrayBuffer): LoadedFont {
  const parsed = opentype.parse(buffer);
  if (!parsed.supported) throw new Error('Unsupported font file');
  return new OpentypeEmbroideryFont(parsed);
}

/**
 * Reads only the identifying fields, for building a catalog of a font
 * directory without holding every parsed font in memory.
 */
export function describeFontBuffer(buffer: ArrayBuffer): FontDescriptor {
  const parsed = opentype.parse(buffer);
  if (!parsed.supported) throw new Error('Unsupported font file');
  return describeFont(parsed);
}
