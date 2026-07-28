import { describe, expect, it } from 'vitest';
import { distance, type Point } from '../../src/geometry/point.js';
import { rasterizeRings } from '../../src/geometry/distance-transform.js';
import { resolveStitchSettings } from '../../src/stitchgen/settings.js';
import {
  medianHalfWidth,
  skeletonizeRegion,
  skeletonLength,
  thinMask,
} from '../../src/stitchgen/skeleton.js';
import {
  branchToColumnSpec,
  generateColumnStitches,
  orderSatinColumns,
  railsFromCenterline,
  regionToSatinColumns,
  type SatinColumnSpec,
} from '../../src/stitchgen/auto-satin.js';
import { generateSatinFromCenterline } from '../../src/stitchgen/satin-column.js';
import { generateRegionStitches } from '../../src/stitchgen/region.js';

const SETTINGS = resolveStitchSettings();

/** A 400 x 30 bar: 3 mm wide, squarely satin territory. */
const BAR: Point[] = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 30 },
  { x: 0, y: 30 },
];

/** A plus sign made of two crossing 30-wide bars. */
const PLUS: Point[] = [
  { x: 85, y: 0 },
  { x: 115, y: 0 },
  { x: 115, y: 85 },
  { x: 200, y: 85 },
  { x: 200, y: 115 },
  { x: 115, y: 115 },
  { x: 115, y: 200 },
  { x: 85, y: 200 },
  { x: 85, y: 115 },
  { x: 0, y: 115 },
  { x: 0, y: 85 },
  { x: 85, y: 85 },
];

function circle(cx: number, cy: number, radius: number, segments = 64): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return points;
}

function maxStep(points: readonly Point[]): number {
  let max = 0;
  for (let i = 1; i < points.length; i++) max = Math.max(max, distance(points[i - 1], points[i]));
  return max;
}

function maxStepAcross(runs: readonly (readonly Point[])[]): number {
  let max = 0;
  for (const run of runs) max = Math.max(max, maxStep(run));
  return max;
}

describe('thinMask', () => {
  it('reduces a solid bar to a one-pixel line', () => {
    const mask = rasterizeRings([BAR], 2);
    expect(mask).not.toBeNull();
    const thinned = thinMask(mask!);

    let count = 0;
    let maxDegree = 0;
    for (let y = 1; y < mask!.height - 1; y++) {
      for (let x = 1; x < mask!.width - 1; x++) {
        const index = y * mask!.width + x;
        if (thinned[index] === 0) continue;
        count++;
        let degree = 0;
        for (const [dx, dy] of [
          [0, -1],
          [1, -1],
          [1, 0],
          [1, 1],
          [0, 1],
          [-1, 1],
          [-1, 0],
          [-1, -1],
        ]) {
          degree += thinned[index + dy * mask!.width + dx];
        }
        maxDegree = Math.max(maxDegree, degree);
      }
    }
    // Roughly one pixel per cell along the 400-unit length, not per area.
    expect(count).toBeGreaterThan(150);
    expect(count).toBeLessThan(260);
    // Every pixel is a path pixel or a tip. Anything higher is a false junction.
    expect(maxDegree).toBeLessThanOrEqual(2);
  });
});

describe('skeletonizeRegion', () => {
  it('finds one open branch down a straight bar, with the right half-width', () => {
    const branches = skeletonizeRegion([BAR], { minCell: 1 });
    expect(branches).not.toBeNull();
    expect(branches!.length).toBe(1);

    const branch = branches![0];
    expect(branch.closed).toBe(false);
    expect(branch.startAtJunction).toBe(false);
    expect(branch.endAtJunction).toBe(false);
    // The bar is 30 wide, so the centreline sits 15 from each edge.
    expect(medianHalfWidth(branches!)).toBeGreaterThan(13);
    expect(medianHalfWidth(branches!)).toBeLessThan(16);
    // Thinning stops half a stroke short of each end: 400 - 30.
    expect(skeletonLength(branches!)).toBeGreaterThan(340);
    expect(skeletonLength(branches!)).toBeLessThan(400);
  });

  it('returns a single closed loop for an annulus', () => {
    const branches = skeletonizeRegion([circle(200, 200, 100), circle(200, 200, 70)], {
      minCell: 1,
    });
    expect(branches).not.toBeNull();
    expect(branches!.length).toBe(1);
    expect(branches![0].closed).toBe(true);
    // Mid-radius circumference is 2*pi*85.
    expect(skeletonLength(branches!)).toBeGreaterThan(480);
    expect(skeletonLength(branches!)).toBeLessThan(560);
  });

  it('splits a plus sign into four limbs at its junction', () => {
    const branches = skeletonizeRegion([PLUS], { minCell: 1 });
    expect(branches).not.toBeNull();
    const limbs = branches!.filter((branch) => !branch.closed && branch.startAtJunction !== branch.endAtJunction);
    expect(limbs.length).toBe(4);
  });
});

describe('regionToSatinColumns', () => {
  it('gives one column for a bar', () => {
    const columns = regionToSatinColumns([BAR], SETTINGS);
    expect(columns).not.toBeNull();
    expect(columns!.length).toBe(1);
    expect(columns![0].closed).toBe(false);
  });

  it('gives four columns for a plus sign', () => {
    const columns = regionToSatinColumns([PLUS], SETTINGS);
    expect(columns).not.toBeNull();
    expect(columns!.length).toBe(4);
  });

  it('refuses a disc, which has no stroke to follow', () => {
    const columns = regionToSatinColumns([circle(200, 200, 120)], SETTINGS);
    expect(columns).toEqual([]);
  });
});

