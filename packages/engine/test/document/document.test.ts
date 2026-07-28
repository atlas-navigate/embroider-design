import { describe, expect, it } from 'vitest';
import { polygonArea } from '../../src/geometry/path.js';
import { groupRingsIntoRegions } from '../../src/geometry/regions.js';
import { rotation, scaling, translation } from '../../src/geometry/transform.js';
import type { Point } from '../../src/geometry/point.js';
import { StitchCommand, stitchPoint } from '../../src/pattern/stitch.js';
import { thread } from '../../src/pattern/thread.js';
import { mmToUnits } from '../../src/pattern/units.js';
import type { EmbroideryFont, FontMetrics } from '../../src/lettering/font.js';
import {
  ellipse,
  polyline,
  rectangle,
  regularPolygon,
  shapeBounds,
  shapeToOpenPaths,
  shapeToRings,
  star,
} from '../../src/document/shapes.js';
import {
  DEFAULT_HOOP,
  findHoopPreset,
  hoopSizeUnits,
  scaleToFitHoop,
  validateHoopFit,
} from '../../src/document/hoop.js';
import {
  createImageTraceLayer,
  createShapeLayer,
  createStitchLayer,
  createTextLayer,
  isLayerEmpty,
} from '../../src/document/layer.js';
import {
  addLayer,
  createDesignDocument,
  documentBounds,
  duplicateLayer,
  findLayer,
  moveLayer,
  removeLayer,
  reorderLayer,
  updateLayer,
} from '../../src/document/design-document.js';
import { compileDesignDocument, patternRuns } from '../../src/document/compile.js';
import {
  deserializeDocument,
  ProjectFormatError,
  serializeDocument,
} from '../../src/document/serialization.js';

const METRICS: FontMetrics = {
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
  lineGap: 0,
  capHeight: 700,
};

/** A one-glyph font: "I" is a plain 100-unit stem. */
const FONT: EmbroideryFont = {
  family: 'Test Sans',
  subfamily: 'Regular',
  metrics: METRICS,
  hasGlyph: (char) => char === 'I' || char === ' ',
  advanceWidth: () => 300,
  kerning: () => 0,
  glyphRings: (char, size) => {
    if (char !== 'I') return [];
    const s = size / 1000;
    return [
      [
        { x: 100 * s, y: 0 },
        { x: 200 * s, y: 0 },
        { x: 200 * s, y: -700 * s },
        { x: 100 * s, y: -700 * s },
      ],
    ];
  },
};

const RED = thread(200, 30, 40);
const BLUE = thread(20, 60, 200);

function bar(x: number, y: number, width = 300, height = 30): ReturnType<typeof rectangle> {
  return rectangle(x, y, width, height);
}

describe('shapes', () => {
  it('flattens a rectangle to four corners', () => {
    const rings = shapeToRings(rectangle(10, 20, 100, 50));
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4);
    expect(polygonArea(rings[0])).toBeCloseTo(5000, 6);
  });

  it('rounds corners without duplicating the closing point', () => {
    const rings = shapeToRings(rectangle(0, 0, 100, 100, 20));
    const first = rings[0][0];
    const last = rings[0][rings[0].length - 1];
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeGreaterThan(1);
    // Rounding removes area from each corner.
    expect(polygonArea(rings[0])).toBeLessThan(10000);
    expect(polygonArea(rings[0])).toBeGreaterThan(9000);
  });

  it('clamps a corner radius to half the shortest side', () => {
    const rings = shapeToRings(rectangle(0, 0, 100, 40, 500));
    // Fully rounded: a stadium, area = 60*40 + pi*20^2. A flattened arc is
    // inscribed in the true one, so the polygon always comes in a shade under.
    const exact = 60 * 40 + Math.PI * 400;
    expect(polygonArea(rings[0])).toBeGreaterThan(exact * 0.99);
    expect(polygonArea(rings[0])).toBeLessThanOrEqual(exact);
  });

  it('approximates an ellipse closely', () => {
    const rings = shapeToRings(ellipse(0, 0, 100, 50));
    const exact = Math.PI * 100 * 50;
    expect(polygonArea(rings[0])).toBeGreaterThan(exact * 0.99);
    expect(polygonArea(rings[0])).toBeLessThanOrEqual(exact);
  });

  it('builds regular polygons and stars', () => {
    expect(shapeToRings(regularPolygon(0, 0, 100, 6))[0]).toHaveLength(6);
    expect(shapeToRings(star(0, 0, 100, 40, 5))[0]).toHaveLength(10);
  });

  it('keeps open polylines out of the ring list', () => {
    const open = polyline(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      false,
    );
    expect(shapeToRings(open)).toHaveLength(0);
    expect(shapeToOpenPaths(open)).toHaveLength(1);
  });

  it('flattens bezier subpaths', () => {
    const rings = shapeToRings({
      type: 'path',
      subpaths: [
        {
          start: { x: 0, y: 0 },
          segments: [
            { type: 'cubic', control1: { x: 50, y: 100 }, control2: { x: 150, y: 100 }, to: { x: 200, y: 0 } },
            { type: 'line', to: { x: 0, y: 0 } },
          ],
          closed: true,
        },
      ],
    });
    expect(rings[0].length).toBeGreaterThan(4);
    expect(shapeBounds({ type: 'path', subpaths: [] })).toBeNull();
  });
});

