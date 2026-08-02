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
 * The arrangement cases are a few discs on a page, because the questions this
 * module has to get right about *layout* — how many icons, where they are,
 * whether one has leaked into another's crop — are not about what the icons
 * depict, and a real sheet would make the failures harder to read rather than
 * more convincing.
 *
 * The photometry cases are not like that. "Works on a textured ground" and
 * "finds a drawing paler than the page's own noise" are claims about pixels,
 * and a disc on flat white cannot test either one. Those pages are synthesised
 * with grain and gradients from a seeded generator, so they are as awkward as
 * the real sheets and still reproduce byte for byte.
 */

const WHITE: Rgb = [255, 255, 255];
const INK: Rgb = [20, 20, 24];

function page(width: number, height: number, ground: Rgb = WHITE): RgbaImage {
  return createRgbaImage(width, height, ground);
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

/** Seeded, so a page with grain on it is the same page on every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Weave: a per-pixel wobble around the ground colour.
 *
 * The point of it is that it is high-frequency and zero-mean, which is what
 * linen is and what makes it separable from a drawing at all.
 */
function grain(image: RgbaImage, amplitude: number, seed = 1): void {
  const random = mulberry32(seed);
  for (let i = 0; i < image.width * image.height; i++) {
    const shift = Math.round((random() * 2 - 1) * amplitude);
    image.data[i * 4] += shift;
    image.data[i * 4 + 1] += shift;
    image.data[i * 4 + 2] += shift;
  }
}

/** A ground that changes across the page, the way a photographed sheet does. */
function rampBackground(image: RgbaImage, from: Rgb, to: Rgb): void {
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const t = x / Math.max(1, image.width - 1);
      setPixel(image, x, y, [
        Math.round(from[0] + (to[0] - from[0]) * t),
        Math.round(from[1] + (to[1] - from[1]) * t),
        Math.round(from[2] + (to[2] - from[2]) * t),
      ]);
    }
  }
}

/** One letter-sized block. Captions are rows of these. */
function glyph(image: RgbaImage, x: number, y: number, width = 6, height = 8): void {
  rect(image, x, y, x + width, y + height);
}

