import type { BoundingBox } from '../geometry/path.js';
import {
  compositeOn,
  createRgbaImage,
  fitWithin,
  hasTransparency,
  type Rgb,
  type RgbaImage,
} from './image-data.js';
import { closeMask, createMask, labelComponents, type Mask } from './mask-ops.js';

/**
 * Cutting a sheet of icons into its individual icons.
 *
 * Clip-art is sold as a page: thirty little drawings laid out in rows on a
 * white ground. Handed to `autoDigitizeImage` whole, that page becomes one
 * design thirty icons wide, which is useless. This module is the step before —
 * find where each icon is, and hand back one small image per icon that the
 * existing pipeline can digitize exactly as if it had been imported on its own.
 *
 * Everything here is assembled from `mask-ops` and `image-data`; there is no
 * new image processing. The two decisions that are actually load-bearing are
 * both about *not* letting neighbours contaminate each other:
 *
 *   - a cell is cropped by **component membership**, not by its bounding box.
 *     Two icons whose boxes overlap — a tall one beside a wide one — would
 *     otherwise each carry a slice of the other into the trace.
 *   - a crop is **padded**, so its outermost ring of pixels is ground rather
 *     than ink. `autoDigitizeImage` calls `borderColor` on what it is given; a
 *     crop cut flush to the drawing tells it the icon's own edge is the
 *     background, and it then erases the icon.
 */

/**
 * Where a cell sits in the working raster.
 *
 * `min` is inclusive and `max` exclusive, so `maxX - minX` is the width in
 * pixels and the box can be used with `boundingBoxWidth` unchanged.
 */
export interface SheetCell {
  /** Reading order: rows top to bottom, left to right within a row. */
  index: number;
  box: BoundingBox;
  /** The crop, ready for `autoDigitizeImage`. */
  image: RgbaImage;
  /** Ink pixels the cell contains, for ranking and for reporting. */
  pixelCount: number;
}

export interface SheetScan {
  cells: SheetCell[];
  /**
   * The working raster `box` is measured in. The caller needs this to draw the
   * boxes over its own preview: recomputing the downscale in the UI is how the
   * preview and the crop drift apart.
   */
  width: number;
  height: number;
  /** The colour treated as the page's ground. */
  background: Rgb;
  /**
   * The drawings ran together into one page-sized mass.
   *
   * Always the same cause: `backgroundTolerance` is below the page's own
   * noise, so the ground itself counts as ink and every icon is joined to
   * every other through it. A photograph of stitching on woven fabric does
   * this at any tolerance tuned for clip-art on white.
   *
   * The result is not empty when this is set — one stray speck usually
   * survives the size filters — which is exactly why it needs saying out loud.
   * A caller that ignores it shows the user a single meaningless cell and no
   * clue what to change.
   */
  crowded: boolean;
}

export interface SheetScanOptions {
  /**
   * How far a pixel's brightest channel has to be from the page's ground before
   * it counts as ink. Low enough and a JPEG's mottled white becomes ink; high
   * enough and a pale icon disappears.
   */
  backgroundTolerance?: number;
  /**
   * Close radius, in working pixels, applied before the icons are separated.
   * This is the one control that matters: it welds an icon's own detached
   * pieces — a sparkle beside a candle, a dot over an i — into a single icon,
   * and pushed too far it welds neighbouring icons into one.
   */
  separation?: number;
  /** Below this share of the page a blob is speckle, not an icon. */
  minCellShare?: number;
  /** Above this share it is a border, a banner or a background panel. */
  maxCellShare?: number;
  /** Longest side of the working raster. */
  maxDimension?: number;
  /** Ground-coloured margin left around each crop, in working pixels. */
  padding?: number;
}

/**
 * 1400, not the 512 `autoDigitizeImage` works at.
 *
 * That 512 is the right size for *one* design filling the frame. Spread across
 * a six-by-five sheet it leaves each icon about eighty pixels across, which is
 * below what the tracer can hold a keyline at — the outline breaks up and the
 * icon comes back as confetti.
 */
