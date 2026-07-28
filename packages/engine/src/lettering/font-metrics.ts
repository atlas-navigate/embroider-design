import { regionWidthStats } from '../geometry/distance-transform.js';
import { groupRingsIntoRegions, regionToRings } from '../geometry/regions.js';
import { mmToUnits, unitsToMm } from '../pattern/units.js';
import type { StitchSettings } from '../stitchgen/settings.js';
import { capHeightOf, DEFAULT_GLYPH_TOLERANCE, type EmbroideryFont } from './font.js';

/**
 * How thick is this font, really?
 *
 * The single most common way a first embroidery design fails is picking a font
 * that looks fine on screen and has 0.4 mm strokes at the chosen size. A satin
 * column that narrow will not hold — the machine puts three threads on top of
 * each other and the letter disappears into the fabric.
 *
 * Rather than curate a list of "embroidery-safe" fonts, measure the outlines:
 * rasterise each sample glyph and take the distance transform, which is
 * already how `stitchgen` decides satin-versus-fill. Same measurement, same
 * numbers, reported before the user commits.
 */

/**
 * Straight stems, round bowls, a diagonal and a join — between them these
 * cover the places a typeface goes thin.
 */
export const DEFAULT_STROKE_SAMPLE = 'HOnaseg';

/** Em size the measurement runs at. Stroke width scales linearly, so any size works. */
const MEASURE_SIZE = mmToUnits(20);

/** 0.05 mm cells: a 0.8 mm stroke is 16 cells across, plenty to measure. */
const MEASURE_CELL = mmToUnits(0.05);
const MEASURE_CELLS_ACROSS = 200;

/** Regions smaller than this share of a glyph are serifs and tittles, not strokes. */
const MIN_REGION_AREA_SHARE = 0.02;

export interface StrokeWidthMeasurement {
  /** Area-weighted mean of the per-region widths, in design units. */
  typicalWidth: number;
  /** The narrowest measured region — what actually decides whether satin works. */
  minWidth: number;
  maxWidth: number;
  regionCount: number;
  /** Em size these widths were measured at. */
  size: number;
}

/**
 * Measures stroke width at `size`. Widths scale linearly with size, so
 * `scaleMeasurement` can retarget a cached result instead of re-rasterising.
 */
export function measureStrokeWidth(
  font: EmbroideryFont,
  sample = DEFAULT_STROKE_SAMPLE,
  size = MEASURE_SIZE,
  tolerance = DEFAULT_GLYPH_TOLERANCE,
): StrokeWidthMeasurement | null {
  let weighted = 0;
  let totalArea = 0;
  let minWidth = Infinity;
  let maxWidth = 0;
  let regionCount = 0;

  for (const char of Array.from(sample)) {
    if (!font.hasGlyph(char)) continue;
    const rings = font.glyphRings(char, size, tolerance);
    if (rings.length === 0) continue;

    const regions = groupRingsIntoRegions(rings);
    const measured: { width: number; area: number }[] = [];
    let glyphArea = 0;
    for (const region of regions) {
      const stats = regionWidthStats(regionToRings(region), MEASURE_CELL, MEASURE_CELLS_ACROSS);
      if (!stats || stats.area <= 0 || stats.p90Width <= 0) continue;
      measured.push({ width: stats.p90Width, area: stats.area });
      glyphArea += stats.area;
    }

    for (const region of measured) {
      if (region.area < glyphArea * MIN_REGION_AREA_SHARE) continue;
      weighted += region.width * region.area;
      totalArea += region.area;
      if (region.width < minWidth) minWidth = region.width;
      if (region.width > maxWidth) maxWidth = region.width;
      regionCount++;
    }
  }

  if (regionCount === 0 || totalArea <= 0) return null;
  return { typicalWidth: weighted / totalArea, minWidth, maxWidth, regionCount, size };
}

