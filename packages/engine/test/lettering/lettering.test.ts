import { describe, expect, it } from 'vitest';
import type { Point } from '../../src/geometry/point.js';
import { resolveStitchSettings } from '../../src/stitchgen/settings.js';
import { mmToUnits, unitsToMm } from '../../src/pattern/units.js';
import {
  capHeightOf,
  defaultLineHeight,
  fontDisplayName,
  fontScale,
  glyphAdvance,
  pairKerning,
  sizeForCapHeight,
  type EmbroideryFont,
  type FontMetrics,
} from '../../src/lettering/font.js';
import { layoutText, measureText } from '../../src/lettering/text-layout.js';
import {
  generateTextStitches,
  glyphRegionsAt,
  textToRings,
} from '../../src/lettering/glyph-to-stitch.js';
import {
  assessSuitability,
  measureStrokeWidth,
  minimumUsableCapHeight,
  scaleMeasurement,
} from '../../src/lettering/font-metrics.js';
import {
  boldestStyle,
  buildFontCatalog,
  catalogDisplayName,
  groupByFamily,
  preferredStyle,
  resolveFontReference,
  searchFonts,
  type FontCatalogEntry,
} from '../../src/lettering/font-catalog.js';

const SETTINGS = resolveStitchSettings();

const METRICS: FontMetrics = {
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
  lineGap: 0,
  capHeight: 700,
  xHeight: 500,
};

/** Glyph outlines in font units, Y-up — the convention a real font file uses. */
const OUTLINES: Record<string, number[][][]> = {
  // A plain 100-wide stem.
  I: [
    [
      [100, 0],
      [200, 0],
      [200, 700],
      [100, 700],
    ],
  ],
  // A rectangular ring: the counter is a second contour, unmarked as a hole.
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
  // Two stems and a crossbar as one contour, the way a font would store it.
  H: [
    [
      [50, 0],
      [150, 0],
      [150, 300],
      [450, 300],
      [450, 0],
      [550, 0],
      [550, 700],
      [450, 700],
      [450, 400],
      [150, 400],
      [150, 700],
      [50, 700],
    ],
  ],
};

const ADVANCES: Record<string, number> = { I: 300, O: 600, H: 700, ' ': 300 };
const KERNS: Record<string, number> = { IO: -50 };

/**
 * A font with known rectangular glyphs.
 *
 * Everything downstream of `EmbroideryFont` can then be checked against hand
 * arithmetic, with no font binary in the repo and no dependence on whichever
 * version of Arial happens to be installed.
 */
const FONT: EmbroideryFont = {
  family: 'Test Sans',
  subfamily: 'Regular',
  metrics: METRICS,
  hasGlyph: (char) => char in OUTLINES || char === ' ',
  advanceWidth: (char) => ADVANCES[char] ?? 500,
  kerning: (left, right) => KERNS[left + right] ?? 0,
  glyphRings: (char, size) => {
    const scale = size / METRICS.unitsPerEm;
    const outlines = OUTLINES[char];
    if (!outlines) return [];
    return outlines.map((ring) => ring.map(([x, y]) => ({ x: x * scale, y: -y * scale })));
  },
};

describe('font metrics helpers', () => {
  it('scales font units to design units', () => {
    expect(fontScale(METRICS, 1000)).toBe(1);
    expect(fontScale(METRICS, 150)).toBeCloseTo(0.15, 9);
    expect(glyphAdvance(FONT, 'I', 1000)).toBe(300);
    expect(pairKerning(FONT, 'I', 'O', 1000)).toBe(-50);
  });

  it('derives line height from ascender, descender and line gap', () => {
    expect(defaultLineHeight(METRICS, 1000)).toBe(1000);
  });

  it('converts between em size and cap height, which is what users specify', () => {
    expect(capHeightOf(METRICS, 1000)).toBe(700);
    expect(sizeForCapHeight(METRICS, 700)).toBeCloseTo(1000, 9);
    expect(capHeightOf(METRICS, sizeForCapHeight(METRICS, 123))).toBeCloseTo(123, 9);
  });

  it('leaves "Regular" out of the display name', () => {
    expect(fontDisplayName(FONT)).toBe('Test Sans');
  });
});

