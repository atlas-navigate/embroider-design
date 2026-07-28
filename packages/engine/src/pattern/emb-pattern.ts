import type { Point } from '../geometry/point.js';
import { applyToPoint, type AffineMatrix } from '../geometry/transform.js';
import { computeBounds, EMPTY_BOUNDS, type BoundsOptions, type PatternBounds } from './bounds.js';
import {
  isMovementCommand,
  isSewingCommand,
  StitchCommand,
  type StitchPoint,
} from './stitch.js';
import { cloneThread, defaultThreadForIndex, DEFAULT_THREAD, type ThreadColor } from './thread.js';

/**
 * `EmbPattern` is the engine's universal intermediate representation.
 *
 * Everything that *generates* stitches (shapes, lettering, auto-digitizing)
 * produces one of these, and every format writer consumes one. Nothing else
 * crosses that boundary. The single most important consequence: adding a new
 * output format never touches stitch generation, and changing a fill algorithm
 * never touches a file writer.
 *
 * Conventions, all of which are load-bearing:
 *
 * - **Absolute coordinates**, in 0.1 mm units (see `units.ts`).
 * - **Y-down**, matching the design canvas and every screen coordinate system.
 *   Machine formats are Y-up; that flip happens exactly once, in
 *   `toDeltaEncoding`, rather than being re-derived by six writers.
 * - Control commands carry the position the needle is already at, so the list
 *   is uniform for bounds, transforms, and rendering.
 * - Colour blocks are delimited by `COLOR_CHANGE`; `threads[i]` is the thread
 *   for block `i`.
 */

export interface PatternMetadata {
  name?: string;
  author?: string;
  copyright?: string;
  category?: string;
  keywords?: string;
  comments?: string;
  software?: string;
  [key: string]: string | undefined;
}

/** One relative move, ready for a binary writer to encode. Integer units. */
export interface DeltaStitch {
  dx: number;
  dy: number;
  command: StitchCommand;
}

export interface DeltaEncodeOptions {
  /** Longest single sewn move a format allows, in units. Longer moves are split. */
  maxStitchDistance?: number;
  /** Longest single jump a format allows, in units. Defaults to `maxStitchDistance`. */
  maxJumpDistance?: number;
  /** Negate Y on the way out. Machine formats are Y-up, so this defaults to `true`. */
  flipY?: boolean;
  /** Absolute pattern coordinate that maps to machine (0, 0). */
  originX?: number;
  originY?: number;
}

/**
 * Conservative default: DST's 121-unit (12.1 mm) ceiling is the tightest of
 * the formats we write, so it is safe everywhere. Each writer overrides it
 * with its own limit.
 */
export const DEFAULT_MAX_STITCH_UNITS = 121;

export interface ColorBlock {
  thread: ThreadColor;
  threadIndex: number;
  /** Index of the block's first stitch in `pattern.stitches`. */
  startIndex: number;
  /** One past the block's last stitch (the `COLOR_CHANGE`/`END` itself is excluded). */
  endIndex: number;
  stitches: StitchPoint[];
}

export interface PatternStatistics {
  stitchCount: number;
  jumpCount: number;
  trimCount: number;
  colorCount: number;
  bounds: PatternBounds;
  /** Total sewn thread length in units, jumps excluded. */
  threadLength: number;
  /** Sewn length per colour block, in `getColorBlocks()` order. */
  threadLengthByBlock: number[];
  /** Longest single sewn stitch, in units — the usual thread-break culprit. */
  longestStitch: number;
  /** Sewn stitches shorter than 1 unit (0.1 mm); these cause needle deflection. */
  tinyStitchCount: number;
}

export interface NormalizeOptions {
  /** Drop stitches that repeat the previous position. Default `true`. */
  removeDuplicateStitches?: boolean;
  /** Collapse runs of jumps into one jump to the final position. Default `true`. */
  mergeConsecutiveJumps?: boolean;
  /** Drop trims/colour changes that would bracket an empty block. Default `true`. */
  removeEmptyBlocks?: boolean;
  /** Truncate at the first `END` and guarantee a trailing one. Default `true`. */
  terminate?: boolean;
  /** "Same position" tolerance in units. Default `0.5` (half a machine step). */
  epsilon?: number;
}

export interface EmbPatternInit {
  stitches?: readonly StitchPoint[];
  threads?: readonly ThreadColor[];
  metadata?: PatternMetadata;
}

export class EmbPattern {
  /** Mutable contents; the array reference itself never changes. */
  readonly stitches: StitchPoint[] = [];
  readonly threads: ThreadColor[] = [];
  metadata: PatternMetadata = {};