describe('hoops', () => {
  it('defaults to the PE900 5x7', () => {
    expect(DEFAULT_HOOP.machine).toBe('Brother PE900');
    const size = hoopSizeUnits(DEFAULT_HOOP);
    expect(size.width).toBe(1270);
    expect(size.height).toBe(1780);
  });

  it('swaps the sides in landscape', () => {
    const size = hoopSizeUnits(DEFAULT_HOOP, 'landscape');
    expect(size.width).toBe(1780);
    expect(size.height).toBe(1270);
  });

  it('accepts a design inside the hoop', () => {
    const fit = validateHoopFit({ minX: 100, minY: 100, maxX: 900, maxY: 1200 }, DEFAULT_HOOP);
    expect(fit.fits).toBe(true);
    expect(fit.message).toContain('fits');
  });

  it('reports how far an oversized design runs out', () => {
    const fit = validateHoopFit({ minX: -50, minY: 0, maxX: 1400, maxY: 100 }, DEFAULT_HOOP);
    expect(fit.fits).toBe(false);
    expect(fit.overflow.left).toBe(50);
    expect(fit.overflow.right).toBe(130);
    expect(fit.message).toContain('outside');
  });

  it('computes the scale that would make it fit', () => {
    expect(scaleToFitHoop({ minX: 0, minY: 0, maxX: 500, maxY: 500 }, DEFAULT_HOOP)).toBe(1);
    const scale = scaleToFitHoop({ minX: 0, minY: 0, maxX: 5000, maxY: 5000 }, DEFAULT_HOOP);
    expect(scale).toBeLessThan(1);
    expect(5000 * scale).toBeLessThanOrEqual(1270);
  });

  it('looks presets up by id', () => {
    expect(findHoopPreset('pe900-4x4')?.widthMm).toBe(100);
    expect(findHoopPreset('nonexistent')).toBeNull();
  });
});

describe('layers', () => {
  it('names itself after the geometry', () => {
    expect(createShapeLayer(rectangle(0, 0, 10, 10)).name).toBe('Rectangle');
    expect(createShapeLayer(ellipse(0, 0, 10, 10)).name).toBe('Circle');
    expect(createShapeLayer(star(0, 0, 10, 4, 5)).name).toBe('Star');
  });

  it('gives successive layers distinguishable default colours', () => {
    const first = createShapeLayer(rectangle(0, 0, 10, 10), { index: 0 });
    const second = createShapeLayer(rectangle(0, 0, 10, 10), { index: 1 });
    expect(first.thread).not.toEqual(second.thread);
  });

  it('keeps its discriminant when overrides are applied', () => {
    const layer = createTextLayer('Hi', { family: 'Test Sans' }, 100, { thread: RED });
    expect(layer.kind).toBe('text');
    expect(layer.thread).toEqual(RED);
  });

  it('knows when it has nothing to contribute', () => {
    expect(isLayerEmpty(createTextLayer('   ', {}, 100))).toBe(true);
    expect(isLayerEmpty(createTextLayer('A', {}, 100))).toBe(false);
    expect(isLayerEmpty(createImageTraceLayer([]))).toBe(true);
    expect(isLayerEmpty(createShapeLayer(rectangle(0, 0, 1, 1)))).toBe(false);
  });
});

