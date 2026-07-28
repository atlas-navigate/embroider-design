import { cross, distance, normalize, subtract, type Point } from './point.js';
import {
  dedupeConsecutivePoints,
  distanceToPolyline,
  openRing,
  pointInPolygon,
  polygonArea,
  polygonSignedArea,
} from './path.js';

/**
 * Polygon/polyline offsetting.
 *
 * This is a miter-join offset with a bevel fallback — deliberately *not* a
 * general-purpose Clipper-grade implementation. It is exact for convex corners
 * and correct for the small deltas embroidery actually needs (0.1-0.6mm for
 * underlay inset and pull compensation). Deeply concave regions offset inward
 * by more than their local half-width can self-intersect; `offsetPolygonSafe`
 * catches the common failure modes and returns an empty ring rather than a
 * garbage one, so callers can fall back to "no inset" instead of stitching
 * nonsense.
 */

export interface OffsetOptions {
  /**
   * Miter spikes longer than `miterLimit * |delta|` from the original vertex
   * are replaced by a bevel.
   */
  miterLimit?: number;
}

const DEFAULT_MITER_LIMIT = 2;

/** Pruning is O(n*m); above this ring size we skip it and trust the raw offset. */
const PRUNE_VERTEX_LIMIT = 1500;

/** Offsets a counter-clockwise ring outward by `delta` (negative insets). */
function offsetRingCore(ring: readonly Point[], delta: number, miterLimit: number): Point[] {
  const n = ring.length;
  const dirs: Point[] = new Array(n);
  const offsetStarts: Point[] = new Array(n);
  const offsetEnds: Point[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const d = normalize(subtract(b, a));
    // Outward normal of a CCW ring is the right-hand normal of travel.
    const nx = d.y * delta;
    const ny = -d.x * delta;
    dirs[i] = d;
    offsetStarts[i] = { x: a.x + nx, y: a.y + ny };
    offsetEnds[i] = { x: b.x + nx, y: b.y + ny };
  }

  const out: Point[] = [];
  const spikeLimit = miterLimit * Math.abs(delta);
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const p1 = offsetStarts[prev];
    const d1 = dirs[prev];
    const p2 = offsetStarts[i];
    const d2 = dirs[i];
    const denom = cross(d1, d2);
    if (Math.abs(denom) < 1e-9) {
      // Collinear or fully reversed: no meaningful intersection to compute.
      out.push({ x: offsetEnds[prev].x, y: offsetEnds[prev].y });
      continue;
    }
    const t = cross(subtract(p2, p1), d2) / denom;
    const intersection = { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
    if (distance(intersection, ring[i]) > spikeLimit) {
      out.push({ x: offsetEnds[prev].x, y: offsetEnds[prev].y });
      out.push({ x: offsetStarts[i].x, y: offsetStarts[i].y });
    } else {
      out.push(intersection);
    }
  }
  return out;
}

/**
 * Offsets a closed ring. Positive `delta` grows the region, negative shrinks
 * it, regardless of the input winding (which is preserved in the result).
 */
export function offsetPolygon(
  polygon: readonly Point[],
  delta: number,
  options: OffsetOptions = {},
): Point[] {
  const miterLimit = options.miterLimit ?? DEFAULT_MITER_LIMIT;
  const ring = openRing(dedupeConsecutivePoints(polygon, 1e-9));
  if (ring.length < 3) return [];
  if (Math.abs(delta) < 1e-12) return ring;

  const wasCounterClockwise = polygonSignedArea(ring) > 0;
  const work = wasCounterClockwise ? ring : ring.slice().reverse();
  const raw = dedupeConsecutivePoints(offsetRingCore(work, delta, miterLimit), 1e-9);
  if (!wasCounterClockwise) raw.reverse();
  return raw;
}

/**
 * Drops offset vertices that landed on the wrong side of the original ring —
 * the cheap, effective cleanup for the shallow self-intersections a naive
 * miter offset produces at concave corners.
 */
function pruneOffsetArtifacts(
  offsetRing: readonly Point[],
  original: readonly Point[],
  delta: number,
): Point[] {
  if (original.length > PRUNE_VERTEX_LIMIT) return offsetRing.map((p) => ({ ...p }));
  const minDistance = Math.abs(delta) * 0.5;
  const shouldBeInside = delta < 0;
  const kept = offsetRing.filter((p) => {
    if (distanceToPolyline(p, original, true) < minDistance) return false;
    return pointInPolygon(p, original) === shouldBeInside;
  });
  return dedupeConsecutivePoints(kept, 1e-9);
}

/**
 * Offset with validity checks. Returns `[]` when the result is unusable —
 * typically because an inset consumed a region narrower than `2 * |delta|`.
 * Callers should treat `[]` as "skip this pass", never as "empty region".
 */
export function offsetPolygonSafe(
  polygon: readonly Point[],
  delta: number,
  options: OffsetOptions = {},
): Point[] {
  const original = openRing(dedupeConsecutivePoints(polygon, 1e-9));
  if (original.length < 3) return [];
  if (Math.abs(delta) < 1e-12) return original;

  const raw = offsetPolygon(original, delta, options);
  if (raw.length < 3) return [];

  const pruned = pruneOffsetArtifacts(raw, original, delta);
  if (pruned.length < 3) return [];

  const originalSignedArea = polygonSignedArea(original);
  const newSignedArea = polygonSignedArea(pruned);
  if (Math.sign(newSignedArea) !== Math.sign(originalSignedArea)) return [];

  const originalArea = Math.abs(originalSignedArea);
  const newArea = Math.abs(newSignedArea);
  if (newArea < 1e-9) return [];
  // An inset that grew (or an outset that shrank) means the offset folded.
  if (delta < 0 && newArea > originalArea) return [];
  if (delta > 0 && newArea < originalArea) return [];
  return pruned;
}

