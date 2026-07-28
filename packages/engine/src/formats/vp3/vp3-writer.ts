import type { PatternBounds } from '../../pattern/bounds.js';
import { toDeltaEncoding, type EmbPattern } from '../../pattern/emb-pattern.js';
import { StitchCommand } from '../../pattern/stitch.js';
import { threadToHex, threadToInt, type ThreadColor } from '../../pattern/thread.js';
import { ByteWriter } from '../common/byte-writer.js';
import type { WriteOptions } from '../common/format-types.js';
import { preparePattern } from '../common/prepare.js';

/**
 * Pfaff / Husqvarna Viking VP3.
 *
 * Big-endian throughout, and structured as nested length-prefixed blocks
 * (file -> design -> colour block -> stitch block), each with a back-patched
 * "bytes remaining after this field" count.
 *
 * Two things about VP3 catch people out:
 *
 * - **There is no jump command.** Travel is expressed as an ordinary long
 *   stitch; a trim beforehand is what makes it travel rather than sew. Our
 *   jumps are therefore folded into the following stitch's delta.
 * - **Mixed scales.** Header geometry is in 1/1000 mm (our units x 100) while
 *   stitch deltas stay in 1/10 mm. This is the format, not a conversion bug.
 */

/**
 * VP3 deliberately does **not** pre-split long moves, unlike every other
 * writer here.
 *
 * Because the format has no jump, travel arrives as one long stitch. Splitting
 * at a sewable length would turn a single travel move into a row of real
 * needle penetrations — and worse, it compounds: export, re-import, re-export
 * and the stitch count climbs every time, because the jump that justified the
 * long move no longer exists. The long form encodes ±32767 natively, which
 * comfortably covers any hoop, so nothing is split and the round trip is
 * stable.
 */
export const VP3_MAX_STITCH = 32000;
export const VP3_MAX_JUMP = 32000;

const VP3_PRODUCER = 'Produced by     Software Ltd';

function writeString8(out: ByteWriter, text: string): void {
  out.writeUint16BE(text.length);
  out.writeString(text);
}

function writeString16(out: ByteWriter, text: string): void {
  out.writeUint16BE(text.length * 2);
  out.writeUtf16BEString(text);
}

/**
 * Reserves a 32-bit "distance to the end of this block" field. The returned
 * closure patches it with everything written after the field itself.
 */
function reserveBlockLength(out: ByteWriter): () => void {
  const field = out.length;
  out.writeUint32BE(0);
  return () => out.patchUint32BE(field, out.length - field - 4);
}

function writeThread(out: ByteWriter, color: ThreadColor): void {
  out.writeBytes([0x01, 0x00]); // One colour, no gradient transition.
  out.writeUint24BE(threadToInt(color));
  out.writeBytes([0x00, 0x00, 0x00, 0x05, 0x28]); // No parts, no length, rayon 40wt.
  writeString8(out, color.catalogNumber ?? '');
  writeString8(out, color.description ?? threadToHex(color));
  writeString8(out, color.brand ?? '');
}

interface Vp3Block {
  thread: ThreadColor;
  /** Absolute pattern coordinates, already origin-shifted. */
  stitches: { x: number; y: number; command: StitchCommand }[];
}

function writeStitchBlock(out: ByteWriter, block: Vp3Block, startX: number, startY: number): void {
  out.writeBytes([0x00, 0x01, 0x00]);
  const patch = reserveBlockLength(out);
  out.writeBytes([0x0a, 0xf6, 0x00]);

  let lastX = startX;
  let lastY = startY;
  for (const stitch of block.stitches) {
    if (stitch.command === StitchCommand.TRIM) {
      out.writeBytes([0x80, 0x03]);
      continue;
    }
    if (stitch.command !== StitchCommand.STITCH && stitch.command !== StitchCommand.SEQUIN) {
      // Jumps and stops carry no VP3 record; the gap lands in the next delta.
      continue;
    }
    const dx = Math.round(stitch.x - lastX);
    const dy = Math.round(stitch.y - lastY);
    lastX += dx;
    lastY += dy;
    if (dx >= -127 && dx <= 127 && dy >= -127 && dy <= 127) {
      out.writeInt8(dx).writeInt8(dy);
    } else {
      out.writeBytes([0x80, 0x01]);
      out.writeUint16BE(dx & 0xffff);
      out.writeUint16BE(dy & 0xffff);
      out.writeBytes([0x80, 0x02]);
    }
  }
  out.writeBytes([0x80, 0x03]); // Final trim: VP3 machines do not auto-trim.
  patch();
}

