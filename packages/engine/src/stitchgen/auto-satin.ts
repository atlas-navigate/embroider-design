import { distance, type Point } from '../geometry/point.js';
import { generateRunningStitch } from './running-stitch.js';
import { generateSatinFromCenterline, type SatinRails } from './satin-column.js';
import type { StitchSettings, UnderlayType } from './settings.js';
import {
  medianHalfWidth,
  skeletonizeRegion,
  skeletonLength,
  type SkeletonBranch,
  type SkeletonOptions,
} from './skeleton.js';

/**
 * Turning medial-axis branches into satin columns.
 *
 * `skeleton.ts` finds where the strokes are; this decides how to sew them —
 * one column per stroke, each driven from its centreline, ordered so the
 * machine is not flying back and forth across the letter.
 */

export interface AutoSatinOptions {
  skeleton?: SkeletonOptions;
  /**
   * How much wider than the region's typical stroke a single crossing may get.
   *
   * The distance transform peaks wherever strokes meet — the inscribed circle
   * in the crotch of a "W" is far larger than either stroke — so without a cap
   * the column balloons at every join. A little extra there is welcome (it
   * covers the corner); unbounded is not. The cap comes from the *region's*
   * median half-width rather than each branch's own, because a short branch
   * living entirely inside a junction bulge has no idea what normal looks like.
   */
  widthClamp?: number;
  /** Branches shorter than this multiple of the stroke width are junction debris. */
  minLengthRatio?: number;
}

const DEFAULT_WIDTH_CLAMP = 1.6;
const DEFAULT_MIN_LENGTH_RATIO = 0.75;
/** Below this, a shape is a blob with no stroke direction — fill it instead. */
const BLOB_LENGTH_RATIO = 1.5;
/** Underlay zigzag never shrinks a column to less than this share of its width. */
const MIN_UNDERLAY_WIDTH_SHARE = 0.3;

/**
 * A satin column as this module understands it: a centreline, a half-width at
 * every point on it, and the rails those imply.
 *
 * The centreline is the source of truth — `rails` is derived, kept for the
 * canvas preview and for anything that wants the outline of the column.
 */
export interface SatinColumnSpec {
  center: Point[];
  halfWidths: number[];
  closed: boolean;
  rails: SatinRails;
}

function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

function unit(from: Point, to: Point, sign: number): Point | null {
  const dx = (to.x - from.x) * sign;
  const dy = (to.y - from.y) * sign;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return null;
  return { x: dx / length, y: dy / length };
}

/** Rails at ±half-width, perpendicular to the centreline. */
export function railsFromCenterline(
  center: readonly Point[],
  halfWidths: readonly number[],
  closed: boolean,
): SatinRails {
  const count = center.length;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < count; i++) {
    const previous = closed ? center[(i - 1 + count) % count] : center[Math.max(0, i - 1)];
    const next = closed ? center[(i + 1) % count] : center[Math.min(count - 1, i + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-9) continue;
    const nx = (-dy / length) * halfWidths[i];
    const ny = (dx / length) * halfWidths[i];
    left.push({ x: center[i].x + nx, y: center[i].y + ny });
    right.push({ x: center[i].x - nx, y: center[i].y - ny });
  }
  if (closed && left.length > 0) {
    left.push({ ...left[0] });
    right.push({ ...right[0] });
  }
  return { left, right };
}

/**
 * Builds a column from one skeleton branch.
 *
 * Free ends are pushed out by their own half-width so the column reaches the
 * actual tip of the stroke: thinning stops half a stroke short of any
 * terminal, and without the extension every letter would end early.
 */
export function branchToColumnSpec(
  branch: SkeletonBranch,
  widthLimit = Infinity,
): SatinColumnSpec | null {
  if (branch.points.length < 2) return null;

  const center = branch.points.map((p) => ({ ...p }));
  const halfWidths = branch.halfWidths.map((w) => Math.min(w, widthLimit));

  if (!branch.closed) {
    if (!branch.startAtJunction) {
      const direction = unit(center[0], center[1], -1);
      if (direction) {
        center.unshift({
          x: center[0].x + direction.x * halfWidths[0],
          y: center[0].y + direction.y * halfWidths[0],
        });
        halfWidths.unshift(halfWidths[0]);
      }
    }
    if (!branch.endAtJunction) {
      const n = center.length;
      const width = halfWidths[halfWidths.length - 1];
      const direction = unit(center[n - 2], center[n - 1], 1);
      if (direction) {
        center.push({
          x: center[n - 1].x + direction.x * width,
          y: center[n - 1].y + direction.y * width,
        });
        halfWidths.push(width);
      }
    }
  }

  if (center.length < 2) return null;
  return {
    center,
    halfWidths,
    closed: branch.closed,
    rails: railsFromCenterline(center, halfWidths, branch.closed),
  };
}

function resolveUnderlayType(type: UnderlayType, width: number): Exclude<UnderlayType, 'auto'> {
  if (type !== 'auto') return type;
  if (width < 1) return 'none';
  // Under about 3 mm there is only room for a centre walk; wider columns sink
  // in the middle without a zigzag under them.
  return width > 30 ? 'center-walk-and-zigzag' : 'center-walk';
}

