import { describe, expect, it } from 'vitest';
import { pointInPolygonWithHoles, polygonArea } from '../../src/geometry/path.js';
import { mmToUnits } from '../../src/pattern/units.js';
import {
  borderColor,
  compositeOn,
  createRgbaImage,
  fitWithin,
  hasTransparency,
  resizeRgba,
  setPixel,
  type RgbaImage,
} from '../../src/autodigitize/image-data.js';
import {
  cleanMask,
  closeMask,
  countMask,
  createMask,
  despeckleMask,
  dilateMask,
  erodeMask,
  fillSmallHoles,
  labelComponents,
  openMask,
  type Mask,
} from '../../src/autodigitize/mask-ops.js';
import { traceMaskRings } from '../../src/autodigitize/trace.js';
import { quantizeImage } from '../../src/autodigitize/quantize.js';
import {
  autoDigitizeImage,
  mergeSimilarColors,
} from '../../src/autodigitize/pipeline.js';

/** Builds a mask from an ASCII picture, `#` meaning filled. */
function maskFrom(rows: readonly string[]): Mask {
  const mask = createMask(rows[0].length, rows.length);
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      mask.data[y * mask.width + x] = rows[y][x] === '#' ? 1 : 0;
    }
  }
  return mask;
}

describe('image resizing', () => {
  it('averages rather than point-samples, so thin detail survives', () => {
    const image = createRgbaImage(4, 1, [0, 0, 0]);
    setPixel(image, 0, 0, [255, 255, 255]);
    setPixel(image, 1, 0, [255, 255, 255]);
    const small = resizeRgba(image, 2, 1);
    expect(small.width).toBe(2);
    expect(small.data[0]).toBe(255);
    expect(small.data[4]).toBe(0);
  });

  it('leaves an already-small image alone', () => {
    const image = createRgbaImage(10, 10, [1, 2, 3]);
    const fitted = fitWithin(image, 100);
    expect(fitted.width).toBe(10);
    expect(fitted.height).toBe(10);
  });

  it('shrinks the longest side to the limit, keeping the aspect ratio', () => {
    const image = createRgbaImage(800, 400, [1, 2, 3]);
    const fitted = fitWithin(image, 200);
    expect(fitted.width).toBe(200);
    expect(fitted.height).toBe(100);
  });
});

describe('transparency', () => {
  it('flattens alpha onto a background, since thread has no alpha channel', () => {
    const image = createRgbaImage(1, 1);
    image.data.set([0, 0, 0, 128], 0);
    expect(hasTransparency(image)).toBe(true);
    const flat = compositeOn(image, [255, 255, 255]);
    expect(flat.data[0]).toBeCloseTo(127, -1);
    expect(flat.data[3]).toBe(255);
    expect(hasTransparency(flat)).toBe(false);
  });
});

describe('borderColor', () => {
  it('finds the ground a subject sits on', () => {
    const image = createRgbaImage(20, 20, [250, 250, 250]);
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) setPixel(image, x, y, [10, 20, 200]);
    }
    const [r, g, b] = borderColor(image);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(200);
    expect(b).toBeGreaterThan(200);
  });
});

describe('morphology', () => {
  const SPECK = maskFrom([
    '.......',
    '.###...',
    '.###..#',
    '.###...',
    '.......',
  ]);

  it('dilate grows and erode shrinks', () => {
    expect(countMask(dilateMask(SPECK, 1))).toBeGreaterThan(countMask(SPECK));
    expect(countMask(erodeMask(SPECK, 1))).toBeLessThan(countMask(SPECK));
  });

  it('open removes an isolated speck but keeps the block', () => {
    const opened = openMask(SPECK, 1);
    expect(opened.data[2 * 7 + 6]).toBe(0);
    expect(opened.data[2 * 7 + 2]).toBe(1);
  });

  it('close fills a pinhole without growing the shape', () => {
    const holed = maskFrom([
      '.....',
      '.###.',
      '.#.#.',
      '.###.',
      '.....',
    ]);
    const closed = closeMask(holed, 1);
    expect(closed.data[2 * 5 + 2]).toBe(1);
    expect(closed.data[0]).toBe(0);
  });
});

