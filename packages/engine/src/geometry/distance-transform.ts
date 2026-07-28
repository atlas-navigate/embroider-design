import type { Point } from './point.js';
import { boundingBoxOfMany, type BoundingBox } from './path.js';

/**
 * Rasterisation + exact Euclidean distance transform.
 *
 * The auto-digitizer uses this to answer one question per traced region: *how
 * wide is this shape?* Narrow ribbons want a satin column; broad areas want a
 * tatami fill. Measuring width geometrically (medial axis) is fiddly and
 * fragile on pixel-traced contours; measuring it on a raster distance
 * transform is robust, cheap, and good to a fraction of a millimetre.
 */

export interface RasterMask {
  width: number;
  height: number;
  /** World units per cell. */
  cell: number;
  /** World coordinate of the centre of cell (0, 0). */
  originX: number;
  originY: number;
  /** Row-major, `1` = inside the region. */
  data: Uint8Array;
}

const DEFAULT_TARGET_CELLS_ACROSS = 256;
const DEFAULT_MAX_CELLS = 1_500_000;

/**
 * Picks a cell size that resolves the region well without producing an
 * unbounded grid. `minCell` should be the finest detail worth resolving
 * (roughly a third of the smallest stitch you would ever generate).
 */
export function chooseCellSize(
  box: BoundingBox,
  minCell: number,
  targetCellsAcross = DEFAULT_TARGET_CELLS_ACROSS,
  maxCells = DEFAULT_MAX_CELLS,
): number {
  const width = Math.max(box.maxX - box.minX, 1e-6);
  const height = Math.max(box.maxY - box.minY, 1e-6);
  let cell = Math.max(minCell, Math.max(width, height) / targetCellsAcross);
  // Clamp total grid size, growing the cell if the region is huge.
  while ((width / cell + 4) * (height / cell + 4) > maxCells) cell *= 1.5;
  return cell;
}

/**
 * Rasterises a set of rings with the even-odd rule, so holes fall out for
 * free: pass the outer ring and every hole ring in the same array.
 *
 * Cells are sampled at their centres. `padCells` of guaranteed-empty border is
 * added on every side, which the distance transform needs as its "outside"
 * reference.
 */
export function rasterizeRings(
  rings: readonly (readonly Point[])[],
  cell: number,
  padCells = 2,
): RasterMask | null {
  if (cell <= 0) throw new Error('rasterizeRings: cell must be > 0');
  const box = boundingBoxOfMany(rings);
  if (!box) return null;

  const width = Math.ceil((box.maxX - box.minX) / cell) + 1 + padCells * 2;
  const height = Math.ceil((box.maxY - box.minY) / cell) + 1 + padCells * 2;
  if (width < 3 || height < 3) return null;

  const originX = box.minX - padCells * cell;
  const originY = box.minY - padCells * cell;
  const data = new Uint8Array(width * height);
  const crossings: number[] = [];

  for (let j = 0; j < height; j++) {
    const y = originY + j * cell;
    crossings.length = 0;
    for (const ring of rings) {
      const n = ring.length;
      if (n < 3) continue;
      for (let i = 0, prev = n - 1; i < n; prev = i++) {
        const a = ring[prev];
        const b = ring[i];
        if (a.y > y !== b.y > y) {
          crossings.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
        }
      }
    }
    if (crossings.length < 2) continue;
    crossings.sort((p, q) => p - q);
    const rowStart = j * width;
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      let i0 = Math.ceil((crossings[k] - originX) / cell);
      let i1 = Math.floor((crossings[k + 1] - originX) / cell);
      if (i0 < 0) i0 = 0;
      if (i1 > width - 1) i1 = width - 1;
      for (let i = i0; i <= i1; i++) data[rowStart + i] = 1;
    }
  }

  return { width, height, cell, originX, originY, data };
}

export function maskCellToWorld(mask: RasterMask, i: number, j: number): Point {
  return { x: mask.originX + i * mask.cell, y: mask.originY + j * mask.cell };
}

export function maskContains(mask: RasterMask, p: Point): boolean {
  const i = Math.round((p.x - mask.originX) / mask.cell);
  const j = Math.round((p.y - mask.originY) / mask.cell);
  if (i < 0 || j < 0 || i >= mask.width || j >= mask.height) return false;
  return mask.data[j * mask.width + i] === 1;
}

export function countMaskCells(mask: RasterMask): number {
  let count = 0;
  for (let i = 0; i < mask.data.length; i++) count += mask.data[i];
  return count;
}

/** Sentinel "unreachable" value, per Felzenszwalb & Huttenlocher's reference code. */
const INF = 1e20;

/**
 * Exact squared-distance transform of one row/column
 * (Felzenszwalb & Huttenlocher 2012, lower envelope of parabolas, O(n)).
 */
