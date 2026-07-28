import { describe, expect, it } from 'vitest';
import { distance, type Point } from '../../src/geometry/point.js';
import { boundingBoxOfPoints, pointInPolygon, polylineLength } from '../../src/geometry/path.js';
import { DEFAULT_STITCH_SETTINGS, resolveStitchSettings } from '../../src/stitchgen/settings.js';
import {
  generateBeanStitch,
  generateRepeatedRun,
  generateRunningStitch,
  mergeShortStitches,
} from '../../src/stitchgen/running-stitch.js';
import {
  generateSatinColumn,
  ringToSatinRails,
  satinColumnWidth,
} from '../../src/stitchgen/satin-column.js';
import {
  generateContourFill,
  generateTatamiFill,
  measureRuns,
} from '../../src/stitchgen/fill-tatami.js';
import { generateFillUnderlay, generateSatinUnderlay } from '../../src/stitchgen/underlay.js';
import { chooseStitchType, estimateStitchCount } from '../../src/stitchgen/stitch-router.js';
import { generateRegionStitches } from '../../src/stitchgen/region.js';

const SETTINGS = resolveStitchSettings();

const SQUARE: Point[] = [
  { x: 0, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 300 },
  { x: 0, y: 300 },
];

const HOLE: Point[] = [
  { x: 120, y: 120 },
  { x: 180, y: 120 },
  { x: 180, y: 180 },
  { x: 120, y: 180 },
];

/** A 400 x 30 ribbon: unmistakably satin territory. */
const RIBBON: Point[] = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 30 },
  { x: 0, y: 30 },
];

function maxStitchLength(points: readonly Point[]): number {
  let max = 0;
  for (let i = 1; i < points.length; i++) {
    max = Math.max(max, distance(points[i - 1], points[i]));
  }
  return max;
}

describe('settings', () => {
  it('clamps values that would produce nonsense', () => {
    const settings = resolveStitchSettings({
      stitchLength: -5,
      beanRepeats: 4,
      fillSpacing: 0,
      minStitchLength: 999,
    });
    expect(settings.stitchLength).toBeGreaterThan(0);
    expect(settings.beanRepeats % 2).toBe(1);
    expect(settings.fillSpacing).toBeGreaterThan(0);
    expect(settings.minStitchLength).toBeLessThanOrEqual(settings.stitchLength);
  });

  it('merges nested underlay settings without dropping the rest', () => {
    const settings = resolveStitchSettings({ underlay: { type: 'edge-run' } });
    expect(settings.underlay.type).toBe('edge-run');
    expect(settings.underlay.stitchLength).toBe(DEFAULT_STITCH_SETTINGS.underlay.stitchLength);
  });
});

describe('running stitch', () => {
  it('never exceeds the requested stitch length', () => {
    const stitches = generateRunningStitch(SQUARE, SETTINGS, { closed: true });
    expect(maxStitchLength(stitches)).toBeLessThanOrEqual(SETTINGS.stitchLength + 1e-9);
  });

  it('keeps every corner', () => {
    const stitches = generateRunningStitch(SQUARE, SETTINGS, { closed: true });
    for (const corner of SQUARE) {
      expect(stitches.some((p) => distance(p, corner) < 1e-6)).toBe(true);
    }
  });

  it('sews a bean stitch three times over each segment', () => {
    const line: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ];
    const single = generateRunningStitch(line, SETTINGS);
    const bean = generateBeanStitch(line, SETTINGS);
    expect(bean.length).toBe(1 + (single.length - 1) * 3);
    expect(bean[bean.length - 1]).toEqual(single[single.length - 1]);
  });

  it('reverses alternate passes of a repeated run', () => {
    const line: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ];
    const doubled = generateRepeatedRun(line, SETTINGS, 2);
    expect(doubled[0]).toEqual({ x: 0, y: 0 });
    expect(doubled[doubled.length - 1]).toEqual({ x: 0, y: 0 });
  });

  it('merges stitches too short to sew, keeping the endpoints', () => {
    const crowded: Point[] = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
      { x: 0.2, y: 0 },
      { x: 50, y: 0 },
    ];
    expect(mergeShortStitches(crowded, 6)).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ]);
  });
});