function captionRow(image: RgbaImage, x: number, y: number, count: number): void {
  for (let i = 0; i < count; i++) glyph(image, x + i * 10, y);
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

function countInk(image: RgbaImage): number {
  let count = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) if (isInk(image, x, y)) count++;
  }
  return count;
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
    expect(scan.scale).toBe(1);

    scan.cells.forEach((cell, index) => {
      expect(cell.index).toBe(index);
      expectCentredOn(cell.box, centres[index]);
    });
  });

  it('crops each icon with a margin of ground around it', () => {
    const { image } = sixDiscSheet();
    const [cell] = scanIconSheet(image).cells;
    const crop = cell.crop();

    // A crop cut flush to the drawing would tell `autoDigitizeImage` that the
    // icon's own edge is the page background, and it would erase the icon.
    for (let x = 0; x < crop.width; x++) {
      expect(isInk(crop, x, 0)).toBe(false);
      expect(isInk(crop, x, crop.height - 1)).toBe(false);
    }
    for (let y = 0; y < crop.height; y++) {
      expect(isInk(crop, 0, y)).toBe(false);
      expect(isInk(crop, crop.width - 1, y)).toBe(false);
    }
  });

  it('separates or welds neighbours according to the joining distance', () => {
    // Two discs with a three-pixel gap between their edges.
    const image = page(160, 80);
    disc(image, 40, 40, 12);
    disc(image, 67, 40, 12);

    expect(scanIconSheet(image, { separation: 0 }).cells).toHaveLength(2);
    expect(scanIconSheet(image, { separation: 4 }).cells).toHaveLength(1);

    // And left to itself it joins them, which is the point of the default: two
    // marks three pixels apart on an otherwise empty page are one drawing.
    expect(scanIconSheet(image).cells).toHaveLength(1);
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

  it('measures the gap between two icons through the ink, not through their boxes', () => {
    // Two discs close enough that their bounding boxes clip, but far enough
    // apart that they are still two icons. This is the case that decides how
    // icons may be grouped at all: their boxes overlap, so the box gap is zero
    // and *any* joining distance would weld them, while the ink is a comfortable
    // fourteen pixels apart and no reasonable distance touches it.
    const image = page(160, 160);
    disc(image, 45, 45, 25);
    disc(image, 90, 90, 25);

    const scan = scanIconSheet(image, { separation: 12 });
    expect(scan.cells).toHaveLength(2);
    const [first] = scan.cells;
    expect(first.box.maxX).toBeGreaterThan(65); // the boxes really do overlap
    expect(first.box.maxY).toBeGreaterThan(65);

    const crop = first.crop();
    for (let y = 0; y < crop.height; y++) {
      for (let x = 0; x < crop.width; x++) {
        if (!isInk(crop, x, y)) continue;
        const sheetX = first.box.minX + x;
        const sheetY = first.box.minY + y;
        const toSecond = Math.hypot(sheetX - 90, sheetY - 90);
        expect(toSecond, `ink at ${sheetX},${sheetY} belongs to the other icon`).toBeGreaterThan(25);
      }
    }
  });

  it('returns one cell for a page holding a single large drawing', () => {
    // Half the page is well past `maxCellShare`, so a sheet's worth of cells
    // would all be rejected. Handing back nothing would be useless; handing
    // back the drawing is what the user meant.
    //
    // It also covers more of the page than the white does, which is what makes
    // the ground the *margin's* commonest colour rather than the whole
    // image's: taken over everything, the drawing would win and the page would
    // be traced inside out.
    const image = page(200, 200);
    disc(image, 100, 100, 80);

    const scan = scanIconSheet(image);
    expect(scan.background[0]).toBeGreaterThan(200);
    expect(scan.crowded).toBe(false);
    expect(scan.cells).toHaveLength(1);
    expect(scan.cells[0].box.maxX - scan.cells[0].box.minX).toBeGreaterThan(150);
  });

  it('returns nothing for a blank page', () => {
    const scan = scanIconSheet(page(120, 120));
    expect(scan.cells).toHaveLength(0);
    expect(scan.crowded).toBe(false);
  });

  it('drops speckle below the minimum size', () => {
    const image = page(300, 200);
    disc(image, 150, 100, 20);
    setPixel(image, 10, 10, INK);
    setPixel(image, 11, 10, INK);

    expect(scanIconSheet(image, { separation: 0 }).cells).toHaveLength(1);
  });
});

