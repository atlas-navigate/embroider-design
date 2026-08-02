import type { BoundingBox } from '../geometry/path.js';
import {
  compositeOn,
  createRgbaImage,
  fitWithin,
  hasTransparency,
  type Rgb,
  type RgbaImage,
} from './image-data.js';
import { despeckleMask, labelComponents, openMask, type Mask } from './mask-ops.js';
import {
  adaptiveInkMask,
  estimateBackgroundField,
  estimateCoarseField,
  MAX_AUTOMATIC_TOLERANCE,
  type BackgroundField,
  type InkMaskResult,
} from './sheet-background.js';
import {
  chooseClusterRadius,
  classifyClusters,
  clusterComponents,
  componentGaps,
  findRegions,
  findTextRows,
  isStructuralComponent,
  reachWithin,
  type Cluster,
  type Component,
  type LabelReason,
  type SeparationBasis,
} from './sheet-cluster.js';

/**
 * Cutting a sheet of icons into its individual icons.
 *
 * Clip-art is sold as a page: thirty little drawings laid out in rows on a
 * ground. Handed to `autoDigitizeImage` whole, that page becomes one design
 * thirty icons wide, which is useless. This module is the step before — find
 * where each icon is, and hand back one small image per icon that the existing
 * pipeline can digitize exactly as if it had been imported on its own.
 *
 * Three decisions are load-bearing, and each of them is here because the
 * obvious alternative fails on real pages rather than on principle:
 *
 *   - the ground is measured **per region and per page-noise**, not as one
 *     colour with one tolerance. See `sheet-background.ts`. A sheet on linen,
 *     or photographed under a lamp, or carrying cream drawings on cream paper,
 *     has no single right threshold.
 *   - icons are grouped **by proximity**, not by contact. See
 *     `sheet-cluster.ts`. An icon's pieces frequently do not touch, and no
 *     amount of morphological closing joins them without also joining their
 *     neighbours.
 *   - the crop is taken from the **original image**, not from the raster the
 *     detection ran on. Detection wants a small raster and tracing wants every
 *     pixel there is; doing both on one raster means one of them is wrong, and
 *     for a fifty-icon sheet it is tracing, at ninety pixels an icon.
 *
 * And one that was already here and still is: a crop is **padded**, so its
 * outermost ring is ground rather than ink. `autoDigitizeImage` calls
 * `borderColor` on what it is given; a crop cut flush to the drawing tells it
 * the icon's own edge is the background, and it then erases the icon.
 */

/**
 * Where a cell sits, and how to get its pixels.
 *
 * `min` is inclusive and `max` exclusive, so `maxX - minX` is the width in
 * pixels and the box can be used with `boundingBoxWidth` unchanged.
 */
export interface SheetCell {
  /** Reading order: rows top to bottom, left to right within a row. */
  index: number;
  /**
   * Where the cell sits in the working raster — the coordinates `SheetScan`'s
   * `width` and `height` are in, and the ones to draw a preview with.
   */
  box: BoundingBox;
  /** The same region in the original image's coordinates. */
  sourceBox: BoundingBox;
  /** Ink pixels the cell contains, for ranking and for reporting. */
  pixelCount: number;
  /**
   * This looks like a caption, a heading, a format row or a stray mark rather
   * than an icon.
   *
   * Never a reason to drop it. The classifier is a good guess and not more than
   * that, and a sheet where it guesses wrong has to cost the user one click,
   * not a missing icon they never learn about. Callers should leave these out
   * of the default selection and say how many they left out.
   */
  likelyLabel: boolean;
  labelReason?: LabelReason;
  /**
   * The crop, at the original image's resolution, ready for `autoDigitizeImage`.
   *
   * Built on demand and not cached. A two-hundred cell sheet at three times the
   * working resolution is seventy megabytes of pixels, and the scan re-runs on
   * every move of every slider; the import walks the cells one at a time and
   * needs exactly one of them alive at once.
   */
  crop(): RgbaImage;
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
  /** The original image, which `sourceBox` and `crop()` are measured in. */
  sourceWidth: number;
  sourceHeight: number;
  /** `sourceWidth / width`. One when the sheet was small enough to use whole. */
  scale: number;
  /** The colour treated as the page's ground, page-wide. */
  background: Rgb;
  /**
   * The drawings ran together into one page-sized mass.
   *
   * With the ground measured locally this is now rare, and when it happens it
   * means the page has no readable ground at all rather than that a slider is
   * set wrong — a photograph where the subject fills the frame, or a page whose
   * "background" is itself a picture. The result is not empty when this is set,
   * which is exactly why it needs saying out loud: one stray speck usually
   * survives, and a caller that ignores this shows the user a single meaningless
   * cell and no clue what to do.
   */
  crowded: boolean;
  /** The joining distance used, and whether it was measured or given. */
  separationUsed: number;
  separationBasis: SeparationBasis;
  /** The ink thresholds used, so a caller can show what Auto decided. */
  toleranceUsed: number;
  softToleranceUsed: number;
  /** The page's own grain, as measured. */
  noiseFloor: number;
  /** How many cells came back flagged as captions or stray marks. */
  labelCount: number;
}

