import { describe, expect, it } from 'vitest';
import { createRgbaImage, setPixel, type Rgb, type RgbaImage } from '../../src/autodigitize/image-data.js';
import {
  adaptiveInkMask,
  boxBlurSigned,
  estimateBackgroundField,
  estimateCoarseField,
  sampleBackground,
} from '../../src/autodigitize/sheet-background.js';
import { countMask } from '../../src/autodigitize/mask-ops.js';

/**
 * The photometry, on its own.
 *
 * `sheet.test.ts` asks whether the right icons come out; these ask whether each
 * piece does what its comment claims. The two that matter most are the ones
 * that would fail silently: a background field that quietly learns a drawing as
 * background, and a blur that quietly stops cancelling noise.
 */

function ramp(width: number, height: number, from: number, to: number): RgbaImage {
  const image = createRgbaImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = Math.round(from + ((to - from) * x) / Math.max(1, width - 1));
      setPixel(image, x, y, [value, value, value]);
    }
  }
  return image;
}

function disc(image: RgbaImage, cx: number, cy: number, radius: number, rgb: Rgb): void {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) setPixel(image, x, y, rgb);
    }
  }
}

describe('estimateBackgroundField', () => {
  it('follows a ground that changes across the page', () => {
    const image = ramp(560, 200, 255, 100);
    const field = estimateBackgroundField(image);

    for (const x of [0, 100, 280, 460, 559]) {
      const expected = Math.round(255 - (155 * x) / 559);
      expect(Math.abs(sampleBackground(field, x, 100)[0] - expected)).toBeLessThanOrEqual(6);
    }
  });

  it('does not learn a large drawing as the ground beneath it', () => {
    // The middle of a filled shape is the case the tile percentile cannot
    // answer on its own — there is no ground in the tile to find. Left
    // uncorrected, the field decides the shape is its own background, the
    // residual there is zero, and the icon comes back hollow.
    const image = createRgbaImage(400, 400, [250, 250, 250]);
    disc(image, 200, 200, 120, [40, 40, 40]);

    const field = estimateBackgroundField(image);
    expect(sampleBackground(field, 200, 200)[0]).toBeGreaterThan(200);
    expect(sampleBackground(field, 10, 10)[0]).toBeGreaterThan(200);
  });

  it('measures the coarse field over windows no icon can hide inside', () => {
    // The fine field is allowed to absorb a pale icon — it is there to follow a
    // lamp, not to find one. The coarse field is not, because it is the only
    // thing that can see a drawing quieter than the page's own noise.
    const image = createRgbaImage(500, 500, [244, 241, 235]);
    for (const cy of [120, 250, 380]) {
      for (const cx of [120, 250, 380]) disc(image, cx, cy, 26, [252, 250, 246]);
    }

    const fine = estimateBackgroundField(image);
    const coarse = estimateCoarseField(image, fine);
    expect(coarse.tileSize).toBeGreaterThan(fine.tileSize * 3);
    // Reads the paper under the ghost, not the ghost.
    expect(Math.abs(sampleBackground(coarse, 120, 120)[0] - 244)).toBeLessThanOrEqual(4);
  });
});

describe('boxBlurSigned', () => {
  it('averages over the window', () => {
    const values = new Int16Array(9);
    values[4] = 90; // one impulse in the middle of a 3x3
    const blurred = boxBlurSigned(values, 3, 3, 1);
    // A 3x3 window over a single 90 is 10 everywhere the window reaches, which
    // at radius one on a 3x3 image is everywhere.
    for (let i = 0; i < 9; i++) expect(blurred[i]).toBe(10);
  });

  it('cancels zero-mean noise instead of accumulating it', () => {
    // This is the property the whole neighbourhood test rests on, and the
    // comparison against the magnitudes is the point: the same noise, blurred
    // after taking its magnitude, keeps every bit of its size and separates
    // nothing. Blurred signed, it very nearly disappears.
    const size = 200;
    let seed = 9;
    const values = new Int16Array(size * size);
    const magnitudes = new Int16Array(size * size);
    for (let i = 0; i < values.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      values[i] = ((seed >> 8) % 81) - 40;
      magnitudes[i] = Math.abs(values[i]);
    }

    const mean = (data: Int16Array): number => {
      let total = 0;
      for (let i = 0; i < data.length; i++) total += Math.abs(data[i]);
      return total / data.length;
    };

    expect(mean(boxBlurSigned(values, size, size, 3))).toBeLessThan(mean(values) * 0.25);
    expect(mean(boxBlurSigned(magnitudes, size, size, 3))).toBeGreaterThan(mean(values) * 0.9);
  });
});

describe('adaptiveInkMask', () => {
  function maskFor(image: RgbaImage, options = {}): number {
    const fine = estimateBackgroundField(image);
    return countMask(adaptiveInkMask(image, fine, estimateCoarseField(image, fine), options).mask);
  }

  it('sets its threshold from the page rather than from a constant', () => {
    const clean = createRgbaImage(300, 300, [250, 250, 250]);
    const woven = createRgbaImage(300, 300, [250, 250, 250]);
    let seed = 11;
    for (let i = 0; i < 300 * 300; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const shift = ((seed >> 8) % 21) - 10;
      woven.data[i * 4] += shift;
      woven.data[i * 4 + 1] += shift;
      woven.data[i * 4 + 2] += shift;
    }

    const fineClean = estimateBackgroundField(clean);
    const fineWoven = estimateBackgroundField(woven);
    const onClean = adaptiveInkMask(clean, fineClean, estimateCoarseField(clean, fineClean));
    const onWoven = adaptiveInkMask(woven, fineWoven, estimateCoarseField(woven, fineWoven));

    expect(onWoven.noiseFloor).toBeGreaterThan(onClean.noiseFloor);
    expect(onWoven.hardThreshold).toBeGreaterThan(onClean.hardThreshold);
    // And neither page has any drawing on it, so neither comes back as ink.
    expect(onWoven.inkShare).toBeLessThan(0.02);
  });

  it('leaves a blank page blank', () => {
    expect(maskFor(createRgbaImage(200, 200, [255, 255, 255]))).toBe(0);
  });
});