/** Retargets a measurement to a different em size. Widths scale linearly. */
export function scaleMeasurement(
  measurement: StrokeWidthMeasurement,
  size: number,
): StrokeWidthMeasurement {
  const factor = size / Math.max(1, measurement.size);
  return {
    typicalWidth: measurement.typicalWidth * factor,
    minWidth: measurement.minWidth * factor,
    maxWidth: measurement.maxWidth * factor,
    regionCount: measurement.regionCount,
    size,
  };
}

export type FontSuitability = 'good' | 'thin' | 'too-thin' | 'wide';

export interface SuitabilityReport {
  suitability: FontSuitability;
  /** Widths at the size that was assessed, in mm. */
  typicalWidthMm: number;
  minWidthMm: number;
  /** Em size that would bring the thinnest stroke up to a comfortable satin width. */
  recommendedSize: number | null;
  message: string;
}

/**
 * Turns a measurement into something worth showing a user: a verdict, and when
 * the verdict is bad, the size that would fix it.
 */
export function assessSuitability(
  measurement: StrokeWidthMeasurement,
  size: number,
  settings: StitchSettings,
): SuitabilityReport {
  const at = scaleMeasurement(measurement, size);
  const typicalWidthMm = unitsToMm(at.typicalWidth);
  const minWidthMm = unitsToMm(at.minWidth);
  // 1.5x the bare minimum is where satin stops being fragile.
  const comfortable = settings.minSatinWidth * 1.5;
  const recommendedSize =
    at.minWidth > 0 ? Math.ceil((size * comfortable) / at.minWidth) : null;

  if (at.minWidth < settings.minSatinWidth) {
    return {
      suitability: 'too-thin',
      typicalWidthMm,
      minWidthMm,
      recommendedSize,
      message:
        `Strokes get down to ${minWidthMm.toFixed(2)} mm, below the ` +
        `${unitsToMm(settings.minSatinWidth).toFixed(1)} mm satin minimum — those parts will ` +
        `stitch as a single bean-stitch line. Try ${unitsToMm(recommendedSize ?? size).toFixed(0)} mm ` +
        `or a bolder weight.`,
    };
  }

  if (at.minWidth < comfortable) {
    return {
      suitability: 'thin',
      typicalWidthMm,
      minWidthMm,
      recommendedSize,
      message:
        `Thinnest strokes are ${minWidthMm.toFixed(2)} mm. That will stitch, but it is close to ` +
        `the limit — expect the fine parts to look delicate on stretchy fabric.`,
    };
  }

  if (at.typicalWidth > settings.maxSatinWidth) {
    return {
      suitability: 'wide',
      typicalWidthMm,
      minWidthMm,
      recommendedSize: null,
      message:
        `Strokes average ${typicalWidthMm.toFixed(1)} mm, wider than the ` +
        `${unitsToMm(settings.maxSatinWidth).toFixed(0)} mm satin limit, so the letters will be ` +
        `filled rather than satined. That is fine — it just reads flatter and takes more stitches.`,
    };
  }

  return {
    suitability: 'good',
    typicalWidthMm,
    minWidthMm,
    recommendedSize: null,
    message: `Strokes average ${typicalWidthMm.toFixed(1)} mm — a good satin width.`,
  };
}

/** Measure and assess in one call, when there is no cached measurement to reuse. */
export function assessFontAtSize(
  font: EmbroideryFont,
  size: number,
  settings: StitchSettings,
  sample = DEFAULT_STROKE_SAMPLE,
): SuitabilityReport | null {
  const measurement = measureStrokeWidth(font, sample);
  if (!measurement) return null;
  return assessSuitability(measurement, size, settings);
}

/**
 * The smallest capital-letter height this font can carry as satin, in design
 * units. This is the number to put in front of a user choosing a font: "at
 * least 8 mm tall" is advice they can act on, unlike an em size.
 */
export function minimumUsableCapHeight(
  font: EmbroideryFont,
  measurement: StrokeWidthMeasurement,
  settings: StitchSettings,
): number | null {
  if (measurement.minWidth <= 0) return null;
  const size = (measurement.size * settings.minSatinWidth * 1.5) / measurement.minWidth;
  return capHeightOf(font.metrics, size);
}