const DEFAULT_MAX_DIMENSION = 1400;
const DEFAULT_TOLERANCE = 28;
const DEFAULT_SEPARATION = 2;
const DEFAULT_MIN_CELL_SHARE = 0.0005;
const DEFAULT_MAX_CELL_SHARE = 0.25;
const DEFAULT_PADDING = 3;

/**
 * A component covering nearly the whole page in both directions is a frame or a
 * rule, however few pixels it actually contains. The share test alone misses it
 * — a one-pixel border round an A4 sheet is a fraction of a percent of it.
 */
const FRAME_SPAN = 0.9;

/**
 * Past this many cells the contact sheet is unreadable and the import would run
 * for minutes. Hitting it means the settings are wrong, so the biggest cells
 * are kept and the user is left to raise the minimum size.
 */
const MAX_CELLS = 200;

/**
 * How much of the page a rejected blob must fill, *on top of* reaching across
 * it, before the mask counts as having run together.
 *
 * Both conditions are needed, and area alone is the one that misleads. A
 * single large drawing centred on a page is easily half of it, so area would
 * call that crowded and suppress the very fallback that exists to handle it.
 * What a runaway mask does and a drawing does not is reach every edge *and*
 * stay solid on the way across.
 */
const CROWDED_SHARE = 0.4;

interface PreparedSheet {
  working: RgbaImage;
  background: Rgb;
  /** Pixels far enough from the ground to be part of a drawing. */
  ink: Mask;
}

function prepareSheet(image: RgbaImage, options: SheetScanOptions): PreparedSheet {
  // Downscale first and flatten second: `hasTransparency` walks every pixel,
  // and there is no reason to walk the original's when the working copy decides
  // everything downstream anyway.
  const scaled = fitWithin(image, options.maxDimension ?? DEFAULT_MAX_DIMENSION);
  const working = hasTransparency(scaled) ? compositeOn(scaled) : scaled;
  const background = pageBackground(working);
  return { working, background, ink: inkMask(working, background, options) };
}

/** How far in from each edge the ground is sampled, as a share of the page. */
const MARGIN_BAND = 0.15;

/**
 * The page's ground: the commonest colour in a band around the margin.
 *
 * Neither obvious rule survives on its own, and each fails on a page the other
 * handles:
 *
 *   - `borderColor` samples the outermost *ring* of pixels. A sheet printed
 *     with a border makes that ring entirely frame, the ink mask comes out
 *     inverted, and every icon vanishes into one page-sized blob.
 *   - the mode of the whole image fails the moment one drawing covers more
 *     than half the page, because the drawing then *is* the commonest colour
 *     and the ground becomes the ink.
 *
 * A band deep enough to drown a printed rule, but still all margin, is right in
 * both cases: a two-pixel frame is a rounding error within it, and a drawing
 * big enough to dominate the page still leaves the margin as ground.
 *
 * Bucketed to 16 levels per channel for the same reason `borderColor` does it:
 * a JPEG's white is never one value.
 */
