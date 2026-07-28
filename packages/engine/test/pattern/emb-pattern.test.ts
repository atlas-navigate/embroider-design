import { describe, expect, it } from 'vitest';
import {
  EmbPattern,
  fromDeltaEncoding,
  toDeltaEncoding,
} from '../../src/pattern/emb-pattern.js';
import { StitchCommand } from '../../src/pattern/stitch.js';
import { thread, threadFromHex, threadToHex } from '../../src/pattern/thread.js';
import { beginColorBlock, finishPattern, travelTo } from '../../src/pattern/pattern-builder.js';
import { mmToUnits, unitsToMm } from '../../src/pattern/units.js';

describe('EmbPattern construction', () => {
  it('tracks the needle position across absolute and relative moves', () => {
    const pattern = new EmbPattern();
    expect(pattern.lastPosition).toEqual({ x: 0, y: 0 });
    pattern.stitchTo(10, 20).addStitchRelative(5, -5);
    expect(pattern.lastPosition).toEqual({ x: 15, y: 15 });
  });

  it('places control commands at the current position', () => {
    const pattern = new EmbPattern().stitchTo(30, 40).trim();
    const trim = pattern.stitches[1];
    expect(trim).toEqual({ x: 30, y: 40, command: StitchCommand.TRIM });
  });

  it('wraps a short palette rather than returning undefined', () => {
    const pattern = new EmbPattern().addThread(thread(255, 0, 0));
    expect(pattern.getThread(0).r).toBe(255);
    expect(pattern.getThread(5).r).toBe(255);
  });

  it('falls back to black with no palette at all', () => {
    expect(new EmbPattern().getThread(0)).toEqual({ r: 0, g: 0, b: 0, description: 'Black' });
  });
});

describe('bounds and statistics', () => {
  it('measures the full extent, or stitches only', () => {
    const pattern = new EmbPattern().stitchTo(0, 0).jumpTo(1000, 0).stitchTo(100, 100);
    expect(pattern.getBounds().maxX).toBe(1000);
    expect(pattern.getBounds({ stitchesOnly: true }).maxX).toBe(100);
  });

  it('reports thread length per colour block, excluding jumps', () => {
    const pattern = new EmbPattern();
    pattern.addThread(thread(0, 0, 0)).stitchTo(0, 0).stitchTo(100, 0);
    pattern.colorChange().addThread(thread(255, 0, 0));
    pattern.stitchTo(100, 0).stitchTo(100, 50);
    pattern.end();

    const stats = pattern.getStatistics();
    expect(stats.colorCount).toBe(2);
    expect(stats.threadLengthByBlock[0]).toBeCloseTo(100, 9);
    expect(stats.threadLengthByBlock[1]).toBeCloseTo(50, 9);
    expect(stats.longestStitch).toBeCloseTo(100, 9);
  });

  it('flags stitches too short to sew reliably', () => {
    const pattern = new EmbPattern().stitchTo(0, 0).stitchTo(0.4, 0).stitchTo(50, 0);
    expect(pattern.getStatistics().tinyStitchCount).toBe(1);
  });
});

describe('colour blocks', () => {
  it('splits at every colour change and stops at END', () => {
    const pattern = new EmbPattern()
      .addThreads([thread(1, 1, 1), thread(2, 2, 2)])
      .stitchTo(0, 0)
      .stitchTo(10, 0)
      .colorChange()
      .stitchTo(20, 0)
      .end();

    const blocks = pattern.getColorBlocks();
    expect(blocks).toHaveLength(2);
    expect(blocks[0].stitches).toHaveLength(2);
    expect(blocks[1].stitches).toHaveLength(1);
    expect(blocks[1].thread.r).toBe(2);
  });

  it('treats a change-free pattern as one block', () => {
    const pattern = new EmbPattern().stitchTo(0, 0).stitchTo(10, 0);
    expect(pattern.getColorBlocks()).toHaveLength(1);
    expect(pattern.getColorBlockCount()).toBe(1);
  });
});

