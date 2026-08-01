import { type Rgb, type RgbaImage } from './image-data.js';
import { createMask, dilateMask, erodeMask, type Mask } from './mask-ops.js';

/**
 * Telling a sheet's ground from its drawings, when the ground is not white.
 *
 * The obvious model — one background colour, and every pixel far enough from it
 * is ink — holds for flat clip-art on a clean page and collapses on everything
 * else. Three real sheets break it, each differently:
 *
 *   - **linen texture.** The weave swings ten levels either side of the paper
 *     colour. A tolerance under that makes the whole page ink; over it, a pale
 *     icon goes with the grain.
 *   - **a photographed page.** Lighting falls off across the sheet, so the
 *     ground at one corner differs from the other by more than any icon differs
 *     from its own local ground. There is no single right threshold.
 *   - **white on off-white.** A cream ghost on linen is seven levels from the
 *     paper and the grain is ten. No threshold on absolute difference can
 *     separate those, in either direction.
 *
 * So this module measures the ground *per region* rather than per page, and
 * tests each pixel twice: once on how far it is from its own local ground, and
 * once on whether its neighbourhood is *consistently* off it. Grain fails the
 * second test because it is zero-mean; a pale ghost passes because it is not.
 * Neither threshold is a constant — both are read off the page's own noise, so
 * a clean JPEG and a woven photograph get thresholds an order of magnitude
 * apart without anybody touching a slider.
 */

export interface BackgroundField {
  /** Per-tile ground colour, row-major, three bytes a tile. */
  tiles: Uint8ClampedArray;
  tileSize: number;
  columns: number;
  rows: number;
  /** The raster the field was measured on. */
  width: number;
  height: number;
  /** The page-wide ground, used as the prior and as the fill of last resort. */
  global: Rgb;
}

/**
 * Tiles across the longest side.
 *
 * The tile has to sit in a band between two things it must not do. Smaller than
 * the weave period and the field starts tracking the grain, which cancels it
 * out of the residual and leaves nothing to calibrate against. Larger than the
 * icon pitch and it stops tracking the lighting, which is the whole reason it
 * exists. 28 across puts a 1400px page at 50px tiles: five times the coarsest
 * weave and a third of the smallest icon.
 */
const TILE_DIVISIONS = 28;
const MIN_TILE = 12;
const MAX_TILE = 64;

/**
 * Tiles across, for the field the neighbourhood test measures against.
 *
 * Five, not twenty-eight, and the difference is the whole reason there are two
 * fields. The fine one is what a *gradient* needs: fine enough to follow a lamp
 * across a page. But a drawing only a couple of tiles across and barely
 * different from the paper is, to that field, indistinguishable from the paper
 * changing colour — so it learns the drawing as background and the residual
 * comes out empty. That is precisely the pale-on-pale case, so the fine field
 * is the one thing that cannot be used to find it.
 *
 * At a fifth of the page a tile always contains several icons and the gaps
 * between them, so no icon can hide in one; and five samples across a page is
 * still plenty to follow a lamp, which is the only thing this field has to
 * track.
 */
const COARSE_DIVISIONS = 5;

/**
 * Where in each tile's histogram the ground might be read off.
 *
 * Three candidates rather than one, because no single percentile is right for
 * every tile and picking the wrong one does visible damage:
 *
 *   - reading **high** — "the ground is the light end of a light page" — reports
 *     the drawing as the ground the moment the drawing is *lighter* than the
 *     paper. Cream artwork on cream linen is a real sheet.
 *   - reading the **middle** is right from either side, but only while the tile
 *     is more page than drawing. A tile straddling the edge of a large icon is
 *     more icon than page, so the field learns the icon's own colour as the
 *     background there — and the icon comes back with its rim shaved off, which
 *     is a wrong crop and a wrong trace with nothing to say so.
 *
 * A mode would be the obvious choice and is the wrong one: it needs a dominant
 * bucket, and linen has no dominant bucket at all.
 *
 * So all three are computed and the tile takes whichever lands nearest the
 * page's own ground. That needs no assumption about which side of the paper the
 * drawings are on and no assumption about how much of the tile they cover — it
 * only assumes the paper is the same paper here as everywhere else, which is
 * the one thing a background is.
 */
