import type { Point } from '../geometry/point.js';
import { polygonArea } from '../geometry/path.js';
import { simplifyPolygon } from '../geometry/simplify.js';
import type { Mask } from './mask-ops.js';

/**
 * Contour tracing: a binary mask in, closed rings out.
 *
 * This walks the boundary between filled and empty cells rather than sampling
 * a field, so every ring it produces is exactly the pixel boundary — closed,
 * non-self-intersecting, and immediately usable by `groupRingsIntoRegions`
 * and the stitch generators. A general-purpose SVG tracer would hand back
 * smoothed curves in its own path format that would have to be converted back
 * into rings before anything here could use them.
 */

export interface TraceOptions {
  /** World units per pixel. */
  scale?: number;
  originX?: number;
  originY?: number;
  /**
   * Simplification tolerance in world units. Traced boundaries are
   * staircases; left alone they would put a vertex every pixel. Defaults to
   * one pixel, which flattens the staircase without rounding real corners.
   */
  simplifyTolerance?: number;
  /** Rings enclosing less than this area (world units squared) are dropped. */
  minArea?: number;
}

/** Step directions, indexed 0..3: +x, +y, -x, -y. */
const STEP_X = [1, 0, -1, 0];
const STEP_Y = [0, 1, 0, -1];

/**
 * Traces every boundary of a mask.
 *
 * Each filled cell contributes its exposed edges, oriented so the fill is
 * consistently on one side; chaining them end to end yields closed loops —
 * outer boundaries one way round, holes the other. Nesting is not resolved
 * here: pass the result to `groupRingsIntoRegions`.
 *
 * Where two filled cells touch only at a corner, the walk prefers the turn
 * that keeps them in one loop, matching the 8-connectivity that
 * `labelComponents` uses. Otherwise a diagonal chain would be one component
 * by one measure and several shapes by the other.
 */
export function traceMaskRings(mask: Mask, options: TraceOptions = {}): Point[][] {
  const scale = options.scale ?? 1;
  const originX = options.originX ?? 0;
  const originY = options.originY ?? 0;
  const tolerance = options.simplifyTolerance ?? scale;
  const minArea = options.minArea ?? 0;

  const { width, height } = mask;
  const latticeWidth = width + 1;
  const vertexCount = latticeWidth * (height + 1);
  const hasEdge = new Uint8Array(vertexCount * 4);
  const used = new Uint8Array(vertexCount * 4);

  const filled = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && mask.data[y * width + x] === 1;
  const vertex = (x: number, y: number): number => y * latticeWidth + x;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!filled(x, y)) continue;
      // Clockwise around the cell in screen coordinates, so the fill is always
      // on the same side of every edge and the loops chain up consistently.
      if (!filled(x, y - 1)) hasEdge[vertex(x, y) * 4 + 0] = 1;
      if (!filled(x + 1, y)) hasEdge[vertex(x + 1, y) * 4 + 1] = 1;
      if (!filled(x, y + 1)) hasEdge[vertex(x + 1, y + 1) * 4 + 2] = 1;
      if (!filled(x - 1, y)) hasEdge[vertex(x, y + 1) * 4 + 3] = 1;
    }
  }

  const rings: Point[][] = [];
  for (let start = 0; start < vertexCount; start++) {
    for (let startDir = 0; startDir < 4; startDir++) {
      if (hasEdge[start * 4 + startDir] === 0 || used[start * 4 + startDir] === 1) continue;

      const ring: Point[] = [];
      let current = start;
      let direction = startDir;
      for (;;) {
        if (used[current * 4 + direction] === 1) break;
        used[current * 4 + direction] = 1;

        const y = Math.floor(current / latticeWidth);
        const x = current - y * latticeWidth;
        ring.push({ x: originX + x * scale, y: originY + y * scale });

        const next = vertex(x + STEP_X[direction], y + STEP_Y[direction]);
        // Turn preference: the first option keeps corner-touching cells in a
        // single loop; the rest fall back through straight, right, reverse.
        let chosen = -1;
        for (const offset of [3, 0, 1, 2]) {
          const candidate = (direction + offset) % 4;
          if (hasEdge[next * 4 + candidate] === 1 && used[next * 4 + candidate] === 0) {
            chosen = candidate;
            break;
          }
        }
        if (chosen < 0) break;
        current = next;
        direction = chosen;
      }

      if (ring.length < 4) continue;
      const simplified = tolerance > 0 ? simplifyPolygon(ring, tolerance) : ring;
      if (simplified.length < 3) continue;
      if (minArea > 0 && polygonArea(simplified) < minArea) continue;
      rings.push(simplified);
    }
  }
  return rings;
}