/** Underlay for a centreline column: a centre walk, and a zigzag if it is wide enough. */
export function generateColumnUnderlay(
  spec: SatinColumnSpec,
  settings: StitchSettings,
): Point[][] {
  const typical = medianOf(spec.halfWidths) * 2;
  const type = resolveUnderlayType(settings.underlay.type, typical);
  if (type === 'none') return [];

  const runs: Point[][] = [];
  const wantsWalk = type !== 'zigzag' && type !== 'edge-run';
  const wantsZigzag = type.includes('zigzag');

  if (wantsWalk || type === 'edge-run') {
    const walk = generateRunningStitch(spec.center, settings, {
      closed: spec.closed,
      stitchLength: settings.underlay.stitchLength,
    });
    if (walk.length >= 2) runs.push(walk);
  }
  if (wantsZigzag) {
    const inset = settings.underlay.inset;
    const narrowed = spec.halfWidths.map((w) => Math.max(w * MIN_UNDERLAY_WIDTH_SHARE, w - inset));
    const zigzag = generateSatinFromCenterline(spec.center, narrowed, settings, {
      density: settings.underlay.zigzagSpacing,
      pullCompensation: 0,
      closed: spec.closed,
    });
    if (zigzag.length >= 2) runs.push(zigzag);
  }
  return runs;
}

/** Underlay plus the visible satin pass, in stitching order. */
export function generateColumnStitches(
  spec: SatinColumnSpec,
  settings: StitchSettings,
): Point[][] {
  const runs = generateColumnUnderlay(spec, settings);
  const column = generateSatinFromCenterline(spec.center, spec.halfWidths, settings, {
    closed: spec.closed,
  });
  if (column.length >= 2) runs.push(column);
  return runs;
}

function reverseSpec(spec: SatinColumnSpec): SatinColumnSpec {
  const center = [...spec.center].reverse();
  const halfWidths = [...spec.halfWidths].reverse();
  return { center, halfWidths, closed: spec.closed, rails: railsFromCenterline(center, halfWidths, spec.closed) };
}

/**
 * Greedy nearest-end ordering, flipping a column when approaching it from the
 * far end is shorter. Stroke order within a letter is invisible in the
 * finished piece but very visible in sewing time.
 */
export function orderSatinColumns(
  columns: readonly SatinColumnSpec[],
  start?: Point,
): SatinColumnSpec[] {
  const remaining = [...columns];
  const ordered: SatinColumnSpec[] = [];
  let cursor: Point = start ?? { x: 0, y: 0 };

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    let bestReversed = false;
    for (let i = 0; i < remaining.length; i++) {
      const spec = remaining[i];
      const toHead = distance(cursor, spec.center[0]);
      const toTail = distance(cursor, spec.center[spec.center.length - 1]);
      if (toHead < bestDistance) {
        bestDistance = toHead;
        bestIndex = i;
        bestReversed = false;
      }
      // Reversing a closed loop buys nothing — it starts and ends together.
      if (!spec.closed && toTail < bestDistance) {
        bestDistance = toTail;
        bestIndex = i;
        bestReversed = true;
      }
    }
    const chosen = remaining.splice(bestIndex, 1)[0];
    const oriented = bestReversed ? reverseSpec(chosen) : chosen;
    ordered.push(oriented);
    cursor = oriented.center[oriented.center.length - 1];
  }
  return ordered;
}

/**
 * Decomposes a closed region into satin columns, one per stroke.
 *
 * An empty result is a real answer, not a failure: it means the shape has no
 * stroke structure — a disc, a blob, a broad area — and the caller should fill
 * it. `null` means the region could not be measured at all.
 */
export function regionToSatinColumns(
  rings: readonly (readonly Point[])[],
  settings: StitchSettings,
  options: AutoSatinOptions = {},
): SatinColumnSpec[] | null {
  const skeletonOptions: SkeletonOptions = {
    // A sixth of the narrowest satin the settings allow, so even a
    // minimum-width stroke is six cells across — below about that, thinning
    // starts inventing junctions on smooth curves.
    minCell: Math.max(0.5, settings.minSatinWidth / 6),
    targetCellsAcross: 400,
    ...options.skeleton,
  };
  const branches = skeletonizeRegion(rings, skeletonOptions);
  if (!branches) return null;
  if (branches.length === 0) return [];

  const typical = medianHalfWidth(branches);
  if (typical <= 0) return [];
  if (skeletonLength(branches) < typical * 2 * BLOB_LENGTH_RATIO) return [];

  const widthLimit = typical * (options.widthClamp ?? DEFAULT_WIDTH_CLAMP);
  const minLength = typical * 2 * (options.minLengthRatio ?? DEFAULT_MIN_LENGTH_RATIO);
  const columns: SatinColumnSpec[] = [];
  for (const branch of branches) {
    // Junction clusters produce stubs a pixel or two long; they add stitches
    // where the adjoining strokes already cover.
    if (!branch.closed && pathLength(branch.points) < minLength) continue;
    const spec = branchToColumnSpec(branch, widthLimit);
    if (spec) columns.push(spec);
  }
  return columns;
}
