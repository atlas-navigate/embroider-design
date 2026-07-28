import {
  chooseCellSize,
  distanceTransform,
  maskCellToWorld,
  rasterizeRings,
  type RasterMask,
} from '../geometry/distance-transform.js';
import { boundingBoxOfMany } from '../geometry/path.js';
import type { Point } from '../geometry/point.js';

/**
 * Medial axis extraction: finding the strokes inside a shape.
 *
 * This is what lets a letter be satined properly. An "H" is not one satin
 * column — it is three, and any attempt to walk a single pair of rails around
 * its outline produces stitches that fold clean across the letter (measured:
 * 10 mm crossings on a 1.7 mm stroke). The same is true of "E", "A", "K", "T",
 * and most of the alphabet, and of any traced logo with a branching stroke.
 *
 * So: rasterise the region, thin it to a one-pixel skeleton, split that
 * skeleton at its junctions, and hand back one branch per stroke. Each branch
 * carries the local half-width from the distance transform, which is all
 * `satinRailsFromBranch` needs to reconstruct the two rails — and those rails
 * are correct by construction rather than by a search that can pick wrong.
 *
 * A closed shape with no junctions at all (an "O") comes back as a single
 * closed branch, so it needs no special case.
 */

export interface SkeletonBranch {
  /** Ordered centreline, in world units. */
  points: Point[];
  /** Distance to the nearest boundary at each point. Same length as `points`. */
  halfWidths: number[];
  /** A loop with no ends — the ring of an "O". */
  closed: boolean;
  /** False when this end is a free tip (a stroke terminal) rather than a junction. */
  startAtJunction: boolean;
  endAtJunction: boolean;
}

export interface SkeletonOptions {
  /** Raster cell size in world units. Derived from the region when omitted. */
  cell?: number;
  /** Finest cell the automatic choice may pick. */
  minCell?: number;
  /** Roughly how many cells across the region. Higher is finer and slower. */
  targetCellsAcross?: number;
  /**
   * Branches ending in a free tip shorter than this multiple of the local
   * stroke width are thinning artifacts, not strokes. Corners throw off short
   * diagonal spurs; without pruning, every corner of every letter grows a
   * spurious satin stub.
   */
  spurRatio?: number;
}

const DEFAULT_MIN_CELL = 1;
const DEFAULT_TARGET_CELLS = 300;
const DEFAULT_SPUR_RATIO = 2.5;
const MAX_PRUNE_PASSES = 6;

/** Neighbour offsets in Zhang-Suen's p2..p9 order: N, NE, E, SE, S, SW, W, NW. */
const NEIGHBOUR_DX = [0, 1, 1, 1, 0, -1, -1, -1];
const NEIGHBOUR_DY = [-1, -1, 0, 1, 1, 1, 0, -1];

/**
 * Zhang-Suen thinning: erodes the mask to a one-pixel-wide skeleton while
 * preserving connectivity.
 *
 * Relies on the mask having an empty border — `rasterizeRings` pads by two
 * cells — so the inner loops can skip bounds checks entirely.
 */
export function thinMask(mask: RasterMask): Uint8Array {
  const { width, height } = mask;
  const pixels = Uint8Array.from(mask.data);
  const doomed: number[] = [];

  for (let pass = 0; pass < 1000; pass++) {
    let removed = 0;
    for (let step = 0; step < 2; step++) {
      doomed.length = 0;
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const index = y * width + x;
          if (pixels[index] === 0) continue;

          let neighbours = 0;
          let transitions = 0;
          let previous = pixels[index + NEIGHBOUR_DY[7] * width + NEIGHBOUR_DX[7]];
          for (let n = 0; n < 8; n++) {
            const value = pixels[index + NEIGHBOUR_DY[n] * width + NEIGHBOUR_DX[n]];
            neighbours += value;
            if (previous === 0 && value === 1) transitions++;
            previous = value;
          }
          if (neighbours < 2 || neighbours > 6 || transitions !== 1) continue;

          const north = pixels[index - width];
          const east = pixels[index + 1];
          const south = pixels[index + width];
          const west = pixels[index - 1];
          const first = step === 0 ? north * east * south : north * east * west;
          const second = step === 0 ? east * south * west : north * south * west;
          if (first !== 0 || second !== 0) continue;

          doomed.push(index);
        }
      }
      for (const index of doomed) pixels[index] = 0;
      removed += doomed.length;
    }
    if (removed === 0) break;
  }
  removeRedundantPixels(pixels, width, height);
  return pixels;
}

