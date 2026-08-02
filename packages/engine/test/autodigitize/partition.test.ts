import { describe, expect, it } from 'vitest';
import { createMask, countMask, type Mask } from '../../src/autodigitize/mask-ops.js';
import {
  backgroundLikeIndices,
  floodBackgroundMask,
  reassignSmallComponents,
  smoothIndexMap,
} from '../../src/autodigitize/partition.js';
import { thread } from '../../src/pattern/thread.js';

/**
 * The partition rule under test: a pixel may change colour on its way through
 * these helpers, but it is never deleted. Every case here is an index map a
 * few pixels wide, because the failures these functions exist to prevent —
 * a pocket struck off with the page, a speck erased instead of absorbed —
 * are all local, and a big fixture would only bury them.
 */

/** Builds an index map from rows of digits. */
function indexMap(rows: readonly string[]): {
  indices: Uint8Array;
  width: number;
  height: number;
} {
  const width = rows[0].length;
  const height = rows.length;
  const indices = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) indices[y * width + x] = Number(rows[y][x]);
  }
  return { indices, width, height };
}

function emptyMask(width: number, height: number): Mask {
  return createMask(width, height);
}

describe('backgroundLikeIndices', () => {
  it('collects every entry a thread could not tell from the ground', () => {
    const palette = [
      thread(255, 255, 255),
      thread(250, 250, 248),
      thread(220, 20, 30),
    ];
    const like = backgroundLikeIndices(palette, [255, 255, 255]);
    expect(like.has(0)).toBe(true);
    expect(like.has(1)).toBe(true);
    expect(like.has(2)).toBe(false);
  });
});

describe('floodBackgroundMask', () => {
  it('reaches only the ground connected to the border', () => {
    // A ring of colour 1 holding a pocket of the ground colour. The pocket is
    // part of the drawing — an eye-white — and must not be flooded.
    const { indices, width, height } = indexMap([
      '0000000',
      '0111110',
      '0100010',
      '0111110',
      '0000000',
    ]);
    const mask = floodBackgroundMask(indices, width, height, new Set([0]));
    expect(mask.data[0]).toBe(1);
    // The pocket at (2..4, 2) stays foreground.
    expect(mask.data[2 * width + 2]).toBe(0);
    expect(mask.data[2 * width + 3]).toBe(0);
    expect(mask.data[2 * width + 4]).toBe(0);
    // Everything outside the ring's 5x3 box is ground and floods.
    expect(countMask(mask)).toBe(7 * 5 - 5 * 3);
  });

  it('floods a mottled ground made of more than one entry', () => {
    const { indices, width, height } = indexMap([
      '0202020',
      '2011102',
      '0100010',
      '2011102',
      '0202020',
    ]);
    const mask = floodBackgroundMask(indices, width, height, new Set([0, 2]));
    // Both ground shades flood; the pocket inside the ring of 1s survives.
    expect(mask.data[0]).toBe(1);
    expect(mask.data[1]).toBe(1);
    expect(mask.data[2 * width + 3]).toBe(0);
  });

  it('cannot leak through a diagonal chain, matching 8-connected foreground', () => {
    // A diamond drawn entirely in diagonal steps. The tracer and
    // `labelComponents` treat it as one closed shape, so the flood has to
    // respect it as a wall: 4-connectivity is what makes the two agree.
    const { indices, width, height } = indexMap([
      '0001000',
      '0010100',
      '0100010',
      '0010100',
      '0001000',
    ]);
    const mask = floodBackgroundMask(indices, width, height, new Set([0]));
    expect(mask.data[2 * width + 3]).toBe(0);
  });
});

describe('smoothIndexMap', () => {
  it('folds a speck into the colour around it without losing the pixel', () => {
    const { indices, width, height } = indexMap([
      '00000',
      '00100',
      '00000',
    ]);
    const smoothed = smoothIndexMap(indices, width, height, 2, 1);
    expect(smoothed[1 * width + 2]).toBe(0);
    expect(smoothed).toHaveLength(indices.length);
  });

  it('keeps a two-pixel stroke, which an open of the same radius would erase', () => {
    const { indices, width, height } = indexMap([
      '0011000',
      '0011000',
      '0011000',
      '0011000',
      '0011000',
    ]);
    const smoothed = smoothIndexMap(indices, width, height, 2, 1);
    for (let y = 0; y < height; y++) {
      expect(smoothed[y * width + 2]).toBe(1);
      expect(smoothed[y * width + 3]).toBe(1);
    }
  });

  it('keeps the pixel its own colour on a tie', () => {
    const { indices, width, height } = indexMap([
      '0101',
      '1010',
      '0101',
    ]);
    const smoothed = smoothIndexMap(indices, width, height, 2, 1);
    expect(Array.from(smoothed)).toEqual(Array.from(indices));
  });
});

describe('reassignSmallComponents', () => {
  it('gives a speck to the colour surrounding it rather than deleting it', () => {
    const { indices, width, height } = indexMap([
      '1111111',
      '1112111',
      '1122211',
      '1112111',
      '1111111',
    ]);
    const { indices: out, background } = reassignSmallComponents(
      indices,
      width,
      height,
      3,
      { minPixels: 6 },
      emptyMask(width, height),
    );
    for (let i = 0; i < out.length; i++) expect(out[i]).toBe(1);
    expect(countMask(background)).toBe(0);
  });

  it('gives a speck sitting on the ground back to the ground', () => {
    const { indices, width, height } = indexMap([
      '0000000',
      '0002000',
      '0000000',
    ]);
    const ground = emptyMask(width, height);
    // Everything of colour 0 is already background.
    for (let i = 0; i < indices.length; i++) if (indices[i] === 0) ground.data[i] = 1;
    const { background } = reassignSmallComponents(
      indices,
      width,
      height,
      3,
      { minPixels: 4 },
      ground,
    );
    expect(background.data[1 * width + 3]).toBe(1);
  });

  it('merges a component whose bounding box is under the sewing threshold', () => {
    // Eight pixels in a 1x8 line: big enough by count, far too thin to sew.
    const { indices, width, height } = indexMap([
      '1111111111',
      '1222222221',
      '1111111111',
    ]);
    const { indices: out } = reassignSmallComponents(
      indices,
      width,
      height,
      3,
      { minPixels: 4, minBoxPixels: 24 },
      emptyMask(width, height),
    );
    for (let i = 0; i < out.length; i++) expect(out[i]).toBe(1);
  });

  it('leaves a component alone once it clears both thresholds', () => {
    const { indices, width, height } = indexMap([
      '11111',
      '12221',
      '12221',
      '12221',
      '11111',
    ]);
    const { indices: out } = reassignSmallComponents(
      indices,
      width,
      height,
      3,
      { minPixels: 4, minBoxPixels: 4 },
      emptyMask(width, height),
    );
    expect(out[2 * width + 2]).toBe(2);
  });
});
