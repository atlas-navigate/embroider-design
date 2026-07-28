import { distance, lerp, normalize, subtract, type Point } from '../geometry/point.js';
import {
  dedupeConsecutivePoints,
  ensureWinding,
  openRing,
  pointAtDistanceAlong,
  polylineLength,
} from '../geometry/path.js';
import type { StitchSettings } from './settings.js';

/**
 * Satin columns: the dense, glossy zigzag used for lettering, borders and any
 * narrow shape. Two rails define the column; the needle alternates between
 * them, advancing along the column as it goes.
 */

export interface SatinRails {
  left: Point[];
  right: Point[];
}

export interface SatinOptions {
  /** Distance between penetrations along one rail. Overrides the settings. */
  density?: number;
  /** Widening per side. Overrides the settings. */
  pullCompensation?: number;
  /** Begin on the right rail. Useful for chaining columns without a travel move. */
  startOnRight?: boolean;
  /** Crossings longer than this are split with intermediate penetrations. */
  maxStitchLength?: number;
}

/**
 * Extends a crossing outward at both ends.
 *
 * Thread tension pulls fabric inward as it sews, so a satin column finishes
 * measurably narrower than it was digitized — enough to open a gap against an
 * adjoining shape. Pull compensation pre-widens the column to cancel it out.
 */
export function compensateCrossing(
  a: Point,
  b: Point,
  amount: number,
): { start: Point; end: Point } {
  if (amount <= 0) return { start: { ...a }, end: { ...b } };
  const direction = normalize(subtract(b, a));
  if (direction.x === 0 && direction.y === 0) return { start: { ...a }, end: { ...b } };
  return {
    start: { x: a.x - direction.x * amount, y: a.y - direction.y * amount },
    end: { x: b.x + direction.x * amount, y: b.y + direction.y * amount },
  };
}

/**
 * Intermediate penetrations for a crossing too long to lie flat, excluding the
 * endpoints.
 *
 * They are nudged by a rotating offset rather than placed at exact fractions —
 * otherwise every split lands on the same line and the column develops a
 * visible seam running down its length.
 */
function splitCrossing(
  from: Point,
  to: Point,
  maxStitchLength: number,
  index: number,
): Point[] {
  const width = distance(from, to);
  const divisions = maxStitchLength > 0 ? Math.ceil(width / maxStitchLength) : 1;
  if (divisions <= 1) return [];

  const jitter = ((index % 3) - 1) * (0.18 / divisions);
  const points: Point[] = [];
  for (let k = 1; k < divisions; k++) {
    const t = Math.min(0.95, Math.max(0.05, k / divisions + jitter));
    points.push(lerp(from, to, t));
  }
  return points;
}

/**
 * Walks both rails in step by normalised arc length, alternating sides.
 *
 * Two things make this work:
 *
 * - **Proportional arc length, not absolute distance.** On the outside of a
 *   bend the rail is longer; pacing both rails by the same fraction spreads
 *   the extra length evenly instead of bunching stitches at one end.
 * - **One penetration per half-step.** Emitting a point on alternating rails
 *   gives a symmetric zigzag where every stitch crosses the column. Emitting
 *   both rails at each step would put a segment *along* a rail between steps,
 *   which is not satin at all.
 *
 * `density` is the spacing between penetrations on the *same* rail, so the
 * needle advances half that per stitch.
 */
export function generateSatinColumn(
  rails: SatinRails,
  settings: StitchSettings,
  options: SatinOptions = {},
): Point[] {
  const left = dedupeConsecutivePoints(rails.left, 1e-9);
  const right = dedupeConsecutivePoints(rails.right, 1e-9);
  if (left.length < 2 || right.length < 2) return [];

  const density = Math.max(0.5, options.density ?? settings.satinDensity);
  const pullCompensation = options.pullCompensation ?? settings.pullCompensation;
  const maxStitchLength = options.maxStitchLength ?? settings.maxStitchLength;

  const leftLength = polylineLength(left);
  const rightLength = polylineLength(right);
  const longest = Math.max(leftLength, rightLength);
  if (longest < 1e-9) return [];

  const halfSteps = Math.max(1, Math.ceil((2 * longest) / density));
  const startOnRight = options.startOnRight ?? false;
  const out: Point[] = [];

  for (let i = 0; i <= halfSteps; i++) {
    const t = i / halfSteps;
    const onLeft = pointAtDistanceAlong(left, t * leftLength);
    const onRight = pointAtDistanceAlong(right, t * rightLength);
    if (!onLeft || !onRight) continue;

    const { start, end } = compensateCrossing(onLeft.point, onRight.point, pullCompensation);
    const useLeft = (i % 2 === 0) !== startOnRight;
    const target = useLeft ? start : end;

    const previous = out[out.length - 1];
    if (previous) {
      for (const point of splitCrossing(previous, target, maxStitchLength, i)) out.push(point);
    }
    out.push(target);
  }

  return out;
}

