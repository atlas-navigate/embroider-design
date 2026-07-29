import { IDENTITY, type AffineMatrix } from '../geometry/transform.js';
import type { RingRegion } from '../geometry/regions.js';
import type { Point } from '../geometry/point.js';
import type { StitchPoint } from '../pattern/stitch.js';
import { defaultThreadForIndex, type ThreadColor } from '../pattern/thread.js';
import type { PartialStitchSettings, StitchType } from '../stitchgen/settings.js';
import type { TextAlign } from '../lettering/text-layout.js';
import type { ShapeGeometry } from './shapes.js';

/**
 * Layers: what the user actually manipulates.
 *
 * Every layer carries its own thread and its own stitch settings, because in
 * embroidery those are not styling — they are what the machine does. A layer
 * is one colour and one stitch treatment; reordering layers reorders the
 * sewing.
 */

export type LayerKind = 'shape' | 'text' | 'image' | 'stitch';

export interface LayerBase {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
  thread: ThreadColor;
  stitchType: StitchType;
  /** Overrides on top of the document's defaults. */
  settings: PartialStitchSettings;
  transform: AffineMatrix;
  /**
   * Layers that move, scale and select as one.
   *
   * A flat id rather than a nested tree, deliberately. Compiling walks a flat
   * z-ordered list and merges adjacent same-thread layers into one colour
   * block; a tree would mean rewriting that walk to no user-visible benefit,
   * and grouping is an editing convenience, not something the machine knows
   * about. Optional, so existing project files load unchanged.
   */
  groupId?: string;
}

export interface ShapeLayer extends LayerBase {
  kind: 'shape';
  geometry: ShapeGeometry;
}

/** How a saved project refers to a font it does not contain. */
export interface FontReference {
  /** Absolute path on the machine that made the design. */
  path?: string;
  family?: string;
  subfamily?: string;
  postScriptName?: string;
}

export interface TextLayer extends LayerBase {
  kind: 'text';
  text: string;
  font: FontReference;
  /** Em size in 0.1 mm units. */
  size: number;
  letterSpacing: number;
  wordSpacing: number;
  /** Baseline-to-baseline distance; the font's own suggestion when omitted. */
  lineHeight?: number;
  align: TextAlign;
  kerning: boolean;
  /** Wrap width in units. 0 means never wrap. */
  maxWidth: number;
  /** Top-left of the text block, before `transform`. */
  origin: Point;
}

export interface TraceSource {
  name: string;
  /** The downscaled source image, so a saved project can be re-traced. */
  dataUrl?: string;
  width: number;
  height: number;
}

export interface ImageTraceLayer extends LayerBase {
  kind: 'image';
  /** Already in design units, before `transform`. */
  regions: RingRegion[];
  source?: TraceSource;
  /** The settings that produced these regions, for a re-trace. */
  traceOptions?: Record<string, unknown>;
}

/**
 * Stitches imported from a machine file.
 *
 * These are not re-generated at compile time — there is no vector behind them
 * to re-generate from — so the layer keeps its own palette and colour blocks
 * and the compiler splices them in as they are. It is what makes the app a
 * viewer and converter as well as an editor.
 */
export interface StitchLayer extends LayerBase {
  kind: 'stitch';
  stitches: StitchPoint[];
  threads: ThreadColor[];
  sourceFormat?: string;
  sourceName?: string;
}

export type Layer = ShapeLayer | TextLayer | ImageTraceLayer | StitchLayer;

let idCounter = 0;

