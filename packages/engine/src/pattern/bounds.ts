import { isMovementCommand, type StitchPoint } from './stitch.js';

export interface PatternBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export const EMPTY_BOUNDS: PatternBounds = Object.freeze({
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0,
  width: 0,
  height: 0,
  centerX: 0,
  centerY: 0,
});

export function makeBounds(minX: number, minY: number, maxX: number, maxY: number): PatternBounds {
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

export interface BoundsOptions {
  /**
   * Measure only sewn stitches, ignoring jump travel. Use this for "how big is
   * the embroidery" and the full extent (default) for "will the carriage stay
   * inside the hoop".
   */
  stitchesOnly?: boolean;
}

export function computeBounds(
  stitches: readonly StitchPoint[],
  options: BoundsOptions = {},
): PatternBounds {
  const stitchesOnly = options.stitchesOnly ?? false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (const stitch of stitches) {
    if (!isMovementCommand(stitch.command)) continue;
    if (stitchesOnly && stitch.command === 'JUMP') continue;
    found = true;
    if (stitch.x < minX) minX = stitch.x;
    if (stitch.y < minY) minY = stitch.y;
    if (stitch.x > maxX) maxX = stitch.x;
    if (stitch.y > maxY) maxY = stitch.y;
  }

  if (!found) return { ...EMPTY_BOUNDS };
  return makeBounds(minX, minY, maxX, maxY);
}

export function boundsUnion(a: PatternBounds, b: PatternBounds): PatternBounds {
  return makeBounds(
    Math.min(a.minX, b.minX),
    Math.min(a.minY, b.minY),
    Math.max(a.maxX, b.maxX),
    Math.max(a.maxY, b.maxY),
  );
}

export function boundsAreEmpty(bounds: PatternBounds): boolean {
  return bounds.width <= 0 && bounds.height <= 0;
}
