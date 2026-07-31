import {
  RESIZE_HANDLES,
  applyToPoint,
  baselineFor,
  compose,
  groupRingsIntoRegions,
  handlePoint,
  hoopSizeUnits,
  layoutText,
  mmToUnits,
  regionToRings,
  threadToHex,
  translation,
  type BoundingBox,
  type DesignDocument,
  type EmbroideryFont,
  type HandleId,
  type Layer,
  type Point,
  type SelectionFrame,
} from '@embroider-design/engine';
import type { ViewTransform } from '../state/document-store.js';
import { cachedLayerOutline, outlineBounds } from './geometry.js';

/**
 * Canvas drawing.
 *
 * Kept out of the React component so the draw path is a plain function of
 * (state, context) — easy to reason about, and it never triggers a re-render
 * by touching a hook.
 */

export const HANDLE_SIZE = 8;

/**
 * How far above the selection the rotate handle floats, in screen pixels.
 *
 * Screen pixels rather than document units, so the handle keeps the same
 * comfortable distance from the box at every zoom. Comfortably more than
 * `HANDLE_SIZE`, so it never overlaps the corner handles and steal their
 * clicks — see `handleAtPoint`, which resolves that overlap in the corners'
 * favour and would make rotate unreachable if the two ever collided.
 */
export const ROTATE_HANDLE_OFFSET_PX = 26;

