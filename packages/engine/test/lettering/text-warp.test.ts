import { describe, expect, it } from 'vitest';
import { layoutText, type TextLayoutOptions } from '../../src/lettering/text-layout.js';
import { textToRings } from '../../src/lettering/glyph-to-stitch.js';
import { baselineFor, MAX_SWEEP_DEGREES } from '../../src/lettering/text-warp.js';
import { boundingBoxOfMany } from '../../src/geometry/path.js';
import type { EmbroideryFont, FontMetrics } from '../../src/lettering/font.js';

/**
 * Curved lettering has one property that matters more than the rest: bending
 * the text must not resize it. The arc's radius is derived from the laid-out
 * width so the arc length always equals the straight width — drag the curve
 * control and the same words take the same amount of thread. If that slips,
 * every design someone curves comes out a different size than the one they
 * measured on screen.
 *
 * The font is the same rectangular stub the rest of the lettering tests use, so
 * every expectation here can be checked against hand arithmetic.
 */

const METRICS: FontMetrics = {
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
  lineGap: 0,
  capHeight: 700,
  xHeight: 500,
};

const OUTLINES: Record<string, number[][][]> = {
  I: [
    [
      [100, 0],
      [200, 0],
      [200, 700],
      [100, 700],
    ],
  ],
  O: [
    [
      [50, 0],
      [550, 0],
      [550, 700],
      [50, 700],
    ],
    [
      [150, 100],
      [450, 100],
      [450, 600],
      [150, 600],
    ],
  ],
  H: [
    [
      [50, 0],
      [550, 0],
      [550, 700],
      [50, 700],
    ],
  ],
};

const ADVANCES: Record<string, number> = { I: 300, O: 600, H: 700, ' ': 300 };

const FONT: EmbroideryFont = {
  family: 'Test Sans',
  subfamily: 'Regular',
  metrics: METRICS,
  hasGlyph: (char) => char in OUTLINES || char === ' ',
  advanceWidth: (char) => ADVANCES[char] ?? 500,
  kerning: () => 0,
  glyphRings: (char, size) => {
    const scale = size / METRICS.unitsPerEm;
    const outlines = OUTLINES[char];
    if (!outlines) return [];
    return outlines.map((ring) => ring.map(([x, y]) => ({ x: x * scale, y: -y * scale })));
  },
};

const SIZE = 400;

function layoutOf(text: string, shape?: TextLayoutOptions['shape']) {
  return layoutText(FONT, text, { size: SIZE, shape });
}

