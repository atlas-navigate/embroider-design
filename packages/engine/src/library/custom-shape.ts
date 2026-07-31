import type { Point } from '../geometry/point.js';
import { applyToPoints } from '../geometry/transform.js';
import { threadToHex } from '../pattern/thread.js';
import { createLayerId, type Layer } from '../document/layer.js';
import { layerRings, type ShapeOpContext } from '../document/shape-ops.js';
import { authoringBoxTransform, parsePathData, pathDataFromRings } from './path-data.js';
import type { LibraryShape, LibraryPart } from './types.js';

/**
 * Shapes the user made, in the same form as the shapes that shipped.
 *
 * A saved shape is a `LibraryShape` and nothing more. That is the entire design
 * decision here, and it is what keeps the custom library from growing a second
 * copy of everything: thumbnails, search, placement, grouping and stitching all
 * already work on `LibraryShape`, so they work on a saved shape the day it is
 * saved, with no code that knows the difference.
 *
 * Nothing in this module touches a disk — the engine has no filesystem. It
 * turns layers into shapes and text into shapes, and the app decides where the
 * text lives.
 */

/**
 * Bumped only if the stored shape shape changes incompatibly. A file from the
 * future is refused rather than half-read, the same rule project files follow.
 */
export const CUSTOM_LIBRARY_VERSION = 1;

export interface CustomShapeLibrary {
  version: number;
  shapes: LibraryShape[];
}

export function createCustomShapeId(): string {
  return createLayerId('custom');
}

/**
 * Builds a saveable shape from the selected layers.
 *
 * One part per layer, keeping each layer's own colour and name, so saving a
 * three-colour badge and placing it again gives back three layers ready to sew
 * rather than one flat silhouette.
 *
 * Every part is fitted by a **single** shared transform. Fitting each part to
 * its own bounds would be the obvious mistake: it scales the pieces
 * independently and the badge comes back with its lettering the size of its
 * border.
 */
export function customShapeFromLayers(
  name: string,
  layers: readonly Layer[],
  context: ShapeOpContext = {},
): LibraryShape | null {
  const contributions: { layer: Layer; rings: Point[][] }[] = [];
  for (const layer of layers) {
    const rings = layerRings(layer, context);
    if (rings && rings.length > 0) contributions.push({ layer, rings });
  }
  if (contributions.length === 0) return null;

  const matrix = authoringBoxTransform(contributions.flatMap((entry) => entry.rings));
  const parts: LibraryPart[] = [];
  for (const { layer, rings } of contributions) {
    const d = pathDataFromRings(rings.map((ring) => applyToPoints(matrix, ring)));
    if (d.length === 0) continue;
    parts.push({
      name: layer.name || 'Part',
      d,
      color: threadToHex(layer.thread),
      ...(layer.stitchType !== 'auto' ? { stitchType: layer.stitchType } : {}),
    });
  }
  if (parts.length === 0) return null;

  const trimmed = name.trim();
  return {
    id: createCustomShapeId(),
    name: trimmed.length > 0 ? trimmed : 'My shape',
    category: 'custom',
    keywords: ['custom', 'mine', 'saved'],
    parts,
  };
}

function coercePart(value: unknown): LibraryPart | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.d !== 'string' || record.d.trim().length === 0) return null;
  try {
    // Parse it now rather than at draw time. A shape whose path data is
    // unreadable must not reach the panel, where it would throw inside a
    // thumbnail and take the whole library down with it.
    if (parsePathData(record.d).length === 0) return null;
  } catch {
    return null;
  }
  const color = typeof record.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(record.color)
    ? record.color
    : undefined;
  return {
    name: typeof record.name === 'string' && record.name.trim() ? record.name : 'Part',
    d: record.d,
    ...(color ? { color } : {}),
    ...(record.stitchType === 'satin' ||
    record.stitchType === 'fill' ||
    record.stitchType === 'running' ||
    record.stitchType === 'bean'
      ? { stitchType: record.stitchType }
      : {}),
  };
}

/**
 * Long enough for "Autumn leaves and pumpkins", short enough that a pasted
 * paragraph cannot turn into a chip the width of the panel.
 */
const MAX_COLLECTION_LENGTH = 40;

export function coerceCollectionName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, MAX_COLLECTION_LENGTH).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function coerceShape(value: unknown): LibraryShape | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.parts)) return null;
  const parts = record.parts.map(coercePart).filter((part): part is LibraryPart => part !== null);
  if (parts.length === 0) return null;
  const collection = coerceCollectionName(record.collection);
  return {
    id: typeof record.id === 'string' && record.id ? record.id : createCustomShapeId(),
    name: typeof record.name === 'string' && record.name.trim() ? record.name : 'My shape',
    category: 'custom',
    // Named explicitly rather than spread, because everything this function
    // does not name is dropped — which is exactly how `collection` used to
    // vanish on the first restart after an import.
    ...(collection ? { collection } : {}),
    keywords: Array.isArray(record.keywords)
      ? record.keywords.filter((keyword): keyword is string => typeof keyword === 'string')
      : ['custom'],
    parts,
  };
}

/**
 * Reads the stored library, dropping anything unreadable.
 *
 * Deliberately forgiving. This file lives in the user's profile where a bad
 * shutdown can truncate it, and losing one saved shape is a small annoyance
 * while an app that will not open its Shapes panel is a broken app.
 */
export function parseCustomShapes(text: string | null | undefined): LibraryShape[] {
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null) return [];
  const record = parsed as Record<string, unknown>;
  if (Number(record.version ?? 0) > CUSTOM_LIBRARY_VERSION) return [];
  if (!Array.isArray(record.shapes)) return [];

  const shapes: LibraryShape[] = [];
  const seen = new Set<string>();
  for (const entry of record.shapes) {
    const shape = coerceShape(entry);
    // Two shapes sharing an id would make the lookup ambiguous and the delete
    // button remove the wrong one.
    if (!shape || seen.has(shape.id)) continue;
    seen.add(shape.id);
    shapes.push(shape);
  }
  return shapes;
}

export function serializeCustomShapes(shapes: readonly LibraryShape[], pretty = true): string {
  const library: CustomShapeLibrary = {
    version: CUSTOM_LIBRARY_VERSION,
    shapes: shapes.map((shape) => ({ ...shape, category: 'custom' })),
  };
  return JSON.stringify(library, null, pretty ? 2 : 0);
}
