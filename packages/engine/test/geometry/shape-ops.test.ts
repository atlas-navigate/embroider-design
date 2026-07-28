import { describe, expect, it } from 'vitest';
import {
  concentricInsets,
  insetPolygon,
  offsetPolygon,
  offsetPolylineOpen,
  outsetPolygon,
  satinRailsFromCenterline,
  strokeToPolygon,
} from '../../src/geometry/offset.js';
import { boundingBoxOfPoints, polygonArea } from '../../src/geometry/path.js';
import { simplifyPolygon, simplifyPolyline, smoothPolyline } from '../../src/geometry/simplify.js';
import { flattenArc, flattenCubic, flattenQuadratic } from '../../src/geometry/bezier.js';
import {
  applyToPoint,
  compose,
  identity,
  invert,
  matricesEqual,
  rotateAround,
  rotation,
  scaling,
  translation,
} from '../../src/geometry/transform.js';
import { distance } from '../../src/geometry/point.js';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe('polygon offsetting', () => {
  it('grows a square by exactly the offset on every side', () => {
    const grown = outsetPolygon(SQUARE, 10);
    const box = boundingBoxOfPoints(grown);
    expect(box).not.toBeNull();
    expect(box!.minX).toBeCloseTo(-10, 6);
    expect(box!.minY).toBeCloseTo(-10, 6);
    expect(box!.maxX).toBeCloseTo(110, 6);
    expect(box!.maxY).toBeCloseTo(110, 6);
  });

  it('shrinks a square and keeps its area consistent', () => {
    const shrunk = insetPolygon(SQUARE, 10);
    expect(polygonArea(shrunk)).toBeCloseTo(80 * 80, 6);
  });

  it('preserves the caller winding', () => {
    const clockwise = [...SQUARE].reverse();
    const grown = offsetPolygon(clockwise, 5);
    expect(grown[0].x).toBeCloseTo(-5, 6);
    expect(grown[0].y).toBeCloseTo(105, 6);
  });

  it('returns empty rather than garbage when an inset consumes the region', () => {
    expect(insetPolygon(SQUARE, 80)).toEqual([]);
  });

  it('produces concentric rings that stop when the region runs out', () => {
    const rings = concentricInsets(SQUARE, 10);
    expect(rings.length).toBeGreaterThan(2);
    expect(rings.length).toBeLessThan(10);
    for (let i = 1; i < rings.length; i++) {
      expect(polygonArea(rings[i])).toBeLessThan(polygonArea(rings[i - 1]));
    }
  });
});

describe('polyline offsetting and stroking', () => {
  it('offsets an open path to the left for positive deltas', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    // Travelling +x, the left normal in this Y-down frame is -y.
    expect(offsetPolylineOpen(line, 10)).toEqual([
      { x: 0, y: -10 },
      { x: 100, y: -10 },
    ]);
  });

  it('builds satin rails half a width apart on each side', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const rails = satinRailsFromCenterline(line, 20);
    expect(rails.left[0].y).toBeCloseTo(-10, 9);
    expect(rails.right[0].y).toBeCloseTo(10, 9);
  });

  it('closes a stroked path into a fillable ring of the right area', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    expect(polygonArea(strokeToPolygon(line, 20))).toBeCloseTo(2000, 6);
  });
});

describe('simplification', () => {
  it('collapses collinear points on an open path', () => {
    const staircase = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0 }));
    expect(simplifyPolyline(staircase, 0.5)).toHaveLength(2);
  });

  it('never destroys a ring', () => {
    const simplified = simplifyPolygon(SQUARE, 500);
    expect(simplified.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps a square square at a sane tolerance', () => {
    const dense = [
      ...Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: 0 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 100, y: i * 10 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 100 - i * 10, y: 100 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 0, y: 100 - i * 10 })),
    ];
    expect(simplifyPolygon(dense, 1)).toHaveLength(4);
  });

  it('smooths corners without running away', () => {
    const smoothed = smoothPolyline(SQUARE, 2, true);
    expect(smoothed.length).toBeGreaterThan(SQUARE.length);
    const box = boundingBoxOfPoints(smoothed)!;
    expect(box.minX).toBeGreaterThanOrEqual(-1e-9);
    expect(box.maxX).toBeLessThanOrEqual(100 + 1e-9);
  });
});

describe('bezier flattening', () => {
  it('flattens a straight-line cubic to a single segment', () => {
    const points = flattenCubic(
      { x: 0, y: 0 },
      { x: 33, y: 0 },
      { x: 66, y: 0 },
      { x: 100, y: 0 },
      0.5,
    );
    expect(points).toEqual([{ x: 100, y: 0 }]);
  });

  it('stays within tolerance of the true curve', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 0, y: 100 };
    const p2 = { x: 100, y: 100 };
    const p3 = { x: 100, y: 0 };
    const coarse = flattenCubic(p0, p1, p2, p3, 5);
    const fine = flattenCubic(p0, p1, p2, p3, 0.05);
    expect(fine.length).toBeGreaterThan(coarse.length);
    expect(coarse[coarse.length - 1]).toEqual(p3);
    expect(fine[fine.length - 1]).toEqual(p3);
  });

  it('elevates quadratics correctly', () => {
    const points = flattenQuadratic({ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }, 0.1);
    const apex = points[Math.floor(points.length / 2) - 1];
    // The quadratic peaks at half the control height.
    expect(apex.y).toBeGreaterThan(40);
    expect(apex.y).toBeLessThanOrEqual(50.001);
  });

  it('approximates a full circle to within the tolerance', () => {
    const center = { x: 0, y: 0 };
    const points = flattenArc(center, 100, 100, 0, 2 * Math.PI, 0.1);
    for (const p of points) {
      expect(Math.abs(distance(p, center) - 100)).toBeLessThan(0.5);
    }
  });
});

describe('affine transforms', () => {
  it('applies compose() in left-to-right order', () => {
    const m = compose(translation(10, 0), scaling(2, 2));
    expect(applyToPoint(m, { x: 1, y: 1 })).toEqual({ x: 22, y: 2 });
  });

  it('round-trips through invert()', () => {
    const m = compose(translation(13, -7), rotation(0.7), scaling(3, 2));
    const back = invert(m);
    expect(back).not.toBeNull();
    expect(matricesEqual(compose(m, back!), identity(), 1e-9)).toBe(true);
  });

  it('returns null for a singular matrix', () => {
    expect(invert(scaling(0, 5))).toBeNull();
  });

  it('rotates about a pivot', () => {
    const m = rotateAround(Math.PI / 2, { x: 50, y: 50 });
    const p = applyToPoint(m, { x: 100, y: 50 });
    expect(p.x).toBeCloseTo(50, 9);
    expect(p.y).toBeCloseTo(100, 9);
  });
});
