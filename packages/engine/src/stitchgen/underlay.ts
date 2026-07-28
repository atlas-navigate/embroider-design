import { distance, midpoint, type Point } from '../geometry/point.js';
import { boundingBoxOfMany, polygonArea, polylineLength } from '../geometry/path.js';
import { offsetPolygonSafe } from '../geometry/offset.js';
import { pointAtDistanceAlong } from '../geometry/path.js';
import { generateTatamiFill } from './fill-tatami.js';
import { generateRunningStitch } from './running-stitch.js';
import { compensateCrossing, generateSatinColumn, type SatinRails } from './satin-column.js';
import type { StitchSettings, UnderlayType } from './settings.js';

/**
 * Underlay: the passes sewn *before* the visible stitching.
 *
 * Skipping underlay is the most common reason a home-digitized design looks
 * amateur. It does three things nothing else can: it tacks the fabric to the
 * stabiliser so the top stitching cannot shift, it raises the surface so satin
 * sits proud instead of sinking into the nap, and it stops a dense fill from
 * dragging the fabric inward as it sews.
 */

/** Underlay always stitches longer and looser than the top layer. */
const UNDERLAY_LENGTH_MULTIPLIER = 1;

function insetRings(
  rings: readonly (readonly Point[])[],
  inset: number,
): Point[][] {
  const out: Point[][] = [];
  for (let i = 0; i < rings.length; i++) {
    // The outer ring shrinks; holes grow, so the underlay keeps clear of both.
    const delta = i === 0 ? -inset : inset;
    const adjusted = offsetPolygonSafe(rings[i], delta);
    if (adjusted.length >= 3) out.push(adjusted);
  }
  return out;
}

export function generateEdgeRunUnderlay(
  rings: readonly (readonly Point[])[],
  settings: StitchSettings,
): Point[][] {
  const inset = settings.underlay.inset;
  const runs: Point[][] = [];
  for (const ring of insetRings(rings, inset)) {
    const path = generateRunningStitch(ring, settings, {
      closed: true,
      stitchLength: settings.underlay.stitchLength * UNDERLAY_LENGTH_MULTIPLIER,
    });
    if (path.length >= 2) runs.push(path);
  }
  return runs;
}

/**
 * A coarse fill run across the grain of the top fill. Crossing the top layer's
 * direction is the point: parallel underlay would just add density along the
 * same axis without stabilising anything.
 */
export function generateZigzagFillUnderlay(
  rings: readonly (readonly Point[])[],
  settings: StitchSettings,
): Point[][] {
  const target = insetRings(rings, settings.underlay.inset);
  if (target.length === 0) return [];
  return generateTatamiFill(target, settings, {
    angle: settings.fillAngle + 90,
    spacing: settings.underlay.fillSpacing,
    stitchLength: settings.underlay.stitchLength,
  });
}

function resolveFillUnderlayType(
  type: UnderlayType,
  rings: readonly (readonly Point[])[],
): Exclude<UnderlayType, 'auto'> {
  if (type !== 'auto') return type;
  const box = boundingBoxOfMany(rings);
  if (!box) return 'none';
  const area = rings.length > 0 ? polygonArea(rings[0]) : 0;
  // Below roughly 5 x 5 mm an edge run alone is plenty; a fill underlay in a
  // shape that small just adds bulk and stitch count.
  return area < 2500 ? 'edge-run' : 'edge-run-and-zigzag';
}

export function generateFillUnderlay(
  rings: readonly (readonly Point[])[],
  settings: StitchSettings,
): Point[][] {
  const type = resolveFillUnderlayType(settings.underlay.type, rings);
  switch (type) {
    case 'none':
      return [];
    case 'edge-run':
      return generateEdgeRunUnderlay(rings, settings);
    case 'zigzag':
      return generateZigzagFillUnderlay(rings, settings);
    case 'edge-run-and-zigzag':
      return [...generateEdgeRunUnderlay(rings, settings), ...generateZigzagFillUnderlay(rings, settings)];
    // Centre-walk is a satin concept; for an area it degrades to an edge run.
    case 'center-walk':
    case 'center-walk-and-zigzag':
      return generateEdgeRunUnderlay(rings, settings);
    default:
      return generateEdgeRunUnderlay(rings, settings);
  }
}

