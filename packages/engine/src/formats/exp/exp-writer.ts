import { toDeltaEncoding, type EmbPattern } from '../../pattern/emb-pattern.js';
import { StitchCommand } from '../../pattern/stitch.js';
import { ByteWriter } from '../common/byte-writer.js';
import type { WriteOptions } from '../common/format-types.js';
import { preparePattern } from '../common/prepare.js';

/**
 * Melco EXP.
 *
 * The leanest format here: no header at all, just a stream of signed byte
 * pairs. Control commands are escape sequences introduced by `0x80`.
 *
 * The 127-unit limit is not a padding choice — a delta of -128 encodes as
 * `0x80`, which a reader would take as the start of an escape sequence.
 * Capping at ±127 keeps every coordinate byte outside that value, and unlike
 * the other formats EXP has no long form to fall back on, so the splitting in
 * `toDeltaEncoding` is the *only* thing preventing a corrupt file.
 */

export const EXP_MAX_STITCH = 127;
export const EXP_MAX_JUMP = 127;

export const EXP_ESCAPE = 0x80;
export const EXP_COLOR_CHANGE = 0x01;
export const EXP_JUMP = 0x04;
export const EXP_TRIM = 0x80;

export function writeExp(pattern: EmbPattern, options: WriteOptions = {}): Uint8Array {
  const { pattern: prepared, originX, originY } = preparePattern(pattern, options);

  const deltas = toDeltaEncoding(prepared.stitches, {
    maxStitchDistance: EXP_MAX_STITCH,
    maxJumpDistance: EXP_MAX_JUMP,
    flipY: true,
    originX,
    originY,
  });

  const out = new ByteWriter(deltas.length * 2 + 32);
  for (const delta of deltas) {
    switch (delta.command) {
      case StitchCommand.STITCH:
      case StitchCommand.SEQUIN:
        out.writeInt8(delta.dx).writeInt8(delta.dy);
        break;
      case StitchCommand.JUMP:
        out.writeUint8(EXP_ESCAPE).writeUint8(EXP_JUMP);
        out.writeInt8(delta.dx).writeInt8(delta.dy);
        break;
      case StitchCommand.TRIM:
        out.writeBytes([EXP_ESCAPE, EXP_TRIM, 0x07, 0x00]);
        break;
      case StitchCommand.COLOR_CHANGE:
      case StitchCommand.STOP:
        out.writeBytes([EXP_ESCAPE, EXP_COLOR_CHANGE, 0x00, 0x00]);
        break;
      case StitchCommand.END:
        // EXP has no terminator; the file simply ends.
        break;
    }
  }
  return out.toUint8Array();
}