describe('connected components', () => {
  const TWO = maskFrom([
    '##...',
    '##...',
    '...##',
    '...##',
  ]);

  it('counts separate blobs', () => {
    const { sizes } = labelComponents(TWO);
    expect(sizes).toHaveLength(2);
    expect(sizes.every((size) => size === 4)).toBe(true);
  });

  it('treats a diagonal touch as one blob, matching the tracer', () => {
    const diagonal = maskFrom(['#..', '.#.', '..#']);
    expect(labelComponents(diagonal).sizes).toHaveLength(1);
  });

  it('despeckle drops blobs under the threshold', () => {
    const cleaned = despeckleMask(maskFrom(['###..', '###.#', '###..']), 4);
    expect(countMask(cleaned)).toBe(9);
  });

  it('fills enclosed holes but never the outside', () => {
    const holed = maskFrom([
      '.....',
      '.###.',
      '.#.#.',
      '.###.',
      '.....',
    ]);
    const filled = fillSmallHoles(holed, 4);
    expect(filled.data[2 * 5 + 2]).toBe(1);
    expect(filled.data[0]).toBe(0);
  });

  it('cleanMask runs the whole sequence', () => {
    const cleaned = cleanMask(maskFrom(['#....', '.###.', '.###.', '.###.', '....#']), {
      morphology: 1,
      minArea: 4,
    });
    expect(cleaned.data[0]).toBe(0);
    expect(countMask(cleaned)).toBeGreaterThan(4);
  });
});

describe('traceMaskRings', () => {
  it('traces a solid block as one ring of the right area', () => {
    const rings = traceMaskRings(maskFrom(['....', '.##.', '.##.', '....']), {
      simplifyTolerance: 0,
    });
    expect(rings).toHaveLength(1);
    expect(polygonArea(rings[0])).toBeCloseTo(4, 9);
  });

  it('traces a hole as its own ring', () => {
    const rings = traceMaskRings(
      maskFrom(['.....', '.###.', '.#.#.', '.###.', '.....']),
      { simplifyTolerance: 0 },
    );
    expect(rings).toHaveLength(2);
    const areas = rings.map(polygonArea).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(1, 9);
    expect(areas[1]).toBeCloseTo(9, 9);
  });

  it('keeps diagonally touching cells in a single ring', () => {
    const rings = traceMaskRings(maskFrom(['#.', '.#']), { simplifyTolerance: 0 });
    expect(rings).toHaveLength(1);
  });

  it('separates blocks that do not touch at all', () => {
    const rings = traceMaskRings(maskFrom(['#..#']), { simplifyTolerance: 0 });
    expect(rings).toHaveLength(2);
  });

  it('applies scale and origin', () => {
    const rings = traceMaskRings(maskFrom(['##', '##']), {
      simplifyTolerance: 0,
      scale: 10,
      originX: 100,
      originY: 200,
    });
    const xs = rings[0].map((p) => p.x);
    const ys = rings[0].map((p) => p.y);
    expect(Math.min(...xs)).toBe(100);
    expect(Math.max(...xs)).toBe(120);
    expect(Math.min(...ys)).toBe(200);
    expect(polygonArea(rings[0])).toBeCloseTo(400, 6);
  });

  it('simplification flattens the staircase to four corners', () => {
    const block = maskFrom(['####', '####', '####', '####']);
    expect(traceMaskRings(block, { simplifyTolerance: 0 })[0].length).toBe(16);
    expect(traceMaskRings(block, { simplifyTolerance: 1 })[0].length).toBe(4);
  });

  it('drops rings below the minimum area', () => {
    const rings = traceMaskRings(maskFrom(['###.', '###.', '###.', '...#']), {
      simplifyTolerance: 0,
      minArea: 2,
    });
    expect(rings).toHaveLength(1);
  });
});

