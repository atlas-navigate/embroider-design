import type { Point } from '../geometry/point.js';
import { groupRingsIntoRegions, regionToRings, type RingRegion } from '../geometry/regions.js';
import { generateRegionStitches, type RegionStitchResult } from '../stitchgen/region.js';
import type { StitchSettings, StitchType } from '../stitchgen/settings.js';
import { DEFAULT_GLYPH_TOLERANCE, type EmbroideryFont } from './font.js';
import {
  layoutText,
  type PlacedGlyph,
  type TextLayout,
  type TextLayoutOptions,
} from './text-layout.js';

/**
 * Glyph outlines → stitches.
 *
 * The whole job is deciding what a contour *is*. A font hands over a flat list
 * of closed paths with no indication of which is a letter body and which is
 * the counter inside an "O"; `groupRingsIntoRegions` recovers that nesting,
 * and `generateRegionStitches` then measures each region and picks satin, fill
 * or a bean-stitch line on its own. Lettering needs no special-casing beyond
 * getting the regions right — which is exactly why an "O" comes out as a
 * satin ring rather than a solid disc.
 */

export interface GlyphStitchOptions {
  settings: StitchSettings;
  /** `'auto'` (the default) lets the width router choose per region. */
  stitchType?: StitchType;
  /** Curve flattening error in design units. */
  tolerance?: number;
}

export interface GlyphStitches {
  char: string;
  /** Index into `TextLayout.glyphs`. */
  index: number;
  regions: RegionStitchResult[];
  /** Every run from every region of this glyph, in stitching order. */
  runs: Point[][];
}

export interface TextStitchResult {
  layout: TextLayout;
  glyphs: GlyphStitches[];
  /** Every run in the whole text block, in stitching order. */
  runs: Point[][];
  warnings: string[];
}

/** Positioned, nesting-resolved regions for one glyph. */
export function glyphRegionsAt(
  font: EmbroideryFont,
  char: string,
  size: number,
  origin: Point,
  tolerance = DEFAULT_GLYPH_TOLERANCE,
): RingRegion[] {
  const rings = font.glyphRings(char, size, tolerance);
  if (rings.length === 0) return [];
  const moved = rings.map((ring) => ring.map((p) => ({ x: p.x + origin.x, y: p.y + origin.y })));
  return groupRingsIntoRegions(moved);
}

export function generateGlyphStitches(
  font: EmbroideryFont,
  glyph: PlacedGlyph,
  index: number,
  size: number,
  options: GlyphStitchOptions,
): GlyphStitches {
  const regions = glyphRegionsAt(
    font,
    glyph.char,
    size,
    { x: glyph.x, y: glyph.y },
    options.tolerance,
  );
  const results: RegionStitchResult[] = [];
  const runs: Point[][] = [];
  for (const region of regions) {
    const result = generateRegionStitches(
      regionToRings(region),
      options.settings,
      options.stitchType ?? 'auto',
    );
    if (result.runs.length === 0) continue;
    results.push(result);
    for (const run of result.runs) runs.push(run);
  }
  return { char: glyph.char, index, regions: results, runs };
}

/** Lays the text out and digitizes it in one call. */
export function generateTextStitches(
  font: EmbroideryFont,
  text: string,
  layoutOptions: TextLayoutOptions,
  options: GlyphStitchOptions,
): TextStitchResult {
  const layout = layoutText(font, text, layoutOptions);
  const glyphs: GlyphStitches[] = [];
  const runs: Point[][] = [];
  const empty: string[] = [];

  for (let index = 0; index < layout.glyphs.length; index++) {
    const placed = layout.glyphs[index];
    if (placed.char === ' ' || placed.char === '\t') continue;
    const stitched = generateGlyphStitches(font, placed, index, layout.size, options);
    if (stitched.runs.length === 0) {
      if (!empty.includes(placed.char)) empty.push(placed.char);
      continue;
    }
    glyphs.push(stitched);
    for (const run of stitched.runs) runs.push(run);
  }

  const warnings: string[] = [];
  if (layout.missing.length > 0) {
    warnings.push(`Font has no glyph for: ${layout.missing.join(' ')}`);
  }
  const unstitchable = empty.filter((char) => !layout.missing.includes(char));
  if (unstitchable.length > 0) {
    warnings.push(
      `Too small to stitch at this size: ${unstitchable.join(' ')} — increase the text size`,
    );
  }

  return { layout, glyphs, runs, warnings };
}

/**
 * Positioned glyph outlines without any stitching. The canvas draws text
 * layers from these, so what you see on screen is the same geometry the
 * digitizer works from.
 */
export function textToRings(
  font: EmbroideryFont,
  text: string,
  layoutOptions: TextLayoutOptions,
  tolerance = DEFAULT_GLYPH_TOLERANCE,
): { layout: TextLayout; rings: Point[][] } {
  const layout = layoutText(font, text, layoutOptions);
  const rings: Point[][] = [];
  for (const glyph of layout.glyphs) {
    if (glyph.char === ' ' || glyph.char === '\t') continue;
    for (const ring of font.glyphRings(glyph.char, layout.size, tolerance)) {
      rings.push(ring.map((p) => ({ x: p.x + glyph.x, y: p.y + glyph.y })));
    }
  }
  return { layout, rings };
}
