import {
  applyToPoints,
  boundingBoxOfMany,
  compose,
  distanceToPolyline,
  frameAngleOf,
  pointInPolygon,
  regionToRings,
  selectionFrame,
  shapeToOpenPaths,
  shapeToRings,
  textToRings,
  translation,
  type BoundingBox,
  type EmbroideryFont,
  type Layer,
  type Point,
  type SelectionFrame,
  type TextLayer,
} from '@embroider-design/engine';

/**
 * Turning layers into screen geometry.
 *
 * Both the canvas renderer and hit testing need the same answer to "where is
 * this layer, really", so it is derived once here rather than twice with
 * slightly different rounding.
 */

export interface LayerOutline {
  /** Closed contours in document space, layer transform applied. */
  rings: Point[][];
  /** Open paths in document space. */
  paths: Point[][];
}

const EMPTY: LayerOutline = { rings: [], paths: [] };

/**
 * Text outlines, straight from the font.
 *
 * Drawing text from `textToRings` rather than from its compiled stitches means
 * the canvas updates as fast as you type, and it is the same geometry the
 * digitizer will work from — just not yet stitched.
 */
export function textOutline(layer: TextLayer, font: EmbroideryFont | null): LayerOutline {
  if (!font || layer.text.trim().length === 0) return EMPTY;
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
  const matrix = compose(translation(layer.origin.x, layer.origin.y), layer.transform);
  return { rings: rings.map((ring) => applyToPoints(matrix, ring)), paths: [] };
}

export function layerOutline(layer: Layer, font: EmbroideryFont | null = null): LayerOutline {
  switch (layer.kind) {
    case 'shape':
      return {
        rings: shapeToRings(layer.geometry).map((ring) => applyToPoints(layer.transform, ring)),
        paths: shapeToOpenPaths(layer.geometry).map((path) =>
          applyToPoints(layer.transform, path),
        ),
      };
    case 'image': {
      const rings: Point[][] = [];
      for (const region of layer.regions) {
        for (const ring of regionToRings(region)) rings.push(applyToPoints(layer.transform, ring));
      }
      return { rings, paths: [] };
    }
    case 'stitch': {
      // A stitch layer has no outline; its own points are the best stand-in.
      const points = applyToPoints(
        layer.transform,
        layer.stitches.map((stitch) => ({ x: stitch.x, y: stitch.y })),
      );
      return { rings: [], paths: points.length >= 2 ? [points] : [] };
    }
    case 'text':
      return textOutline(layer, font);
  }
}

/**
 * Outlines, cached on the layer object itself.
 *
 * Layers are replaced rather than mutated on every edit — the store spreads
 * into a new object — so object identity is a sound cache key, and a `WeakMap`
 * needs no eviction because a superseded layer becomes unreachable.
 *
 * Without this, measuring the selection frame re-extracts every selected text
 * layer's glyph outlines from the font, and the frame is measured on every
 * pointer move (to pick the hover cursor) as well as on every repaint. Typing
 * into a long text layer and then moving the mouse was re-running `textToRings`
 * hundreds of times a second for geometry that had not changed.
 */
const outlineCache = new WeakMap<Layer, { font: EmbroideryFont | null; outline: LayerOutline }>();

export function cachedLayerOutline(
  layer: Layer,
  font: EmbroideryFont | null = null,
): LayerOutline {
  const hit = outlineCache.get(layer);
  // Only text depends on the font, but comparing it for every kind is cheaper
  // than branching on kind and getting the text case wrong later.
  if (hit && hit.font === font) return hit.outline;
  const outline = layerOutline(layer, font);
  outlineCache.set(layer, { font, outline });
  return outline;
}

export function outlineBounds(outline: LayerOutline): BoundingBox | null {
  return boundingBoxOfMany([...outline.rings, ...outline.paths]);
}

/** True when a document-space point is on or inside the layer. */
export function hitTestOutline(
  outline: LayerOutline,
  point: Point,
  tolerance: number,
): boolean {
  for (const ring of outline.rings) {
    if (pointInPolygon(point, ring)) return true;
    // Catch the edge itself too, so a thin unfilled shape is still clickable.
    if (distanceToPolyline(point, ring, true) <= tolerance) return true;
  }
  for (const path of outline.paths) {
    if (distanceToPolyline(point, path, false) <= tolerance) return true;
  }
  return false;
}

/**
 * The frame a selection is dragged by.
 *
 * A single layer is measured in its **own** rotated frame, so its box hugs it
 * at any angle and dragging an edge widens the layer rather than shearing it.
 * Two or more layers have no single angle between them, so they get an upright
 * frame — which is the honest answer, not a fallback.
 */
export function frameForLayers(
  layers: readonly Layer[],
  fontFor: (layer: Layer) => EmbroideryFont | null = () => null,
): SelectionFrame | null {
  if (layers.length === 0) return null;
  // `frameAngleOf`, not `rotationOf`: a mirrored layer's x axis points backwards
  // and would put the frame half a turn out. See its note in the engine.
  const angle = layers.length === 1 ? frameAngleOf(layers[0].transform) : 0;
  const rings: Point[][] = [];
  for (const layer of layers) {
    const outline = cachedLayerOutline(layer, fontFor(layer));
    rings.push(...outline.rings, ...outline.paths);
  }
  return selectionFrame(rings, angle);
}
