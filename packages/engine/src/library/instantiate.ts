import { boundingBoxOfMany, type BoundingBox } from '../geometry/path.js';
import { compose, scaling, translation, type AffineMatrix } from '../geometry/transform.js';
import { threadFromHex, type ThreadColor } from '../pattern/thread.js';
import { createLayerId, createShapeLayer, type ShapeLayer } from '../document/layer.js';
import { shapeToOpenPaths, shapeToRings } from '../document/shapes.js';
import { pathFromData } from './path-data.js';
import type { LibraryShape } from './types.js';

/**
 * Turning a catalogue entry into layers.
 *
 * The shape's own coordinates are never rewritten — the placement lives in each
 * layer's `transform`, exactly as it does for a rectangle dragged onto the
 * canvas. That keeps the geometry parametric, so scaling the placed shape later
 * composes with this transform instead of accumulating rounding through the
 * path data.
 */

/** Where a shape is being dropped, in design units (0.1 mm). */
export interface PlacementBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const boundsCache = new Map<string, BoundingBox | null>();

/**
 * The shape's true extent in authoring space.
 *
 * Measured from the flattened outlines rather than declared in the data,
 * because a declared aspect ratio is one more thing that can quietly disagree
 * with the artwork. Cached by id: the catalogue is immutable at runtime.
 */
export function libraryShapeBounds(shape: LibraryShape): BoundingBox | null {
  const cached = boundsCache.get(shape.id);
  if (cached !== undefined) return cached;
  const outlines = shape.parts.flatMap((part) => {
    const geometry = pathFromData(part.d);
    return [...shapeToRings(geometry), ...shapeToOpenPaths(geometry)];
  });
  const bounds = boundingBoxOfMany(outlines);
  boundsCache.set(shape.id, bounds);
  return bounds;
}

export function libraryShapeAspect(shape: LibraryShape): number {
  const bounds = libraryShapeBounds(shape);
  if (!bounds) return 1;
  const height = bounds.maxY - bounds.minY;
  return height > 1e-9 ? (bounds.maxX - bounds.minX) / height : 1;
}

/**
 * Fits the shape inside the box without distorting it.
 *
 * Uniform scaling is not a stylistic preference here: squashing one axis turns
 * a satin column's constant width into a varying one, and the stitch router
 * would start making different decisions along the same stroke.
 */
export function placementTransform(shape: LibraryShape, box: PlacementBox): AffineMatrix {
  const bounds = libraryShapeBounds(shape);
  if (!bounds) return compose(translation(box.x, box.y));
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width < 1e-9 || height < 1e-9) return compose(translation(box.x, box.y));

  const scale = Math.min(box.width / width, box.height / height);
  const offsetX = box.x + (box.width - width * scale) / 2;
  const offsetY = box.y + (box.height - height * scale) / 2;
  return compose(
    translation(-bounds.minX, -bounds.minY),
    scaling(scale),
    translation(offsetX, offsetY),
  );
}

export interface InstantiateOptions {
  /** Index the default palette starts from, so a second shape is not the same colour. */
  index?: number;
  /** Forces every part onto one thread — useful for a single-colour design. */
  thread?: ThreadColor;
  /** Overrides the group id, so an undo can put the same one back. */
  groupId?: string;
}

/**
 * One layer per part, sharing a transform and a group.
 *
 * Multi-part shapes are grouped because they only make sense together: a
 * snowman's hat has no meaning two inches from the snowman. Single-part shapes
 * get no group — a lone rectangle in a group of one is just noise in the layer
 * list.
 */
export function instantiateShape(
  shape: LibraryShape,
  box: PlacementBox,
  options: InstantiateOptions = {},
): ShapeLayer[] {
  const transform = placementTransform(shape, box);
  const groupId =
    shape.parts.length > 1 ? (options.groupId ?? createLayerId('group')) : undefined;
  const baseIndex = options.index ?? 0;

  return shape.parts.map((part, i) => {
    const layer = createShapeLayer(pathFromData(part.d), {
      name: shape.parts.length > 1 ? `${shape.name} — ${part.name}` : shape.name,
      index: baseIndex + i,
      thread: options.thread ?? (part.color ? threadFromHex(part.color, part.name) : undefined),
      stitchType: part.stitchType,
    });
    return { ...layer, transform, ...(groupId ? { groupId } : {}) };
  });
}
