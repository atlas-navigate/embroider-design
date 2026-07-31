import { describe, expect, it } from 'vitest';
import { allShapes } from '../../src/library/shape-library.js';
import type { CategoryId, LibraryShape } from '../../src/library/types.js';
import { pathFromData } from '../../src/library/path-data.js';
import { shapeToRings } from '../../src/document/shapes.js';
import { groupRingsIntoRegions } from '../../src/geometry/regions.js';
import { mergeOverlappingRings } from '../../src/geometry/boolean.js';
import { OUTLINE, OUTLINE_COOL, OUTLINE_RED, INK } from '../../src/library/data/palette.js';

/**
 * The rules a redrawn icon follows, checked per category.
 *
 * Append a category to `REDRAWN` in the same commit that redraws it. Anything
 * not in the list is still in the old flat style and is deliberately exempt —
 * this file is how the redraw stays honest about how far it has actually got.
 */
const REDRAWN: readonly CategoryId[] = ['thanksgiving'];

/** The colours a keyline may be drawn in — see `keyline.ts`. */
const KEYLINE_COLOURS = new Set([OUTLINE, OUTLINE_COOL, OUTLINE_RED, INK]);

const redrawn: LibraryShape[] = allShapes().filter((shape) => REDRAWN.includes(shape.category));

describe('redrawn icons', () => {
  it('covers every category that claims to be redrawn', () => {
    for (const category of REDRAWN) {
      expect(
        redrawn.some((shape) => shape.category === category),
        `${category} is listed as redrawn but has no shapes`,
      ).toBe(true);
    }
  });

  /**
   * Rule 3: one dark part per icon, and it comes last.
   *
   * `shape-library.test.ts` already forbids a thread from being used, left and
   * returned to. This is the stronger statement the redraw commits to: the dark
   * thread is used exactly once, at the end, so the keyline and every detail
   * line it carries sew in a single pass over the finished artwork.
   */
  it('gives every icon exactly one dark part, last', () => {
    for (const shape of redrawn) {
      const dark = shape.parts
        .map((part, index) => ({ part, index }))
        .filter(({ part }) => part.color && KEYLINE_COLOURS.has(part.color));
      expect(dark.length, `${shape.id} has ${dark.length} dark parts, expected 1`).toBe(1);
      expect(dark[0]?.index, `${shape.id}'s dark part is not last`).toBe(shape.parts.length - 1);
    }
  });

  /**
   * Rule 2: a small, fixed colour budget.
   *
   * Seven is the ceiling, not the target — most icons here sit at four or five.
   * Seven exists because the busiest icons genuinely need it: a turkey is a
   * two-tone fan, a two-tone bird, a wattle, a beak and a keyline, and there is
   * no honest way to draw one in five. Every colour past that is another stop
   * where somebody re-threads the machine.
   */
  it('keeps every icon within its colour budget', () => {
    for (const shape of redrawn) {
      const colours = new Set(shape.parts.map((part) => part.color ?? 'default'));
      expect(colours.size, `${shape.id} uses ${colours.size} colours`).toBeLessThanOrEqual(7);
      expect(colours.size, `${shape.id} uses only ${colours.size}`).toBeGreaterThanOrEqual(2);
    }
  });

  /**
   * Rule 5, and the one that fails silently.
   *
   * `compileShapeLayer` unions a part's regions before stitching it. If a solid
   * feature in the dark part overlaps one of its own outline bands, that union
   * closes the band's hole — and the icon stitches with a filled blob where its
   * outline should be. Nothing errors; it just comes out wrong on the fabric.
   */
  it('keeps every keyline cavity open after the compiler merges the part', () => {
    for (const shape of redrawn) {
      const keyline = shape.parts[shape.parts.length - 1];
      if (!keyline) continue;
      const rings = shapeToRings(pathFromData(keyline.d));
      const before = groupRingsIntoRegions(rings).reduce(
        (total, region) => total + region.holes.length,
        0,
      );
      if (before === 0) continue; // a detail-only dark part, with no band
      const after = groupRingsIntoRegions(mergeOverlappingRings(rings)).reduce(
        (total, region) => total + region.holes.length,
        0,
      );
      expect(
        after,
        `${shape.id}'s keyline lost ${before - after} cavity/cavities when merged — ` +
          'a solid feature is sitting across a band instead of inside it',
      ).toBe(before);
    }
  });
});
