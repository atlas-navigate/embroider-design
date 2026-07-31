import * as clipping from 'polygon-clipping';
import type { Point } from './point.js';
import { boundingBoxOfPoints, dedupeConsecutivePoints, openRing } from './path.js';
import { offsetPolygonSafe } from './offset.js';
import { groupRingsIntoRegions } from './regions.js';

/**
 * Boolean operations on rings: union, difference, intersection and exclusion.
 *
 * This is the one place the project takes a third-party geometry dependency,
 * and it is a deliberate exception to the rule that `offset.ts` states — that
 * embroidery needs a good-enough offset, not a Clipper-grade one. Offsetting
 * fails softly: a bad inset is skipped and the shape sews without underlay.
 * A bad boolean does not fail softly. It hands back a plausible-looking ring
 * list that stitches the wrong thing, and the user has no way to tell. The
 * cases that break hand-rolled clippers are not exotic either — subtracting a
 * rectangle whose edge lands exactly on the subject's edge is a *normal* thing
 * to do in a CAD tool, and coincident-edge handling is precisely where these
 * algorithms go wrong.
 *
 * `polygon-clipping` is MIT, pure JavaScript with no native code, and bundles
 * into the renderer chunk — so nothing about packaging or a fresh install
 * changes because of it.
 *
 * Everything here speaks the project's own flat ring list. Nesting is not
 * carried in or out: `groupRingsIntoRegions` recovers it on both sides, which
 * keeps holes, islands and counter-rings working with no new rules.
 */

export type BooleanOp = 'union' | 'difference' | 'intersection' | 'xor';

type Geometry = clipping.Polygon | clipping.MultiPolygon;
type ClipFunction = (subject: Geometry, ...rest: Geometry[]) => clipping.MultiPolygon;

/**
 * `polygon-clipping` declares named exports in its types but its ESM build
 * publishes only a default, and which of the two a given bundler hands back
 * depends on whether it resolved the `module`, `browser` or `main` field. The
 * namespace import type-checks against the shipped declarations either way;
 * this line is what makes it *run* either way.
 */
const clipper = ((clipping as unknown as { default?: unknown }).default ??
  clipping) as {
  union: ClipFunction;
  difference: ClipFunction;
  intersection: ClipFunction;
  xor: ClipFunction;
};

/**
 * Coordinates are snapped to this grid before clipping, in design units
 * (0.1 mm). Two edges that ought to be coincident rarely are: one has been
 * through a rotation matrix and the other through a scale, and they disagree in
 * the last few bits. Snapping makes them equal, and 1e-4 units is 10 nanometres
 * — four thousand times finer than the 0.5-unit tolerance the curves were
 * flattened at, so nothing visible moves.
 */
const SNAP = 1e-4;

function snap(value: number): number {
  return Math.round(value / SNAP) * SNAP;
}

/**
 * Ring list to the clipper's MultiPolygon.
 *
 * The nesting pass is not optional. `polygon-clipping` reads a polygon as
 * "first ring is the boundary, the rest are its holes", so handing it a flat
 * pile in which a counter-ring happens to come first would invert the shape.
 */
function toMultiPolygon(rings: readonly (readonly Point[])[]): clipping.MultiPolygon {
  const out: clipping.MultiPolygon = [];
  for (const region of groupRingsIntoRegions(rings)) {
    const polygon: clipping.Polygon = [];
    for (const ring of [region.outer, ...region.holes]) {
      const points = ring.map((point): clipping.Pair => [snap(point.x), snap(point.y)]);
      if (points.length < 3) continue;
      // The clipper wants explicitly closed rings; the project stores them open.
      points.push([points[0][0], points[0][1]]);
      polygon.push(points);
    }
    if (polygon.length > 0) out.push(polygon);
  }
  return out;
}

function fromMultiPolygon(result: clipping.MultiPolygon): Point[][] {
  const rings: Point[][] = [];
  for (const polygon of result) {
    for (const ring of polygon) {
      const points = openRing(
        dedupeConsecutivePoints(
          ring.map((pair) => ({ x: pair[0], y: pair[1] })),
          SNAP / 2,
        ),
      );
      if (points.length >= 3) rings.push(points);
    }
  }
  return rings;
}

export interface BooleanResult {
  rings: Point[][];
  /**
   * True when the clipper refused the input and `rings` is the subject,
   * untouched. Callers should report this rather than replacing the user's
   * shapes with the result.
   */
  failed: boolean;
}

/**
 * The operation, with the failure kept visible.
 *
 * `polygon-clipping` throws on a handful of degenerate inputs rather than
 * returning something wrong, which is the behaviour you want — but a design
 * editor cannot let that reach the user as a stack trace, and it must not
 * silently delete their work either. Returning the subject unchanged with
 * `failed: true` lets the UI say "those shapes could not be combined" and leave
 * the document exactly as it was.
 */