describe('quantizeImage', () => {
  function twoTone(): RgbaImage {
    const image = createRgbaImage(8, 8, [230, 20, 30]);
    for (let y = 0; y < 8; y++) {
      for (let x = 4; x < 8; x++) setPixel(image, x, y, [20, 40, 200]);
    }
    return image;
  }

  it('reduces to the requested number of colours', () => {
    const quantized = quantizeImage(twoTone(), { colors: 2 });
    expect(quantized.palette).toHaveLength(2);
    expect(quantized.counts.reduce((a, b) => a + b, 0)).toBe(64);
    expect(quantized.counts).toEqual([32, 32]);
  });

  it('indexes every pixel into the palette', () => {
    const quantized = quantizeImage(twoTone(), { colors: 2 });
    expect(quantized.indices).toHaveLength(64);
    for (const index of quantized.indices) {
      expect(index).toBeLessThan(quantized.palette.length);
    }
  });

  it('never returns an unused palette entry', () => {
    const flat = createRgbaImage(8, 8, [100, 100, 100]);
    const quantized = quantizeImage(flat, { colors: 8 });
    expect(quantized.counts.every((count) => count > 0)).toBe(true);
  });
});

describe('autoDigitizeImage', () => {
  /** A blue square and a red ring on white — one hole, two colours, one ground. */
  function logo(): RgbaImage {
    const image = createRgbaImage(120, 80, [255, 255, 255]);
    for (let y = 0; y < 80; y++) {
      for (let x = 0; x < 120; x++) {
        const dx = x - 35;
        const dy = y - 40;
        const radius = Math.hypot(dx, dy);
        if (radius <= 26 && radius >= 13) setPixel(image, x, y, [220, 20, 30]);
        if (x >= 75 && x < 110 && y >= 22 && y < 58) setPixel(image, x, y, [20, 50, 210]);
      }
    }
    return image;
  }

  it('drops only the border-connected ground, keeping an enclosed pocket', () => {
    const result = autoDigitizeImage(logo(), {
      targetWidth: mmToUnits(60),
      colors: 3,
      removeBackground: true,
    });
    // The page around the artwork is gone, but the white *inside* the ring is
    // part of the drawing and survives as a colour of its own. Deleting every
    // pixel of the ground's palette entry is how eye-whites and highlights
    // used to come back as bare fabric.
    expect(result.colors).toHaveLength(3);
    const white = result.colors.find((entry) => entry.color.r > 200 && entry.color.g > 200);
    expect(white).toBeDefined();
    expect(white!.regions).toHaveLength(1);
    expect(result.background).not.toBeNull();
    expect(result.background!.r).toBeGreaterThan(200);
  });

  it('keeps the background when told to', () => {
    const result = autoDigitizeImage(logo(), {
      targetWidth: mmToUnits(60),
      colors: 3,
      removeBackground: false,
    });
    expect(result.colors).toHaveLength(3);
  });

  it('scales to the requested design width and keeps the aspect ratio', () => {
    const result = autoDigitizeImage(logo(), {
      targetWidth: mmToUnits(60),
      colors: 3,
    });
    expect(result.width).toBe(600);
    expect(result.height).toBeCloseTo(400, 6);
  });

  it('recovers the ring as a region with a hole', () => {
    const result = autoDigitizeImage(logo(), {
      targetWidth: mmToUnits(60),
      colors: 3,
    });
    const red = result.colors.find((entry) => entry.color.r > 150)!;
    expect(red).toBeDefined();
    expect(red.regions).toHaveLength(1);
    expect(red.regions[0].holes).toHaveLength(1);
  });

  it('orders colours broadest first, which is also the right sewing order', () => {
    const result = autoDigitizeImage(logo(), {
      targetWidth: mmToUnits(60),
      colors: 3,
      removeBackground: false,
    });
    for (let i = 1; i < result.colors.length; i++) {
      expect(result.colors[i - 1].coverage).toBeGreaterThanOrEqual(result.colors[i].coverage);
    }
  });

  it('reports the working raster it actually traced', () => {
    const result = autoDigitizeImage(logo(), { targetWidth: mmToUnits(60), maxDimension: 60 });
    expect(result.rasterWidth).toBe(60);
    expect(result.rasterHeight).toBe(40);
  });
});

