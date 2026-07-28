import type { PatternBounds } from '../../pattern/bounds.js';
import type { Point } from '../../geometry/point.js';

/**
 * The 48 x 38 monochrome thumbnails a PEC file carries — one for the whole
 * design, then one per colour block. The machine shows these on its screen
 * when you browse a USB stick, so a file without them technically parses but
 * looks broken to the operator.
 *
 * One bit per pixel, 6 bytes per row, LSB-first within each byte.
 */

export const PEC_ICON_WIDTH = 48;
export const PEC_ICON_HEIGHT = 38;
export const PEC_ICON_STRIDE = PEC_ICON_WIDTH / 8;
export const PEC_ICON_BYTES = PEC_ICON_STRIDE * PEC_ICON_HEIGHT;

const ROW_EMPTY = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
const ROW_EDGE = [0xf0, 0xff, 0xff, 0xff, 0xff, 0x0f];
const ROW_CORNER_OUTER = [0x08, 0x00, 0x00, 0x00, 0x00, 0x10];
const ROW_CORNER_INNER = [0x04, 0x00, 0x00, 0x00, 0x00, 0x20];
const ROW_SIDES = [0x02, 0x00, 0x00, 0x00, 0x00, 0x40];

/**
 * A fresh icon pre-drawn with the rounded frame every PEC thumbnail has.
 * Stitches are then plotted inside it.
 */
export function blankIcon(): Uint8Array {
  const icon = new Uint8Array(PEC_ICON_BYTES);
  const rows: number[][] = [
    ROW_EMPTY,
    ROW_EDGE,
    ROW_CORNER_OUTER,
    ROW_CORNER_INNER,
    ...Array.from({ length: 30 }, () => ROW_SIDES),
    ROW_CORNER_INNER,
    ROW_CORNER_OUTER,
    ROW_EDGE,
    ROW_EMPTY,
  ];
  if (rows.length !== PEC_ICON_HEIGHT) {
    throw new Error(`PEC icon template has ${rows.length} rows, expected ${PEC_ICON_HEIGHT}`);
  }
  for (let row = 0; row < PEC_ICON_HEIGHT; row++) {
    icon.set(rows[row], row * PEC_ICON_STRIDE);
  }
  return icon;
}

export function markIconBit(icon: Uint8Array, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= PEC_ICON_WIDTH || y >= PEC_ICON_HEIGHT) return;
  icon[y * PEC_ICON_STRIDE + (x >> 3)] |= 1 << (x & 7);
}

/**
 * Plots points into the icon, scaled to fit with `margin` pixels of clearance.
 * PEC is Y-down like our patterns, so no flip is needed here.
 */
export function drawScaledIcon(
  icon: Uint8Array,
  bounds: PatternBounds,
  points: readonly Point[],
  margin = 5,
): void {
  const width = bounds.width || 1;
  const height = bounds.height || 1;
  const scale = Math.min(
    (PEC_ICON_WIDTH - margin) / width,
    (PEC_ICON_HEIGHT - margin) / height,
  );
  const translateX = -bounds.centerX * scale + PEC_ICON_WIDTH / 2;
  const translateY = -bounds.centerY * scale + PEC_ICON_HEIGHT / 2;

  for (const point of points) {
    markIconBit(
      icon,
      Math.floor(point.x * scale + translateX),
      Math.floor(point.y * scale + translateY),
    );
  }
}
