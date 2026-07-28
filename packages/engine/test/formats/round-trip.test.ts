import { describe, expect, it } from 'vitest';
import type { Point } from '../../src/geometry/point.js';
import { EmbPattern } from '../../src/pattern/emb-pattern.js';
import { beginColorBlock, finishPattern } from '../../src/pattern/pattern-builder.js';
import { StitchCommand } from '../../src/pattern/stitch.js';
import { thread } from '../../src/pattern/thread.js';
import { appendStitchPath } from '../../src/pattern/pattern-builder.js';
import {
  detectFormat,
  formatForExtension,
  FORMATS,
  getFormat,
  readPattern,
  writePattern,
} from '../../src/formats/format-registry.js';
import type { FormatId } from '../../src/formats/common/format-types.js';

function squarePath(x: number, y: number, size: number, spacing: number): Point[] {
  const corners: Point[] = [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
    { x, y },
  ];
  const points: Point[] = [{ ...corners[0] }];
  for (let i = 1; i < corners.length; i++) {
    const from = corners[i - 1];
    const to = corners[i];
    const steps = Math.round(Math.hypot(to.x - from.x, to.y - from.y) / spacing);
    for (let k = 1; k <= steps; k++) {
      points.push({
        x: from.x + ((to.x - from.x) * k) / steps,
        y: from.y + ((to.y - from.y) * k) / steps,
      });
    }
  }
  return points;
}

/** Two separated squares in two colours: exercises stitches, travel, trims and a colour change. */
function fixturePattern(): EmbPattern {
  const pattern = new EmbPattern();
  pattern.metadata.name = 'RoundTrip';
  beginColorBlock(pattern, thread(237, 23, 31, 'Red'));
  appendStitchPath(pattern, squarePath(0, 0, 200, 20));
  beginColorBlock(pattern, thread(10, 85, 163, 'Blue'));
  appendStitchPath(pattern, squarePath(400, 300, 160, 20));
  finishPattern(pattern);
  return pattern;
}

function sewnPositions(pattern: EmbPattern): Point[] {
  return pattern.stitches
    .filter((stitch) => stitch.command === StitchCommand.STITCH)
    .map((stitch) => ({ x: stitch.x, y: stitch.y }));
}

/** Writers centre the design on the machine origin, so the expectation must too. */
function expectedPositions(pattern: EmbPattern): Point[] {
  const copy = pattern.clone();
  copy.normalize();
  const bounds = copy.getBounds();
  copy.translate(-bounds.centerX, -bounds.centerY);
  return sewnPositions(copy);
}

function expectPositionsClose(actual: Point[], expected: Point[], tolerance: number): void {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(Math.abs(actual[i].x - expected[i].x)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(actual[i].y - expected[i].y)).toBeLessThanOrEqual(tolerance);
  }
}