export function tryBooleanRings(
  subject: readonly (readonly Point[])[],
  clip: readonly (readonly Point[])[],
  op: BooleanOp,
): BooleanResult {
  const unchanged = (): Point[][] => subject.map((ring) => ring.map((point) => ({ ...point })));

  const subjectGeometry = toMultiPolygon(subject);
  if (subjectGeometry.length === 0) {
    // Nothing to operate on. A union still has to yield the clip side.
    return { rings: op === 'union' || op === 'xor' ? fromMultiPolygon(toMultiPolygon(clip)) : [], failed: false };
  }

  const clipGeometry = toMultiPolygon(clip);
  if (clipGeometry.length === 0) {
    // An empty clip is the identity for union, difference and exclusion, and
    // annihilates an intersection.
    return { rings: op === 'intersection' ? [] : unchanged(), failed: false };
  }

  try {
    const result =
      op === 'union'
        ? clipper.union(subjectGeometry, clipGeometry)
        : op === 'difference'
          ? clipper.difference(subjectGeometry, clipGeometry)
          : op === 'intersection'
            ? clipper.intersection(subjectGeometry, clipGeometry)
            : clipper.xor(subjectGeometry, clipGeometry);
    return { rings: fromMultiPolygon(result), failed: false };
  } catch {
    return { rings: unchanged(), failed: true };
  }
}

/** The operation, with a failure treated as "leave it alone". */
export function booleanRings(
  subject: readonly (readonly Point[])[],
  clip: readonly (readonly Point[])[],
  op: BooleanOp,
): Point[][] {
  return tryBooleanRings(subject, clip, op).rings;
}

/**
 * Merges a part's own overlapping areas into single ones.
 *
 * Icons are drawn the way a person draws: a cloud is three circles and a bar,
 * a bunch of grapes is a pile of discs. Nothing downstream minds an overlap —
 * `groupRingsIntoRegions` returns each blob as its own region and every one of
 * them stitches — but the seam between two of them gets sewn *twice*, in the
 * same thread, and doubled stitching in one place is a ridge you can feel.
 *
 * The bounding-box test first is what keeps this off the critical path: the
 * overwhelming majority of parts are a row of ruler ticks or a scatter of
 * seeds, whose boxes do not touch, and those return without the clipper ever
 * being called. Holes survive because the union runs on regions, not on raw
 * rings — a counter-ring is already nested by then.
 */
export function mergeOverlappingRings(rings: readonly (readonly Point[])[]): Point[][] {
  const copy = (): Point[][] => rings.map((ring) => ring.map((point) => ({ ...point })));
  const regions = groupRingsIntoRegions(rings);
  if (regions.length < 2) return copy();

  const boxes = regions.map((region) => boundingBoxOfPoints(region.outer));
  let touching = false;
  for (let i = 0; i < boxes.length && !touching; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i], boxes[j]];
      if (!a || !b) continue;
      if (a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY) {
        touching = true;
        break;
      }
    }
  }
  if (!touching) return copy();

  const merged = unionAll(regions.map((region) => [region.outer, ...region.holes]));
  return merged.length > 0 ? merged : copy();
}

/** Union of a list of ring lists, one shape at a time. */
export function unionAll(groups: readonly (readonly (readonly Point[])[])[]): Point[][] {
  if (groups.length === 0) return [];
  let accumulated: Point[][] = groups[0].map((ring) => ring.map((point) => ({ ...point })));
  for (let i = 1; i < groups.length; i++) {
    accumulated = booleanRings(accumulated, groups[i], 'union');
  }
  return accumulated;
}

/**
 * Turns a solid shape into a shell of the given wall thickness.
 *
 * The cavity is built per region rather than from the whole ring list at once,
 * because the wall has to follow a region's holes outwards as well as its
 * outline inwards — hollowing a donut leaves two walls, not one. A region too
 * narrow to survive the inset keeps no cavity and stays solid, which is the
 * honest result: there is no shell to cut there.
 *
 * Returns `[]` when nothing could be hollowed at all, so the caller can say the
 * wall is thicker than the shape instead of silently doing nothing.
 */
export function hollowRings(rings: readonly (readonly Point[])[], wall: number): Point[][] {
  const thickness = Math.abs(wall);
  if (thickness < 1e-9) return rings.map((ring) => ring.map((point) => ({ ...point })));

  const cavities: Point[][] = [];
  for (const region of groupRingsIntoRegions(rings)) {
    const inner = offsetPolygonSafe(region.outer, -thickness);
    if (inner.length < 3) continue;
    const grownHoles = region.holes
      .map((hole) => offsetPolygonSafe(hole, thickness))
      .filter((hole) => hole.length >= 3);
    const cavity =
      grownHoles.length > 0 ? booleanRings([inner], grownHoles, 'difference') : [inner];
    for (const ring of cavity) cavities.push(ring);
  }

  if (cavities.length === 0) return [];
  return booleanRings(rings, cavities, 'difference');
}
