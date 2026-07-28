import { describe, expect, it } from 'vitest';
import { polygonArea } from '../../src/geometry/path.js';
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

  it('drops the background and keeps the subject colours', () => {
    const result = autoDigitizeImage(logo(), {
      targetWidth: mmToUnits(60),
      colors: 3,
      removeBackground: true,
    });
    expect(result.colors).toHaveLength(2);
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
