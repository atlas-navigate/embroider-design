/**
 * Reading a zip archive without a zip dependency.
 *
 * Font and icon packages arrive as ordinary `.zip` files, and the engine's
 * promise is pure TypeScript with no native modules — so the container format
 * is parsed here, over plain bytes. The one thing a zip needs that bytes
 * cannot provide is *inflate*, and that is injected: the renderer hands in
 * Chromium's `DecompressionStream('deflate-raw')`, tests hand in
 * `node:zlib.inflateRawSync`, and this module stays runnable everywhere.
 *
 * Deliberately minimal: stored and deflated entries only, sizes and offsets
 * taken from the central directory (so streaming data descriptors never
 * matter), CRC verified on every read. ZIP64, split archives and encryption
 * are refused with a `ZipFormatError` — a package that needs any of them is
 * beyond what this feature promises to install.
 */

export class ZipFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipFormatError';
  }
}

/** Inflates a raw deflate stream. Injected, because the engine has no zlib. */
export type ZipInflate = (data: Uint8Array) => Uint8Array | Promise<Uint8Array>;

export interface ZipEntryInfo {
  /** Entry name with backslashes normalised to forward slashes. */
  name: string;
  directory: boolean;
  method: 'store' | 'deflate' | 'unsupported';
  encrypted: boolean;
  compressedSize: number;
  uncompressedSize: number;
  /** CRC-32 of the uncompressed data, as the central directory declares it. */
  crc32: number;
  /** Where the entry's local header starts, for `readZipEntry`. */
  headerOffset: number;
  /**
   * Absolute, drive-lettered, or `..`-containing names. A well-formed package
   * never has one; never write such an entry anywhere.
   */
  invalidPath: boolean;
}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

/** Traditional (bit 0) or strong (bit 6) encryption. */
const FLAG_ENCRYPTED = 0x0041;

const EOCD_SIZE = 22;
const MAX_COMMENT = 0xffff;

let CRC_TABLE: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  CRC_TABLE = table;
  return table;
}

/** CRC-32, exported so tests can assemble valid fixture archives by hand. */
export function crc32(data: Uint8Array): number {
  const table = crcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function isInvalidPath(name: string): boolean {
  if (name.length === 0) return true;
  if (name.startsWith('/')) return true;
  if (/^[a-zA-Z]:/.test(name)) return true;
  return name.split('/').some((segment) => segment === '..');
}

/**
 * Lists an archive's entries from its central directory.
 *
 * The central directory is the authority — it is what every zip tool writes
 * last and reads first — so sizes, offsets and CRCs all come from here rather
 * than from the per-entry local headers, which streaming writers leave zeroed.
 */
export function listZipEntries(bytes: Uint8Array): ZipEntryInfo[] {
  if (bytes.length < EOCD_SIZE) throw new ZipFormatError('Too short to be a zip archive.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // The end-of-central-directory record sits at the very end, before nothing
  // but its own variable-length comment. Scan backwards for its signature.
  let eocd = -1;
  const stop = Math.max(0, bytes.length - EOCD_SIZE - MAX_COMMENT);
  for (let at = bytes.length - EOCD_SIZE; at >= stop; at--) {
    if (view.getUint32(at, true) === SIG_EOCD) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) throw new ZipFormatError('No end-of-central-directory record found.');

  const diskEntries = view.getUint16(eocd + 8, true);
  const totalEntries = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (totalEntries === 0xffff || directoryOffset === 0xffffffff || directorySize === 0xffffffff) {
    throw new ZipFormatError('ZIP64 archives are not supported.');
  }
  if (diskEntries !== totalEntries) {
    throw new ZipFormatError('Split archives are not supported.');
  }
  if (directoryOffset + directorySize > bytes.length) {
    throw new ZipFormatError('Central directory runs past the end of the file.');
  }

  // UTF-8 whether or not the entry sets the UTF-8 flag: modern tools write
  // UTF-8 regardless, and a mis-decoded legacy CP437 name still lists — it
  // just looks odd, which beats refusing the archive.
  const decoder = new TextDecoder('utf-8');
  const entries: ZipEntryInfo[] = [];
  let at = directoryOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== SIG_CENTRAL) {
      throw new ZipFormatError('Malformed central directory.');
    }
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const compressedSize = view.getUint32(at + 20, true);
    const uncompressedSize = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const headerOffset = view.getUint32(at + 42, true);
    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      headerOffset === 0xffffffff
    ) {
      throw new ZipFormatError('ZIP64 archives are not supported.');
    }
    if (at + 46 + nameLength > bytes.length) {
      throw new ZipFormatError('Malformed central directory.');
    }

    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)).replace(/\\/g, '/');
    entries.push({
      name,
      directory: name.endsWith('/'),
      method: method === 0 ? 'store' : method === 8 ? 'deflate' : 'unsupported',
      encrypted: (flags & FLAG_ENCRYPTED) !== 0,
      compressedSize,
      uncompressedSize,
      crc32: crc,
      headerOffset,
      invalidPath: isInvalidPath(name),
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * Reads and verifies one entry's bytes.
 *
 * The local header is consulted only for where the data starts — its name and
 * extra fields can be sized differently from the central directory's copy.
 * Whatever comes out must match the declared length *and* the declared CRC;
 * a mismatch means the archive lies about itself, and a package that lies is
 * refused rather than half-installed.
 */
export async function readZipEntry(
  bytes: Uint8Array,
  entry: ZipEntryInfo,
  inflate: ZipInflate,
): Promise<Uint8Array> {
  if (entry.encrypted) throw new ZipFormatError(`"${entry.name}" is encrypted.`);
  if (entry.method === 'unsupported') {
    throw new ZipFormatError(`"${entry.name}" uses an unsupported compression method.`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    entry.headerOffset + 30 > bytes.length ||
    view.getUint32(entry.headerOffset, true) !== SIG_LOCAL
  ) {
    throw new ZipFormatError(`"${entry.name}" has no local header where the directory says.`);
  }
  const nameLength = view.getUint16(entry.headerOffset + 26, true);
  const extraLength = view.getUint16(entry.headerOffset + 28, true);
  const start = entry.headerOffset + 30 + nameLength + extraLength;
  if (start + entry.compressedSize > bytes.length) {
    throw new ZipFormatError(`"${entry.name}" runs past the end of the archive.`);
  }
  const raw = bytes.subarray(start, start + entry.compressedSize);

  const data = entry.method === 'store' ? raw : await inflate(raw);
  if (data.length !== entry.uncompressedSize) {
    throw new ZipFormatError(`"${entry.name}" did not inflate to its declared size.`);
  }
  if (crc32(data) !== entry.crc32) {
    throw new ZipFormatError(`"${entry.name}" is corrupt (CRC mismatch).`);
  }
  return data;
}
