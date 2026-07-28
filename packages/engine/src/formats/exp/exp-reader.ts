import { EmbPattern } from '../../pattern/emb-pattern.js';
import { StitchCommand } from '../../pattern/stitch.js';
import { ByteReader } from '../common/byte-reader.js';
import { EXP_COLOR_CHANGE, EXP_ESCAPE, EXP_JUMP, EXP_TRIM } from './exp-writer.js';

export function readExp(data: Uint8Array): EmbPattern {
  const reader = new ByteReader(data);
  const pattern = new EmbPattern();
  let x = 0;
  let y = 0;

  while (reader.hasMore(2)) {
    const first = reader.readUint8();

    if (first === EXP_ESCAPE) {
      const code = reader.readUint8();
      if (code === EXP_TRIM) {
        // 0x80 0x80 0x07 0x00
        if (!reader.hasMore(2)) break;
        reader.skip(2);
        pattern.addStitchAbsolute(x, -y, StitchCommand.TRIM);
        continue;
      }
      if (code === EXP_COLOR_CHANGE) {
        // 0x80 0x01 0x00 0x00
        if (!reader.hasMore(2)) break;
        reader.skip(2);
        pattern.addStitchAbsolute(x, -y, StitchCommand.COLOR_CHANGE);
        continue;
      }
      if (code === EXP_JUMP || code === 0x02) {
        if (!reader.hasMore(2)) break;
        x += reader.readInt8();
        y += reader.readInt8();
        pattern.addStitchAbsolute(x, -y, StitchCommand.JUMP);
        continue;
      }
      // Unrecognised escape: skip its two-byte payload and keep going rather
      // than abandoning the rest of an otherwise readable file.
      if (reader.hasMore(2)) reader.skip(2);
      continue;
    }

    x += (first << 24) >> 24;
    y += reader.readInt8();
    pattern.addStitchAbsolute(x, -y, StitchCommand.STITCH);
  }

  pattern.end();
  return pattern;
}
