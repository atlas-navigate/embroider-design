import { describe, expect, it } from 'vitest';
import {
  booleanRings,
  hollowRings,
  mergeOverlappingRings,
  tryBooleanRings,
  unionAll,
} from '../../src/geometry/boolean.js';
import { groupRingsIntoRegions } from '../../src/geometry/regions.js';
import { polygonArea } from '../../src/geometry/path.js';
import type { Point } from '../../src/geometry/point.js';

/**
 * Boolean operations decide what a custom shape *is*, and they fail quietly:
 * a subtraction that leaves a stray sliver still stitches, it just stitches the
 * wrong thing. These tests check the results by area and by nesting rather than
 * by vertex list, because the vertex list is the clipper's business and the
 * area and the nesting are the user's.
 */

function square(x: number, y: number, size: number): Point[] {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
}

function circle(cx: number, cy: number, radius: number, steps = 128): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return points;
}

/** Total enclosed area: outers less their holes. */
function filledArea(rings: readonly Point[][]): number {
  let total = 0;
  for (const region of groupRingsIntoRegions(rings)) {
    total += polygonArea(region.outer);
    for (const hole of region.holes) total -= polygonArea(hole);
  }
  return total;
}

describe('booleanRings', () => {
  it('subtracts an overlapping square', () => {
    const result = booleanRings([square(0, 0, 100)], [square(50, 50, 100)], 'difference');
    expect(filledArea(result)).toBeCloseTo(10000 - 2500, 3);
  });

  it('intersects to the overlap alone', () => {
    const result = booleanRings([square(0, 0, 100)], [square(50, 50, 100)], 'intersection');
    expect(filledArea(result)).toBeCloseTo(2500, 3);
  });

  it('unions two overlapping squares into one region', () => {
    const result = booleanRings([square(0, 0, 100)], [square(50, 50, 100)], 'union');
    expect(groupRingsIntoRegions(result)).toHaveLength(1);
    expect(filledArea(result)).toBeCloseTo(10000 + 10000 - 2500, 3);
  });

  it('excludes the overlap, leaving two pieces', () => {
    const result = booleanRings([square(0, 0, 100)], [square(50, 50, 100)], 'xor');
    expect(filledArea(result)).toBeCloseTo(15000, 3);
  });

  /**
   * The case that sinks hand-rolled clippers, and the reason this module takes
   * a dependency at all. Cutting a shape flush with its own edge is an entirely
   * ordinary thing to ask of a CAD tool.
   */
  it('subtracts a rectangle sharing an edge with the subject', () => {
    const subject = square(0, 0, 100);
    const flush: Point[] = [
      { x: 0, y: 60 },
      { x: 100, y: 60 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const result = booleanRings([subject], [flush], 'difference');
    expect(groupRingsIntoRegions(result)).toHaveLength(1);
    expect(filledArea(result)).toBeCloseTo(6000, 3);
  });

  it('subtracts a shape that shares a whole corner', () => {
    const result = booleanRings([square(0, 0, 100)], [square(0, 0, 40)], 'difference');
    expect(filledArea(result)).toBeCloseTo(10000 - 1600, 3);
  });

  it('cuts a hole rather than a bite when the clip is fully inside', () => {
    const result = booleanRings([square(0, 0, 100)], [square(30, 30, 40)], 'difference');
    const regions = groupRingsIntoRegions(result);
    expect(regions).toHaveLength(1);
    expect(regions[0].holes).toHaveLength(1);
    expect(filledArea(result)).toBeCloseTo(10000 - 1600, 3);
  });

  it('keeps an existing hole through a subtraction', () => {
    // A ring, then a bite out of one side of it.
    const ring = [circle(50, 50, 40), circle(50, 50, 25)];
    const result = booleanRings(ring, [square(-10, -10, 40)], 'difference');
    expect(filledArea(result)).toBeLessThan(filledArea(ring));
    expect(groupRingsIntoRegions(result)[0].holes.length).toBeGreaterThan(0);
  });

  it('treats an empty clip as a no-op, except for intersection', () => {
    const subject = [square(0, 0, 100)];
    expect(filledArea(booleanRings(subject, [], 'difference'))).toBeCloseTo(10000, 3);
    expect(filledArea(booleanRings(subject, [], 'union'))).toBeCloseTo(10000, 3);
    expect(booleanRings(subject, [], 'intersection')).toHaveLength(0);
  });

  it('returns nothing when disjoint shapes are intersected', () => {
    expect(booleanRings([square(0, 0, 10)], [square(500, 500, 10)], 'intersection')).toHaveLength(
      0,
    );
  });

  it('discards degenerate input instead of throwing', () => {
    const degenerate: Point[] = [
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ];
    const result = tryBooleanRings([square(0, 0, 100)], [degenerate], 'difference');
    expect(result.failed).toBe(false);
    expect(filledArea(result.rings)).toBeCloseTo(10000, 3);
  });

  it('unions a list of shapes in one pass', () => {
    const result = unionAll([[square(0, 0, 40)], [square(30, 0, 40)], [square(60, 0, 40)]]);
    expect(groupRingsIntoRegions(result)).toHaveLength(1);
  });
});

describe('hollowRings', () => {
  it('turns a disc into a ring of the requested wall thickness', () => {
    const result = hollowRings([circle(50, 50, 40)], 8);
    const regions = groupRingsIntoRegions(result);
    expect(regions).toHaveLength(1);
    expect(regions[0].holes).toHaveLength(1);

    // Wall area = pi*(40^2 - 32^2), within the tolerance of a 128-gon.
    expect(filledArea(result)).toBeCloseTo(Math.PI * (40 * 40 - 32 * 32), -1);
  });

  it('leaves two walls when hollowing a shape that already has a hole', () => {
    const donut = [circle(50, 50, 45), circle(50, 50, 20)];
    const result = hollowRings(donut, 5);
    const regions = groupRingsIntoRegions(result);
    // Outer wall and inner wall: two concentric bands, so two regions.
    expect(regions.length).toBeGreaterThanOrEqual(2);
    expect(filledArea(result)).toBeLessThan(filledArea(donut));
  });

  it('reports failure by returning nothing when the wall is thicker than the shape', () => {
    expect(hollowRings([circle(50, 50, 10)], 30)).toHaveLength(0);
  });

  it('is a no-op at zero thickness', () => {
    const rings = [square(0, 0, 100)];
    expect(filledArea(hollowRings(rings, 0))).toBeCloseTo(10000, 6);
  });
});

/**
 * The catalogue is drawn the way people draw: a cloud is overlapping circles.
 * Nothing rejects that, and every blob does stitch — but the seam between two
 * of them gets sewn twice in the same thread, which is a ridge on the garment.
 */
describe('mergeOverlappingRings', () => {
  it('joins two overlapping blobs into one area, counted once', () => {
    const merged = mergeOverlappingRings([square(0, 0, 60), square(40, 0, 60)]);
    expect(groupRingsIntoRegions(merged)).toHaveLength(1);
    // 60x60 twice, less the 20x60 they share.
    expect(filledArea(merged)).toBeCloseTo(60 * 60 * 2 - 20 * 60, 3);
  });

  it('keeps a hole a hole', () => {
    const merged = mergeOverlappingRings([circle(50, 50, 40), circle(50, 50, 20)]);
    const regions = groupRingsIntoRegions(merged);
    expect(regions).toHaveLength(1);
    expect(regions[0].holes).toHaveLength(1);
    expect(filledArea(merged)).toBeCloseTo(Math.PI * (40 * 40 - 20 * 20), -1);
  });

  it('leaves shapes that do not touch exactly as they were', () => {
    const rings = [square(0, 0, 20), square(50, 0, 20), square(80, 0, 20)];
    const merged = mergeOverlappingRings(rings);
    expect(merged).toEqual(rings);
  });
});