/** The rotate-handle gap in document units, which is what the frame maths wants. */
export function rotateGapFor(view: ViewTransform): number {
  return ROTATE_HANDLE_OFFSET_PX / view.zoom;
}

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
  const outline = cachedLayerOutline(layer, font);
  if (outline.rings.length === 0 && outline.paths.length === 0) return;

  const color = threadToHex(layer.thread);
  context.save();
  context.globalAlpha = layer.locked ? 0.4 : 1;

  if (outline.rings.length > 0) {
    // One path per filled region rather than one for the whole layer. Even-odd
    // over the lot would punch a hole wherever two rings of the same part
    // overlap — a cloud drawn as three circles would come out as a stencil —
    // and `groupRingsIntoRegions` is the same nesting the compiler stitches by,
    // so the outline on screen agrees with the one in the file.
    const regions = groupRingsIntoRegions(outline.rings);
    context.fillStyle = color;
    context.strokeStyle = color;
    context.lineWidth = selected ? 2 : 1.25;
    for (const region of regions) {
      context.beginPath();
      for (const ring of regionToRings(region)) pathFromPoints(context, view, ring, true);
      // Translucent so overlapping layers and the grid stay legible; the stitch
      // preview is where the design is shown as it will actually look.
      context.globalAlpha *= 0.35;
      context.fill('evenodd');
      context.globalAlpha = layer.locked ? 0.4 : 1;
      context.stroke();
    }
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

/**
 * The selection box, its eight resize handles and the rotate handle.
 *
 * The box is drawn from the frame's four corners rather than as a rect, because
 * a frame belonging to a rotated layer is turned and `strokeRect` can only draw
 * upright. The handles come from the same `handlePoint` the hit test uses, so
 * what is drawn and what is grabbable cannot drift apart.
 */
export function drawSelection(
  context: CanvasRenderingContext2D,
  view: ViewTransform,
  frame: SelectionFrame,
  theme: CanvasTheme,
): void {
  const at = (handle: HandleId): Point =>
    toScreen(view, handlePoint(frame, handle, rotateGapFor(view)));

  context.save();
  context.strokeStyle = theme.selection;
  context.lineWidth = 1;

  context.setLineDash([4, 3]);
  context.beginPath();
  const corners: HandleId[] = ['nw', 'ne', 'se', 'sw'];
  corners.forEach((handle, index) => {
    const p = at(handle);
    if (index === 0) context.moveTo(p.x, p.y);
    else context.lineTo(p.x, p.y);
  });
  context.closePath();
  context.stroke();
  context.setLineDash([]);

  // The stem tying the rotate handle to the top edge, so it reads as belonging
  // to the selection rather than floating near it.
  const top = at('n');
  const pivotEnd = at('rotate');
  context.beginPath();
  context.moveTo(top.x, top.y);
  context.lineTo(pivotEnd.x, pivotEnd.y);
  context.stroke();

  context.fillStyle = theme.handle;
  for (const handle of RESIZE_HANDLES) {
    const p = at(handle);
    context.fillRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    context.strokeRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
  }

  // Round, so it is obvious at a glance that it does something other than the
  // eight square ones.
  context.beginPath();
  context.arc(pivotEnd.x, pivotEnd.y, HANDLE_SIZE / 2 + 1, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.restore();
}

/**
 * A thin outline round each member of a multi-selection.
 *
 * The union box alone is ambiguous: with three of five layers selected it is
 * impossible to tell which three. Outlining the members says so directly,
 * without the clutter of a handled box per layer.
 */
export function drawSelectionMembers(
  context: CanvasRenderingContext2D,
  view: ViewTransform,
  boxes: readonly BoundingBox[],
  theme: CanvasTheme,
): void {
  if (boxes.length < 2) return;
  context.save();
  context.strokeStyle = theme.selection;
  context.globalAlpha = 0.55;
  context.lineWidth = 1;
  for (const box of boxes) {
    const topLeft = toScreen(view, { x: box.minX, y: box.minY });
    const bottomRight = toScreen(view, { x: box.maxX, y: box.maxY });
    context.strokeRect(
      topLeft.x + 0.5,
      topLeft.y + 0.5,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y,
    );
  }
  context.restore();
}

/** The rubber-band rectangle while dragging on empty canvas. */
export function drawMarquee(
  context: CanvasRenderingContext2D,
  view: ViewTransform,
  start: Point,
  current: Point,
  theme: CanvasTheme,
): void {
  const a = toScreen(view, start);
  const b = toScreen(view, current);
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const width = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);

  context.save();
  context.fillStyle = theme.selection;
  context.globalAlpha = 0.12;
  context.fillRect(x, y, width, height);
  context.globalAlpha = 1;
  context.strokeStyle = theme.selection;
  context.lineWidth = 1;
  context.setLineDash([4, 3]);
  context.strokeRect(x + 0.5, y + 0.5, width, height);
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
  return outlineBounds(cachedLayerOutline(layer, font));
}

/** How finely the guide curve is sampled. Enough for a full circle to look round. */
const BASELINE_SAMPLES = 96;

/**
 * The curve a shaped text layer is sitting on.
 *
 * Curved lettering is hard to adjust blind: the letters are visibly turning but
 * the circle they are turning around is invisible, so "is this centred on the
 * badge?" has no answer. Drawing the baseline while the layer is selected gives
 * that question one.
 */
export function drawBaselineGuide(
  context: CanvasRenderingContext2D,
  view: ViewTransform,
  layer: Layer,
  font: EmbroideryFont | null,
  theme: CanvasTheme,
): void {
  if (layer.kind !== 'text' || !layer.shape || layer.shape.type === 'none' || !font) return;
  if (layer.text.trim().length === 0) return;

  const layout = layoutText(font, layer.text, {
    size: layer.size,
    letterSpacing: layer.letterSpacing,
    wordSpacing: layer.wordSpacing,
    lineHeight: layer.lineHeight,
    align: layer.align,
    kerning: layer.kerning,
    maxWidth: layer.maxWidth,
  });
  const baseline = baselineFor(layer.shape, layout);
  if (!baseline) return;

  const matrix = compose(translation(layer.origin.x, layer.origin.y), layer.transform);
  const points: Point[] = [];
  for (let i = 0; i <= BASELINE_SAMPLES; i++) {
    const s = (i / BASELINE_SAMPLES) * baseline.length;
    points.push(applyToPoint(matrix, baseline.at(s).point));
  }

  context.save();
  context.strokeStyle = theme.selection;
  context.globalAlpha = 0.5;
  context.lineWidth = 1;
  context.setLineDash([3, 4]);
  context.beginPath();
  pathFromPoints(context, view, points, false);
  context.stroke();
  context.restore();
}
