import type { Point } from './point.js';
import {
  boundingBoxOfPoints,
  dedupeConsecutivePoints,
  openRing,
  pointInPolygon,
  polygonArea,
} from './path.js';
import { horizontalCrossings } from './scanline.js';

/**
 * Sorting a flat pile of rings into filled areas and the holes inside them.
 *
 * Both sources of geometry produce rings without saying which is which: font
 * outlines give the counter of an "O" as just another contour, and contour
 * tracing gives every boundary it finds. Nesting has to be recovered before
 * anything can be filled, or the counter gets stitched solid.
 */

export interface RingRegion {
  outer: Point[];
  holes: Point[][];
}

/**
 * A point guaranteed to be strictly inside the ring.
 *
 * The centroid is not good enough — on a crescent or a "C" it falls outside
 * the shape, and every containment test built on it then gets the nesting
 * backwards. Taking the midpoint of a scanline span is always interior.
 */
export function representativeInteriorPoint(ring: readonly Point[]): Point | null {
  const box = boundingBoxOfPoints(ring);
  if (!box) return null;
  const crossings: number[] = [];
  // Sample a few heights: one scanline can graze a vertex and find nothing.
  for (const fraction of [0.5, 0.33, 0.67, 0.25, 0.75, 0.1, 0.9]) {
    const y = box.minY + (box.maxY - box.minY) * fraction;
    horizontalCrossings([ring], y, crossings);
    if (crossings.length >= 2 && crossings[1] - crossings[0] > 1e-9) {
      return { x: (crossings[0] + crossings[1]) / 2, y };
    }
  }
  return null;
}

interface AnalysedRing {
  points: Point[];
  area: number;
  interior: Point | null;
  depth: number;
}

/**
 * Groups rings by containment. Rings at even nesting depth are filled areas;
 * odd depth are holes, assigned to the smallest area that contains them.
 * Depth 2 starts a new filled area again — the dot inside a counter, say.
 */
export function groupRingsIntoRegions(rings: readonly (readonly Point[])[]): RingRegion[] {
  const analysed: AnalysedRing[] = [];
  for (const ring of rings) {
    const points = openRing(dedupeConsecutivePoints(ring, 1e-9));
    if (points.length < 3) continue;
    analysed.push({
      points,
      area: polygonArea(points),
      interior: representativeInteriorPoint(points),
      depth: 0,
    });
  }
  if (analysed.length === 0) return [];

  for (const ring of analysed) {
    if (!ring.interior) continue;
    for (const other of analysed) {
      if (other === ring) continue;
      if (other.area <= ring.area) continue;
      if (pointInPolygon(ring.interior, other.points)) ring.depth++;
    }
  }

  const regions: RingRegion[] = [];
  const regionByRing = new Map<AnalysedRing, RingRegion>();
  for (const ring of analysed) {
    if (ring.depth % 2 !== 0) continue;
    const region: RingRegion = { outer: ring.points, holes: [] };
    regions.push(region);
    regionByRing.set(ring, region);
  }

  for (const hole of analysed) {
    if (hole.depth % 2 === 0 || !hole.interior) continue;
    let best: AnalysedRing | null = null;
    for (const candidate of analysed) {
      if (candidate.depth !== hole.depth - 1) continue;
      if (!pointInPolygon(hole.interior, candidate.points)) continue;
      if (!best || candidate.area < best.area) best = candidate;
    }
    const region = best ? regionByRing.get(best) : undefined;
    if (region) region.holes.push(hole.points);
  }

  // Largest first: callers stitch big shapes before the detail on top of them.
  regions.sort((a, b) => polygonArea(b.outer) - polygonArea(a.outer));
  return regions;
}

/** Flattens a region back into the ring list the fill and router functions take. */
export function regionToRings(region: RingRegion): Point[][] {
  return [region.outer, ...region.holes];
}
