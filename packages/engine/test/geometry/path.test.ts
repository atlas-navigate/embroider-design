import { describe, expect, it } from 'vitest';
import {
  boundingBoxOfPoints,
  distanceToPolyline,
  ensureWinding,
  isCounterClockwise,
  pointAtDistanceAlong,
  pointInPolygon,
  pointInPolygonWithHoles,
  polygonCentroid,
  polygonSignedArea,
  polylineLength,
  resamplePolylinePreservingVertices,
  resamplePolylineUniform,
  totalTurning,
} from '../../src/geometry/path.js';
import { distance } from '../../src/geometry/point.js';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe('bounding boxes', () => {
  it('returns null for an empty point set', () => {
    expect(boundingBoxOfPoints([])).toBeNull();
  });

  it('bounds a square', () => {
    expect(boundingBoxOfPoints(SQUARE)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
  });
});

describe('polygon area and winding', () => {
  it('computes signed area, sign-following winding', () => {
    expect(polygonSignedArea(SQUARE)).toBe(10000);
    expect(polygonSignedArea([...SQUARE].reverse())).toBe(-10000);
  });

  it('reverses only when the winding is wrong', () => {
    const ccw = ensureWinding(SQUARE, true);
    expect(isCounterClockwise(ccw)).toBe(true);
    expect(ccw[1]).toEqual({ x: 100, y: 0 });

    const cw = ensureWinding(SQUARE, false);
    expect(isCounterClockwise(cw)).toBe(false);
  });

  it('finds the centroid of a square', () => {
    const centroid = polygonCentroid(SQUARE);
    expect(centroid.x).toBeCloseTo(50, 9);
    expect(centroid.y).toBeCloseTo(50, 9);
  });

  it('falls back to the vertex average for a degenerate ring', () => {
    const collinear = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    expect(polygonCentroid(collinear)).toEqual({ x: 10, y: 0 });
  });
});

describe('point containment', () => {
  it('classifies points against a square', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, SQUARE)).toBe(true);
    expect(pointInPolygon({ x: 150, y: 50 }, SQUARE)).toBe(false);
    expect(pointInPolygon({ x: -1, y: -1 }, SQUARE)).toBe(false);
  });

  it('excludes holes', () => {
    const hole = [
      { x: 40, y: 40 },
      { x: 60, y: 40 },
      { x: 60, y: 60 },
      { x: 40, y: 60 },
    ];
    expect(pointInPolygonWithHoles({ x: 50, y: 50 }, SQUARE, [hole])).toBe(false);
    expect(pointInPolygonWithHoles({ x: 20, y: 20 }, SQUARE, [hole])).toBe(true);
  });
});

describe('distances along paths', () => {
  it('measures perimeter with and without the closing edge', () => {
    expect(polylineLength(SQUARE)).toBe(300);
    expect(polylineLength(SQUARE, true)).toBe(400);
  });

  it('measures distance to a closed ring from inside and outside', () => {
    expect(distanceToPolyline({ x: 50, y: 50 }, SQUARE, true)).toBeCloseTo(50, 9);
    expect(distanceToPolyline({ x: 120, y: 50 }, SQUARE, true)).toBeCloseTo(20, 9);
  });

  it('locates a point at a given arc length, clamping past the end', () => {
    const at150 = pointAtDistanceAlong(SQUARE, 150);
    expect(at150?.point.x).toBeCloseTo(100, 9);
    expect(at150?.point.y).toBeCloseTo(50, 9);

    const past = pointAtDistanceAlong(SQUARE, 9999);
    expect(past?.point).toEqual({ x: 0, y: 100 });
  });
});

describe('resampling', () => {
  it('walks a straight line at exact spacing', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const sampled = resamplePolylineUniform(line, 25);
    expect(sampled).toHaveLength(5);
    expect(sampled.map((p) => p.x)).toEqual([0, 25, 50, 75, 100]);
  });

  it('carries leftover distance across vertices instead of resetting', () => {
    // Two 30-unit legs at 20 spacing: samples land at 20, 40 (10 into leg 2), 60.
    const bent = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 30 },
    ];
    const sampled = resamplePolylineUniform(bent, 20, { minTailRatio: 0 });
    expect(sampled).toHaveLength(4);
    expect(sampled[1]).toEqual({ x: 20, y: 0 });
    expect(sampled[2].x).toBeCloseTo(30, 9);
    expect(sampled[2].y).toBeCloseTo(10, 9);
    expect(sampled[3]).toEqual({ x: 30, y: 30 });
  });

  it('absorbs a stub tail rather than emitting a needle-breaking stitch', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 102, y: 0 },
    ];
    const sampled = resamplePolylineUniform(line, 50, { minTailRatio: 0.35 });
    // Samples at 0, 50, 100 leave a 2-unit tail, which is folded into the last.
    expect(sampled.map((p) => p.x)).toEqual([0, 50, 102]);
  });

  it('preserves every vertex when asked to', () => {
    const sampled = resamplePolylinePreservingVertices(SQUARE, 40, true);
    for (const corner of SQUARE) {
      expect(sampled.some((p) => distance(p, corner) < 1e-9)).toBe(true);
    }
    // 4 edges of 100 at max 40 => 3 divisions each, plus the starting point.
    expect(sampled).toHaveLength(13);
    for (let i = 1; i < sampled.length; i++) {
      expect(distance(sampled[i - 1], sampled[i])).toBeLessThanOrEqual(40 + 1e-9);
    }
  });
});

describe('totalTurning', () => {
  it('sums to a full turn around a closed square', () => {
    expect(totalTurning(SQUARE, true)).toBeCloseTo(2 * Math.PI, 9);
  });

  it('is zero for a straight line', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    expect(totalTurning(line)).toBeCloseTo(0, 9);
  });
});
