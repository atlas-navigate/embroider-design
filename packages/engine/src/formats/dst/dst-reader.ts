import { EmbPattern } from '../../pattern/emb-pattern.js';
import { StitchCommand, type StitchPoint } from '../../pattern/stitch.js';
import { threadFromHex } from '../../pattern/thread.js';
import { ByteReader } from '../common/byte-reader.js';
import {
  DST_CONTROL_BIT,
  DST_HEADER_SIZE,
  RECORD_COLOR_CHANGE,
  RECORD_END,
  RECORD_SEQUIN_MODE,
  decodeDstCoordinates,
} from './dst-writer.js';

export interface DstReadOptions {
  /**
   * Collapse a zero-net burst of three or more consecutive jumps back into a
   * `TRIM`. DST has no trim record, so this idiom is the only signal there is;
   * requiring zero net displacement makes the detection unambiguous.
   */
  detectTrims?: boolean;
}

function parseHeader(reader: ByteReader, pattern: EmbPattern): void {
  const text = reader.readString(DST_HEADER_SIZE);
  for (const line of text.split('\r')) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    switch (key) {
      case 'LA':
        if (value) pattern.metadata.name = value;
        break;
      case 'AU':
        if (value) pattern.metadata.author = value;
        break;
      case 'CP':
        if (value) pattern.metadata.copyright = value;
        break;
      case 'TC': {
        const [hex, description, catalogNumber] = value.split(',');
        if (hex && /^#?[0-9a-fA-F]{6}$/.test(hex.trim())) {
          const color = threadFromHex(hex.trim(), description || undefined);
          if (catalogNumber) color.catalogNumber = catalogNumber;
          pattern.addThread(color);
        }
        break;
      }
      default:
        break;
    }
  }
}

/** Longest jump burst treated as a trim signal. */
const MAX_TRIM_BURST = 8;

/**
 * Rewrites a short run of jumps that returns to exactly where it started as a
 * single `TRIM`.
 *
 * A trim burst is normally followed immediately by the real jump to the next
 * region, so this looks for the *shortest* zero-net prefix rather than
 * consuming the whole jump run — otherwise the travel move gets swallowed
 * along with the trim.
 */
function collapseTrimBursts(stitches: StitchPoint[]): StitchPoint[] {
  const out: StitchPoint[] = [];
  let currentX = 0;
  let currentY = 0;
  let index = 0;

  while (index < stitches.length) {
    const stitch = stitches[index];
    if (stitch.command === StitchCommand.JUMP) {
      let burst = 0;
      for (let k = 3; k <= MAX_TRIM_BURST && index + k <= stitches.length; k++) {
        let allJumps = true;
        for (let i = index; i < index + k; i++) {
          if (stitches[i].command !== StitchCommand.JUMP) {
            allJumps = false;
            break;
          }
        }
        if (!allJumps) break;
        const last = stitches[index + k - 1];
        if (Math.abs(last.x - currentX) < 1e-9 && Math.abs(last.y - currentY) < 1e-9) {
          burst = k;
          break;
        }
      }
      if (burst > 0) {
        out.push({ x: currentX, y: currentY, command: StitchCommand.TRIM });
        index += burst;
        continue;
      }
    }

    out.push(stitch);
    if (stitch.command === StitchCommand.JUMP || stitch.command === StitchCommand.STITCH) {
      currentX = stitch.x;
      currentY = stitch.y;
    }
    index++;
  }
  return out;
}

export function readDst(data: Uint8Array, options: DstReadOptions = {}): EmbPattern {
  const detectTrims = options.detectTrims ?? true;
  const reader = new ByteReader(data);
  const pattern = new EmbPattern();
  if (data.length < DST_HEADER_SIZE) {
    throw new Error(`DST: file is ${data.length} bytes, shorter than the 512-byte header`);
  }
  parseHeader(reader, pattern);

  const stitches: StitchPoint[] = [];
  let x = 0;
  let y = 0;

  while (reader.hasMore(3)) {
    const b0 = reader.readUint8();
    const b1 = reader.readUint8();
    const b2 = reader.readUint8();

    if (b2 & DST_CONTROL_BIT) {
      if (b2 === RECORD_END) break;
      if (b2 === RECORD_SEQUIN_MODE) continue;
      if (b2 === RECORD_COLOR_CHANGE) {
        // Y is negated on the way in: DST is Y-up, patterns are Y-down.
        stitches.push({ x, y: -y, command: StitchCommand.COLOR_CHANGE });
        continue;
      }
      continue;
    }

    const { dx, dy } = decodeDstCoordinates(b0, b1, b2);
    x += dx;
    y += dy;
    stitches.push({
      x,
      y: -y,
      command: b2 & 0b10000000 ? StitchCommand.JUMP : StitchCommand.STITCH,
    });
  }

  const finalStitches = detectTrims ? collapseTrimBursts(stitches) : stitches;
  for (const stitch of finalStitches) pattern.addStitchPoint(stitch);
  pattern.end();
  return pattern;
}