const GROUND_PERCENTILES = [0.2, 0.5, 0.8];

/**
 * How far a tile may sit from the page's ground before it is disbelieved.
 *
 * A tile wholly inside a large dark drawing reports the drawing, and a field
 * that believed it would decide the drawing is its own background and erase it.
 * Scaled off the spread of the tiles themselves, so a page with real lighting
 * variation is not second-guessed for having it, with a floor for the clean
 * page where that spread is zero.
 */
const TILE_TRUST = 5;
const MIN_TILE_TRUST = 30;

/** Passes of "take the mean of my believable neighbours" over rejected tiles. */
const REFILL_PASSES = 3;

/**
 * The percentile of the residual taken as the page's own noise.
 *
 * Both thresholds are multiples of this, so it decides everything. 65 assumes
 * only that a third of the page is ground — true even of the densest sheet
 * here, which is 56 icons — while the median would read zero on a clean JPEG
 * and hand back no signal at all.
 */
const NOISE_PERCENTILE = 0.65;

/** Radius of the box blur on the signed residual: 3 gives a 7x7 window. */
const SOFT_RADIUS = 3;

/** Multiples of the measured noise that a pixel has to beat to count as ink. */
const HARD_NOISE_MULTIPLE = 2.2;
const SOFT_NOISE_MULTIPLE = 1.6;
const HARD_FLOOR = 6;
const SOFT_FLOOR = 3;
const HARD_MIN = 8;
const HARD_MAX = 96;
const SOFT_MIN = 4;
const SOFT_MAX = 48;

/**
 * The soft threshold implied by a hand-set hard one.
 *
 * A caller that overrides the tolerance means "this is how different from the
 * page a drawing is here". Averaged over 7x7 the same drawing survives at
 * roughly a quarter of that, and the edge term has to stay under the hard one
 * or it would be the only test that ever fired.
 */
const SOFT_FROM_HARD = 0.28;

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

function luma(r: number, g: number, b: number): number {
  return (r * 77 + g * 151 + b * 28) >> 8;
}

/**
 * The page's ground: the commonest colour in a band around the margin.
 *
 * Neither obvious rule survives on its own, and each fails on a page the other
 * handles:
 *
 *   - `borderColor` samples the outermost *ring* of pixels. A sheet printed
 *     with a border makes that ring entirely frame, the ink mask comes out
 *     inverted, and every icon vanishes into one page-sized blob.
 *   - the mode of the whole image fails the moment one drawing covers more
 *     than half the page, because the drawing then *is* the commonest colour
 *     and the ground becomes the ink.
 *
 * A band deep enough to drown a printed rule, but still all margin, is right in
 * both cases: a two-pixel frame is a rounding error within it, and a drawing
 * big enough to dominate the page still leaves the margin as ground.
 *
 * Bucketed to 16 levels per channel for the same reason `borderColor` does it:
 * a JPEG's white is never one value.
 */