/**
 * Which of the eight ring positions are 8-adjacent to each other.
 *
 * Consecutive positions obviously are. Less obviously, so is every pair of
 * *orthogonal* positions two apart — N is at (0,-1) and W at (-1,0), one step
 * diagonally. Missing that is what makes the plain crossing-number test too
 * conservative to clean a skeleton: it sees N and W as separate arcs whenever
 * NW happens to be empty, and refuses to remove a pixel that is plainly
 * redundant.
 */
const RING_ADJACENCY: readonly (readonly number[])[] = (() => {
  const adjacency: number[][] = Array.from({ length: 8 }, () => []);
  const link = (a: number, b: number): void => {
    adjacency[a].push(b);
    adjacency[b].push(a);
  };
  for (let i = 0; i < 8; i++) link(i, (i + 1) % 8);
  for (let i = 0; i < 8; i += 2) link(i, (i + 2) % 8);
  return adjacency;
})();

/** Connected components among the present neighbours, under 8-adjacency. */
function neighbourComponents(present: readonly boolean[]): number {
  const seen = [false, false, false, false, false, false, false, false];
  let components = 0;
  for (let start = 0; start < 8; start++) {
    if (!present[start] || seen[start]) continue;
    components++;
    const stack = [start];
    seen[start] = true;
    while (stack.length > 0) {
      const current = stack.pop() as number;
      for (const next of RING_ADJACENCY[current]) {
        if (present[next] && !seen[next]) {
          seen[next] = true;
          stack.push(next);
        }
      }
    }
  }
  return components;
}

/**
 * Thins out the pixels Zhang-Suen cannot.
 *
 * Because it deletes in parallel, Zhang-Suen has to keep any pixel whose
 * removal *might* disconnect the skeleton, which leaves diagonal staircases
 * and doubled corners behind. Each of those reads as a degree-3 pixel — a
 * junction — and the graph walker then chops a smooth curve into fragments: an
 * "O" came out as 36 branches instead of one loop.
 *
 * Deleting sequentially fixes it. A pixel whose foreground neighbours are all
 * mutually reachable without going through it is redundant by definition, so
 * removing it cannot disconnect anything. Tips (a single neighbour) are
 * excluded, or the skeleton would erode from both ends until nothing was left.
 */
function removeRedundantPixels(pixels: Uint8Array, width: number, height: number): void {
  const present = [false, false, false, false, false, false, false, false];
  for (let pass = 0; pass < 8; pass++) {
    let removed = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;
        if (pixels[index] === 0) continue;

        let neighbours = 0;
        for (let n = 0; n < 8; n++) {
          const value = pixels[index + NEIGHBOUR_DY[n] * width + NEIGHBOUR_DX[n]] === 1;
          present[n] = value;
          if (value) neighbours++;
        }
        if (neighbours < 2 || neighbourComponents(present) !== 1) continue;
        pixels[index] = 0;
        removed++;
      }
    }
    if (removed === 0) break;
  }
}

function neighbourIndices(pixels: Uint8Array, width: number, index: number): number[] {
  const out: number[] = [];
  for (let n = 0; n < 8; n++) {
    const neighbour = index + NEIGHBOUR_DY[n] * width + NEIGHBOUR_DX[n];
    if (pixels[neighbour] === 1) out.push(neighbour);
  }
  return out;
}

interface PixelChain {
  indices: number[];
  closed: boolean;
  startAtJunction: boolean;
  endAtJunction: boolean;
}

/**
 * Splits a thinned skeleton into chains at every tip and junction.
 *
 * Pure loops — a skeleton with no pixel of degree other than two — are picked
 * up in a second sweep, since the first has no node to start walking from.
 */
