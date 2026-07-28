import simplify from 'simplify-js';
import { distance, type Point } from './point.js';
import { dedupeConsecutivePoints, openRing, polygonCentroid } from './path.js';

/**
 * Polyline/polygon simplification (Ramer-Douglas-Peucker, via `simplify-js`).
 *
 * Traced contours from the auto-digitizer arrive with one vertex per pixel
 * step. Simplifying before stitch generation is what keeps stitch counts sane
 * and stops the machine chattering along a staircase edge.
 */

/**
 * Simplifies an open path. `tolerance` is a world-space distance: no retained
 * point deviates from the original path by more than roughly this much.
 */
export function simplifyPolyline(
  points: readonly Point[],
  tolerance: number,
  highQuality = true,
): Point[] {
  if (points.length <= 2 || tolerance <= 0) return points.map((p) => ({ x: p.x, y: p.y }));
  const input = points.map((p) => ({ x: p.x, y: p.y }));
  const result = simplify(input, tolerance, highQuality);
  return result.length >= 2 ? result : input;
}

/**
 * Simplifies a closed ring.
 *
 * RDP anchors the first and last points, which on a ring would pin an
 * arbitrary vertex and leave the closing edge unconsidered. Rotating the ring
 * to start at the vertex farthest from the centroid (guaranteed to survive
 * simplification anyway) and explicitly closing it before the pass removes
 * both artefacts.
 */
export function simplifyPolygon(
  points: readonly Point[],
  tolerance: number,
  highQuality = true,
): Point[] {
  const ring = openRing(dedupeConsecutivePoints(points, 1e-9));
  if (ring.length <= 3 || tolerance <= 0) return ring;

  const center = polygonCentroid(ring);
  let anchor = 0;
  let best = -1;
  for (let i = 0; i < ring.length; i++) {
    const d = distance(ring[i], center);
    if (d > best) {
      best = d;
      anchor = i;
    }
  }

  const rotated: Point[] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[(anchor + i) % ring.length];
    rotated.push({ x: p.x, y: p.y });
  }
  rotated.push({ x: rotated[0].x, y: rotated[0].y });

  const result = simplify(rotated, tolerance, highQuality);
  const reopened = openRing(result);
  // Never let simplification destroy a region outright.
  return reopened.length >= 3 ? reopened : ring;
}

/**
 * Drops vertices closer together than `minSpacing` while always keeping the
 * endpoints. Cheaper than RDP and useful as a pre-pass on pixel-traced data.
 */
export function decimateByDistance(points: readonly Point[], minSpacing: number): Point[] {
  if (points.length <= 2 || minSpacing <= 0) return points.map((p) => ({ x: p.x, y: p.y }));
  const out: Point[] = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i < points.length - 1; i++) {
    if (distance(out[out.length - 1], points[i]) >= minSpacing) {
      out.push({ x: points[i].x, y: points[i].y });
    }
  }
  const last = points[points.length - 1];
  out.push({ x: last.x, y: last.y });
  return out;
}

/**
 * Chaikin corner cutting. One or two passes turn a staircase-y traced contour
 * into something a satin column can follow without visible facets.
 */
export function smoothPolyline(points: readonly Point[], iterations = 1, closed = false): Point[] {
  let current = points.map((p) => ({ x: p.x, y: p.y }));
  for (let pass = 0; pass < iterations; pass++) {
    if (current.length < 3) break;
    const next: Point[] = [];
    if (!closed) next.push({ x: current[0].x, y: current[0].y });
    const segmentCount = closed ? current.length : current.length - 1;
    for (let i = 0; i < segmentCount; i++) {
      const a = current[i];
      const b = current[(i + 1) % current.length];
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      next.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    if (!closed) next.push({ x: current[current.length - 1].x, y: current[current.length - 1].y });
    current = next;
  }
  return current;
}
