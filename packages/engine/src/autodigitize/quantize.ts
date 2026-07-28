import { applyPaletteSync, buildPaletteSync, utils } from 'image-q';
import { thread, type ThreadColor } from '../pattern/thread.js';
import type { RgbaImage } from './image-data.js';

/**
 * Reducing an image to the handful of colours a design can actually use.
 *
 * Every colour is a thread change: the machine stops, you cut, rethread and
 * restart. Eight colours is a long afternoon. This is the step that decides
 * how much work the finished design will be, which is why the count is a
 * front-and-centre control rather than a hidden constant.
 */

export interface QuantizeOptions {
  /** Number of colours to reduce to. */
  colors?: number;
  /**
   * `wuquant` weights by how much of the image a colour covers, which keeps
   * large flat areas accurate. `neuquant` follows gradients better, but tends
   * to spend colours on photographic shading that embroidery cannot show
   * anyway.
   */
  method?: 'wuquant' | 'neuquant';
}

export interface QuantizedImage {
  /** One palette index per pixel, row-major. */
  indices: Uint8Array;
  palette: ThreadColor[];
  /** Pixel count per palette entry. Never zero — unused entries are dropped. */
  counts: number[];
  width: number;
  height: number;
}

const DEFAULT_COLORS = 6;
const MAX_COLORS = 64;

function packRgb(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

export function quantizeImage(image: RgbaImage, options: QuantizeOptions = {}): QuantizedImage {
  const colors = Math.max(1, Math.min(MAX_COLORS, Math.round(options.colors ?? DEFAULT_COLORS)));
  const container = utils.PointContainer.fromUint8Array(
    new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength),
    image.width,
    image.height,
  );
  const built = buildPaletteSync([container], {
    colors,
    paletteQuantization: options.method ?? 'wuquant',
  });
  const bytes = applyPaletteSync(container, built, { imageQuantization: 'nearest' }).toUint8Array();

  // Every output pixel is exactly one of the palette colours, so an index can
  // be recovered by lookup rather than by another nearest-colour search.
  const byColor = new Map<number, number>();
  const palette: ThreadColor[] = [];
  for (const point of built.getPointContainer().getPointArray()) {
    const key = packRgb(point.r, point.g, point.b);
    if (byColor.has(key)) continue;
    byColor.set(key, palette.length);
    palette.push(thread(point.r, point.g, point.b));
  }

  const pixelCount = image.width * image.height;
  const indices = new Uint8Array(pixelCount);
  const counts = new Array<number>(palette.length).fill(0);
  for (let i = 0; i < pixelCount; i++) {
    const key = packRgb(bytes[i * 4], bytes[i * 4 + 1], bytes[i * 4 + 2]);
    let index = byColor.get(key);
    if (index === undefined) {
      // Defensive: a quantizer that emits an off-palette colour would
      // otherwise leave a hole in the index map.
      index = palette.length;
      byColor.set(key, index);
      palette.push(thread(bytes[i * 4], bytes[i * 4 + 1], bytes[i * 4 + 2]));
      counts.push(0);
    }
    indices[i] = index;
    counts[index]++;
  }

  return pruneUnused({ indices, palette, counts, width: image.width, height: image.height });
}

/** Drops palette entries no pixel uses and renumbers the index map to match. */
function pruneUnused(quantized: QuantizedImage): QuantizedImage {
  if (quantized.counts.every((count) => count > 0)) return quantized;

  const remap = new Int32Array(quantized.palette.length).fill(-1);
  const palette: ThreadColor[] = [];
  const counts: number[] = [];
  for (let i = 0; i < quantized.palette.length; i++) {
    if (quantized.counts[i] === 0) continue;
    remap[i] = palette.length;
    palette.push(quantized.palette[i]);
    counts.push(quantized.counts[i]);
  }
  const indices = new Uint8Array(quantized.indices.length);
  for (let i = 0; i < indices.length; i++) indices[i] = remap[quantized.indices[i]];
  return { indices, palette, counts, width: quantized.width, height: quantized.height };
}

/** The palette index whose colour is closest to a given RGB triple. */
export function nearestPaletteIndex(
  palette: readonly ThreadColor[],
  r: number,
  g: number,
  b: number,
): number {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const entry = palette[i];
    const rMean = (entry.r + r) / 2;
    const dr = entry.r - r;
    const dg = entry.g - g;
    const db = entry.b - b;
    const distance =
      (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}
