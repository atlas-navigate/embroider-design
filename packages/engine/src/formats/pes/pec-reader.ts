import { EmbPattern } from '../../pattern/emb-pattern.js';
import { StitchCommand } from '../../pattern/stitch.js';
import { cloneThread } from '../../pattern/thread.js';
import { ByteReader } from '../common/byte-reader.js';
import { BROTHER_PEC_THREADS, chartThread } from '../common/thread-charts.js';
import { FLAG_LONG, JUMP_CODE, TRIM_CODE } from './pec-writer.js';

/** 12-bit two's complement, as stored in PEC's long form. */
function signed12(value: number): number {
  const masked = value & 0xfff;
  return masked > 0x7ff ? masked - 0x1000 : masked;
}

/** 7-bit two's complement, as stored in PEC's short form. */
function signed7(value: number): number {
  return value > 63 ? value - 128 : value;
}

function readPecStitches(reader: ByteReader, pattern: EmbPattern): void {
  let x = 0;
  let y = 0;

  while (reader.hasMore(2)) {
    const first = reader.readUint8();
    const second = reader.readUint8();

    // 0xFF followed by anything ends the stitch block. Our writer emits a bare
    // 0xFF and the thumbnails begin with 0x00, which is the usual pairing.
    if (first === 0xff) break;

    if (first === 0xfe && second === 0xb0) {
      if (!reader.hasMore(1)) break;
      reader.skip(1); // Alternating 0x01 / 0x02 marker; carries no information.
      pattern.addStitchAbsolute(x, y, StitchCommand.COLOR_CHANGE);
      continue;
    }

    let jump = false;
    let trim = false;
    let dx: number;
    let low = second;

    if (first & FLAG_LONG) {
      if (first & TRIM_CODE) trim = true;
      if (first & JUMP_CODE) jump = true;
      dx = signed12((first << 8) | second);
      if (!reader.hasMore(1)) break;
      low = reader.readUint8();
    } else {
      dx = signed7(first);
    }

    let dy: number;
    if (low & FLAG_LONG) {
      if (low & TRIM_CODE) trim = true;
      if (low & JUMP_CODE) jump = true;
      if (!reader.hasMore(1)) break;
      dy = signed12((low << 8) | reader.readUint8());
    } else {
      dy = signed7(low);
    }

    x += dx;
    y += dy;
    if (trim) {
      pattern.addStitchAbsolute(x - dx, y - dy, StitchCommand.TRIM);
      pattern.addStitchAbsolute(x, y, StitchCommand.JUMP);
    } else if (jump) {
      pattern.addStitchAbsolute(x, y, StitchCommand.JUMP);
    } else {
      pattern.addStitchAbsolute(x, y, StitchCommand.STITCH);
    }
  }
}

/**
 * Reads a PEC section starting at the reader's current position. Shared by the
 * standalone PEC reader and the PES container reader, since the block is
 * byte-identical either way.
 */
export function readPecSection(reader: ByteReader, pattern: EmbPattern): void {
  reader.skip(3); // "LA:"
  const label = reader.readString(16).trim();
  if (label) pattern.metadata.name = label;
  reader.skip(15); // Carriage return, 12 spaces, 0xFF 0x00.
  reader.skip(1); // Thumbnail byte stride.
  reader.skip(1); // Thumbnail height.
  reader.skip(12);

  const colorChanges = reader.readUint8();
  // 0xFF is the format's "no colours" sentinel, not 256 colour blocks.
  const colorCount = colorChanges === 0xff ? 0 : colorChanges + 1;
  for (let i = 0; i < colorCount; i++) {
    pattern.addThread(cloneThread(chartThread(BROTHER_PEC_THREADS, reader.readUint8())));
  }
  reader.skip(465 - colorCount);

  const blockLength = reader.readUint24LE();
  const stitchBlockEnd = blockLength - 5 + reader.position;
  reader.skip(0x0b); // 0x31 0xFF 0xF0 plus four 16-bit fields.

  readPecStitches(reader, pattern);
  if (stitchBlockEnd > 0 && stitchBlockEnd <= reader.length) reader.position = stitchBlockEnd;
  pattern.end();
}

export function readPec(data: Uint8Array): EmbPattern {
  const reader = new ByteReader(data);
  const signature = reader.readString(8);
  if (!signature.startsWith('#PEC')) {
    throw new Error(`PEC: expected a "#PEC0001" signature, found "${signature}"`);
  }
  const pattern = new EmbPattern();
  readPecSection(reader, pattern);
  return pattern;
}