describe('normalize', () => {
  it('drops duplicate stitches but keeps the first', () => {
    const pattern = new EmbPattern().stitchTo(0, 0).stitchTo(0, 0).stitchTo(0.1, 0).stitchTo(50, 0);
    pattern.normalize();
    expect(pattern.stitches.filter((s) => s.command === StitchCommand.STITCH)).toHaveLength(2);
  });

  it('keeps the anchor stitch that lands on a jump destination', () => {
    // Jumping to a point and sewing it is how every run starts: the jump moves
    // the needle across with the thread up, and the stitch ties it down. The
    // coordinates repeat, but dropping the stitch as a duplicate would leave
    // the first point of the run unsewn.
    const pattern = new EmbPattern().stitchTo(0, 0).stitchTo(10, 0);
    pattern.trim().jumpTo(500, 500).stitchTo(500, 500).stitchTo(510, 500);

    pattern.normalize();

    const sewn = pattern.stitches.filter((s) => s.command === StitchCommand.STITCH);
    expect(sewn).toHaveLength(4);
    expect(sewn[2]).toMatchObject({ x: 500, y: 500 });
  });

  it('still drops a stitch that repeats the previous sewn point', () => {
    const pattern = new EmbPattern().stitchTo(0, 0).jumpTo(50, 0).stitchTo(50, 0).stitchTo(50, 0);
    pattern.normalize();
    expect(pattern.stitches.filter((s) => s.command === StitchCommand.STITCH)).toHaveLength(2);
  });

  it('merges jump chains into a single move', () => {
    const pattern = new EmbPattern().stitchTo(0, 0).jumpTo(10, 0).jumpTo(20, 0).stitchTo(30, 0);
    pattern.normalize();
    const jumps = pattern.stitches.filter((s) => s.command === StitchCommand.JUMP);
    expect(jumps).toHaveLength(1);
    expect(jumps[0]).toMatchObject({ x: 20, y: 0 });
  });

  it('always terminates with END and nothing after it', () => {
    const pattern = new EmbPattern().stitchTo(0, 0).stitchTo(10, 0).jumpTo(500, 500).trim();
    pattern.normalize();
    const last = pattern.stitches[pattern.stitches.length - 1];
    expect(last.command).toBe(StitchCommand.END);
    expect(last).toMatchObject({ x: 10, y: 0 });
    expect(pattern.countCommand(StitchCommand.END)).toBe(1);
  });

  it('drops an empty middle block together with its thread', () => {
    const pattern = new EmbPattern();
    pattern.addThread(thread(11, 11, 11)).stitchTo(0, 0).stitchTo(10, 0);
    pattern.trim().colorChange().addThread(thread(22, 22, 22)); // sews nothing
    pattern.trim().colorChange().addThread(thread(33, 33, 33));
    pattern.stitchTo(20, 0).stitchTo(30, 0);

    pattern.normalize();

    expect(pattern.getColorBlockCount()).toBe(2);
    expect(pattern.threads).toHaveLength(2);
    expect(pattern.threads[0].r).toBe(11);
    expect(pattern.threads[1].r).toBe(33);
  });

  it('drops an empty trailing block together with its thread', () => {
    const pattern = new EmbPattern();
    pattern.addThread(thread(11, 11, 11)).stitchTo(0, 0).stitchTo(10, 0);
    pattern.trim().colorChange().addThread(thread(22, 22, 22));

    pattern.normalize();

    expect(pattern.getColorBlockCount()).toBe(1);
    expect(pattern.threads).toHaveLength(1);
    expect(pattern.threads[0].r).toBe(11);
  });
});

describe('transforms and composition', () => {
  it('appends another pattern with a colour change and an offset', () => {
    const first = new EmbPattern().addThread(thread(1, 1, 1)).stitchTo(0, 0).stitchTo(10, 0);
    const second = new EmbPattern().addThread(thread(2, 2, 2)).stitchTo(0, 0).stitchTo(10, 0).end();

    first.appendPattern(second, 100, 200);

    expect(first.getColorBlockCount()).toBe(2);
    expect(first.threads).toHaveLength(2);
    // The appended pattern's END is discarded so the result stays open.
    expect(first.countCommand(StitchCommand.END)).toBe(0);
    expect(first.stitches[first.stitches.length - 1]).toMatchObject({ x: 110, y: 200 });
  });

  it('centres a pattern on the origin', () => {
    const pattern = new EmbPattern().stitchTo(0, 0).stitchTo(100, 50).centerInPlace();
    const bounds = pattern.getBounds();
    expect(bounds.centerX).toBeCloseTo(0, 9);
    expect(bounds.centerY).toBeCloseTo(0, 9);
  });

  it('clones deeply', () => {
    const original = new EmbPattern().addThread(thread(9, 9, 9)).stitchTo(1, 2);
    const copy = original.clone();
    copy.stitches[0].x = 999;
    copy.threads[0].r = 0;
    expect(original.stitches[0].x).toBe(1);
    expect(original.threads[0].r).toBe(9);
  });
});

