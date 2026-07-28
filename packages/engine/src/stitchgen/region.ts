import type { Point } from '../geometry/point.js';
import { offsetPolygonSafe } from '../geometry/offset.js';
import { generateColumnStitches, orderSatinColumns, regionToSatinColumns } from './auto-satin.js';
import { generateTatamiFill } from './fill-tatami.js';
import { generateBeanStitch, generateRunningStitch } from './running-stitch.js';
import { generateSatinColumn, type SatinRails } from './satin-column.js';
import type { StitchSettings, StitchType } from './settings.js';
import { chooseStitchType, type ResolvedStitchType } from './stitch-router.js';
import { generateFillUnderlay, generateSatinUnderlay } from './underlay.js';

/**
 * Turning one closed region into stitches, underlay and all.
 *
 * This is the entry point `document/compile.ts` calls per layer. Everything
 * below it is a building block; this is where the order is decided —
 * underlay first, then the visible pass.
 */

export interface RegionStitchResult {
  /** Contiguous paths. The caller travels (and trims) between them. */
  runs: Point[][];
  type: ResolvedStitchType;
  /** Human-readable justification, shown in the UI next to the layer. */
  reason: string;
}

/**
 * Grows a fill outward so it still meets its neighbours after the fabric pulls
 * in. Holes shrink for the same reason. An offset that fails validity checks is
 * skipped rather than forced — a bad offset is worse than none.
 */
export function applyFillPullCompensation(
  rings: readonly (readonly Point[])[],
  amount: number,
): Point[][] {
  if (amount <= 0) return rings.map((ring) => ring.map((p) => ({ ...p })));
  return rings.map((ring, index) => {
    const adjusted = offsetPolygonSafe(ring, index === 0 ? amount : -amount);
    return adjusted.length >= 3 ? adjusted : ring.map((p) => ({ ...p }));
  });
}

function fillRegion(
  rings: readonly (readonly Point[])[],
  settings: StitchSettings,
): Point[][] {
  const runs: Point[][] = [];
  for (const run of generateFillUnderlay(rings, settings)) runs.push(run);
  const compensated = applyFillPullCompensation(rings, settings.pullCompensation);
  for (const run of generateTatamiFill(compensated, settings)) runs.push(run);
  return runs;
}

/** Underlay then satin, for a column whose rails are already known. */
export function generateSatinRegion(
  rails: SatinRails,
  settings: StitchSettings,
): Point[][] {
  const runs: Point[][] = [];
  for (const run of generateSatinUnderlay(rails, settings)) runs.push(run);
  const column = generateSatinColumn(rails, settings);
  if (column.length >= 2) runs.push(column);
  return runs;
}

export function generateRegionStitches(
  rings: readonly (readonly Point[])[],
  settings: StitchSettings,
  requested: StitchType = 'auto',
): RegionStitchResult {
  const decision = chooseStitchType(rings, settings, requested);

  if (decision.type === 'running' || decision.type === 'bean') {
    const runs: Point[][] = [];
    for (const ring of rings) {
      if (ring.length < 2) continue;
      const path =
        decision.type === 'bean'
          ? generateBeanStitch(ring, settings, { closed: true })
          : generateRunningStitch(ring, settings, { closed: true });
      if (path.length >= 2) runs.push(path);
    }
    return { runs, type: decision.type, reason: decision.reason };
  }

  if (decision.type === 'satin') {
    // One column per stroke, found from the medial axis. A letter is rarely a
    // single column — an "H" is three — and pairing up its outline directly
    // would fold stitches straight across the letter.
    const columns = regionToSatinColumns(rings, settings);
    if (columns && columns.length > 0) {
      const runs: Point[][] = [];
      for (const column of orderSatinColumns(columns)) {
        for (const run of generateColumnStitches(column, settings)) runs.push(run);
      }
      if (runs.length > 0) {
        const suffix = columns.length > 1 ? ` (${columns.length} columns)` : '';
        return { runs, type: 'satin', reason: `${decision.reason}${suffix}` };
      }
    }
    // No stroke structure — a disc or a blob. Its measured width said satin,
    // but there is no column to walk, and filling is always safe.
    return {
      runs: fillRegion(rings, settings),
      type: 'fill',
      reason: 'No stroke structure for a satin column',
    };
  }

  return { runs: fillRegion(rings, settings), type: 'fill', reason: decision.reason };
}

/** Stitches an open path — the stroke tools and traced centrelines use this. */
export function generatePathStitches(
  path: readonly Point[],
  settings: StitchSettings,
  type: 'running' | 'bean' = 'running',
): Point[][] {
  const generated =
    type === 'bean'
      ? generateBeanStitch(path, settings)
      : generateRunningStitch(path, settings);
  return generated.length >= 2 ? [generated] : [];
}
