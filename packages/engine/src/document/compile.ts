import { mergeOverlappingRings } from '../geometry/boolean.js';
import { boundingBoxOfMany, type BoundingBox } from '../geometry/path.js';
import type { Point } from '../geometry/point.js';
import { regionToRings } from '../geometry/regions.js';
import { applyToPoints, compose, translation } from '../geometry/transform.js';
import { EmbPattern } from '../pattern/emb-pattern.js';
import {
  appendStitchPath,
  beginColorBlock,
  DEFAULT_AUTO_TRIM_UNITS,
  finishPattern,
} from '../pattern/pattern-builder.js';
import { StitchCommand, type StitchPoint } from '../pattern/stitch.js';
import { threadsEqual, type ThreadColor } from '../pattern/thread.js';
import { unitsToMm } from '../pattern/units.js';
import { resolveStitchSettings, type StitchSettings } from '../stitchgen/settings.js';
import { generatePathStitches, generateRegionStitches } from '../stitchgen/region.js';
import type { ResolvedStitchType } from '../stitchgen/stitch-router.js';
import { groupRingsIntoRegions } from '../geometry/regions.js';
import type { EmbroideryFont } from '../lettering/font.js';
import { generateTextStitches } from '../lettering/glyph-to-stitch.js';
import type { DesignDocument } from './design-document.js';
import { validateHoopFit, type HoopFit } from './hoop.js';
import type { FontReference, Layer } from './layer.js';
import { shapeToOpenPaths, shapeToRings } from './shapes.js';

/**
 * The one place a design becomes stitches.
 *
 * Preview and export both call this and use the same result, so what you see
 * on screen is what lands in the file — there is no second, slightly different
 * rendering path to drift out of sync.
 */

export interface CompileContext {
  /**
   * Supplies a parsed font for a text layer. The engine cannot read files, so
   * the app resolves the reference against its font catalog and hands the
   * parsed font back. A layer whose font is missing is reported, not guessed.
   */
  resolveFont?: (reference: FontReference) => EmbroideryFont | null;
  /** Gap above which a travel move gets a trim. */
  autoTrimDistance?: number;
  /** Stitches per minute, for the time estimate. The PE900 runs at 650. */
  stitchesPerMinute?: number;
  /** Seconds a thread change costs, for the time estimate. */
  secondsPerColorChange?: number;
}

export interface LayerCompileResult {
  layerId: string;
  name: string;
  /** Stitch points contributed, underlay included. */
  stitchCount: number;
  /** What each region of the layer was stitched as. */
  types: ResolvedStitchType[];
  /** Why, in the router's words. Shown next to the layer. */
  reasons: string[];
  warnings: string[];
  skipped: boolean;
  bounds: BoundingBox | null;
}

export interface CompileResult {
  pattern: EmbPattern;
  layers: LayerCompileResult[];
  warnings: string[];
  bounds: BoundingBox | null;
  hoopFit: HoopFit;
  totalStitches: number;
  colorBlocks: number;
  /** Rough sewing time, thread changes included. */
  estimatedMinutes: number;
}

/** One layer's contribution: a colour and the paths to sew in it. */
interface ColorRun {
  thread: ThreadColor;
  runs: Point[][];
}

const DEFAULT_STITCHES_PER_MINUTE = 650;
const DEFAULT_SECONDS_PER_COLOR_CHANGE = 45;

function layerSettings(document: DesignDocument, layer: Layer): StitchSettings {
  return resolveStitchSettings({
    ...document.settings,
    ...layer.settings,
    underlay: { ...document.settings.underlay, ...layer.settings.underlay },
  });
}

function compileShapeLayer(
  layer: Extract<Layer, { kind: 'shape' }>,
  settings: StitchSettings,
  result: LayerCompileResult,
): ColorRun[] {
  const runs: Point[][] = [];
  // Merged first: a part drawn as overlapping blobs is one filled area, and
  // stitching it as several would sew the seams twice in the same thread.
  const rings = mergeOverlappingRings(
    shapeToRings(layer.geometry).map((ring) => applyToPoints(layer.transform, ring)),
  );

  for (const region of groupRingsIntoRegions(rings)) {
    const generated = generateRegionStitches(
      regionToRings(region),
      settings,
      layer.stitchType,
    );
    result.types.push(generated.type);
    result.reasons.push(generated.reason);
    for (const run of generated.runs) runs.push(run);
  }

  for (const path of shapeToOpenPaths(layer.geometry)) {
    const transformed = applyToPoints(layer.transform, path);
    const type = layer.stitchType === 'bean' ? 'bean' : 'running';
    for (const run of generatePathStitches(transformed, settings, type)) runs.push(run);
    result.types.push(type);
    result.reasons.push('Open path — stitched as a line');
  }

  return runs.length > 0 ? [{ thread: layer.thread, runs }] : [];
}

