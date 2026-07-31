import { describe, expect, it } from 'vitest';
import {
  createRgbaImage,
  setPixel,
  type Rgb,
  type RgbaImage,
} from '../../src/autodigitize/image-data.js';
import { libraryShapeFromImage } from '../../src/library/shape-from-image.js';
import { libraryShapeBounds } from '../../src/library/instantiate.js';
import { pathFromData } from '../../src/library/path-data.js';
import { parseCustomShapes, serializeCustomShapes } from '../../src/library/custom-shape.js';
import { shapeToRings } from '../../src/document/shapes.js';
import { boundingBoxOfMany } from '../../src/geometry/path.js';
import { AUTHORING_BOX, type LibraryShape } from '../../src/library/types.js';

/**
 * Rebuilding a traced image as a catalogue shape.
 *
 * The claim under test is that the output is indistinguishable from a shape
 * that shipped: it parses, it measures, it fits the authoring box, and its
 * parts were fitted together rather than each to itself. Nothing here asserts
 * that the trace is *pretty* — that is a judgement, and it belongs to the
 * person looking at the contact sheet.
 */

const WHITE: Rgb = [255, 255, 255];
const PALE: Rgb = [232, 176, 96];
const DARK: Rgb = [32, 26, 24];

function page(width: number, height: number): RgbaImage {
  return createRgbaImage(width, height, WHITE);
}

function disc(image: RgbaImage, cx: number, cy: number, radius: number, rgb: Rgb): void {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) setPixel(image, x, y, rgb);
    }
  }
}

function ellipse(
  image: RgbaImage,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rgb: Rgb,
): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) setPixel(image, x, y, rgb);
    }
  }
}

/**
 * A pale blob with a dark ring around it — a keylined icon in miniature.
 *
 * The radii follow the page, so asking for a wide page really does give wide
 * artwork. Sizing them off the shorter side would draw a circle either way,
 * and the shared-transform test would then pass on a shape that has no
 * proportions to lose.
 */
function ringedDisc(width = 120, height = 120): RgbaImage {
  const image = page(width, height);
  const rx = width * 0.4;
  const ry = height * 0.4;
  ellipse(image, width / 2, height / 2, rx, ry, DARK);
  ellipse(image, width / 2, height / 2, rx - 6, ry - 6, PALE);
  return image;
}

function boundsOf(shape: LibraryShape) {
  return boundingBoxOfMany(shape.parts.flatMap((part) => shapeToRings(pathFromData(part.d))));
}