export interface SheetScanOptions {
  /**
   * How far a pixel has to be from its local ground before it counts as ink.
   *
   * Omitted, it is measured from the page's own noise, which is almost always
   * better than a number typed in — the right value differs by a factor of ten
   * between a clean JPEG and a photograph of linen.
   */
  backgroundTolerance?: number;
  /** Override for the neighbourhood test that finds pale-on-pale drawings. */
  softTolerance?: number;
  /**
   * How far apart two marks can be and still be the same icon, in working
   * pixels.
   *
   * This is the one control that matters: it decides whether a flame joins its
   * candle and whether two icons in a row stay two icons. Omitted, it is
   * measured from the spacing of the page's own marks.
   *
   * Note this changed meaning: it used to be a morphological close radius, and
   * its useful range was single digits. As a distance it runs to a hundred or
   * more on a sparse page.
   */
  separation?: number;
  /**
   * Below this share of the page a cell is dropped outright.
   *
   * Zero by default, and it should usually stay there. A share of the whole
   * page means something completely different on a sheet of four icons and a
   * sheet of fifty-six, and applying it cost this importer whole icons: a piece
   * of an icon was deleted for being small before it had the chance to rejoin
   * the icon it belonged to. `minCellFraction` is the replacement, and it is
   * measured against the other cells on the page instead.
   */
  minCellShare?: number;
  /** Above this share a cell is a border, a banner or a background panel. */
  maxCellShare?: number;
  /** Below this share of the median cell's area, a cell is flagged as a stray mark. */
  minCellFraction?: number;
  /** Longest side of the working raster the detection runs on. */
  maxDimension?: number;
  /** Ground-coloured margin left around each crop, in working pixels. */
  padding?: number;
  /** Off, the whole page gets one ground colour and one flat tolerance. */
  localBackground?: boolean;
  /** Off, crops come from the working raster rather than from the original. */
  fullResolutionCrops?: boolean;
}

/**
 * 1400, not the 512 `autoDigitizeImage` works at.
 *
 * This is a detection resolution now, not a tracing one — the crop is cut from
 * the original — so it only has to be fine enough to tell two icons apart and
 * to hold a thin keyline together as one component. Below about a thousand the
 * hairlines on a dense line-art sheet start breaking into dashes.
 */
const DEFAULT_MAX_DIMENSION = 1400;
const DEFAULT_MAX_CELL_SHARE = 0.25;
const DEFAULT_PADDING = 3;

/**
 * Past this many cells the contact sheet is unreadable and the import would run
 * for minutes. Hitting it means the settings are wrong, so the biggest cells
 * are kept and the user is left to raise the minimum size.
 */
const MAX_CELLS = 400;

