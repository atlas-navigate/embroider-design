import type { Point } from './point.js';
import { boundingBoxOfMany } from './path.js';

/**
 * Analytic scanline decomposition of a region into parallel segments.
 *
 * This is the backbone of tatami fill: rotate the region so the requested
 * stitch angle is horizontal, slice it at the row spacing, then rotate the
 * resulting spans back to world space. Working analytically (rather than off
 * the raster in `distance-transform.ts`) keeps row endpoints exact, which
 * matters because a fill's edge quality is entirely down to where its rows
 * terminate.
 */

export interface FillSegment {
  start: Point;
  end: Point;
  /** Row index, counting up from the first row. Fills alternate direction by parity. */
  row: number;
}

export interface ScanOptions {
  /** Stitch angle in radians. 0 gives horizontal rows. */
  angle?: number;
  /**
   * Shifts the row grid along the scan normal, in world units. Keeping this
   * consistent across a design's layers stops adjacent fills from lining up
   * their row boundaries and creating a visible seam.
   */
  phase?: number;
  /** Spans shorter than this are dropped — they produce unstitchable stubs. */
  minSegmentLength?: number;
  /** Safety valve against absurd row counts on a huge region with tiny spacing. */
  maxRows?: number;
}

const DEFAULT_MAX_ROWS = 20000;

/**
 * Even-odd span extraction along the horizontal line `y`.
 * Returns a flat, sorted list of crossing x-coordinates.
 */
export function horizontalCrossings(
  rings: readonly (readonly Point[])[],
  y: number,
  out: number[] = [],
): number[] {
  out.length = 0;
  for (const ring of rings) {
    const n = ring.length;
    if (n < 3) continue;
    for (let i = 0, prev = n - 1; i < n; prev = i++) {
      const a = ring[prev];
      const b = ring[i];
      // Half-open vertex rule: a vertex exactly on the line counts once, so
      // rows that graze a corner do not produce a spurious zero-length span.
      if (a.y > y !== b.y > y) {
        out.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
  }
  out.sort((p, q) => p - q);
  return out;
}

/**
 * Slices a region (outer ring + holes, all passed in `rings`) into parallel
 * segments at `spacing` apart, in world coordinates.
 */
export function scanFillSegments(
  rings: readonly (readonly Point[])[],
  spacing: number,
  options: ScanOptions = {},
): FillSegment[] {
  if (spacing <= 0) throw new Error('scanFillSegments: spacing must be > 0');
  const angle = options.angle ?? 0;
  const phase = options.phase ?? 0;
  const minSegmentLength = options.minSegmentLength ?? 0;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;

  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const rotated: Point[][] = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const r: Point[] = new Array(ring.length);
    for (let i = 0; i < ring.length; i++) {
      r[i] = { x: ring[i].x * cos - ring[i].y * sin, y: ring[i].x * sin + ring[i].y * cos };
    }
    rotated.push(r);
  }
  const box = boundingBoxOfMany(rotated);
  if (!box) return [];

  // Anchor rows to a global grid so `phase` behaves consistently no matter
  // where the region sits.
  const firstRow = Math.ceil((box.minY - phase) / spacing);
  const lastRow = Math.floor((box.maxY - phase) / spacing);
  if (lastRow < firstRow) return [];
  if (lastRow - firstRow + 1 > maxRows) {
    throw new Error(
      `scanFillSegments: ${lastRow - firstRow + 1} rows exceeds the ${maxRows}-row limit; ` +
        'increase spacing or shrink the region',
    );
  }

  // Rotate span endpoints back to world space.
  const backCos = Math.cos(angle);
  const backSin = Math.sin(angle);
  const segments: FillSegment[] = [];
  const crossings: number[] = [];

  for (let k = firstRow; k <= lastRow; k++) {
    const y = k * spacing + phase;
    horizontalCrossings(rotated, y, crossings);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const x0 = crossings[i];
      const x1 = crossings[i + 1];
      if (x1 - x0 < minSegmentLength) continue;
      segments.push({
        start: { x: x0 * backCos - y * backSin, y: x0 * backSin + y * backCos },
        end: { x: x1 * backCos - y * backSin, y: x1 * backSin + y * backCos },
        row: k - firstRow,
      });
    }
  }
  return segments;
}

/**
 * Groups segments into runs of consecutive rows that the needle can sew
 * without leaving the region. A row that produces two spans (an hourglass, a
 * ring) splits the fill into separate runs, each stitched as its own boustro-
 * phedon pass, which is what avoids long diagonal jumps across a hole.
 */
export function groupSegmentsIntoRuns(segments: readonly FillSegment[]): FillSegment[][] {
  if (segments.length === 0) return [];

  const byRow = new Map<number, FillSegment[]>();
  for (const segment of segments) {
    const bucket = byRow.get(segment.row);
    if (bucket) bucket.push(segment);
    else byRow.set(segment.row, [segment]);
  }

  const rows = [...byRow.keys()].sort((a, b) => a - b);
  const runs: FillSegment[][] = [];
  let open: { run: FillSegment[]; last: FillSegment }[] = [];

  for (const row of rows) {
    const rowSegments = byRow.get(row) ?? [];
    const nextOpen: { run: FillSegment[]; last: FillSegment }[] = [];
    const claimed = new Set<FillSegment>();

    for (const candidate of open) {
      // Continue a run into the segment on the next row that overlaps it most.
      let bestSegment: FillSegment | null = null;
      let bestOverlap = 0;
      for (const segment of rowSegments) {
        if (claimed.has(segment)) continue;
        const overlap = overlapLength(candidate.last, segment);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestSegment = segment;
        }
      }
      if (bestSegment && candidate.last.row + 1 === row) {
        claimed.add(bestSegment);
        candidate.run.push(bestSegment);
        nextOpen.push({ run: candidate.run, last: bestSegment });
      } else {
        runs.push(candidate.run);
      }
    }

    for (const segment of rowSegments) {
      if (claimed.has(segment)) continue;
      nextOpen.push({ run: [segment], last: segment });
    }
    open = nextOpen;
  }

  for (const candidate of open) runs.push(candidate.run);
  return runs;
}

/** Overlap of two segments measured along the scan direction. */
function overlapLength(a: FillSegment, b: FillSegment): number {
  const aLow = Math.min(projectAlong(a.start, a), projectAlong(a.end, a));
  const aHigh = Math.max(projectAlong(a.start, a), projectAlong(a.end, a));
  const bLow = Math.min(projectAlong(b.start, a), projectAlong(b.end, a));
  const bHigh = Math.max(projectAlong(b.start, a), projectAlong(b.end, a));
  return Math.max(0, Math.min(aHigh, bHigh) - Math.max(aLow, bLow));
}

/** Scalar position of `p` along `reference`'s direction. */
function projectAlong(p: Point, reference: FillSegment): number {
  const dx = reference.end.x - reference.start.x;
  const dy = reference.end.y - reference.start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return p.x;
  return (p.x * dx + p.y * dy) / len;
}
