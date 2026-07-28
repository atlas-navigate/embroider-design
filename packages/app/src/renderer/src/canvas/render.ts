import {
  hoopSizeUnits,
  mmToUnits,
  threadToHex,
  type BoundingBox,
  type DesignDocument,
  type EmbroideryFont,
  type Layer,
  type Point,
} from '@embroider-design/engine';
import type { ViewTransform } from '../state/document-store.js';
import { boundsHandles, layerOutline, outlineBounds } from './geometry.js';

/**
 * Canvas drawing.
 *
 * Kept out of the React component so the draw path is a plain function of
 * (state, context) — easy to reason about, and it never triggers a re-render
 * by touching a hook.
 */

export const HANDLE_SIZE = 8;

export interface CanvasTheme {
  background: string;
  hoop: string;
  hoopFill: string;
  grid: string;
  gridMajor: string;
  selection: string;
  handle: string;
  outsideHoop: string;
}

export const DARK_THEME: CanvasTheme = {
  background: '#16181c',
  hoop: '#5a6270',
  hoopFill: '#1e2128',
  grid: '#252932',
  gridMajor: '#31384a',
  selection: '#4c9aff',
  handle: '#ffffff',
  outsideHoop: 'rgba(214, 69, 69, 0.10)',
};

export function toScreen(view: ViewTransform, point: Point): Point {
  return { x: point.x * view.zoom + view.panX, y: point.y * view.zoom + view.panY };
}

export function toDocument(view: ViewTransform, x: number, y: number): Point {
  return { x: (x - view.panX) / view.zoom, y: (y - view.panY) / view.zoom };
}

function pathFromPoints(
  context: CanvasRenderingContext2D,
  view: ViewTransform,
  points: readonly Point[],
  close: boolean,
): void {
  if (points.length === 0) return;
  const first = toScreen(view, points[0]);
  context.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = toScreen(view, points[i]);
    context.lineTo(p.x, p.y);
  }
  if (close) context.closePath();
}

export function drawHoop(
  context: CanvasRenderingContext2D,
  view: ViewTransform,
  document: DesignDocument,
  theme: CanvasTheme,
  showGrid: boolean,
): void {
  const size = hoopSizeUnits(document.hoop, document.hoopOrientation);
  const origin = toScreen(view, { x: 0, y: 0 });
  const width = size.width * view.zoom;
  const height = size.height * view.zoom;

  context.fillStyle = theme.hoopFill;
  context.fillRect(origin.x, origin.y, width, height);

  if (showGrid) {
    // 10 mm minor, 50 mm major — the spacing embroiderers actually think in.
    const minor = mmToUnits(10) * view.zoom;
    const major = mmToUnits(50) * view.zoom;
    if (minor > 4) {
      context.save();
      context.beginPath();
      context.rect(origin.x, origin.y, width, height);
      context.clip();
      for (const [step, color] of [
        [minor, theme.grid],
        [major, theme.gridMajor],
      ] as const) {
        context.strokeStyle = color;
        context.lineWidth = 1;
        context.beginPath();
        for (let x = 0; x <= width + 0.5; x += step) {
          context.moveTo(Math.round(origin.x + x) + 0.5, origin.y);
          context.lineTo(Math.round(origin.x + x) + 0.5, origin.y + height);
        }
        for (let y = 0; y <= height + 0.5; y += step) {
          context.moveTo(origin.x, Math.round(origin.y + y) + 0.5);
          context.lineTo(origin.x + width, Math.round(origin.y + y) + 0.5);
        }
        context.stroke();
      }
      context.restore();
    }
  }

  context.strokeStyle = theme.hoop;
  context.lineWidth = 2;
  context.strokeRect(origin.x + 0.5, origin.y + 0.5, width, height);
}

export function drawLayer(
  context: CanvasRenderingContext2D,
  view: ViewTransform,
  layer: Layer,
  selected: boolean,
  font: EmbroideryFont | null = null,
): void {
  const outline = layerOutline(layer, font);
  if (outline.rings.length === 0 && outline.paths.length === 0) return;

  const color = threadToHex(layer.thread);
  context.save();
  context.globalAlpha = layer.locked ? 0.4 : 1;

  if (outline.rings.length > 0) {
    context.beginPath();
    for (const ring of outline.rings) pathFromPoints(context, view, ring, true);
    context.fillStyle = color;
    // Translucent so overlapping layers and the grid stay legible; the stitch
    // preview is where the design is shown as it will actually look.
    context.globalAlpha *= 0.35;
    context.fill('evenodd');
    context.globalAlpha = layer.locked ? 0.4 : 1;
    context.strokeStyle = color;
    context.lineWidth = selected ? 2 : 1.25;
    context.stroke();
  }

  if (outline.paths.length > 0) {
    context.beginPath();
    for (const path of outline.paths) pathFromPoints(context, view, path, false);
    context.strokeStyle = color;
    context.lineWidth = selected ? 2.5 : 1.75;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.stroke();
  }

  context.restore();
}

export function drawSelection(
  context: CanvasRenderingContext2D,
  view: ViewTransform,
  bounds: BoundingBox,
  theme: CanvasTheme,
): void {
  const topLeft = toScreen(view, { x: bounds.minX, y: bounds.minY });
  const bottomRight = toScreen(view, { x: bounds.maxX, y: bounds.maxY });

  context.save();
  context.strokeStyle = theme.selection;
  context.lineWidth = 1;
  context.setLineDash([4, 3]);
  context.strokeRect(
    topLeft.x + 0.5,
    topLeft.y + 0.5,
    bottomRight.x - topLeft.x,
    bottomRight.y - topLeft.y,
  );
  context.setLineDash([]);

  for (const handle of boundsHandles(bounds)) {
    const p = toScreen(view, handle);
    context.fillStyle = theme.handle;
    context.strokeStyle = theme.selection;
    context.fillRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    context.strokeRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
  }
  context.restore();
}

/** The in-progress shape while a tool is being dragged. */
export function drawGhost(
  context: CanvasRenderingContext2D,
  view: ViewTransform,
  points: readonly Point[],
  close: boolean,
  theme: CanvasTheme,
): void {
  if (points.length < 2) return;
  context.save();
  context.strokeStyle = theme.selection;
  context.lineWidth = 1.5;
  context.setLineDash([5, 4]);
  context.beginPath();
  pathFromPoints(context, view, points, close);
  context.stroke();
  context.restore();
}

export function layerBounds(
  layer: Layer,
  font: EmbroideryFont | null = null,
): BoundingBox | null {
  return outlineBounds(layerOutline(layer, font));
}
