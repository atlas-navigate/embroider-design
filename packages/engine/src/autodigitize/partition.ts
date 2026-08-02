import { thread, threadDistance, type ThreadColor } from '../pattern/thread.js';
import type { Rgb } from './image-data.js';
import { cloneMask, createMask, type Mask } from './mask-ops.js';

/**
 * Operations on the quantized index map that never lose a pixel.
 *
 * The older cleanup worked one colour at a time: build a binary mask, open it,
 * despeckle it, trace what survives. Every step *removed* pixels, and a pixel
 * removed from one colour's mask was never handed to another — the deficit
 * came back as unfilled ground inside the icon: hairline seams along every
 * colour boundary, mottled holes in textured fills, and whole pale interiors
 * struck off with the page background.
 *
 * These helpers treat the index map as a partition instead. Smoothing is a
 * majority vote, so a stray pixel changes colour rather than disappearing;
 * a component too small to sew is reassigned to whatever surrounds it rather
 * than deleted; and the background is only what a flood from the border can
 * actually reach, so an eye-white enclosed by an outline keeps its colour
 * instead of vanishing along with the page it happens to match.
 */

/**
 * Every palette entry a ground flood may travel through.
 *
 * A JPEG's page ground rarely quantizes to one entry — "white" routinely
 * splits into two or three near-whites. Flooding only the nearest of them
 * would leave the others behind as giant foreground blobs. The default
 * threshold matches `mergeSimilarColors`: entries closer than any thread you
 * could buy are the same ground.
 */
export function backgroundLikeIndices(
  palette: readonly ThreadColor[],
  rgb: Rgb,
  threshold = 40,
): Set<number> {
  const target = thread(rgb[0], rgb[1], rgb[2]);
  const like = new Set<number>();
  for (let index = 0; index < palette.length; index++) {
    if (threadDistance(palette[index], target) < threshold) like.add(index);
  }
  return like;
}

/**
 * The background a flood from the border can reach.
 *
 * 4-connected on purpose: foreground is 8-connected everywhere else
 * (`labelComponents`, the tracer's saddle rule), and the complement of an
 * 8-connected foreground has to be 4-connected or a one-pixel diagonal
 * outline would not hold the flood out of the pocket it encloses.
 */
export function floodBackgroundMask(
  indices: Uint8Array,
  width: number,
  height: number,
  candidates: ReadonlySet<number>,
): Mask {
  const mask = createMask(width, height);
  if (candidates.size === 0 || width === 0 || height === 0) return mask;

  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const push = (index: number): void => {
    if (mask.data[index] !== 0 || !candidates.has(indices[index])) return;
    mask.data[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const y = (index / width) | 0;
    const x = index - y * width;
    if (x > 0) push(index - 1);
    if (x + 1 < width) push(index + 1);
    if (y > 0) push(index - width);
    if (y + 1 < height) push(index + width);
  }
  return mask;
}

/**
 * Majority-vote smoothing over the index map.
 *
 * The partition-preserving replacement for running a morphological open on
 * each colour separately: an anti-aliasing ribbon a pixel or two wide loses
 * the vote to the solid colour beside it and *becomes* that colour, where the
 * open simply erased it and left a seam of bare ground. Ties keep the pixel's
 * own index, so a chequerboard is left alone rather than flickering.
 */
export function smoothIndexMap(
  indices: Uint8Array,
  width: number,
  height: number,
  paletteSize: number,
  radius: number,
): Uint8Array {
  const out = Uint8Array.from(indices);
  if (radius <= 0 || paletteSize <= 1) return out;

  const counts = new Int32Array(paletteSize);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      for (let sy = y0; sy <= y1; sy++) {
        const row = sy * width;
        for (let sx = x0; sx <= x1; sx++) counts[indices[row + sx]]++;
      }

      const own = indices[y * width + x];
      let best = own;
      let bestCount = counts[own];
      for (let index = 0; index < paletteSize; index++) {
        if (counts[index] > bestCount) {
          best = index;
          bestCount = counts[index];
        }
      }
      out[y * width + x] = best;
      counts.fill(0);
    }
  }
  return out;
}