  constructor(init: EmbPatternInit = {}) {
    if (init.stitches) for (const s of init.stitches) this.stitches.push({ ...s });
    if (init.threads) for (const t of init.threads) this.threads.push(cloneThread(t));
    if (init.metadata) this.metadata = { ...init.metadata };
  }

  static fromStitches(
    stitches: readonly StitchPoint[],
    threads: readonly ThreadColor[] = [],
    metadata: PatternMetadata = {},
  ): EmbPattern {
    return new EmbPattern({ stitches, threads, metadata });
  }

  get length(): number {
    return this.stitches.length;
  }

  get isEmpty(): boolean {
    return this.stitches.length === 0;
  }

  /** Where the needle currently is. `(0, 0)` for an empty pattern. */
  get lastPosition(): Point {
    const last = this.stitches[this.stitches.length - 1];
    return last ? { x: last.x, y: last.y } : { x: 0, y: 0 };
  }

  // ---------------------------------------------------------------- building

  addStitchAbsolute(x: number, y: number, command: StitchCommand = StitchCommand.STITCH): this {
    this.stitches.push({ x, y, command });
    return this;
  }

  addStitchRelative(dx: number, dy: number, command: StitchCommand = StitchCommand.STITCH): this {
    const { x, y } = this.lastPosition;
    return this.addStitchAbsolute(x + dx, y + dy, command);
  }

  addStitchPoint(stitch: StitchPoint): this {
    this.stitches.push({ ...stitch });
    return this;
  }

  stitchTo(x: number, y: number): this {
    return this.addStitchAbsolute(x, y, StitchCommand.STITCH);
  }

  stitchToPoint(p: Point): this {
    return this.addStitchAbsolute(p.x, p.y, StitchCommand.STITCH);
  }

  jumpTo(x: number, y: number): this {
    return this.addStitchAbsolute(x, y, StitchCommand.JUMP);
  }

  jumpToPoint(p: Point): this {
    return this.addStitchAbsolute(p.x, p.y, StitchCommand.JUMP);
  }

  sequinAt(x: number, y: number): this {
    return this.addStitchAbsolute(x, y, StitchCommand.SEQUIN);
  }

  /** Appends a control command at the current needle position. */
  private addControl(command: StitchCommand): this {
    const { x, y } = this.lastPosition;
    return this.addStitchAbsolute(x, y, command);
  }

  trim(): this {
    return this.addControl(StitchCommand.TRIM);
  }

  stop(): this {
    return this.addControl(StitchCommand.STOP);
  }

  colorChange(): this {
    return this.addControl(StitchCommand.COLOR_CHANGE);
  }

  end(): this {
    return this.addControl(StitchCommand.END);
  }

  /** Appends a run of points with the same command. */
  addPoints(points: readonly Point[], command: StitchCommand = StitchCommand.STITCH): this {
    for (const p of points) this.stitches.push({ x: p.x, y: p.y, command });
    return this;
  }

  addThread(color: ThreadColor): this {
    this.threads.push(cloneThread(color));
    return this;
  }

  addThreads(colors: readonly ThreadColor[]): this {
    for (const c of colors) this.addThread(c);
    return this;
  }

  get threadCount(): number {
    return this.threads.length;
  }

  /**
   * Thread for colour block `index`. Wraps around a short palette (the same
   * behaviour real machines have when a design asks for more colour changes
   * than the file declares) and falls back to black for an empty palette.
   */
  getThread(index: number): ThreadColor {
    if (this.threads.length === 0) return cloneThread(DEFAULT_THREAD);
    const i = ((index % this.threads.length) + this.threads.length) % this.threads.length;
    return this.threads[i];
  }

  /** Pads the palette with distinguishable defaults so every block has a colour. */
  ensureThreadCount(count = this.getColorBlockCount()): this {
    while (this.threads.length < count) {
      this.threads.push(defaultThreadForIndex(this.threads.length));
    }
    return this;
  }

  // ----------------------------------------------------------------- queries

  getBounds(options: BoundsOptions = {}): PatternBounds {
    if (this.stitches.length === 0) return { ...EMPTY_BOUNDS };
    return computeBounds(this.stitches, options);
  }

  countCommand(command: StitchCommand): number {
    let count = 0;
    for (const s of this.stitches) if (s.command === command) count++;
    return count;
  }

  getStitchCount(): number {
    return this.countCommand(StitchCommand.STITCH);
  }

  getJumpCount(): number {
    return this.countCommand(StitchCommand.JUMP);
  }

  getTrimCount(): number {
    return this.countCommand(StitchCommand.TRIM);
  }

  getColorChangeCount(): number {
    return this.countCommand(StitchCommand.COLOR_CHANGE);
  }