describe('branchToColumnSpec', () => {
  it('extends free ends out to the tip of the stroke', () => {
    const branches = skeletonizeRegion([BAR], { minCell: 1 });
    const spec = branchToColumnSpec(branches![0]);
    expect(spec).not.toBeNull();

    const xs = spec!.center.map((p) => p.x);
    // Extension pushes each end out by its own half-width, reaching x=0..400.
    expect(Math.min(...xs)).toBeLessThan(8);
    expect(Math.max(...xs)).toBeGreaterThan(392);
  });

  it('caps the half-width at the limit it is given', () => {
    const branches = skeletonizeRegion([BAR], { minCell: 1 });
    const spec = branchToColumnSpec(branches![0], 5);
    expect(Math.max(...spec!.halfWidths)).toBeLessThanOrEqual(5);
  });
});

describe('railsFromCenterline', () => {
  it('places rails a half-width either side, perpendicular to travel', () => {
    const center: Point[] = [
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ];
    const rails = railsFromCenterline(center, [10, 10, 10], false);
    expect(rails.left).toHaveLength(3);
    expect(rails.right).toHaveLength(3);
    // Travelling along +x, the rails sit at y = 110 and y = 90.
    expect(rails.left[1].y).toBeCloseTo(110, 6);
    expect(rails.right[1].y).toBeCloseTo(90, 6);
    expect(rails.left[1].x).toBeCloseTo(100, 6);
  });
});

describe('generateSatinFromCenterline', () => {
  const center: Point[] = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
  ];
  const widths = [15, 15];

  it('alternates sides, one penetration per half-step', () => {
    const column = generateSatinFromCenterline(center, widths, SETTINGS, {
      pullCompensation: 0,
    });
    // 200 long at 4-unit density: 100 half-steps, so 101 penetrations.
    expect(column.length).toBe(101);
    for (let i = 0; i < column.length; i++) {
      expect(column[i].y).toBeCloseTo(i % 2 === 0 ? 15 : -15, 6);
    }
  });

  it('widens by the pull compensation', () => {
    const column = generateSatinFromCenterline(center, widths, SETTINGS, {
      pullCompensation: 3,
    });
    expect(Math.abs(column[0].y)).toBeCloseTo(18, 6);
  });

  it('walks a reverse curve without skewing the crossings', () => {
    // An S: the outer rail swaps sides half way, which is exactly what breaks
    // any scheme that pairs the two rails by proportional arc length.
    const s: Point[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * Math.PI * 2;
      s.push({ x: i * 5, y: Math.sin(t) * 60 });
    }
    const column = generateSatinFromCenterline(
      s,
      s.map(() => 12),
      SETTINGS,
      { pullCompensation: 0 },
    );
    // Every crossing should be about the column width, never a long diagonal.
    expect(maxStep(column)).toBeLessThan(24 * 1.35);
  });

  it('closes the loop when asked', () => {
    const loop = circle(0, 0, 100, 48);
    const open = generateSatinFromCenterline(loop, loop.map(() => 10), SETTINGS);
    const closed = generateSatinFromCenterline(loop, loop.map(() => 10), SETTINGS, {
      closed: true,
    });
    expect(closed.length).toBeGreaterThan(open.length);
    // The last crossing lands back beside the first.
    expect(distance(closed[closed.length - 1], closed[0])).toBeLessThan(25);
  });
});

describe('orderSatinColumns', () => {
  function spec(from: Point, to: Point): SatinColumnSpec {
    const center = [from, to];
    return {
      center,
      halfWidths: [10, 10],
      closed: false,
      rails: railsFromCenterline(center, [10, 10], false),
    };
  }

  it('takes the nearest column next, reversing it when that is closer', () => {
    const far = spec({ x: 900, y: 0 }, { x: 1000, y: 0 });
    // This one's *end* is nearest the origin, so it should be flipped.
    const near = spec({ x: 200, y: 0 }, { x: 20, y: 0 });
    const ordered = orderSatinColumns([far, near], { x: 0, y: 0 });
    expect(ordered[0].center[0].x).toBe(20);
    expect(ordered[0].center[1].x).toBe(200);
    expect(ordered[1].center[0].x).toBe(900);
  });
});

describe('satin on real shapes', () => {
  it('keeps every stitch near the column width on a bar', () => {
    const columns = regionToSatinColumns([BAR], SETTINGS);
    const runs = generateColumnStitches(columns![0], SETTINGS);
    // 30 wide plus 2 mm of pull compensation either side.
    expect(maxStepAcross(runs)).toBeLessThan(30 + 4 * SETTINGS.pullCompensation);
  });

  it('never folds a stitch across a branching shape', () => {
    // The regression this whole module exists for: a single pair of rails
    // walked around a plus sign produces stitches spanning the whole shape.
    const result = generateRegionStitches([PLUS], SETTINGS);
    expect(result.type).toBe('satin');
    expect(maxStepAcross(result.runs)).toBeLessThan(60);
    // 200 across at 30 wide: a fold would be 100+ units long.
    expect(result.runs.length).toBeGreaterThanOrEqual(4);
  });

  it('falls back to a fill when there is no stroke structure', () => {
    const result = generateRegionStitches([circle(200, 200, 120)], SETTINGS);
    expect(result.type).toBe('fill');
  });
});