function pageBackground(image: RgbaImage): Rgb {
  const insetX = Math.floor(image.width * MARGIN_BAND);
  const insetY = Math.floor(image.height * MARGIN_BAND);

  const counts = new Map<number, number>();
  const record = (x: number, y: number): void => {
    const i = (y * image.width + x) * 4;
    const key =
      ((image.data[i] >> 4) << 8) | ((image.data[i + 1] >> 4) << 4) | (image.data[i + 2] >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  for (let y = 0; y < image.height; y++) {
    const throughout = y < insetY || y >= image.height - insetY;
    for (let x = 0; x < image.width; x++) {
      // Every pixel of the top and bottom bands; only the left and right
      // margins of the rows between them.
      if (throughout || x < insetX || x >= image.width - insetX) record(x, y);
    }
  }

  let bestKey = 0;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }
  // The middle of the bucket rather than an edge, so the tolerance is symmetric
  // around it.
  return [
    (((bestKey >> 8) & 0xf) << 4) | 8,
    (((bestKey >> 4) & 0xf) << 4) | 8,
    ((bestKey & 0xf) << 4) | 8,
  ];
}

/**
 * Chebyshev distance rather than Euclidean, deliberately: a pale yellow on
 * white differs in one channel only, and averaging that across three channels
 * buries it below any tolerance that also rejects JPEG noise.
 */
function inkMask(image: RgbaImage, background: Rgb, options: SheetScanOptions): Mask {
  const tolerance = options.backgroundTolerance ?? DEFAULT_TOLERANCE;
  const mask = createMask(image.width, image.height);
  for (let i = 0; i < image.width * image.height; i++) {
    const distance = Math.max(
      Math.abs(image.data[i * 4] - background[0]),
      Math.abs(image.data[i * 4 + 1] - background[1]),
      Math.abs(image.data[i * 4 + 2] - background[2]),
    );
    mask.data[i] = distance > tolerance ? 1 : 0;
  }
  return mask;
}

/** One blob, or several that turned out to be the same icon. */
interface Candidate {
  labels: Set<number>;
  box: BoundingBox;
  pixelCount: number;
}

function boxArea(box: BoundingBox): number {
  return Math.max(0, box.maxX - box.minX) * Math.max(0, box.maxY - box.minY);
}

function overlapArea(a: BoundingBox, b: BoundingBox): number {
  const width = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const height = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  return width > 0 && height > 0 ? width * height : 0;
}

/**
 * Merges candidates that sit on top of one another.
 *
 * An icon whose pieces stayed separate through the close — a snowman's hat
 * floating above his head, a shadow under a mug — arrives here as two
 * components with heavily overlapping boxes. Putting them back together this
 * way is much safer than raising `separation` until they touch, which welds
 * neighbours long before it joins these.
 *
 * Half the smaller box is the threshold: two icons in a row can clip each
 * other's boxes by a few percent and must stay apart.
 */
function mergeOverlapping(candidates: Candidate[]): Candidate[] {
  const merged = [...candidates];
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        const shared = overlapArea(merged[i].box, merged[j].box);
        if (shared <= 0) continue;
        const smaller = Math.min(boxArea(merged[i].box), boxArea(merged[j].box));
        if (smaller <= 0 || shared < smaller * 0.5) continue;
        merged[i] = {
          labels: new Set([...merged[i].labels, ...merged[j].labels]),
          box: {
            minX: Math.min(merged[i].box.minX, merged[j].box.minX),
            minY: Math.min(merged[i].box.minY, merged[j].box.minY),
            maxX: Math.max(merged[i].box.maxX, merged[j].box.maxX),
            maxY: Math.max(merged[i].box.maxY, merged[j].box.maxY),
          },
          pixelCount: merged[i].pixelCount + merged[j].pixelCount,
        };
        merged.splice(j, 1);
        changed = true;
        break outer;
      }
    }
  }
  return merged;
}

/**
 * Reading order.
 *
 * A new row starts at the first candidate that begins below everything already
 * in the current row, which is the "does not overlap this row vertically" rule.
 * It handles a ruled grid exactly and a hand-arranged sheet tolerably, and it
 * degrades into one long row rather than into nonsense.
 */
function inReadingOrder(candidates: readonly Candidate[]): Candidate[] {
  const byTop = [...candidates].sort((a, b) => a.box.minY - b.box.minY);
  const rows: Candidate[][] = [];
  let rowBottom = Number.NEGATIVE_INFINITY;
  for (const candidate of byTop) {
    if (rows.length === 0 || candidate.box.minY >= rowBottom) {
      rows.push([candidate]);
      rowBottom = candidate.box.maxY;
    } else {
      rows[rows.length - 1].push(candidate);
      rowBottom = Math.max(rowBottom, candidate.box.maxY);
    }
  }
  return rows.flatMap((row) => row.sort((a, b) => a.box.minX - b.box.minX));
}

function padded(box: BoundingBox, padding: number): BoundingBox {
  return {
    minX: box.minX - padding,
    minY: box.minY - padding,
    maxX: box.maxX + padding,
    maxY: box.maxY + padding,
  };
}

/**
 * Copies a box out of the working raster.
 *
 * `foreign` decides, per source pixel, whether it belongs to somebody else. Any
 * pixel it rejects — and any pixel outside the raster entirely — is written as
 * ground, so the crop has exactly one background colour and `removeBackground`
 * downstream has something uniform to find.
 */
