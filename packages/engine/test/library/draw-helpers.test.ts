import { describe, expect, it } from 'vitest';
import {
  blob,
  circle,
  crescent,
  domeRect,
  ellipse,
  heart,
  leaf,
  polygon,
  roundRect,
  scallop,
  scallopRing,
  star,
} from '../../src/library/data/draw.js';
import {
  KEYLINE,
  circleBand,
  ellipseBand,
  heartBand,
  leafBand,
  polyPath,
  polygonBand,
  roundRectBand,
  starBand,
  strokeBand,
} from '../../src/library/data/keyline.js';
import { highlight, ribs, taper, veins, weave } from '../../src/library/data/detail.js';
import { cuteFace } from '../../src/library/data/face.js';
import { pathFromData } from '../../src/library/path-data.js';
import { shapeToRings } from '../../src/document/shapes.js';
import { groupRingsIntoRegions } from '../../src/geometry/regions.js';
import { boundingBoxOfMany } from '../../src/geometry/path.js';

/**
 * The authoring helpers, checked before 141 icons are drawn with them.
 *
 * The failures these catch are all silent. A band whose cavity collapsed still
 * parses, still stitches, and comes out as a solid blob where an outline should
 * be. A helper that strays outside the box it was asked for still works until
 * `shape-library.test.ts` rejects the icon built from it, by which point the
 * fault looks like the icon's rather than the helper's.
 */

function regionsOf(d: string): ReturnType<typeof groupRingsIntoRegions> {
  return groupRingsIntoRegions(shapeToRings(pathFromData(d)));
}

function boxOf(d: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const box = boundingBoxOfMany(shapeToRings(pathFromData(d)));
  expect(box, 'path enclosed nothing').not.toBeNull();
  return box!;
}

/** Every solid helper: one filled area, no holes, inside the box it was given. */
const SOLIDS: { name: string; d: string; box: [number, number, number, number] }[] = [
  { name: 'blob', d: blob(50, 10, 60, 80), box: [20, 10, 80, 90] },
  { name: 'blob, no bulge', d: blob(50, 10, 60, 80, 0), box: [20, 10, 80, 90] },
  { name: 'blob, full bulge', d: blob(50, 10, 60, 80, 1), box: [20, 10, 80, 90] },
  { name: 'domeRect', d: domeRect(20, 10, 60, 80, 30), box: [20, 10, 80, 90] },
  { name: 'domeRect, flat', d: domeRect(20, 10, 60, 80, 0), box: [20, 10, 80, 90] },
  { name: 'scallop', d: scallop(10, 10, 80, 40, 5), box: [10, 10, 90, 62] },
  { name: 'scallop up', d: scallop(10, 20, 80, 40, 5, true), box: [10, 8, 90, 60] },
  { name: 'scallopRing', d: scallopRing(50, 50, 30, 8, 8), box: [12, 12, 88, 88] },
  { name: 'crescent', d: crescent(50, 50, 40, 10), box: [8, 8, 92, 92] },
  { name: 'taper', d: taper(10, 50, 90, 50, 6), box: [10, 44, 90, 56] },
  { name: 'taper, bowed', d: taper(10, 50, 90, 50, 6, 12), box: [10, 44, 90, 70] },
  { name: 'highlight', d: highlight(50, 50, 40), box: [8, 8, 92, 92] },
];

describe('solid helpers', () => {
  for (const { name, d, box } of SOLIDS) {
    it(`${name} makes one filled area with no holes`, () => {
      const regions = regionsOf(d);
      expect(regions).toHaveLength(1);
      expect(regions[0].holes).toHaveLength(0);
      expect(regions[0].outer.length).toBeGreaterThanOrEqual(3);
    });

    it(`${name} stays inside the box it was given`, () => {
      const actual = boxOf(d);
      const slack = 0.5;
      expect(actual.minX).toBeGreaterThanOrEqual(box[0] - slack);
      expect(actual.minY).toBeGreaterThanOrEqual(box[1] - slack);
      expect(actual.maxX).toBeLessThanOrEqual(box[2] + slack);
      expect(actual.maxY).toBeLessThanOrEqual(box[3] + slack);
    });
  }
});