function compileTextLayer(
  layer: Extract<Layer, { kind: 'text' }>,
  settings: StitchSettings,
  context: CompileContext,
  result: LayerCompileResult,
): ColorRun[] {
  if (layer.text.trim().length === 0) {
    result.skipped = true;
    return [];
  }
  const font = context.resolveFont?.(layer.font) ?? null;
  if (!font) {
    result.skipped = true;
    result.warnings.push(
      `Font not available: ${layer.font.family ?? layer.font.path ?? 'unknown'} — install it or pick another`,
    );
    return [];
  }

  const stitched = generateTextStitches(
    font,
    layer.text,
    {
      size: layer.size,
      letterSpacing: layer.letterSpacing,
      wordSpacing: layer.wordSpacing,
      lineHeight: layer.lineHeight,
      align: layer.align,
      kerning: layer.kerning,
      maxWidth: layer.maxWidth,
      shape: layer.shape,
    },
    { settings, stitchType: layer.stitchType },
  );
  for (const warning of stitched.warnings) result.warnings.push(warning);
  for (const glyph of stitched.glyphs) {
    for (const region of glyph.regions) result.types.push(region.type);
  }
  if (stitched.glyphs.length > 0) {
    result.reasons.push(`${stitched.glyphs.length} glyphs digitized from the font outlines`);
  }

  // The layout is block-relative; place it at the layer origin, then transform.
  const matrix = compose(translation(layer.origin.x, layer.origin.y), layer.transform);
  const runs = stitched.runs.map((run) => applyToPoints(matrix, run));
  return runs.length > 0 ? [{ thread: layer.thread, runs }] : [];
}

function compileImageLayer(
  layer: Extract<Layer, { kind: 'image' }>,
  settings: StitchSettings,
  result: LayerCompileResult,
): ColorRun[] {
  const runs: Point[][] = [];
  for (const region of layer.regions) {
    const rings = regionToRings(region).map((ring) => applyToPoints(layer.transform, ring));
    const generated = generateRegionStitches(rings, settings, layer.stitchType);
    result.types.push(generated.type);
    result.reasons.push(generated.reason);
    for (const run of generated.runs) runs.push(run);
  }
  return runs.length > 0 ? [{ thread: layer.thread, runs }] : [];
}

/**
 * Imported stitches pass through unchanged, keeping their own palette.
 *
 * There is no vector behind them to re-generate from, so re-deriving anything
 * would be guesswork. Splitting on the file's own colour changes preserves
 * exactly what the original machine file said to do.
 */
function compileStitchLayer(
  layer: Extract<Layer, { kind: 'stitch' }>,
  result: LayerCompileResult,
): ColorRun[] {
  const source = new EmbPattern({ stitches: layer.stitches, threads: layer.threads });
  const out: ColorRun[] = [];

  for (const block of source.getColorBlocks()) {
    const runs: Point[][] = [];
    let current: Point[] = [];
    for (const stitch of block.stitches) {
      if (stitch.command === StitchCommand.STITCH) {
        current.push({ x: stitch.x, y: stitch.y });
        continue;
      }
      // A jump or trim ends the current run; the compiler will travel to the
      // next one and decide about trimming for itself.
      if (current.length >= 2) runs.push(current);
      current = [];
    }
    if (current.length >= 2) runs.push(current);
    if (runs.length === 0) continue;
    out.push({
      thread: block.thread,
      runs: runs.map((run) => applyToPoints(layer.transform, run)),
    });
  }

  result.types.push('running');
  result.reasons.push(
    `Imported from ${layer.sourceFormat?.toUpperCase() ?? 'a machine file'} — stitches used as-is`,
  );
  return out;
}