/**
 * A component reaching across the page in both directions, and solid on the way
 * across, is a mask that has run together rather than a drawing.
 *
 * Both conditions are needed, and area alone is the one that misleads. A single
 * large drawing centred on a page is easily half of it, so area would call that
 * crowded and suppress the very fallback that exists to handle it.
 */
const CROWDED_SPAN = 0.9;
const CROWDED_SHARE = 0.4;
/** An ink share this high, at the top of the automatic range, means it gave up. */
const CROWDED_INK_SHARE = 0.6;

/** Absolute speckle floor, as a share of the working raster. */
const MIN_INK_SHARE = 1.5e-6;
const MIN_INK_PIXELS = 6;

/** `maxCellShare` only means anything when there is a page of cells to compare against. */
const MAX_SHARE_MIN_CLUSTERS = 4;

interface PreparedSheet {
  /** The original image, flattened if it carried transparency. */
  source: RgbaImage;
  working: RgbaImage;
  scaleX: number;
  scaleY: number;
  field: BackgroundField;
  ink: InkMaskResult;
}

function prepareSheet(image: RgbaImage, options: SheetScanOptions): PreparedSheet {
  // Downscale first and test for alpha second: `hasTransparency` walks every
  // pixel, and there is no reason to walk four thousand squared of them when
  // the working copy answers the same question. A downscale averages alpha
  // rather than dropping it, so a transparent original still reads transparent
  // here.
  const scaled = fitWithin(image, options.maxDimension ?? DEFAULT_MAX_DIMENSION);
  const transparent = hasTransparency(scaled);
  const working = transparent ? compositeOn(scaled) : scaled;
  const source =
    options.fullResolutionCrops === false
      ? working
      : transparent
        ? compositeOn(image)
        : image;

  const field = estimateBackgroundField(working);
  const ink = adaptiveInkMask(working, field, estimateCoarseField(working, field), options);
  return {
    source,
    working,
    scaleX: source.width / working.width,
    scaleY: source.height / working.height,
    field,
    ink,
  };
}

/**
 * Removes what the ink test got wrong, in the two ways it gets things wrong.
 *
 * The despeckle always runs and is nearly free of side effects: it drops blobs
 * smaller than any mark drawn on purpose, and touches nothing else.
 *
 * The open runs only on a page that needs it, because it is not free. A square
 * erode of radius one deletes every one-pixel stroke on the page — a sheet of
 * fine line art is largely one-pixel strokes — and widens every gap between two
 * icons by two pixels, which then has to be paid back in the joining distance.
 * On a clean page there is nothing for it to remove and it does that damage for
 * no return, so it is skipped. On a woven or photographed page the grain
 * clumps, the despeckle alone cannot keep up, and the open earns its cost.
 */
const OPEN_AT_NOISE = 3;
const OPEN_HARDER_AT_NOISE = 6;

function cleanInk(ink: Mask, noiseFloor: number, total: number): Mask {
  const radius =
    noiseFloor >= OPEN_HARDER_AT_NOISE ? 2 : noiseFloor >= OPEN_AT_NOISE ? 1 : 0;
  const opened = radius > 0 ? openMask(ink, radius) : ink;
  return despeckleMask(opened, Math.max(MIN_INK_PIXELS, Math.round(total * MIN_INK_SHARE)));
}

function componentBoxes(labels: Int32Array, width: number, height: number, count: number): (BoundingBox | null)[] {
  const boxes: (BoundingBox | null)[] = new Array(count).fill(null);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const label = labels[y * width + x];
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
  return boxes;
}

/**
 * Reading order.
 *
 * A new row starts at the first cell that begins below everything already in
 * the current row, which is the "does not overlap this row vertically" rule. It
 * handles a ruled grid exactly and a hand-arranged sheet tolerably, and it
 * degrades into one long row rather than into nonsense.
 */
