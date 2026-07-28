import { distance, type Point } from '../geometry/point.js';
import {
  dedupeConsecutivePoints,
  resamplePolylinePreservingVertices,
} from '../geometry/path.js';
import type { StitchSettings } from './settings.js';

/**
 * Running stitch and its multi-pass variants — the outline workhorses.
 */

export interface RunningStitchOptions {
  /** Treat the path as a closed ring and sew the closing edge. */
  closed?: boolean;
  /** Override the settings' stitch length. */
  stitchLength?: number;
}

/**
 * A single pass along the path.
 *
 * Vertices are always preserved: sampling straight through a corner at a fixed
 * arc length rounds it off, which on a square or a letterform reads as a
 * defect rather than a smoothing.
 */
export function generateRunningStitch(
  path: readonly Point[],
  settings: StitchSettings,
  options: RunningStitchOptions = {},
): Point[] {
  const points = dedupeConsecutivePoints(path, 1e-9);
  if (points.length < 2) return points;
  const stitchLength = Math.max(1, options.stitchLength ?? settings.stitchLength);
  const sampled = resamplePolylinePreservingVertices(
    points,
    stitchLength,
    options.closed ?? false,
  );
  return mergeShortStitches(sampled, settings.minStitchLength);
}

/**
 * Bean (multi-pass) stitch: each segment is sewn forward, back, and forward
 * again. Used for outlines that need weight without the bulk of a satin
 * column, and for detail too fine to satin at all.
 */
export function generateBeanStitch(
  path: readonly Point[],
  settings: StitchSettings,
  options: RunningStitchOptions = {},
): Point[] {
  const base = generateRunningStitch(path, settings, options);
  if (base.length < 2) return base;
  const repeats = Math.max(1, settings.beanRepeats | 1);
  if (repeats === 1) return base;

  const out: Point[] = [{ ...base[0] }];
  const backAndForth = (repeats - 1) / 2;
  for (let i = 1; i < base.length; i++) {
    const previous = base[i - 1];
    const current = base[i];
    out.push({ ...current });
    for (let pass = 0; pass < backAndForth; pass++) {
      out.push({ ...previous });
      out.push({ ...current });
    }
  }
  return out;
}

/**
 * Sews the path `count` times end to end, reversing on alternate passes so the
 * needle does not have to travel back to the start.
 */
export function generateRepeatedRun(
  path: readonly Point[],
  settings: StitchSettings,
  count: number,
  options: RunningStitchOptions = {},
): Point[] {
  const base = generateRunningStitch(path, settings, options);
  if (base.length < 2 || count <= 1) return base;
  const out: Point[] = base.map((p) => ({ ...p }));
  for (let pass = 1; pass < count; pass++) {
    const leg = pass % 2 === 1 ? [...base].reverse() : base;
    // Skip the first point: it duplicates where the previous pass ended.
    for (let i = 1; i < leg.length; i++) out.push({ ...leg[i] });
  }
  return out;
}

/**
 * Drops points that sit closer than `minLength` to their predecessor, keeping
 * the final point so the path still ends where it should.
 *
 * Very short stitches are the single most common cause of thread breaks and
 * needle deflection: the needle cannot clear the previous penetration and
 * punches into the same hole.
 */
export function mergeShortStitches(points: readonly Point[], minLength: number): Point[] {
  if (points.length <= 2 || minLength <= 0) return points.map((p) => ({ ...p }));
  const out: Point[] = [{ ...points[0] }];
  for (let i = 1; i < points.length - 1; i++) {
    if (distance(out[out.length - 1], points[i]) >= minLength) out.push({ ...points[i] });
  }
  const last = points[points.length - 1];
  // If the final point crowds the one before it, replace rather than append —
  // dropping it outright would leave the path short of its endpoint.
  if (out.length > 1 && distance(out[out.length - 1], last) < minLength) {
    out[out.length - 1] = { ...last };
  } else {
    out.push({ ...last });
  }
  return out;
}
