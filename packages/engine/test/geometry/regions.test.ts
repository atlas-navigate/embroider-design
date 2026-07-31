import { describe, expect, it } from 'vitest';
import { groupRingsIntoRegions } from '../../src/geometry/regions.js';
import type { Point } from '../../src/geometry/point.js';

/**
 * Nesting is recovered, never declared — fonts, tracing and the shape catalogue
 * all hand over a flat pile of rings — so the rule that separates a hole from an
 * overlap is load-bearing for everything downstream. Get it wrong in one
 * direction and an "O" stitches solid; wrong in the other and a lobe of a cloud
 * is cut straight out of it.
 */

function square(x: number, y: number, size: number): Point[] {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
}

function circle(cx: number, cy: number, radius: number, steps = 64): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return points;
}

describe('groupRingsIntoRegions', () => {
  it('reads a fully enclosed ring as a hole', () => {
    const regions = groupRingsIntoRegions([square(0, 0, 100), square(30, 30, 40)]);
    expect(regions).toHaveLength(1);
    expect(regions[0].holes).toHaveLength(1);
  });

  it('starts a new filled area at the second level of nesting', () => {
    const regions = groupRingsIntoRegions([
      square(0, 0, 100),
      square(20, 20, 60),
      square(40, 40, 20),
    ]);
    // Outer with its hole, then the island inside the hole.
    expect(regions).toHaveLength(2);
    expect(regions[0].holes).toHaveLength(1);
    expect(regions[1].holes).toHaveLength(0);
  });

  /**
   * The case the shape catalogue is full of. The centre of the small circle
   * lands inside the big one, so an interior-point test alone calls it a hole
   * and cuts a bite out of the cloud — on screen and in the stitches. It is not
   * a hole: it is not *inside*, it merely overlaps.
   */
  it('keeps an overlapping blob filled rather than treating it as a hole', () => {
    const regions = groupRingsIntoRegions([circle(40, 50, 30), circle(70, 50, 20)]);
    expect(regions).toHaveLength(2);
    expect(regions.every((region) => region.holes.length === 0)).toBe(true);
  });

  it('still finds a hole that touches the boundary it is cut from', () => {
    // Left edges flush: a real counter can be tangent to its outline.
    const flush: Point[] = [
      { x: 0, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 80 },
      { x: 0, y: 80 },
    ];
    const regions = groupRingsIntoRegions([square(0, 0, 100), flush]);
    expect(regions).toHaveLength(1);
    expect(regions[0].holes).toHaveLength(1);
  });

  it('returns disjoint rings as separate filled areas, largest first', () => {
    const regions = groupRingsIntoRegions([square(0, 0, 20), square(50, 0, 40)]);
    expect(regions).toHaveLength(2);
    expect(regions[0].outer).toHaveLength(4);
    // Largest first, because callers stitch the big shapes before the detail.
    expect(Math.abs(regions[0].outer[1].x - regions[0].outer[0].x)).toBe(40);
  });
});