describe('libraryShapeFromImage', () => {
  it('produces a shape indistinguishable from one that shipped', () => {
    const shape = libraryShapeFromImage(ringedDisc(), { name: 'Ring' });
    expect(shape).not.toBeNull();
    if (!shape) return;

    expect(shape.category).toBe('custom');
    expect(shape.name).toBe('Ring');
    expect(shape.parts.length).toBeGreaterThanOrEqual(2);
    // Everything the catalogue does with a shape starts from these two.
    for (const part of shape.parts) expect(() => pathFromData(part.d)).not.toThrow();
    expect(libraryShapeBounds(shape)).not.toBeNull();
  });

  it('fits the artwork inside the authoring box', () => {
    const shape = libraryShapeFromImage(ringedDisc(), { name: 'Ring' });
    const bounds = shape && boundsOf(shape);
    expect(bounds).not.toBeNull();
    if (!bounds) return;

    // Half a unit of slack for the rounding `pathDataFromRings` does, matching
    // what `shape-library.test.ts` allows the shipped catalogue.
    expect(bounds.minX).toBeGreaterThanOrEqual(-0.5);
    expect(bounds.minY).toBeGreaterThanOrEqual(-0.5);
    expect(bounds.maxX).toBeLessThanOrEqual(AUTHORING_BOX + 0.5);
    expect(bounds.maxY).toBeLessThanOrEqual(AUTHORING_BOX + 0.5);
  });

  it('fits every part with one shared transform', () => {
    // A wide image: fitted per part, the pale core would be blown up to the
    // same width as the ring around it and the icon would come apart. Fitted
    // together, the result keeps the source's proportions.
    const shape = libraryShapeFromImage(ringedDisc(180, 90), { name: 'Wide' });
    const bounds = shape && boundsOf(shape);
    expect(bounds).not.toBeNull();
    if (!bounds) return;

    const aspect = (bounds.maxX - bounds.minX) / (bounds.maxY - bounds.minY);
    expect(aspect).toBeGreaterThan(1.5);
    expect(aspect).toBeLessThan(2.5);
  });

  it('sews the dark outline last', () => {
    const shape = libraryShapeFromImage(ringedDisc(), { name: 'Ring' });
    expect(shape).not.toBeNull();
    if (!shape) return;

    const last = shape.parts[shape.parts.length - 1];
    expect(last.name).toBe('Outline');
    // The ring is the dark colour, and it is the one that ends up last.
    const luminance = Number.parseInt(last.color?.slice(1, 3) ?? 'ff', 16);
    expect(luminance).toBeLessThan(96);
  });

  it('leaves the order alone when asked', () => {
    const shape = libraryShapeFromImage(ringedDisc(), { name: 'Ring', keylineLast: false });
    expect(shape?.parts.every((part) => part.name.startsWith('Colour'))).toBe(true);
  });

  it('does not mistake a dark subject for a keyline', () => {
    // A dark blob filling the icon is the subject. Moving it last would sew it
    // over everything drawn on top of it.
    const image = page(120, 120);
    disc(image, 60, 60, 50, DARK);
    disc(image, 45, 45, 8, WHITE);

    const shape = libraryShapeFromImage(image, { name: 'Blob' });
    expect(shape).not.toBeNull();
    expect(shape?.parts[shape.parts.length - 1].name).not.toBe('Outline');
  });

  it('keeps a feature the digitizer would drop at its own default size', () => {
    // A 6 px dot in a 120 px icon is about 5 % of it — well under the 1 mm²
    // that `autoDigitizeImage` drops by default once the design is nominally
    // 10 mm across, and exactly the size of an eye.
    const image = page(120, 120);
    disc(image, 60, 60, 50, PALE);
    disc(image, 45, 50, 6, DARK);
    disc(image, 75, 50, 6, DARK);

    const shape = libraryShapeFromImage(image, { name: 'Face', colors: 3 });
    expect(shape?.parts.length).toBeGreaterThanOrEqual(2);
  });

  it('returns null for a blank image rather than an empty shape', () => {
    expect(libraryShapeFromImage(page(60, 60), { name: 'Nothing' })).toBeNull();
  });

  it('files the shape in a collection, and searches find it there', () => {
    const shape = libraryShapeFromImage(ringedDisc(), { name: 'Ring', collection: 'Autumn' });
    expect(shape?.collection).toBe('Autumn');
    expect(shape?.keywords).toContain('autumn');
  });
});

describe('collections survive the round trip', () => {
  it('keeps the collection through serialize and parse', () => {
    const shape = libraryShapeFromImage(ringedDisc(), { name: 'Ring', collection: 'Autumn' });
    expect(shape).not.toBeNull();
    if (!shape) return;

    const [restored] = parseCustomShapes(serializeCustomShapes([shape]));
    expect(restored.collection).toBe('Autumn');
    expect(restored.name).toBe('Ring');
  });

  it('reads a library written before collections existed', () => {
    const legacy = JSON.stringify({
      version: 1,
      shapes: [{ id: 'a', name: 'Old', parts: [{ name: 'P', d: 'M 0 0 L 10 0 L 10 10 Z' }] }],
    });
    const [restored] = parseCustomShapes(legacy);
    expect(restored.collection).toBeUndefined();
    expect(restored.name).toBe('Old');
  });

  it('drops a collection that is not a usable name', () => {
    const odd = JSON.stringify({
      version: 1,
      shapes: [
        { id: 'a', name: 'A', collection: 42, parts: [{ name: 'P', d: 'M 0 0 L 10 0 L 10 10 Z' }] },
        { id: 'b', name: 'B', collection: '   ', parts: [{ name: 'P', d: 'M 0 0 L 10 0 L 10 10 Z' }] },
      ],
    });
    for (const shape of parseCustomShapes(odd)) expect(shape.collection).toBeUndefined();
  });

  it('caps a collection name rather than letting it become the panel', () => {
    const long = JSON.stringify({
      version: 1,
      shapes: [
        {
          id: 'a',
          name: 'A',
          collection: 'x'.repeat(500),
          parts: [{ name: 'P', d: 'M 0 0 L 10 0 L 10 10 Z' }],
        },
      ],
    });
    const [restored] = parseCustomShapes(long);
    expect(restored.collection?.length).toBeLessThanOrEqual(40);
  });
});
