import type { Point } from '../geometry/point.js';
import { regionWidthStats, type RegionWidthStats } from '../geometry/distance-transform.js';
import { polygonArea, polylineLength } from '../geometry/path.js';
import type { StitchSettings, StitchType } from './settings.js';

/**
 * Deciding *how* to stitch a shape.
 *
 * This is the judgement a digitizer makes by eye and the single biggest
 * determinant of whether an auto-digitized design looks hand-made or
 * machine-guessed: narrow ribbons want satin, broad areas want a fill, and
 * anything thinner than the thread itself wants a bean stitch. Getting it
 * wrong produces designs that technically sew but look wrong — satin stitches
 * so long they snag, or a fill crammed into a 1 mm sliver.
 */

export type ResolvedStitchType = 'running' | 'bean' | 'satin' | 'fill';

export interface StitchTypeDecision {
  type: ResolvedStitchType;
  /** Why this type was chosen. Surfaced in the UI so the choice is not a black box. */
  reason: string;
  width: RegionWidthStats | null;
}

/**
 * Chooses a stitch type for a closed region.
 *
 * `requested` short-circuits everything except `'auto'`, so an explicit user
 * choice is always honoured.
 */
export function chooseStitchType(
  rings: readonly (readonly Point[])[],
  settings: StitchSettings,
  requested: StitchType = 'auto',
): StitchTypeDecision {
  if (requested !== 'auto') {
    return { type: requested, reason: 'Set explicitly', width: null };
  }
  if (rings.length === 0 || rings[0].length < 3) {
    return { type: 'running', reason: 'Not a closed area', width: null };
  }

  // Resolve the raster to a third of the fill spacing: fine enough to measure
  // a satin-width ribbon, coarse enough to stay cheap on a large region.
  const width = regionWidthStats(rings, Math.max(1, settings.fillSpacing / 3));
  if (!width) {
    return { type: 'running', reason: 'Region could not be measured', width: null };
  }

  const area = polygonArea(rings[0]);
  if (area < settings.minSatinWidth * settings.minSatinWidth) {
    return { type: 'running', reason: 'Too small to fill', width };
  }
  if (width.p90Width < settings.minSatinWidth) {
    return {
      type: 'bean',
      reason: `Only ${(width.p90Width / 10).toFixed(1)} mm wide — thinner than a satin column`,
      width,
    };
  }
  // A shape that is mostly narrow but has one broad lobe still needs a fill:
  // the lobe would otherwise get satin stitches long enough to snag.
  if (width.maxWidth > settings.maxSatinWidth * 2) {
    return { type: 'fill', reason: 'Contains an area too broad for satin', width };
  }
  if (width.p90Width <= settings.maxSatinWidth) {
    return {
      type: 'satin',
      reason: `${(width.p90Width / 10).toFixed(1)} mm wide — suits a satin column`,
      width,
    };
  }
  return {
    type: 'fill',
    reason: `${(width.p90Width / 10).toFixed(1)} mm wide — too broad for satin`,
    width,
  };
}

export interface StitchCountEstimate {
  stitches: number;
  /** Sewn thread length in 0.1 mm units. */
  threadLength: number;
}

/**
 * Rough stitch count before generating anything, so the UI can warn about a
 * design that will take an hour to sew before the user commits to it.
 */
export function estimateStitchCount(
  rings: readonly (readonly Point[])[],
  type: ResolvedStitchType,
  settings: StitchSettings,
): StitchCountEstimate {
  if (rings.length === 0) return { stitches: 0, threadLength: 0 };
  const perimeter = polylineLength(rings[0], true);
  const area = polygonArea(rings[0]);

  switch (type) {
    case 'running':
      return {
        stitches: Math.ceil(perimeter / settings.stitchLength),
        threadLength: perimeter,
      };
    case 'bean':
      return {
        stitches: Math.ceil((perimeter / settings.stitchLength) * settings.beanRepeats),
        threadLength: perimeter * settings.beanRepeats,
      };
    case 'satin': {
      // Two penetrations per step, each crossing roughly the mean width.
      const meanWidth = area / Math.max(1, perimeter / 2);
      const steps = Math.ceil(perimeter / 2 / settings.satinDensity);
      return { stitches: steps * 2, threadLength: steps * meanWidth * 2 };
    }
    case 'fill':
    default: {
      const rowLength = area / Math.max(1, settings.fillSpacing);
      return {
        stitches: Math.ceil(rowLength / settings.stitchLength),
        threadLength: rowLength,
      };
    }
  }
}
