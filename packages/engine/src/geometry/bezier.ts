import type { Point } from './point.js';

/**
 * Bezier flattening. Every downstream stage (stitch generation, tracing,
 * glyph outlines) works on polylines, so curves are converted exactly once,
 * here, using adaptive subdivision against a world-space tolerance.
 */

/** Hard cap on recursion so a degenerate/NaN curve can never blow the stack. */
const MAX_SUBDIVISION_DEPTH = 24;

export function cubicPointAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

export function quadraticPointAt(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt;
  const b = 2 * mt * t;
  const c = t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x, y: a * p0.y + b * p1.y + c * p2.y };
}

export function cubicTangentAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = 3 * mt * mt;
  const b = 6 * mt * t;
  const c = 3 * t * t;
  return {
    x: a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x),
    y: a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y),
  };
}

/** Distance from `p` to segment `a`-`b` (clamped, so cusps behave sanely). */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-18) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function cubicIsFlat(p0: Point, p1: Point, p2: Point, p3: Point, tolerance: number): boolean {
  return (
    distanceToSegment(p1, p0, p3) <= tolerance && distanceToSegment(p2, p0, p3) <= tolerance
  );
}

function subdivideCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  tolerance: number,
  depth: number,
  out: Point[],
): void {
  if (depth >= MAX_SUBDIVISION_DEPTH || cubicIsFlat(p0, p1, p2, p3, tolerance)) {
    out.push({ x: p3.x, y: p3.y });
    return;
  }
  // De Casteljau split at t = 0.5.
  const p01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const p12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const p23 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
  const p012 = { x: (p01.x + p12.x) / 2, y: (p01.y + p12.y) / 2 };
  const p123 = { x: (p12.x + p23.x) / 2, y: (p12.y + p23.y) / 2 };
  const mid = { x: (p012.x + p123.x) / 2, y: (p012.y + p123.y) / 2 };
  subdivideCubic(p0, p01, p012, mid, tolerance, depth + 1, out);
  subdivideCubic(mid, p123, p23, p3, tolerance, depth + 1, out);
}

/**
 * Flattens a cubic Bezier to a polyline.
 *
 * The start point is **not** included (callers are appending to an existing
 * path that already ends at `p0`); the end point always is.
 */
export function flattenCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  tolerance = 0.5,
): Point[] {
  const out: Point[] = [];
  const tol = tolerance > 0 ? tolerance : 0.5;
  subdivideCubic(p0, p1, p2, p3, tol, 0, out);
  return out;
}

/** Flattens a quadratic Bezier by elevating it to a cubic. */
export function flattenQuadratic(p0: Point, p1: Point, p2: Point, tolerance = 0.5): Point[] {
  const c1 = { x: p0.x + (2 / 3) * (p1.x - p0.x), y: p0.y + (2 / 3) * (p1.y - p0.y) };
  const c2 = { x: p2.x + (2 / 3) * (p1.x - p2.x), y: p2.y + (2 / 3) * (p1.y - p2.y) };
  return flattenCubic(p0, c1, c2, p2, tolerance);
}

/** Approximate arc length of a cubic, by flattening at a tight tolerance. */
export function cubicLength(p0: Point, p1: Point, p2: Point, p3: Point, tolerance = 0.05): number {
  const pts = flattenCubic(p0, p1, p2, p3, tolerance);
  let total = 0;
  let prev = p0;
  for (const p of pts) {
    total += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return total;
}

/**
 * Approximates a circular arc with cubic Beziers and returns the flattened
 * polyline (excluding the start point). Used by the ellipse/arc shape tools.
 */
export function flattenArc(
  center: Point,
  radiusX: number,
  radiusY: number,
  startAngle: number,
  endAngle: number,
  tolerance = 0.5,
): Point[] {
  const sweep = endAngle - startAngle;
  if (Math.abs(sweep) < 1e-12) return [];
  // Keep each Bezier segment at or below a quarter turn for good accuracy.
  const segments = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
  const delta = sweep / segments;
  // Standard magic constant for approximating an arc of `delta` radians.
  const k = (4 / 3) * Math.tan(delta / 4);
  const out: Point[] = [];
  let angle = startAngle;
  let current = {
    x: center.x + radiusX * Math.cos(angle),
    y: center.y + radiusY * Math.sin(angle),
  };
  for (let i = 0; i < segments; i++) {
    const next = angle + delta;
    const end = {
      x: center.x + radiusX * Math.cos(next),
      y: center.y + radiusY * Math.sin(next),
    };
    const c1 = {
      x: current.x - k * radiusX * Math.sin(angle),
      y: current.y + k * radiusY * Math.cos(angle),
    };
    const c2 = {
      x: end.x + k * radiusX * Math.sin(next),
      y: end.y - k * radiusY * Math.cos(next),
    };
    out.push(...flattenCubic(current, c1, c2, end, tolerance));
    current = end;
    angle = next;
  }
  return out;
}