  /** Number of colour blocks: one more than the colour changes, unless empty. */
  getColorBlockCount(): number {
    if (this.stitches.length === 0) return 0;
    return this.getColorChangeCount() + 1;
  }

  /**
   * Splits the stitch list at every `COLOR_CHANGE`. Writers that need
   * per-colour sections (PEC, JEF, VP3) and the preview renderer both work
   * from this rather than re-deriving block boundaries.
   */
  getColorBlocks(): ColorBlock[] {
    const blocks: ColorBlock[] = [];
    if (this.stitches.length === 0) return blocks;

    let startIndex = 0;
    let threadIndex = 0;
    for (let i = 0; i < this.stitches.length; i++) {
      const command = this.stitches[i].command;
      if (command !== StitchCommand.COLOR_CHANGE && command !== StitchCommand.END) continue;
      blocks.push({
        thread: this.getThread(threadIndex),
        threadIndex,
        startIndex,
        endIndex: i,
        stitches: this.stitches.slice(startIndex, i),
      });
      startIndex = i + 1;
      if (command === StitchCommand.END) return blocks;
      threadIndex++;
    }

    if (startIndex < this.stitches.length) {
      blocks.push({
        thread: this.getThread(threadIndex),
        threadIndex,
        startIndex,
        endIndex: this.stitches.length,
        stitches: this.stitches.slice(startIndex),
      });
    }
    return blocks;
  }

  getStatistics(): PatternStatistics {
    const blocks = this.getColorBlocks();
    const threadLengthByBlock: number[] = [];
    let threadLength = 0;
    let longestStitch = 0;
    let tinyStitchCount = 0;

    for (const block of blocks) {
      let blockLength = 0;
      let previous: StitchPoint | null = null;
      for (const stitch of block.stitches) {
        if (isSewingCommand(stitch.command) && previous && isMovementCommand(previous.command)) {
          const d = Math.hypot(stitch.x - previous.x, stitch.y - previous.y);
          blockLength += d;
          if (d > longestStitch) longestStitch = d;
          if (d < 1) tinyStitchCount++;
        }
        if (isMovementCommand(stitch.command)) previous = stitch;
      }
      threadLengthByBlock.push(blockLength);
      threadLength += blockLength;
    }

    return {
      stitchCount: this.getStitchCount(),
      jumpCount: this.getJumpCount(),
      trimCount: this.getTrimCount(),
      colorCount: blocks.length,
      bounds: this.getBounds(),
      threadLength,
      threadLengthByBlock,
      longestStitch,
      tinyStitchCount,
    };
  }

  // ---------------------------------------------------------------- mutation

  translate(dx: number, dy: number): this {
    for (const stitch of this.stitches) {
      stitch.x += dx;
      stitch.y += dy;
    }
    return this;
  }

  scale(sx: number, sy: number = sx): this {
    for (const stitch of this.stitches) {
      stitch.x *= sx;
      stitch.y *= sy;
    }
    return this;
  }

  /**
   * Applies an affine transform in place. Note this moves stitch *positions*
   * but cannot change stitch *density* — scaling a pattern up stretches its
   * stitches. Scale the design and recompile instead wherever that matters.
   */
  transform(matrix: AffineMatrix): this {
    for (const stitch of this.stitches) {
      const p = applyToPoint(matrix, stitch);
      stitch.x = p.x;
      stitch.y = p.y;
    }
    return this;
  }

  /** Recentres the pattern so its bounding box is centred on (0, 0). */
  centerInPlace(): this {
    const bounds = this.getBounds();
    return this.translate(-bounds.centerX, -bounds.centerY);
  }

  /** Moves the pattern so its bounding box starts at (0, 0). */
  moveToOrigin(): this {
    const bounds = this.getBounds();
    return this.translate(-bounds.minX, -bounds.minY);
  }

  /**
   * Appends another pattern's stitches and threads, inserting the colour
   * change between them. This is how `compile.ts` concatenates layers.
   */
  appendPattern(other: EmbPattern, offsetX = 0, offsetY = 0, colorChange = true): this {
    if (other.stitches.length === 0) return this;
    if (colorChange && this.stitches.length > 0) this.colorChange();
    for (const stitch of other.stitches) {
      if (stitch.command === StitchCommand.END) continue;
      this.stitches.push({
        x: stitch.x + offsetX,
        y: stitch.y + offsetY,
        command: stitch.command,
      });
    }
    for (const t of other.threads) this.threads.push(cloneThread(t));
    return this;
  }

  clone(): EmbPattern {
    return new EmbPattern({
      stitches: this.stitches,
      threads: this.threads,
      metadata: this.metadata,
    });
  }