describe('layoutText', () => {
  it('advances by the font metrics', () => {
    expect(measureText(FONT, 'II', { size: 1000 })).toBe(600);
  });

  it('applies kern pairs, and skips them when asked', () => {
    expect(measureText(FONT, 'IO', { size: 1000 })).toBe(850);
    expect(measureText(FONT, 'IO', { size: 1000, kerning: false })).toBe(900);
  });

  it('inserts letter spacing between glyphs but not after the last', () => {
    expect(measureText(FONT, 'III', { size: 1000, letterSpacing: 50 })).toBe(1000);
  });

  it('adds word spacing to spaces only', () => {
    expect(measureText(FONT, 'I I', { size: 1000, wordSpacing: 100 })).toBe(1000);
  });

  it('stacks lines one line height apart, first baseline one ascent down', () => {
    const layout = layoutText(FONT, 'I\nI', { size: 1000 });
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[0].baselineY).toBe(800);
    expect(layout.lines[1].baselineY).toBe(1800);
    expect(layout.height).toBe(2000);
  });

  it('centres and right-aligns against the widest line', () => {
    const centred = layoutText(FONT, 'I\nII', { size: 1000, align: 'center' });
    expect(centred.width).toBe(600);
    expect(centred.lines[0].offsetX).toBe(150);
    expect(centred.lines[1].offsetX).toBe(0);

    const right = layoutText(FONT, 'I\nII', { size: 1000, align: 'right' });
    expect(right.lines[0].offsetX).toBe(300);
  });

  it('wraps on spaces at the given width, never mid-word', () => {
    const layout = layoutText(FONT, 'II II II', { size: 1000, maxWidth: 1600 });
    expect(layout.lines.map((line) => line.text)).toEqual(['II II', 'II']);
    // A single word wider than the limit overflows rather than breaking.
    const long = layoutText(FONT, 'IIIIII', { size: 1000, maxWidth: 500 });
    expect(long.lines).toHaveLength(1);
  });

  it('drops trailing spaces, which would otherwise push a centred line off centre', () => {
    const layout = layoutText(FONT, 'I  ', { size: 1000 });
    expect(layout.lines[0].width).toBe(300);
  });

  it('reports characters the font cannot render', () => {
    const layout = layoutText(FONT, 'IZI', { size: 1000 });
    expect(layout.missing).toEqual(['Z']);
  });
});

describe('glyph outlines', () => {
  it('puts the pen origin on the baseline with Y increasing downward', () => {
    const rings = FONT.glyphRings('I', 1000);
    expect(rings).toHaveLength(1);
    const ys = rings[0].map((p) => p.y);
    // `toBeCloseTo` rather than `toBe`: flipping y=0 yields -0, which is fine
    // everywhere in the geometry and is normalised by the format encoders.
    expect(Math.max(...ys)).toBeCloseTo(0, 9);
    expect(Math.min(...ys)).toBe(-700);
  });

  it('recovers the counter of an "O" as a hole, not a second shape', () => {
    const regions = glyphRegionsAt(FONT, 'O', 1000, { x: 0, y: 0 });
    expect(regions).toHaveLength(1);
    expect(regions[0].holes).toHaveLength(1);
  });

  it('positions rings at the glyph origin', () => {
    const regions = glyphRegionsAt(FONT, 'I', 1000, { x: 500, y: 250 });
    const xs = regions[0].outer.map((p) => p.x);
    expect(Math.min(...xs)).toBe(600);
    expect(Math.max(...xs)).toBe(700);
  });

  it('collects positioned rings for a whole string', () => {
    const { rings } = textToRings(FONT, 'IO', { size: 1000 });
    // One contour for the I, two for the O.
    expect(rings).toHaveLength(3);
  });
});