describe('autoDigitizeImage leaves no bare fabric inside the artwork', () => {
  function covered(result: ReturnType<typeof autoDigitizeImage>, x: number, y: number): boolean {
    return result.colors.some((entry) =>
      entry.regions.some((region) => pointInPolygonWithHoles({ x, y }, region.outer, region.holes)),
    );
  }

  it('keeps the seam between two colours filled', () => {
    // Two blocks with the thin blend stripe a JPEG leaves along their join.
    // The stripe takes a palette entry of its own, and cleaning each colour's
    // mask separately used to erase it — leaving an unfilled hairline down
    // every colour boundary, given to no other colour.
    const image = createRgbaImage(120, 80, [255, 255, 255]);
    for (let y = 20; y < 60; y++) {
      for (let x = 20; x < 58; x++) setPixel(image, x, y, [220, 20, 30]);
      for (let x = 58; x < 60; x++) setPixel(image, x, y, [120, 35, 120]);
      for (let x = 60; x < 100; x++) setPixel(image, x, y, [20, 50, 210]);
    }

    const result = autoDigitizeImage(image, {
      targetWidth: mmToUnits(60),
      colors: 4,
      removeBackground: true,
    });

    // Five design units to a pixel. Every interior point of the artwork is
    // inside some traced region — most importantly the ones down the stripe.
    for (let y = 25; y <= 55; y += 5) {
      expect(covered(result, 59 * 5, y * 5)).toBe(true);
    }
    for (let y = 25; y <= 55; y += 10) {
      for (let x = 25; x <= 95; x += 5) {
        expect(covered(result, x * 5, y * 5)).toBe(true);
      }
    }
  });

  it('fills a feature too small to sew with the colour around it', () => {
    // A 2x2 fleck inside a pale disc is under the keep-threshold. It used to
    // be traced, size-filtered, and deleted — a pinhole of bare fabric. Now
    // its pixels join the disc before anything is traced.
    const image = createRgbaImage(100, 100, [255, 255, 255]);
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        if ((x - 50) ** 2 + (y - 50) ** 2 <= 30 ** 2) setPixel(image, x, y, [232, 176, 96]);
      }
    }
    setPixel(image, 49, 49, [10, 10, 10]);
    setPixel(image, 50, 49, [10, 10, 10]);
    setPixel(image, 49, 50, [10, 10, 10]);
    setPixel(image, 50, 50, [10, 10, 10]);

    const result = autoDigitizeImage(image, {
      targetWidth: 100,
      colors: 3,
      removeBackground: true,
      minRegionAreaMm2: 0.09,
    });

    expect(result.colors).toHaveLength(1);
    const disc = result.colors[0];
    expect(disc.color.r).toBeGreaterThan(180);
    expect(disc.regions).toHaveLength(1);
    expect(disc.regions[0].holes).toHaveLength(0);
    expect(covered(result, 50, 50)).toBe(true);
  });
});

describe('mergeSimilarColors', () => {
  it('collapses colours no thread could tell apart', () => {
    const image = createRgbaImage(40, 40, [255, 255, 255]);
    for (let y = 5; y < 35; y++) {
      for (let x = 5; x < 20; x++) setPixel(image, x, y, [200, 30, 40]);
      // Two reds a couple of levels apart: a quantizer will keep both.
      for (let x = 20; x < 35; x++) setPixel(image, x, y, [204, 34, 44]);
    }
    const result = autoDigitizeImage(image, {
      targetWidth: mmToUnits(40),
      colors: 3,
      removeBackground: true,
    });
    const merged = mergeSimilarColors(result, 40);
    expect(merged.colors.length).toBeLessThanOrEqual(result.colors.length);
    expect(merged.colors).toHaveLength(1);
  });
});