  /**
   * Cleans up the artefacts stitch generation naturally produces — duplicate
   * points where two shapes meet, jump chains from travelling between regions,
   * colour changes around a layer that generated nothing.
   *
   * Not automatic: generation code should be able to emit freely and clean up
   * once, at the end, rather than every helper defending itself.
   *
   * Dropping a colour change also drops that block's thread, so
   * `threads[i]` keeps pointing at block `i`. Losing that alignment would
   * silently export a design in the wrong colours.
   */
  normalize(options: NormalizeOptions = {}): this {
    const removeDuplicateStitches = options.removeDuplicateStitches ?? true;
    const mergeConsecutiveJumps = options.mergeConsecutiveJumps ?? true;
    const removeEmptyBlocks = options.removeEmptyBlocks ?? true;
    const terminate = options.terminate ?? true;
    const epsilon = options.epsilon ?? 0.5;

    const out: StitchPoint[] = [];
    const droppedThreadIndices: number[] = [];
    let sourceBlockIndex = 0;
    let lastX = Number.NaN;
    let lastY = Number.NaN;
    let sewnInBlock = 0;
    /**
     * Whether the last record kept was a needle-down stitch.
     *
     * A stitch is only redundant against another *stitch*. The one that lands
     * on a jump's destination looks like a repeat of the same coordinates, but
     * it is the anchor that ties the thread down where the run starts — drop it
     * and every region begins one stitch in, with nothing holding the first
     * point. PEC re-inserts exactly this stitch on export, which is the
     * clearest sign it belongs in the pattern rather than in one writer.
     */
    let lastWasSewn = false;

    for (const stitch of this.stitches) {
      if (stitch.command === StitchCommand.END) break;

      switch (stitch.command) {
        case StitchCommand.STITCH:
        case StitchCommand.SEQUIN: {
          const isDuplicate =
            removeDuplicateStitches &&
            stitch.command === StitchCommand.STITCH &&
            lastWasSewn &&
            Math.abs(stitch.x - lastX) < epsilon &&
            Math.abs(stitch.y - lastY) < epsilon;
          if (isDuplicate) break;
          out.push({ ...stitch });
          lastX = stitch.x;
          lastY = stitch.y;
          lastWasSewn = true;
          sewnInBlock++;
          break;
        }
        case StitchCommand.JUMP: {
          const previous = out[out.length - 1];
          if (mergeConsecutiveJumps && previous && previous.command === StitchCommand.JUMP) {
            previous.x = stitch.x;
            previous.y = stitch.y;
          } else {
            out.push({ ...stitch });
          }
          lastX = stitch.x;
          lastY = stitch.y;
          lastWasSewn = false;
          break;
        }
        case StitchCommand.TRIM: {
          const previous = out[out.length - 1];
          const wouldBeRedundant =
            !previous ||
            previous.command === StitchCommand.TRIM ||
            previous.command === StitchCommand.COLOR_CHANGE;
          if (removeEmptyBlocks && wouldBeRedundant) break;
          out.push({ ...stitch });
          lastWasSewn = false;
          break;
        }
        case StitchCommand.COLOR_CHANGE: {
          if (removeEmptyBlocks && sewnInBlock === 0) {
            droppedThreadIndices.push(sourceBlockIndex);
          } else {
            out.push({ ...stitch });
          }
          sewnInBlock = 0;
          sourceBlockIndex++;
          lastWasSewn = false;
          break;
        }
        default:
          out.push({ ...stitch });
          break;
      }
    }

    // Anything trailing after the last sewn stitch is travel that sews nothing.
    let poppedColorChanges = 0;
    while (out.length > 0) {
      const command = out[out.length - 1].command;
      if (command === StitchCommand.COLOR_CHANGE) {
        poppedColorChanges++;
      } else if (command !== StitchCommand.JUMP && command !== StitchCommand.TRIM) {
        break;
      }
      out.pop();
    }

    if (terminate && out.length > 0) {
      const last = out[out.length - 1];
      out.push({ x: last.x, y: last.y, command: StitchCommand.END });
    }

    this.stitches.length = 0;
    for (const stitch of out) this.stitches.push(stitch);

    if (removeEmptyBlocks && this.threads.length > 0) {
      if (out.length === 0) {
        this.threads.length = 0;
      } else {
        const dropped = new Set(droppedThreadIndices);
        const kept = this.threads.filter((_, index) => !dropped.has(index));
        // Each popped trailing colour change opened a block that sewed nothing.
        kept.length = Math.max(0, kept.length - poppedColorChanges);
        this.threads.length = 0;
        for (const t of kept) this.threads.push(t);
      }
    }
    return this;
  }