function edt1d(
  f: Float64Array,
  n: number,
  d: Float64Array,
  v: Int32Array,
  z: Float64Array,
): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (k > 0 && s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const delta = q - v[k];
    d[q] = delta * delta + f[v[k]];
  }
}

/**
 * Distance from every inside cell to the nearest outside cell, in **world
 * units**. Outside cells read `0`. This is the distance to the region
 * boundary, so a ribbon of width `w` peaks at `w / 2`.
 */
export function distanceTransform(mask: RasterMask): Float64Array {
  const { width, height, data, cell } = mask;
  const squared = new Float64Array(width * height);
  for (let i = 0; i < squared.length; i++) squared[i] = data[i] === 1 ? INF : 0;

  const maxDim = Math.max(width, height);
  const f = new Float64Array(maxDim);
  const d = new Float64Array(maxDim);
  const v = new Int32Array(maxDim);
  const z = new Float64Array(maxDim + 1);

  // Columns first.
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) f[j] = squared[j * width + i];
    edt1d(f, height, d, v, z);
    for (let j = 0; j < height; j++) squared[j * width + i] = d[j];
  }
  // Then rows.
  for (let j = 0; j < height; j++) {
    const rowStart = j * width;
    for (let i = 0; i < width; i++) f[i] = squared[rowStart + i];
    edt1d(f, width, d, v, z);
    for (let i = 0; i < width; i++) squared[rowStart + i] = d[i];
  }

  // The raw transform measures cell-centre to cell-centre, so the boundary
  // (which lies roughly midway between the last inside cell and the first
  // outside one) is over-reached by about half a cell. Backing that off halves
  // the systematic bias; the residual error is ~cell/2, which is well inside
  // what a satin-vs-fill decision cares about.
  const out = new Float64Array(width * height);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.max(0, (Math.sqrt(squared[i]) - 0.5) * cell);
  }
  return out;
}

export interface InscribedCircle {
  center: Point;
  radius: number;
}

/** The largest circle that fits inside the region (to raster resolution). */
export function maxInscribedCircle(
  mask: RasterMask,
  distances: Float64Array,
): InscribedCircle | null {
  let best = -1;
  let bestIndex = -1;
  for (let index = 0; index < distances.length; index++) {
    if (mask.data[index] !== 1) continue;
    if (distances[index] > best) {
      best = distances[index];
      bestIndex = index;
    }
  }
  if (bestIndex < 0) return null;
  const j = Math.floor(bestIndex / mask.width);
  const i = bestIndex - j * mask.width;
  return { center: maskCellToWorld(mask, i, j), radius: best };
}

export interface RegionWidthStats {
  /** Width at the widest point: twice the max inscribed radius. */
  maxWidth: number;
  /**
   * Robust "wide part" width — twice the 90th-percentile distance. Ignores the
   * single-cell spikes that `maxWidth` can pick up on noisy traced contours.
   */
  p90Width: number;
  /**
   * Mean width under a ribbon model. For a strip of width `w` the mean
   * distance-to-boundary is `w / 4`, so this is `4 * mean(distance)`. It
   * over-reads by ~33% on discs, which is fine: the satin/fill decision only
   * cares about ribbons.
   */
  meanWidth: number;
  /** Region area in world units squared. */
  area: number;
  /** The widest inscribed circle, useful for placing a fill's start point. */
  inscribed: InscribedCircle | null;
}

/**
 * Measures a region's width. Pass the outer ring plus any holes; `minCell`
 * bounds how fine the raster gets (0.2mm is a good default in 0.1mm units).
 */
export function regionWidthStats(
  rings: readonly (readonly Point[])[],
  minCell: number,
  targetCellsAcross = DEFAULT_TARGET_CELLS_ACROSS,
): RegionWidthStats | null {
  const box = boundingBoxOfMany(rings);
  if (!box) return null;
  const cell = chooseCellSize(box, minCell, targetCellsAcross);
  const mask = rasterizeRings(rings, cell);
  if (!mask) return null;

  const distances = distanceTransform(mask);
  const inside: number[] = [];
  for (let index = 0; index < distances.length; index++) {
    if (mask.data[index] === 1) inside.push(distances[index]);
  }
  if (inside.length === 0) {
    return { maxWidth: 0, p90Width: 0, meanWidth: 0, area: 0, inscribed: null };
  }

  inside.sort((a, b) => a - b);
  const sum = inside.reduce((acc, value) => acc + value, 0);
  const p90 = inside[Math.min(inside.length - 1, Math.floor(inside.length * 0.9))];

  return {
    maxWidth: 2 * inside[inside.length - 1],
    p90Width: 2 * p90,
    meanWidth: 4 * (sum / inside.length),
    area: inside.length * cell * cell,
    inscribed: maxInscribedCircle(mask, distances),
  };
}
