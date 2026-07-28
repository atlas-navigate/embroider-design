import type { EmbPattern } from '../pattern/emb-pattern.js';
import type { EmbroideryFormat, FormatId, WriteOptions } from './common/format-types.js';
import { readDst } from './dst/dst-reader.js';
import { DST_MAX_JUMP, DST_MAX_STITCH, writeDst } from './dst/dst-writer.js';
import { readExp } from './exp/exp-reader.js';
import { EXP_MAX_JUMP, EXP_MAX_STITCH, writeExp } from './exp/exp-writer.js';
import { readJef } from './jef/jef-reader.js';
import { JEF_MAX_JUMP, JEF_MAX_STITCH, writeJef } from './jef/jef-writer.js';
import { readPec } from './pes/pec-reader.js';
import { readPes } from './pes/pes-reader.js';
import { PES_MAX_JUMP, PES_MAX_STITCH, writePes } from './pes/pes-writer.js';
import { readVp3 } from './vp3/vp3-reader.js';
import { VP3_MAX_JUMP, VP3_MAX_STITCH, writeVp3 } from './vp3/vp3-writer.js';
import { readXxx } from './xxx/xxx-reader.js';
import { XXX_MAX_JUMP, XXX_MAX_STITCH, writeXxx } from './xxx/xxx-writer.js';

export const PES_FORMAT: EmbroideryFormat = {
  id: 'pes',
  name: 'Brother PES',
  extension: '.pes',
  description: 'Brother / Babylock / Bernina. The format the PE900 reads.',
  storesColor: true,
  hasTrimCommand: true,
  maxStitchDistance: PES_MAX_STITCH,
  maxJumpDistance: PES_MAX_JUMP,
  write: writePes,
  read: readPes,
};

export const DST_FORMAT: EmbroideryFormat = {
  id: 'dst',
  name: 'Tajima DST',
  extension: '.dst',
  description: 'The universal interchange format. Stitches only — no colours.',
  storesColor: false,
  hasTrimCommand: false,
  maxStitchDistance: DST_MAX_STITCH,
  maxJumpDistance: DST_MAX_JUMP,
  write: writeDst,
  read: readDst,
};

export const EXP_FORMAT: EmbroideryFormat = {
  id: 'exp',
  name: 'Melco EXP',
  extension: '.exp',
  description: 'Melco / Bernina. Raw stitch stream with no header.',
  storesColor: false,
  hasTrimCommand: true,
  maxStitchDistance: EXP_MAX_STITCH,
  maxJumpDistance: EXP_MAX_JUMP,
  write: writeExp,
  read: readExp,
};

export const JEF_FORMAT: EmbroideryFormat = {
  id: 'jef',
  name: 'Janome JEF',
  extension: '.jef',
  description: 'Janome / Elna / Kenmore. Colours reference the machine chart.',
  storesColor: true,
  hasTrimCommand: false,
  maxStitchDistance: JEF_MAX_STITCH,
  maxJumpDistance: JEF_MAX_JUMP,
  write: writeJef,
  read: readJef,
};

export const VP3_FORMAT: EmbroideryFormat = {
  id: 'vp3',
  name: 'Pfaff VP3',
  extension: '.vp3',
  description: 'Pfaff / Husqvarna Viking. Stores full RGB thread information.',
  storesColor: true,
  hasTrimCommand: true,
  maxStitchDistance: VP3_MAX_STITCH,
  maxJumpDistance: VP3_MAX_JUMP,
  write: writeVp3,
  read: readVp3,
};

export const XXX_FORMAT: EmbroideryFormat = {
  id: 'xxx',
  name: 'Singer XXX',
  extension: '.xxx',
  description: 'Singer. Stores full RGB thread information.',
  storesColor: true,
  hasTrimCommand: true,
  maxStitchDistance: XXX_MAX_STITCH,
  maxJumpDistance: XXX_MAX_JUMP,
  write: writeXxx,
  read: readXxx,
};

/** Ordered for presentation: the PE900's format first, then by ubiquity. */
export const FORMATS: readonly EmbroideryFormat[] = Object.freeze([
  PES_FORMAT,
  DST_FORMAT,
  EXP_FORMAT,
  JEF_FORMAT,
  VP3_FORMAT,
  XXX_FORMAT,
]);

const BY_ID = new Map<FormatId, EmbroideryFormat>(FORMATS.map((format) => [format.id, format]));

export function getFormat(id: FormatId): EmbroideryFormat {
  const format = BY_ID.get(id);
  if (!format) throw new Error(`Unknown embroidery format "${id}"`);
  return format;
}

/** Matches on a filename, a path, or a bare extension with or without the dot. */
export function formatForExtension(nameOrExtension: string): EmbroideryFormat | null {
  const lower = nameOrExtension.toLowerCase();
  const dot = lower.lastIndexOf('.');
  const extension = dot >= 0 ? lower.slice(dot) : `.${lower}`;
  return FORMATS.find((format) => format.extension === extension) ?? null;
}

export function writePattern(
  pattern: EmbPattern,
  id: FormatId,
  options: WriteOptions = {},
): Uint8Array {
  return getFormat(id).write(pattern, options);
}

function startsWith(data: Uint8Array, text: string): boolean {
  if (data.length < text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (data[i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Sniffs the format from the file's own bytes.
 *
 * EXP has no signature at all, so it is deliberately *not* guessed here —
 * returning it as a catch-all would mean every unrecognised file silently
 * decodes into stitch soup instead of failing.
 */
export function detectFormat(data: Uint8Array): FormatId | null {
  if (startsWith(data, '#PES')) return 'pes';
  if (startsWith(data, '%vsm%')) return 'vp3';
  if (startsWith(data, 'LA:')) return 'dst';

  if (data.length >= 0x100) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    // JEF: a header-size pointer of 0x74 + colours*8, then the constant 0x14.
    const offset = view.getUint32(0, true);
    if (view.getUint32(4, true) === 0x14 && offset >= 0x74 && (offset - 0x74) % 8 === 0) {
      return 'jef';
    }
    // XXX opens with 23 reserved zero bytes.
    let leadingZeros = true;
    for (let i = 0; i < 0x17; i++) {
      if (data[i] !== 0) {
        leadingZeros = false;
        break;
      }
    }
    if (leadingZeros) return 'xxx';
  }
  return null;
}

/**
 * Reads a file, using `id` when given and sniffing otherwise. Standalone PEC
 * files are handled here rather than in the registry, since they are the PES
 * payload without its container rather than a format users choose to export.
 */
export function readPattern(data: Uint8Array, id?: FormatId): EmbPattern {
  if (id) return getFormat(id).read(data);
  if (startsWith(data, '#PEC')) return readPec(data);
  const detected = detectFormat(data);
  if (!detected) {
    throw new Error(
      'Could not identify this embroidery file. Choose the format explicitly if you know it.',
    );
  }
  return getFormat(detected).read(data);
}