  // ---------------------------------------------------------------- encoding

  /** See the module-level `toDeltaEncoding` for the full contract. */
  toDeltaEncoding(options: DeltaEncodeOptions = {}): DeltaStitch[] {
    return toDeltaEncoding(this.stitches, options);
  }
}

/**
 * Converts absolute Y-down stitches into the relative, integer, Y-up moves
 * every binary format stores. Doing this once, here, is what lets six writers
 * differ only in how they pack bytes.
 *
 * Two details matter and are easy to get wrong:
 *
 * 1. **Rounding is applied to absolute positions, not to deltas.** Rounding
 *    each delta independently accumulates error and a long fill visibly drifts
 *    off its outline. Tracking an integer machine position and diffing against
 *    it keeps every stitch within half a unit of where it belongs, forever.
 * 2. **Long moves are split iteratively, not by precomputed division.** Each
 *    step is clamped to the format's limit and the remainder is recomputed
 *    from the true target, so the final position is exact regardless of how
 *    the intermediate rounding fell.
 */
export function toDeltaEncoding(
  stitches: readonly StitchPoint[],
  options: DeltaEncodeOptions = {},
): DeltaStitch[] {
  const maxStitch = Math.floor(options.maxStitchDistance ?? DEFAULT_MAX_STITCH_UNITS);
  const maxJump = Math.floor(options.maxJumpDistance ?? maxStitch);
  if (maxStitch < 2 || maxJump < 2) {
    throw new Error('toDeltaEncoding: max distances must be at least 2 units');
  }
  const flipY = options.flipY ?? true;
  const originX = options.originX ?? 0;
  const originY = options.originY ?? 0;

  const out: DeltaStitch[] = [];
  let currentX = 0;
  let currentY = 0;

  for (const stitch of stitches) {
    if (!isMovementCommand(stitch.command)) {
      // Control commands never move; the following move re-derives its delta
      // from the absolute target, so nothing is lost by emitting zero here.
      out.push({ dx: 0, dy: 0, command: stitch.command });
      continue;
    }

    // `+ 0` normalises the negative zero `Math.round` produces for -0.0, which
    // would otherwise leak into encoded output and test comparisons.
    const targetX = Math.round(stitch.x - originX) + 0;
    const rawY = stitch.y - originY;
    const targetY = Math.round(flipY ? -rawY : rawY) + 0;
    const limit = stitch.command === StitchCommand.JUMP ? maxJump : maxStitch;

    for (;;) {
      const dx = targetX - currentX;
      const dy = targetY - currentY;
      if (Math.abs(dx) <= limit && Math.abs(dy) <= limit) {
        out.push({ dx, dy, command: stitch.command });
        currentX = targetX;
        currentY = targetY;
        break;
      }
      const ratio = limit / Math.max(Math.abs(dx), Math.abs(dy));
      let stepX = Math.round(dx * ratio);
      let stepY = Math.round(dy * ratio);
      // Rounding can nudge a step one unit past the limit.
      if (stepX > limit) stepX = limit;
      else if (stepX < -limit) stepX = -limit;
      if (stepY > limit) stepY = limit;
      else if (stepY < -limit) stepY = -limit;
      if (stepX === 0 && stepY === 0) {
        // Unreachable for limit >= 1, but a zero step would loop forever.
        stepX = Math.sign(dx) * Math.min(limit, Math.abs(dx));
        stepY = Math.sign(dy) * Math.min(limit, Math.abs(dy));
        if (stepX === 0 && stepY === 0) break;
      }
      out.push({ dx: stepX, dy: stepY, command: stitch.command });
      currentX += stepX;
      currentY += stepY;
    }
  }

  return out;
}

/**
 * Rebuilds absolute Y-down stitches from a delta stream. Format *readers* use
 * this, and the round-trip tests lean on it: write a pattern, read the bytes
 * back, and the positions must match to within the 0.1 mm machine grid.
 */
export function fromDeltaEncoding(
  deltas: readonly DeltaStitch[],
  options: Pick<DeltaEncodeOptions, 'flipY' | 'originX' | 'originY'> = {},
): StitchPoint[] {
  const flipY = options.flipY ?? true;
  const originX = options.originX ?? 0;
  const originY = options.originY ?? 0;

  const out: StitchPoint[] = [];
  let x = 0;
  let y = 0;
  for (const delta of deltas) {
    x += delta.dx;
    y += delta.dy;
    const worldY = flipY ? -y : y;
    out.push({ x: x + originX, y: worldY + originY, command: delta.command });
  }
  return out;
}