export function pageBackground(image: RgbaImage): Rgb {
  const insetX = Math.floor(image.width * MARGIN_BAND);
  const insetY = Math.floor(image.height * MARGIN_BAND);

  const counts = new Map<number, number>();
  const record = (x: number, y: number): void => {
    const i = (y * image.width + x) * 4;
    const key =
      ((image.data[i] >> 4) << 8) | ((image.data[i + 1] >> 4) << 4) | (image.data[i + 2] >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  for (let y = 0; y < image.height; y++) {
    const throughout = y < insetY || y >= image.height - insetY;
    for (let x = 0; x < image.width; x++) {
      // Every pixel of the top and bottom bands; only the left and right
      // margins of the rows between them.
      if (throughout || x < insetX || x >= image.width - insetX) record(x, y);
    }
  }

  let bestKey = 0;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }
  // The middle of the bucket rather than an edge, so the tolerance is symmetric
  // around it.
  return [
    (((bestKey >> 8) & 0xf) << 4) | 8,
    (((bestKey >> 4) & 0xf) << 4) | 8,
    ((bestKey & 0xf) << 4) | 8,
  ];
}

/** How far in from each edge the ground is sampled, as a share of the page. */
const MARGIN_BAND = 0.15;

/**
 * The ground colour, measured tile by tile.
 *
 * The result is deliberately coarse. It is not a segmentation and not a
 * denoise — it is "what colour is the paper *here*", at a resolution fine
 * enough to follow a lamp and coarse enough to ignore a weave.
 */
export function estimateBackgroundField(
  image: RgbaImage,
  divisions = TILE_DIVISIONS,
  known?: Rgb,
): BackgroundField {
  const global = known ?? pageBackground(image);
  const tileSize = clamp(
    Math.round(Math.max(image.width, image.height) / divisions),
    divisions === TILE_DIVISIONS ? MIN_TILE : 1,
    divisions === TILE_DIVISIONS ? MAX_TILE : Number.MAX_SAFE_INTEGER,
  );
  const columns = Math.max(1, Math.ceil(image.width / tileSize));
  const rows = Math.max(1, Math.ceil(image.height / tileSize));

  const tiles = new Uint8ClampedArray(columns * rows * 3);
  const histogram = new Int32Array(768);
  const candidate = new Uint8ClampedArray(3);

  for (let row = 0; row < rows; row++) {
    const y0 = row * tileSize;
    const y1 = Math.min(image.height, y0 + tileSize);
    for (let column = 0; column < columns; column++) {
      const x0 = column * tileSize;
      const x1 = Math.min(image.width, x0 + tileSize);

      histogram.fill(0);
      let count = 0;
      for (let y = y0; y < y1; y++) {
        let i = (y * image.width + x0) * 4;
        for (let x = x0; x < x1; x++, i += 4) {
          histogram[image.data[i]]++;
          histogram[256 + image.data[i + 1]]++;
          histogram[512 + image.data[i + 2]]++;
          count++;
        }
      }

      const at = (column + row * columns) * 3;
      if (count === 0) {
        tiles[at] = global[0];
        tiles[at + 1] = global[1];
        tiles[at + 2] = global[2];
        continue;
      }
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const percentile of GROUND_PERCENTILES) {
        const wanted = Math.max(1, Math.round(count * percentile));
        for (let channel = 0; channel < 3; channel++) {
          let seen = 0;
          let value = 0;
          for (let level = 0; level < 256; level++) {
            seen += histogram[channel * 256 + level];
            if (seen >= wanted) {
              value = level;
              break;
            }
          }
          candidate[channel] = value;
        }
        const distance = Math.max(
          Math.abs(candidate[0] - global[0]),
          Math.abs(candidate[1] - global[1]),
          Math.abs(candidate[2] - global[2]),
        );
        if (distance >= bestDistance) continue;
        bestDistance = distance;
        tiles[at] = candidate[0];
        tiles[at + 1] = candidate[1];
        tiles[at + 2] = candidate[2];
      }
    }
  }

  refillUnbelievableTiles(tiles, columns, rows, global);
  return { tiles: smoothTiles(tiles, columns, rows), tileSize, columns, rows, width: image.width, height: image.height, global };
}

/**
 * Throws away tiles that are inside a drawing rather than on the page.
 *
 * The 80th percentile only finds ground when there is ground in the tile. A
 * tile in the middle of a filled pumpkin reports orange, and left alone the
 * field would call orange the background there and erase the pumpkin's middle
 * while keeping its rim — which looks exactly like the "only gets part of the
 * icon" failure this module exists to stop.
 *
 * The test is against the page's own ground and its own spread, so a genuinely
 * uneven page is not punished for being uneven.
 */
