/**
 * Raw pixels, decoupled from any decoder.
 *
 * The engine never parses a PNG or a JPEG. The app hands it an already-decoded
 * RGBA buffer — the renderer gets one for free from `createImageBitmap` and a
 * canvas — which keeps this package free of native dependencies and lets the
 * whole auto-digitize pipeline be tested on buffers built by hand.
 */

export interface RgbaImage {
  /** Row-major RGBA, 4 bytes per pixel. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type Rgb = readonly [number, number, number];

export function createRgbaImage(width: number, height: number, fill?: Rgb): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  if (fill) {
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = fill[0];
      data[i * 4 + 1] = fill[1];
      data[i * 4 + 2] = fill[2];
      data[i * 4 + 3] = 255;
    }
  }
  return { data, width, height };
}

export function cloneRgbaImage(image: RgbaImage): RgbaImage {
  return {
    data: new Uint8ClampedArray(image.data),
    width: image.width,
    height: image.height,
  };
}

export function setPixel(image: RgbaImage, x: number, y: number, rgb: Rgb, alpha = 255): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const i = (y * image.width + x) * 4;
  image.data[i] = rgb[0];
  image.data[i + 1] = rgb[1];
  image.data[i + 2] = rgb[2];
  image.data[i + 3] = alpha;
}

/**
 * Box-filter downscale.
 *
 * Averaging every source pixel in a target pixel's footprint — rather than
 * point sampling — matters here more than it does for display: a nearest
 * neighbour downscale of a logo drops thin strokes entirely, and the tracer
 * can only find what survives the resize. Colours are averaged premultiplied
 * so transparent pixels do not drag a dark fringe into the result.
 */
export function resizeRgba(image: RgbaImage, width: number, height: number): RgbaImage {
  const targetWidth = Math.max(1, Math.round(width));
  const targetHeight = Math.max(1, Math.round(height));
  if (targetWidth === image.width && targetHeight === image.height) return cloneRgbaImage(image);

  const out = createRgbaImage(targetWidth, targetHeight);
  const scaleX = image.width / targetWidth;
  const scaleY = image.height / targetHeight;

  for (let ty = 0; ty < targetHeight; ty++) {
    const y0 = Math.floor(ty * scaleY);
    const y1 = Math.max(y0 + 1, Math.min(image.height, Math.ceil((ty + 1) * scaleY)));
    for (let tx = 0; tx < targetWidth; tx++) {
      const x0 = Math.floor(tx * scaleX);
      const x1 = Math.max(x0 + 1, Math.min(image.width, Math.ceil((tx + 1) * scaleX)));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * image.width + x) * 4;
          const alpha = image.data[i + 3] / 255;
          r += image.data[i] * alpha;
          g += image.data[i + 1] * alpha;
          b += image.data[i + 2] * alpha;
          a += image.data[i + 3];
          count++;
        }
      }
      if (count === 0) continue;
      const alphaMean = a / count;
      const weight = alphaMean > 0 ? count * (alphaMean / 255) : 1;
      const o = (ty * targetWidth + tx) * 4;
      out.data[o] = r / weight;
      out.data[o + 1] = g / weight;
      out.data[o + 2] = b / weight;
      out.data[o + 3] = alphaMean;
    }
  }
  return out;
}

/**
 * Shrinks an image so its longest side fits `maxDimension`, leaving smaller
 * images alone. Tracing cost scales with pixel count, and past a few hundred
 * pixels across, extra resolution only adds contour noise that simplification
 * has to remove again.
 */
export function fitWithin(image: RgbaImage, maxDimension: number): RgbaImage {
  const longest = Math.max(image.width, image.height);
  if (longest <= maxDimension) return cloneRgbaImage(image);
  const scale = maxDimension / longest;
  return resizeRgba(image, image.width * scale, image.height * scale);
}

/**
 * Flattens transparency onto a solid colour. Embroidery has no alpha channel —
 * every pixel either gets thread or does not — so this decision has to be made
 * before quantization rather than after.
 */
export function compositeOn(image: RgbaImage, background: Rgb = [255, 255, 255]): RgbaImage {
  const out = createRgbaImage(image.width, image.height);
  for (let i = 0; i < image.width * image.height; i++) {
    const alpha = image.data[i * 4 + 3] / 255;
    out.data[i * 4] = image.data[i * 4] * alpha + background[0] * (1 - alpha);
    out.data[i * 4 + 1] = image.data[i * 4 + 1] * alpha + background[1] * (1 - alpha);
    out.data[i * 4 + 2] = image.data[i * 4 + 2] * alpha + background[2] * (1 - alpha);
    out.data[i * 4 + 3] = 255;
  }
  return out;
}

export function hasTransparency(image: RgbaImage): boolean {
  for (let i = 0; i < image.width * image.height; i++) {
    if (image.data[i * 4 + 3] < 250) return true;
  }
  return false;
}

/**
 * The most common colour around the border.
 *
 * Photographs and logos alike tend to sit on a uniform ground, and the border
 * is where it is guaranteed to show. Sampling the whole frame rather than the
 * four corner pixels survives a rounded card or a vignette.
 */
export function borderColor(image: RgbaImage): Rgb {
  const counts = new Map<number, number>();
  const record = (x: number, y: number): void => {
    const i = (y * image.width + x) * 4;
    // Bucket to 16 levels per channel: a JPEG's "white" is never one value.
    const key =
      ((image.data[i] >> 4) << 8) | ((image.data[i + 1] >> 4) << 4) | (image.data[i + 2] >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < image.width; x++) {
    record(x, 0);
    record(x, image.height - 1);
  }
  for (let y = 0; y < image.height; y++) {
    record(0, y);
    record(image.width - 1, y);
  }

  let bestKey = 0;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }
  // Return the middle of the bucket rather than an edge.
  return [
    (((bestKey >> 8) & 0xf) << 4) | 8,
    (((bestKey >> 4) & 0xf) << 4) | 8,
    ((bestKey & 0xf) << 4) | 8,
  ];
}
