import { distance, type Point } from '../geometry/point.js';
import { EmbPattern } from './emb-pattern.js';
import type { ThreadColor } from './thread.js';
import { mmToUnits } from './units.js';

/**
 * Small helpers shared by every stitch generator, so that "travel to the next
 * region" and "start a new colour" are decided in one place rather than
 * re-invented in each algorithm.
 */

/**
 * Jumps longer than this get a trim first. 5 mm is a reasonable middle ground:
 * short enough that trailing threads stay off the finished piece, long enough
 * that a dense fill's row-to-row travel does not trigger constant trims (which
 * slow the machine down badly and leave a tail to clip on every one).
 */
export const DEFAULT_AUTO_TRIM_UNITS = mmToUnits(5);

export interface TravelOptions {
  /** Move without sewing. Default `true`. */
  jump?: boolean;
  /** `'auto'` trims when the gap exceeds `autoTrimDistance`. Default `'auto'`. */
  trimBefore?: boolean | 'auto';
  /** Gap in units above which `'auto'` trims. Default `DEFAULT_AUTO_TRIM_UNITS`. */
  autoTrimDistance?: number;
}

/** Moves the needle to `target`, trimming and jumping as the gap warrants. */
export function travelTo(pattern: EmbPattern, target: Point, options: TravelOptions = {}): void {
  const jump = options.jump ?? true;
  const trimBefore = options.trimBefore ?? 'auto';
  const autoTrimDistance = options.autoTrimDistance ?? DEFAULT_AUTO_TRIM_UNITS;

  if (pattern.isEmpty) {
    pattern.jumpTo(target.x, target.y);
    return;
  }

  const gap = distance(pattern.lastPosition, target);
  if (gap < 1e-6) return;

  const shouldTrim = trimBefore === true || (trimBefore === 'auto' && gap > autoTrimDistance);
  if (shouldTrim) pattern.trim();
  if (jump || shouldTrim) pattern.jumpTo(target.x, target.y);
  else pattern.stitchTo(target.x, target.y);
}

export interface AppendPathOptions extends TravelOptions {
  /**
   * Sew straight to the first point instead of travelling to it. Use this when
   * the path continues from where the last one ended, e.g. successive rows of
   * a fill.
   */
  continuous?: boolean;
}

/**
 * Appends an already-resampled path as stitches. The points are taken as-is —
 * spacing is the caller's business, because only the generator knows whether
 * it is laying a running stitch, a satin rail, or a fill row.
 */
export function appendStitchPath(
  pattern: EmbPattern,
  points: readonly Point[],
  options: AppendPathOptions = {},
): void {
  if (points.length === 0) return;
  if (options.continuous && !pattern.isEmpty) {
    pattern.stitchToPoint(points[0]);
  } else {
    travelTo(pattern, points[0], options);
    pattern.stitchToPoint(points[0]);
  }
  for (let i = 1; i < points.length; i++) pattern.stitchToPoint(points[i]);
}

/**
 * Starts a new colour block and registers its thread, keeping `threads[i]`
 * aligned with block `i`.
 */
export function beginColorBlock(pattern: EmbPattern, thread: ThreadColor): void {
  if (!pattern.isEmpty) {
    pattern.trim();
    pattern.colorChange();
  }
  pattern.addThread(thread);
}

export interface FinishOptions {
  /** Run `normalize()` before terminating. Default `true`. */
  normalize?: boolean;
  /** Pad the palette so every block has a thread. Default `true`. */
  ensureThreads?: boolean;
}

/** Final pass before a pattern is handed to a writer or the preview. */
export function finishPattern(pattern: EmbPattern, options: FinishOptions = {}): EmbPattern {
  if (options.normalize ?? true) pattern.normalize();
  if (options.ensureThreads ?? true) pattern.ensureThreadCount();
  return pattern;
}
