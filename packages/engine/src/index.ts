/**
 * `@embroider-design/engine` — the pure-TypeScript embroidery core.
 *
 * No Electron, no React, no native modules: everything here runs the same in
 * Node, in a browser, and under Vitest, which is what makes the stitch maths
 * and the file writers independently testable.
 *
 * Geometry is namespaced because its names (`add`, `scale`, `distance`,
 * `length`) are far too generic to sit in a package's top-level scope.
 */
export * as geometry from './geometry/index.js';

export type { Point } from './geometry/point.js';
export type { BoundingBox, Polygon, Polyline } from './geometry/path.js';
export type { AffineMatrix } from './geometry/transform.js';
export type { RingRegion } from './geometry/regions.js';

/**
 * The geometry an application unavoidably needs.
 *
 * A caller cannot place, move or measure a layer without these — every
 * `Layer.transform` is built from them — so making people reach through
 * `geometry.` for the whole document API would be pedantry. The rest of the
 * namespace stays behind `geometry.`, where names like `add`, `scale` and
 * `length` cannot collide with anything.
 */
export {
  IDENTITY,
  applyToPoint,
  applyToPoints,
  compose,
  identity,
  invert,
  isIdentity,
  rotateAround,
  rotation,
  scaleAround,
  scaling,
  translation,
} from './geometry/transform.js';
export {
  boundingBoxCenter,
  boundingBoxHeight,
  boundingBoxOfMany,
  boundingBoxOfPoints,
  boundingBoxUnion,
  boundingBoxWidth,
  distanceToPolyline,
  pointInPolygon,
  pointInPolygonWithHoles,
  polygonArea,
  polylineLength,
} from './geometry/path.js';
export { groupRingsIntoRegions, regionToRings } from './geometry/regions.js';
/**
 * Boolean operations, at the top level for the same reason as the transforms:
 * cutting and hollowing are things the *user* does, so the editor reaches for
 * them constantly and should not have to go through `geometry.` to find them.
 */
export {
  booleanRings,
  hollowRings,
  tryBooleanRings,
  unionAll,
  type BooleanOp,
  type BooleanResult,
} from './geometry/boolean.js';

export * from './pattern/index.js';
export * from './formats/index.js';
export * from './stitchgen/index.js';
export * from './lettering/index.js';
export * from './autodigitize/index.js';
export * from './document/index.js';
export * from './library/index.js';
