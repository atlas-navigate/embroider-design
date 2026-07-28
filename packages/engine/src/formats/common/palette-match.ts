import type { ThreadColor } from '../../pattern/thread.js';

/**
 * Mapping arbitrary RGB onto a machine's fixed thread chart.
 *
 * PEC (Brother) and JEF (Janome) do not store colours — they store *indices*
 * into a chart burned into the machine's firmware. Getting this mapping wrong
 * does not corrupt a file; it just makes the machine prompt for the wrong
 * spool, which is worse in a way, because it looks like it worked.
 *
 * A chart is an array whose index 0 is `null` (both Brother and Janome reserve
 * it), so indices are 1-based.
 */
export type ThreadChart = readonly (ThreadColor | null)[];

/**
 * Integer "redmean" distance, matching pyembroidery's `color_distance_red_mean`
 * bit for bit so our chart indices agree with the de-facto reference
 * implementation. See https://www.compuphase.com/cmetric.htm.
 */
export function colorDistanceRedMean(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const redMean = Math.round((r1 + r2) / 2);
  const r = r1 - r2;
  const g = g1 - g2;
  const b = b1 - b2;
  return (((512 + redMean) * r * r) >> 8) + 4 * g * g + (((767 - redMean) * b * b) >> 8);
}

/**
 * Index of the closest chart entry, or `null` if the chart is entirely empty.
 * Ties resolve to the later index, matching pyembroidery's `<=` comparison.
 */
export function findNearestColorIndex(color: ThreadColor, chart: ThreadChart): number | null {
  let closestIndex: number | null = null;
  let closestDistance = Infinity;
  for (let i = 0; i < chart.length; i++) {
    const entry = chart[i];
    if (!entry) continue;
    const distance = colorDistanceRedMean(color.r, color.g, color.b, entry.r, entry.g, entry.b);
    if (distance <= closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }
  return closestIndex;
}

/**
 * Assigns each *distinct* colour in `threads` its own chart index, then maps
 * every thread to the index its colour claimed.
 *
 * The alternative — matching each thread independently — collapses two similar
 * but deliberately different colours onto one spool, so the machine never
 * prompts for the second thread change and the design sews in the wrong
 * colours with no error anywhere.
 *
 * Unique colours are claimed in first-appearance order, which keeps output
 * deterministic (pyembroidery iterates a `set` here and does not).
 */
export function buildUniquePalette(chart: ThreadChart, threads: readonly ThreadColor[]): number[] {
  const available: (ThreadColor | null)[] = chart.slice();
  // Chart slots claimed by pattern colours; lookups then resolve to the claimant.
  const claimed: (ThreadColor | null)[] = new Array(chart.length).fill(null);

  const seen = new Set<number>();
  for (const thread of threads) {
    const key = (thread.r << 16) | (thread.g << 8) | thread.b;
    if (seen.has(key)) continue;
    seen.add(key);
    const index = findNearestColorIndex(thread, available);
    if (index === null) break; // Chart exhausted; the rest share slots.
    available[index] = null;
    claimed[index] = thread;
  }

  return threads.map((thread) => {
    const index = findNearestColorIndex(thread, claimed);
    return index ?? findNearestColorIndex(thread, chart) ?? 1;
  });
}

/**
 * Weaker guarantee than `buildUniquePalette`: only ensures two *consecutive*
 * blocks never share an index, so the machine always stops for the change.
 * This is what JEF wants — Janome charts are large enough that a global unique
 * assignment would push distant colours to poor matches.
 */
export function buildNonRepeatPalette(
  chart: ThreadChart,
  threads: readonly ThreadColor[],
): number[] {
  const working: (ThreadColor | null)[] = chart.slice();
  const palette: number[] = [];
  let lastIndex: number | null = null;
  let lastKey: number | null = null;

  for (const thread of threads) {
    const key = (thread.r << 16) | (thread.g << 8) | thread.b;
    let index = findNearestColorIndex(thread, working);
    if (index !== null && index === lastIndex && key !== lastKey) {
      // Different colour, same chart slot: take the runner-up instead.
      const displaced = working[index];
      working[index] = null;
      const alternative = findNearestColorIndex(thread, working);
      working[index] = displaced;
      if (alternative !== null) index = alternative;
    }
    palette.push(index ?? 1);
    lastIndex = index;
    lastKey = key;
  }
  return palette;
}
