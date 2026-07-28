import { describe, expect, it } from 'vitest';
import {
  chooseCellSize,
  countMaskCells,
  distanceTransform,
  maskContains,
  maxInscribedCircle,
  rasterizeRings,
  regionWidthStats,
} from '../../src/geometry/distance-transform.js';
import {
  groupSegmentsIntoRuns,
  horizontalCrossings,
  scanFillSegments,
} from '../../src/geometry/scanline.js';
import { distance } from '../../src/geometry/point.js';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

const HOLE = [
  { x: 40, y: 40 },
  { x: 60, y: 40 },
  { x: 60, y: 60 },
  { x: 40, y: 60 },
];

describe('rasterisation', () => {
  it('fills a square and leaves the padding empty', () => {
    const mask = rasterizeRings([SQUARE], 1, 2)!;
    expect(mask).not.toBeNull();
    expect(maskContains(mask, { x: 50, y: 50 })).toBe(true);
    expect(maskContains(mask, { x: -1, y: -1 })).toBe(false);
    // 101 columns (x = 0..100 inclusive) but 100 rows: the half-open vertex
    // rule excludes y = 100, which is what stops a shared edge between two
    // stacked regions from being rasterised twice.
    expect(countMaskCells(mask)).toBe(100 * 101);
  });

  it('leaves holes empty via the even-odd rule', () => {
    const mask = rasterizeRings([SQUARE, HOLE], 1, 2)!;
    expect(maskContains(mask, { x: 50, y: 50 })).toBe(false);
    expect(maskContains(mask, { x: 20, y: 50 })).toBe(true);
  });

  it('caps the grid size for large regions', () => {
    const huge = { minX: 0, minY: 0, maxX: 1_000_000, maxY: 1_000_000 };
    const cell = chooseCellSize(huge, 0.1, 256, 100_000);
    expect((1_000_000 / cell + 4) ** 2).toBeLessThanOrEqual(100_000);
  });
});

describe('distance transform', () => {
  it('finds the inscribed circle of a square', () => {
    const mask = rasterizeRings([SQUARE], 1, 2)!;
    const circle = maxInscribedCircle(mask, distanceTransform(mask))!;
    expect(circle).not.toBeNull();
    // True radius is 50; the raster leaves a residual bias of about cell/2.
    expect(Math.abs(circle.radius - 50)).toBeLessThanOrEqual(1);
    expect(distance(circle.center, { x: 50, y: 50 })).toBeLessThan(2);
  });

  it('measures the width of a ribbon to within a cell', () => {
    const ribbon = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 20 },
      { x: 0, y: 20 },
    ];
    const stats = regionWidthStats([ribbon], 0.5)!;
    expect(stats).not.toBeNull();
    expect(stats.maxWidth).toBeGreaterThan(19);
    expect(stats.maxWidth).toBeLessThan(22);
    // The ribbon model is exactly what meanWidth assumes, so it should agree.
    expect(stats.meanWidth).toBeGreaterThan(17);
    expect(stats.meanWidth).toBeLessThan(23);
    expect(stats.area).toBeGreaterThan(400 * 20 * 0.9);
  });

  it('separates a narrow ribbon from a broad blob', () => {
    const narrow = regionWidthStats(
      [
        [
          { x: 0, y: 0 },
          { x: 500, y: 0 },
          { x: 500, y: 25 },
          { x: 0, y: 25 },
        ],
      ],
      0.5,
    )!;
    const broad = regionWidthStats(
      [
        [
          { x: 0, y: 0 },
          { x: 500, y: 0 },
          { x: 500, y: 300 },
          { x: 0, y: 300 },
        ],
      ],
      0.5,
    )!;
    expect(narrow.maxWidth).toBeLessThan(30);
    expect(broad.maxWidth).toBeGreaterThan(290);
  });
});

describe('scanline fill decomposition', () => {
  it('finds even-odd crossings across a hole', () => {
    expect(horizontalCrossings([SQUARE, HOLE], 50)).toEqual([0, 40, 60, 100]);
  });

  it('uses a half-open vertex rule so the top edge is not double-scanned', () => {
    expect(horizontalCrossings([SQUARE], 0)).toEqual([0, 100]);
    expect(horizontalCrossings([SQUARE], 100)).toEqual([]);
  });

  it('slices a square into evenly spaced full-width rows', () => {
    const segments = scanFillSegments([SQUARE], 10);
    expect(segments).toHaveLength(10);
    for (const segment of segments) {
      expect(segment.start.x).toBeCloseTo(0, 9);
      expect(segment.end.x).toBeCloseTo(100, 9);
    }
    expect(segments[0].start.y).toBeCloseTo(0, 9);
    expect(segments[9].start.y).toBeCloseTo(90, 9);
  });

  it('splits rows around a hole', () => {
    const segments = scanFillSegments([SQUARE, HOLE], 10);
    const rowCounts = new Map<number, number>();
    for (const segment of segments) {
      rowCounts.set(segment.row, (rowCounts.get(segment.row) ?? 0) + 1);
    }
    // y = 40 and y = 50 straddle the hole; every other row is unbroken.
    expect(rowCounts.get(4)).toBe(2);
    expect(rowCounts.get(5)).toBe(2);
    expect(rowCounts.get(0)).toBe(1);
    expect(rowCounts.get(9)).toBe(1);
  });

  it('rotates rows to the requested stitch angle', () => {
    const segments = scanFillSegments([SQUARE], 10, { angle: Math.PI / 2 });
    expect(segments.length).toBeGreaterThan(5);
    for (const segment of segments) {
      // Vertical rows: constant x, varying y.
      expect(Math.abs(segment.end.x - segment.start.x)).toBeLessThan(1e-6);
      expect(Math.abs(segment.end.y - segment.start.y)).toBeGreaterThan(50);
    }
  });

  it('rejects an unreasonable row count instead of hanging', () => {
    expect(() => scanFillSegments([SQUARE], 0.001, { maxRows: 100 })).toThrow(/row limit|rows/i);
  });

  it('groups segments into sewable runs, accounting for every segment', () => {
    const segments = scanFillSegments([SQUARE, HOLE], 10);
    const runs = groupSegmentsIntoRuns(segments);
    expect(runs.length).toBeGreaterThanOrEqual(2);
    const total = runs.reduce((sum, run) => sum + run.length, 0);
    expect(total).toBe(segments.length);
    for (const run of runs) {
      for (let i = 1; i < run.length; i++) {
        expect(run[i].row).toBe(run[i - 1].row + 1);
      }
    }
  });
});