export interface CenterlineSatinOptions {
  density?: number;
  pullCompensation?: number;
  maxStitchLength?: number;
  startOnRight?: boolean;
  /** Wrap the walk around, for a column that closes on itself. */
  closed?: boolean;
}

/**
 * Satin from a centreline plus a half-width at each point.
 *
 * This is the form `auto-satin` produces, and it is strictly better than
 * walking two rails whenever the centreline is known — because pacing two
 * rails by *proportional* arc length silently assumes they advance together.
 * On a reverse curve they do not: an "S" has its outer rail on the left for
 * the top half and on the right for the bottom, so matching by fraction pairs
 * up points that are nowhere near each other and the crossings skew badly
 * (measured: 8.4 mm crossings on a 1.7 mm stroke). Walking the centreline and
 * stepping out perpendicular cannot make that mistake.
 */
export function generateSatinFromCenterline(
  center: readonly Point[],
  halfWidths: readonly number[],
  settings: StitchSettings,
  options: CenterlineSatinOptions = {},
): Point[] {
  const closed = options.closed ?? false;
  const points = center.map((p) => ({ ...p }));
  const widths = [...halfWidths];
  if (points.length < 2 || widths.length !== points.length) return [];
  if (closed) {
    points.push({ ...points[0] });
    widths.push(widths[0]);
  }

  const density = Math.max(0.5, options.density ?? settings.satinDensity);
  const pullCompensation = options.pullCompensation ?? settings.pullCompensation;
  const maxStitchLength = options.maxStitchLength ?? settings.maxStitchLength;

  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
  }
  const total = cumulative[cumulative.length - 1];
  if (total < 1e-9) return [];

  const halfSteps = Math.max(1, Math.ceil((2 * total) / density));
  const startOnRight = options.startOnRight ?? false;
  const out: Point[] = [];
  let segment = 0;

  for (let i = 0; i <= halfSteps; i++) {
    const target = (i / halfSteps) * total;
    while (segment < points.length - 2 && cumulative[segment + 1] < target) segment++;
    const spanStart = cumulative[segment];
    const spanLength = cumulative[segment + 1] - spanStart;
    const t = spanLength > 1e-9 ? (target - spanStart) / spanLength : 0;

    const a = points[segment];
    const b = points[segment + 1];
    const position = lerp(a, b, t);
    const width = widths[segment] + (widths[segment + 1] - widths[segment]) * t + pullCompensation;
    const direction = normalize(subtract(b, a));
    if (direction.x === 0 && direction.y === 0) continue;

    const useLeft = (i % 2 === 0) !== startOnRight;
    const sign = useLeft ? 1 : -1;
    const point: Point = {
      x: position.x - direction.y * width * sign,
      y: position.y + direction.x * width * sign,
    };

    const previous = out[out.length - 1];
    if (previous) {
      for (const split of splitCrossing(previous, point, maxStitchLength, i)) out.push(split);
    }
    out.push(point);
  }

  return out;
}

export interface SatinWidthStats {
  min: number;
  max: number;
  mean: number;
}

/** Samples the column width, for deciding whether satin is the right choice at all. */
export function satinColumnWidth(rails: SatinRails, samples = 24): SatinWidthStats | null {
  const left = dedupeConsecutivePoints(rails.left, 1e-9);
  const right = dedupeConsecutivePoints(rails.right, 1e-9);
  if (left.length < 2 || right.length < 2) return null;

  const leftLength = polylineLength(left);
  const rightLength = polylineLength(right);
  let min = Infinity;
  let max = -Infinity;
  let total = 0;
  let counted = 0;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const onLeft = pointAtDistanceAlong(left, t * leftLength);
    const onRight = pointAtDistanceAlong(right, t * rightLength);
    if (!onLeft || !onRight) continue;
    const width = distance(onLeft.point, onRight.point);
    if (width < min) min = width;
    if (width > max) max = width;
    total += width;
    counted++;
  }

  if (counted === 0) return null;
  return { min, max, mean: total / counted };
}

