import { describe, expect, it } from 'vitest';
import {
  createRgbaImage,
  setPixel,
  type Rgb,
  type RgbaImage,
} from '../../src/autodigitize/image-data.js';
import { scanIconSheet, sliceSheetGrid } from '../../src/autodigitize/sheet.js';

/**
 * Cutting a sheet into icons, on sheets built here rather than on fixtures.
 *
 * Every case is a few discs on a white page, because the questions this module
 * has to get right are all about *arrangement* — how many icons, where they
 * are, and whether one has leaked into another's crop — and none of them are
 * about what the icons depict. A real sheet would make the failures harder to
 * read, not more convincing.
 */

const WHITE: Rgb = [255, 255, 255];
const INK: Rgb = [20, 20, 24];

function page(width: number, height: number): RgbaImage {
  return createRgbaImage(width, height, WHITE);
}

function disc(image: RgbaImage, cx: number, cy: number, radius: number, rgb: Rgb = INK): void {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) setPixel(image, x, y, rgb);
    }
  }
}

function rect(image: RgbaImage, x0: number, y0: number, x1: number, y1: number, rgb: Rgb = INK): void {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) setPixel(image, x, y, rgb);
}

/**
 * Asserts a cell is centred on a drawing, to within a pixel.
 *
 * A pixel of slack rather than none: a disc centred on 50 covers columns 32 to
 * 68, whose midpoint is 50.5, and the padding rounds outward on both sides.
 */
function expectCentredOn(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  centre: readonly [number, number],
): void {
  expect(Math.abs((box.minX + box.maxX) / 2 - centre[0])).toBeLessThanOrEqual(1);
  expect(Math.abs((box.minY + box.maxY) / 2 - centre[1])).toBeLessThanOrEqual(1);
}

function isInk(image: RgbaImage, x: number, y: number): boolean {
  const i = (y * image.width + x) * 4;
  return image.data[i] < 128;
}

/** A sheet of six discs, three across and two down. */
function sixDiscSheet(): { image: RgbaImage; centres: [number, number][] } {
  const image = page(300, 200);
  const centres: [number, number][] = [];
  for (const cy of [55, 145]) {
    for (const cx of [50, 150, 250]) {
      disc(image, cx, cy, 18);
      centres.push([cx, cy]);
    }
  }
  return { image, centres };
}

