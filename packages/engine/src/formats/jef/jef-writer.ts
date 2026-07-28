import { toDeltaEncoding, type EmbPattern } from '../../pattern/emb-pattern.js';
import { StitchCommand } from '../../pattern/stitch.js';
import { ByteWriter } from '../common/byte-writer.js';
import { toMachineBounds, type WriteOptions } from '../common/format-types.js';
import { buildNonRepeatPalette } from '../common/palette-match.js';
import { preparePattern } from '../common/prepare.js';
import { JANOME_JEF_THREADS } from '../common/thread-charts.js';

/**
 * Janome JEF.
 *
 * A 116-byte fixed header, a colour table of chart *indices* (Janome machines
 * hold their own palette — see `thread-charts.ts`), then a stitch stream of
 * signed byte pairs with `0x80`-escaped control codes.
 *
 * JEF has no trim command. The convention is a burst of zero-length jumps,
 * which Janome machines interpret as "cut here". We emit them by default:
 * dropping trims entirely would leave the machine dragging thread between
 * every separated region.
 */

export const JEF_MAX_STITCH = 127;
export const JEF_MAX_JUMP = 127;
export const JEF_HEADER_SIZE = 0x74;

export const JEF_HOOP_110X110 = 0;
export const JEF_HOOP_50X50 = 1;
export const JEF_HOOP_140X200 = 2;
export const JEF_HOOP_126X110 = 3;
export const JEF_HOOP_200X200 = 4;

const JEF_ESCAPE = 0x80;
const JEF_CODE_COLOR_CHANGE = 0x01;
const JEF_CODE_JUMP = 0x02;
const JEF_CODE_END = 0x10;

export interface JefWriteOptions extends WriteOptions {
  /** Emit trims as zero-length jump bursts. Default `true`. */
  trims?: boolean;
  /** Jumps per trim burst. Default 3. */
  trimAt?: number;
  /** `YYYYMMDDHHMMSS`. Defaults to now; pass a fixed value for reproducible output. */
  date?: string;
}

/** Dimensions are in 0.1 mm units, so a 110 mm hoop is 1100. */
export function jefHoopSize(width: number, height: number): number {
  if (width < 500 && height < 500) return JEF_HOOP_50X50;
  if (width < 1260 && height < 1100) return JEF_HOOP_126X110;
  if (width < 1400 && height < 2000) return JEF_HOOP_140X200;
  if (width < 2000 && height < 2000) return JEF_HOOP_200X200;
  return JEF_HOOP_110X110;
}

function formatJefDate(date: Date): string {
  const pad = (value: number, width = 2): string => String(value).padStart(width, '0');
  return (
    `${pad(date.getFullYear(), 4)}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/**
 * Clearance between the design and each standard hoop's edge. `-1` in all four
 * slots means the design does not fit that hoop, which is how the machine
 * decides which hoops to offer.
 */
function writeHoopClearance(out: ByteWriter, x: number, y: number): void {
  if (Math.min(x, y) >= 0) {
    out.writeInt32LE(x).writeInt32LE(y).writeInt32LE(x).writeInt32LE(y);
  } else {
    out.writeInt32LE(-1).writeInt32LE(-1).writeInt32LE(-1).writeInt32LE(-1);
  }
}

export function writeJef(pattern: EmbPattern, options: JefWriteOptions = {}): Uint8Array {
  const { pattern: prepared, originX, originY, bounds } = preparePattern(pattern, options);
  const trims = options.trims ?? true;
  const trimAt = Math.max(1, Math.floor(options.trimAt ?? 3));
  const dateString = options.date ?? formatJefDate(new Date());

  const deltas = toDeltaEncoding(prepared.stitches, {
    maxStitchDistance: JEF_MAX_STITCH,
    maxJumpDistance: JEF_MAX_JUMP,
    flipY: true,
    originX,
    originY,
  });

  const body = new ByteWriter(deltas.length * 2 + 64);
  for (const delta of deltas) {
    switch (delta.command) {
      case StitchCommand.STITCH:
      case StitchCommand.SEQUIN:
        body.writeInt8(delta.dx).writeInt8(delta.dy);
        break;
      case StitchCommand.JUMP:
        body.writeUint8(JEF_ESCAPE).writeUint8(JEF_CODE_JUMP);
        body.writeInt8(delta.dx).writeInt8(delta.dy);
        break;
      case StitchCommand.TRIM:
        if (trims) {
          for (let i = 0; i < trimAt; i++) {
            body.writeBytes([JEF_ESCAPE, JEF_CODE_JUMP, 0x00, 0x00]);
          }
        }
        break;
      case StitchCommand.COLOR_CHANGE:
      case StitchCommand.STOP:
        body.writeUint8(JEF_ESCAPE).writeUint8(JEF_CODE_COLOR_CHANGE);
        body.writeInt8(0).writeInt8(0);
        break;
      case StitchCommand.END:
        break;
    }
  }
  body.writeBytes([JEF_ESCAPE, JEF_CODE_END]);

  const colorCount = Math.max(1, prepared.threads.length);
  const palette = buildNonRepeatPalette(JANOME_JEF_THREADS, prepared.threads);
  while (palette.length < colorCount) palette.push(1);

  const machine = toMachineBounds(bounds, originX, originY, true);
  const halfWidth = Math.round(machine.width / 2);
  const halfHeight = Math.round(machine.height / 2);

  const out = new ByteWriter(JEF_HEADER_SIZE + colorCount * 8 + body.length);
  out.writeUint32LE(JEF_HEADER_SIZE + colorCount * 8);
  out.writeUint32LE(0x14);
  out.writeStringPadded(dateString.slice(0, 14), 14, 0x30);
  out.writeUint8(0).writeUint8(0);
  out.writeUint32LE(colorCount);
  // Every record in the body is a 2-byte "point", including the terminator.
  out.writeUint32LE(body.length / 2);
  out.writeUint32LE(jefHoopSize(machine.width, machine.height));

  out.writeInt32LE(halfWidth).writeInt32LE(halfHeight);
  out.writeInt32LE(halfWidth).writeInt32LE(halfHeight);

  writeHoopClearance(out, 550 - halfWidth, 550 - halfHeight); // 110 x 110
  writeHoopClearance(out, 250 - halfWidth, 250 - halfHeight); // 50 x 50
  writeHoopClearance(out, 700 - halfWidth, 1000 - halfHeight); // 140 x 200
  writeHoopClearance(out, 700 - halfWidth, 1000 - halfHeight); // custom

  if (out.length !== JEF_HEADER_SIZE) {
    throw new Error(`JEF: header came out ${out.length} bytes, expected ${JEF_HEADER_SIZE}`);
  }

  for (let i = 0; i < colorCount; i++) out.writeUint32LE(palette[i] ?? 1);
  // Per-block sew type. 0x0D is the ordinary "normal stitch" value.
  for (let i = 0; i < colorCount; i++) out.writeUint32LE(0x0d);

  out.writeBytes(body.toUint8Array());
  return out.toUint8Array();
}

export { JEF_CODE_COLOR_CHANGE, JEF_CODE_END, JEF_CODE_JUMP, JEF_ESCAPE };