function extractChains(pixels: Uint8Array, width: number, height: number): PixelChain[] {
  const degree = new Uint8Array(pixels.length);
  const nodes: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      if (pixels[index] === 0) continue;
      const count = neighbourIndices(pixels, width, index).length;
      degree[index] = count;
      if (count !== 2) nodes.push(index);
    }
  }

  const usedEdges = new Set<number>();
  const edgeKey = (a: number, b: number): number => (a < b ? a * pixels.length + b : b * pixels.length + a);
  const chains: PixelChain[] = [];

  const walk = (from: number, first: number): PixelChain | null => {
    if (usedEdges.has(edgeKey(from, first))) return null;
    usedEdges.add(edgeKey(from, first));
    const indices = [from, first];
    let previous = from;
    let current = first;
    while (degree[current] === 2) {
      const next = neighbourIndices(pixels, width, current).find((n) => n !== previous);
      if (next === undefined || usedEdges.has(edgeKey(current, next))) break;
      usedEdges.add(edgeKey(current, next));
      indices.push(next);
      previous = current;
      current = next;
    }
    return {
      indices,
      closed: false,
      startAtJunction: degree[from] >= 3,
      endAtJunction: degree[current] >= 3,
    };
  };

  for (const node of nodes) {
    for (const neighbour of neighbourIndices(pixels, width, node)) {
      const chain = walk(node, neighbour);
      if (chain && chain.indices.length >= 2) chains.push(chain);
    }
  }

  // Anything untouched is a closed loop with no tips or junctions.
  const seen = new Set<number>();
  for (const chain of chains) for (const index of chain.indices) seen.add(index);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const start = y * width + x;
      if (pixels[start] === 0 || seen.has(start)) continue;
      const indices = [start];
      seen.add(start);
      let previous = -1;
      let current = start;
      for (;;) {
        const next = neighbourIndices(pixels, width, current).find(
          (n) => n !== previous && !seen.has(n),
        );
        if (next === undefined) break;
        seen.add(next);
        indices.push(next);
        previous = current;
        current = next;
      }
      if (indices.length >= 4) chains.push({ indices, closed: true, startAtJunction: false, endAtJunction: false });
    }
  }

  return chains;
}

/** Chain length in world units. */
function chainLength(chain: PixelChain, mask: RasterMask): number {
  let total = 0;
  for (let i = 1; i < chain.indices.length; i++) {
    const a = chain.indices[i - 1];
    const b = chain.indices[i];
    const dx = (b % mask.width) - (a % mask.width);
    const dy = Math.floor(b / mask.width) - Math.floor(a / mask.width);
    total += Math.hypot(dx, dy) * mask.cell;
  }
  return total;
}

/**
 * Removes short dead-end branches, then re-derives the graph so a junction
 * that lost a limb becomes a plain path and its two remaining branches merge.
 *
 * The length threshold comes from the *region's* typical half-width, not the
 * spur's own. A corner spur lives inside the junction bulge where the distance
 * transform peaks, so measuring it against itself makes the threshold grow
 * with exactly the thing it is meant to catch.
 */
function pruneSpurs(
  pixels: Uint8Array,
  mask: RasterMask,
  typicalHalfWidth: number,
  spurRatio: number,
): PixelChain[] {
  const limit = Math.max(mask.cell, typicalHalfWidth * spurRatio);
  let chains = extractChains(pixels, mask.width, mask.height);
  for (let pass = 0; pass < MAX_PRUNE_PASSES; pass++) {
    if (chains.length <= 1) break;
    let removed = 0;
    for (const chain of chains) {
      if (chain.closed) continue;
      const isSpur = chain.startAtJunction !== chain.endAtJunction;
      if (!isSpur) continue;
      if (chainLength(chain, mask) >= limit) continue;
      // Keep the junction pixel itself; only the dead-end limb goes.
      const from = chain.startAtJunction ? 1 : 0;
      const to = chain.startAtJunction ? chain.indices.length : chain.indices.length - 1;
      for (let i = from; i < to; i++) pixels[chain.indices[i]] = 0;
      removed++;
    }
    if (removed === 0) break;
    chains = extractChains(pixels, mask.width, mask.height);
  }
  return chains;
}

/**
 * Moving-average smoothing of the centreline, with the tips pinned.
 *
 * A diagonal stroke rasterises to a staircase, and thinning leaves that
 * staircase in the skeleton: successive samples zigzag by half a cell. The
 * satin normal is taken from neighbouring samples, so that jitter turns
 * straight into a crossing angle error of up to 25 degrees — every stitch on
 * a diagonal stroke skewed a different way. Smoothing the positions costs
 * nothing and removes it. The endpoints stay put so the column still reaches
 * the tip of the stroke.
 */
function smoothPoints(points: readonly Point[], closed: boolean, passes = 2): Point[] {
  const n = points.length;
  if (n < 5) return points.map((p) => ({ ...p }));
  let current = points.map((p) => ({ ...p }));
  for (let pass = 0; pass < passes; pass++) {
    const next = current.map((p) => ({ ...p }));
    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) continue;
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      for (let k = -2; k <= 2; k++) {
        let j = i + k;
        if (closed) j = ((j % n) + n) % n;
        else if (j < 0 || j >= n) continue;
        sumX += current[j].x;
        sumY += current[j].y;
        count++;
      }
      next[i] = { x: sumX / count, y: sumY / count };
    }
    current = next;
  }
  return current;
}

function smoothWidths(widths: readonly number[], closed: boolean): number[] {
  const n = widths.length;
  if (n < 3) return [...widths];
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let k = -2; k <= 2; k++) {
      let j = i + k;
      if (closed) j = ((j % n) + n) % n;
      else if (j < 0 || j >= n) continue;
      sum += widths[j];
      count++;
    }
    out[i] = sum / count;
  }
  return out;
}

