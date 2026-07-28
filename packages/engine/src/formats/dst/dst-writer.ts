import { toDeltaEncoding, type EmbPattern } from '../../pattern/emb-pattern.js';
import { StitchCommand } from '../../pattern/stitch.js';
import { threadToHex } from '../../pattern/thread.js';
import { ByteWriter } from '../common/byte-writer.js';
import { toMachineBounds, type WriteOptions } from '../common/format-types.js';
import { preparePattern } from '../common/prepare.js';

/**
 * Tajima DST.
 *
 * The oldest and most universal of the formats we write, and the simplest: a
 * 512-byte ASCII header followed by 3-byte records. Each record encodes a
 * *ternary* coordinate — the two axes are decomposed into signed contributions
 * of 81, 27, 9, 3 and 1, spread across specific bits of the three bytes. That
 * caps a single move at 81+27+9+3+1 = 121 units (12.1 mm), which is where
 * `DST_MAX_STITCH` comes from.
 *
 * DST stores no colours and has no trim command. Colour changes are a control
 * record; trims are conveyed by a short zero-net jump sequence that machines
 * recognise by convention.
 */

export const DST_MAX_STITCH = 121;
export const DST_MAX_JUMP = 121;
export const DST_HEADER_SIZE = 512;

/** Control-record third bytes. Bit 6 is set on all of them and never by a coordinate. */
const RECORD_COLOR_CHANGE = 0b11000011;
const RECORD_END = 0b11110011;
const RECORD_SEQUIN_MODE = 0b01000011;
/** Bit 6 distinguishes a control record from a coordinate record. */
export const DST_CONTROL_BIT = 0b01000000;

export interface DstWriteOptions extends WriteOptions {
  /**
   * Emit the non-standard `AU:`/`CP:`/`TC:` header lines. Some software reads
   * them; some older readers choke, so this is off by default.
   */
  extendedHeader?: boolean;
  /** Jump records used to signal a trim. Three is the near-universal convention. */
  trimAt?: number;
}

function bit(n: number): number {
  return 1 << n;
}

/**
 * Packs one move into DST's ternary record. `dy` must already be in machine
 * space (Y-up) — the flip happens once, in `toDeltaEncoding`.
 */
export function encodeDstRecord(dx: number, dy: number, jump: boolean): [number, number, number] {
  let b0 = 0;
  let b1 = 0;
  let b2 = jump ? bit(7) : 0;
  b2 |= bit(0) | bit(1);

  let x = dx;
  if (x > 40) {
    b2 |= bit(2);
    x -= 81;
  }
  if (x < -40) {
    b2 |= bit(3);
    x += 81;
  }
  if (x > 13) {
    b1 |= bit(2);
    x -= 27;
  }
  if (x < -13) {
    b1 |= bit(3);
    x += 27;
  }
  if (x > 4) {
    b0 |= bit(2);
    x -= 9;
  }
  if (x < -4) {
    b0 |= bit(3);
    x += 9;
  }
  if (x > 1) {
    b1 |= bit(0);
    x -= 3;
  }
  if (x < -1) {
    b1 |= bit(1);
    x += 3;
  }
  if (x > 0) {
    b0 |= bit(0);
    x -= 1;
  }
  if (x < 0) {
    b0 |= bit(1);
    x += 1;
  }
  if (x !== 0) {
    throw new RangeError(`DST: dx ${dx} exceeds the ${DST_MAX_STITCH}-unit record limit`);
  }

  let y = dy;
  if (y > 40) {
    b2 |= bit(5);
    y -= 81;
  }
  if (y < -40) {
    b2 |= bit(4);
    y += 81;
  }
  if (y > 13) {
    b1 |= bit(5);
    y -= 27;
  }
  if (y < -13) {
    b1 |= bit(4);
    y += 27;
  }
  if (y > 4) {
    b0 |= bit(5);
    y -= 9;
  }
  if (y < -4) {
    b0 |= bit(4);
    y += 9;
  }
  if (y > 1) {
    b1 |= bit(7);
    y -= 3;
  }
  if (y < -1) {
    b1 |= bit(6);
    y += 3;
  }
  if (y > 0) {
    b0 |= bit(7);
    y -= 1;
  }
  if (y < 0) {
    b0 |= bit(6);
    y += 1;
  }
  if (y !== 0) {
    throw new RangeError(`DST: dy ${dy} exceeds the ${DST_MAX_STITCH}-unit record limit`);
  }

  return [b0, b1, b2];
}

/** Reverses `encodeDstRecord`. Shared with the reader and the round-trip tests. */
export function decodeDstCoordinates(b0: number, b1: number, b2: number): { dx: number; dy: number } {
  let dx = 0;
  if (b2 & bit(2)) dx += 81;
  if (b2 & bit(3)) dx -= 81;
  if (b1 & bit(2)) dx += 27;
  if (b1 & bit(3)) dx -= 27;
  if (b0 & bit(2)) dx += 9;
  if (b0 & bit(3)) dx -= 9;
  if (b1 & bit(0)) dx += 3;
  if (b1 & bit(1)) dx -= 3;
  if (b0 & bit(0)) dx += 1;
  if (b0 & bit(1)) dx -= 1;

  let dy = 0;
  if (b2 & bit(5)) dy += 81;
  if (b2 & bit(4)) dy -= 81;
  if (b1 & bit(5)) dy += 27;
  if (b1 & bit(4)) dy -= 27;
  if (b0 & bit(5)) dy += 9;
  if (b0 & bit(4)) dy -= 9;
  if (b1 & bit(7)) dy += 3;
  if (b1 & bit(6)) dy -= 3;
  if (b0 & bit(7)) dy += 1;
  if (b0 & bit(6)) dy -= 1;

  return { dx, dy };
}

