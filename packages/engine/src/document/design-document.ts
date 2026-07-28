import { boundingBoxOfMany, type BoundingBox } from '../geometry/path.js';
import { applyToPoints } from '../geometry/transform.js';
import { regionToRings } from '../geometry/regions.js';
import type { LengthUnit } from '../pattern/units.js';
import type { PartialStitchSettings } from '../stitchgen/settings.js';
import { DEFAULT_HOOP, type HoopOrientation, type HoopPreset } from './hoop.js';
import { cloneLayer, createLayerId, type Layer } from './layer.js';
import { shapeToOpenPaths, shapeToRings } from './shapes.js';

/**
 * The document: an ordered stack of layers inside a hoop.
 *
 * Every mutation returns a new document rather than editing in place. That is
 * what lets the UI store compare by reference to decide when to recompile, and
 * it is the groundwork undo/redo will need (`docs/roadmap.md`).
 */

export const DOCUMENT_SCHEMA_VERSION = 1;

export interface DesignDocument {
  schemaVersion: number;
  id: string;
  name: string;
  hoop: HoopPreset;
  hoopOrientation: HoopOrientation;
  /** Unit the UI displays. Storage is always 0.1 mm units. */
  units: LengthUnit;
  /** Document-wide defaults; each layer may override them. */
  settings: PartialStitchSettings;
  layers: Layer[];
  createdAt: string;
  modifiedAt: string;
}

export interface CreateDocumentOptions {
  name?: string;
  hoop?: HoopPreset;
  hoopOrientation?: HoopOrientation;
  units?: LengthUnit;
  settings?: PartialStitchSettings;
}

export function createDesignDocument(options: CreateDocumentOptions = {}): DesignDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: createLayerId('design'),
    name: options.name ?? 'Untitled design',
    hoop: options.hoop ?? DEFAULT_HOOP,
    hoopOrientation: options.hoopOrientation ?? 'portrait',
    units: options.units ?? 'mm',
    settings: options.settings ?? {},
    layers: [],
    createdAt: now,
    modifiedAt: now,
  };
}

function touch(document: DesignDocument, layers: Layer[]): DesignDocument {
  return { ...document, layers, modifiedAt: new Date().toISOString() };
}

export function addLayer(
  document: DesignDocument,
  layer: Layer,
  index = document.layers.length,
): DesignDocument {
  const layers = [...document.layers];
  layers.splice(Math.max(0, Math.min(index, layers.length)), 0, layer);
  return touch(document, layers);
}

export function removeLayer(document: DesignDocument, layerId: string): DesignDocument {
  return touch(
    document,
    document.layers.filter((layer) => layer.id !== layerId),
  );
}

/**
 * `T` lets a caller that knows the layer's kind pass a typed patch —
 * `updateLayer<TextLayer>(doc, id, { size })` — without widening every field
 * to the union.
 */
export function updateLayer<T extends Layer = Layer>(
  document: DesignDocument,
  layerId: string,
  update: Partial<T> | ((layer: T) => T),
): DesignDocument {
  let changed = false;
  const layers = document.layers.map((layer) => {
    if (layer.id !== layerId) return layer;
    changed = true;
    return typeof update === 'function' ? update(layer as T) : ({ ...layer, ...update } as Layer);
  });
  return changed ? touch(document, layers) : document;
}

/** Moves a layer to an absolute position in the stack. */
export function reorderLayer(
  document: DesignDocument,
  layerId: string,
  toIndex: number,
): DesignDocument {
  const from = document.layers.findIndex((layer) => layer.id === layerId);
  if (from < 0) return document;
  const layers = [...document.layers];
  const [layer] = layers.splice(from, 1);
  layers.splice(Math.max(0, Math.min(toIndex, layers.length)), 0, layer);
  return touch(document, layers);
}

export function moveLayer(
  document: DesignDocument,
  layerId: string,
  offset: number,
): DesignDocument {
  const from = document.layers.findIndex((layer) => layer.id === layerId);
  if (from < 0) return document;
  return reorderLayer(document, layerId, from + offset);
}

export function duplicateLayer(document: DesignDocument, layerId: string): DesignDocument {
  const index = document.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) return document;
  const copy = cloneLayer(document.layers[index]);
  copy.id = createLayerId(copy.kind);
  copy.name = `${copy.name} copy`;
  return addLayer(document, copy, index + 1);
}

export function findLayer(document: DesignDocument, layerId: string): Layer | null {
  return document.layers.find((layer) => layer.id === layerId) ?? null;
}

/**
 * The design's extent in document space.
 *
 * Text is measured from its regions at compile time, not here — laying text
 * out needs a font, and this has to work without one. A text layer therefore
 * contributes only its origin, which is enough to keep it on screen.
 */
export function documentBounds(document: DesignDocument): BoundingBox | null {
  const rings: (readonly { x: number; y: number }[])[] = [];
  for (const layer of document.layers) {
    if (!layer.visible) continue;
    switch (layer.kind) {
      case 'shape':
        for (const ring of shapeToRings(layer.geometry)) {
          rings.push(applyToPoints(layer.transform, ring));
        }
        for (const path of shapeToOpenPaths(layer.geometry)) {
          rings.push(applyToPoints(layer.transform, path));
        }
        break;
      case 'image':
        for (const region of layer.regions) {
          for (const ring of regionToRings(region)) {
            rings.push(applyToPoints(layer.transform, ring));
          }
        }
        break;
      case 'stitch':
        rings.push(applyToPoints(layer.transform, layer.stitches));
        break;
      case 'text':
        rings.push(applyToPoints(layer.transform, [layer.origin]));
        break;
    }
  }
  return boundingBoxOfMany(rings);
}

export function visibleLayers(document: DesignDocument): Layer[] {
  return document.layers.filter((layer) => layer.visible);
}
