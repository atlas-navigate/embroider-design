import type { EmbPattern } from '../../pattern/emb-pattern.js';
import { StitchCommand, type StitchPoint } from '../../pattern/stitch.js';
import type { ThreadColor } from '../../pattern/thread.js';
import { ByteWriter } from '../common/byte-writer.js';
import type { WriteOptions } from '../common/format-types.js';
import { findNearestColorIndex } from '../common/palette-match.js';
import { preparePattern } from '../common/prepare.js';
import { BROTHER_PEC_THREADS } from '../common/thread-charts.js';
import { PEC_MAX_JUMP, PEC_MAX_STITCH, writePecSection } from './pec-writer.js';

/**
 * Brother PES.
 *
 * PES is a container: a vector-ish description of the design (the `CEmbOne` /
 * `CSewSeg` blocks, used by desktop software for re-editing) followed by the
 * PEC block, which is the only part the machine reads.
 *
 * Two variants are supported:
 *
 * - `full` (default) writes the vector blocks as well, so the file opens
 *   properly in PE-Design and third-party viewers.
 * - `truncated` writes a 22-byte stub whose only job is to point at the PEC
 *   block. Smaller, and every machine still reads it — useful as a fallback if
 *   a particular tool ever objects to the vector section.
 */

export const PES_VERSION_1_SIGNATURE = '#PES0001';
export const PES_MAX_STITCH = PEC_MAX_STITCH;
export const PES_MAX_JUMP = PEC_MAX_JUMP;

const EMB_ONE = 'CEmbOne';
const EMB_SEG = 'CSewSeg';

/** PE-Design's default page geometry, in 0.1 mm units. */
const PES_HOOP_WIDTH = 1300;
const PES_HOOP_HEIGHT = 1800;

export interface PesWriteOptions extends WriteOptions {
  /** Omit the vector blocks and emit only the PEC pointer stub. Default `false`. */
  truncated?: boolean;
}

function writePesString16(out: ByteWriter, text: string): void {
  out.writeUint16LE(text.length);
  out.writeString(text);
}

interface CommandBlock {
  command: StitchCommand;
  stitches: StitchPoint[];
}

/** Splits the stitch list into maximal runs of one command. */
function commandBlocks(stitches: readonly StitchPoint[]): CommandBlock[] {
  const blocks: CommandBlock[] = [];
  let current: CommandBlock | null = null;
  for (const stitch of stitches) {
    if (!current || current.command !== stitch.command) {
      current = { command: stitch.command, stitches: [] };
      blocks.push(current);
    }
    current.stitches.push(stitch);
  }
  return blocks;
}

function pecColorCode(color: ThreadColor): number {
  return findNearestColorIndex(color, BROTHER_PEC_THREADS) ?? 1;
}

interface PesSegment {
  points: { x: number; y: number }[];
  colorCode: number;
  /** 0 for a sewn run, 1 for a jump. */
  flag: number;
}

/**
 * Converts the stitch list into `CSewSeg` segments: sewn runs become polylines,
 * jumps become two-point hops from the last sewn position.
 */
function buildSegments(pattern: EmbPattern, adjustX: number, adjustY: number): PesSegment[] {
  const segments: PesSegment[] = [];
  let colorIndex = 0;
  let colorCode = pecColorCode(pattern.getThread(colorIndex++));
  let stitchedX = 0;
  let stitchedY = 0;

  for (const block of commandBlocks(pattern.stitches)) {
    if (block.command === StitchCommand.COLOR_CHANGE) {
      colorCode = pecColorCode(pattern.getThread(colorIndex++));
      continue;
    }
    if (block.command === StitchCommand.JUMP) {
      const last = block.stitches[block.stitches.length - 1];
      segments.push({
        points: [
          { x: stitchedX - adjustX, y: stitchedY - adjustY },
          { x: last.x - adjustX, y: last.y - adjustY },
        ],
        colorCode,
        flag: 1,
      });
      continue;
    }
    if (block.command !== StitchCommand.STITCH && block.command !== StitchCommand.SEQUIN) {
      continue;
    }
    const points = block.stitches.map((stitch) => {
      stitchedX = stitch.x;
      stitchedY = stitch.y;
      return { x: stitch.x - adjustX, y: stitch.y - adjustY };
    });
    segments.push({ points, colorCode, flag: 0 });
  }
  return segments;
}