function refillUnbelievableTiles(
  tiles: Uint8ClampedArray,
  columns: number,
  rows: number,
  global: Rgb,
): void {
  const count = columns * rows;
  const distances = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    distances[i] = Math.max(
      Math.abs(tiles[i * 3] - global[0]),
      Math.abs(tiles[i * 3 + 1] - global[1]),
      Math.abs(tiles[i * 3 + 2] - global[2]),
    );
  }
  const sorted = Float64Array.from(distances).sort();
  const median = sorted[Math.floor(count / 2)];
  const limit = Math.max(MIN_TILE_TRUST, median * TILE_TRUST);

  const believable = new Uint8Array(count);
  for (let i = 0; i < count; i++) believable[i] = distances[i] <= limit ? 1 : 0;

  for (let pass = 0; pass < REFILL_PASSES; pass++) {
    const filled = Uint8Array.from(believable);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const index = row * columns + column;
        if (believable[index]) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let seen = 0;
        const consider = (nx: number, ny: number): void => {
          if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) return;
          const neighbour = ny * columns + nx;
          if (!believable[neighbour]) return;
          r += tiles[neighbour * 3];
          g += tiles[neighbour * 3 + 1];
          b += tiles[neighbour * 3 + 2];
          seen++;
        };
        consider(column - 1, row);
        consider(column + 1, row);
        consider(column, row - 1);
        consider(column, row + 1);
        if (seen === 0) continue;
        tiles[index * 3] = Math.round(r / seen);
        tiles[index * 3 + 1] = Math.round(g / seen);
        tiles[index * 3 + 2] = Math.round(b / seen);
        filled[index] = 1;
      }
    }
    believable.set(filled);
  }

  // Anything still surrounded by drawing takes the page's ground. On a sheet
  // whose middle is one enormous illustration that is the only honest answer.
  for (let i = 0; i < count; i++) {
    if (believable[i]) continue;
    tiles[i * 3] = global[0];
    tiles[i * 3 + 1] = global[1];
    tiles[i * 3 + 2] = global[2];
  }
}

/**
 * One 3x3 mean over the tile grid.
 *
 * Without it the field steps between tiles, and every step shows up in the
 * residual as a faint rectangular grid that the hard threshold then finds. It
 * costs nothing at this resolution.
 */
function smoothTiles(tiles: Uint8ClampedArray, columns: number, rows: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(tiles.length);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let seen = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = row + dy;
        if (ny < 0 || ny >= rows) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = column + dx;
          if (nx < 0 || nx >= columns) continue;
          const at = (ny * columns + nx) * 3;
          r += tiles[at];
          g += tiles[at + 1];
          b += tiles[at + 2];
          seen++;
        }
      }
      const at = (row * columns + column) * 3;
      out[at] = Math.round(r / seen);
      out[at + 1] = Math.round(g / seen);
      out[at + 2] = Math.round(b / seen);
    }
  }
  return out;
}

/** The coarse companion to a field, for the neighbourhood test. */
export function estimateCoarseField(image: RgbaImage, fine: BackgroundField): BackgroundField {
  return estimateBackgroundField(image, COARSE_DIVISIONS, fine.global);
}

