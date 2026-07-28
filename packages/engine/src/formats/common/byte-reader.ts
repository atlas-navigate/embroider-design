/**
 * Bounds-checked sequential reader. Readers exist mainly so the round-trip
 * tests can verify what the writers produced, but they also let the app open
 * an existing design file.
 */
export class ByteReader {
  private readonly view: DataView;
  private offset = 0;

  constructor(private readonly data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  get position(): number {
    return this.offset;
  }

  set position(value: number) {
    if (value < 0 || value > this.data.length) {
      throw new RangeError(`ByteReader: position ${value} outside 0..${this.data.length}`);
    }
    this.offset = value;
  }

  get length(): number {
    return this.data.length;
  }

  get remaining(): number {
    return this.data.length - this.offset;
  }

  hasMore(count = 1): boolean {
    return this.remaining >= count;
  }

  private require(count: number): void {
    if (this.remaining < count) {
      throw new RangeError(
        `ByteReader: needed ${count} byte(s) at ${this.offset}, only ${this.remaining} remain`,
      );
    }
  }

  skip(count: number): this {
    this.require(count);
    this.offset += count;
    return this;
  }

  peekUint8(ahead = 0): number {
    this.require(ahead + 1);
    return this.view.getUint8(this.offset + ahead);
  }

  readUint8(): number {
    this.require(1);
    return this.view.getUint8(this.offset++);
  }

  readInt8(): number {
    this.require(1);
    return this.view.getInt8(this.offset++);
  }

  readUint16LE(): number {
    this.require(2);
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readUint16BE(): number {
    this.require(2);
    const value = this.view.getUint16(this.offset, false);
    this.offset += 2;
    return value;
  }

  readInt16LE(): number {
    this.require(2);
    const value = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readInt16BE(): number {
    this.require(2);
    const value = this.view.getInt16(this.offset, false);
    this.offset += 2;
    return value;
  }

  readUint24LE(): number {
    return this.readUint8() | (this.readUint8() << 8) | (this.readUint8() << 16);
  }

  readUint24BE(): number {
    return (this.readUint8() << 16) | (this.readUint8() << 8) | this.readUint8();
  }

  readInt32BE(): number {
    this.require(4);
    const value = this.view.getInt32(this.offset, false);
    this.offset += 4;
    return value;
  }

  readUint32LE(): number {
    this.require(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readUint32BE(): number {
    this.require(4);
    const value = this.view.getUint32(this.offset, false);
    this.offset += 4;
    return value;
  }

  readInt32LE(): number {
    this.require(4);
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readBytes(count: number): Uint8Array {
    this.require(count);
    const slice = this.data.slice(this.offset, this.offset + count);
    this.offset += count;
    return slice;
  }

  /** Latin-1 decode of `count` bytes. */
  readString(count: number): string {
    const bytes = this.readBytes(count);
    let text = '';
    for (const byte of bytes) text += String.fromCharCode(byte);
    return text;
  }

  /** Latin-1 decode with trailing NULs and spaces stripped. */
  readTrimmedString(count: number): string {
    return this.readString(count).replace(/[\0\s]+$/, '');
  }

  readNullTerminatedString(maxLength = Infinity): string {
    let text = '';
    while (this.hasMore() && text.length < maxLength) {
      const byte = this.readUint8();
      if (byte === 0) break;
      text += String.fromCharCode(byte);
    }
    return text;
  }

  /** Finds `needle` at or after `from`, or -1. Used to locate format markers. */
  indexOf(needle: ArrayLike<number>, from = 0): number {
    outer: for (let i = from; i + needle.length <= this.data.length; i++) {
      for (let k = 0; k < needle.length; k++) {
        if (this.data[i + k] !== needle[k]) continue outer;
      }
      return i;
    }
    return -1;
  }
}