/** Ids only have to be unique within a document, and stable once saved. */
export function createLayerId(prefix = 'layer'): string {
  idCounter++;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

function baseLayer(kind: LayerKind, name: string, index: number): LayerBase {
  return {
    id: createLayerId(kind),
    name,
    kind,
    visible: true,
    locked: false,
    thread: defaultThreadForIndex(index),
    stitchType: 'auto',
    settings: {},
    transform: { ...IDENTITY },
  };
}

export interface CreateLayerOptions {
  name?: string;
  /** Position in the layer stack, used to pick a distinguishable default colour. */
  index?: number;
  thread?: ThreadColor;
  stitchType?: StitchType;
  settings?: PartialStitchSettings;
}

export function createShapeLayer(
  geometry: ShapeGeometry,
  options: CreateLayerOptions = {},
): ShapeLayer {
  const base = baseLayer('shape', options.name ?? shapeLayerName(geometry), options.index ?? 0);
  return { ...base, kind: 'shape', geometry, ...pickOverrides(options) };
}

export function createTextLayer(
  text: string,
  font: FontReference,
  size: number,
  options: CreateLayerOptions & Partial<Omit<TextLayer, keyof LayerBase | 'kind'>> = {},
): TextLayer {
  const base = baseLayer('text', options.name ?? (text.trim() || 'Text'), options.index ?? 0);
  return {
    ...base,
    kind: 'text',
    text,
    font,
    size,
    letterSpacing: options.letterSpacing ?? 0,
    wordSpacing: options.wordSpacing ?? 0,
    lineHeight: options.lineHeight,
    align: options.align ?? 'left',
    kerning: options.kerning ?? true,
    maxWidth: options.maxWidth ?? 0,
    origin: options.origin ? { ...options.origin } : { x: 0, y: 0 },
    ...pickOverrides(options),
  };
}

export function createImageTraceLayer(
  regions: RingRegion[],
  options: CreateLayerOptions & { source?: TraceSource; traceOptions?: Record<string, unknown> } = {},
): ImageTraceLayer {
  const base = baseLayer('image', options.name ?? 'Traced shape', options.index ?? 0);
  return {
    ...base,
    kind: 'image',
    regions,
    source: options.source,
    traceOptions: options.traceOptions,
    ...pickOverrides(options),
  };
}

export function createStitchLayer(
  stitches: StitchPoint[],
  threads: ThreadColor[],
  options: CreateLayerOptions & { sourceFormat?: string; sourceName?: string } = {},
): StitchLayer {
  const base = baseLayer('stitch', options.name ?? options.sourceName ?? 'Imported stitches', 0);
  return {
    ...base,
    kind: 'stitch',
    stitches,
    threads,
    sourceFormat: options.sourceFormat,
    sourceName: options.sourceName,
    ...pickOverrides(options),
  };
}

/** Deliberately excludes `kind`: spreading a widened `kind` would erase the discriminant. */
type LayerOverrides = Partial<Pick<LayerBase, 'thread' | 'stitchType' | 'settings'>>;

function pickOverrides(options: CreateLayerOptions): LayerOverrides {
  const overrides: LayerOverrides = {};
  if (options.thread) overrides.thread = { ...options.thread };
  if (options.stitchType) overrides.stitchType = options.stitchType;
  if (options.settings) overrides.settings = { ...options.settings };
  return overrides;
}

function shapeLayerName(geometry: ShapeGeometry): string {
  switch (geometry.type) {
    case 'rectangle':
      return geometry.cornerRadius && geometry.cornerRadius > 0 ? 'Rounded rectangle' : 'Rectangle';
    case 'ellipse':
      return Math.abs(geometry.rx - geometry.ry) < 1e-6 ? 'Circle' : 'Ellipse';
    case 'polygon':
      return geometry.innerRadius ? 'Star' : 'Polygon';
    case 'polyline':
      return geometry.closed ? 'Shape' : 'Line';
    case 'path':
      return 'Path';
  }
}

export function cloneLayer(layer: Layer): Layer {
  return structuredClone(layer);
}

/** True when the layer contributes nothing to the compiled pattern. */
export function isLayerEmpty(layer: Layer): boolean {
  switch (layer.kind) {
    case 'text':
      return layer.text.trim().length === 0;
    case 'image':
      return layer.regions.length === 0;
    case 'stitch':
      return layer.stitches.length === 0;
    case 'shape':
      return false;
  }
}