/** The ground colour at one pixel, interpolated between tile centres. */
export function sampleBackground(field: BackgroundField, x: number, y: number): Rgb {
  const { tiles, tileSize, columns, rows } = field;
  // Outside the outermost tile centres this extrapolates rather than flattening
  // out. Clamping instead leaves a half-tile band down each edge holding the
  // colour of the tile next to it, and on a page whose ground is still changing
  // through that band the error accumulates into a strip of false ink along the
  // margin — one more cell, every time, on exactly the photographed pages this
  // is supposed to rescue.
  const fx = x / tileSize - 0.5;
  const fy = y / tileSize - 0.5;
  const x0 = clamp(Math.floor(fx), 0, Math.max(0, columns - 2));
  const y0 = clamp(Math.floor(fy), 0, Math.max(0, rows - 2));
  const x1 = Math.min(columns - 1, x0 + 1);
  const y1 = Math.min(rows - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const out: [number, number, number] = [0, 0, 0];
  for (let channel = 0; channel < 3; channel++) {
    const topLeft = tiles[(y0 * columns + x0) * 3 + channel];
    const topRight = tiles[(y0 * columns + x1) * 3 + channel];
    const bottomLeft = tiles[(y1 * columns + x0) * 3 + channel];
    const bottomRight = tiles[(y1 * columns + x1) * 3 + channel];
    const top = topLeft + (topRight - topLeft) * tx;
    const bottom = bottomLeft + (bottomRight - bottomLeft) * tx;
    out[channel] = clamp(Math.round(top + (bottom - top) * ty), 0, 255);
  }
  return out;
}

/**
 * Separable box blur over a signed field, by running sums.
 *
 * Signed is the entire point. Blurring the *absolute* difference from the
 * ground would give a weave a large positive average — noise has plenty of
 * magnitude, it just has no direction — and the result would separate nothing.
 * Blurring the signed difference lets the weave cancel against itself while a
 * region that is consistently lighter than its ground keeps its full mean.
 */
export function boxBlurSigned(
  values: Int16Array,
  width: number,
  height: number,
  radius: number,
): Int16Array {
  if (radius <= 0) return Int16Array.from(values);
  const span = radius * 2 + 1;
  const horizontal = new Int32Array(width * height);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    // Seed the window with the left edge repeated, so the blur does not fade
    // towards nothing at the margins.
    for (let k = -radius; k <= radius; k++) sum += values[row + clamp(k, 0, width - 1)];
    for (let x = 0; x < width; x++) {
      horizontal[row + x] = sum;
      sum -= values[row + clamp(x - radius, 0, width - 1)];
      sum += values[row + clamp(x + radius + 1, 0, width - 1)];
    }
  }

  const out = new Int16Array(width * height);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += horizontal[clamp(k, 0, height - 1) * width + x];
    for (let y = 0; y < height; y++) {
      out[y * width + x] = Math.round(sum / (span * span));
      sum -= horizontal[clamp(y - radius, 0, height - 1) * width + x];
      sum += horizontal[clamp(y + radius + 1, 0, height - 1) * width + x];
    }
  }
  return out;
}

export interface InkMaskOptions {
  /** Override for the per-pixel difference threshold. Omitted, it is measured. */
  backgroundTolerance?: number;
  /** Override for the neighbourhood threshold. Omitted, it is measured. */
  softTolerance?: number;
  /** Off, the whole page gets one ground colour, as it did before. */
  localBackground?: boolean;
}

export interface InkMaskResult {
  mask: Mask;
  /** The per-pixel threshold actually used, 0-255. */
  hardThreshold: number;
  /** The neighbourhood threshold actually used. */
  softThreshold: number;
  /** The page's own grain, as a difference from its local ground. */
  noiseFloor: number;
  /** Share of the page that came back ink, for the runaway-mask test. */
  inkShare: number;
}

/**
 * Which pixels are drawing.
 *
 * Two tests, ORed, because they fail on different things. A pixel is ink if it
 * is *far* from its local ground, or if its whole neighbourhood is *reliably*
 * off it.
 *
 * Grain fails the first because the threshold is set from the grain itself, and
 * the handful of specks that clear it are single pixels with nothing beside
 * them — the caller's open removes those. Grain fails the second because it is
 * zero-mean around the local ground, so the blur takes it down by the width of
 * the window. A cream ghost on linen fails the first and passes the second,
 * which is the case that has no other answer.
 */