describe('generateTextStitches', () => {
  const size = mmToUnits(15);

  it('stitches every glyph and skips the spaces', () => {
    const result = generateTextStitches(FONT, 'I I', { size }, { settings: SETTINGS });
    expect(result.glyphs.map((glyph) => glyph.char)).toEqual(['I', 'I']);
    expect(result.runs.length).toBeGreaterThan(0);
  });

  it('satins a stem rather than filling it', () => {
    const result = generateTextStitches(FONT, 'I', { size }, { settings: SETTINGS });
    expect(result.glyphs[0].regions.map((region) => region.type)).toEqual(['satin']);
  });

  it('satins a ring glyph around its counter', () => {
    const result = generateTextStitches(FONT, 'O', { size }, { settings: SETTINGS });
    expect(result.glyphs[0].regions[0].type).toBe('satin');
  });

  it('breaks a branching glyph into one column per stroke', () => {
    const result = generateTextStitches(FONT, 'H', { size }, { settings: SETTINGS });
    const region = result.glyphs[0].regions[0];
    expect(region.type).toBe('satin');
    // Two stems and a crossbar, each with underlay: comfortably over three runs.
    expect(region.runs.length).toBeGreaterThanOrEqual(3);
  });

  it('honours an explicit stitch type over the router', () => {
    const result = generateTextStitches(
      FONT,
      'I',
      { size },
      { settings: SETTINGS, stitchType: 'fill' },
    );
    expect(result.glyphs[0].regions[0].type).toBe('fill');
  });

  it('warns about characters it could not render', () => {
    const result = generateTextStitches(FONT, 'IZ', { size }, { settings: SETTINGS });
    expect(result.warnings.join(' ')).toContain('Z');
  });
});

describe('stroke width measurement', () => {
  it('measures the stem of a known glyph', () => {
    const measurement = measureStrokeWidth(FONT, 'I');
    expect(measurement).not.toBeNull();
    // The stem is 100/1000 of the em; measured at a 20 mm em that is 2 mm,
    // and the 90th-percentile width of a uniform bar reads about 0.9 of that.
    expect(unitsToMm(measurement!.typicalWidth)).toBeGreaterThan(1.6);
    expect(unitsToMm(measurement!.typicalWidth)).toBeLessThan(2.1);
  });

  it('scales linearly with size', () => {
    const measurement = measureStrokeWidth(FONT, 'I')!;
    const doubled = scaleMeasurement(measurement, measurement.size * 2);
    expect(doubled.typicalWidth).toBeCloseTo(measurement.typicalWidth * 2, 6);
  });

  it('passes a font that is comfortably wide enough', () => {
    const measurement = measureStrokeWidth(FONT, 'I')!;
    const report = assessSuitability(measurement, mmToUnits(20), SETTINGS);
    expect(report.suitability).toBe('good');
    expect(report.recommendedSize).toBeNull();
  });

  it('flags a size where the strokes are below the satin minimum', () => {
    const measurement = measureStrokeWidth(FONT, 'I')!;
    const size = mmToUnits(4);
    const report = assessSuitability(measurement, size, SETTINGS);
    expect(report.suitability).toBe('too-thin');
    expect(report.minWidthMm).toBeLessThan(unitsToMm(SETTINGS.minSatinWidth));
    expect(report.recommendedSize).toBeGreaterThan(size);
  });

  it('notes when strokes are wide enough that a fill will be used', () => {
    const measurement = measureStrokeWidth(FONT, 'I')!;
    const report = assessSuitability(measurement, mmToUnits(200), SETTINGS);
    expect(report.suitability).toBe('wide');
  });

  it('reports a minimum usable letter height', () => {
    const measurement = measureStrokeWidth(FONT, 'I')!;
    const capHeight = minimumUsableCapHeight(FONT, measurement, SETTINGS);
    expect(capHeight).not.toBeNull();
    expect(unitsToMm(capHeight!)).toBeGreaterThan(2);
    expect(unitsToMm(capHeight!)).toBeLessThan(20);
  });
});

