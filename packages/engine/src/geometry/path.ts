import { distance, lerp, pointsEqual, type Point } from './point.js';

/** An ordered run of points. Open unless a function says otherwise. */
export type Polyline = Point[];

/** A closed ring. The closing edge (last -> first) is implicit, never duplicated. */
export type Polygon = Point[];

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundingBoxOfPoints(points: readonly Point[]): BoundingBox | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function boundingBoxOfMany(rings: readonly (readonly Point[])[]): BoundingBox | null {
  let box: BoundingBox | null = null;
  for (const ring of rings) {
    const b = boundingBoxOfPoints(ring);
    if (b) box = box ? boundingBoxUnion(box, b) : b;
  }
  return box;
}

export function boundingBoxUnion(a: BoundingBox, b: BoundingBox): BoundingBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function boundingBoxWidth(b: BoundingBox): number {
  return b.maxX - b.minX;
}

export function boundingBoxHeight(b: BoundingBox): number {
  return b.maxY - b.minY;
}

export function boundingBoxCenter(b: BoundingBox): Point {
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

export function expandBoundingBox(b: BoundingBox, amount: number): BoundingBox {
  return {
    minX: b.minX - amount,
    minY: b.minY - amount,
    maxX: b.maxX + amount,
    maxY: b.maxY + amount,
  };
}

export function boundingBoxContainsPoint(b: BoundingBox, p: Point): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
}

export function boundingBoxContainsBox(outer: BoundingBox, inner: BoundingBox): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.minY >= outer.minY &&
    inner.maxX <= outer.maxX &&
    inner.maxY <= outer.maxY
  );
}

export function boundingBoxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);
}

export function polylineLength(points: readonly Point[], closed = false): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1], points[i]);
  }
  if (closed) total += distance(points[points.length - 1], points[0]);
  return total;
}

/**
 * Signed area via the shoelace formula. Positive means counter-clockwise in a
 * standard (Y-up) coordinate frame. Note the design canvas is Y-down, so a
 * visually clockwise ring reports positive here — always reason about winding
 * through this function rather than by eye.
 */
export function polygonSignedArea(points: readonly Point[]): number {
  const n = points.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function polygonArea(points: readonly Point[]): number {
  return Math.abs(polygonSignedArea(points));
}

export function isCounterClockwise(points: readonly Point[]): boolean {
  return polygonSignedArea(points) > 0;
}

/** Returns a copy wound in the requested direction (reversing only if needed). */
export function ensureWinding(points: readonly Point[], counterClockwise: boolean): Point[] {
  const copy = points.map((p) => ({ x: p.x, y: p.y }));
  if (isCounterClockwise(copy) !== counterClockwise) copy.reverse();
  return copy;
}

export function reversePolyline(points: readonly Point[]): Point[] {
  return points.map((p) => ({ x: p.x, y: p.y })).reverse();
}

/** Even-odd ray casting. Points exactly on an edge are not guaranteed either way. */
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  const n = polygon.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > p.y !== b.y > p.y) {
      const t = (p.y - a.y) / (b.y - a.y);
      if (p.x < a.x + t * (b.x - a.x)) inside = !inside;
    }
  }
  return inside;
}

/** Inside the outer ring and outside every hole. */
export function pointInPolygonWithHoles(
  p: Point,
  outer: readonly Point[],
  holes: readonly (readonly Point[])[] = [],
): boolean {
  if (!pointInPolygon(p, outer)) return false;
  for (const hole of holes) {
    if (pointInPolygon(p, hole)) return false;
  }
  return true;
}

export interface ClosestPointResult {
  /** The closest point on the segment. */
  point: Point;
  /** Parametric position along the segment, clamped to [0, 1]. */
  t: number;
  distance: number;
}

export function closestPointOnSegment(p: Point, a: Point, b: Point): ClosestPointResult {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-18) {
    return { point: { x: a.x, y: a.y }, t: 0, distance: distance(p, a) };
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { point, t, distance: distance(p, point) };
}

export function distanceToPolyline(p: Point, points: readonly Point[], closed = false): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return distance(p, points[0]);
  let best = Infinity;
  const last = closed ? points.length : points.length - 1;
  for (let i = 0; i < last; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const d = closestPointOnSegment(p, a, b).distance;
    if (d < best) best = d;
  }
  return best;
}

export function dedupeConsecutivePoints(points: readonly Point[], epsilon = 1e-9): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || !pointsEqual(prev, p, epsilon)) out.push({ x: p.x, y: p.y });
  }
  return out;
}

/** Drops a trailing point that merely repeats the first one. */
export function openRing(points: readonly Point[], epsilon = 1e-9): Point[] {
  const out = points.map((p) => ({ x: p.x, y: p.y }));
  while (out.length > 1 && pointsEqual(out[0], out[out.length - 1], epsilon)) out.pop();
  return out;
}

/** Appends a copy of the first point so the ring reads as an explicitly closed path. */
export function closeRing(points: readonly Point[], epsilon = 1e-9): Point[] {
  const out = points.map((p) => ({ x: p.x, y: p.y }));
  if (out.length > 1 && !pointsEqual(out[0], out[out.length - 1], epsilon)) {
    out.push({ x: out[0].x, y: out[0].y });
  }
  return out;
}

export function polygonCentroid(points: readonly Point[]): Point {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n < 3) return polylineCentroid(points);
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-12) return polylineCentroid(points);
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

