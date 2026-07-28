import { EmbPattern } from '../../pattern/emb-pattern.js';
import { StitchCommand } from '../../pattern/stitch.js';
import { threadFromInt } from '../../pattern/thread.js';
import { ByteReader } from '../common/byte-reader.js';

function readString8(reader: ByteReader): string {
  return reader.readString(reader.readUint16BE());
}

function readString16(reader: ByteReader): string {
  const byteLength = reader.readUint16BE();
  let text = '';
  for (let i = 0; i + 1 < byteLength; i += 2) text += String.fromCharCode(reader.readUint16BE());
  if (byteLength % 2 === 1) reader.skip(1);
  return text;
}

function expectMarker(reader: ByteReader, expected: readonly number[], label: string): void {
  for (const byte of expected) {
    const actual = reader.readUint8();
    if (actual !== byte) {
      throw new Error(
        `VP3: expected ${label} marker byte 0x${byte.toString(16)}, found 0x${actual.toString(16)}`,
      );
    }
  }
}

/**
 * Reads one colour block's stitch stream. VP3 has no jump records, so travel
 * arrives as a long stitch — the preceding trim is what says it was travel.
 * We re-emit that as `TRIM` + `JUMP` so the pattern round-trips with its
 * intent intact rather than as a giant sewn stitch.
 */
function readStitchBlock(
  reader: ByteReader,
  pattern: EmbPattern,
  end: number,
  startX: number,
  startY: number,
): void {
  let x = startX;
  let y = startY;
  let afterTrim = false;

  while (reader.position < end && reader.hasMore(1)) {
    const first = reader.readUint8();

    if (first === 0x80) {
      if (!reader.hasMore(1)) break;
      const code = reader.readUint8();
      if (code === 0x03) {
        pattern.addStitchAbsolute(x, y, StitchCommand.TRIM);
        afterTrim = true;
        continue;
      }
      if (code === 0x01) {
        if (!reader.hasMore(4)) break;
        x += reader.readInt16BE();
        y += reader.readInt16BE();
        pattern.addStitchAbsolute(
          x,
          y,
          afterTrim ? StitchCommand.JUMP : StitchCommand.STITCH,
        );
        afterTrim = false;
        continue;
      }
      // 0x80 0x02 terminates a long stitch; anything else is unknown padding.
      continue;
    }

    if (!reader.hasMore(1)) break;
    x += (first << 24) >> 24;
    y += reader.readInt8();
    pattern.addStitchAbsolute(x, y, afterTrim ? StitchCommand.JUMP : StitchCommand.STITCH);
    afterTrim = false;
  }

  reader.position = Math.min(end, reader.length);
}

export function readVp3(data: Uint8Array): EmbPattern {
  const reader = new ByteReader(data);
  const signature = reader.readString(5);
  if (signature !== '%vsm%') {
    throw new Error(`VP3: expected a "%vsm%" signature, found "${signature}"`);
  }
  reader.skip(1);
  readString16(reader); // Producer string.

  expectMarker(reader, [0x00, 0x02, 0x00], 'file block');
  reader.skip(4); // Distance to end of file block.
  readString16(reader); // Global notes.
  reader.skip(16); // Four extent values.
  reader.skip(4); // Sewn stitch count.
  reader.skip(4); // Flags, colour-block count, 0x0C, padding.
  const designCount = reader.readUint8();

  const pattern = new EmbPattern();
  let firstBlockOverall = true;

  for (let design = 0; design < designCount && reader.hasMore(3); design++) {
    expectMarker(reader, [0x00, 0x03, 0x00], 'design block');
    reader.skip(4); // Distance to end of design block.
    const centerX = reader.readInt32BE() / 100;
    const centerY = -reader.readInt32BE() / 100;
    reader.skip(3);
    reader.skip(16); // Half-extent values.
    reader.skip(8); // Width and height.
    readString16(reader); // Design notes.
    reader.skip(2); // 0x64 0x64.
    reader.skip(16); // Transform matrix.
    reader.skip(6); // "xxPP" plus two flag bytes.
    readString16(reader); // Producer string.

    const blockCount = reader.readUint16BE();
    for (let block = 0; block < blockCount && reader.hasMore(3); block++) {
      expectMarker(reader, [0x00, 0x05, 0x00], 'colour block');
      reader.skip(4); // Distance to end of colour block.

      const startX = centerX + reader.readInt32BE() / 100;
      const startY = centerY - reader.readInt32BE() / 100;

      reader.skip(2); // Colour count and transition flag.
      const color = reader.readUint24BE();
      reader.skip(5); // Parts, length, thread weight.
      const catalogNumber = readString8(reader);
      const description = readString8(reader);
      const brand = readString8(reader);

      const thread = threadFromInt(color, description || undefined);
      if (catalogNumber) thread.catalogNumber = catalogNumber;
      if (brand) thread.brand = brand;
      pattern.addThread(thread);

      reader.skip(8); // Block shift.

      if (!firstBlockOverall) pattern.addStitchAbsolute(startX, startY, StitchCommand.COLOR_CHANGE);
      firstBlockOverall = false;

      expectMarker(reader, [0x00, 0x01, 0x00], 'stitch block');
      const stitchBlockLength = reader.readInt32BE();
      const stitchBlockEnd = reader.position + stitchBlockLength;
      reader.skip(3); // 0x0A 0xF6 0x00.
      readStitchBlock(reader, pattern, stitchBlockEnd, startX, startY);
      reader.skip(1); // Colour-block terminator.
    }
  }

  pattern.end();
  return pattern;
}