describe('document mutations', () => {
  function docWithTwo(): ReturnType<typeof createDesignDocument> {
    let doc = createDesignDocument({ name: 'Test' });
    doc = addLayer(doc, createShapeLayer(bar(0, 0), { name: 'A' }));
    doc = addLayer(doc, createShapeLayer(bar(0, 100), { name: 'B' }));
    return doc;
  }

  it('never mutates in place', () => {
    const doc = docWithTwo();
    const next = addLayer(doc, createShapeLayer(bar(0, 200)));
    expect(doc.layers).toHaveLength(2);
    expect(next.layers).toHaveLength(3);
  });

  it('adds, removes and finds by id', () => {
    const doc = docWithTwo();
    const id = doc.layers[0].id;
    expect(findLayer(doc, id)?.name).toBe('A');
    expect(removeLayer(doc, id).layers).toHaveLength(1);
    expect(findLayer(removeLayer(doc, id), id)).toBeNull();
  });

  it('updates with a patch or a function', () => {
    const doc = docWithTwo();
    const id = doc.layers[0].id;
    expect(updateLayer(doc, id, { name: 'Renamed' }).layers[0].name).toBe('Renamed');
    expect(
      updateLayer(doc, id, (layer) => ({ ...layer, visible: false })).layers[0].visible,
    ).toBe(false);
    // An id that is not there is a no-op, not an error.
    expect(updateLayer(doc, 'missing', { name: 'x' })).toBe(doc);
  });

  it('reorders and nudges layers', () => {
    const doc = docWithTwo();
    const id = doc.layers[0].id;
    expect(reorderLayer(doc, id, 1).layers.map((l) => l.name)).toEqual(['B', 'A']);
    expect(moveLayer(doc, id, 1).layers.map((l) => l.name)).toEqual(['B', 'A']);
    // Clamped, not wrapped.
    expect(moveLayer(doc, id, -5).layers.map((l) => l.name)).toEqual(['A', 'B']);
  });

  it('duplicates next to the original with a fresh id', () => {
    const doc = docWithTwo();
    const next = duplicateLayer(doc, doc.layers[0].id);
    expect(next.layers.map((l) => l.name)).toEqual(['A', 'A copy', 'B']);
    expect(next.layers[1].id).not.toBe(next.layers[0].id);
  });

  it('measures visible layers only', () => {
    let doc = docWithTwo();
    const full = documentBounds(doc);
    doc = updateLayer(doc, doc.layers[1].id, { visible: false });
    const partial = documentBounds(doc);
    expect(full!.maxY).toBeGreaterThan(partial!.maxY);
  });
});