/** Plain average of the vertices — the fallback for degenerate rings. */
export function polylineCentroid(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

export function rotateRingToStartAt(points: readonly Point[], index: number): Point[] {
  const n = points.length;
  if (n === 0) return [];
  const i = ((index % n) + n) % n;
  const out: Point[] = [];
  for (let k = 0; k < n; k++) out.push({ x: points[(i + k) % n].x, y: points[(i + k) % n].y });
  return out;
}

export interface PointAlongResult {
  point: Point;
  /** Index of the segment start vertex. */
  segmentIndex: number;
  /** Parametric position within that segment. */
  t: number;
}

/** Locates the point a given arc-length along the path. Clamps at both ends. */
export function pointAtDistanceAlong(
  points: readonly Point[],
  targetDistance: number,
  closed = false,
): PointAlongResult | null {
  if (points.length === 0) return null;
  if (points.length === 1) return { point: { ...points[0] }, segmentIndex: 0, t: 0 };
  if (targetDistance <= 0) return { point: { ...points[0] }, segmentIndex: 0, t: 0 };
  const segmentCount = closed ? points.length : points.length - 1;
  let remaining = targetDistance;
  for (let i = 0; i < segmentCount; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const segLen = distance(a, b);
    if (segLen <= 1e-12) continue;
    if (remaining <= segLen) {
      const t = remaining / segLen;
      return { point: lerp(a, b, t), segmentIndex: i, t };
    }
    remaining -= segLen;
  }
  const lastIndex = segmentCount - 1;
  const endPoint = closed ? points[0] : points[points.length - 1];
  return { point: { x: endPoint.x, y: endPoint.y }, segmentIndex: Math.max(0, lastIndex), t: 1 };
}

export interface ResampleOptions {
  closed?: boolean;
  /**
   * A final stub shorter than `spacing * minTailRatio` is absorbed into the
   * previous sample instead of becoming its own tiny stitch. Tiny stitches are
   * the main cause of thread breaks and needle deflection on real machines.
   */
  minTailRatio?: number;
}

/**
 * Walks the path at a constant arc-length interval. Vertices are *not*
 * preserved — use this where even stitch length matters more than shape
 * fidelity (long smooth curves, travel runs).
 */
export function resamplePolylineUniform(
  points: readonly Point[],
  spacing: number,
  options: ResampleOptions = {},
): Point[] {
  if (spacing <= 0) throw new Error('resamplePolylineUniform: spacing must be > 0');
  const closed = options.closed ?? false;
  const minTailRatio = options.minTailRatio ?? 0.35;
  const pts = dedupeConsecutivePoints(points, 1e-9);
  if (pts.length === 0) return [];
  if (pts.length === 1) return [{ ...pts[0] }];

  const work = closed ? [...pts, { x: pts[0].x, y: pts[0].y }] : pts;
  const out: Point[] = [{ x: work[0].x, y: work[0].y }];
  let carry = 0;

  for (let i = 1; i < work.length; i++) {
    const a = work[i - 1];
    const b = work[i];
    const segLen = distance(a, b);
    if (segLen <= 1e-12) continue;
    let t = spacing - carry;
    while (t <= segLen) {
      out.push(lerp(a, b, t / segLen));
      t += spacing;
    }
    carry = segLen - (t - spacing);
  }

  const last = work[work.length - 1];
  const tail = distance(out[out.length - 1], last);
  if (tail > 1e-9) {
    if (out.length > 1 && tail < spacing * minTailRatio) {
      out[out.length - 1] = { x: last.x, y: last.y };
    } else {
      out.push({ x: last.x, y: last.y });
    }
  }
  return out;
}

/**
 * Splits each segment into equal parts no longer than `maxSpacing`, so every
 * original vertex survives. This is the right default for shape outlines —
 * corners stay sharp instead of being sampled past.
 */
export function resamplePolylinePreservingVertices(
  points: readonly Point[],
  maxSpacing: number,
  closed = false,
): Point[] {
  if (maxSpacing <= 0) {
    throw new Error('resamplePolylinePreservingVertices: maxSpacing must be > 0');
  }
  const pts = dedupeConsecutivePoints(points, 1e-9);
  if (pts.length === 0) return [];
  if (pts.length === 1) return [{ ...pts[0] }];

  const out: Point[] = [{ x: pts[0].x, y: pts[0].y }];
  const segmentCount = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segmentCount; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const segLen = distance(a, b);
    if (segLen <= 1e-12) continue;
    const divisions = Math.max(1, Math.ceil(segLen / maxSpacing));
    for (let k = 1; k <= divisions; k++) {
      out.push(lerp(a, b, k / divisions));
    }
  }
  return out;
}

/**
 * Total absolute turning angle, in radians. Used to decide whether a traced
 * contour is smooth enough to satin-stitch as a single column.
 */
export function totalTurning(points: readonly Point[], closed = false): number {
  const n = points.length;
  if (n < 3) return 0;
  let total = 0;
  const limit = closed ? n : n - 2;
  for (let i = 0; i < limit; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const c = points[(i + 2) % n];
    const angle1 = Math.atan2(b.y - a.y, b.x - a.x);
    const angle2 = Math.atan2(c.y - b.y, c.x - b.x);
    let delta = angle2 - angle1;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    total += Math.abs(delta);
  }
  return total;
}
