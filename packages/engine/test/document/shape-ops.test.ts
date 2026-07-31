import { describe, expect, it } from 'vitest';
import {
  combineLayers,
  hollowLayer,
  layerRings,
  outlineLayer,
  ringsToPath,
  sliceLayer,
} from '../../src/document/shape-ops.js';
import { createShapeLayer } from '../../src/document/layer.js';
import { ellipse, rectangle, shapeToRings } from '../../src/document/shapes.js';
import { createDesignDocument, addLayer } from '../../src/document/design-document.js';
import { compileDesignDocument } from '../../src/document/compile.js';
import { groupRingsIntoRegions } from '../../src/geometry/regions.js';
import { polygonArea } from '../../src/geometry/path.js';
import { translation } from '../../src/geometry/transform.js';
import { mmToUnits } from '../../src/pattern/units.js';
import {
  customShapeFromLayers,
  parseCustomShapes,
  serializeCustomShapes,
} from '../../src/library/custom-shape.js';
import { pathFromData } from '../../src/library/path-data.js';
import type { Point } from '../../src/geometry/point.js';

/**
 * Shape operations are how a user makes something the catalogue does not have,
 * and the failure that matters is silent: a subtraction that quietly ignores a
 * layer's transform cuts against where the shape *used* to be, which looks
 * plausible on the layer list and wrong on the fabric.
 */

function filledArea(rings: readonly Point[][]): number {
  let total = 0;
  for (const region of groupRingsIntoRegions(rings)) {
    total += polygonArea(region.outer);
    for (const hole of region.holes) total -= polygonArea(hole);
  }
  return total;
}

function squareLayer(x: number, y: number, size: number) {
  return createShapeLayer(rectangle(x, y, size, size));
}

describe('layerRings', () => {
  it('reports rings in document space, transform applied', () => {
    const layer = { ...squareLayer(0, 0, 100), transform: translation(500, 300) };
    const rings = layerRings(layer);
    expect(rings).not.toBeNull();
    expect(rings?.[0].every((point) => point.x >= 500 && point.y >= 300)).toBe(true);
  });

  it('refuses a stitch layer, which has no outline to cut against', () => {
    const layer = {
      ...squareLayer(0, 0, 100),
      kind: 'stitch' as const,
      stitches: [],
      threads: [],
    };
    expect(layerRings(layer as never)).toBeNull();
  });
});

describe('combineLayers', () => {
  it('cuts against where a shape actually is, not where it was drawn', () => {
    // Both squares are drawn at the origin; only their transforms make them
    // overlap. Ignoring the transform would find no overlap at all.
    const bottom = { ...squareLayer(0, 0, 100), transform: translation(0, 0) };
    const top = { ...squareLayer(0, 0, 100), transform: translation(50, 50) };

    const result = combineLayers([bottom, top], 'difference');
    expect(result.failed).toBe(false);
    expect(result.layer).not.toBeNull();
    expect(filledArea(shapeToRings(result.layer!.geometry))).toBeCloseTo(10000 - 2500, 2);
  });

  it('subtracts the shapes on top from the bottom one', () => {
    const bottom = squareLayer(0, 0, 100);
    const top = squareLayer(80, 0, 100);
    const cut = combineLayers([bottom, top], 'difference').layer;
    const rings = shapeToRings(cut!.geometry);
    // 80 wide, not 20: the bottom layer is the one that survives.
    expect(filledArea(rings)).toBeCloseTo(8000, 2);
  });

  it('bakes the transform into the result', () => {
    const bottom = { ...squareLayer(0, 0, 100), transform: translation(200, 200) };
    const top = { ...squareLayer(0, 0, 100), transform: translation(250, 250) };
    const combined = combineLayers([bottom, top], 'union').layer;
    expect(combined?.transform).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    // The geometry itself now carries the position.
    const rings = shapeToRings(combined!.geometry);
    expect(Math.min(...rings.flat().map((point) => point.x))).toBeCloseTo(200, 2);
  });

  it('inherits the bottom layer’s thread and stitch settings', () => {
    const bottom = createShapeLayer(rectangle(0, 0, 100, 100), {
      thread: { r: 10, g: 20, b: 30 },
      stitchType: 'fill',
    });
    const top = createShapeLayer(rectangle(50, 50, 100, 100), {
      thread: { r: 200, g: 200, b: 200 },
      stitchType: 'satin',
    });
    const combined = combineLayers([bottom, top], 'union').layer;
    expect(combined?.thread).toMatchObject({ r: 10, g: 20, b: 30 });
    expect(combined?.stitchType).toBe('fill');
  });

  it('needs two shapes and says so', () => {
    const result = combineLayers([squareLayer(0, 0, 100)], 'union');
    expect(result.layer).toBeNull();
    expect(result.message).toMatch(/at least two/i);
  });

  it('reports when the result is empty rather than making a blank layer', () => {
    const result = combineLayers([squareLayer(0, 0, 100), squareLayer(500, 500, 100)], 'intersection');
    expect(result.layer).toBeNull();
    expect(result.message).toBeTruthy();
  });
});