/** Resamples a closed ring to a fixed number of evenly spaced points. */
function resampleRingToCount(ring: readonly Point[], count: number): Point[] {
  const perimeter = polylineLength(ring, true);
  if (perimeter < 1e-9) return [];
  const out: Point[] = [];
  for (let i = 0; i < count; i++) {
    const at = pointAtDistanceAlong(ring, (i / count) * perimeter, true);
    if (at) out.push(at.point);
  }
  return out;
}

export interface RingToRailsOptions {
  /** Ring samples used for the search. Must be even; higher is finer and slower. */
  samples?: number;
  /** Crossings measured per candidate split. */
  widthSamples?: number;
}

/**
 * Splits a ribbon-shaped ring into the two rails of a satin column. This is
 * the bridge between a traced contour and a satin column — without it the
 * auto-digitizer could only ever fill.
 *
 * The search considers every split that divides the perimeter in half and
 * keeps the one whose two chains run *closest together*, because that is what
 * distinguishes a ribbon's long sides from any other way of cutting the ring.
 *
 * The obvious alternative — cut at the two farthest-apart points — is wrong,
 * and wrong in a way that looks plausible: on a plain rectangle the farthest
 * pair is a *diagonal*, so the rails come out as two L-shaped chains and the
 * column folds around a corner.
 *
 * Ends taper to a point, since the split lands mid-way across each end cap.
 * That reads correctly on the rounded shapes tracing actually produces; shape
 * tools bypass this entirely and supply rails directly.
 */
export function ringToSatinRails(
  ring: readonly Point[],
  options: RingToRailsOptions = {},
): SatinRails | null {
  const points = openRing(dedupeConsecutivePoints(ring, 1e-9));
  if (points.length < 4) return null;

  const sampleCount = Math.max(8, (options.samples ?? 128) & ~1);
  const widthSamples = Math.max(4, options.widthSamples ?? 16);
  const samples = resampleRingToCount(points, sampleCount);
  if (samples.length < 8) return null;

  const total = samples.length;
  const half = total / 2;
  let bestSplit = 0;
  let bestScore = Infinity;

  for (let split = 0; split < half; split++) {
    let score = 0;
    for (let s = 0; s <= widthSamples; s++) {
      const step = Math.round((s / widthSamples) * half);
      score += distance(samples[(split + step) % total], samples[(split + total - step) % total]);
    }
    if (score < bestScore) {
      bestScore = score;
      bestSplit = split;
    }
  }

  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i <= half; i++) {
    left.push({ ...samples[(bestSplit + i) % total] });
    right.push({ ...samples[(bestSplit + total - i) % total] });
  }
  return { left, right };
}

/**
 * Treats a ring with a single hole as a closed satin column: the outer
 * boundary is one rail and the hole is the other.
 *
 * This is what makes an "O" — or a "D", "o", "e", "p", or any traced outline
 * with one counter — satin correctly. The alternative is filling it, which at
 * lettering sizes looks flat and reads as a rendering error rather than
 * embroidery.
 *
 * Both rings are forced to the same winding so walking them together traverses
 * the same way round; font outlines deliberately wind holes backwards.
 */
export function annulusToSatinRails(
  outer: readonly Point[],
  hole: readonly Point[],
  samples = 128,
): SatinRails | null {
  const outerRing = ensureWinding(openRing(dedupeConsecutivePoints(outer, 1e-9)), true);
  const holeRing = ensureWinding(openRing(dedupeConsecutivePoints(hole, 1e-9)), true);
  if (outerRing.length < 3 || holeRing.length < 3) return null;

  const count = Math.max(16, samples);
  const outerSamples = resampleRingToCount(outerRing, count);
  const holeSamples = resampleRingToCount(holeRing, count);
  if (outerSamples.length < 3 || holeSamples.length < 3) return null;

  // Align the start points, or the satin spirals instead of running radially.
  let offset = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < holeSamples.length; i++) {
    const d = distance(outerSamples[0], holeSamples[i]);
    if (d < bestDistance) {
      bestDistance = d;
      offset = i;
    }
  }

  const right = [...holeSamples.slice(offset), ...holeSamples.slice(0, offset)];
  const left = outerSamples.map((p) => ({ ...p }));
  // Close both loops so the column wraps all the way round.
  left.push({ ...left[0] });
  right.push({ ...right[0] });
  return { left, right };
}
