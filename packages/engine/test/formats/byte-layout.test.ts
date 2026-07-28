import { describe, expect, it } from 'vitest';
import { EmbPattern } from '../../src/pattern/emb-pattern.js';
import { finishPattern } from '../../src/pattern/pattern-builder.js';
import { StitchCommand } from '../../src/pattern/stitch.js';
import { thread } from '../../src/pattern/thread.js';
import {
  decodeDstCoordinates,
  DST_HEADER_SIZE,
  DST_MAX_STITCH,
  encodeDstRecord,
  writeDst,
} from '../../src/formats/dst/dst-writer.js';
import { writePes } from '../../src/formats/pes/pes-writer.js';
import { PEC_HEADER_SIZE } from '../../src/formats/pes/pec-writer.js';
import { PEC_ICON_BYTES, blankIcon } from '../../src/formats/pes/pec-graphics.js';
import { writeXxx, XXX_HEADER_SIZE } from '../../src/formats/xxx/xxx-writer.js';
import { writeJef, JEF_HEADER_SIZE, jefHoopSize } from '../../src/formats/jef/jef-writer.js';
import { writeExp } from '../../src/formats/exp/exp-writer.js';
import { FORMATS, getFormat } from '../../src/formats/format-registry.js';
import type { FormatId } from '../../src/formats/common/format-types.js';

function ascii(data: Uint8Array, offset: number, length: number): string {
  let text = '';
  for (let i = 0; i < length; i++) text += String.fromCharCode(data[offset + i]);
  return text;
}

function twoStitchPattern(): EmbPattern {
  const pattern = new EmbPattern();
  pattern.addThread(thread(0, 0, 0));
  pattern.stitchTo(0, 0).stitchTo(30, 0);
  return finishPattern(pattern);
}

describe('DST ternary encoding', () => {
  it('round-trips every representable delta', () => {
    for (let dx = -DST_MAX_STITCH; dx <= DST_MAX_STITCH; dx++) {
      for (let dy = -DST_MAX_STITCH; dy <= DST_MAX_STITCH; dy += 7) {
        const [b0, b1, b2] = encodeDstRecord(dx, dy, false);
        expect(decodeDstCoordinates(b0, b1, b2)).toEqual({ dx, dy });
      }
    }
  });

  it('never sets the control bit on a coordinate record', () => {
    for (let dx = -DST_MAX_STITCH; dx <= DST_MAX_STITCH; dx += 3) {
      for (const jump of [false, true]) {
        const [, , b2] = encodeDstRecord(dx, -dx, jump);
        expect(b2 & 0b01000000).toBe(0);
      }
    }
  });

  it('marks jumps with bit 7', () => {
    expect(encodeDstRecord(10, 10, true)[2] & 0b10000000).toBe(0b10000000);
    expect(encodeDstRecord(10, 10, false)[2] & 0b10000000).toBe(0);
  });

  it('refuses a delta the record cannot hold', () => {
    expect(() => encodeDstRecord(122, 0, false)).toThrow(/exceeds/);
    expect(() => encodeDstRecord(0, -122, false)).toThrow(/exceeds/);
  });
});

describe('DST file layout', () => {
  const data = writeDst(twoStitchPattern());

  it('writes a 512-byte header ending in the 0x1A marker', () => {
    expect(ascii(data, 0, 3)).toBe('LA:');
    const markerIndex = data.indexOf(0x1a);
    expect(markerIndex).toBeGreaterThan(0);
    expect(markerIndex).toBeLessThan(DST_HEADER_SIZE);
    for (let i = markerIndex + 1; i < DST_HEADER_SIZE; i++) expect(data[i]).toBe(0x20);
  });

  it('reports the extents it actually wrote', () => {
    const header = ascii(data, 0, DST_HEADER_SIZE);
    expect(header).toContain('LA:Untitled        \r');
    expect(header).toContain('ST:      2\r');
    expect(header).toContain('CO:  0\r');
    expect(header).toContain('+X:   15\r');
    expect(header).toContain('-X:   15\r');
    expect(header).toContain('AX:+   15\r');
  });

  it('matches a hand-verified byte sequence for two stitches', () => {
    // Centred on the origin, the stitches sit at -15 and +15 on X.
    // -15 = -27 + 9 + 3 -> b1 bit3 | b0 bit2 | b1 bit0; +30 = 27 + 3 -> b1 bit2 | b1 bit0.
    expect(data.length).toBe(DST_HEADER_SIZE + 9);
    expect([...data.slice(DST_HEADER_SIZE)]).toEqual([
      0x04, 0x09, 0x03, // stitch to -15, 0
      0x00, 0x05, 0x03, // stitch to +15, 0
      0x00, 0x00, 0xf3, // end
    ]);
  });

  it('keeps the body an exact multiple of the 3-byte record size', () => {
    expect((data.length - DST_HEADER_SIZE) % 3).toBe(0);
  });
});