export function adaptiveInkMask(
  image: RgbaImage,
  field: BackgroundField,
  coarse: BackgroundField,
  options: InkMaskOptions = {},
): InkMaskResult {
  const { width, height } = image;
  const count = width * height;
  const deviation = new Uint8Array(count);
  const signed = new Int16Array(count);
  const flat = options.localBackground === false;

  // Each test against the field it needs: the per-pixel one against the fine
  // field, so it follows a gradient, and the neighbourhood one against the
  // coarse field, so a pale drawing cannot be absorbed into its own background.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const i = index * 4;
      const r = image.data[i];
      const g = image.data[i + 1];
      const b = image.data[i + 2];
      const ground = flat ? field.global : sampleBackground(field, x, y);
      deviation[index] = Math.min(
        255,
        Math.max(Math.abs(r - ground[0]), Math.abs(g - ground[1]), Math.abs(b - ground[2])),
      );
      const broad = flat ? field.global : sampleBackground(coarse, x, y);
      signed[index] = luma(broad[0], broad[1], broad[2]) - luma(r, g, b);
    }
  }

  const noiseFloor = percentileOf(deviation, NOISE_PERCENTILE);
  const blurred = boxBlurSigned(signed, width, height, SOFT_RADIUS);
  const softNoise = percentileOfAbs(blurred, NOISE_PERCENTILE);

  const hardThreshold =
    options.backgroundTolerance ??
    clamp(Math.round(HARD_NOISE_MULTIPLE * noiseFloor) + HARD_FLOOR, HARD_MIN, HARD_MAX);
  const softThreshold =
    options.softTolerance ??
    (options.backgroundTolerance !== undefined
      ? Math.max(SOFT_FLOOR, Math.round(options.backgroundTolerance * SOFT_FROM_HARD))
      : clamp(Math.round(SOFT_NOISE_MULTIPLE * softNoise) + SOFT_FLOOR, SOFT_MIN, SOFT_MAX));

  const hard = createMask(width, height);
  for (let i = 0; i < count; i++) hard.data[i] = deviation[i] > hardThreshold ? 1 : 0;

  // The soft test answers "is this neighbourhood off the ground", so what it
  // marks is every pixel whose *window* contains a drawing — the drawing plus a
  // ring of ground one radius wide all round it. Two corrections, and skipping
  // either one is a structural error rather than a cosmetic one, because both
  // failures it causes are the very ones this module exists to prevent.
  //
  // Erode by the radius to take that ring back off, so a pale shape comes back
  // its own size rather than six pixels wider.
  //
  // Then keep only what the hard test did not already find, by suppressing
  // everything within a radius of hard ink. Without that, the halo around a
  // strong drawing bridges any gap narrower than twice the radius: two icons
  // three pixels apart come back as one icon, and a two-pixel speck comes back
  // as a blob too large for the despeckle to remove. The soft test is here to
  // find what the hard test *missed* — a cream ghost on cream paper — and a
  // halo around ink it already found is not that.
  //
  // The magnitude is taken *after* the blur, never before. Blurring the signed
  // residual is what lets grain cancel against itself; blurring its magnitude
  // would give grain a large positive average and separate nothing. Taking the
  // magnitude of the already-cancelled result costs none of that and is what
  // finds a drawing *lighter* than its page — a white ghost on cream linen,
  // which is a real sheet and which a test for "darker than the ground" misses
  // completely.
  const soft = createMask(width, height);
  for (let i = 0; i < count; i++) {
    const magnitude = blurred[i] < 0 ? -blurred[i] : blurred[i];
    soft.data[i] = magnitude > softThreshold ? 1 : 0;
  }
  const tightened = erodeMask(soft, SOFT_RADIUS);
  const alreadyFound = dilateMask(hard, SOFT_RADIUS);

  const mask = createMask(width, height);
  let ink = 0;
  for (let i = 0; i < count; i++) {
    const set =
      hard.data[i] === 1 || (tightened.data[i] === 1 && alreadyFound.data[i] === 0) ? 1 : 0;
    mask.data[i] = set;
    ink += set;
  }

  return { mask, hardThreshold, softThreshold, noiseFloor, inkShare: ink / Math.max(1, count) };
}

/** The threshold ceiling, so callers can say when the automatic path gave up. */
export const MAX_AUTOMATIC_TOLERANCE = HARD_MAX;

function percentileOf(values: Uint8Array, fraction: number): number {
  const histogram = new Int32Array(256);
  for (let i = 0; i < values.length; i++) histogram[values[i]]++;
  const wanted = Math.max(1, Math.round(values.length * fraction));
  let seen = 0;
  for (let level = 0; level < 256; level++) {
    seen += histogram[level];
    if (seen >= wanted) return level;
  }
  return 255;
}

function percentileOfAbs(values: Int16Array, fraction: number): number {
  const histogram = new Int32Array(256);
  for (let i = 0; i < values.length; i++) {
    const magnitude = values[i] < 0 ? -values[i] : values[i];
    histogram[magnitude > 255 ? 255 : magnitude]++;
  }
  const wanted = Math.max(1, Math.round(values.length * fraction));
  let seen = 0;
  for (let level = 0; level < 256; level++) {
    seen += histogram[level];
    if (seen >= wanted) return level;
  }
  return 255;
}
