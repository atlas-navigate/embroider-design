/**
 * Thread colours.
 *
 * Kept intentionally light: RGB plus optional catalogue identity. Matching an
 * arbitrary RGB value to a real spool (Madeira Polyneon, Isacord, Brother
 * Country) needs licensed colour charts and is a Phase 3 item — see
 * `docs/roadmap.md`. Until then a design carries its own colours and the
 * catalogue fields are free text the user can fill in.
 */
export interface ThreadColor {
  /** 0-255. */
  r: number;
  /** 0-255. */
  g: number;
  /** 0-255. */
  b: number;
  /** Human-readable name, e.g. "Prussian Blue". */
  description?: string;
  /** Manufacturer's colour code, e.g. "334". */
  catalogNumber?: string;
  /** Manufacturer, e.g. "Brother". */
  brand?: string;
  /** Colour chart the number belongs to. */
  chart?: string;
}

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  return rounded < 0 ? 0 : rounded > 255 ? 255 : rounded;
}

export function thread(
  r: number,
  g: number,
  b: number,
  description?: string,
  extra?: Pick<ThreadColor, 'catalogNumber' | 'brand' | 'chart'>,
): ThreadColor {
  return {
    r: clampChannel(r),
    g: clampChannel(g),
    b: clampChannel(b),
    ...(description === undefined ? {} : { description }),
    ...extra,
  };
}

/** Accepts `#rgb`, `#rrggbb`, `rgb`, or `rrggbb`. */
export function threadFromHex(hex: string, description?: string): ThreadColor {
  let value = hex.trim().replace(/^#/, '');
  if (value.length === 3) {
    value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`threadFromHex: "${hex}" is not a valid colour`);
  }
  const int = parseInt(value, 16);
  return thread((int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff, description);
}

export function threadToHex(color: ThreadColor): string {
  const hex = ((color.r << 16) | (color.g << 8) | color.b).toString(16).padStart(6, '0');
  return `#${hex}`;
}

export function threadToInt(color: ThreadColor): number {
  return ((color.r & 0xff) << 16) | ((color.g & 0xff) << 8) | (color.b & 0xff);
}

export function threadFromInt(value: number, description?: string): ThreadColor {
  return thread((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff, description);
}

export function threadsEqual(a: ThreadColor, b: ThreadColor): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

export function cloneThread(color: ThreadColor): ThreadColor {
  return { ...color };
}

/**
 * "Redmean" colour distance — a cheap approximation of perceptual difference
 * that behaves far better than plain RGB Euclidean distance on the saturated
 * colours thread charts are full of.
 */
export function threadDistance(a: ThreadColor, b: ThreadColor): number {
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db,
  );
}

export interface NearestThreadResult {
  thread: ThreadColor;
  index: number;
  distance: number;
}

export function nearestThread(
  target: ThreadColor,
  palette: readonly ThreadColor[],
): NearestThreadResult | null {
  if (palette.length === 0) return null;
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = threadDistance(target, palette[i]);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }
  return { thread: palette[bestIndex], index: bestIndex, distance: bestDistance };
}

/** Relative luminance (sRGB, 0-1). Used to pick readable label text in the UI. */
export function threadLuminance(color: ThreadColor): number {
  const channel = (value: number): number => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export const DEFAULT_THREAD: ThreadColor = Object.freeze(
  thread(0, 0, 0, 'Black'),
) as ThreadColor;

/**
 * Fallback colours assigned to layers and to colour blocks that arrive without
 * a thread. Chosen to stay distinguishable from each other in the preview.
 */
export const DEFAULT_PALETTE: readonly ThreadColor[] = Object.freeze([
  thread(0, 0, 0, 'Black'),
  thread(220, 30, 40, 'Red'),
  thread(20, 70, 190, 'Blue'),
  thread(240, 190, 20, 'Gold'),
  thread(20, 140, 70, 'Green'),
  thread(150, 40, 160, 'Purple'),
  thread(245, 130, 30, 'Orange'),
  thread(110, 70, 40, 'Brown'),
  thread(240, 130, 175, 'Pink'),
  thread(120, 125, 130, 'Grey'),
  thread(30, 190, 200, 'Turquoise'),
  thread(250, 250, 245, 'White'),
]);

export function defaultThreadForIndex(index: number): ThreadColor {
  const palette = DEFAULT_PALETTE;
  return cloneThread(palette[((index % palette.length) + palette.length) % palette.length]);
}