function cropRegion(
  working: RgbaImage,
  box: BoundingBox,
  background: Rgb,
  foreign: (x: number, y: number) => boolean,
): RgbaImage {
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const out = createRgbaImage(width, height, background);
  for (let y = 0; y < height; y++) {
    const sourceY = box.minY + y;
    if (sourceY < 0 || sourceY >= working.height) continue;
    for (let x = 0; x < width; x++) {
      const sourceX = box.minX + x;
      if (sourceX < 0 || sourceX >= working.width) continue;
      if (foreign(sourceX, sourceY)) continue;
      const from = (sourceY * working.width + sourceX) * 4;
      const to = (y * width + x) * 4;
      out.data[to] = working.data[from];
      out.data[to + 1] = working.data[from + 1];
      out.data[to + 2] = working.data[from + 2];
      out.data[to + 3] = 255;
    }
  }
  return out;
}

/**
 * Finds the icons on a sheet.
 *
 * Returns them in reading order. An image the filters reject entirely — one
 * large drawing, which is a perfectly reasonable thing to drop in here — comes
 * back as a single cell around all of its ink rather than as nothing.
 */
export function scanIconSheet(image: RgbaImage, options: SheetScanOptions = {}): SheetScan {
  const { working, background, ink } = prepareSheet(image, options);
  const separation = options.separation ?? DEFAULT_SEPARATION;
  const welded = separation > 0 ? closeMask(ink, separation) : ink;
  const { labels, sizes } = labelComponents(welded);

  const boxes: (BoundingBox | null)[] = sizes.map(() => null);
  for (let y = 0; y < working.height; y++) {
    for (let x = 0; x < working.width; x++) {
      const label = labels[y * working.width + x];
      if (label < 0) continue;
      const box = boxes[label];
      if (!box) {
        boxes[label] = { minX: x, minY: y, maxX: x + 1, maxY: y + 1 };
      } else {
        if (x < box.minX) box.minX = x;
        if (y < box.minY) box.minY = y;
        if (x + 1 > box.maxX) box.maxX = x + 1;
        if (y + 1 > box.maxY) box.maxY = y + 1;
      }
    }
  }

  const total = working.width * working.height;
  const minPixels = Math.max(4, Math.round(total * (options.minCellShare ?? DEFAULT_MIN_CELL_SHARE)));
  const maxPixels = Math.round(total * (options.maxCellShare ?? DEFAULT_MAX_CELL_SHARE));

  let candidates: Candidate[] = [];
  let crowded = false;
  for (let label = 0; label < sizes.length; label++) {
    const box = boxes[label];
    if (!box) continue;
    const spansPage =
      box.maxX - box.minX >= working.width * FRAME_SPAN &&
      box.maxY - box.minY >= working.height * FRAME_SPAN;
    if (sizes[label] < minPixels || sizes[label] > maxPixels || spansPage) {
      if (spansPage && sizes[label] > total * CROWDED_SHARE) crowded = true;
      continue;
    }
    candidates.push({ labels: new Set([label]), box, pixelCount: sizes[label] });
  }

  candidates = mergeOverlapping(candidates);

  if (candidates.length > MAX_CELLS) {
    candidates = [...candidates]
      .sort((a, b) => b.pixelCount - a.pixelCount)
      .slice(0, MAX_CELLS);
  }

  // Nothing survived, but there was ink: the page holds one drawing rather than
  // a sheet of them. Returning it as a single cell is more useful than an empty
  // result the user cannot act on.
  // ...unless the mask ran together, where the "one drawing" is the whole page
  // of noise and handing it back would be worse than an empty result.
  if (candidates.length === 0 && !crowded) {
    const whole = maskBounds(ink);
    if (whole) {
      candidates = [
        {
          labels: new Set(allLabelsWithin(labels, working.width, whole)),
          box: whole,
          pixelCount: countWithin(ink, whole),
        },
      ];
    }
  }

  const padding = options.padding ?? DEFAULT_PADDING;
  const cells = inReadingOrder(candidates).map((candidate, index): SheetCell => {
    const box = padded(candidate.box, padding);
    return {
      index,
      box,
      pixelCount: candidate.pixelCount,
      image: cropRegion(working, box, background, (x, y) => {
        const label = labels[y * working.width + x];
        return label >= 0 && !candidate.labels.has(label);
      }),
    };
  });

  return { cells, width: working.width, height: working.height, background, crowded };
}