describe('PES container layout', () => {
  const pattern = new EmbPattern();
  pattern.addThread(thread(237, 23, 31));
  for (let i = 0; i <= 20; i++) pattern.stitchTo(i * 20, (i % 2) * 40);
  pattern.colorChange().addThread(thread(10, 85, 163));
  for (let i = 0; i <= 20; i++) pattern.stitchTo(400 + i * 20, 200 + (i % 2) * 40);
  finishPattern(pattern);

  const data = writePes(pattern);

  it('starts with the version 1 signature', () => {
    expect(ascii(data, 0, 8)).toBe('#PES0001');
  });

  it('points at a real PEC block', () => {
    const pecStart = new DataView(data.buffer, data.byteOffset).getUint32(8, true);
    expect(pecStart).toBeGreaterThan(12);
    expect(pecStart + PEC_HEADER_SIZE).toBeLessThan(data.length);
    expect(ascii(data, pecStart, 3)).toBe('LA:');
  });

  it('accounts for every byte: header, stitch block, and one thumbnail per colour', () => {
    const view = new DataView(data.buffer, data.byteOffset);
    const pecStart = view.getUint32(8, true);
    const colorCount = data[pecStart + 48] + 1;
    expect(colorCount).toBe(2);

    const stitchBlockLength =
      data[pecStart + 514] | (data[pecStart + 515] << 8) | (data[pecStart + 516] << 16);
    const endOfStitches = pecStart + PEC_HEADER_SIZE + stitchBlockLength;
    // One combined thumbnail plus one per colour block.
    expect(data.length).toBe(endOfStitches + (colorCount + 1) * PEC_ICON_BYTES);
  });

  it('places the fixed stitch-block signature bytes', () => {
    const pecStart = new DataView(data.buffer, data.byteOffset).getUint32(8, true);
    expect([...data.slice(pecStart + 517, pecStart + 520)]).toEqual([0x31, 0xff, 0xf0]);
    const view = new DataView(data.buffer, data.byteOffset);
    expect(view.getUint16(pecStart + 524, true)).toBe(0x01e0);
    expect(view.getUint16(pecStart + 526, true)).toBe(0x01b0);
  });

  it('terminates the stitch stream with 0xFF', () => {
    const view = new DataView(data.buffer, data.byteOffset);
    const pecStart = view.getUint32(8, true);
    const stitchBlockLength =
      data[pecStart + 514] | (data[pecStart + 515] << 8) | (data[pecStart + 516] << 16);
    expect(data[pecStart + PEC_HEADER_SIZE + stitchBlockLength - 1]).toBe(0xff);
  });

  it('writes a smaller file in truncated mode, with the PEC block at offset 22', () => {
    const truncated = writePes(pattern, { truncated: true });
    expect(truncated.length).toBeLessThan(data.length);
    expect(new DataView(truncated.buffer, truncated.byteOffset).getUint32(8, true)).toBe(0x16);
    expect(ascii(truncated, 22, 3)).toBe('LA:');
  });
});

