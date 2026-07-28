import type { PatternBounds } from '../../pattern/bounds.js';
import { EmbPattern } from '../../pattern/emb-pattern.js';
import type { WriteOptions } from './format-types.js';

export interface PreparedPattern {
  /** A normalised, terminated copy. The caller's pattern is never mutated. */
  pattern: EmbPattern;
  /** Absolute pattern coordinate that maps to machine (0, 0). */
  originX: number;
  originY: number;
  /** Bounds of the prepared pattern, still in absolute pattern coordinates. */
  bounds: PatternBounds;
}

/**
 * The first thing every writer does.
 *
 * Writers are entitled to assume a clean pattern — no duplicate stitches, no
 * dangling colour changes, exactly one terminating `END`, one thread per
 * block. Rather than making each writer defend itself (or making callers
 * remember), the guarantee is established once here, on a copy.
 */
export function preparePattern(pattern: EmbPattern, options: WriteOptions = {}): PreparedPattern {
  const prepared = pattern.clone();
  prepared.normalize();
  prepared.ensureThreadCount();
  if (options.name !== undefined) prepared.metadata.name = options.name;

  const bounds = prepared.getBounds();
  const center = options.center ?? true;
  return {
    pattern: prepared,
    originX: center ? bounds.centerX : 0,
    originY: center ? bounds.centerY : 0,
    bounds,
  };
}