function inReadingOrder(clusters: readonly Cluster[]): Cluster[] {
  const byTop = [...clusters].sort((a, b) => a.box.minY - b.box.minY);
  const rows: Cluster[][] = [];
  let rowBottom = Number.NEGATIVE_INFINITY;
  for (const cluster of byTop) {
    if (rows.length === 0 || cluster.box.minY >= rowBottom) {
      rows.push([cluster]);
      rowBottom = cluster.box.maxY;
    } else {
      rows[rows.length - 1].push(cluster);
      rowBottom = Math.max(rowBottom, cluster.box.maxY);
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
 * The same region, in the original image's pixels.
 *
 * Outward on both sides, so the crop never loses a row the working raster said
 * was inside the box. Applied to the already-padded box, which keeps `padding`
 * meaning what it says — working pixels — while the ring it produces stays the
 * same width on screen whatever the sheet's resolution.
 */
function mapToSource(box: BoundingBox, scaleX: number, scaleY: number): BoundingBox {
  return {
    minX: Math.floor(box.minX * scaleX),
    minY: Math.floor(box.minY * scaleY),
    maxX: Math.ceil(box.maxX * scaleX),
    maxY: Math.ceil(box.maxY * scaleY),
  };
}

/**
 * Copies a box out of the image.
 *
 * `foreign` decides, per source pixel, whether it belongs to somebody else. Any
 * pixel it rejects — and any pixel outside the image entirely — is written as
 * ground, so a neighbour reaching into this crop's padding arrives as page
 * rather than as a stray mark the tracer would then draw.
 *
 * Pixels that are simply *not ink* are copied through untouched rather than
 * flattened to the ground colour. That ring of anti-aliased grey around every
 * stroke is what lets the tracer put an edge where the artist put one; painting
 * over it would hard-edge the whole icon.
 */
function cropRegion(
  image: RgbaImage,
  box: BoundingBox,
  background: Rgb,
  foreign: (x: number, y: number) => boolean,
): RgbaImage {
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const out = createRgbaImage(Math.max(1, width), Math.max(1, height), background);
  for (let y = 0; y < height; y++) {
    const sourceY = box.minY + y;
    if (sourceY < 0 || sourceY >= image.height) continue;
    for (let x = 0; x < width; x++) {
      const sourceX = box.minX + x;
      if (sourceX < 0 || sourceX >= image.width) continue;
      if (foreign(sourceX, sourceY)) continue;
      const from = (sourceY * image.width + sourceX) * 4;
      const to = (y * width + x) * 4;
      out.data[to] = image.data[from];
      out.data[to + 1] = image.data[from + 1];
      out.data[to + 2] = image.data[from + 2];
      out.data[to + 3] = 255;
    }
  }
  return out;
}

/** Not this cell's, and not the page's either: another icon, or a printed rule. */
const PAGE = -1;
const BLOCKED = -2;

/**
 * Finds the icons on a sheet.
 *
 * Returns them in reading order. An image the filters reject entirely — one
 * large drawing, which is a perfectly reasonable thing to drop in here — comes
 * back as a single cell around all of its ink rather than as nothing.
 */
export function scanIconSheet(image: RgbaImage, options: SheetScanOptions = {}): SheetScan {
  const { source, working, scaleX, scaleY, field, ink } = prepareSheet(image, options);
  const total = working.width * working.height;
  const cleaned = cleanInk(ink.mask, ink.noiseFloor, total);
  const { labels, sizes } = labelComponents(cleaned);
  const boxes = componentBoxes(labels, working.width, working.height, sizes.length);

  // Rules and frames go before anything else looks at the page. One hairline
  // left in would sit within a few pixels of every icon it passes, and single
  // link would then thread the entire sheet onto it as one cluster.
  const blocked = new Set<number>();
  const components: Component[] = [];
  let crowded = ink.inkShare > CROWDED_INK_SHARE && ink.hardThreshold >= MAX_AUTOMATIC_TOLERANCE;
  for (let label = 0; label < sizes.length; label++) {
    const box = boxes[label];
    if (!box) continue;
    const component: Component = { label, box, pixelCount: sizes[label] };
    if (
      box.maxX - box.minX >= working.width * CROWDED_SPAN &&
      box.maxY - box.minY >= working.height * CROWDED_SPAN &&
      sizes[label] > total * CROWDED_SHARE
    ) {
      crowded = true;
    }
    if (isStructuralComponent(component, working.width, working.height)) {
      blocked.add(label);
      continue;
    }
    components.push(component);
  }

  // The Voronoi diagram has to be built without the blocked components in it.
  // Left in, a rule would own the space around itself and every gap measured
  // across it would be a gap to the rule rather than between two icons.
  const clusterLabels =
    blocked.size === 0
      ? labels
      : (() => {
          const filtered = Int32Array.from(labels);
          for (let i = 0; i < filtered.length; i++) {
            if (filtered[i] >= 0 && blocked.has(filtered[i])) filtered[i] = -1;
          }
          return filtered;
        })();

  const edges = components.length > 1 ? componentGaps(clusterLabels, working.width, working.height) : [];

  // The rows and columns of the sheet, as hard walls. Two marks either side of
  // a gutter are never the same icon however close they are, which is what lets
  // the reach inside a cell be generous enough to gather an icon's own pieces.
  const regions = findRegions(cleaned, (index) => {
    const label = labels[index];
    return label >= 0 && blocked.has(label);
  });
  // By overlap, and never by "which box is my centre in". A mark that straddles
  // a lane has its centre in the lane and belongs to neither box, and every
  // such mark on the page would then share the same answer — so they would all
  // be put together into one cluster spanning the sheet, which the size filter
  // then throws away. That is not a near miss: it silently loses every icon it
  // touches, and on one of these sheets it lost the whole middle of the page.
  const regionOf = new Map<number, number>();
  for (const component of components) {
    let best = -1;
    let bestOverlap = 0;
    regions.forEach((region, at) => {
      const width = Math.min(region.maxX, component.box.maxX) - Math.max(region.minX, component.box.minX);
      const height = Math.min(region.maxY, component.box.maxY) - Math.max(region.minY, component.box.minY);
      const overlap = width > 0 && height > 0 ? width * height : 0;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = at;
      }
    });
    if (best >= 0) regionOf.set(component.label, best);
  }

  // Caption rows are pinned to themselves before clustering rather than
  // classified after it, because a row of letters that has already chained into
  // the icon beside it cannot be told apart from the icon afterwards.
  const textRows = findTextRows(components, working.width, working.height);
  const textRowOf = new Map<number, number>();
  const textRowLabels = new Set<number>();
  textRows.forEach((row, index) => {
    for (const label of row) {
      textRowOf.set(label, index);
      textRowLabels.add(label);
    }
  });

  // Two marks may only join if they are in the same cell of the grid *and* in
  // the same caption row, and the two constraints stack rather than replace one
  // another: a caption sitting inside an icon's own cell still has to stay out
  // of it.
  const confinedTo =
    regions.length > 1
      ? new Map(
          components.map((component) => [
            component.label,
            // A mark in no cell at all keeps its own compartment rather than
            // sharing one with every other homeless mark on the page.
            regionOf.has(component.label)
              ? `${regionOf.get(component.label)}/${textRowOf.get(component.label) ?? -1}`
              : `alone-${component.label}`,
          ]),
        )
      : textRowOf.size > 0
        ? new Map(
            components.map((component) => [
              component.label,
              `${textRowOf.get(component.label) ?? -1}`,
            ]),
          )
        : undefined;

  const chosen =
    options.separation !== undefined
      ? { radius: options.separation, basis: 'given' as const }
      : regions.length > 1
        ? {
            radius: Math.round(
              regions.map(reachWithin).sort((a, b) => a - b)[Math.floor(regions.length / 2)],
            ),
            basis: 'auto-grid' as const,
          }
        : chooseClusterRadius(components, edges, working.width, working.height, confinedTo);

  const radius = chosen.radius;
  const clusters = clusterComponents(
    components,
    edges,
    // Inside a walled cell the reach is per-cell, so a small icon beside a large
    // one is not held to the large one's distance.
    options.separation !== undefined || regions.length <= 1 ? radius : Number.POSITIVE_INFINITY,
    confinedTo,
    regions.length > 1
      ? (label) => reachWithin(regions[regionOf.get(label) ?? 0] ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 })
      : undefined,
  );

  const rejected = new Set<number>();
  const maxPixels = Math.round(total * (options.maxCellShare ?? DEFAULT_MAX_CELL_SHARE));
  const minPixels = Math.round(total * (options.minCellShare ?? 0));
  let kept = clusters.filter((cluster) => {
    // Oversized is **flagged, not dropped**. A cluster this big is either a
    // banner or a corner of the page where the cutting did not manage to
    // separate the icons — and in the second case dropping it deletes a dozen
    // icons at once, with nothing on the contact sheet to say it happened. A
    // box the user can see around a mess is worth far more than silence.
    //
    // A page holding one big drawing must not be flagged at all: the share test
    // means "bigger than an icon on this page ought to be", and that claim
    // needs a page of icons for it to be true of.
    const tooBig =
      clusters.length >= MAX_SHARE_MIN_CLUSTERS &&
      (cluster.box.maxX - cluster.box.minX) * (cluster.box.maxY - cluster.box.minY) > maxPixels;
    if (tooBig) {
      cluster.likelyLabel = true;
      cluster.labelReason = 'banner';
    }
    if (minPixels > 0 && cluster.pixelCount < minPixels) {
      for (const label of cluster.labels) rejected.add(label);
      return false;
    }
    return true;
  });

  if (kept.length > MAX_CELLS) {
    const dropped = [...kept].sort((a, b) => b.pixelCount - a.pixelCount).slice(MAX_CELLS);
    for (const cluster of dropped) for (const label of cluster.labels) rejected.add(label);
    kept = [...kept].sort((a, b) => b.pixelCount - a.pixelCount).slice(0, MAX_CELLS);
  }

  // Nothing survived, but there was ink: the page holds one drawing rather than
  // a sheet of them. Returning it as a single cell is more useful than an empty
  // result the user cannot act on.
  // ...unless the mask ran together, where the "one drawing" is the whole page
  // of noise and handing it back would be worse than an empty result.
  if (kept.length === 0 && !crowded) {
    const whole = maskBounds(cleaned);
    if (whole) {
      const everything = new Set<number>();
      for (let i = 0; i < labels.length; i++) if (labels[i] >= 0) everything.add(labels[i]);
      kept = [
        {
          labels: everything,
          box: whole,
          pixelCount: countWithin(cleaned, whole),
          likelyLabel: false,
        },
      ];
      rejected.clear();
      blocked.clear();
    }
  }

  classifyClusters(kept, textRowLabels, working.width, working.height, options);
  const ordered = inReadingOrder(kept);

  // Which cell owns each pixel, so a crop can refuse everything that is not its
  // own. Built once and shared by every cell's `crop()`.
  const owner = new Int32Array(working.width * working.height).fill(PAGE);
  const ownerOfLabel = new Map<number, number>();
  ordered.forEach((cluster, index) => {
    for (const label of cluster.labels) ownerOfLabel.set(label, index);
  });

  const padding = options.padding ?? DEFAULT_PADDING;

  // A cluster the size filter rejected is not page furniture — more often it
  // is a stray flourish of a real icon: a detached sparkle, a scattered coin,
  // a shadow the reach did not gather. Left unowned it would be painted out of
  // *every* crop, including the crop of the icon it belongs to, and the
  // missing piece shows up as a ground-coloured bite. If the whole of it sits
  // inside exactly one kept cell's padded box, that cell adopts it; a piece
  // two cells could claim stays out, because a wrong guess welds neighbours.
  if (rejected.size > 0 && ordered.length > 0) {
    const adoptBoxes = ordered.map((cluster) => padded(cluster.box, padding));
    for (const component of components) {
      if (!rejected.has(component.label) || ownerOfLabel.has(component.label)) continue;
      let adopter = -1;
      for (let index = 0; index < adoptBoxes.length; index++) {
        const box = adoptBoxes[index];
        const inside =
          component.box.minX >= box.minX &&
          component.box.maxX <= box.maxX &&
          component.box.minY >= box.minY &&
          component.box.maxY <= box.maxY;
        if (!inside) continue;
        if (adopter >= 0) {
          adopter = -1;
          break;
        }
        adopter = index;
      }
      if (adopter >= 0) ownerOfLabel.set(component.label, adopter);
    }
  }

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label < 0) continue;
    const at = ownerOfLabel.get(label);
    owner[i] = at ?? BLOCKED;
  }
  const cells = ordered.map((cluster, index): SheetCell => {
    const box = padded(cluster.box, padding);
    const sourceBox = mapToSource(box, scaleX, scaleY);
    return {
      index,
      box,
      sourceBox,
      pixelCount: cluster.pixelCount,
      likelyLabel: cluster.likelyLabel,
      ...(cluster.labelReason ? { labelReason: cluster.labelReason } : {}),
      crop: () =>
        cropRegion(source, sourceBox, field.global, (x, y) => {
          const wx = Math.min(working.width - 1, Math.floor(x / scaleX));
          const wy = Math.min(working.height - 1, Math.floor(y / scaleY));
          const at = owner[wy * working.width + wx];
          return at !== PAGE && at !== index;
        }),
    };
  });

  return {
    cells,
    width: working.width,
    height: working.height,
    sourceWidth: source.width,
    sourceHeight: source.height,
    scale: scaleX,
    background: field.global,
    crowded,
    separationUsed: radius,
    separationBasis: chosen.basis,
    toleranceUsed: ink.hardThreshold,
    softToleranceUsed: ink.softThreshold,
    noiseFloor: ink.noiseFloor,
    labelCount: cells.filter((cell) => cell.likelyLabel).length,
  };
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
  const { source, working, scaleX, scaleY, field, ink } = prepareSheet(image, options);
  const total = working.width * working.height;
  const cleaned = cleanInk(ink.mask, ink.noiseFloor, total);
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
      const trimmed = maskBounds(cleaned, cut);
      if (!trimmed) continue;
      if (
        trimmed.maxX - trimmed.minX >= (cut.maxX - cut.minX) * CROWDED_SPAN &&
        trimmed.maxY - trimmed.minY >= (cut.maxY - cut.minY) * CROWDED_SPAN
      ) {
        untrimmed++;
      }

      const box = padded(trimmed, padding);
      const sourceBox = mapToSource(box, scaleX, scaleY);
      cells.push({
        index: cells.length,
        box,
        sourceBox,
        pixelCount: countWithin(cleaned, trimmed),
        likelyLabel: false,
        // Anything outside this grid cell is somebody else's, including the
        // padding ring — so the neighbour never bleeds in even when the icons
        // are drawn right up to the rule.
        crop: () =>
          cropRegion(source, sourceBox, field.global, (x, y) => {
            const wx = Math.min(working.width - 1, Math.floor(x / scaleX));
            const wy = Math.min(working.height - 1, Math.floor(y / scaleY));
            return wx < cut.minX || wx >= cut.maxX || wy < cut.minY || wy >= cut.maxY;
          }),
      });
    }
  }

  return {
    cells,
    width: working.width,
    height: working.height,
    sourceWidth: source.width,
    sourceHeight: source.height,
    scale: scaleX,
    background: field.global,
    crowded: cells.length > 0 && untrimmed > cells.length / 2,
    separationUsed: 0,
    separationBasis: 'given',
    toleranceUsed: ink.hardThreshold,
    softToleranceUsed: ink.softThreshold,
    noiseFloor: ink.noiseFloor,
    labelCount: 0,
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
