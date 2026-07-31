import { describe, expect, it } from 'vitest';
import {
  allShapes,
  instantiateShape,
  libraryShapeBounds,
  populatedCategories,
  searchShapes,
  shapeById,
  shapesInCategory,
  AUTHORING_BOX,
  CATEGORIES,
} from '../../src/library/index.js';
import { pathFromData } from '../../src/library/path-data.js';
import { shapeToOpenPaths, shapeToRings } from '../../src/document/shapes.js';
import { boundingBoxOfMany } from '../../src/geometry/path.js';
import { mmToUnits } from '../../src/pattern/units.js';

/**
 * The catalogue is hand-authored data, and hand-authored data rots.
 *
 * These run over every entry rather than over a chosen sample: a shape whose
 * path data has a typo, whose parts have drifted outside the authoring box, or
 * whose id collides with another is caught the moment it is added, not when a
 * user clicks it.
 */

const shapes = allShapes();

describe('the shape catalogue', () => {
  it('is not empty', () => {
    expect(shapes.length).toBeGreaterThan(0);
  });

  it('has unique ids', () => {
    const seen = new Map<string, string>();
    for (const shape of shapes) {
      expect(seen.has(shape.id), `duplicate id "${shape.id}"`).toBe(false);
      seen.set(shape.id, shape.name);
    }
  });

  it('only uses declared categories', () => {
    const known = new Set(CATEGORIES.map((category) => category.id));
    for (const shape of shapes) {
      expect(known.has(shape.category), `${shape.id} has category "${shape.category}"`).toBe(true);
    }
  });

  it('ships nothing in the custom category', () => {
    // `custom` is a real category id so a saved shape can be an ordinary
    // `LibraryShape`, but it belongs to the user. Anything shipped in it would
    // appear under "My shapes" with a delete button that could not work.
    for (const shape of shapes) {
      expect(shape.category, `${shape.id} ships as custom`).not.toBe('custom');
    }
  });

  it('gives every shape at least one part, and every part a name', () => {
    for (const shape of shapes) {
      expect(shape.parts.length, `${shape.id} has no parts`).toBeGreaterThan(0);
      for (const part of shape.parts) {
        expect(part.name.trim().length, `${shape.id} has an unnamed part`).toBeGreaterThan(0);
      }
    }
  });

  it('uses well-formed colours', () => {
    for (const shape of shapes) {
      for (const part of shape.parts) {
        if (part.color === undefined) continue;
        expect(part.color, `${shape.id}/${part.name}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it('parses every part into usable geometry', () => {
    for (const shape of shapes) {
      for (const part of shape.parts) {
        const geometry = pathFromData(part.d);
        const rings = shapeToRings(geometry);
        const paths = shapeToOpenPaths(geometry);
        expect(
          rings.length + paths.length,
          `${shape.id}/${part.name} produced no geometry`,
        ).toBeGreaterThan(0);
        for (const ring of rings) {
          expect(ring.length, `${shape.id}/${part.name} has a degenerate ring`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('keeps every part inside the authoring box', () => {
    // A shape that strays outside 0-100 still works, because placement measures
    // real bounds — but it means the author was working to a different scale
    // than everyone else, which is worth catching.
    const slack = 0.5;
    for (const shape of shapes) {
      for (const part of shape.parts) {
        const geometry = pathFromData(part.d);
        const bounds = boundingBoxOfMany([
          ...shapeToRings(geometry),
          ...shapeToOpenPaths(geometry),
        ]);
        expect(bounds, `${shape.id}/${part.name} has no bounds`).not.toBeNull();
        if (!bounds) continue;
        const where = `${shape.id}/${part.name}`;
        expect(bounds.minX, `${where} minX`).toBeGreaterThanOrEqual(-slack);
        expect(bounds.minY, `${where} minY`).toBeGreaterThanOrEqual(-slack);
        expect(bounds.maxX, `${where} maxX`).toBeLessThanOrEqual(AUTHORING_BOX + slack);
        expect(bounds.maxY, `${where} maxY`).toBeLessThanOrEqual(AUTHORING_BOX + slack);
      }
    }
  });

  it('gives every shape a non-degenerate extent', () => {
    for (const shape of shapes) {
      const bounds = libraryShapeBounds(shape);
      expect(bounds, `${shape.id} has no bounds`).not.toBeNull();
      if (!bounds) continue;
      expect(bounds.maxX - bounds.minX, `${shape.id} is too narrow`).toBeGreaterThan(5);
      expect(bounds.maxY - bounds.minY, `${shape.id} is too short`).toBeGreaterThan(5);
    }
  });

  it('uses most of the authoring box in at least one axis', () => {
    // Otherwise the shape is drawn small and then scaled up on placement, which
    // multiplies its flattening error along with it.
    for (const shape of shapes) {
      const bounds = libraryShapeBounds(shape);
      if (!bounds) continue;
      const extent = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
      expect(extent, `${shape.id} only spans ${extent.toFixed(1)} of 100`).toBeGreaterThan(75);
    }
  });

  /**
   * Parts sew in the order they are listed, and every change of thread is a
   * stop where somebody re-threads the machine. A colour used for part 1 and
   * again for part 5 is therefore not a stylistic detail — it is two extra
   * thread changes on every garment, for a shape that could have been ordered
   * to need none. Reordering the parts is nearly always possible; where it
   * conflicts with the draw order, the fix is to recolour rather than to
   * accept the extra stop.
   */
  it('uses each thread in one unbroken run of parts', () => {
    for (const shape of shapes) {
      const colours = shape.parts.map((part) => part.color ?? 'default');
      const lastSeen = new Map<string, number>();
      colours.forEach((colour, index) => {
        const previous = lastSeen.get(colour);
        expect(
          previous === undefined || previous === index - 1,
          `${shape.id} returns to ${colour} at part ${index} after leaving it — [${colours.join(' ')}]`,
        ).toBe(true);
        lastSeen.set(colour, index);
      });
    }
  });
});

describe('lookup', () => {
  it('finds every shape by id', () => {
    for (const shape of shapes) expect(shapeById(shape.id)).toBe(shape);
  });

  it('returns null for an unknown id', () => {
    expect(shapeById('no-such-shape')).toBeNull();
  });

  it('lists every shape in exactly one category', () => {
    let total = 0;
    for (const category of CATEGORIES) total += shapesInCategory(category.id).length;
    expect(total).toBe(shapes.length);
  });

  it('only reports categories that have shapes', () => {
    for (const category of populatedCategories()) {
      expect(shapesInCategory(category.id).length).toBeGreaterThan(0);
    }
  });

  it('narrows as terms are added rather than widening', () => {
    const single = searchShapes('arrow');
    const double = searchShapes('arrow right');
    expect(single.length).toBeGreaterThan(0);
    expect(double.length).toBeGreaterThan(0);
    expect(double.length).toBeLessThanOrEqual(single.length);
  });

  it('matches keywords, not just names', () => {
    const found = searchShapes('rhombus');
    expect(found.map((shape) => shape.id)).toContain('basic-diamond');
  });

  it('returns everything for an empty query', () => {
    expect(searchShapes('   ')).toHaveLength(shapes.length);
  });
});

describe('instantiateShape', () => {
  const box = { x: mmToUnits(10), y: mmToUnits(20), width: mmToUnits(60), height: mmToUnits(60) };

  it('places every shape inside its target box', () => {
    for (const shape of shapes) {
      const layers = instantiateShape(shape, box);
      const rings = layers.flatMap((layer) => {
        const geometry = layer.geometry;
        return [...shapeToRings(geometry), ...shapeToOpenPaths(geometry)].map((points) =>
          points.map((point) => ({
            x: layer.transform.a * point.x + layer.transform.c * point.y + layer.transform.e,
            y: layer.transform.b * point.x + layer.transform.d * point.y + layer.transform.f,
          })),
        );
      });
      const bounds = boundingBoxOfMany(rings);
      expect(bounds, shape.id).not.toBeNull();
      if (!bounds) continue;
      const slack = 1e-6;
      expect(bounds.minX, `${shape.id} left`).toBeGreaterThanOrEqual(box.x - slack);
      expect(bounds.minY, `${shape.id} top`).toBeGreaterThanOrEqual(box.y - slack);
      expect(bounds.maxX, `${shape.id} right`).toBeLessThanOrEqual(box.x + box.width + slack);
      expect(bounds.maxY, `${shape.id} bottom`).toBeLessThanOrEqual(box.y + box.height + slack);
    }
  });

  it('preserves the aspect ratio in a non-square box', () => {
    const shape = shapeById('basic-circle');
    expect(shape).not.toBeNull();
    if (!shape) return;
    const [layer] = instantiateShape(shape, { x: 0, y: 0, width: 400, height: 1000 });
    // A circle in a tall box stays a circle: both axes scale by the same factor.
    expect(layer.transform.a).toBeCloseTo(layer.transform.d, 9);
  });

  it('groups multi-part shapes and leaves single-part shapes ungrouped', () => {
    const multi = shapeById('basic-cube');
    const single = shapeById('basic-rectangle');
    expect(multi && single).toBeTruthy();
    if (!multi || !single) return;

    const cube = instantiateShape(multi, box);
    expect(cube).toHaveLength(3);
    const groups = new Set(cube.map((layer) => layer.groupId));
    expect(groups.size).toBe(1);
    expect([...groups][0]).toBeTruthy();

    expect(instantiateShape(single, box)[0].groupId).toBeUndefined();
  });

  it('carries each part colour onto its layer', () => {
    const shape = shapeById('basic-cube');
    if (!shape) return;
    const layers = instantiateShape(shape, box);
    expect(layers[0].thread).toMatchObject({ r: 0x4a, g: 0x76, b: 0xc4 });
  });

  it('honours a forced single thread', () => {
    const shape = shapeById('basic-cube');
    if (!shape) return;
    const thread = { r: 10, g: 20, b: 30 };
    for (const layer of instantiateShape(shape, box, { thread })) {
      expect(layer.thread).toMatchObject(thread);
    }
  });
});
