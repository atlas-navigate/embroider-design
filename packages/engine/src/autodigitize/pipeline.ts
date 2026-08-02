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
import { createMask, dilateMask, type Mask } from './mask-ops.js';
import {
  backgroundLikeIndices,
  floodBackgroundMask,
  reassignSmallComponents,
  smoothIndexMap,
} from './partition.js';
import { nearestPaletteIndex, quantizeImage, type QuantizeOptions } from './quantize.js';
import { traceMaskRings } from './trace.js';

/**
 * The whole image-to-stitches path, end to end.
 *
 * Resize, quantize, and then treat the colour map as a partition: smooth it by
 * majority vote, flood the ground in from the border, give every too-small
 * component to its surroundings, and only then trace one mask per colour. The
 * partition rule is the point — a pixel may change colour on its way through,
 * but it is never simply deleted, because a deleted pixel comes back as bare
 * fabric inside the design. What comes out is one editable layer per thread
 * colour — not a finished pattern. That distinction matters: auto-digitizing
 * is a starting point, and the result has to stay adjustable in the same way
 * a hand-drawn shape is.
 */

export interface AutoDigitizeOptions extends QuantizeOptions {
  /** Finished design width in 0.1 mm units. Height follows the aspect ratio. */
  targetWidth: number;
  /** Longest side of the working raster, in pixels. */
  maxDimension?: number;
  /**
   * Drop the ground the border flood can reach. Almost always right for a
   * logo on white; wrong for a photograph you want stitched edge to edge.
   * Enclosed areas that merely match the ground colour — an eye-white inside
   * an outline — are kept and traced as colours of their own.
   */
  removeBackground?: boolean;
  /** Majority-vote smoothing radius on the colour map, in working pixels. 0 disables. */
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
  /** Colours that smoothed away, merged into their surroundings, or traced too small. */
  droppedColors: ThreadColor[];
  /** Working raster size, for reporting what the trace actually saw. */
  rasterWidth: number;
  rasterHeight: number;
}

const DEFAULT_MAX_DIMENSION = 512;
const DEFAULT_MIN_REGION_MM2 = 1;
/** Speckle threshold as a share of the working raster. */
const MIN_BLOB_SHARE = 0.0002;

function maskForIndex(
  indices: Uint8Array,
  target: number,
  background: Mask,
): Mask {
  const mask = createMask(background.width, background.height);
  for (let i = 0; i < indices.length; i++) {
    mask.data[i] = indices[i] === target && background.data[i] === 0 ? 1 : 0;
  }
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
  const paletteSize = quantized.palette.length;
  const unitsPerPixel = options.targetWidth / working.width;
  const designHeight = working.height * unitsPerPixel;

  const pixelTotal = working.width * working.height;
  const minBlobPixels = Math.max(2, Math.round(pixelTotal * MIN_BLOB_SHARE));
  const minRegionArea =
    mmToUnits(1) * mmToUnits(1) * (options.minRegionAreaMm2 ?? DEFAULT_MIN_REGION_MM2);
  /** The same keep-threshold the post-trace box filter applies, in pixels. */
  const minRegionPixels = minRegionArea / (unitsPerPixel * unitsPerPixel);

  // Smooth before finding the ground: smoothing folds the anti-aliasing
  // ribbons along colour boundaries into the solid colours beside them, and
  // the flood then reads a ribbon-free map.
  const smoothing = options.morphology ?? 1;
  let indices =
    smoothing > 0
      ? smoothIndexMap(quantized.indices, working.width, working.height, paletteSize, smoothing)
      : Uint8Array.from(quantized.indices);

  // The background is what the border flood reaches, not a palette entry. An
  // icon's eye-white shares an entry with the page it sits on, and deleting
  // the entry wholesale is how interiors used to come back as bare fabric.
  let backgroundIndex = -1;
  let groundEntries: ReadonlySet<number> = new Set<number>();
  let background = createMask(working.width, working.height);
  if (options.removeBackground ?? true) {
    const [r, g, b] = borderColor(working);
    backgroundIndex = nearestPaletteIndex(quantized.palette, r, g, b);
    const like = backgroundLikeIndices(quantized.palette, [r, g, b]);
    like.add(backgroundIndex);
    groundEntries = like;
    background = floodBackgroundMask(indices, working.width, working.height, like);
  }

  const reassigned = reassignSmallComponents(
    indices,
    working.width,
    working.height,
    paletteSize,
    { minPixels: minBlobPixels, minBoxPixels: minRegionPixels },
    background,
  );
  indices = reassigned.indices;
  background = reassigned.background;

  // Coverage is measured on the finished partition, before the seam-closing
  // dilation below, so the numbers describe the artwork rather than the trick.
  const pixelCounts = new Array<number>(paletteSize).fill(0);
  for (let i = 0; i < indices.length; i++) {
    if (background.data[i] === 0) pixelCounts[indices[i]]++;
  }
  const foregroundEntries = pixelCounts.filter((count) => count > 0).length;

  const colors: TracedColor[] = [];
  const droppedColors: ThreadColor[] = [];

  for (let index = 0; index < paletteSize; index++) {
    const color = quantized.palette[index];
    if (pixelCounts[index] === 0) {
      // An entry the flood consumed is the ground doing its job. An entry that
      // melted away in smoothing or reassignment was a colour too small to
      // keep, and the caller deserves to hear about it.
      if (!groundEntries.has(index)) droppedColors.push(color);
      continue;
    }

    let mask = maskForIndex(indices, index, background);
    // Adjacent colours are traced and simplified independently, which leaves
    // sub-pixel slivers of bare ground along shared boundaries. One pixel of
    // overlap closes them: an overlap is invisible under opaque fills, a gap
    // shows fabric. The dilation never enters the background, so the outer
    // silhouette stays exact.
    if (foregroundEntries > 1) {
      const dilated = dilateMask(mask, 1);
      for (let i = 0; i < dilated.data.length; i++) {
        if (background.data[i] !== 0) dilated.data[i] = 0;
      }
      mask = dilated;
    }

    const rings = traceMaskRings(mask, {
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
      coverage: pixelCounts[index] / pixelTotal,
      pixelCount: pixelCounts[index],
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