describe('compileDesignDocument', () => {
  const resolveFont = (): EmbroideryFont => FONT;

  it('produces a pattern with one colour block per colour', () => {
    let doc = createDesignDocument();
    doc = addLayer(doc, createShapeLayer(bar(100, 100), { thread: RED }));
    doc = addLayer(doc, createShapeLayer(bar(100, 300), { thread: BLUE }));
    const result = compileDesignDocument(doc);
    expect(result.colorBlocks).toBe(2);
    expect(result.totalStitches).toBeGreaterThan(0);
    expect(result.pattern.threads).toHaveLength(2);
  });

  it('merges consecutive layers that share a colour into one block', () => {
    let doc = createDesignDocument();
    doc = addLayer(doc, createShapeLayer(bar(100, 100), { thread: RED }));
    doc = addLayer(doc, createShapeLayer(bar(100, 300), { thread: RED }));
    const result = compileDesignDocument(doc);
    expect(result.colorBlocks).toBe(1);
  });

  it('skips hidden layers entirely', () => {
    let doc = createDesignDocument();
    doc = addLayer(doc, createShapeLayer(bar(100, 100), { thread: RED }));
    doc = addLayer(doc, createShapeLayer(bar(100, 300), { thread: BLUE }));
    doc = updateLayer(doc, doc.layers[1].id, { visible: false });
    const result = compileDesignDocument(doc);
    expect(result.colorBlocks).toBe(1);
    expect(result.layers[1].skipped).toBe(true);
    expect(result.layers[1].stitchCount).toBe(0);
  });

  it('applies the layer transform to the stitches', () => {
    let plain = createDesignDocument();
    plain = addLayer(plain, createShapeLayer(bar(0, 0), { thread: RED }));
    let moved = createDesignDocument();
    const layer = createShapeLayer(bar(0, 0), { thread: RED });
    layer.transform = translation(500, 700);
    moved = addLayer(moved, layer);

    const a = compileDesignDocument(plain).bounds!;
    const b = compileDesignDocument(moved).bounds!;
    // Within a raster cell: these are stitch bounds, and the satin decomposer
    // rasterises against each region's own bounding box, so the grid lands
    // fractionally differently for the translated copy.
    expect(Math.abs(b.minX - a.minX - 500)).toBeLessThan(3);
    expect(Math.abs(b.minY - a.minY - 700)).toBeLessThan(3);
  });

  it('honours rotation and scale in the transform', () => {
    let doc = createDesignDocument();
    const layer = createShapeLayer(bar(0, 0, 400, 40), { thread: RED });
    layer.transform = scaling(2, 2);
    doc = addLayer(doc, layer);
    const bounds = compileDesignDocument(doc).bounds!;
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(700);

    let turned = createDesignDocument();
    const other = createShapeLayer(bar(0, 0, 400, 40), { thread: RED });
    other.transform = rotation(Math.PI / 2);
    turned = addLayer(turned, other);
    const rotatedBounds = compileDesignDocument(turned).bounds!;
    // A quarter turn makes the tall dimension the long one.
    expect(rotatedBounds.maxY - rotatedBounds.minY).toBeGreaterThan(
      rotatedBounds.maxX - rotatedBounds.minX,
    );
  });

  it('digitizes a text layer through the supplied font', () => {
    let doc = createDesignDocument();
    doc = addLayer(
      doc,
      createTextLayer('II', { family: 'Test Sans' }, mmToUnits(15), {
        thread: RED,
        origin: { x: 200, y: 200 },
      }),
    );
    const result = compileDesignDocument(doc, { resolveFont });
    expect(result.totalStitches).toBeGreaterThan(0);
    expect(result.layers[0].skipped).toBe(false);
    // Placed at the origin, not at zero.
    expect(result.bounds!.minX).toBeGreaterThan(150);
  });

  it('reports a text layer whose font is missing rather than guessing', () => {
    let doc = createDesignDocument();
    doc = addLayer(doc, createTextLayer('II', { family: 'Nothing' }, mmToUnits(15)));
    const result = compileDesignDocument(doc, { resolveFont: () => null });
    expect(result.layers[0].skipped).toBe(true);
    expect(result.warnings.join(' ')).toContain('Font not available');
    expect(result.totalStitches).toBe(0);
  });

  it('stitches traced image regions', () => {
    const rings = shapeToRings(rectangle(100, 100, 400, 40));
    let doc = createDesignDocument();
    doc = addLayer(doc, createImageTraceLayer(groupRingsIntoRegions(rings), { thread: BLUE }));
    const result = compileDesignDocument(doc);
    expect(result.totalStitches).toBeGreaterThan(0);
    expect(result.layers[0].types[0]).toBe('satin');
  });

  it('passes imported stitches through with their own palette', () => {
    const stitches = [
      stitchPoint(0, 0, StitchCommand.STITCH),
      stitchPoint(100, 0, StitchCommand.STITCH),
      stitchPoint(100, 100, StitchCommand.STITCH),
      stitchPoint(100, 100, StitchCommand.COLOR_CHANGE),
      stitchPoint(200, 100, StitchCommand.STITCH),
      stitchPoint(300, 100, StitchCommand.STITCH),
      stitchPoint(300, 100, StitchCommand.END),
    ];
    let doc = createDesignDocument();
    doc = addLayer(doc, createStitchLayer(stitches, [RED, BLUE], { sourceFormat: 'dst' }));
    const result = compileDesignDocument(doc);
    expect(result.colorBlocks).toBe(2);
    expect(result.pattern.threads[0]).toEqual(RED);
    expect(result.pattern.threads[1]).toEqual(BLUE);
    expect(result.layers[0].reasons[0]).toContain('DST');
  });

  it('flags a design that will not fit the hoop', () => {
    let doc = createDesignDocument();
    doc = addLayer(doc, createShapeLayer(rectangle(0, 0, 3000, 100), { thread: RED }));
    const result = compileDesignDocument(doc);
    expect(result.hoopFit.fits).toBe(false);
    expect(result.warnings.some((w) => w.includes('outside'))).toBe(true);
  });

  it('estimates sewing time from stitch count and thread changes', () => {
    let doc = createDesignDocument();
    doc = addLayer(doc, createShapeLayer(bar(100, 100), { thread: RED }));
    doc = addLayer(doc, createShapeLayer(bar(100, 300), { thread: BLUE }));
    const result = compileDesignDocument(doc);
    // One colour change alone is 45 seconds.
    expect(result.estimatedMinutes).toBeGreaterThan(0.75);
  });

  it('records why each region was stitched the way it was', () => {
    let doc = createDesignDocument();
    doc = addLayer(doc, createShapeLayer(bar(100, 100, 400, 30), { thread: RED }));
    doc = addLayer(doc, createShapeLayer(rectangle(100, 400, 500, 500), { thread: BLUE }));
    const result = compileDesignDocument(doc);
    expect(result.layers[0].types).toContain('satin');
    expect(result.layers[1].types).toContain('fill');
    expect(result.layers[0].reasons[0]).toMatch(/mm/);
  });

  it('compiles an empty document to an empty pattern', () => {
    const result = compileDesignDocument(createDesignDocument());
    expect(result.totalStitches).toBe(0);
    expect(result.bounds).toBeNull();
    expect(result.hoopFit.fits).toBe(true);
  });
});