describe('scanIconSheet on grounds that are not flat white', () => {
  it('reads a woven ground without the drawings running together', () => {
    // A photograph of stitching on linen. Under one page-wide colour and one
    // flat tolerance this page has no answer: a tolerance below the weave makes
    // the whole page ink and welds every icon to every other through it, and one
    // above the weave loses any drawing that is not much darker than it.
    const image = page(300, 300, [242, 238, 230]);
    grain(image, 10, 7);
    const centres: [number, number][] = [];
    for (const cy of [70, 150, 230]) {
      for (const cx of [70, 150, 230]) {
        disc(image, cx, cy, 22);
        centres.push([cx, cy]);
      }
    }

    const scan = scanIconSheet(image);
    expect(scan.crowded).toBe(false);
    expect(scan.cells).toHaveLength(9);
    // The threshold was read off the weave rather than typed in, so it sits
    // above the grain and well below the drawings.
    expect(scan.noiseFloor).toBeGreaterThan(2);
    expect(scan.toleranceUsed).toBeGreaterThan(scan.noiseFloor);
    scan.cells.forEach((cell, index) => expectCentredOn(cell.box, centres[index]));
  });

  it('follows a ground that changes across the page', () => {
    // A sheet photographed under a lamp: the paper at one edge is darker than a
    // pale drawing at the other. No single threshold separates those, and the
    // page-wide model is not wrong by a little — it cannot be right at all.
    const image = page(400, 200);
    rampBackground(image, [255, 255, 255], [196, 200, 210]);
    disc(image, 200, 100, 20, [150, 150, 150]);
    disc(image, 320, 100, 20, [150, 150, 150]);
    // Twenty-six levels off the paper *here*, on the light side of the page —
    // and lighter than the paper is at the dark end of the same page, so a
    // single page-wide colour cannot see it at all.
    disc(image, 80, 100, 20, [217, 217, 217]);

    expect(scanIconSheet(image).cells).toHaveLength(3);
    // The same page with one ground colour loses the drawing that is only
    // different locally. This is what the tile field buys.
    expect(scanIconSheet(image, { localBackground: false }).cells.length).toBeLessThan(3);
  });

  it('finds a drawing paler than the page is noisy', () => {
    // Cream ghosts on cream linen: seven levels from the paper, where the weave
    // swings eight. Nothing measured pixel by pixel can separate those in either
    // direction — the drawing is quieter than the noise. What separates them is
    // that the drawing is *consistent* over a region and the weave is not.
    const image = page(400, 400, [245, 242, 236]);
    grain(image, 8, 3);
    const centres: [number, number][] = [];
    for (const cy of [90, 200, 310]) {
      for (const cx of [90, 200, 310]) {
        disc(image, cx, cy, 20, [252, 250, 246]);
        centres.push([cx, cy]);
      }
    }

    const scan = scanIconSheet(image);
    expect(scan.cells).toHaveLength(9);
    scan.cells.forEach((cell, index) => expectCentredOn(cell.box, centres[index]));

    // And it really is the neighbourhood test doing the work: with only the
    // per-pixel one, at a tolerance that clears the weave, they vanish.
    const hardOnly = scanIconSheet(image, { softTolerance: 9999, backgroundTolerance: 20 });
    expect(hardOnly.cells).toHaveLength(0);
  });

  it('says so when the page has no readable ground at all', () => {
    // A page whose "background" is itself a picture — a weave, or a photograph
    // the subject fills. Every icon is joined to every other through it, so what
    // comes back is one page-sized mass, and the count alone would look like a
    // result rather than a failure. That is why it has to be said out loud.
    const image = page(300, 300);
    for (let y = 0; y < 300; y++) {
      for (let x = 0; x < 300; x++) {
        if (x % 20 < 5 || y % 20 < 5) setPixel(image, x, y, [60, 60, 60]);
      }
    }
    disc(image, 100, 100, 16);
    disc(image, 200, 200, 16);

    const scan = scanIconSheet(image, { backgroundTolerance: 20 });
    expect(scan.crowded).toBe(true);
    // And the whole-page fallback stays out of the way: handing back a cell
    // around the noise would be worse than handing back nothing.
    expect(scan.cells.length).toBeLessThan(2);
  });
});

describe('scanIconSheet grouping an icon that is drawn in pieces', () => {
  it('keeps a floating part with the icon it belongs to', () => {
    // A candle with its flame thirty pixels above it, nine to a page. Every
    // icon here is two components that do not touch, and the failure this
    // guards against is the importer returning eighteen half-icons.
    const image = page(600, 600);
    const centres: [number, number][] = [];
    for (const cy of [100, 300, 500]) {
      for (const cx of [100, 300, 500]) {
        rect(image, cx - 20, cy, cx + 20, cy + 45);
        disc(image, cx, cy - 40, 11);
        centres.push([cx, cy]);
      }
    }

    const scan = scanIconSheet(image);
    expect(scan.cells).toHaveLength(9);
    for (const cell of scan.cells) {
      // Body and flame both inside one box: 45 of body, 30 of gap, 22 of flame.
      expect(cell.box.maxY - cell.box.minY).toBeGreaterThan(90);
    }
  });

  it('does not weld neighbours on a tightly packed sheet', () => {
    // The other side of the same decision. Forty-nine icons with twenty pixels
    // between them: nothing here is fragmented, so the joining distance has to
    // stay small, and it has to work that out from the page rather than be told.
    const image = page(700, 700);
    for (let row = 0; row < 7; row++) {
      for (let column = 0; column < 7; column++) {
        disc(image, 50 + column * 100, 50 + row * 100, 40);
      }
    }

    const scan = scanIconSheet(image);
    expect(scan.cells).toHaveLength(49);
    // One disc each, whole. Counting alone would not catch a cut that took a
    // slice off every icon and still returned forty-nine of them.
    for (const cell of scan.cells) {
      expect(cell.box.maxX - cell.box.minX).toBeGreaterThan(80);
      expect(cell.box.maxX - cell.box.minX).toBeLessThan(100);
    }
  });

  it('keeps an icon whose every piece is below the old minimum size', () => {
    // Fifty-six icons, each drawn as three small marks. Every mark on its own is
    // a fraction of a percent of the page — under the share-of-the-page minimum
    // this importer used to apply *before* grouping, which deleted an icon's
    // pieces one at a time and then reported the icon missing.
    const image = page(800, 900);
    let expected = 0;
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 7; column++) {
        const x = 50 + column * 105;
        const y = 55 + row * 110;
        disc(image, x, y, 9);
        disc(image, x + 22, y, 7);
        disc(image, x + 10, y + 26, 7);
        expected++;
      }
    }

    const scan = scanIconSheet(image);
    expect(expected).toBe(56);
    expect(scan.cells).toHaveLength(56);
    // Not 168 fragments, and not nothing.
    for (const cell of scan.cells) {
      expect(cell.box.maxX - cell.box.minX).toBeGreaterThan(30);
    }
  });
});