describe('text shapes', () => {
  it('leaves the layout alone when straight', () => {
    const plain = layoutOf('HIOHI');
    const none = layoutOf('HIOHI', { type: 'none' });
    expect(none.glyphs.map((glyph) => [glyph.x, glyph.y])).toEqual(
      plain.glyphs.map((glyph) => [glyph.x, glyph.y]),
    );
    for (const glyph of none.glyphs) expect(glyph.rotation ?? 0).toBe(0);
  });

  it('treats a zero sweep as straight', () => {
    const plain = layoutOf('HIOHI');
    const flat = layoutOf('HIOHI', { type: 'arc', sweep: 0 });
    expect(flat.glyphs.map((glyph) => glyph.x)).toEqual(plain.glyphs.map((glyph) => glyph.x));
  });

  it('places every glyph on a circle of the derived radius', () => {
    const sweep = 120;
    const straight = layoutOf('HIOHIOHI');
    const layout = layoutOf('HIOHIOHI', { type: 'arc', sweep });
    const radius = straight.width / ((sweep * Math.PI) / 180);
    const center = { x: straight.width / 2, y: layout.ascent + radius };

    for (const glyph of layout.glyphs) {
      // Undo the half-advance step-back to recover the point on the curve.
      const angle = glyph.rotation ?? 0;
      const onCurve = {
        x: glyph.x + (Math.cos(angle) * glyph.advance) / 2,
        y: glyph.y + (Math.sin(angle) * glyph.advance) / 2,
      };
      expect(Math.hypot(onCurve.x - center.x, onCurve.y - center.y)).toBeCloseTo(radius, 6);
    }
  });

  it('keeps the midpoint of the line exactly where it was', () => {
    const straight = layoutOf('HIOHI');
    const baseline = baselineFor({ type: 'arc', sweep: 90 }, straight);
    expect(baseline).not.toBeNull();
    const middle = baseline?.at(straight.width / 2);
    expect(middle?.point.x).toBeCloseTo(straight.width / 2, 9);
    expect(middle?.point.y).toBeCloseTo(straight.ascent, 9);
  });

  it('bends without resizing: arc length equals the straight width', () => {
    const straight = layoutOf('HIOHIOHI');
    expect(baselineFor({ type: 'arc', sweep: 200 }, straight)?.length).toBeCloseTo(
      straight.width,
      9,
    );
  });

  it('mirrors the rotation when the sweep is negated', () => {
    const up = layoutOf('HIOHI', { type: 'arc', sweep: 140 });
    const down = layoutOf('HIOHI', { type: 'arc', sweep: -140 });
    for (let i = 0; i < up.glyphs.length; i++) {
      expect(down.glyphs[i].rotation ?? 0).toBeCloseTo(-(up.glyphs[i].rotation ?? 0), 9);
    }
  });

  it('arches upward for a positive sweep and downward for a negative one', () => {
    const straight = layoutOf('HIOHI');
    const up = baselineFor({ type: 'arc', sweep: 120 }, straight);
    const down = baselineFor({ type: 'arc', sweep: -120 }, straight);
    // Y grows downward, so the *ends* of a rainbow sit lower than its middle.
    expect(up?.at(0).point.y).toBeGreaterThan(up?.at(straight.width / 2).point.y ?? 0);
    expect(down?.at(0).point.y).toBeLessThan(down?.at(straight.width / 2).point.y ?? 0);
  });

  it('closes the ring at a full turn', () => {
    const straight = layoutOf('HIOHIO');
    const baseline = baselineFor({ type: 'arc', sweep: MAX_SWEEP_DEGREES }, straight);
    const start = baseline?.at(0).point;
    const end = baseline?.at(straight.width).point;
    expect(
      Math.hypot((end?.x ?? 0) - (start?.x ?? 0), (end?.y ?? 0) - (start?.y ?? 0)),
    ).toBeCloseTo(0, 6);
  });

  it('clamps a sweep beyond a full turn instead of overlapping the text', () => {
    const straight = layoutOf('HIOHIO');
    const clamped = baselineFor({ type: 'arc', sweep: 2000 }, straight);
    const full = baselineFor({ type: 'arc', sweep: MAX_SWEEP_DEGREES }, straight);
    expect(clamped?.at(0).point.x).toBeCloseTo(full?.at(0).point.x ?? 0, 9);
  });

  it('reports bounds that follow the curve rather than the typeset box', () => {
    const straight = layoutOf('HIOHIOHI');
    const curved = layoutOf('HIOHIOHI', { type: 'arc', sweep: 180 });
    expect(straight.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: straight.width,
      maxY: straight.height,
    });
    // A half-turn arch reaches well above the block's top edge and is far
    // taller than the straight line it came from. It is not *narrower*: the
    // letters at the two ends stand vertically, so their own height widens the
    // box past the arc's diameter, which is exactly what the selection
    // rectangle has to account for.
    expect(curved.bounds.minY).toBeLessThan(0);
    expect(curved.bounds.maxY - curved.bounds.minY).toBeGreaterThan(straight.height * 2);
  });

  it('nests a second line inside the first rather than beside it', () => {
    // A gentle sweep, deliberately: at a radius smaller than the line height a
    // second line passes through the centre of the arc and comes out inverted.
    // That is real circular geometry rather than a bug, but it is not what this
    // test is about.
    const sweep = 60;
    const straight = layoutOf('HIO\nHIO');
    const curved = layoutOf('HIO\nHIO', { type: 'arc', sweep });
    const radius = straight.width / ((sweep * Math.PI) / 180);
    expect(radius).toBeGreaterThan(curved.lineHeight);
    const center = { x: straight.width / 2, y: straight.ascent + radius };

    const radiusOf = (glyph: (typeof curved.glyphs)[number]): number => {
      const angle = glyph.rotation ?? 0;
      const x = glyph.x + (Math.cos(angle) * glyph.advance) / 2;
      const y = glyph.y + (Math.sin(angle) * glyph.advance) / 2;
      return Math.hypot(x - center.x, y - center.y);
    };
    const first = curved.glyphs.filter((glyph) => glyph.lineIndex === 0);
    const second = curved.glyphs.filter((glyph) => glyph.lineIndex === 1);
    // The second line sits one line height closer to the centre of the arc.
    expect(radiusOf(second[0])).toBeCloseTo(radiusOf(first[0]) - curved.lineHeight, 6);
  });

  it('spaces wave glyphs by arc length, not by horizontal step', () => {
    const layout = layoutOf('IIIIIIII', { type: 'wave', amplitude: SIZE * 0.4, cycles: 2 });
    const gaps: number[] = [];
    for (let i = 1; i < layout.glyphs.length; i++) {
      const a = layout.glyphs[i - 1];
      const b = layout.glyphs[i];
      gaps.push(Math.hypot(b.x - a.x, b.y - a.y));
    }
    // Every letter is the same character, so even spacing is the whole point.
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.35);
  });

  it('runs text along a custom path and past its end', () => {
    const diagonal: TextLayoutOptions['shape'] = {
      type: 'path',
      points: [
        { x: 0, y: 0 },
        { x: 300, y: 300 },
      ],
    };
    const layout = layoutOf('HIOHIOHI', diagonal);
    for (const glyph of layout.glyphs) {
      // The path is far shorter than the text; the overflow carries straight on
      // along the end tangent instead of piling up on the last point.
      expect(glyph.rotation ?? 0).toBeCloseTo(Math.PI / 4, 6);
    }
    const xs = layout.glyphs.map((glyph) => glyph.x);
    expect(Math.max(...xs)).toBeGreaterThan(300);
  });

  it('rotates the real outlines, not just the pen positions', () => {
    // Several glyphs, because a single one lands at the apex of the arc where
    // the tangent is horizontal and there is nothing to rotate.
    const straight = textToRings(FONT, 'HIOHIOHI', { size: SIZE });
    const curved = textToRings(FONT, 'HIOHIOHI', {
      size: SIZE,
      shape: { type: 'arc', sweep: 300 },
    });
    const straightBox = boundingBoxOfMany(straight.rings);
    const curvedBox = boundingBoxOfMany(curved.rings);
    expect(straightBox).not.toBeNull();
    expect(curvedBox).not.toBeNull();
    expect(curved.rings.length).toBe(straight.rings.length);

    // Turning the glyphs bodily is what makes the outlines curl up into a near
    // ring; positions alone would have left a wide, flat strip.
    const straightWidth = (straightBox?.maxX ?? 0) - (straightBox?.minX ?? 0);
    const curvedWidth = (curvedBox?.maxX ?? 0) - (curvedBox?.minX ?? 0);
    const curvedHeight = (curvedBox?.maxY ?? 0) - (curvedBox?.minY ?? 0);
    expect(curvedWidth).toBeLessThan(straightWidth);
    expect(curvedHeight).toBeGreaterThan(curvedWidth * 0.7);
  });
});
