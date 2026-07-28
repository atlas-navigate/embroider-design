import { distance, lerp, type Point } from '../geometry/point.js';
import { concentricInsets } from '../geometry/offset.js';
import { groupSegmentsIntoRuns, scanFillSegments, type FillSegment } from '../geometry/scanline.js';
import { degreesToRadians, type StitchSettings } from './settings.js';
import { mergeShortStitches } from './running-stitch.js';

/**
 * Area fills.
 *
 * A fill is emitted as a list of *runs* — each run is a contiguous path the
 * needle can sew without leaving the fabric. Holes and pinch points split a
 * region into several runs; the caller decides how to travel between them
 * (`travelTo` inserts a trim when the gap warrants one).
 */

export interface FillOptions {
  /** Row direction in degrees. Overrides the settings. */
  angle?: number;
  /** Row spacing. Overrides the settings. */
  spacing?: number;
  /** Stitch length along a row. Overrides the settings. */
  stitchLength?: number;
  /**
   * Shifts the row grid along the scan normal. Give adjacent layers different
   * phases and their row boundaries stop lining up into a visible seam.
   */
  phase?: number;
}

/**
 * Places penetrations along one row.
 *
 * `stagger` is what turns a set of parallel rows into a tatami: without it,
 * every row's penetrations land at the same offset and the fill develops
 * channels running across the grain. Offsetting each row by a rotating
 * fraction of the stitch length scatters them.
 */
function stitchRow(
  segment: FillSegment,
  stitchLength: number,
  stagger: number,
  minStitchLength: number,
): Point[] {
  const length = distance(segment.start, segment.end);
  if (length < 1e-9) return [{ ...segment.start }];

  const points: Point[] = [{ ...segment.start }];
  let travelled = stagger % stitchLength;
  if (travelled <= 1e-9) travelled = stitchLength;
  while (travelled < length - 1e-9) {
    points.push(lerp(segment.start, segment.end, travelled / length));
    travelled += stitchLength;
  }
  points.push({ ...segment.end });
  return mergeShortStitches(points, minStitchLength);
}

/**
 * Tatami (scanline) fill.
 *
 * Slices the region into parallel rows and sews them boustrophedon — down one,
 * back the next — so the needle never has to jump between adjacent rows. Which
 * end of each row to start from is chosen by proximity rather than strict
 * alternation, which keeps the turns short even when a region's rows shift
 * sideways.
 */
export function generateTatamiFill(
  rings: readonly (readonly Point[])[],
  settings: StitchSettings,
  options: FillOptions = {},
): Point[][] {
  const spacing = Math.max(0.5, options.spacing ?? settings.fillSpacing);
  const stitchLength = Math.max(1, options.stitchLength ?? settings.stitchLength);
  const angle = degreesToRadians(options.angle ?? settings.fillAngle);
  const staggerRepeat = Math.max(1, settings.staggerRepeat);
  const staggerStep = stitchLength / staggerRepeat;

  const segments = scanFillSegments(rings, spacing, {
    angle,
    phase: options.phase ?? 0,
    minSegmentLength: settings.minStitchLength,
  });
  if (segments.length === 0) return [];

  const runs: Point[][] = [];
  for (const run of groupSegmentsIntoRuns(segments)) {
    const path: Point[] = [];
    for (const segment of run) {
      const stagger = (segment.row % staggerRepeat) * staggerStep;
      const rowPoints = stitchRow(segment, stitchLength, stagger, settings.minStitchLength);
      if (rowPoints.length === 0) continue;

      if (path.length > 0) {
        // Enter the row from whichever end the needle is already nearest.
        const tail = path[path.length - 1];
        const toStart = distance(tail, rowPoints[0]);
        const toEnd = distance(tail, rowPoints[rowPoints.length - 1]);
        if (toEnd < toStart) rowPoints.reverse();
      }
      for (const point of rowPoints) path.push(point);
    }
    if (path.length >= 2) runs.push(path);
  }
  return runs;
}

/**
 * Contour fill: concentric rings working inward from the outline.
 *
 * Better than tatami on circular and organic shapes, where parallel rows have
 * to terminate against a curve and leave a ragged edge. Holes are not
 * supported — the inset only tracks the outer boundary.
 */
export function generateContourFill(
  outer: readonly Point[],
  settings: StitchSettings,
  options: FillOptions = {},
): Point[][] {
  const spacing = Math.max(0.5, options.spacing ?? settings.fillSpacing);
  const stitchLength = Math.max(1, options.stitchLength ?? settings.stitchLength);
  const runs: Point[][] = [];

  const rings = [outer, ...concentricInsets(outer, spacing)];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const closed = [...ring, ring[0]];
    const path: Point[] = [];
    for (let i = 1; i < closed.length; i++) {
      const from = closed[i - 1];
      const to = closed[i];
      const length = distance(from, to);
      const divisions = Math.max(1, Math.ceil(length / stitchLength));
      if (i === 1) path.push({ ...from });
      for (let k = 1; k <= divisions; k++) path.push(lerp(from, to, k / divisions));
    }
    const merged = mergeShortStitches(path, settings.minStitchLength);
    if (merged.length >= 2) runs.push(merged);
  }
  return runs;
}

/** Total sewn length across every run, for stitch-count estimates. */
export function measureRuns(runs: readonly (readonly Point[])[]): number {
  let total = 0;
  for (const run of runs) {
    for (let i = 1; i < run.length; i++) total += distance(run[i - 1], run[i]);
  }
  return total;
}