/** Pulls both rails inward, never past the point of collapsing the column. */
function narrowRails(rails: SatinRails, inset: number, samples: number): SatinRails {
  const left: Point[] = [];
  const right: Point[] = [];
  const leftLength = polylineLength(rails.left);
  const rightLength = polylineLength(rails.right);

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const onLeft = pointAtDistanceAlong(rails.left, t * leftLength);
    const onRight = pointAtDistanceAlong(rails.right, t * rightLength);
    if (!onLeft || !onRight) continue;
    const width = distance(onLeft.point, onRight.point);
    const shrink = Math.min(inset, width * 0.35);
    const { start, end } = compensateCrossing(onLeft.point, onRight.point, -shrink);
    left.push(start);
    right.push(end);
  }
  return { left, right };
}

/** A single running stitch down the middle of the column. */
export function generateCenterWalkUnderlay(
  rails: SatinRails,
  settings: StitchSettings,
  samples = 64,
): Point[] {
  const leftLength = polylineLength(rails.left);
  const rightLength = polylineLength(rails.right);
  if (leftLength < 1e-9 && rightLength < 1e-9) return [];

  const centerline: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const onLeft = pointAtDistanceAlong(rails.left, t * leftLength);
    const onRight = pointAtDistanceAlong(rails.right, t * rightLength);
    if (!onLeft || !onRight) continue;
    centerline.push(midpoint(onLeft.point, onRight.point));
  }
  if (centerline.length < 2) return [];
  return generateRunningStitch(centerline, settings, {
    stitchLength: settings.underlay.stitchLength,
  });
}

/** A wide, loose zigzag inside the column, giving the top satin something to sit on. */
export function generateSatinZigzagUnderlay(
  rails: SatinRails,
  settings: StitchSettings,
): Point[] {
  const narrowed = narrowRails(rails, settings.underlay.inset, 64);
  if (narrowed.left.length < 2 || narrowed.right.length < 2) return [];
  return generateSatinColumn(narrowed, settings, {
    density: settings.underlay.zigzagSpacing,
    pullCompensation: 0,
  });
}

function resolveSatinUnderlayType(
  type: UnderlayType,
  rails: SatinRails,
): Exclude<UnderlayType, 'auto'> {
  if (type !== 'auto') return type;
  const leftLength = polylineLength(rails.left);
  if (leftLength < 1) return 'none';
  // Narrow columns only have room for a centre walk; wider ones need the
  // zigzag as well or the satin sinks in the middle.
  const sample = pointAtDistanceAlong(rails.left, leftLength / 2);
  const other = pointAtDistanceAlong(rails.right, polylineLength(rails.right) / 2);
  if (!sample || !other) return 'center-walk';
  return distance(sample.point, other.point) > 30 ? 'center-walk-and-zigzag' : 'center-walk';
}

export function generateSatinUnderlay(rails: SatinRails, settings: StitchSettings): Point[][] {
  const type = resolveSatinUnderlayType(settings.underlay.type, rails);
  const runs: Point[][] = [];
  switch (type) {
    case 'none':
      return runs;
    case 'center-walk': {
      const walk = generateCenterWalkUnderlay(rails, settings);
      if (walk.length >= 2) runs.push(walk);
      return runs;
    }
    case 'zigzag': {
      const zigzag = generateSatinZigzagUnderlay(rails, settings);
      if (zigzag.length >= 2) runs.push(zigzag);
      return runs;
    }
    case 'edge-run': {
      for (const rail of [rails.left, rails.right]) {
        const path = generateRunningStitch(rail, settings, {
          stitchLength: settings.underlay.stitchLength,
        });
        if (path.length >= 2) runs.push(path);
      }
      return runs;
    }
    case 'center-walk-and-zigzag':
    case 'edge-run-and-zigzag':
    default: {
      const walk = generateCenterWalkUnderlay(rails, settings);
      if (walk.length >= 2) runs.push(walk);
      const zigzag = generateSatinZigzagUnderlay(rails, settings);
      if (zigzag.length >= 2) runs.push(zigzag);
      return runs;
    }
  }
}
