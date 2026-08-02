import { describe, expect, it } from 'vitest';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import {
  ZipFormatError,
  crc32,
  listZipEntries,
  readZipEntry,
} from '../../src/package/zip.js';

/**
 * Fixture archives are assembled by hand, byte for byte, using the module's
 * own exported `crc32`. Reading a zip that a zip library wrote only proves the
 * two agree; writing the bytes here proves the reader against the *format*,
 * and makes the malformed cases — a lying CRC, an encrypted flag, a traversal
 * name — one field edit each. `node:zlib` appears here and only here: the
 * engine's own source stays free of it, taking inflate by injection.
 */

const encoder = new TextEncoder();
const inflate = (data: Uint8Array): Uint8Array => new Uint8Array(inflateRawSync(data));

function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

interface FixtureEntry {
  name: string;
  data: Uint8Array;
  /** 0 store, 8 deflate; anything else exercises `unsupported`. */
  method?: number;
  flags?: number;
  crcOverride?: number;
}

function buildZip(
  specs: FixtureEntry[],
  overrides: Partial<{ entryCount: number; comment: string }> = {},
): Uint8Array {
  const chunks: number[] = [];
  const central: number[] = [];
  for (const spec of specs) {
    const nameBytes = [...encoder.encode(spec.name)];
    const method = spec.method ?? 0;
    const stored = method === 8 ? [...deflateRawSync(spec.data)] : [...spec.data];
    const crc = spec.crcOverride ?? crc32(spec.data);
    const headerOffset = chunks.length;
    chunks.push(
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(spec.flags ?? 0),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(stored.length),
      ...u32(spec.data.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...nameBytes,
      ...stored,
    );
    central.push(
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(spec.flags ?? 0),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(stored.length),
      ...u32(spec.data.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(headerOffset),
      ...nameBytes,
    );
  }
  const directoryOffset = chunks.length;
  chunks.push(...central);
  const count = overrides.entryCount ?? specs.length;
  const commentBytes = [...encoder.encode(overrides.comment ?? '')];
  chunks.push(
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(count),
    ...u16(count),
    ...u32(central.length),
    ...u32(directoryOffset),
    ...u16(commentBytes.length),
    ...commentBytes,
  );
  return Uint8Array.from(chunks);
}

describe('crc32', () => {
  it('matches the published check value', () => {
    // The IEEE 802.3 test vector every implementation agrees on.
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('listZipEntries', () => {
  it('lists names, sizes and methods from the central directory', () => {
    const zip = buildZip([
      { name: 'fonts/Great.ttf', data: encoder.encode('glyphs') },
      { name: 'icons/', data: new Uint8Array(0) },
      { name: 'icons/owl.png', data: encoder.encode('not really a png'), method: 8 },
    ]);
    const entries = listZipEntries(zip);
    expect(entries.map((entry) => entry.name)).toEqual([
      'fonts/Great.ttf',
      'icons/',
      'icons/owl.png',
    ]);
    expect(entries[0].method).toBe('store');
    expect(entries[0].uncompressedSize).toBe(6);
    expect(entries[1].directory).toBe(true);
    expect(entries[2].method).toBe('deflate');
    expect(entries.every((entry) => !entry.encrypted && !entry.invalidPath)).toBe(true);
  });

  it('survives an archive comment after the end record', () => {
    const zip = buildZip([{ name: 'a.txt', data: encoder.encode('a') }], {
      comment: 'made with care',
    });
    expect(listZipEntries(zip)).toHaveLength(1);
  });

  it('decodes UTF-8 names', () => {
    const zip = buildZip([{ name: 'icons/日本語のアイコン.png', data: new Uint8Array(1) }]);
    expect(listZipEntries(zip)[0].name).toBe('icons/日本語のアイコン.png');
  });

  it('flags names that escape the archive, and normalises backslashes', () => {
    const zip = buildZip([
      { name: '../evil.ttf', data: new Uint8Array(1) },
      { name: '/absolute.ttf', data: new Uint8Array(1) },
      { name: 'C:autorun.inf', data: new Uint8Array(1) },
      { name: 'fonts\\nested\\Fine.otf', data: new Uint8Array(1) },
    ]);
    const entries = listZipEntries(zip);
    expect(entries[0].invalidPath).toBe(true);
    expect(entries[1].invalidPath).toBe(true);
    expect(entries[2].invalidPath).toBe(true);
    expect(entries[3].invalidPath).toBe(false);
    expect(entries[3].name).toBe('fonts/nested/Fine.otf');
  });

  it('marks encrypted entries', () => {
    const zip = buildZip([{ name: 'secret.ttf', data: encoder.encode('x'), flags: 0x0001 }]);
    expect(listZipEntries(zip)[0].encrypted).toBe(true);
  });

  it('refuses ZIP64 counts rather than misreading them', () => {
    const zip = buildZip([{ name: 'a.txt', data: encoder.encode('a') }], { entryCount: 0xffff });
    expect(() => listZipEntries(zip)).toThrow(ZipFormatError);
  });

  it('refuses bytes with no end record', () => {
    expect(() => listZipEntries(encoder.encode('this is not a zip archive at all......'))).toThrow(
      ZipFormatError,
    );
    expect(() => listZipEntries(new Uint8Array(4))).toThrow(ZipFormatError);
  });
});

describe('readZipEntry', () => {
  it('reads a stored entry back byte for byte', async () => {
    const data = encoder.encode('stored bytes');
    const zip = buildZip([{ name: 'a.bin', data }]);
    const [entry] = listZipEntries(zip);
    expect(await readZipEntry(zip, entry, inflate)).toEqual(data);
  });

  it('inflates a deflated entry', async () => {
    const data = encoder.encode('deflate me '.repeat(50));
    const zip = buildZip([{ name: 'b.bin', data, method: 8 }]);
    const [entry] = listZipEntries(zip);
    expect(await readZipEntry(zip, entry, inflate)).toEqual(data);
  });

  it('throws on a CRC mismatch instead of returning bad bytes', async () => {
    const zip = buildZip([
      { name: 'c.bin', data: encoder.encode('honest'), crcOverride: 0xdeadbeef },
    ]);
    const [entry] = listZipEntries(zip);
    await expect(readZipEntry(zip, entry, inflate)).rejects.toThrow(ZipFormatError);
  });

  it('refuses encrypted and unsupported-method entries', async () => {
    const zip = buildZip([
      { name: 'locked.ttf', data: encoder.encode('x'), flags: 0x0001 },
      { name: 'exotic.ttf', data: encoder.encode('x'), method: 99 },
    ]);
    const [locked, exotic] = listZipEntries(zip);
    await expect(readZipEntry(zip, locked, inflate)).rejects.toThrow(ZipFormatError);
    await expect(readZipEntry(zip, exotic, inflate)).rejects.toThrow(ZipFormatError);
  });
});