describe('scanIconSheet', () => {
  it('finds every icon on a sheet, in reading order', () => {
    const { image, centres } = sixDiscSheet();
    const scan = scanIconSheet(image);

    expect(scan.cells).toHaveLength(6);
    // The sheet is smaller than the working raster, so no downscale happened
    // and the boxes are in the same coordinates the discs were drawn in.
    expect(scan.width).toBe(300);
    expect(scan.height).toBe(200);

    scan.cells.forEach((cell, index) => {
      expect(cell.index).toBe(index);
      expectCentredOn(cell.box, centres[index]);
    });
  });

  it('crops each icon with a margin of ground around it', () => {
    const { image } = sixDiscSheet();
    const [cell] = scanIconSheet(image).cells;

    // A crop cut flush to the drawing would tell `autoDigitizeImage` that the
    // icon's own edge is the page background, and it would erase the icon.
    for (let x = 0; x < cell.image.width; x++) {
      expect(isInk(cell.image, x, 0)).toBe(false);
      expect(isInk(cell.image, x, cell.image.height - 1)).toBe(false);
    }
    for (let y = 0; y < cell.image.height; y++) {
      expect(isInk(cell.image, 0, y)).toBe(false);
      expect(isInk(cell.image, cell.image.width - 1, y)).toBe(false);
    }
  });

  it('separates or welds neighbours according to the separation radius', () => {
    // Two discs with a three-pixel gap between their edges.
    const image = page(160, 80);
    disc(image, 40, 40, 12);
    disc(image, 67, 40, 12);

    expect(scanIconSheet(image, { separation: 0 }).cells).toHaveLength(2);
    expect(scanIconSheet(image, { separation: 4 }).cells).toHaveLength(1);
  });

  it('rejects a border drawn around the whole page', () => {
    const image = page(300, 200);
    // A frame defeats `borderColor` outright — every pixel it samples is frame
    // — which is why the ground is measured over the whole page instead.
    rect(image, 0, 0, 300, 2);
    rect(image, 0, 198, 300, 200);
    rect(image, 0, 0, 2, 200);
    rect(image, 298, 0, 300, 200);
    disc(image, 100, 100, 20);
    disc(image, 200, 100, 20);

    const scan = scanIconSheet(image);
    expect(scan.cells).toHaveLength(2);
    for (const cell of scan.cells) {
      expect(cell.box.maxX - cell.box.minX).toBeLessThan(100);
    }
  });

  it('keeps a neighbour out of a crop whose boxes overlap', () => {
    // Two discs close enough that their bounding boxes clip, but far enough
    // apart that they are still two icons. A box-shaped crop would carry a
    // corner of each into the other.
    const image = page(160, 160);
    disc(image, 45, 45, 25);
    disc(image, 90, 90, 25);

    const scan = scanIconSheet(image, { separation: 0 });
    expect(scan.cells).toHaveLength(2);
    const [first] = scan.cells;
    expect(first.box.maxX).toBeGreaterThan(65); // the boxes really do overlap
    expect(first.box.maxY).toBeGreaterThan(65);

    for (let y = 0; y < first.image.height; y++) {
      for (let x = 0; x < first.image.width; x++) {
        if (!isInk(first.image, x, y)) continue;
        const sheetX = first.box.minX + x;
        const sheetY = first.box.minY + y;
        const toSecond = Math.hypot(sheetX - 90, sheetY - 90);
        expect(toSecond, `ink at ${sheetX},${sheetY} belongs to the other icon`).toBeGreaterThan(25);
      }
    }
  });

  it('returns one cell for a page holding a single large drawing', () => {
    // Half the page is well past `maxCellShare`, so every candidate is
    // rejected. Handing back nothing would be useless; handing back the
    // drawing is what the user meant.
    const image = page(200, 200);
    disc(image, 100, 100, 80);

    const scan = scanIconSheet(image);
    expect(scan.cells).toHaveLength(1);
    expect(scan.cells[0].box.maxX - scan.cells[0].box.minX).toBeGreaterThan(150);
  });

  it('returns nothing for a blank page', () => {
    expect(scanIconSheet(page(120, 120)).cells).toHaveLength(0);
  });

  it('drops speckle below the minimum size', () => {
    const image = page(300, 200);
    disc(image, 150, 100, 20);
    setPixel(image, 10, 10, INK);
    setPixel(image, 11, 10, INK);

    expect(scanIconSheet(image, { separation: 0 }).cells).toHaveLength(1);
  });
});

describe('sliceSheetGrid', () => {
  it('cuts a grid and trims each cell to its own ink', () => {
    const { image, centres } = sixDiscSheet();
    const scan = sliceSheetGrid(image, 2, 3);

    expect(scan.cells).toHaveLength(6);
    scan.cells.forEach((cell, index) => {
      expectCentredOn(cell.box, centres[index]);
      // Trimmed to the disc, not left as a sixth of the page.
      expect(cell.box.maxX - cell.box.minX).toBeLessThan(60);
    });
  });

  it('skips grid cells with nothing in them', () => {
    const image = page(300, 200);
    disc(image, 50, 55, 18);
    disc(image, 250, 145, 18);

    expect(sliceSheetGrid(image, 2, 3).cells).toHaveLength(2);
  });

  it('does not let a neighbouring cell bleed through the padding', () => {
    // Two discs drawn hard against the grid line between them: the padding ring
    // reaches over the cut, and has to come back as ground rather than as the
    // neighbour's ink.
    const image = page(200, 100);
    disc(image, 88, 50, 12);
    disc(image, 112, 50, 12);

    const scan = sliceSheetGrid(image, 1, 2, { padding: 8 });
    expect(scan.cells).toHaveLength(2);
    for (const cell of scan.cells) {
      const inkPixels = countInk(cell.image);
      // One disc's worth, not two.
      expect(inkPixels).toBeLessThan(600);
      expect(inkPixels).toBeGreaterThan(300);
    }
  });
});

function countInk(image: RgbaImage): number {
  let count = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) if (isInk(image, x, y)) count++;
  }
  return count;
}
