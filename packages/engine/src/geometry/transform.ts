import type { Point } from './point.js';

/**
 * A 2D affine transform, stored as the six meaningful members of a 3x3 matrix:
 *
 * ```
 * | a c e |
 * | b d f |
 * | 0 0 1 |
 * ```
 *
 * This is the same member ordering used by SVG/Canvas (`matrix(a b c d e f)`),
 * which keeps interop with the renderer trivial.
 */
export interface AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY: AffineMatrix = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

export function identity(): AffineMatrix {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

export function translation(tx: number, ty: number): AffineMatrix {
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
}

export function scaling(sx: number, sy: number = sx): AffineMatrix {
  return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
}

export function rotation(radians: number): AffineMatrix {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
}

export function skewing(radiansX: number, radiansY: number): AffineMatrix {
  return { a: 1, b: Math.tan(radiansY), c: Math.tan(radiansX), d: 1, e: 0, f: 0 };
}

/**
 * Matrix product `outer * inner`. In transform terms the result applies
 * `inner` first and `outer` second.
 */
export function multiply(outer: AffineMatrix, inner: AffineMatrix): AffineMatrix {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    e: outer.a * inner.e + outer.c * inner.f + outer.e,
    f: outer.b * inner.e + outer.d * inner.f + outer.f,
  };
}

/**
 * Combines transforms in *application* order: `compose(t1, t2, t3)` applies
 * `t1`, then `t2`, then `t3`. This reads far more naturally than nested
 * `multiply` calls and is what callers should reach for.
 */
export function compose(...matrices: AffineMatrix[]): AffineMatrix {
  let result = identity();
  for (const m of matrices) {
    result = multiply(m, result);
  }
  return result;
}

export function applyToPoint(m: AffineMatrix, p: Point): Point {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

/** Applies only the linear part, ignoring translation — correct for direction vectors. */
export function applyToVector(m: AffineMatrix, v: Point): Point {
  return { x: m.a * v.x + m.c * v.y, y: m.b * v.x + m.d * v.y };
}

export function applyToPoints(m: AffineMatrix, points: readonly Point[]): Point[] {
  return points.map((p) => applyToPoint(m, p));
}

export function determinant(m: AffineMatrix): number {
  return m.a * m.d - m.b * m.c;
}

/** Returns `null` for singular (non-invertible) matrices rather than throwing. */
export function invert(m: AffineMatrix): AffineMatrix | null {
  const det = determinant(m);
  if (Math.abs(det) < 1e-12) return null;
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
}

/** Applies `m` about `pivot` instead of about the origin. */
export function around(m: AffineMatrix, pivot: Point): AffineMatrix {
  return compose(translation(-pivot.x, -pivot.y), m, translation(pivot.x, pivot.y));
}

export function rotateAround(radians: number, pivot: Point): AffineMatrix {
  return around(rotation(radians), pivot);
}

export function scaleAround(sx: number, sy: number, pivot: Point): AffineMatrix {
  return around(scaling(sx, sy), pivot);
}

/**
 * Uniform scale factor equivalent of the matrix's linear part. Stitch
 * generation uses this to keep density constant when a layer is scaled.
 */
export function averageScaleFactor(m: AffineMatrix): number {
  return Math.sqrt(Math.abs(determinant(m))) || 0;
}

export function scaleFactorX(m: AffineMatrix): number {
  return Math.hypot(m.a, m.b);
}

export function scaleFactorY(m: AffineMatrix): number {
  return Math.hypot(m.c, m.d);
}

/** Rotation angle (radians) of the matrix's linear part. */
export function rotationOf(m: AffineMatrix): number {
  return Math.atan2(m.b, m.a);
}

export function isIdentity(m: AffineMatrix, epsilon = 1e-9): boolean {
  return (
    Math.abs(m.a - 1) <= epsilon &&
    Math.abs(m.b) <= epsilon &&
    Math.abs(m.c) <= epsilon &&
    Math.abs(m.d - 1) <= epsilon &&
    Math.abs(m.e) <= epsilon &&
    Math.abs(m.f) <= epsilon
  );
}

export function matricesEqual(a: AffineMatrix, b: AffineMatrix, epsilon = 1e-9): boolean {
  return (
    Math.abs(a.a - b.a) <= epsilon &&
    Math.abs(a.b - b.b) <= epsilon &&
    Math.abs(a.c - b.c) <= epsilon &&
    Math.abs(a.d - b.d) <= epsilon &&
    Math.abs(a.e - b.e) <= epsilon &&
    Math.abs(a.f - b.f) <= epsilon
  );
}