/** Resamples a centreline at a fixed spacing, carrying the half-widths along. */
function resampleWithWidths(
  points: readonly Point[],
  widths: readonly number[],
  spacing: number,
): { points: Point[]; widths: number[] } {
  if (points.length < 2) return { points: points.map((p) => ({ ...p })), widths: [...widths] };

  const outPoints: Point[] = [{ ...points[0] }];
  const outWidths: number[] = [widths[0]];
  let carry = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (segment < 1e-9) continue;
    let travelled = spacing - carry;
    while (travelled <= segment) {
      const t = travelled / segment;
      outPoints.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      outWidths.push(widths[i - 1] + (widths[i] - widths[i - 1]) * t);
      travelled += spacing;
    }
    carry = segment - (travelled - spacing);
  }

  const last = points[points.length - 1];
  const tail = outPoints[outPoints.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > spacing * 0.25) {
    outPoints.push({ ...last });
    outWidths.push(widths[widths.length - 1]);
  } else {
    outPoints[outPoints.length - 1] = { ...last };
    outWidths[outWidths.length - 1] = widths[widths.length - 1];
  }
  return { points: outPoints, widths: outWidths };
}

/**
 * Extracts one branch per stroke.
 *
 * Returns `null` when the region cannot be rasterised at all. An empty array
 * means the shape has no stroke structure worth satining — callers should
 * fill it instead.
 */
export function skeletonizeRegion(
  rings: readonly (readonly Point[])[],
  options: SkeletonOptions = {},
): SkeletonBranch[] | null {
  const box = boundingBoxOfMany(rings);
  if (!box) return null;

  const cell =
    options.cell ??
    chooseCellSize(
      box,
      options.minCell ?? DEFAULT_MIN_CELL,
      options.targetCellsAcross ?? DEFAULT_TARGET_CELLS,
    );
  const mask = rasterizeRings(rings, cell);
  if (!mask) return null;

  const distances = distanceTransform(mask);
  const pixels = thinMask(mask);

  // Median distance along the skeleton is the region's typical stroke
  // half-width — measured before pruning, because pruning needs it.
  const alongSkeleton: number[] = [];
  for (let index = 0; index < pixels.length; index++) {
    if (pixels[index] === 1) alongSkeleton.push(distances[index]);
  }
  if (alongSkeleton.length === 0) return [];
  alongSkeleton.sort((a, b) => a - b);
  const typicalHalfWidth = alongSkeleton[Math.floor(alongSkeleton.length / 2)];

  const chains = pruneSpurs(pixels, mask, typicalHalfWidth, options.spurRatio ?? DEFAULT_SPUR_RATIO);

  const branches: SkeletonBranch[] = [];
  for (const chain of chains) {
    if (chain.indices.length < 2) continue;
    const points: Point[] = [];
    const halfWidths: number[] = [];
    for (const index of chain.indices) {
      const j = Math.floor(index / mask.width);
      points.push(maskCellToWorld(mask, index - j * mask.width, j));
      // A skeleton pixel sits at least half a cell from the boundary; the
      // distance transform already subtracts that bias, so this is the real
      // half-width of the stroke at this point.
      halfWidths.push(Math.max(mask.cell * 0.5, distances[index]));
    }
    const resampled = resampleWithWidths(points, halfWidths, Math.max(mask.cell * 3, 1));
    if (resampled.points.length < 2) continue;
    branches.push({
      points: smoothPoints(resampled.points, chain.closed),
      halfWidths: smoothWidths(resampled.widths, chain.closed),
      closed: chain.closed,
      startAtJunction: chain.startAtJunction,
      endAtJunction: chain.endAtJunction,
    });
  }
  return branches;
}

/** Total centreline length across all branches, in world units. */
export function skeletonLength(branches: readonly SkeletonBranch[]): number {
  let total = 0;
  for (const branch of branches) {
    for (let i = 1; i < branch.points.length; i++) {
      total += Math.hypot(
        branch.points[i].x - branch.points[i - 1].x,
        branch.points[i].y - branch.points[i - 1].y,
      );
    }
  }
  return total;
}

/** Median half-width across all branches — the region's typical stroke half-width. */
export function medianHalfWidth(branches: readonly SkeletonBranch[]): number {
  const all: number[] = [];
  for (const branch of branches) for (const width of branch.halfWidths) all.push(width);
  if (all.length === 0) return 0;
  all.sort((a, b) => a - b);
  return all[Math.floor(all.length / 2)];
}
