import type { Point } from '../geometry/point.js';

/**
 * The font surface the lettering pipeline actually depends on.
 *
 * Deliberately much smaller than opentype.js's `Font`. Layout, stitch
 * generation and stroke measurement are all written against this, so
 * `font-loader.ts` is the only file that knows opentype.js exists — and tests
 * can hand-build a font whose glyphs are known rectangles instead of shipping
 * a binary fixture.
 *
 * Sizes are em sizes in 0.1 mm units, matching the rest of the engine. A
 * `size` of 100 means "one em is 10 mm tall", which is *not* the same as
 * "letters are 10 mm tall" — see `capHeightOf`.
 */

/**
 * Flattening error for glyph curves, in 0.1 mm units. 0.3 units is 0.03 mm:
 * an order of magnitude finer than the ~0.4 mm satin spacing that will be laid
 * over these outlines, so curve faceting can never be what you see in the
 * finished stitch-out.
 */
export const DEFAULT_GLYPH_TOLERANCE = 0.3;

export interface FontMetrics {
  /** Design units per em. 1000 for CFF/PostScript fonts, 2048 for most TrueType. */
  unitsPerEm: number;
  /** Font units above the baseline. */
  ascender: number;
  /** Font units below the baseline. Negative. */
  descender: number;
  /** Extra leading the designer asked for between lines, in font units. */
  lineGap: number;
  /** Height of a flat capital, in font units, if the font declares one. */
  capHeight?: number;
  /** Height of a lowercase "x", in font units, if the font declares one. */
  xHeight?: number;
}

export interface EmbroideryFont {
  readonly family: string;
  readonly subfamily: string;
  readonly metrics: FontMetrics;
  /** False for characters the font has no glyph for; they render as `.notdef`. */
  hasGlyph(char: string): boolean;
  /** Advance width in *font units*. */
  advanceWidth(char: string): number;
  /** Kerning adjustment in *font units*, usually negative. 0 when unknown. */
  kerning(left: string, right: string): number;
  /**
   * Closed contours of one glyph at `size`, with the pen origin at (0, 0) on
   * the baseline and **Y increasing downward**, matching the canvas and every
   * coordinate elsewhere in the engine.
   *
   * Outer contours and counters come back mixed together, exactly as the font
   * stores them; `groupRingsIntoRegions` sorts out which is which.
   */
  glyphRings(char: string, size: number, tolerance?: number): Point[][];
}

/** Font units → design units at a given em size. */
export function fontScale(metrics: FontMetrics, size: number): number {
  return size / Math.max(1, metrics.unitsPerEm);
}

/** Baseline-to-baseline distance the font itself suggests, in design units. */
export function defaultLineHeight(metrics: FontMetrics, size: number): number {
  const span = metrics.ascender - metrics.descender + metrics.lineGap;
  return span * fontScale(metrics, size);
}

export function ascentOf(metrics: FontMetrics, size: number): number {
  return metrics.ascender * fontScale(metrics, size);
}

export function descentOf(metrics: FontMetrics, size: number): number {
  return -metrics.descender * fontScale(metrics, size);
}

/**
 * Fraction of the em taken up by a capital letter. Fonts that omit
 * `capHeight` get the usual approximation — 70% of the em is close enough for
 * the size conversions this drives.
 */
export function capHeightRatio(metrics: FontMetrics): number {
  const unitsPerEm = Math.max(1, metrics.unitsPerEm);
  if (metrics.capHeight && metrics.capHeight > 0) return metrics.capHeight / unitsPerEm;
  return 0.7;
}

/** Height of a capital letter at `size`, in design units. */
export function capHeightOf(metrics: FontMetrics, size: number): number {
  return capHeightRatio(metrics) * size;
}

/**
 * The em size that yields a given capital-letter height.
 *
 * People specify lettering by letter height ("half-inch letters"), never by em
 * size, so the UI collects the former and converts here.
 */
export function sizeForCapHeight(metrics: FontMetrics, capHeight: number): number {
  const ratio = capHeightRatio(metrics);
  return ratio > 0 ? capHeight / ratio : capHeight;
}

/** Advance for one character at `size`, in design units. */
export function glyphAdvance(font: EmbroideryFont, char: string, size: number): number {
  return font.advanceWidth(char) * fontScale(font.metrics, size);
}

/** Kerning for a pair at `size`, in design units. */
export function pairKerning(
  font: EmbroideryFont,
  left: string,
  right: string,
  size: number,
): number {
  return font.kerning(left, right) * fontScale(font.metrics, size);
}

export function fontDisplayName(font: EmbroideryFont): string {
  const subfamily = font.subfamily.trim();
  if (!subfamily || subfamily.toLowerCase() === 'regular') return font.family;
  return `${font.family} ${subfamily}`;
}