function writeColorBlock(
  out: ByteWriter,
  block: Vp3Block,
  first: boolean,
  centerX: number,
  centerY: number,
): void {
  out.writeBytes([0x00, 0x05, 0x00]);
  const patch = reserveBlockLength(out);

  const sewn = block.stitches;
  const firstStitch = sewn[0];
  const lastStitch = sewn[sewn.length - 1];
  // The first block starts where the machine already is, at the origin.
  const startX = first || !firstStitch ? 0 : firstStitch.x;
  const startY = first || !firstStitch ? 0 : firstStitch.y;
  const endX = lastStitch ? lastStitch.x : 0;
  const endY = lastStitch ? lastStitch.y : 0;

  out.writeInt32BE(Math.trunc(startX - centerX) * 100);
  out.writeInt32BE(Math.trunc(-(startY - centerY)) * 100);

  writeThread(out, block.thread);

  out.writeInt32BE(Math.trunc(endX - startX) * 100);
  out.writeInt32BE(Math.trunc(-(endY - startY)) * 100);

  writeStitchBlock(out, block, startX, startY);
  out.writeUint8(0);
  patch();
}

function writeDesignBlock(
  out: ByteWriter,
  blocks: Vp3Block[],
  bounds: PatternBounds,
  originX: number,
  originY: number,
): void {
  out.writeBytes([0x00, 0x03, 0x00]);
  const patch = reserveBlockLength(out);

  const width = Math.round(bounds.width);
  const height = Math.round(bounds.height);
  const halfWidth = Math.trunc(width / 2);
  const halfHeight = Math.trunc(height / 2);
  const centerX = bounds.centerX - originX;
  const centerY = bounds.centerY - originY;

  out.writeInt32BE(Math.trunc(centerX) * 100);
  out.writeInt32BE(Math.trunc(-centerY) * 100);
  out.writeBytes([0x00, 0x00, 0x00]);

  out.writeInt32BE(-halfWidth * 100);
  out.writeInt32BE(halfWidth * 100);
  out.writeInt32BE(-halfHeight * 100);
  out.writeInt32BE(halfHeight * 100);
  out.writeInt32BE(width * 100);
  out.writeInt32BE(height * 100);

  writeString16(out, ''); // Per-design notes.
  out.writeBytes([0x64, 0x64]);
  out.writeUint32BE(4096);
  out.writeUint32BE(0);
  out.writeUint32BE(0);
  out.writeUint32BE(4096);
  out.writeString('xxPP');
  out.writeBytes([0x01, 0x00]);
  writeString16(out, VP3_PRODUCER);

  out.writeUint16BE(blocks.length);
  for (let i = 0; i < blocks.length; i++) {
    writeColorBlock(out, blocks[i], i === 0, centerX, centerY);
  }
  patch();
}

export function writeVp3(pattern: EmbPattern, options: WriteOptions = {}): Uint8Array {
  const { pattern: prepared, originX, originY, bounds } = preparePattern(pattern, options);

  // Re-express the pattern relative to the machine origin. VP3 stitch deltas
  // are Y-down like our patterns, so no flip here — only the header geometry
  // below is Y-up, which is where the explicit negations come from.
  const deltas = toDeltaEncoding(prepared.stitches, {
    maxStitchDistance: VP3_MAX_STITCH,
    maxJumpDistance: VP3_MAX_JUMP,
    flipY: false,
    originX,
    originY,
  });

  const blocks: Vp3Block[] = [];
  let current: Vp3Block = { thread: prepared.getThread(0), stitches: [] };
  let threadIndex = 0;
  let x = 0;
  let y = 0;
  let sewnCount = 0;

  for (const delta of deltas) {
    x += delta.dx;
    y += delta.dy;
    if (delta.command === StitchCommand.COLOR_CHANGE) {
      blocks.push(current);
      threadIndex++;
      current = { thread: prepared.getThread(threadIndex), stitches: [] };
      continue;
    }
    if (delta.command === StitchCommand.END) break;
    if (delta.command === StitchCommand.STOP) continue;
    if (delta.command === StitchCommand.STITCH || delta.command === StitchCommand.SEQUIN) {
      sewnCount++;
    }
    current.stitches.push({ x, y, command: delta.command });
  }
  blocks.push(current);

  const out = new ByteWriter(deltas.length * 3 + 4096);
  out.writeString('%vsm%');
  out.writeUint8(0);
  writeString16(out, VP3_PRODUCER);

  out.writeBytes([0x00, 0x02, 0x00]);
  const patchFile = reserveBlockLength(out);
  writeString16(out, ''); // Global notes and settings.

  const machineMinX = Math.round(bounds.minX - originX);
  const machineMaxX = Math.round(bounds.maxX - originX);
  const machineMinY = Math.round(bounds.minY - originY);
  const machineMaxY = Math.round(bounds.maxY - originY);
  out.writeInt32BE(machineMaxX * 100); // right
  out.writeInt32BE(-machineMinY * 100); // -top
  out.writeInt32BE(machineMinX * 100); // left
  out.writeInt32BE(-machineMaxY * 100); // -bottom

  out.writeUint32BE(sewnCount);
  out.writeUint8(0);
  out.writeUint8(blocks.length);
  out.writeUint8(12);
  out.writeUint8(0);
  out.writeUint8(1); // One design per file.

  writeDesignBlock(out, blocks, bounds, originX, originY);
  patchFile();
  return out.toUint8Array();
}