describe('delta encoding', () => {
  it('emits relative moves and flips Y for the machine', () => {
    const pattern = new EmbPattern().stitchTo(0, 0).stitchTo(100, 50);
    expect(pattern.toDeltaEncoding()).toEqual([
      { dx: 0, dy: 0, command: StitchCommand.STITCH },
      { dx: 100, dy: -50, command: StitchCommand.STITCH },
    ]);
  });

  it('honours flipY: false', () => {
    const pattern = new EmbPattern().stitchTo(0, 0).stitchTo(0, 50);
    expect(pattern.toDeltaEncoding({ flipY: false })[1].dy).toBe(50);
  });

  it('re-bases coordinates on the requested origin', () => {
    const pattern = new EmbPattern().stitchTo(100, 100);
    const deltas = pattern.toDeltaEncoding({ originX: 100, originY: 100 });
    expect(deltas[0]).toEqual({ dx: 0, dy: 0, command: StitchCommand.STITCH });
  });

  it('splits long moves into steps within the format limit, arriving exactly', () => {
    const pattern = new EmbPattern().stitchTo(0, 0).stitchTo(1000, 400);
    const deltas = pattern.toDeltaEncoding({ maxStitchDistance: 121 });
    let x = 0;
    let y = 0;
    for (const d of deltas) {
      expect(Math.abs(d.dx)).toBeLessThanOrEqual(121);
      expect(Math.abs(d.dy)).toBeLessThanOrEqual(121);
      x += d.dx;
      y += d.dy;
    }
    expect(x).toBe(1000);
    expect(y).toBe(-400);
    expect(deltas.length).toBeGreaterThan(8);
  });

  it('applies a separate, larger limit to jumps', () => {
    const pattern = new EmbPattern().stitchTo(0, 0).jumpTo(1000, 0);
    const deltas = pattern.toDeltaEncoding({ maxStitchDistance: 121, maxJumpDistance: 2047 });
    expect(deltas.filter((d) => d.command === StitchCommand.JUMP)).toHaveLength(1);
  });

  it('emits control commands as zero-length moves', () => {
    const pattern = new EmbPattern().stitchTo(0, 0).trim().colorChange().stitchTo(10, 0);
    const deltas = pattern.toDeltaEncoding();
    expect(deltas[1]).toEqual({ dx: 0, dy: 0, command: StitchCommand.TRIM });
    expect(deltas[2]).toEqual({ dx: 0, dy: 0, command: StitchCommand.COLOR_CHANGE });
    // The move after a control command is still measured from the real position.
    expect(deltas[3]).toEqual({ dx: 10, dy: 0, command: StitchCommand.STITCH });
  });

  it('never accumulates rounding drift across a long fractional path', () => {
    const pattern = new EmbPattern();
    for (let i = 0; i < 5000; i++) pattern.stitchTo(i * 0.3, i * 0.7);
    const deltas = pattern.toDeltaEncoding({ flipY: false });
    const rebuilt = fromDeltaEncoding(deltas, { flipY: false });
    for (let i = 0; i < pattern.stitches.length; i++) {
      expect(Math.abs(rebuilt[i].x - pattern.stitches[i].x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(rebuilt[i].y - pattern.stitches[i].y)).toBeLessThanOrEqual(0.5);
    }
  });

  it('round-trips through fromDeltaEncoding with the Y flip applied', () => {
    const pattern = new EmbPattern().stitchTo(10, 20).stitchTo(-30, 40).stitchTo(5, -5);
    const rebuilt = fromDeltaEncoding(pattern.toDeltaEncoding());
    expect(rebuilt).toEqual(pattern.stitches);
  });

  it('rejects a nonsensical distance limit rather than looping forever', () => {
    expect(() => toDeltaEncoding([], { maxStitchDistance: 0 })).toThrow(/at least 2 units/);
  });
});

describe('pattern-builder helpers', () => {
  it('trims before a long travel but not a short one', () => {
    const shortHop = new EmbPattern().stitchTo(0, 0);
    travelTo(shortHop, { x: 20, y: 0 });
    expect(shortHop.countCommand(StitchCommand.TRIM)).toBe(0);

    const longHop = new EmbPattern().stitchTo(0, 0);
    travelTo(longHop, { x: 2000, y: 0 });
    expect(longHop.countCommand(StitchCommand.TRIM)).toBe(1);
  });

  it('keeps threads aligned with blocks through beginColorBlock', () => {
    const pattern = new EmbPattern();
    beginColorBlock(pattern, thread(1, 0, 0));
    pattern.stitchTo(0, 0).stitchTo(10, 0);
    beginColorBlock(pattern, thread(0, 1, 0));
    pattern.stitchTo(20, 0).stitchTo(30, 0);

    finishPattern(pattern);

    const blocks = pattern.getColorBlocks();
    expect(blocks).toHaveLength(2);
    expect(blocks[0].thread.r).toBe(1);
    expect(blocks[1].thread.g).toBe(1);
  });
});

describe('threads and units', () => {
  it('round-trips hex colours, including shorthand', () => {
    expect(threadToHex(threadFromHex('#f00'))).toBe('#ff0000');
    expect(threadToHex(threadFromHex('1A2B3C'))).toBe('#1a2b3c');
  });

  it('rejects malformed colours', () => {
    expect(() => threadFromHex('nope')).toThrow();
  });

  it('converts millimetres on the 0.1 mm machine grid', () => {
    expect(mmToUnits(12.7)).toBeCloseTo(127, 9);
    expect(unitsToMm(127)).toBeCloseTo(12.7, 9);
  });
});
