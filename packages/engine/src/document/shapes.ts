import { flattenArc, flattenCubic, flattenQuadratic } from '../geometry/bezier.js';
import { boundingBoxOfMany, type BoundingBox } from '../geometry/path.js';
import type { Point } from '../geometry/point.js';

/**
 * The drawable primitives.
 *
 * Shapes stay parametric — a rectangle knows it is a rectangle — so the
 * properties panel can offer "corner radius" and the user can still edit the
 * width after the fact. Flattening to points happens at compile time and
 * nowhere else.
 */

export interface RectangleGeometry {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius?: number;
}

export interface EllipseGeometry {
  type: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** A regular polygon, or a star when `innerRadius` is set. */
export interface PolygonGeometry {
  type: 'polygon';
  cx: number;
  cy: number;
  radius: number;
  sides: number;
  innerRadius?: number;
  /** Rotation in radians. 0 puts the first point straight up. */
  rotation?: number;
}

export interface PolylineGeometry {
  type: 'polyline';
  points: Point[];
  closed: boolean;
}

export type PathSegment =
  | { type: 'line'; to: Point }
  | { type: 'quadratic'; control: Point; to: Point }
  | { type: 'cubic'; control1: Point; control2: Point; to: Point };

export interface SubPath {
  start: Point;
  segments: PathSegment[];
  closed: boolean;
}

export interface PathGeometry {
  type: 'path';
  subpaths: SubPath[];
}

export type ShapeGeometry =
  | RectangleGeometry
  | EllipseGeometry
  | PolygonGeometry
  | PolylineGeometry
  | PathGeometry;

export const DEFAULT_FLATTEN_TOLERANCE = 0.5;

function roundedRectangle(rect: RectangleGeometry, tolerance: number): Point[] {
  const maxRadius = Math.min(rect.width, rect.height) / 2;
  const r = Math.max(0, Math.min(rect.cornerRadius ?? 0, maxRadius));
  const { x, y, width, height } = rect;
  if (r <= 0) {
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }

  const points: Point[] = [{ x: x + r, y }];
  const corner = (cx: number, cy: number, from: number, to: number): void => {
    for (const p of flattenArc({ x: cx, y: cy }, r, r, from, to, tolerance)) points.push(p);
  };
  points.push({ x: x + width - r, y });
  corner(x + width - r, y + r, -Math.PI / 2, 0);
  points.push({ x: x + width, y: y + height - r });
  corner(x + width - r, y + height - r, 0, Math.PI / 2);
  points.push({ x: x + r, y: y + height });
  corner(x + r, y + height - r, Math.PI / 2, Math.PI);
  points.push({ x, y: y + r });
  corner(x + r, y + r, Math.PI, Math.PI * 1.5);
  // The last corner lands back on the first point; rings are stored open.
  points.pop();
  return points;
}

function ellipsePoints(ellipse: EllipseGeometry, tolerance: number): Point[] {
  const points: Point[] = [{ x: ellipse.cx + ellipse.rx, y: ellipse.cy }];
  for (const p of flattenArc(
    { x: ellipse.cx, y: ellipse.cy },
    ellipse.rx,
    ellipse.ry,
    0,
    Math.PI * 2,
    tolerance,
  )) {
    points.push(p);
  }
  // The arc closes on its own start point; drop the duplicate.
  points.pop();
  return points;
}

function polygonPoints(polygon: PolygonGeometry): Point[] {
  const sides = Math.max(3, Math.round(polygon.sides));
  const rotation = polygon.rotation ?? 0;
  const inner = polygon.innerRadius;
  const isStar = inner !== undefined && inner > 0 && inner < polygon.radius;
  const count = isStar ? sides * 2 : sides;
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    // Start at the top: -90 degrees in a Y-down frame.
    const angle = rotation - Math.PI / 2 + (i / count) * Math.PI * 2;
    const radius = isStar && i % 2 === 1 ? inner : polygon.radius;
    points.push({
      x: polygon.cx + Math.cos(angle) * radius,
      y: polygon.cy + Math.sin(angle) * radius,
    });
  }
  return points;
}

function subPathPoints(subpath: SubPath, tolerance: number): Point[] {
  const points: Point[] = [{ ...subpath.start }];
  let cursor = subpath.start;
  for (const segment of subpath.segments) {
    switch (segment.type) {
      case 'line':
        points.push({ ...segment.to });
        break;
      case 'quadratic':
        for (const p of flattenQuadratic(cursor, segment.control, segment.to, tolerance)) {
          points.push(p);
        }
        break;
      case 'cubic':
        for (const p of flattenCubic(
          cursor,
          segment.control1,
          segment.control2,
          segment.to,
          tolerance,
        )) {
          points.push(p);
        }
        break;
    }
    cursor = segment.to;
  }
  return points;
}

export function isClosedShape(shape: ShapeGeometry): boolean {
  switch (shape.type) {
    case 'polyline':
      return shape.closed;
    case 'path':
      return shape.subpaths.some((subpath) => subpath.closed);
    default:
      return true;
  }
}

/** Closed contours, ready for `groupRingsIntoRegions`. */
export function shapeToRings(
  shape: ShapeGeometry,
  tolerance = DEFAULT_FLATTEN_TOLERANCE,
): Point[][] {
  switch (shape.type) {
    case 'rectangle':
      return [roundedRectangle(shape, tolerance)];
    case 'ellipse':
      return [ellipsePoints(shape, tolerance)];
    case 'polygon':
      return [polygonPoints(shape)];
    case 'polyline':
      return shape.closed && shape.points.length >= 3 ? [shape.points.map((p) => ({ ...p }))] : [];
    case 'path':
      return shape.subpaths
        .filter((subpath) => subpath.closed)
        .map((subpath) => subPathPoints(subpath, tolerance))
        .filter((ring) => ring.length >= 3);
  }
}

/** Open runs, for the line and freehand tools. */
export function shapeToOpenPaths(
  shape: ShapeGeometry,
  tolerance = DEFAULT_FLATTEN_TOLERANCE,
): Point[][] {
  switch (shape.type) {
    case 'polyline':
      return shape.closed || shape.points.length < 2 ? [] : [shape.points.map((p) => ({ ...p }))];
    case 'path':
      return shape.subpaths
        .filter((subpath) => !subpath.closed)
        .map((subpath) => subPathPoints(subpath, tolerance))
        .filter((path) => path.length >= 2);
    default:
      return [];
  }
}

export function shapeBounds(
  shape: ShapeGeometry,
  tolerance = DEFAULT_FLATTEN_TOLERANCE,
): BoundingBox | null {
  return boundingBoxOfMany([
    ...shapeToRings(shape, tolerance),
    ...shapeToOpenPaths(shape, tolerance),
  ]);
}

export function rectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius = 0,
): RectangleGeometry {
  return { type: 'rectangle', x, y, width, height, cornerRadius };
}

export function ellipse(cx: number, cy: number, rx: number, ry = rx): EllipseGeometry {
  return { type: 'ellipse', cx, cy, rx, ry };
}

export function regularPolygon(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
): PolygonGeometry {
  return { type: 'polygon', cx, cy, radius, sides };
}

export function star(
  cx: number,
  cy: number,
  radius: number,
  innerRadius: number,
  points: number,
): PolygonGeometry {
  return { type: 'polygon', cx, cy, radius, sides: points, innerRadius };
}

export function polyline(points: readonly Point[], closed = false): PolylineGeometry {
  return { type: 'polyline', points: points.map((p) => ({ ...p })), closed };
}