describe.each(FORMATS.map((format) => [format.id, format] as const))(
  '%s round trip',
  (id, format) => {
    const original = fixturePattern();
    const bytes = format.write(original);

    it('produces a non-empty file', () => {
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('reads back every sewn stitch in the right place', () => {
      const readBack = format.read(bytes);
      readBack.normalize();
      // VP3 truncates block start positions to whole units before scaling.
      expectPositionsClose(sewnPositions(readBack), expectedPositions(original), id === 'vp3' ? 2 : 1);
    });

    it('preserves the colour block structure', () => {
      const readBack = format.read(bytes);
      readBack.normalize();
      expect(readBack.getColorBlockCount()).toBe(2);
    });

    it('always terminates with a single END', () => {
      const readBack = format.read(bytes);
      const last = readBack.stitches[readBack.stitches.length - 1];
      expect(last.command).toBe(StitchCommand.END);
      expect(readBack.countCommand(StitchCommand.END)).toBe(1);
    });

    it('is stable across a second write/read cycle', () => {
      const first = format.read(bytes);
      const second = format.read(format.write(first));
      first.normalize();
      second.normalize();
      expectPositionsClose(sewnPositions(second), sewnPositions(first), id === 'vp3' ? 2 : 1);
    });

    it('handles an empty pattern without throwing', () => {
      expect(() => format.write(new EmbPattern())).not.toThrow();
    });

    it('handles a single-stitch pattern', () => {
      const tiny = new EmbPattern();
      tiny.addThread(thread(0, 0, 0));
      tiny.stitchTo(0, 0).stitchTo(50, 50);
      finishPattern(tiny);
      const roundTripped = format.read(format.write(tiny));
      expect(sewnPositions(roundTripped).length).toBeGreaterThanOrEqual(2);
    });
  },
);

describe('formats that store real colours', () => {
  it('VP3 and XXX preserve exact RGB', () => {
    const original = fixturePattern();
    for (const id of ['vp3', 'xxx'] as FormatId[]) {
      const format = getFormat(id);
      const readBack = format.read(format.write(original));
      expect(readBack.threads.length).toBeGreaterThanOrEqual(2);
      expect(readBack.threads[0]).toMatchObject({ r: 237, g: 23, b: 31 });
      expect(readBack.threads[1]).toMatchObject({ r: 10, g: 85, b: 163 });
    }
  });

  it('PES maps colours onto distinct Brother chart entries', () => {
    const original = fixturePattern();
    const readBack = getFormat('pes').read(writePattern(original, 'pes'));
    expect(readBack.threads).toHaveLength(2);
    // Chart entry 5 is "Red" (237, 23, 31) and entry 2 is "Blue" (10, 85, 163).
    expect(readBack.threads[0].description).toBe('Red');
    expect(readBack.threads[1].description).toBe('Blue');
  });

  it('JEF maps colours onto distinct Janome chart entries', () => {
    const original = fixturePattern();
    const readBack = getFormat('jef').read(writePattern(original, 'jef'));
    expect(readBack.threads).toHaveLength(2);
    expect(readBack.threads[0].description).not.toBe(readBack.threads[1].description);
  });

  it('never collapses two similar colours onto one Brother chart slot', () => {
    const pattern = new EmbPattern();
    beginColorBlock(pattern, thread(250, 0, 0, 'Red A'));
    appendStitchPath(pattern, squarePath(0, 0, 100, 20));
    beginColorBlock(pattern, thread(245, 5, 5, 'Red B'));
    appendStitchPath(pattern, squarePath(300, 0, 100, 20));
    finishPattern(pattern);

    const readBack = getFormat('pes').read(writePattern(pattern, 'pes'));
    expect(readBack.threads).toHaveLength(2);
    expect(readBack.threads[0].catalogNumber).not.toBe(readBack.threads[1].catalogNumber);
  });
});

describe('format detection', () => {
  it('identifies every signed format from its own bytes', () => {
    const original = fixturePattern();
    for (const id of ['pes', 'dst', 'jef', 'vp3', 'xxx'] as FormatId[]) {
      expect(detectFormat(writePattern(original, id))).toBe(id);
    }
  });

  it('declines to guess for headerless EXP rather than mis-identifying it', () => {
    const exp = writePattern(fixturePattern(), 'exp');
    expect(detectFormat(exp)).not.toBe('dst');
    expect(() => readPattern(exp)).toThrow(/identify/i);
    expect(() => readPattern(exp, 'exp')).not.toThrow();
  });

  it('resolves formats from filenames and bare extensions', () => {
    expect(formatForExtension('design.PES')?.id).toBe('pes');
    expect(formatForExtension('C:\\designs\\logo.dst')?.id).toBe('dst');
    expect(formatForExtension('vp3')?.id).toBe('vp3');
    expect(formatForExtension('.png')).toBeNull();
  });

  it('reads a sniffed file without being told the format', () => {
    const pes = writePattern(fixturePattern(), 'pes');
    expect(readPattern(pes).getColorBlockCount()).toBe(2);
  });
});