/** Convenience wrapper: shrink a region by `inset` for underlay or pull compensation. */
export function insetPolygon(
  polygon: readonly Point[],
  inset: number,
  options: OffsetOptions = {},
): Point[] {
  return offsetPolygonSafe(polygon, -Math.abs(inset), options);
}

/** Convenience wrapper: grow a region by `outset`. */
export function outsetPolygon(
  polygon: readonly Point[],
  outset: number,
  options: OffsetOptions = {},
): Point[] {
  return offsetPolygonSafe(polygon, Math.abs(outset), options);
}

/**
 * Offsets an open path. Positive `delta` moves to the **left** of the travel
 * direction, negative to the right.
 */
export function offsetPolylineOpen(
  points: readonly Point[],
  delta: number,
  options: OffsetOptions = {},
): Point[] {
  const miterLimit = options.miterLimit ?? DEFAULT_MITER_LIMIT;
  const pts = dedupeConsecutivePoints(points, 1e-9);
  if (pts.length < 2) return [];
  if (Math.abs(delta) < 1e-12) return pts;

  const edgeCount = pts.length - 1;
  const dirs: Point[] = new Array(edgeCount);
  const offsetStarts: Point[] = new Array(edgeCount);
  const offsetEnds: Point[] = new Array(edgeCount);
  for (let i = 0; i < edgeCount; i++) {
    const d = normalize(subtract(pts[i + 1], pts[i]));
    // Y-down frame: walking +x, your left hand points at -y (up the screen).
    const nx = d.y * delta;
    const ny = -d.x * delta;
    dirs[i] = d;
    offsetStarts[i] = { x: pts[i].x + nx, y: pts[i].y + ny };
    offsetEnds[i] = { x: pts[i + 1].x + nx, y: pts[i + 1].y + ny };
  }

  const out: Point[] = [{ x: offsetStarts[0].x, y: offsetStarts[0].y }];
  const spikeLimit = miterLimit * Math.abs(delta);
  for (let i = 1; i < edgeCount; i++) {
    const p1 = offsetStarts[i - 1];
    const d1 = dirs[i - 1];
    const p2 = offsetStarts[i];
    const d2 = dirs[i];
    const denom = cross(d1, d2);
    if (Math.abs(denom) < 1e-9) {
      out.push({ x: offsetEnds[i - 1].x, y: offsetEnds[i - 1].y });
      continue;
    }
    const t = cross(subtract(p2, p1), d2) / denom;
    const intersection = { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
    if (distance(intersection, pts[i]) > spikeLimit) {
      out.push({ x: offsetEnds[i - 1].x, y: offsetEnds[i - 1].y });
      out.push({ x: offsetStarts[i].x, y: offsetStarts[i].y });
    } else {
      out.push(intersection);
    }
  }
  out.push({ x: offsetEnds[edgeCount - 1].x, y: offsetEnds[edgeCount - 1].y });
  return dedupeConsecutivePoints(out, 1e-9);
}

export interface SatinRails {
  /** Rail on the left of the centerline's travel direction. */
  left: Point[];
  /** Rail on the right of the centerline's travel direction. */
  right: Point[];
}

/**
 * Builds the two rails of a satin column from a stroked centerline. This is
 * how a "stroke this path with satin" request becomes something
 * `satin-column` can walk.
 */
export function satinRailsFromCenterline(centerline: readonly Point[], width: number): SatinRails {
  const half = Math.abs(width) / 2;
  return {
    left: offsetPolylineOpen(centerline, half),
    right: offsetPolylineOpen(centerline, -half),
  };
}

/**
 * Converts a stroked open path into a closed fillable ring (left rail, then
 * the right rail reversed). Butt caps — round/square caps are a Phase 3 item.
 */
export function strokeToPolygon(centerline: readonly Point[], width: number): Point[] {
  const rails = satinRailsFromCenterline(centerline, width);
  if (rails.left.length < 2 || rails.right.length < 2) return [];
  return dedupeConsecutivePoints([...rails.left, ...rails.right.slice().reverse()], 1e-9);
}

/**
 * Concentric inset rings, innermost last. Used for spiral/contour fills and
 * for multi-pass underlay. Stops as soon as an inset stops being valid.
 */
export function concentricInsets(
  polygon: readonly Point[],
  step: number,
  maxRings = 64,
  options: OffsetOptions = {},
): Point[][] {
  const rings: Point[][] = [];
  let current = openRing(dedupeConsecutivePoints(polygon, 1e-9));
  const spacing = Math.abs(step);
  if (current.length < 3 || spacing < 1e-9) return rings;
  for (let i = 0; i < maxRings; i++) {
    const next = offsetPolygonSafe(current, -spacing, options);
    if (next.length < 3) break;
    if (polygonArea(next) < spacing * spacing) break;
    rings.push(next);
    current = next;
  }
  return rings;
}
