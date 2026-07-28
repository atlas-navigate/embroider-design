import { toDeltaEncoding, type EmbPattern } from '../../pattern/emb-pattern.js';
import { StitchCommand } from '../../pattern/stitch.js';
import { ByteWriter } from '../common/byte-writer.js';
import { toMachineBounds, type WriteOptions } from '../common/format-types.js';
import { preparePattern } from '../common/prepare.js';

/**
 * Singer XXX.
 *
 * A 256-byte header (mostly zeros), a stitch stream, then an RGB colour table
 * at the end. Short stitches are a signed byte pair; anything larger escapes
 * to `0x7D` plus two 16-bit values. Control commands escape to `0x7F` plus a
 * code byte.
 *
 * The 124-unit limit exists so no coordinate byte can land on `0x7D`-`0x7F`
 * (or their negative counterparts), which are the escape values.
 */

export const XXX_MAX_STITCH = 124;
export const XXX_MAX_JUMP = 124;
export const XXX_HEADER_SIZE = 256;

const XXX_LONG_STITCH = 0x7d;
const XXX_CONTROL = 0x7f;
const XXX_CODE_JUMP = 0x01;
const XXX_CODE_TRIM = 0x03;
const XXX_CODE_COLOR_CHANGE = 0x08;

/** Colour table slots the format reserves; unused ones are zero-filled. */
const XXX_COLOR_SLOTS = 21;

export function writeXxx(pattern: EmbPattern, options: WriteOptions = {}): Uint8Array {
  const { pattern: prepared, originX, originY, bounds } = preparePattern(pattern, options);

  const deltas = toDeltaEncoding(prepared.stitches, {
    maxStitchDistance: XXX_MAX_STITCH,
    maxJumpDistance: XXX_MAX_JUMP,
    flipY: true,
    originX,
    originY,
  });

  // Encode the body first: the header needs the record count and the final
  // needle position, and the trailer needs the body's length.
  const body = new ByteWriter(deltas.length * 2 + 64);
  let recordCount = 0;
  let endX = 0;
  let endY = 0;

  for (const delta of deltas) {
    switch (delta.command) {
      case StitchCommand.STITCH:
      case StitchCommand.SEQUIN:
        if (delta.dx > -124 && delta.dx < 124 && delta.dy > -124 && delta.dy < 124) {
          body.writeInt8(delta.dx).writeInt8(delta.dy);
        } else {
          body.writeUint8(XXX_LONG_STITCH);
          body.writeInt16LE(delta.dx).writeInt16LE(delta.dy);
        }
        endX += delta.dx;
        endY += delta.dy;
        recordCount++;
        break;
      case StitchCommand.JUMP:
        body.writeUint8(XXX_CONTROL).writeUint8(XXX_CODE_JUMP);
        body.writeInt8(delta.dx).writeInt8(delta.dy);
        endX += delta.dx;
        endY += delta.dy;
        recordCount++;
        break;
      case StitchCommand.TRIM:
        body.writeUint8(XXX_CONTROL).writeUint8(XXX_CODE_TRIM);
        body.writeInt8(0).writeInt8(0);
        recordCount++;
        break;
      case StitchCommand.COLOR_CHANGE:
      case StitchCommand.STOP:
        body.writeUint8(XXX_CONTROL).writeUint8(XXX_CODE_COLOR_CHANGE);
        body.writeInt8(0).writeInt8(0);
        recordCount++;
        break;
      case StitchCommand.END:
        break;
    }
  }

  const machine = toMachineBounds(bounds, originX, originY, true);
  const out = new ByteWriter(XXX_HEADER_SIZE + body.length + 128);

  out.writeZeros(0x17);
  out.writeUint32LE(recordCount);
  out.writeZeros(0x0c);
  out.writeUint32LE(prepared.threads.length);
  out.writeUint16LE(0x0000);
  out.writeInt16LE(machine.width);
  out.writeInt16LE(machine.height);
  out.writeInt16LE(endX);
  out.writeInt16LE(endY);
  // Offset from the design's minimum corner back to the machine origin.
  out.writeInt16LE(-machine.minX);
  out.writeInt16LE(-machine.minY);
  out.writeZeros(0x42);
  out.writeUint16LE(0x0000);
  out.writeUint16LE(0x0000);
  out.writeZeros(0x73);
  out.writeUint16LE(0x0020);
  out.writeZeros(0x08);

  const endOfStitchesField = out.length; // 0xFC
  out.writeUint32LE(0); // Patched below with the absolute end-of-stitches offset.
  if (out.length !== XXX_HEADER_SIZE) {
    throw new Error(`XXX: header came out ${out.length} bytes, expected ${XXX_HEADER_SIZE}`);
  }

  out.writeBytes(body.toUint8Array());
  const endOfStitches = out.length;
  out.patchUint32LE(endOfStitchesField, endOfStitches);

  out.writeBytes([0x7f, 0x7f, 0x02, 0x14]);

  // Colour table.
  out.writeBytes([0x00, 0x00]);
  for (const color of prepared.threads) {
    out.writeBytes([0x00, color.r, color.g, color.b]);
  }
  for (let i = prepared.threads.length; i < XXX_COLOR_SLOTS; i++) out.writeUint32LE(0);
  out.writeUint32LE(0xffffff00);
  out.writeBytes([0x00, 0x01]);

  return out.toUint8Array();
}

export {
  XXX_CODE_COLOR_CHANGE,
  XXX_CODE_JUMP,
  XXX_CODE_TRIM,
  XXX_COLOR_SLOTS,
  XXX_CONTROL,
  XXX_LONG_STITCH,
};