export function compileDesignDocument(
  document: DesignDocument,
  context: CompileContext = {},
): CompileResult {
  const pattern = new EmbPattern();
  pattern.metadata = { name: document.name };

  const layerResults: LayerCompileResult[] = [];
  const warnings: string[] = [];
  const autoTrimDistance = context.autoTrimDistance ?? DEFAULT_AUTO_TRIM_UNITS;
  const allRuns: Point[][] = [];

  let previousThread: ThreadColor | null = null;

  for (const layer of document.layers) {
    const result: LayerCompileResult = {
      layerId: layer.id,
      name: layer.name,
      stitchCount: 0,
      types: [],
      reasons: [],
      warnings: [],
      skipped: false,
      bounds: null,
    };
    layerResults.push(result);

    if (!layer.visible) {
      result.skipped = true;
      continue;
    }

    const settings = layerSettings(document, layer);
    let colorRuns: ColorRun[] = [];
    switch (layer.kind) {
      case 'shape':
        colorRuns = compileShapeLayer(layer, settings, result);
        break;
      case 'text':
        colorRuns = compileTextLayer(layer, settings, context, result);
        break;
      case 'image':
        colorRuns = compileImageLayer(layer, settings, result);
        break;
      case 'stitch':
        colorRuns = compileStitchLayer(layer, result);
        break;
    }

    if (colorRuns.length === 0) {
      if (!result.skipped) {
        result.skipped = true;
        result.warnings.push('Produced no stitches — too small, or empty');
      }
      for (const warning of result.warnings) warnings.push(`${layer.name}: ${warning}`);
      continue;
    }

    const layerRuns: Point[][] = [];
    for (const entry of colorRuns) {
      // Consecutive layers in the same colour share one block: a colour change
      // between them would stop the machine to rethread the same spool.
      if (!previousThread || !threadsEqual(previousThread, entry.thread)) {
        beginColorBlock(pattern, entry.thread);
        previousThread = entry.thread;
      }
      for (const run of entry.runs) {
        if (run.length < 2) continue;
        appendStitchPath(pattern, run, { autoTrimDistance });
        result.stitchCount += run.length;
        layerRuns.push(run);
        allRuns.push(run);
      }
    }

    result.bounds = boundingBoxOfMany(layerRuns);
    for (const warning of result.warnings) warnings.push(`${layer.name}: ${warning}`);
  }

  finishPattern(pattern);

  const bounds = boundingBoxOfMany(allRuns);
  const hoopFit = validateHoopFit(bounds, document.hoop, document.hoopOrientation);
  if (!hoopFit.fits) warnings.push(hoopFit.message);

  const statistics = pattern.getStatistics();
  const colorBlocks = pattern.getColorBlockCount();
  const stitchesPerMinute = context.stitchesPerMinute ?? DEFAULT_STITCHES_PER_MINUTE;
  const secondsPerChange = context.secondsPerColorChange ?? DEFAULT_SECONDS_PER_COLOR_CHANGE;
  const estimatedMinutes =
    statistics.stitchCount / stitchesPerMinute +
    (Math.max(0, colorBlocks - 1) * secondsPerChange) / 60;

  if (statistics.longestStitch > 100) {
    warnings.push(
      `Longest stitch is ${unitsToMm(statistics.longestStitch).toFixed(1)} mm — long stitches snag`,
    );
  }

  return {
    pattern,
    layers: layerResults,
    warnings,
    bounds,
    hoopFit,
    totalStitches: statistics.stitchCount,
    colorBlocks,
    estimatedMinutes,
  };
}

/** Pulls the sewn points out of a pattern, for the preview renderer. */
export function patternRuns(pattern: EmbPattern): { thread: ThreadColor; runs: Point[][] }[] {
  const out: { thread: ThreadColor; runs: Point[][] }[] = [];
  for (const block of pattern.getColorBlocks()) {
    const runs: Point[][] = [];
    let current: Point[] = [];
    for (const stitch of block.stitches as StitchPoint[]) {
      if (stitch.command === StitchCommand.STITCH) {
        current.push({ x: stitch.x, y: stitch.y });
        continue;
      }
      if (current.length >= 2) runs.push(current);
      current = [];
    }
    if (current.length >= 2) runs.push(current);
    out.push({ thread: block.thread, runs });
  }
  return out;
}
