/**
 * A growable little/big-endian byte buffer.
 *
 * Embroidery formats are dense, fixed-layout binaries full of back-patched
 * length fields and offsets. Doing that against a raw `Uint8Array` invites
 * off-by-one bugs that only show up as a machine refusing a file, so all six
 * writers go through this one class.
 */
export class ByteWriter {
  private buffer: Uint8Array;
  private view: DataView;
  private offset = 0;

  constructor(initialCapacity = 4096) {
    this.buffer = new Uint8Array(Math.max(16, initialCapacity));
    this.view = new DataView(this.buffer.buffer);
  }

  /** Bytes written so far — also the offset the next write lands at. */
  get length(): number {
    return this.offset;
  }

  private ensure(extra: number): void {
    const required = this.offset + extra;
    if (required <= this.buffer.length) return;
    let capacity = this.buffer.length * 2;
    while (capacity < required) capacity *= 2;
    const grown = new Uint8Array(capacity);
    grown.set(this.buffer.subarray(0, this.offset));
    this.buffer = grown;
    this.view = new DataView(grown.buffer);
  }

  writeUint8(value: number): this {
    this.ensure(1);
    this.view.setUint8(this.offset, value & 0xff);
    this.offset += 1;
    return this;
  }

  writeInt8(value: number): this {
    return this.writeUint8(value & 0xff);
  }

  writeUint16LE(value: number): this {
    this.ensure(2);
    this.view.setUint16(this.offset, value & 0xffff, true);
    this.offset += 2;
    return this;
  }

  writeUint16BE(value: number): this {
    this.ensure(2);
    this.view.setUint16(this.offset, value & 0xffff, false);
    this.offset += 2;
    return this;
  }

  writeInt16LE(value: number): this {
    return this.writeUint16LE(value & 0xffff);
  }

  writeUint32LE(value: number): this {
    this.ensure(4);
    this.view.setUint32(this.offset, value >>> 0, true);
    this.offset += 4;
    return this;
  }

  writeUint32BE(value: number): this {
    this.ensure(4);
    this.view.setUint32(this.offset, value >>> 0, false);
    this.offset += 4;
    return this;
  }

  writeInt32LE(value: number): this {
    return this.writeUint32LE(value | 0);
  }

  writeInt32BE(value: number): this {
    return this.writeUint32BE(value | 0);
  }

  writeFloat32LE(value: number): this {
    this.ensure(4);
    this.view.setFloat32(this.offset, value, true);
    this.offset += 4;
    return this;
  }

  /** 24-bit little-endian — DST's stitch records and a few header fields. */
  writeUint24LE(value: number): this {
    this.writeUint8(value & 0xff);
    this.writeUint8((value >> 8) & 0xff);
    this.writeUint8((value >> 16) & 0xff);
    return this;
  }

  writeBytes(bytes: ArrayLike<number>): this {
    this.ensure(bytes.length);
    this.buffer.set(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes), this.offset);
    this.offset += bytes.length;
    return this;
  }

  /**
   * Writes a string one byte per character (Latin-1). Embroidery headers are
   * all ASCII; any character above U+00FF is replaced with `?` rather than
   * silently emitting a truncated code point.
   */
  writeString(text: string): this {
    this.ensure(text.length);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      this.buffer[this.offset + i] = code <= 0xff ? code : 0x3f;
    }
    this.offset += text.length;
    return this;
  }

  /** UTF-16LE, for the handful of fields that need it. */
  writeUtf16LEString(text: string): this {
    for (let i = 0; i < text.length; i++) this.writeUint16LE(text.charCodeAt(i));
    return this;
  }

  /** UTF-16BE — VP3's string encoding. */
  writeUtf16BEString(text: string): this {
    for (let i = 0; i < text.length; i++) this.writeUint16BE(text.charCodeAt(i));
    return this;
  }

  /** 24-bit big-endian — VP3 packs thread colours this way. */
  writeUint24BE(value: number): this {
    this.writeUint8((value >> 16) & 0xff);
    this.writeUint8((value >> 8) & 0xff);
    this.writeUint8(value & 0xff);
    return this;
  }

  /** Writes exactly `length` bytes, truncating or padding as needed. */
  writeStringPadded(text: string, length: number, padByte = 0x20): this {
    const clipped = text.length > length ? text.slice(0, length) : text;
    this.writeString(clipped);
    return this.fill(padByte, length - clipped.length);
  }

  fill(byte: number, count: number): this {
    if (count <= 0) return this;
    this.ensure(count);
    this.buffer.fill(byte & 0xff, this.offset, this.offset + count);
    this.offset += count;
    return this;
  }

  writeZeros(count: number): this {
    return this.fill(0, count);
  }

  /** Pads with `byte` until the length is a multiple of `alignment`. */
  align(alignment: number, byte = 0): this {
    const remainder = this.offset % alignment;
    return remainder === 0 ? this : this.fill(byte, alignment - remainder);
  }

  // --- back-patching, for the length and offset fields written before their
  // --- values are known.

  patchUint8(position: number, value: number): this {
    this.assertInBounds(position, 1);
    this.view.setUint8(position, value & 0xff);
    return this;
  }

  patchUint16LE(position: number, value: number): this {
    this.assertInBounds(position, 2);
    this.view.setUint16(position, value & 0xffff, true);
    return this;
  }

  patchUint32LE(position: number, value: number): this {
    this.assertInBounds(position, 4);
    this.view.setUint32(position, value >>> 0, true);
    return this;
  }

  patchUint32BE(position: number, value: number): this {
    this.assertInBounds(position, 4);
    this.view.setUint32(position, value >>> 0, false);
    return this;
  }

  patchUint24LE(position: number, value: number): this {
    this.assertInBounds(position, 3);
    this.view.setUint8(position, value & 0xff);
    this.view.setUint8(position + 1, (value >> 8) & 0xff);
    this.view.setUint8(position + 2, (value >> 16) & 0xff);
    return this;
  }

  private assertInBounds(position: number, size: number): void {
    if (position < 0 || position + size > this.offset) {
      throw new RangeError(
        `ByteWriter: cannot patch ${size} byte(s) at ${position}; only ${this.offset} written`,
      );
    }
  }

  /** A copy of everything written. The writer stays usable afterwards. */
  toUint8Array(): Uint8Array {
    return this.buffer.slice(0, this.offset);
  }
}