/**
 * Every band: one filled area with exactly one hole.
 *
 * This is the assertion the whole redraw rests on. A band with no hole is a
 * blob; a band whose "hole" landed outside its own contour becomes two separate
 * filled areas, which stitches as an outline with a solid shape inside it.
 */
const BANDS: { name: string; d: string; outer: string }[] = [
  { name: 'circleBand', d: circleBand(50, 50, 40), outer: circle(50, 50, 40) },
  { name: 'ellipseBand', d: ellipseBand(50, 50, 40, 25), outer: ellipse(50, 50, 40, 25) },
  {
    name: 'roundRectBand',
    d: roundRectBand(10, 20, 80, 60, 12),
    outer: roundRect(10, 20, 80, 60, 12),
  },
  { name: 'polygonBand', d: polygonBand(50, 50, 40, 6), outer: polygon(50, 50, 40, 6) },
  { name: 'starBand', d: starBand(50, 50, 45, 20, 5), outer: star(50, 50, 45, 20, 5) },
  { name: 'heartBand', d: heartBand(50, 15, 70, 70), outer: heart(50, 15, 70, 70) },
  { name: 'leafBand', d: leafBand(50, 10, 44, 80), outer: leaf(50, 10, 44, 80) },
  {
    name: 'strokeBand, closed',
    d: strokeBand(
      [
        [20, 20],
        [80, 20],
        [80, 80],
        [20, 80],
      ],
      4,
      { closed: true },
    ),
    outer: '',
  },
];

describe('keyline bands', () => {
  for (const { name, d } of BANDS) {
    it(`${name} encloses exactly one hole`, () => {
      const regions = regionsOf(d);
      expect(regions, `${name} should be one filled area`).toHaveLength(1);
      expect(regions[0].holes, `${name} lost its cavity — it will stitch solid`).toHaveLength(1);
    });
  }

  for (const { name, d, outer } of BANDS) {
    if (!outer) continue;
    it(`${name} traces the same contour as the shape it outlines`, () => {
      // Rule 4: bands go inward. An outward band would grow the icon and
      // silently move where it lands when placed.
      const band = boxOf(d);
      const shape = boxOf(outer);
      const slack = 0.01;
      expect(band.minX).toBeGreaterThanOrEqual(shape.minX - slack);
      expect(band.minY).toBeGreaterThanOrEqual(shape.minY - slack);
      expect(band.maxX).toBeLessThanOrEqual(shape.maxX + slack);
      expect(band.maxY).toBeLessThanOrEqual(shape.maxY + slack);
    });
  }

  it('keeps a cavity even when the wall is thicker than the shape', () => {
    // The degradation that matters: too thick a wall must thin the hole, never
    // close it, or the icon silently gains a solid blob.
    for (const wall of [KEYLINE, 10, 40, 200]) {
      const regions = regionsOf(circleBand(50, 50, 20, wall));
      expect(regions, `wall ${wall}`).toHaveLength(1);
      expect(regions[0].holes, `wall ${wall} closed the cavity`).toHaveLength(1);
    }
  });

  it('lays an inside-aligned band exactly on the contour it was given', () => {
    // The property the icon files rely on: one array of points serves as both
    // the fill and its outline, so the two can never drift apart.
    const spiky: [number, number][] = [
      [50, 4],
      [58, 21],
      [70, 15],
      [66, 32],
      [83, 26],
      [74, 40],
      [96, 40],
      [82, 52],
      [74, 66],
      [60, 74],
      [50, 78],
      [40, 74],
      [26, 66],
      [18, 52],
      [4, 40],
      [26, 40],
      [17, 26],
      [34, 32],
      [30, 15],
      [42, 21],
    ];
    const band = strokeBand(spiky, KEYLINE, { closed: true, align: 'inside' });
    const regions = regionsOf(band);
    expect(regions, 'a concave outline should still be one area').toHaveLength(1);
    expect(regions[0].holes, 'the cavity collapsed on a concave contour').toHaveLength(1);

    const bandBox = boxOf(band);
    const fillBox = boxOf(polyPath(spiky));
    for (const key of ['minX', 'minY', 'maxX', 'maxY'] as const) {
      expect(bandBox[key], key).toBeCloseTo(fillBox[key], 6);
    }
  });

  it('gives an open strokeBand a solid ribbon, not a band', () => {
    const regions = regionsOf(
      strokeBand(
        [
          [10, 50],
          [50, 20],
          [90, 50],
        ],
        6,
      ),
    );
    expect(regions).toHaveLength(1);
    expect(regions[0].holes).toHaveLength(0);
  });

  it('varies an open strokeBand"s width along its length', () => {
    const thin = boxOf(
      strokeBand(
        [
          [10, 50],
          [90, 50],
        ],
        2,
      ),
    );
    const fat = boxOf(
      strokeBand(
        [
          [10, 50],
          [90, 50],
        ],
        (t) => 2 + t * 10,
      ),
    );
    expect(fat.maxY - fat.minY).toBeGreaterThan(thin.maxY - thin.minY);
  });
});

