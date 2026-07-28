/**
 * Binary masks and the morphology that makes them stitchable.
 *
 * Quantizing a photograph produces colour regions full of single-pixel
 * speckle and one-pixel pinholes. Traced literally, that becomes thousands of
 * microscopic shapes, each with its own trim and tie-off — a design that takes
 * an hour to sew and looks like noise. Cleaning the mask first is not
 * cosmetic; it is the difference between a usable result and an unusable one.
 */

export interface Mask {
  data: Uint8Array;
  width: number;
  height: number;
}

export function createMask(width: number, height: number): Mask {
  return { data: new Uint8Array(width * height), width, height };
}

export function cloneMask(mask: Mask): Mask {
  return { data: Uint8Array.from(mask.data), width: mask.width, height: mask.height };
}

export function countMask(mask: Mask): number {
  let count = 0;
  for (let i = 0; i < mask.data.length; i++) count += mask.data[i];
  return count;
}

export function maskAt(mask: Mask, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return 0;
  return mask.data[y * mask.width + x];
}

/**
 * Morphological dilate/erode over a square structuring element.
 *
 * Erosion treats everything outside the image as background, so a shape
 * touching the edge is eroded from that edge too. That is the conservative
 * choice: it can shrink a bleed-off-the-edge design slightly, but the
 * alternative lets a shape grow outside the hoop.
 */
function morph(mask: Mask, radius: number, mode: 'dilate' | 'erode'): Mask {
  if (radius <= 0) return cloneMask(mask);
  const { width, height } = mask;
  const wanted = mode === 'dilate' ? 1 : 0;
  const out = createMask(width, height);

  // Separable: a square element is a horizontal pass then a vertical one.
  const horizontal = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let found = false;
      for (let k = -radius; k <= radius && !found; k++) {
        const sx = x + k;
        const value = sx < 0 || sx >= width ? 0 : mask.data[y * width + sx];
        if (value === wanted) found = true;
      }
      horizontal[y * width + x] = found ? wanted : 1 - wanted;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let found = false;
      for (let k = -radius; k <= radius && !found; k++) {
        const sy = y + k;
        const value = sy < 0 || sy >= height ? 0 : horizontal[sy * width + x];
        if (value === wanted) found = true;
      }
      out.data[y * width + x] = found ? wanted : 1 - wanted;
    }
  }
  return out;
}

export function dilateMask(mask: Mask, radius = 1): Mask {
  return morph(mask, radius, 'dilate');
}

export function erodeMask(mask: Mask, radius = 1): Mask {
  return morph(mask, radius, 'erode');
}

/** Erode then dilate: removes speckle without shrinking what survives. */
export function openMask(mask: Mask, radius = 1): Mask {
  return dilateMask(erodeMask(mask, radius), radius);
}

/** Dilate then erode: fills pinholes without growing the shape. */
export function closeMask(mask: Mask, radius = 1): Mask {
  return erodeMask(dilateMask(mask, radius), radius);
}

export interface ComponentLabels {
  /** Component index per pixel, -1 for background. */
  labels: Int32Array;
  /** Pixel count per component. */
  sizes: number[];
}

/**
 * Connected components, 8-connected.
 *
 * 8-connectivity matches how the tracer resolves its saddle points, so a
 * diagonal chain of pixels is one component here and one contour there.
 */
export function labelComponents(mask: Mask): ComponentLabels {
  const { width, height } = mask;
  const labels = new Int32Array(width * height).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];

  for (let start = 0; start < labels.length; start++) {
    if (mask.data[start] === 0 || labels[start] !== -1) continue;
    const label = sizes.length;
    let size = 0;
    stack.push(start);
    labels[start] = label;

    while (stack.length > 0) {
      const index = stack.pop() as number;
      size++;
      const y = Math.floor(index / width);
      const x = index - y * width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbour = ny * width + nx;
          if (mask.data[neighbour] === 0 || labels[neighbour] !== -1) continue;
          labels[neighbour] = label;
          stack.push(neighbour);
        }
      }
    }
    sizes.push(size);
  }
  return { labels, sizes };
}

/** Drops connected blobs smaller than `minArea` pixels. */
export function despeckleMask(mask: Mask, minArea: number): Mask {
  if (minArea <= 1) return cloneMask(mask);
  const { labels, sizes } = labelComponents(mask);
  const out = createMask(mask.width, mask.height);
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label >= 0 && sizes[label] >= minArea) out.data[i] = 1;
  }
  return out;
}

/** Fills enclosed background pockets smaller than `minArea` pixels. */
export function fillSmallHoles(mask: Mask, minArea: number): Mask {
  if (minArea <= 1) return cloneMask(mask);
  const inverted = createMask(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) inverted.data[i] = mask.data[i] === 0 ? 1 : 0;

  const { labels, sizes } = labelComponents(inverted);
  // Background touching the border is the outside, never a hole.
  const outside = new Set<number>();
  for (let x = 0; x < mask.width; x++) {
    const top = labels[x];
    const bottom = labels[(mask.height - 1) * mask.width + x];
    if (top >= 0) outside.add(top);
    if (bottom >= 0) outside.add(bottom);
  }
  for (let y = 0; y < mask.height; y++) {
    const left = labels[y * mask.width];
    const right = labels[y * mask.width + mask.width - 1];
    if (left >= 0) outside.add(left);
    if (right >= 0) outside.add(right);
  }

  const out = cloneMask(mask);
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label < 0 || outside.has(label)) continue;
    if (sizes[label] < minArea) out.data[i] = 1;
  }
  return out;
}

export interface CleanMaskOptions {
  /** Radius of the open/close structuring element, in pixels. 0 disables. */
  morphology?: number;
  /** Blobs and holes below this pixel count are removed. */
  minArea?: number;
}

/** The standard cleanup: open, close, then drop what is still too small. */
export function cleanMask(mask: Mask, options: CleanMaskOptions = {}): Mask {
  const radius = options.morphology ?? 1;
  const minArea = options.minArea ?? 0;
  let result = mask;
  if (radius > 0) {
    result = openMask(result, radius);
    result = closeMask(result, radius);
  }
  if (minArea > 1) {
    result = despeckleMask(result, minArea);
    result = fillSmallHoles(result, minArea);
  }
  return result;
}
