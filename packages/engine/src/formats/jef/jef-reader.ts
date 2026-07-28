import { EmbPattern } from '../../pattern/emb-pattern.js';
import { StitchCommand, type StitchPoint } from '../../pattern/stitch.js';
import { cloneThread } from '../../pattern/thread.js';
import { ByteReader } from '../common/byte-reader.js';
import { chartThread, JANOME_JEF_THREADS } from '../common/thread-charts.js';
import {
  JEF_CODE_COLOR_CHANGE,
  JEF_CODE_END,
  JEF_CODE_JUMP,
  JEF_ESCAPE,
  JEF_HEADER_SIZE,
} from './jef-writer.js';

/**
 * A zero-length jump means nothing on its own, so a run of them is
 * unambiguously the trim idiom rather than real travel.
 */
function collapseZeroJumps(stitches: readonly StitchPoint[]): StitchPoint[] {
  const out: StitchPoint[] = [];
  let previousWasZeroJump = false;
  let x = 0;
  let y = 0;

  for (const stitch of stitches) {
    const isZeroJump =
      stitch.command === StitchCommand.JUMP &&
      Math.abs(stitch.x - x) < 1e-9 &&
      Math.abs(stitch.y - y) < 1e-9;

    if (isZeroJump) {
      if (!previousWasZeroJump) {
        out.push({ x: stitch.x, y: stitch.y, command: StitchCommand.TRIM });
      }
      previousWasZeroJump = true;
      continue;
    }

    previousWasZeroJump = false;
    out.push(stitch);
    if (stitch.command === StitchCommand.JUMP || stitch.command === StitchCommand.STITCH) {
      x = stitch.x;
      y = stitch.y;
    }
  }
  return out;
}

export function readJef(data: Uint8Array): EmbPattern {
  if (data.length < JEF_HEADER_SIZE) {
    throw new Error(`JEF: file is ${data.length} bytes, shorter than the 116-byte header`);
  }
  const reader = new ByteReader(data);
  const pattern = new EmbPattern();

  const stitchOffset = reader.readUint32LE();
  reader.skip(4); // Format constant 0x14.
  const date = reader.readTrimmedString(14);
  if (date) pattern.metadata.comments = `JEF date ${date}`;
  reader.skip(2);
  const colorCount = reader.readUint32LE();
  reader.skip(4); // Point count, recomputed on read.
  reader.skip(4); // Hoop code.
  reader.skip(16); // Half-size fields.
  reader.skip(64); // Four hoop-clearance groups.

  if (colorCount > 0 && colorCount < 1000 && reader.hasMore(colorCount * 4)) {
    for (let i = 0; i < colorCount; i++) {
      pattern.addThread(cloneThread(chartThread(JANOME_JEF_THREADS, reader.readUint32LE())));
    }
  }

  reader.position = Math.min(
    Math.max(stitchOffset, JEF_HEADER_SIZE),
    data.length,
  );

  const raw: StitchPoint[] = [];
  let x = 0;
  let y = 0;

  while (reader.hasMore(2)) {
    const first = reader.readUint8();
    if (first === JEF_ESCAPE) {
      const code = reader.readUint8();
      if (code === JEF_CODE_END) break;
      if (!reader.hasMore(2)) break;
      x += reader.readInt8();
      y += reader.readInt8();
      if (code === JEF_CODE_COLOR_CHANGE) {
        raw.push({ x, y: -y, command: StitchCommand.COLOR_CHANGE });
      } else if (code === JEF_CODE_JUMP) {
        raw.push({ x, y: -y, command: StitchCommand.JUMP });
      }
      // Any other escape is a machine directive we do not model; the position
      // update still applies, which is why it happens before this branch.
      continue;
    }
    x += (first << 24) >> 24;
    y += reader.readInt8();
    raw.push({ x, y: -y, command: StitchCommand.STITCH });
  }

  for (const stitch of collapseZeroJumps(raw)) pattern.addStitchPoint(stitch);
  pattern.end();
  return pattern;
}
