import type { PatternBounds } from '../../pattern/bounds.js';
import { toDeltaEncoding, type EmbPattern } from '../../pattern/emb-pattern.js';
import { StitchCommand, type StitchPoint } from '../../pattern/stitch.js';
import { threadToInt, type ThreadColor } from '../../pattern/thread.js';
import { ByteWriter } from '../common/byte-writer.js';
import type { WriteOptions } from '../common/format-types.js';
import { buildUniquePalette } from '../common/palette-match.js';
import { preparePattern } from '../common/prepare.js';
import { BROTHER_PEC_THREADS } from '../common/thread-charts.js';
import {
  blankIcon,
  drawScaledIcon,
  PEC_ICON_HEIGHT,
  PEC_ICON_STRIDE,
} from './pec-graphics.js';

/**
 * The PEC block — the part a Brother PE-series machine (including the PE900)
 * actually executes.
 *
 * A PES file is a container; the machine seeks to the embedded PEC block and
 * ignores everything else. So this is the file that has to be right.
 *
 * Layout: a 512-byte header (name, thumbnail geometry, and one *chart index*
 * per colour block), then a stitch block, then the monochrome thumbnails.
 *
 * Coordinates are **Y-down**, unlike DST/EXP/JEF/XXX. That is not a mistake —
 * PEC genuinely stores screen-orientation coordinates, which is why converting
 * a DST to a PES requires a vertical flip.
 */

/**
 * The encoding reaches ±2047, but a 20 cm stitch is not a stitch. Splitting at
 * 12.7 mm keeps every sewn move within what a domestic machine can actually
 * pull without shredding thread; jumps are pure travel, so they keep the full
 * range and stay a single record.
 */
export const PEC_MAX_STITCH = 127;
export const PEC_MAX_JUMP = 2047;
export const PEC_HEADER_SIZE = 512;

const MASK_7_BIT = 0x7f;
const JUMP_CODE = 0x10;
const TRIM_CODE = 0x20;
const FLAG_LONG = 0x80;

export interface PecColorInfo {
  /** The `count - 1` prefix byte followed by one chart index per colour block. */
  colorIndexList: number[];
  /** `0xRRGGBB` per block, in order. Consumed by the PES v6 addendum. */
  rgbList: number[];
}

/**
 * Writes one coordinate. Values in (-64, 63) fit a single 7-bit byte; anything
 * else, or anything carrying a jump/trim flag, needs the two-byte form: bit 15
 * marks it long, bits 12-13 carry the flag, and the low 12 bits hold the
 * signed value.
 */
function writePecValue(out: ByteWriter, value: number, long: boolean, flag = 0): void {
  if (!long && value > -64 && value < 63) {
    out.writeUint8(value & MASK_7_BIT);
    return;
  }
  const encoded = (value & 0x0fff) | 0x8000 | (flag << 8);
  out.writeUint8((encoded >> 8) & 0xff);
  out.writeUint8(encoded & 0xff);
}

function writePecStitch(out: ByteWriter, dx: number, dy: number): void {
  writePecValue(out, dx, false);
  writePecValue(out, dy, false);
}

function writePecMove(out: ByteWriter, dx: number, dy: number, flag: number): void {
  writePecValue(out, dx, true, flag);
  writePecValue(out, dy, true, flag);
}

/**
 * Encodes the stitch stream.
 *
 * Unlike pyembroidery — which flags every jump after the first as a trim —
 * this uses `JUMP_CODE` for plain travel and `TRIM_CODE` only where the
 * pattern actually asked for a trim. Both codes exist in the format for
 * exactly this distinction, and our IR carries it, so throwing it away would
 * make the machine cut and re-thread on every internal jump.
 */
function encodePecStitches(
  out: ByteWriter,
  pattern: EmbPattern,
  originX: number,
  originY: number,
): void {
  const deltas = toDeltaEncoding(pattern.stitches, {
    maxStitchDistance: PEC_MAX_STITCH,
    maxJumpDistance: PEC_MAX_JUMP,
    flipY: false,
    originX,
    originY,
  });

  let colorTwo = true;
  let jumping = true;
  let pendingTrim = false;

  for (const delta of deltas) {
    switch (delta.command) {
      case StitchCommand.STITCH:
      case StitchCommand.SEQUIN:
        if (jumping) {
          // PEC wants a landing stitch before sewing resumes after travel.
          if (delta.dx !== 0 && delta.dy !== 0) writePecStitch(out, 0, 0);
          jumping = false;
        }
        writePecStitch(out, delta.dx, delta.dy);
        break;

      case StitchCommand.JUMP:
        jumping = true;
        writePecMove(out, delta.dx, delta.dy, pendingTrim ? TRIM_CODE : JUMP_CODE);
        pendingTrim = false;
        break;

      case StitchCommand.TRIM:
        // PEC has no standalone trim; it rides on the next travel move.
        pendingTrim = true;
        break;

      case StitchCommand.COLOR_CHANGE:
        if (jumping) {
          writePecStitch(out, 0, 0);
          jumping = false;
        }
        out.writeBytes([0xfe, 0xb0, colorTwo ? 0x02 : 0x01]);
        colorTwo = !colorTwo;
        pendingTrim = false;
        break;

      case StitchCommand.STOP:
        break;

      case StitchCommand.END:
        out.writeUint8(0xff);
        return;
    }
  }
  out.writeUint8(0xff);
}

