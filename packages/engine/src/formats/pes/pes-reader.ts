import { EmbPattern } from '../../pattern/emb-pattern.js';
import { ByteReader } from '../common/byte-reader.js';
import { readPecSection } from './pec-reader.js';

/** "LA:" — the first three bytes of every PEC header. */
const PEC_MARKER = [0x4c, 0x41, 0x3a];

/**
 * Reads the PEC block out of a PES container, which is all the stitch data
 * there is — the `CEmbOne`/`CSewSeg` vector blocks are a redundant
 * representation for desktop editors and carry nothing the machine uses.
 */
export function readPes(data: Uint8Array): EmbPattern {
  const reader = new ByteReader(data);
  const signature = reader.readString(8);
  if (!signature.startsWith('#PES')) {
    throw new Error(`PES: expected a "#PES...." signature, found "${signature}"`);
  }

  const declaredOffset = reader.readUint32LE();
  let sectionStart = declaredOffset;
  if (declaredOffset < 12 || declaredOffset + 512 > data.length) {
    // Corrupt or unusual pointer: fall back to scanning for the PEC header.
    const found = reader.indexOf(PEC_MARKER, 12);
    if (found < 0) throw new Error('PES: no PEC block found');
    sectionStart = found;
  }

  const pattern = new EmbPattern();
  pattern.metadata.software = signature;
  reader.position = sectionStart;
  readPecSection(reader, pattern);
  return pattern;
}