/**
 * Cuts a sheet into equal cells.
 *
 * The escape hatch for a page `scanIconSheet` cannot read: one that is ruled
 * into boxes, or captioned under every icon, or drawn so the icons touch. Each
 * cell is then trimmed to its own ink, so a grid that is roughly right still
 * yields tightly cropped icons.
 */
export function sliceSheetGrid(
  image: RgbaImage,
  rows: number,
  columns: number,
  options: SheetScanOptions = {},
): SheetScan {
  const { working, background, ink } = prepareSheet(image, options);
  const rowCount = Math.max(1, Math.round(rows));
  const columnCount = Math.max(1, Math.round(columns));
  const padding = options.padding ?? DEFAULT_PADDING;

  const cells: SheetCell[] = [];
  // Grid mode never labels components, so it reads the same symptom off the
  // trimming instead: a cell whose ink reaches every edge of its cut has not
  // been trimmed at all, and a page of those is a mask that ran together.
  let untrimmed = 0;
  for (let row = 0; row < rowCount; row++) {
    for (let column = 0; column < columnCount; column++) {
      const cut: BoundingBox = {
        minX: Math.round((column * working.width) / columnCount),
        minY: Math.round((row * working.height) / rowCount),
        maxX: Math.round(((column + 1) * working.width) / columnCount),
        maxY: Math.round(((row + 1) * working.height) / rowCount),
      };
      const trimmed = maskBounds(ink, cut);
      if (!trimmed) continue;
      if (
        trimmed.maxX - trimmed.minX >= (cut.maxX - cut.minX) * FRAME_SPAN &&
        trimmed.maxY - trimmed.minY >= (cut.maxY - cut.minY) * FRAME_SPAN
      ) {
        untrimmed++;
      }

      const box = padded(trimmed, padding);
      cells.push({
        index: cells.length,
        box,
        pixelCount: countWithin(ink, trimmed),
        // Anything outside this grid cell is somebody else's, including the
        // padding ring — so the neighbour never bleeds in even when the icons
        // are drawn right up to the rule.
        image: cropRegion(
          working,
          box,
          background,
          (x, y) => x < cut.minX || x >= cut.maxX || y < cut.minY || y >= cut.maxY,
        ),
      });
    }
  }

  return {
    cells,
    width: working.width,
    height: working.height,
    background,
    crowded: cells.length > 0 && untrimmed > cells.length / 2,
  };
}

/** Bounds of the set pixels, optionally restricted to a window. */
function maskBounds(mask: Mask, within?: BoundingBox): BoundingBox | null {
  const x0 = Math.max(0, within?.minX ?? 0);
  const y0 = Math.max(0, within?.minY ?? 0);
  const x1 = Math.min(mask.width, within?.maxX ?? mask.width);
  const y1 = Math.min(mask.height, within?.maxY ?? mask.height);

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (mask.data[y * mask.width + x] === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + 1 > maxX) maxX = x + 1;
      if (y + 1 > maxY) maxY = y + 1;
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

function countWithin(mask: Mask, box: BoundingBox): number {
  let count = 0;
  for (let y = Math.max(0, box.minY); y < Math.min(mask.height, box.maxY); y++) {
    for (let x = Math.max(0, box.minX); x < Math.min(mask.width, box.maxX); x++) {
      count += mask.data[y * mask.width + x];
    }
  }
  return count;
}

function allLabelsWithin(labels: Int32Array, width: number, box: BoundingBox): number[] {
  const found = new Set<number>();
  for (let y = box.minY; y < box.maxY; y++) {
    for (let x = box.minX; x < box.maxX; x++) {
      const label = labels[y * width + x];
      if (label >= 0) found.add(label);
    }
  }
  return [...found];
}