describe('scanIconSheet on pages carrying things that are not icons', () => {
  it('throws away a printed rule instead of threading the page onto it', () => {
    const { image } = sixDiscSheet();
    // One hairline across the page, between the two rows of discs. Left in, it
    // passes within a few pixels of every icon on the sheet and single-link
    // grouping strings all six onto it as one cell.
    rect(image, 0, 100, 300, 101, [190, 190, 190]);

    const scan = scanIconSheet(image);
    expect(scan.cells).toHaveLength(6);
    for (const cell of scan.cells) {
      expect(cell.box.maxX - cell.box.minX).toBeLessThan(100);
    }
  });

  it('does not mistake a short line for a printed rule', () => {
    // Under half the page wide, so it is something somebody drew. It comes back
    // as a cell — flagged, because it is wide and flat, but present.
    const { image } = sixDiscSheet();
    rect(image, 20, 100, 155, 101, [190, 190, 190]);

    const scan = scanIconSheet(image);
    expect(scan.cells.length).toBeGreaterThan(6);
  });

  it('flags a caption row without dropping it', () => {
    const image = page(400, 400);
    const centres: [number, number][] = [];
    for (const cy of [80, 200, 320]) {
      for (const cx of [80, 200, 320]) {
        disc(image, cx, cy, 28);
        centres.push([cx, cy]);
      }
    }
    // A format row along the bottom: "DST EXP PES JEF XXX VP3" and the like.
    captionRow(image, 130, 380, 8);

    const scan = scanIconSheet(image);
    const icons = scan.cells.filter((cell) => !cell.likelyLabel);
    expect(icons).toHaveLength(9);
    // Kept, not deleted: the classifier is a guess, and a wrong guess has to
    // cost one click rather than an icon nobody notices is gone.
    expect(scan.cells.length).toBeGreaterThan(9);
    expect(scan.labelCount).toBeGreaterThan(0);
    icons.forEach((cell, index) => expectCentredOn(cell.box, centres[index]));
  });

  it('flags a banner across the top of the page', () => {
    const image = page(400, 400);
    rect(image, 10, 10, 390, 45);
    for (const cy of [150, 280]) {
      for (const cx of [100, 200, 300]) disc(image, cx, cy, 30);
    }

    const scan = scanIconSheet(image);
    const banner = scan.cells.find((cell) => cell.box.maxX - cell.box.minX > 300);
    expect(banner).toBeDefined();
    expect(banner?.likelyLabel).toBe(true);
    expect(scan.cells.filter((cell) => !cell.likelyLabel)).toHaveLength(6);
  });
});

