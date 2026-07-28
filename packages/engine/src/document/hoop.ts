import type { BoundingBox } from '../geometry/path.js';
import { mmToUnits, unitsToMm } from '../pattern/units.js';

/**
 * Hoops, and whether the design fits in one.
 *
 * Document space runs from (0, 0) at the top-left corner of the hoop to
 * (width, height) at the bottom-right, in 0.1 mm units. Keeping the hoop at
 * the origin means the canvas, the fit check and the saved file all agree
 * without anyone converting; the machine's own centred origin is applied once,
 * by `preparePattern`, at export.
 */

export interface HoopPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  /** Machine this hoop ships with, when it is a specific one. */
  machine?: string;
}

/**
 * The PE900's own two hoops come first because it is the machine this project
 * targets. The others are the common sizes on comparable domestic machines —
 * splitting a design across several hoopings is a separate feature
 * (`docs/roadmap.md`), so a design simply has to fit one of these.
 */
export const HOOP_PRESETS: readonly HoopPreset[] = Object.freeze([
  { id: 'pe900-5x7', name: '5" x 7" (127 x 178 mm)', widthMm: 127, heightMm: 178, machine: 'Brother PE900' },
  { id: 'pe900-4x4', name: '4" x 4" (100 x 100 mm)', widthMm: 100, heightMm: 100, machine: 'Brother PE900' },
  { id: 'hoop-6x10', name: '6" x 10" (160 x 260 mm)', widthMm: 160, heightMm: 260 },
  { id: 'hoop-8x8', name: '8" x 8" (200 x 200 mm)', widthMm: 200, heightMm: 200 },
  { id: 'hoop-2x2', name: '2" x 2" (50 x 50 mm)', widthMm: 50, heightMm: 50 },
]);

export const DEFAULT_HOOP: HoopPreset = HOOP_PRESETS[0];

export function findHoopPreset(id: string): HoopPreset | null {
  return HOOP_PRESETS.find((hoop) => hoop.id === id) ?? null;
}

export type HoopOrientation = 'portrait' | 'landscape';

/** Hoop size in design units, taking orientation into account. */
export function hoopSizeUnits(
  hoop: HoopPreset,
  orientation: HoopOrientation = 'portrait',
): { width: number; height: number } {
  const width = mmToUnits(hoop.widthMm);
  const height = mmToUnits(hoop.heightMm);
  return orientation === 'landscape'
    ? { width: Math.max(width, height), height: Math.min(width, height) }
    : { width: Math.min(width, height), height: Math.max(width, height) };
}

export interface HoopFit {
  fits: boolean;
  /** How far the design runs past each edge, in units. Zero when inside. */
  overflow: { left: number; right: number; top: number; bottom: number };
  /** Design extent in units. */
  usedWidth: number;
  usedHeight: number;
  hoopWidth: number;
  hoopHeight: number;
  /** Human-readable summary for the hoop panel. */
  message: string;
}

export function validateHoopFit(
  bounds: BoundingBox | null,
  hoop: HoopPreset,
  orientation: HoopOrientation = 'portrait',
): HoopFit {
  const { width, height } = hoopSizeUnits(hoop, orientation);
  if (!bounds) {
    return {
      fits: true,
      overflow: { left: 0, right: 0, top: 0, bottom: 0 },
      usedWidth: 0,
      usedHeight: 0,
      hoopWidth: width,
      hoopHeight: height,
      message: 'Nothing to stitch yet',
    };
  }

  const overflow = {
    left: Math.max(0, -bounds.minX),
    top: Math.max(0, -bounds.minY),
    right: Math.max(0, bounds.maxX - width),
    bottom: Math.max(0, bounds.maxY - height),
  };
  const usedWidth = bounds.maxX - bounds.minX;
  const usedHeight = bounds.maxY - bounds.minY;
  const worst = Math.max(overflow.left, overflow.right, overflow.top, overflow.bottom);
  const fits = worst <= 0;

  return {
    fits,
    overflow,
    usedWidth,
    usedHeight,
    hoopWidth: width,
    hoopHeight: height,
    message: fits
      ? `${unitsToMm(usedWidth).toFixed(0)} x ${unitsToMm(usedHeight).toFixed(0)} mm — fits the ${hoop.name} hoop`
      : `Runs ${unitsToMm(worst).toFixed(1)} mm outside the ${hoop.name} hoop — move or resize it`,
  };
}

/**
 * The scale factor that would bring an oversized design inside the hoop, or
 * `1` when it already fits. Backs the "fit to hoop" action.
 */
export function scaleToFitHoop(
  bounds: BoundingBox | null,
  hoop: HoopPreset,
  orientation: HoopOrientation = 'portrait',
  margin = mmToUnits(2),
): number {
  if (!bounds) return 1;
  const { width, height } = hoopSizeUnits(hoop, orientation);
  const usedWidth = bounds.maxX - bounds.minX;
  const usedHeight = bounds.maxY - bounds.minY;
  if (usedWidth <= 0 || usedHeight <= 0) return 1;
  const scale = Math.min(
    (width - margin * 2) / usedWidth,
    (height - margin * 2) / usedHeight,
  );
  return scale < 1 ? Math.max(0.01, scale) : 1;
}
