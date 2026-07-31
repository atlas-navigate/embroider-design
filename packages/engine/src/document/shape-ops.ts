import type { Point } from '../geometry/point.js';
import { booleanRings, hollowRings, tryBooleanRings, type BooleanOp } from '../geometry/boolean.js';
import { strokeToPolygon } from '../geometry/offset.js';
import { groupRingsIntoRegions, regionToRings } from '../geometry/regions.js';
import { simplifyPolygon } from '../geometry/simplify.js';
import { applyToPoints, IDENTITY } from '../geometry/transform.js';
import type { EmbroideryFont } from '../lettering/font.js';
import { textToRings } from '../lettering/glyph-to-stitch.js';
import { createLayerId, type FontReference, type Layer, type ShapeLayer } from './layer.js';
import { shapeToOpenPaths, shapeToRings, type PathGeometry, type SubPath } from './shapes.js';

/**
 * Cutting, hollowing and welding: how a user makes a shape the app did not
 * ship with.
 *
 * Every operation here follows the same three steps — take each layer's rings
 * *in document space*, combine them, and hand back one new layer whose geometry
 * is the answer and whose transform is the identity. Baking the transform is
 * the important part: two shapes can only be cut against each other where they
 * visibly overlap, and "visibly" means after their transforms, not before.
 *
 * The result is an ordinary path layer. Nothing downstream — the stitch router,
 * the region grouper, the exporters — learns a new concept, and a design that
 * used a boolean opens in a build that has never heard of one.
 */

export interface ShapeOpContext {
  /**
   * Supplies a parsed font for a text layer, the same way `CompileContext`
   * does. Without one a text layer has no outlines and cannot take part.
   */
  resolveFont?(reference: FontReference): EmbroideryFont | null;
}

/**
 * Removes vertices that sit on a straight run.
 *
 * A boolean leaves a point wherever an edge was cut, including where nothing
 * turned. At 0.05 units — five micrometres, a tenth of the tolerance the curves
 * were flattened at — this cannot move an outline anywhere a machine could
 * express, and it keeps a saved custom shape from carrying hundreds of vertices
 * that say nothing.
 */
const CLEANUP_TOLERANCE = 0.05;

function tidy(rings: readonly Point[][]): Point[][] {
  const out: Point[][] = [];
  for (const ring of rings) {
    const simplified = simplifyPolygon(ring, CLEANUP_TOLERANCE);
    if (simplified.length >= 3) out.push(simplified);
  }
  return out;
}

/**
 * A layer's closed contours in document space.
 *
 * `null` means the layer cannot take part in a shape operation at all, which
 * is a different answer from "took part and enclosed nothing" — the caller
 * needs to tell a stitch layer apart from an empty one.
 */
export function layerRings(layer: Layer, context: ShapeOpContext = {}): Point[][] | null {
  switch (layer.kind) {
    case 'shape':
      return shapeToRings(layer.geometry).map((ring) => applyToPoints(layer.transform, ring));
    case 'image': {
      const rings: Point[][] = [];
      for (const region of layer.regions) {
        for (const ring of regionToRings(region)) rings.push(applyToPoints(layer.transform, ring));
      }
      return rings;
    }
    case 'text': {
      const font = context.resolveFont?.(layer.font) ?? null;
      if (!font) return null;
      const { rings } = textToRings(font, layer.text, {
        size: layer.size,
        letterSpacing: layer.letterSpacing,
        wordSpacing: layer.wordSpacing,
        lineHeight: layer.lineHeight,
        align: layer.align,
        kerning: layer.kerning,
        maxWidth: layer.maxWidth,
        shape: layer.shape,
      });
      // Text is laid out relative to its own origin, then transformed — the
      // same two steps `compileTextLayer` takes.
      return rings.map((ring) =>
        applyToPoints(
          layer.transform,
          ring.map((point) => ({ x: point.x + layer.origin.x, y: point.y + layer.origin.y })),
        ),
      );
    }
    case 'stitch':
      // Stitches are not an outline. There is no boundary to cut against, and
      // guessing one from the stitch path would be fiction.
      return null;
  }
}

/** True when the layer has an outline a shape operation can use. */
export function canCombine(layer: Layer, context: ShapeOpContext = {}): boolean {
  const rings = layerRings(layer, context);
  return rings !== null && rings.length > 0;
}

export function ringsToPath(rings: readonly (readonly Point[])[]): PathGeometry {
  const subpaths: SubPath[] = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    subpaths.push({
      start: { ...ring[0] },
      segments: ring.slice(1).map((point) => ({ type: 'line' as const, to: { ...point } })),
      closed: true,
    });
  }
  return { type: 'path', subpaths };
}

/**
 * A result layer built on the bottom-most contributor.
 *
 * Inheriting the bottom layer's thread and stitch settings rather than the
 * top's matches what the operation means: the shape that survives a subtraction
 * *is* the bottom one, with pieces taken out of it, so it should still sew the
 * way it did.
 */