describe('detail helpers', () => {
  it('draws a midrib and a pair of veins for every entry', () => {
    const d = veins(50, 90, 50, 10, [
      { at: 0.35, length: 0.3, spread: 0.9 },
      { at: 0.6, length: 0.25, spread: 0.9 },
    ]);
    // One midrib plus two pairs.
    expect(regionsOf(d)).toHaveLength(5);
  });

  it('draws one rib per count and keeps them inside the ellipse', () => {
    const d = ribs(50, 50, 40, 40, 5);
    expect(regionsOf(d)).toHaveLength(5);
    const box = boxOf(d);
    expect(box.minX).toBeGreaterThan(10);
    expect(box.maxX).toBeLessThan(90);
    expect(box.minY).toBeGreaterThan(10);
    expect(box.maxY).toBeLessThan(90);
  });

  it('crosses a weave in both directions', () => {
    // Bars cross, so the regions merge; what matters is that it covers the box.
    const box = boxOf(weave(20, 20, 60, 60, 4));
    expect(box.maxX - box.minX).toBeGreaterThan(55);
    expect(box.maxY - box.minY).toBeGreaterThan(55);
  });

  it('returns nothing for a zero-length taper rather than a degenerate ring', () => {
    expect(taper(50, 50, 50, 50, 4)).toBe('');
  });
});

describe('cuteFace', () => {
  it('cuts solid eyes out of the head as well as filling them', () => {
    const face = cuteFace(50, 50, 40);
    // Rule: a solid feature is a counter-ring in the head *and* its own fill.
    expect(face.sockets).not.toBe('');
    expect(regionsOf(face.sockets)).toHaveLength(2);
    expect(face.ink).toContain(face.sockets.split(' Z')[0].trim().slice(0, 20));
  });

  it('does not cut out lashes, which are hairlines', () => {
    for (const look of ['closed', 'happy'] as const) {
      const face = cuteFace(50, 50, 40, { look });
      expect(face.sockets, look).toBe('');
      expect(regionsOf(face.ink).length, look).toBeGreaterThanOrEqual(2);
    }
  });

  it('puts the eyes below the centre line and well apart', () => {
    const face = cuteFace(50, 50, 40);
    const box = boxOf(face.sockets);
    expect(box.minY, 'eyes should sit below centre').toBeGreaterThan(50 - 40 * 0.1);
    expect(box.maxX - box.minX, 'eyes should be set wide').toBeGreaterThan(40 * 0.42);
  });

  it('can be asked for no blush and no smile', () => {
    const face = cuteFace(50, 50, 40, { blush: false, smile: false });
    expect(face.blush).toBe('');
    // Eyes only.
    expect(regionsOf(face.ink)).toHaveLength(2);
  });

  it('keeps the whole face inside the head it was sized for', () => {
    const face = cuteFace(50, 50, 40);
    const box = boxOf([face.sockets, face.ink, face.blush].join(' '));
    expect(box.minX).toBeGreaterThan(50 - 40);
    expect(box.maxX).toBeLessThan(50 + 40);
    expect(box.minY).toBeGreaterThan(50 - 40);
    expect(box.maxY).toBeLessThan(50 + 40);
  });
});