describe('hollowLayer', () => {
  it('turns a disc into a ring that compiles as a ring, not a disc', () => {
    const disc = createShapeLayer(ellipse(mmToUnits(30), mmToUnits(30), mmToUnits(25)));
    const hollowed = hollowLayer(disc, mmToUnits(3)).layer;
    expect(hollowed).not.toBeNull();

    const regions = groupRingsIntoRegions(shapeToRings(hollowed!.geometry));
    expect(regions).toHaveLength(1);
    expect(regions[0].holes).toHaveLength(1);

    // And the hole survives all the way through to stitches: a solid disc would
    // need far more thread than a 3 mm band.
    const solid = compileDesignDocument(addLayer(createDesignDocument(), disc));
    const ring = compileDesignDocument(addLayer(createDesignDocument(), hollowed!));
    expect(ring.totalStitches).toBeGreaterThan(0);
    expect(ring.totalStitches).toBeLessThan(solid.totalStitches / 2);
  });

  it('explains itself when the wall is thicker than the shape', () => {
    const small = createShapeLayer(ellipse(0, 0, mmToUnits(2)));
    const result = hollowLayer(small, mmToUnits(10));
    expect(result.layer).toBeNull();
    expect(result.message).toMatch(/thicker/i);
  });
});

describe('sliceLayer', () => {
  it('cuts one shape into two pieces', () => {
    const bar = createShapeLayer(rectangle(0, 0, 1000, 200));
    const pieces = sliceLayer(bar, [
      { x: 500, y: -50 },
      { x: 500, y: 250 },
    ], 4);
    expect(pieces).toHaveLength(2);
    for (const piece of pieces) {
      expect(filledArea(shapeToRings(piece.geometry))).toBeGreaterThan(0);
    }
  });

  it('returns nothing when the knife misses', () => {
    const bar = createShapeLayer(rectangle(0, 0, 1000, 200));
    expect(
      sliceLayer(bar, [
        { x: 5000, y: -50 },
        { x: 5000, y: 250 },
      ], 4),
    ).toHaveLength(0);
  });
});

describe('ringsToPath', () => {
  it('round-trips through the geometry the rest of the engine reads', () => {
    const rings = shapeToRings(rectangle(0, 0, 100, 60));
    const path = ringsToPath(rings);
    expect(path.subpaths.every((subpath) => subpath.closed)).toBe(true);
    expect(filledArea(shapeToRings(path))).toBeCloseTo(6000, 6);
  });
});

describe('custom shapes', () => {
  it('fits every part with one shared transform', () => {
    const big = createShapeLayer(rectangle(0, 0, 1000, 1000));
    const small = createShapeLayer(rectangle(0, 0, 100, 100));
    const shape = customShapeFromLayers('Badge', [big, small]);
    expect(shape?.parts).toHaveLength(2);

    const bounds = (d: string): number => {
      const rings = shapeToRings(pathFromData(d));
      const xs = rings.flat().map((point) => point.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    // The small square stays a tenth of the big one; fitting each part to its
    // own bounds would have made them the same size.
    expect(bounds(shape!.parts[0].d)).toBeCloseTo(100, 1);
    expect(bounds(shape!.parts[1].d)).toBeCloseTo(10, 1);
  });

  it('keeps each layer’s colour so a saved badge comes back in colour', () => {
    const red = createShapeLayer(rectangle(0, 0, 100, 100), { thread: { r: 255, g: 0, b: 0 } });
    const blue = createShapeLayer(rectangle(20, 20, 60, 60), { thread: { r: 0, g: 0, b: 255 } });
    const shape = customShapeFromLayers('Two tone', [red, blue]);
    expect(shape?.parts.map((part) => part.color)).toEqual(['#ff0000', '#0000ff']);
  });

  it('survives a save and reload', () => {
    const shape = customShapeFromLayers('Round trip', [createShapeLayer(rectangle(0, 0, 80, 40))]);
    const reloaded = parseCustomShapes(serializeCustomShapes([shape!]));
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].name).toBe('Round trip');
    expect(reloaded[0].parts[0].d).toBe(shape!.parts[0].d);
  });

  it('drops an unreadable shape instead of failing the whole library', () => {
    const good = customShapeFromLayers('Good', [createShapeLayer(rectangle(0, 0, 80, 40))]);
    const text = JSON.stringify({
      version: 1,
      shapes: [
        { id: 'broken', name: 'Broken', parts: [{ name: 'x', d: 'M 0 0 A nonsense' }] },
        JSON.parse(serializeCustomShapes([good!])).shapes[0],
      ],
    });
    const reloaded = parseCustomShapes(text);
    expect(reloaded.map((shape) => shape.name)).toEqual(['Good']);
  });

  it('returns an empty library rather than throwing on rubbish', () => {
    expect(parseCustomShapes(null)).toEqual([]);
    expect(parseCustomShapes('not json at all')).toEqual([]);
    expect(parseCustomShapes(JSON.stringify({ version: 99, shapes: [] }))).toEqual([]);
  });
});

describe('outlineLayer', () => {
  it('freezes a shape into a path layer of the same extent', () => {
    const source = { ...squareLayer(0, 0, 100), transform: translation(40, 40) };
    const frozen = outlineLayer(source);
    expect(frozen?.geometry.type).toBe('path');
    expect(filledArea(shapeToRings(frozen!.geometry))).toBeCloseTo(10000, 2);
  });
});
