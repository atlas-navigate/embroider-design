import type { EmbPattern } from '../../pattern/emb-pattern.js';
import type { PatternBounds } from '../../pattern/bounds.js';

export type FormatId = 'dst' | 'pes' | 'exp' | 'jef' | 'vp3' | 'xxx';

export interface WriteOptions {
  /**
   * Place the design's bounding-box centre at the machine origin. Machines
   * position a design relative to where the carriage starts, which is the
   * hoop centre, so this is on by default — the same thing commercial
   * digitizing software does on export.
   */
  center?: boolean;
  /** Overrides the design name written into the file header. */
  name?: string;
}

export interface EmbroideryFormat {
  id: FormatId;
  name: string;
  /** Lower-case, with the leading dot. */
  extension: string;
  description: string;
  /** Whether the format stores thread colours at all. */
  storesColor: boolean;
  /** Whether the format has a real trim command (as opposed to a jump idiom). */
  hasTrimCommand: boolean;
  /** Largest single move the format can encode, in 0.1 mm units. */
  maxStitchDistance: number;
  maxJumpDistance: number;
  write(pattern: EmbPattern, options?: WriteOptions): Uint8Array;
  read(data: Uint8Array): EmbPattern;
}

/** Machine-space extents: post-origin-shift and post-Y-flip. */
export interface MachineBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export function toMachineBounds(
  bounds: PatternBounds,
  originX: number,
  originY: number,
  flipY = true,
): MachineBounds {
  const minX = Math.round(bounds.minX - originX);
  const maxX = Math.round(bounds.maxX - originX);
  const lowY = Math.round(bounds.minY - originY);
  const highY = Math.round(bounds.maxY - originY);
  const minY = flipY ? -highY : lowY;
  const maxY = flipY ? -lowY : highY;
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}