describe('patternRuns', () => {
  it('splits a compiled pattern back into per-colour runs for the preview', () => {
    let doc = createDesignDocument();
    doc = addLayer(doc, createShapeLayer(bar(100, 100), { thread: RED }));
    doc = addLayer(doc, createShapeLayer(bar(100, 300), { thread: BLUE }));
    const result = compileDesignDocument(doc);
    const runs = patternRuns(result.pattern);
    expect(runs).toHaveLength(2);
    expect(runs[0].thread).toEqual(RED);
    expect(runs[0].runs.length).toBeGreaterThan(0);
    // Runs contain only sewn points; jumps break them apart.
    for (const entry of runs) {
      for (const run of entry.runs) expect(run.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('project serialization', () => {
  function sample(): ReturnType<typeof createDesignDocument> {
    let doc = createDesignDocument({ name: 'Round trip', units: 'inch' });
    doc = addLayer(doc, createShapeLayer(rectangle(10, 20, 100, 50, 5), { thread: RED }));
    doc = addLayer(
      doc,
      createTextLayer('II', { family: 'Test Sans', path: 'C:/fonts/test.ttf' }, 150, {
        thread: BLUE,
        align: 'center',
      }),
    );
    return doc;
  }

  it('round-trips a document', () => {
    const original = sample();
    const restored = deserializeDocument(serializeDocument(original));
    expect(restored.name).toBe('Round trip');
    expect(restored.units).toBe('inch');
    expect(restored.layers).toHaveLength(2);
    expect(restored.layers[0].thread).toEqual(RED);
    expect(restored.layers[0].id).toBe(original.layers[0].id);
    const text = restored.layers[1] as ReturnType<typeof createTextLayer>;
    expect(text.text).toBe('II');
    expect(text.align).toBe('center');
    expect(text.font.path).toBe('C:/fonts/test.ttf');
  });

  it('compiles identically after a round trip', () => {
    const original = sample();
    const restored = deserializeDocument(serializeDocument(original));
    const a = compileDesignDocument(original, { resolveFont: () => FONT });
    const b = compileDesignDocument(restored, { resolveFont: () => FONT });
    expect(b.totalStitches).toBe(a.totalStitches);
    expect(b.colorBlocks).toBe(a.colorBlocks);
  });

  it('keeps a hoop this build does not recognise, as long as it has a size', () => {
    const doc = createDesignDocument();
    const payload = JSON.parse(serializeDocument(doc)) as Record<string, unknown>;
    payload.hoop = { id: 'exotic-9x14', name: '9 x 14', widthMm: 230, heightMm: 360 };
    const restored = deserializeDocument(JSON.stringify(payload));
    expect(restored.hoop.widthMm).toBe(230);
  });

  it('refuses a file with no version', () => {
    expect(() => deserializeDocument('{"layers":[]}')).toThrow(ProjectFormatError);
  });

  it('refuses a file from a newer build rather than mangling it', () => {
    expect(() => deserializeDocument('{"schemaVersion":99,"layers":[]}')).toThrow(/newer version/);
  });

  it('reports unreadable JSON clearly', () => {
    expect(() => deserializeDocument('not json')).toThrow(ProjectFormatError);
  });

  it('drops layers that lost their content', () => {
    const restored = deserializeDocument(
      JSON.stringify({
        schemaVersion: 1,
        layers: [{ kind: 'shape' }, { kind: 'nonsense' }, { kind: 'image', regions: [] }],
      }),
    );
    expect(restored.layers).toHaveLength(1);
    expect(restored.layers[0].kind).toBe('image');
  });
});

describe('geometry conventions hold end to end', () => {
  it('places a shape where the document says it is', () => {
    let doc = createDesignDocument();
    doc = addLayer(doc, createShapeLayer(rectangle(200, 300, 400, 40), { thread: RED }));
    const result = compileDesignDocument(doc);
    const points: Point[] = [];
    for (const entry of patternRuns(result.pattern)) {
      for (const run of entry.runs) points.push(...run);
    }
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    // Within pull compensation of the rectangle it was given.
    expect(Math.min(...xs)).toBeGreaterThan(190);
    expect(Math.max(...xs)).toBeLessThan(610);
    expect(Math.min(...ys)).toBeGreaterThan(290);
    expect(Math.max(...ys)).toBeLessThan(350);
  });
});
