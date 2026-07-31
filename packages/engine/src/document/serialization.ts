import { IDENTITY } from '../geometry/transform.js';
import type { Point } from '../geometry/point.js';
import type { TextShape } from '../lettering/text-warp.js';
import { thread as makeThread, type ThreadColor } from '../pattern/thread.js';
import { DEFAULT_HOOP, findHoopPreset, type HoopPreset } from './hoop.js';
import { createLayerId, type Layer } from './layer.js';
import {
  createDesignDocument,
  DOCUMENT_SCHEMA_VERSION,
  type DesignDocument,
} from './design-document.js';

/**
 * Project files.
 *
 * Plain JSON with a version stamp. The version is the point: a project a user
 * saved is theirs, and a later release that changes the layer shape has to
 * keep opening it. `migrate` is where that happens, and it runs before
 * anything else touches the data.
 */

export const PROJECT_EXTENSION = '.embd';
export const PROJECT_FILE_TYPE = 'Embroider Design project';

export function serializeDocument(document: DesignDocument, pretty = true): string {
  const payload: DesignDocument = { ...document, schemaVersion: DOCUMENT_SCHEMA_VERSION };
  return JSON.stringify(payload, null, pretty ? 2 : 0);
}

export class ProjectFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectFormatError';
  }
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProjectFormatError(`${what} is not an object`);
  }
  return value as Record<string, unknown>;
}

function coerceThread(value: unknown): ThreadColor {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return makeThread(
    Number(record.r ?? 0),
    Number(record.g ?? 0),
    Number(record.b ?? 0),
    typeof record.description === 'string' ? record.description : undefined,
  );
}

function coerceHoop(value: unknown): HoopPreset {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const byId = typeof record.id === 'string' ? findHoopPreset(record.id) : null;
  if (byId) return byId;
  // A hoop this build does not know about is still usable if it carries a size.
  const widthMm = Number(record.widthMm);
  const heightMm = Number(record.heightMm);
  if (Number.isFinite(widthMm) && Number.isFinite(heightMm) && widthMm > 0 && heightMm > 0) {
    return {
      id: typeof record.id === 'string' ? record.id : 'custom',
      name: typeof record.name === 'string' ? record.name : `${widthMm} x ${heightMm} mm`,
      widthMm,
      heightMm,
      machine: typeof record.machine === 'string' ? record.machine : undefined,
    };
  }
  return DEFAULT_HOOP;
}

function finiteOr(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * A text shape, or straight when it cannot be trusted.
 *
 * A curve is decoration: a project whose shape record is unreadable should open
 * with the lettering straight, not refuse to open. Anything unrecognised —
 * a future release's shape type, a hand-edited file, a truncated download —
 * lands on `none`.
 */
function coerceTextShape(value: unknown): TextShape | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  switch (record.type) {
    case 'arc':
      return { type: 'arc', sweep: finiteOr(record.sweep, 0) };
    case 'wave':
      return {
        type: 'wave',
        amplitude: finiteOr(record.amplitude, 0),
        cycles: finiteOr(record.cycles, 0),
      };
    case 'path': {
      if (!Array.isArray(record.points)) return { type: 'none' };
      const points: Point[] = [];
      for (const entry of record.points) {
        if (typeof entry !== 'object' || entry === null) continue;
        const point = entry as Record<string, unknown>;
        const x = Number(point.x);
        const y = Number(point.y);
        if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
      }
      return points.length >= 2 ? { type: 'path', points } : { type: 'none' };
    }
    case 'none':
      return { type: 'none' };
    default:
      return undefined;
  }
}

function coerceLayer(value: unknown, index: number): Layer | null {
  const record = asRecord(value, `Layer ${index}`);
  const kind = record.kind;
  if (kind !== 'shape' && kind !== 'text' && kind !== 'image' && kind !== 'stitch') return null;

  const layer = {
    ...record,
    id: typeof record.id === 'string' ? record.id : createLayerId(kind),
    name: typeof record.name === 'string' ? record.name : `Layer ${index + 1}`,
    kind,
    visible: record.visible !== false,
    locked: record.locked === true,
    thread: coerceThread(record.thread),
    stitchType: typeof record.stitchType === 'string' ? record.stitchType : 'auto',
    settings: typeof record.settings === 'object' && record.settings !== null ? record.settings : {},
    transform:
      typeof record.transform === 'object' && record.transform !== null
        ? record.transform
        : { ...IDENTITY },
  } as unknown as Layer;

  if (layer.kind === 'text') {
    const shape = coerceTextShape(record.shape);
    if (shape && shape.type !== 'none') layer.shape = shape;
    else delete layer.shape;
  }

  // A layer of the right kind but with no content is dead weight in the stack.
  if (layer.kind === 'shape' && typeof (layer as { geometry?: unknown }).geometry !== 'object') {
    return null;
  }
  if (layer.kind === 'image' && !Array.isArray((layer as { regions?: unknown }).regions)) {
    return null;
  }
  if (layer.kind === 'stitch' && !Array.isArray((layer as { stitches?: unknown }).stitches)) {
    return null;
  }
  return layer;
}

/**
 * Brings an older project up to the current schema.
 *
 * Nothing to do yet — version 1 is the first — but the hook exists so the
 * first breaking change has somewhere obvious to go, rather than being
 * scattered through the coercion below.
 */
function migrate(payload: Record<string, unknown>, from: number): Record<string, unknown> {
  if (from > DOCUMENT_SCHEMA_VERSION) {
    throw new ProjectFormatError(
      `This project was saved by a newer version (format ${from}, this build reads ${DOCUMENT_SCHEMA_VERSION})`,
    );
  }
  return payload;
}

export function deserializeDocument(input: string | unknown): DesignDocument {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (error) {
      throw new ProjectFormatError(
        `Not a valid project file: ${error instanceof Error ? error.message : 'unreadable'}`,
      );
    }
  }

  const record = asRecord(parsed, 'Project');
  const version = Number(record.schemaVersion ?? 0);
  if (!Number.isFinite(version) || version < 1) {
    throw new ProjectFormatError('Not a project file: no format version');
  }
  const migrated = migrate(record, version);

  const base = createDesignDocument({
    name: typeof migrated.name === 'string' ? migrated.name : 'Untitled design',
    hoop: coerceHoop(migrated.hoop),
    hoopOrientation: migrated.hoopOrientation === 'landscape' ? 'landscape' : 'portrait',
    units: migrated.units === 'inch' ? 'inch' : 'mm',
    settings:
      typeof migrated.settings === 'object' && migrated.settings !== null
        ? (migrated.settings as DesignDocument['settings'])
        : {},
  });

  const rawLayers = Array.isArray(migrated.layers) ? migrated.layers : [];
  const layers: Layer[] = [];
  for (let i = 0; i < rawLayers.length; i++) {
    const layer = coerceLayer(rawLayers[i], i);
    if (layer) layers.push(layer);
  }

  return {
    ...base,
    id: typeof migrated.id === 'string' ? migrated.id : base.id,
    createdAt: typeof migrated.createdAt === 'string' ? migrated.createdAt : base.createdAt,
    modifiedAt: typeof migrated.modifiedAt === 'string' ? migrated.modifiedAt : base.modifiedAt,
    layers,
  };
}