export interface ReassignOptions {
  /** Components under this many pixels are speckle wherever they sit. */
  minPixels: number;
  /**
   * Components whose pixel bounding box covers less than this are below the
   * tracer's own keep-threshold. Merging them here paints the pixels the
   * surrounding colour; letting them through would trace a region the size
   * filter then deletes, which is exactly the hole this module exists to
   * prevent.
   */
  minBoxPixels?: number;
}

export interface ReassignResult {
  indices: Uint8Array;
  background: Mask;
}

/**
 * Gives every too-small component to its surroundings.
 *
 * Each same-index 8-connected component below the thresholds takes the
 * majority index of the pixels around it — the background counting as a
 * candidate, but losing ties to real colours, since a gap shows fabric and an
 * overlap shows nothing. Components are handled smallest first so dust merges
 * before the thing it sits on is judged; a merge that lifts the combined
 * component past the threshold is not revisited, which errs on the side of
 * keeping pixels.
 */
export function reassignSmallComponents(
  indices: Uint8Array,
  width: number,
  height: number,
  paletteSize: number,
  options: ReassignOptions,
  background: Mask,
): ReassignResult {
  const out = Uint8Array.from(indices);
  const ground = cloneMask(background);
  const minPixels = Math.max(0, options.minPixels);
  const minBoxPixels = Math.max(0, options.minBoxPixels ?? 0);
  if (minPixels <= 1 && minBoxPixels <= 1) return { indices: out, background: ground };

  const size = width * height;
  const labels = new Int32Array(size).fill(-1);
  // Pixels in visit order. A flood fill visits one component contiguously, so
  // a start offset and a size are enough to find every pixel of it again.
  const order = new Int32Array(size);
  const stack = new Int32Array(size);
  const componentStart: number[] = [];
  const componentSize: number[] = [];
  const componentBoxArea: number[] = [];
  let cursor = 0;

  for (let start = 0; start < size; start++) {
    if (ground.data[start] !== 0 || labels[start] !== -1) continue;
    const label = componentStart.length;
    const index = out[start];
    componentStart.push(cursor);
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    let top = 0;
    stack[top++] = start;
    labels[start] = label;
    while (top > 0) {
      const at = stack[--top];
      order[cursor++] = at;
      const y = (at / width) | 0;
      const x = at - y * width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbour = ny * width + nx;
          if (ground.data[neighbour] !== 0 || labels[neighbour] !== -1) continue;
          if (out[neighbour] !== index) continue;
          labels[neighbour] = label;
          stack[top++] = neighbour;
        }
      }
    }
    componentSize.push(cursor - componentStart[label]);
    componentBoxArea.push((maxX - minX + 1) * (maxY - minY + 1));
  }

  const small: number[] = [];
  for (let label = 0; label < componentSize.length; label++) {
    if (componentSize[label] < minPixels || componentBoxArea[label] < minBoxPixels) {
      small.push(label);
    }
  }
  small.sort((a, b) => componentSize[a] - componentSize[b]);

  const BACKGROUND_VOTE = paletteSize;
  const votes = new Int32Array(paletteSize + 1);
  for (const label of small) {
    const start = componentStart[label];
    const end = start + componentSize[label];
    votes.fill(0);
    for (let i = start; i < end; i++) {
      const at = order[i];
      const y = (at / width) | 0;
      const x = at - y * width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbour = ny * width + nx;
          if (labels[neighbour] === label) continue;
          if (ground.data[neighbour] !== 0) votes[BACKGROUND_VOTE]++;
          else votes[out[neighbour]]++;
        }
      }
    }

    let best = -1;
    let bestVotes = 0;
    for (let index = 0; index < paletteSize; index++) {
      if (votes[index] > bestVotes) {
        best = index;
        bestVotes = votes[index];
      }
    }
    if (votes[BACKGROUND_VOTE] > bestVotes) best = BACKGROUND_VOTE;
    if (best < 0) continue; // Borders nothing: the component is the image.

    if (best === BACKGROUND_VOTE) {
      for (let i = start; i < end; i++) ground.data[order[i]] = 1;
    } else {
      for (let i = start; i < end; i++) out[order[i]] = best;
    }
  }

  return { indices: out, background: ground };
}