/** Returns the offset of the section-count placeholder, patched by the caller. */
function writeSewSegHeader(out: ByteWriter, width: number, height: number): number {
  for (let i = 0; i < 8; i++) out.writeUint16LE(0);

  const translateX = 350 + PES_HOOP_WIDTH / 2 - width / 2;
  const translateY = 100 + height + PES_HOOP_HEIGHT / 2 - height / 2;
  out.writeFloat32LE(1).writeFloat32LE(0);
  out.writeFloat32LE(0).writeFloat32LE(1);
  out.writeFloat32LE(translateX).writeFloat32LE(translateY);

  out.writeUint16LE(1);
  out.writeUint16LE(0);
  out.writeUint16LE(0);
  out.writeInt16LE(Math.round(width));
  out.writeInt16LE(Math.round(height));
  out.writeZeros(8);

  const sectionCountField = out.length;
  out.writeUint16LE(0);
  return sectionCountField;
}

function writeVectorBlocks(
  out: ByteWriter,
  pattern: EmbPattern,
  minX: number,
  maxY: number,
  width: number,
  height: number,
): void {
  writePesString16(out, EMB_ONE);
  const sectionCountField = writeSewSegHeader(out, width, height);
  out.writeUint16LE(0xffff);
  out.writeUint16LE(0x0000);

  writePesString16(out, EMB_SEG);

  const segments = buildSegments(pattern, minX, maxY);
  const colorLog: [number, number][] = [];
  let previousColorCode = -1;

  for (let section = 0; section < segments.length; section++) {
    const segment = segments[section];
    if (section > 0) out.writeUint16LE(0x8003); // Section separator.
    if (previousColorCode !== segment.colorCode) {
      colorLog.push([section, segment.colorCode]);
      previousColorCode = segment.colorCode;
    }
    out.writeUint16LE(segment.flag);
    out.writeUint16LE(segment.colorCode);
    out.writeUint16LE(segment.points.length);
    for (const point of segment.points) {
      out.writeInt16LE(Math.round(point.x));
      out.writeInt16LE(Math.round(point.y));
    }
  }

  out.writeUint16LE(colorLog.length);
  for (const [section, colorCode] of colorLog) {
    out.writeUint16LE(section);
    out.writeUint16LE(colorCode);
  }

  out.patchUint16LE(sectionCountField, segments.length);

  out.writeUint16LE(0x0000);
  out.writeUint16LE(0x0000); // Two zero words: no further blocks.
}

export function writePes(pattern: EmbPattern, options: PesWriteOptions = {}): Uint8Array {
  const { pattern: prepared, originX, originY, bounds } = preparePattern(pattern, options);
  const out = new ByteWriter(prepared.stitches.length * 6 + 8192);

  if (options.truncated) {
    out.writeString(PES_VERSION_1_SIGNATURE);
    out.writeUint32LE(0x16); // PEC block starts immediately after this 22-byte stub.
    out.writeZeros(10);
    writePecSection(out, prepared, originX, originY, bounds);
    return out.toUint8Array();
  }

  out.writeString(PES_VERSION_1_SIGNATURE);
  const pecOffsetField = out.length;
  out.writeUint32LE(0);

  const isEmpty = prepared.stitches.length === 0;
  out.writeUint16LE(0x01); // Scale to fit.
  out.writeUint16LE(0x01); // Hoop selection.
  out.writeUint16LE(isEmpty ? 0 : 1); // Distinct block objects.

  if (isEmpty) {
    out.writeUint16LE(0x0000);
    out.writeUint16LE(0x0000);
  } else {
    out.writeUint16LE(0xffff);
    out.writeUint16LE(0x0000);
    writeVectorBlocks(out, prepared, bounds.minX, bounds.maxY, bounds.width, bounds.height);
  }

  out.patchUint32LE(pecOffsetField, out.length);
  writePecSection(out, prepared, originX, originY, bounds);
  return out.toUint8Array();
}
