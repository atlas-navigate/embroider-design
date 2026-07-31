import {
  applyToPoints,
  boundingBoxOfMany,
  compose,
  distanceToPolyline,
  pointInPolygon,
  regionToRings,
  shapeToOpenPaths,
  shapeToRings,
  textToRings,
  translation,
  type BoundingBox,
  type EmbroideryFont,
  type Layer,
  type Point,
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

export function boundsHandles(bounds: BoundingBox): Point[] {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
}

/** The corner diagonally opposite `index`, which a scale drag pivots about. */
export function oppositeHandle(bounds: BoundingBox, index: number): Point {
  return boundsHandles(bounds)[(index + 2) % 4];
}