function sewnPoints(stitches: readonly StitchPoint[]): StitchPoint[] {
  return stitches.filter((stitch) => stitch.command === StitchCommand.STITCH);
}

/**
 * Appends a complete PEC section to `out`. Offsets inside the section are
 * absolute file offsets, so this works identically standalone and embedded in
 * a PES container.
 */
export function writePecSection(
  out: ByteWriter,
  pattern: EmbPattern,
  originX: number,
  originY: number,
  bounds: PatternBounds,
): PecColorInfo {
  const blocks = pattern.getColorBlocks();
  const threads: ThreadColor[] = blocks.map((block) => block.thread);
  const colorCount = threads.length;

  const headerStart = out.length;
  const name = (pattern.metadata.name ?? 'Untitled').slice(0, 8);
  out.writeString(`LA:${name.padEnd(16, ' ')}\r`);
  out.fill(0x20, 12);
  out.writeBytes([0xff, 0x00]);
  out.writeUint8(PEC_ICON_STRIDE);
  out.writeUint8(PEC_ICON_HEIGHT);

  const colorIndexList: number[] = [];
  if (colorCount > 0) {
    out.fill(0x20, 12);
    const palette = buildUniquePalette(BROTHER_PEC_THREADS, threads);
    if (colorCount - 1 > 254) {
      throw new Error(`PEC: ${colorCount} colour blocks exceeds the 255-block limit`);
    }
    colorIndexList.push(colorCount - 1, ...palette);
    out.writeBytes(colorIndexList);
  } else {
    // The no-colour form the format defines; keeps the header exactly 512 bytes.
    out.writeBytes([0x20, 0x20, 0x20, 0x20, 0x64, 0x20, 0x00, 0x20, 0x00, 0x20, 0x20, 0x20, 0xff]);
  }
  out.fill(0x20, PEC_HEADER_SIZE - (out.length - headerStart));
  if (out.length - headerStart !== PEC_HEADER_SIZE) {
    throw new Error(
      `PEC: header came out ${out.length - headerStart} bytes, expected ${PEC_HEADER_SIZE}`,
    );
  }

  // --- stitch block
  const stitchBlockStart = out.length;
  out.writeBytes([0x00, 0x00]);
  const lengthField = out.length;
  out.writeUint24LE(0);
  out.writeBytes([0x31, 0xff, 0xf0]);
  out.writeUint16LE(Math.round(bounds.width));
  out.writeUint16LE(Math.round(bounds.height));
  out.writeUint16LE(0x01e0);
  out.writeUint16LE(0x01b0);
  encodePecStitches(out, pattern, originX, originY);
  out.patchUint24LE(lengthField, out.length - stitchBlockStart);

  // --- thumbnails: one for the whole design, then one per colour block
  const combined = blankIcon();
  drawScaledIcon(combined, bounds, sewnPoints(pattern.stitches), 4);
  out.writeBytes(combined);

  for (const block of blocks) {
    const icon = blankIcon();
    drawScaledIcon(icon, bounds, sewnPoints(block.stitches), 5);
    out.writeBytes(icon);
  }

  return { colorIndexList, rgbList: threads.map(threadToInt) };
}

/** Writes a standalone `#PEC0001` file. PES is the usual container; this is for completeness. */
export function writePec(pattern: EmbPattern, options: WriteOptions = {}): Uint8Array {
  const { pattern: prepared, originX, originY, bounds } = preparePattern(pattern, options);
  const out = new ByteWriter(prepared.stitches.length * 3 + 4096);
  out.writeString('#PEC0001');
  writePecSection(out, prepared, originX, originY, bounds);
  return out.toUint8Array();
}

export { FLAG_LONG, JUMP_CODE, MASK_7_BIT, TRIM_CODE };
