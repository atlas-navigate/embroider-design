import { EmbPattern } from '../../pattern/emb-pattern.js';
import { StitchCommand } from '../../pattern/stitch.js';
import { thread } from '../../pattern/thread.js';
import { ByteReader } from '../common/byte-reader.js';
import {
  XXX_CODE_COLOR_CHANGE,
  XXX_CODE_JUMP,
  XXX_CODE_TRIM,
  XXX_CONTROL,
  XXX_HEADER_SIZE,
  XXX_LONG_STITCH,
} from './xxx-writer.js';

/** Byte offsets of the header fields we actually use. */
const OFFSET_THREAD_COUNT = 0x27;
const OFFSET_END_OF_STITCHES = 0xfc;

export function readXxx(data: Uint8Array): EmbPattern {
  if (data.length < XXX_HEADER_SIZE) {
    throw new Error(`XXX: file is ${data.length} bytes, shorter than the 256-byte header`);
  }
  const reader = new ByteReader(data);
  const pattern = new EmbPattern();

  reader.position = OFFSET_THREAD_COUNT;
  const threadCount = reader.readUint32LE();
  reader.position = OFFSET_END_OF_STITCHES;
  const declaredEnd = reader.readUint32LE();
  const stitchEnd =
    declaredEnd > XXX_HEADER_SIZE && declaredEnd <= data.length ? declaredEnd : data.length;

  reader.position = XXX_HEADER_SIZE;
  let x = 0;
  let y = 0;

  while (reader.position < stitchEnd && reader.hasMore(2)) {
    const first = reader.readUint8();

    if (first === XXX_CONTROL) {
      const code = reader.readUint8();
      if (code === XXX_CONTROL) break; // 0x7F 0x7F: end-of-stitches marker.
      if (!reader.hasMore(2)) break;
      const dx = reader.readInt8();
      const dy = reader.readInt8();
      x += dx;
      y += dy;
      if (code === XXX_CODE_JUMP) {
        pattern.addStitchAbsolute(x, -y, StitchCommand.JUMP);
      } else if (code === XXX_CODE_TRIM) {
        pattern.addStitchAbsolute(x, -y, StitchCommand.TRIM);
      } else if (code === XXX_CODE_COLOR_CHANGE) {
        pattern.addStitchAbsolute(x, -y, StitchCommand.COLOR_CHANGE);
      }
      continue;
    }

    if (first === XXX_LONG_STITCH) {
      if (!reader.hasMore(4)) break;
      x += reader.readInt16LE();
      y += reader.readInt16LE();
      pattern.addStitchAbsolute(x, -y, StitchCommand.STITCH);
      continue;
    }

    x += (first << 24) >> 24;
    y += reader.readInt8();
    pattern.addStitchAbsolute(x, -y, StitchCommand.STITCH);
  }

  // Colour table: 0x7F 0x7F 0x02 0x14, two pad bytes, then 4 bytes per thread.
  const paletteStart = stitchEnd + 6;
  if (threadCount > 0 && paletteStart + threadCount * 4 <= data.length) {
    reader.position = paletteStart;
    for (let i = 0; i < threadCount; i++) {
      reader.skip(1);
      pattern.addThread(thread(reader.readUint8(), reader.readUint8(), reader.readUint8()));
    }
  }

  pattern.end();
  return pattern;
}
