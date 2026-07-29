import { describe, expect, it } from 'vitest';
import { allShapes, instantiateShape } from '../../src/library/index.js';
import { pathFromData } from '../../src/library/path-data.js';
import { shapeToOpenPaths, shapeToRings } from '../../src/document/shapes.js';
import { groupRingsIntoRegions } from '../../src/geometry/regions.js';
import { createDesignDocument } from '../../src/document/design-document.js';
import { compileDesignDocument } from '../../src/document/compile.js';
import { mmToUnits } from '../../src/pattern/units.js';

/**
 * Does the catalogue actually sew?
 *
 * The interesting failure is silent. `groupRingsIntoRegions` decides what is a
 * filled area and what is a hole purely by containment depth, so a shape whose
 * rings nest in an unintended way does not error — it stitches the wrong thing.
 * A ring that should be a hole comes out solid, or, worse, a part made only of
 * odd-depth rings produces no filled region at all and vanishes.
 *
 * These tests are what let a 200-entry hand-authored catalogue be trusted.
 */

const shapes = allShapes();
const PLACEMENT = {
  x: mmToUnits(5),
  y: mmToUnits(5),
  width: mmToUnits(60),
  height: mmToUnits(60),
};

describe('every catalogue part encloses something', () => {
  it('produces at least one filled region per part', () => {
    for (const shape of shapes) {
      for (const part of shape.parts) {
        const geometry = pathFromData(part.d);
        const rings = shapeToRings(geometry);
        // An open-path part (none today, but the type allows it) has no regions
        // to find and is stitched as a run instead.
        if (rings.length === 0) {
          expect(
            shapeToOpenPaths(geometry).length,
            `${shape.id}/${part.name} has neither rings nor paths`,
          ).toBeGreaterThan(0);
          continue;
        }
        const regions = groupRingsIntoRegions(rings);
        expect(
          regions.length,
          `${shape.id}/${part.name} has ${rings.length} rings but no filled region — ` +
            'they have probably nested so that everything counted as a hole',
        ).toBeGreaterThan(0);
      }
    }
  });

  it('never leaves a region without a usable outer contour', () => {
    for (const shape of shapes) {
      for (const part of shape.parts) {
        for (const region of groupRingsIntoRegions(shapeToRings(pathFromData(part.d)))) {
          expect(region.outer.length, `${shape.id}/${part.name}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});

describe('every catalogue shape compiles to stitches at 60 mm', () => {
  it('produces a non-empty pattern with sane bounds', () => {
    for (const shape of shapes) {
      const document = {
        ...createDesignDocument({ name: shape.name }),
        layers: instantiateShape(shape, PLACEMENT),
      };
      const result = compileDesignDocument(document);

      expect(result.totalStitches, `${shape.id} produced no stitches`).toBeGreaterThan(0);
      expect(result.bounds, `${shape.id} has no bounds`).not.toBeNull();
      if (!result.bounds) continue;

      // Inside the placement box, allowing for pull compensation pushing the
      // outline out by a fraction of a millimetre.
      const slack = mmToUnits(1.5);
      expect(result.bounds.minX, `${shape.id} left`).toBeGreaterThan(PLACEMENT.x - slack);
      expect(result.bounds.minY, `${shape.id} top`).toBeGreaterThan(PLACEMENT.y - slack);
      expect(result.bounds.maxX, `${shape.id} right`).toBeLessThan(
        PLACEMENT.x + PLACEMENT.width + slack,
      );
      expect(result.bounds.maxY, `${shape.id} bottom`).toBeLessThan(
        PLACEMENT.y + PLACEMENT.height + slack,
      );
    }
  });

  it('reports no layer that generated nothing', () => {
    const empty: string[] = [];
    for (const shape of shapes) {
      const document = {
        ...createDesignDocument({ name: shape.name }),
        layers: instantiateShape(shape, PLACEMENT),
      };
      for (const layer of compileDesignDocument(document).layers) {
        if (layer.stitchCount === 0) empty.push(`${shape.id}: ${layer.name}`);
      }
    }
    expect(empty, `parts that stitched nothing:\n${empty.join('\n')}`).toHaveLength(0);
  });

  it('keeps a multi-part shape on one colour block per distinct thread', () => {
    // Parts sharing a colour must merge, or a snowman would stop the machine
    // for a thread change between its hat brim and its hat crown.
    const document = {
      ...createDesignDocument({ name: 'snowman' }),
      layers: instantiateShape(
        shapes.find((shape) => shape.id === 'christmas-snowman')!,
        PLACEMENT,
      ),
    };
    const result = compileDesignDocument(document);
    const distinctColours = new Set(
      document.layers.map((layer) => `${layer.thread.r},${layer.thread.g},${layer.thread.b}`),
    );
    expect(result.colorBlocks).toBeLessThanOrEqual(distinctColours.size + 1);
  });
});