describe('font catalog', () => {
  function entry(
    path: string,
    family: string,
    subfamily: string,
    weight = 400,
    italic = false,
  ): FontCatalogEntry {
    return {
      path,
      family,
      subfamily,
      fullName: `${family} ${subfamily}`,
      postScriptName: `${family}-${subfamily}`.replace(/\s+/g, ''),
      weight,
      italic,
      monospace: false,
    };
  }

  const ENTRIES = [
    entry('C:/Windows/Fonts/b.ttf', 'Beta', 'Bold', 700),
    entry('C:/Windows/Fonts/a.ttf', 'Alpha', 'Regular'),
    entry('C:/Users/me/Fonts/a-copy.ttf', 'Alpha', 'Regular'),
    entry('C:/Windows/Fonts/ai.ttf', 'Alpha', 'Italic', 400, true),
    entry('C:/Windows/Fonts/ab.ttf', 'Alpha', 'Black', 900),
  ];

  it('drops the per-user duplicate of a system font and sorts by family then weight', () => {
    const catalog = buildFontCatalog(ENTRIES);
    expect(catalog).toHaveLength(4);
    expect(catalog.map((e) => `${e.family} ${e.subfamily}`)).toEqual([
      'Alpha Regular',
      'Alpha Italic',
      'Alpha Black',
      'Beta Bold',
    ]);
  });

  it('groups styles under their family', () => {
    const groups = groupByFamily(buildFontCatalog(ENTRIES));
    expect(groups.map((group) => group.family)).toEqual(['Alpha', 'Beta']);
    expect(groups[0].styles).toHaveLength(3);
  });

  it('prefers Regular, and can find the boldest upright for a wider satin', () => {
    const alpha = groupByFamily(buildFontCatalog(ENTRIES))[0].styles;
    expect(preferredStyle(alpha)?.subfamily).toBe('Regular');
    expect(boldestStyle(alpha)?.subfamily).toBe('Black');
    // With no Regular, the closest weight to 400 wins.
    expect(preferredStyle([entry('x', 'X', 'Light', 300), entry('y', 'X', 'Bold', 700)])?.weight).toBe(300);
  });

  it('searches across family, style and PostScript name', () => {
    const catalog = buildFontCatalog(ENTRIES);
    expect(searchFonts(catalog, 'black')).toHaveLength(1);
    expect(searchFonts(catalog, 'alpha')).toHaveLength(3);
    expect(searchFonts(catalog, '')).toHaveLength(4);
  });

  it('resolves a saved reference by path, then name, then family', () => {
    const catalog = buildFontCatalog(ENTRIES);
    expect(resolveFontReference(catalog, { path: 'c:/windows/fonts/ab.ttf' })?.subfamily).toBe('Black');
    expect(resolveFontReference(catalog, { postScriptName: 'Beta-Bold' })?.family).toBe('Beta');
    // A project made on another machine: the path is gone, the family is not.
    expect(
      resolveFontReference(catalog, { path: 'D:/gone.ttf', family: 'Alpha', subfamily: 'Italic' })
        ?.subfamily,
    ).toBe('Italic');
    expect(resolveFontReference(catalog, { family: 'Alpha' })?.subfamily).toBe('Regular');
    expect(resolveFontReference(catalog, { family: 'Nothing' })).toBeNull();
  });

  it('names a regular style by its family alone', () => {
    expect(catalogDisplayName(ENTRIES[1])).toBe('Alpha');
    expect(catalogDisplayName(ENTRIES[0])).toBe('Beta Bold');
  });
});

describe('point convention', () => {
  it('keeps glyph geometry in the same Y-down frame as the rest of the engine', () => {
    const layout = layoutText(FONT, 'I', { size: 1000 });
    const glyph = layout.glyphs[0];
    const rings = FONT.glyphRings(glyph.char, layout.size);
    const top: Point = rings[0].reduce((a, b) => (a.y < b.y ? a : b));
    // The glyph rises above its baseline, so the topmost point is negative...
    expect(top.y).toBeLessThan(0);
    // ...and once placed, it lands inside the block, below the top edge.
    expect(glyph.y + top.y).toBeGreaterThanOrEqual(0);
  });
});