describe('scanIconSheet crops', () => {
  it('cuts the crop from the original image, not from the detection raster', () => {
    // Detection runs small because it only has to find the icons; tracing wants
    // every pixel the file has. A fifty-icon sheet reduced to a 1400-pixel raster
    // leaves ninety pixels an icon, and a trace of ninety pixels is where "it
    // does not get the detail" comes from.
    const image = page(800, 800);
    disc(image, 400, 400, 120);
    // Fine detail that only exists at full resolution.
    for (let y = 340; y < 460; y += 6) {
      for (let x = 340; x < 460; x += 6) rect(image, x, y, x + 3, y + 3, WHITE);
    }

    const scan = scanIconSheet(image, { maxDimension: 200 });
    expect(scan.scale).toBe(4);
    expect(scan.sourceWidth).toBe(800);
    expect(scan.cells).toHaveLength(1);

    const [cell] = scan.cells;
    expect(cell.sourceBox.minX).toBe(Math.floor(cell.box.minX * 4));
    const crop = cell.crop();
    expect(crop.width).toBe(cell.sourceBox.maxX - cell.sourceBox.minX);
    expect(crop.width).toBeGreaterThan((cell.box.maxX - cell.box.minX) * 3);

    // The checker survives as a checker, because the crop was taken before any
    // downscale. Counting *resolvable* squares rather than light-to-dark
    // changes: a downscaled checker aliases into a change at every pixel, which
    // scores well on transitions and holds no detail at all.
    const coarse = scanIconSheet(image, {
      maxDimension: 200,
      fullResolutionCrops: false,
    }).cells[0].crop();
    expect(squaresAcross(crop)).toBeGreaterThan(10);
    expect(squaresAcross(coarse)).toBeLessThan(3);
  });

  it('lets a cell adopt a rejected mark that sits wholly inside its box', () => {
    // Three ring icons; the first has a small detached dot in its hollow.
    // With a minimum size that rejects the dot's own cluster, the dot used to
    // become BLOCKED — painted out of every crop *including its own icon's*,
    // which showed up as a ground-coloured bite in the artwork. The only cell
    // whose padded box contains the whole of it now adopts it.
    const image = page(400, 400);
    const ring = (cx: number, cy: number): void => {
      disc(image, cx, cy, 30, INK);
      disc(image, cx, cy, 18, WHITE);
    };
    ring(100, 100);
    ring(250, 100);
    ring(100, 250);
    disc(image, 100, 100, 4, INK);

    const scan = scanIconSheet(image, { separation: 8, minCellShare: 0.001 });
    expect(scan.cells).toHaveLength(3);
    const cellA = scan.cells.find(
      (cell) =>
        cell.box.minX <= 100 && cell.box.maxX >= 100 && cell.box.minY <= 100 && cell.box.maxY >= 100,
    );
    expect(cellA).toBeDefined();
    if (!cellA) return;

    const crop = cellA.crop();
    expect(isInk(crop, 100 - cellA.sourceBox.minX, 100 - cellA.sourceBox.minY)).toBe(true);
  });

  it('keeps a neighbour out of the crop even when the crop is upscaled', () => {
    // The own/foreign decision is made on the detection raster and applied to
    // source pixels, so at a scale of four it is taken in blocks of four. It
    // still has to keep the neighbour out.
    const image = page(320, 320);
    disc(image, 90, 90, 50);
    disc(image, 180, 180, 50);

    const scan = scanIconSheet(image, { maxDimension: 80, separation: 4 });
    expect(scan.cells).toHaveLength(2);
    const [first] = scan.cells;
    const crop = first.crop();
    for (let y = 0; y < crop.height; y++) {
      for (let x = 0; x < crop.width; x++) {
        if (!isInk(crop, x, y)) continue;
        const sheetX = first.sourceBox.minX + x;
        const sheetY = first.sourceBox.minY + y;
        expect(Math.hypot(sheetX - 180, sheetY - 180)).toBeGreaterThan(50);
      }
    }
  });
});

/** Runs of pale pixels wide enough to still be a shape rather than an artefact. */
function squaresAcross(image: RgbaImage, minimumWidth = 2): number {
  const y = Math.floor(image.height / 2);
  let count = 0;
  let run = 0;
  for (let x = 0; x < image.width; x++) {
    if (isInk(image, x, y)) {
      if (run >= minimumWidth) count++;
      run = 0;
    } else {
      run++;
    }
  }
  return count;
}

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
      const inkPixels = countInk(cell.crop());
      // One disc's worth, not two.
      expect(inkPixels).toBeLessThan(600);
      expect(inkPixels).toBeGreaterThan(300);
    }
  });
});
