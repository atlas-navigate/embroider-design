import { boundingBoxOfMany } from '../geometry/path.js';
import { groupRingsIntoRegions, type RingRegion } from '../geometry/regions.js';
import { mmToUnits } from '../pattern/units.js';
import { threadDistance, type ThreadColor } from '../pattern/thread.js';
import {
  borderColor,
  compositeOn,
  fitWithin,
  hasTransparency,
  type RgbaImage,
} from './image-data.js';
import { cleanMask, countMask, createMask, type Mask } from './mask-ops.js';
import { nearestPaletteIndex, quantizeImage, type QuantizeOptions } from './quantize.js';
import { traceMaskRings } from './trace.js';

/**
 * The whole image-to-stitches path, end to end.
 *
 * Resize, quantize, and then per colour: build a mask, clean it, trace it,
 * scale it into design units, and resolve which contour is a hole. What comes
 * out is one editable layer per thread colour — not a finished pattern. That
 * distinction matters: auto-digitizing is a starting point, and the result has
 * to stay adjustable in the same way a hand-drawn shape is.
 */

export interface AutoDigitizeOptions extends QuantizeOptions {
  /** Finished design width in 0.1 mm units. Height follows the aspect ratio. */
  targetWidth: number;
  /** Longest side of the working raster, in pixels. */
  maxDimension?: number;
  /**
   * Drop the colour that dominates the border. Almost always right for a logo
   * on white; wrong for a photograph you want stitched edge to edge.
   */
  removeBackground?: boolean;
  /** Morphological open/close radius, in working pixels. 0 disables. */
  morphology?: number;
  /** Regions covering less than this, in square mm, are not worth stitching. */
  minRegionAreaMm2?: number;
  /** Contour simplification, in design units. Defaults to one working pixel. */
  simplifyTolerance?: number;
}

export interface TracedColor {
  color: ThreadColor;
  /** Regions in design units, largest first. */
  regions: RingRegion[];
  /** Share of the working image this colour covered, 0-1. */
  coverage: number;
  pixelCount: number;
}

export interface AutoDigitizeResult {
  colors: TracedColor[];
  /** Design extent in 0.1 mm units. */
  width: number;
  height: number;
  /** The colour treated as background, if any. */
  background: ThreadColor | null;
  /** Colours whose regions were all too small to keep. */
  droppedColors: ThreadColor[];
  /** Working raster size, for reporting what the trace actually saw. */
  rasterWidth: number;
  rasterHeight: number;
}

const DEFAULT_MAX_DIMENSION = 512;
const DEFAULT_MIN_REGION_MM2 = 1;
/** Speckle threshold as a share of the working raster. */
const MIN_BLOB_SHARE = 0.0002;

function maskForIndex(indices: Uint8Array, target: number, width: number, height: number): Mask {
  const mask = createMask(width, height);
  for (let i = 0; i < indices.length; i++) mask.data[i] = indices[i] === target ? 1 : 0;
  return mask;
}

export function autoDigitizeImage(
  image: RgbaImage,
  options: AutoDigitizeOptions,
): AutoDigitizeResult {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const working = hasTransparency(image)
    ? compositeOn(fitWithin(image, maxDimension))
    : fitWithin(image, maxDimension);

  const quantized = quantizeImage(working, options);
  const unitsPerPixel = options.targetWidth / working.width;
  const designHeight = working.height * unitsPerPixel;

  let backgroundIndex = -1;
  if (options.removeBackground ?? true) {
    const [r, g, b] = borderColor(working);
    backgroundIndex = nearestPaletteIndex(quantized.palette, r, g, b);
  }

  const pixelTotal = working.width * working.height;
  const minBlobPixels = Math.max(2, Math.round(pixelTotal * MIN_BLOB_SHARE));
  const minRegionArea = mmToUnits(1) * mmToUnits(1) * (options.minRegionAreaMm2 ?? DEFAULT_MIN_REGION_MM2);

  const colors: TracedColor[] = [];
  const droppedColors: ThreadColor[] = [];

  for (let index = 0; index < quantized.palette.length; index++) {
    if (index === backgroundIndex) continue;
    const color = quantized.palette[index];
    const raw = maskForIndex(quantized.indices, index, working.width, working.height);
    const cleaned = cleanMask(raw, {
      morphology: options.morphology ?? 1,
      minArea: minBlobPixels,
    });
    const pixelCount = countMask(cleaned);
    if (pixelCount === 0) {
      droppedColors.push(color);
      continue;
    }

    const rings = traceMaskRings(cleaned, {
      scale: unitsPerPixel,
      simplifyTolerance: options.simplifyTolerance ?? unitsPerPixel,
      minArea: minRegionArea * 0.25,
    });
    const regions = groupRingsIntoRegions(rings).filter((region) => {
      const box = boundingBoxOfMany([region.outer]);
      if (!box) return false;
      return (box.maxX - box.minX) * (box.maxY - box.minY) >= minRegionArea;
    });

    if (regions.length === 0) {
      droppedColors.push(color);
      continue;
    }
    colors.push({
      color,
      regions,
      coverage: pixelCount / pixelTotal,
      pixelCount,
    });
  }

  // Broadest colour first: it is both the correct stacking order for nested
  // shapes and the right sewing order, since detail belongs on top.
  colors.sort((a, b) => b.coverage - a.coverage);

  return {
    colors,
    width: options.targetWidth,
    height: designHeight,
    background: backgroundIndex >= 0 ? quantized.palette[backgroundIndex] : null,
    droppedColors,
    rasterWidth: working.width,
    rasterHeight: working.height,
  };
}

/**
 * Merges colours that are visually near-identical.
 *
 * A quantizer asked for eight colours will give eight, even when two of them
 * differ by less than any thread you can buy. Collapsing those saves a whole
 * thread change for no visible loss.
 */
export function mergeSimilarColors(
  result: AutoDigitizeResult,
  threshold = 40,
): AutoDigitizeResult {
  const merged: TracedColor[] = [];
  for (const candidate of result.colors) {
    const existing = merged.find((entry) => threadDistance(entry.color, candidate.color) < threshold);
    if (!existing) {
      merged.push({ ...candidate, regions: [...candidate.regions] });
      continue;
    }
    existing.regions.push(...candidate.regions);
    existing.pixelCount += candidate.pixelCount;
    existing.coverage += candidate.coverage;
  }
  merged.sort((a, b) => b.coverage - a.coverage);
  return { ...result, colors: merged };
}