function resultLayer(base: Layer, rings: readonly Point[][], name: string): ShapeLayer | null {
  if (rings.length === 0) return null;
  return {
    id: createLayerId('shape'),
    name,
    kind: 'shape',
    visible: true,
    locked: false,
    thread: { ...base.thread },
    stitchType: base.stitchType,
    settings: structuredClone(base.settings),
    transform: { ...IDENTITY },
    geometry: ringsToPath(rings),
  };
}

const OP_NAMES: Record<BooleanOp, string> = {
  union: 'Welded',
  difference: 'Cut',
  intersection: 'Overlap',
  xor: 'Excluded',
};

export interface CombineResult {
  layer: ShapeLayer | null;
  /** Layers that had no usable outline and were left out. */
  skipped: Layer[];
  /** Set when the clipper refused the geometry and nothing should be replaced. */
  failed: boolean;
  /** Plain-language reason when `layer` is null. */
  message?: string;
}

/**
 * Combines layers, bottom-most first.
 *
 * The order is the stack order, and for a subtraction that is what decides
 * which shape survives: the bottom layer is the subject and everything above it
 * is cut away from it. That is "minus front", the convention every drawing
 * program uses, and it matches what the canvas shows — you cut with the thing
 * lying on top.
 */
export function combineLayers(
  layers: readonly Layer[],
  op: BooleanOp,
  context: ShapeOpContext = {},
): CombineResult {
  const usable: { layer: Layer; rings: Point[][] }[] = [];
  const skipped: Layer[] = [];
  for (const layer of layers) {
    const rings = layerRings(layer, context);
    if (!rings || rings.length === 0) skipped.push(layer);
    else usable.push({ layer, rings });
  }

  if (usable.length < 2) {
    return {
      layer: null,
      skipped,
      failed: false,
      message: 'Select at least two shapes with an outline to combine.',
    };
  }

  let accumulated = usable[0].rings;
  for (let i = 1; i < usable.length; i++) {
    const attempt = tryBooleanRings(accumulated, usable[i].rings, op);
    if (attempt.failed) {
      return {
        layer: null,
        skipped,
        failed: true,
        message: 'Those shapes could not be combined — try moving one slightly and repeating.',
      };
    }
    accumulated = attempt.rings;
  }

  const rings = tidy(accumulated);
  const layer = resultLayer(
    usable[0].layer,
    rings,
    `${OP_NAMES[op]} ${usable.length} shapes`,
  );
  return {
    layer,
    skipped,
    failed: false,
    message: layer ? undefined : 'That combination left nothing behind.',
  };
}

export interface HollowResult {
  layer: ShapeLayer | null;
  message?: string;
}

/** Turns a solid layer into a shell of the given wall thickness. */
export function hollowLayer(
  layer: Layer,
  wall: number,
  context: ShapeOpContext = {},
): HollowResult {
  const rings = layerRings(layer, context);
  if (!rings || rings.length === 0) {
    return { layer: null, message: 'That layer has no outline to hollow.' };
  }
  const hollowed = tidy(hollowRings(rings, wall));
  if (hollowed.length === 0) {
    return { layer: null, message: 'The wall is thicker than the shape — try a thinner wall.' };
  }
  return { layer: resultLayer(layer, hollowed, `${layer.name} outline`) };
}

/**
 * Cuts a layer along a drawn line.
 *
 * The knife is a stroke, not a zero-width cut, because a real one has to be:
 * two pieces sharing an edge would be sewn as one region again the moment they
 * were welded back together, and on fabric they would overlap. The gap is the
 * kerf, and at a fraction of a millimetre it is invisible in thread.
 */
export function sliceLayer(
  layer: Layer,
  knife: readonly Point[],
  kerf: number,
  context: ShapeOpContext = {},
): ShapeLayer[] {
  const rings = layerRings(layer, context);
  if (!rings || rings.length === 0 || knife.length < 2) return [];

  const blade = strokeToPolygon(knife, Math.max(kerf, 1e-3));
  if (blade.length < 3) return [];

  const cut = tidy(booleanRings(rings, [blade], 'difference'));
  const pieces = groupRingsIntoRegions(cut);
  if (pieces.length < 2) return [];

  return pieces
    .map((piece, index) => resultLayer(layer, regionToRings(piece), `${layer.name} ${index + 1}`))
    .filter((piece): piece is ShapeLayer => piece !== null);
}

/**
 * Freezes a text layer into its outlines.
 *
 * Wanted for its own sake — a monogram nobody can retype by accident — and
 * needed before text can be cut, since a boolean has to store its result as
 * geometry and there is no way to write "the letter A minus a circle" back into
 * a string of characters.
 */
export function outlineLayer(layer: Layer, context: ShapeOpContext = {}): ShapeLayer | null {
  const rings = layerRings(layer, context);
  if (!rings || rings.length === 0) return null;
  return resultLayer(layer, tidy(rings), layer.kind === 'text' ? layer.text.trim() || layer.name : layer.name);
}

/** Everything a layer draws, open runs included — for measuring a saved shape. */
export function layerOutlineRings(layer: Layer, context: ShapeOpContext = {}): Point[][] {
  const rings = layerRings(layer, context) ?? [];
  if (layer.kind !== 'shape') return rings;
  return [
    ...rings,
    ...shapeToOpenPaths(layer.geometry).map((path) => applyToPoints(layer.transform, path)),
  ];
}