describe('PEC thumbnails', () => {
  it('is exactly 48 x 38 bits with a drawn frame', () => {
    const icon = blankIcon();
    expect(icon).toHaveLength(PEC_ICON_BYTES);
    expect([...icon.slice(0, 6)]).toEqual([0, 0, 0, 0, 0, 0]);
    expect([...icon.slice(6, 12)]).toEqual([0xf0, 0xff, 0xff, 0xff, 0xff, 0x0f]);
    expect([...icon.slice(PEC_ICON_BYTES - 6)]).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('XXX file layout', () => {
  const data = writeXxx(twoStitchPattern());

  it('reserves exactly 256 bytes of header', () => {
    for (let i = 0; i < 0x17; i++) expect(data[i]).toBe(0);
    expect(data.length).toBeGreaterThan(XXX_HEADER_SIZE);
  });

  it('back-patches the end-of-stitches pointer to a real offset', () => {
    const view = new DataView(data.buffer, data.byteOffset);
    const endOfStitches = view.getUint32(0xfc, true);
    expect(endOfStitches).toBeGreaterThan(XXX_HEADER_SIZE);
    expect(endOfStitches).toBeLessThan(data.length);
    expect([...data.slice(endOfStitches, endOfStitches + 4)]).toEqual([0x7f, 0x7f, 0x02, 0x14]);
  });
});

describe('JEF file layout', () => {
  const data = writeJef(twoStitchPattern(), { date: '20260101120000' });

  it('points past a header plus eight bytes per colour', () => {
    const view = new DataView(data.buffer, data.byteOffset);
    const offset = view.getUint32(0, true);
    expect(view.getUint32(4, true)).toBe(0x14);
    expect(offset).toBe(JEF_HEADER_SIZE + view.getUint32(24, true) * 8);
    expect(ascii(data, 8, 14)).toBe('20260101120000');
  });

  it('declares a point count matching the bytes after the header', () => {
    const view = new DataView(data.buffer, data.byteOffset);
    const offset = view.getUint32(0, true);
    expect(view.getUint32(28, true)).toBe((data.length - offset) / 2);
  });

  it('terminates with the 0x80 0x10 marker', () => {
    expect([...data.slice(-2)]).toEqual([0x80, 0x10]);
  });

  it('picks the smallest hoop that fits', () => {
    expect(jefHoopSize(400, 400)).toBe(1); // 50 x 50
    expect(jefHoopSize(1200, 1000)).toBe(3); // 126 x 110
    expect(jefHoopSize(1350, 1900)).toBe(2); // 140 x 200
    expect(jefHoopSize(1900, 1900)).toBe(4); // 200 x 200
  });
});

describe('EXP escape safety', () => {
  it('never emits 0x80 as a coordinate byte', () => {
    // A long diagonal exercises the widest deltas the splitter will produce.
    const pattern = new EmbPattern();
    pattern.addThread(thread(0, 0, 0));
    pattern.stitchTo(0, 0).stitchTo(2000, -2000).stitchTo(-2000, 2000);
    finishPattern(pattern);

    const data = writeExp(pattern);
    let index = 0;
    while (index < data.length) {
      if (data[index] === 0x80) {
        index += 4; // Escape sequences are always four bytes.
        continue;
      }
      // Both coordinate bytes of a plain stitch must stay clear of the escape.
      expect(data[index]).not.toBe(0x80);
      expect(data[index + 1]).not.toBe(0x80);
      index += 2;
    }
  });
});

describe('long move splitting', () => {
  it.each(FORMATS.map((format) => format.id))(
    '%s spans a very long move without losing the endpoints',
    (id: FormatId) => {
      // A 150 mm diagonal is far past every format's per-record limit, so the
      // splitter has to break it up and still land exactly on the target.
      const pattern = new EmbPattern();
      pattern.addThread(thread(0, 0, 0));
      pattern.stitchTo(0, 0).stitchTo(1500, 900).stitchTo(1500, 905);
      finishPattern(pattern);

      const format = getFormat(id);
      const readBack = format.read(format.write(pattern));
      const sewn = readBack.stitches.filter((s) => s.command === StitchCommand.STITCH);
      expect(sewn.length).toBeGreaterThanOrEqual(3);

      const xs = sewn.map((s) => s.x);
      const ys = sewn.map((s) => s.y);
      expect(Math.abs(Math.max(...xs) - Math.min(...xs) - 1500)).toBeLessThanOrEqual(2);
      expect(Math.abs(Math.max(...ys) - Math.min(...ys) - 905)).toBeLessThanOrEqual(2);

      // The design is centred on export, so the final stitch is the far corner.
      const last = sewn[sewn.length - 1];
      expect(Math.abs(last.x - 750)).toBeLessThanOrEqual(2);
      expect(Math.abs(last.y - 452.5)).toBeLessThanOrEqual(2);
    },
  );

  it('splits an origin-to-first-stitch run rather than emitting one giant stitch', () => {
    const pattern = new EmbPattern();
    pattern.addThread(thread(0, 0, 0));
    pattern.stitchTo(0, 0).stitchTo(1500, 0);
    finishPattern(pattern);

    const readBack = getFormat('dst').read(writeDst(pattern));
    const sewn = readBack.stitches.filter((s) => s.command === StitchCommand.STITCH);
    for (let i = 1; i < sewn.length; i++) {
      expect(Math.abs(sewn[i].x - sewn[i - 1].x)).toBeLessThanOrEqual(DST_MAX_STITCH);
    }
  });
});