describe('satin columns', () => {
  const rails = {
    left: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
    ],
    right: [
      { x: 0, y: 40 },
      { x: 400, y: 40 },
    ],
  };

  it('alternates rails so every stitch crosses the column', () => {
    const stitches = generateSatinColumn(rails, SETTINGS, { pullCompensation: 0 });
    expect(stitches.length).toBeGreaterThan(10);
    for (const stitch of stitches) {
      expect(Math.min(Math.abs(stitch.y), Math.abs(stitch.y - 40))).toBeLessThan(1e-6);
    }
    for (let i = 1; i < stitches.length; i++) {
      expect(Math.abs(stitches[i].y - stitches[i - 1].y)).toBeCloseTo(40, 6);
    }
  });

  it('spaces same-rail penetrations by the density', () => {
    const stitches = generateSatinColumn(rails, SETTINGS, { density: 8, pullCompensation: 0 });
    const onLeftRail = stitches.filter((p) => Math.abs(p.y) < 1e-6);
    expect(onLeftRail.length).toBeGreaterThan(10);
    for (let i = 1; i < onLeftRail.length; i++) {
      expect(distance(onLeftRail[i - 1], onLeftRail[i])).toBeLessThanOrEqual(8 + 1e-6);
    }
  });

  it('widens the column by the pull compensation on each side', () => {
    const plain = boundingBoxOfPoints(
      generateSatinColumn(rails, SETTINGS, { pullCompensation: 0 }),
    )!;
    const compensated = boundingBoxOfPoints(
      generateSatinColumn(rails, SETTINGS, { pullCompensation: 3 }),
    )!;
    expect(compensated.minY).toBeCloseTo(plain.minY - 3, 6);
    expect(compensated.maxY).toBeCloseTo(plain.maxY + 3, 6);
  });

  it('splits crossings that are too long to lie flat', () => {
    const wide = {
      left: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
      right: [
        { x: 0, y: 300 },
        { x: 200, y: 300 },
      ],
    };
    const stitches = generateSatinColumn(wide, SETTINGS, {
      pullCompensation: 0,
      maxStitchLength: 60,
    });
    expect(maxStitchLength(stitches)).toBeLessThanOrEqual(61);
  });

  it('measures its own width', () => {
    expect(satinColumnWidth(rails)?.mean).toBeCloseTo(40, 6);
  });

  it('splits a ribbon ring into two rails running the same way', () => {
    const derived = ringToSatinRails(RIBBON);
    expect(derived).not.toBeNull();
    const { left, right } = derived!;
    expect(polylineLength(left)).toBeCloseTo(polylineLength(right), 0);
    expect(distance(left[0], right[0])).toBeLessThan(distance(left[0], right[right.length - 1]));
  });

  it('declines a ring too small to be a column', () => {
    expect(
      ringToSatinRails([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
    ).toBeNull();
  });
});

describe('tatami fill', () => {
  it('covers the region and stays inside it', () => {
    const runs = generateTatamiFill([SQUARE], SETTINGS, { angle: 0 });
    expect(runs.length).toBeGreaterThan(0);
    const all = runs.flat();
    expect(all.length).toBeGreaterThan(100);
    for (const point of all) {
      expect(point.x).toBeGreaterThanOrEqual(-1e-6);
      expect(point.x).toBeLessThanOrEqual(300 + 1e-6);
      expect(point.y).toBeGreaterThanOrEqual(-1e-6);
      expect(point.y).toBeLessThanOrEqual(300 + 1e-6);
    }
  });

  it('produces rows at the requested spacing', () => {
    const runs = generateTatamiFill([SQUARE], SETTINGS, { angle: 0, spacing: 10 });
    const rows = new Set(runs.flat().map((p) => Math.round(p.y)));
    expect(rows.size).toBeGreaterThanOrEqual(28);
    expect(rows.size).toBeLessThanOrEqual(32);
  });

  it('staggers penetrations between rows instead of lining them up', () => {
    const runs = generateTatamiFill([SQUARE], SETTINGS, { angle: 0, stitchLength: 25 });
    const offsets = new Set(
      runs
        .flat()
        // Interior penetrations only; row ends always land on the boundary.
        .filter((p) => p.x > 1 && p.x < 299)
        .map((p) => Math.round(((p.x % 25) + 25) % 25)),
    );
    expect(offsets.size).toBeGreaterThan(1);
  });

  it('respects holes', () => {
    const runs = generateTatamiFill([SQUARE, HOLE], SETTINGS, { angle: 0 });
    // Row ends land exactly on the hole boundary, where ray casting is
    // ambiguous by definition, so test the strict interior.
    for (const point of runs.flat()) {
      const inside =
        point.x > 120.001 && point.x < 179.999 && point.y > 120.001 && point.y < 179.999;
      expect(inside).toBe(false);
    }
  });

  it('keeps every move within a stitch length or a row turn', () => {
    const runs = generateTatamiFill([SQUARE], SETTINGS, { angle: 0, stitchLength: 25 });
    for (const run of runs) {
      for (let i = 1; i < run.length; i++) {
        expect(distance(run[i - 1], run[i])).toBeLessThanOrEqual(26);
      }
    }
  });

  it('rotates with the fill angle', () => {
    const horizontal = generateTatamiFill([SQUARE], SETTINGS, { angle: 0, spacing: 20 }).flat();
    const vertical = generateTatamiFill([SQUARE], SETTINGS, { angle: 90, spacing: 20 }).flat();
    expect(new Set(horizontal.map((p) => Math.round(p.y))).size).toBeLessThan(
      horizontal.length / 2,
    );
    expect(new Set(vertical.map((p) => Math.round(p.x))).size).toBeLessThan(vertical.length / 2);
  });

  it('produces concentric rings for a contour fill', () => {
    const runs = generateContourFill(SQUARE, SETTINGS, { spacing: 20 });
    expect(runs.length).toBeGreaterThan(2);
    for (let i = 1; i < runs.length; i++) {
      expect(measureRuns([runs[i]])).toBeLessThan(measureRuns([runs[i - 1]]));
    }
  });

  it('drops rows too short to be worth stitching', () => {
    // A hairline standing on end: every row spans 0.1 units, well under the
    // minimum stitch length, so nothing survives.
    const sliver: Point[] = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
      { x: 0.1, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(generateTatamiFill([sliver], SETTINGS, { angle: 0, spacing: 4 })).toEqual([]);
  });
});

describe('underlay', () => {
  it('stays inside the shape it supports', () => {
    const runs = generateFillUnderlay([SQUARE], SETTINGS);
    expect(runs.length).toBeGreaterThan(0);
    for (const point of runs.flat()) {
      expect(pointInPolygon(point, SQUARE)).toBe(true);
    }
  });

  it('crosses the top fill direction rather than running with it', () => {
    const settings = resolveStitchSettings({
      fillAngle: 0,
      underlay: { type: 'zigzag', fillSpacing: 30 },
    });
    const points = generateFillUnderlay([SQUARE], settings).flat();
    expect(points.length).toBeGreaterThan(4);
    // Rows at 90 degrees means constant x per row, so few distinct columns.
    expect(new Set(points.map((p) => Math.round(p.x))).size).toBeLessThan(points.length / 2);
  });

  it('gives a satin column a centre walk down the middle', () => {
    const rails = ringToSatinRails(RIBBON)!;
    const runs = generateSatinUnderlay(
      rails,
      resolveStitchSettings({ underlay: { type: 'center-walk' } }),
    );
    expect(runs).toHaveLength(1);
    for (const point of runs[0]) {
      expect(point.y).toBeGreaterThan(5);
      expect(point.y).toBeLessThan(25);
    }
  });

  it('can be turned off entirely', () => {
    expect(generateFillUnderlay([SQUARE], resolveStitchSettings({ underlay: { type: 'none' } })))
      .toEqual([]);
  });
});

describe('stitch type routing', () => {
  it('sends a narrow ribbon to satin', () => {
    expect(chooseStitchType([RIBBON], SETTINGS).type).toBe('satin');
  });

  it('sends a broad area to a fill', () => {
    expect(chooseStitchType([SQUARE], SETTINGS).type).toBe('fill');
  });

  it('sends a hairline to a bean stitch', () => {
    const hairline: Point[] = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 5 },
      { x: 0, y: 5 },
    ];
    expect(chooseStitchType([hairline], SETTINGS).type).toBe('bean');
  });

  it('honours an explicit choice without measuring', () => {
    const decision = chooseStitchType([SQUARE], SETTINGS, 'satin');
    expect(decision.type).toBe('satin');
    expect(decision.width).toBeNull();
  });

  it('explains itself', () => {
    expect(chooseStitchType([RIBBON], SETTINGS).reason).toMatch(/mm/);
  });

  it('estimates a stitch count in the right ballpark', () => {
    const estimate = estimateStitchCount([SQUARE], 'fill', SETTINGS);
    const actual = generateTatamiFill([SQUARE], SETTINGS).flat().length;
    expect(estimate.stitches).toBeGreaterThan(actual * 0.3);
    expect(estimate.stitches).toBeLessThan(actual * 3);
  });
});

describe('generateRegionStitches', () => {
  it('emits underlay before the visible pass', () => {
    const result = generateRegionStitches([SQUARE], SETTINGS);
    expect(result.type).toBe('fill');
    expect(result.runs.length).toBeGreaterThan(1);
    expect(measureRuns([result.runs[0]])).toBeLessThan(measureRuns(result.runs) / 2);
  });

  it('satins a ribbon and fills a blob from the same call', () => {
    expect(generateRegionStitches([RIBBON], SETTINGS).type).toBe('satin');
    expect(generateRegionStitches([SQUARE], SETTINGS).type).toBe('fill');
  });

  it('falls back to a fill when a ring will not form a column', () => {
    const settings = resolveStitchSettings({ maxSatinWidth: 100000 });
    expect(generateRegionStitches([SQUARE], settings, 'satin').runs.length).toBeGreaterThan(0);
  });

  it('produces nothing for a degenerate region instead of throwing', () => {
    expect(() => generateRegionStitches([[{ x: 0, y: 0 }]], SETTINGS)).not.toThrow();
  });
});