/**
 * The trim idiom: three jumps that net to zero displacement. DST has no trim
 * record, and machines with an auto-trimmer detect this jump burst. Reading
 * it back is unambiguous precisely because the net displacement is zero.
 */
function writeTrimSequence(body: ByteWriter, trimAt: number): number {
  const steps = Math.max(3, Math.floor(trimAt));
  let delta = -4;
  let records = 0;
  body.writeBytes(encodeDstRecord(-delta / 2, -delta / 2, true));
  records++;
  for (let i = 1; i < steps - 1; i++) {
    body.writeBytes(encodeDstRecord(delta, delta, true));
    delta = -delta;
    records++;
  }
  body.writeBytes(encodeDstRecord(delta / 2, delta / 2, true));
  records++;
  return records;
}

function padNumber(value: number, width: number): string {
  return String(value).padStart(width, ' ');
}

export function writeDst(pattern: EmbPattern, options: DstWriteOptions = {}): Uint8Array {
  const { pattern: prepared, originX, originY, bounds } = preparePattern(pattern, options);
  const trimAt = options.trimAt ?? 3;

  const deltas = toDeltaEncoding(prepared.stitches, {
    maxStitchDistance: DST_MAX_STITCH,
    maxJumpDistance: DST_MAX_JUMP,
    flipY: true,
    originX,
    originY,
  });

  const body = new ByteWriter(deltas.length * 3 + 64);
  let recordCount = 0;
  let colorChanges = 0;
  let endX = 0;
  let endY = 0;

  for (const delta of deltas) {
    switch (delta.command) {
      case StitchCommand.STITCH:
      case StitchCommand.SEQUIN:
        body.writeBytes(encodeDstRecord(delta.dx, delta.dy, false));
        endX += delta.dx;
        endY += delta.dy;
        recordCount++;
        break;
      case StitchCommand.JUMP:
        body.writeBytes(encodeDstRecord(delta.dx, delta.dy, true));
        endX += delta.dx;
        endY += delta.dy;
        recordCount++;
        break;
      case StitchCommand.TRIM:
        recordCount += writeTrimSequence(body, trimAt);
        break;
      case StitchCommand.COLOR_CHANGE:
        body.writeBytes([0, 0, RECORD_COLOR_CHANGE]);
        colorChanges++;
        recordCount++;
        break;
      case StitchCommand.STOP:
        body.writeBytes([0, 0, RECORD_COLOR_CHANGE]);
        recordCount++;
        break;
      case StitchCommand.END:
        body.writeBytes([0, 0, RECORD_END]);
        break;
    }
  }
  if (deltas.length === 0) body.writeBytes([0, 0, RECORD_END]);

  const machine = toMachineBounds(bounds, originX, originY, true);
  const header = new ByteWriter(DST_HEADER_SIZE);
  const name = (prepared.metadata.name ?? 'Untitled').slice(0, 16);

  header.writeString(`LA:${name.padEnd(16, ' ')}\r`);
  header.writeString(`ST:${padNumber(recordCount, 7)}\r`);
  header.writeString(`CO:${padNumber(colorChanges, 3)}\r`);
  header.writeString(`+X:${padNumber(Math.abs(machine.maxX), 5)}\r`);
  header.writeString(`-X:${padNumber(Math.abs(machine.minX), 5)}\r`);
  header.writeString(`+Y:${padNumber(Math.abs(machine.maxY), 5)}\r`);
  header.writeString(`-Y:${padNumber(Math.abs(machine.minY), 5)}\r`);
  header.writeString(
    `AX:${endX >= 0 ? '+' : '-'}${padNumber(Math.abs(endX), 5)}\r`,
  );
  header.writeString(
    `AY:${endY >= 0 ? '+' : '-'}${padNumber(Math.abs(endY), 5)}\r`,
  );
  header.writeString(`MX:+${padNumber(0, 5)}\r`);
  header.writeString(`MY:+${padNumber(0, 5)}\r`);
  header.writeString(`PD:******\r`);

  if (options.extendedHeader) {
    const { author, copyright } = prepared.metadata;
    if (author) header.writeString(`AU:${author}\r`);
    if (copyright) header.writeString(`CP:${copyright}\r`);
    for (const color of prepared.threads) {
      const description = color.description ?? '';
      const catalog = color.catalogNumber ?? '';
      header.writeString(`TC:${threadToHex(color)},${description},${catalog}\r`);
    }
  }

  header.writeUint8(0x1a); // End-of-header marker.
  if (header.length > DST_HEADER_SIZE) {
    throw new Error(
      `DST: header is ${header.length} bytes, over the ${DST_HEADER_SIZE}-byte limit; ` +
        'shorten the metadata or disable extendedHeader',
    );
  }
  header.fill(0x20, DST_HEADER_SIZE - header.length);

  const out = new ByteWriter(DST_HEADER_SIZE + body.length);
  out.writeBytes(header.toUint8Array());
  out.writeBytes(body.toUint8Array());
  return out.toUint8Array();
}

export { RECORD_COLOR_CHANGE, RECORD_END, RECORD_SEQUIN_MODE };
