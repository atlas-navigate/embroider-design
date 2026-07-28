import { useCallback, useEffect, useRef, useState } from 'react';
import {
  compose,
  createTextLayer,
  ellipse,
  mmToUnits,
  polyline,
  rectangle,
  regularPolygon,
  scaleAround,
  star,
  translation,
  type BoundingBox,
  type EmbroideryFont,
  type Layer,
  type Point,
  type ShapeGeometry,
} from '@embroider-design/engine';
import { useDocumentStore, type ToolId } from '../state/document-store.js';
import { useFontStore } from '../state/font-store.js';
import { hitTestOutline, layerOutline, oppositeHandle, outlineBounds } from './geometry.js';
import {
  DARK_THEME,
  drawGhost,
  drawHoop,
  drawLayer,
  drawSelection,
  HANDLE_SIZE,
  toDocument,
  toScreen,
} from './render.js';

/**
 * The editing surface.
 *
 * Everything is drawn from the layers' own geometry — including text, which
 * comes straight from the font outlines rather than from compiled stitches, so
 * typing updates the canvas immediately instead of waiting on a digitize pass.
 */

type DragMode =
  | { kind: 'none' }
  | { kind: 'pan'; startX: number; startY: number; panX: number; panY: number }
  | { kind: 'move'; layerId: string; last: Point }
  | { kind: 'scale'; layerId: string; handle: number; bounds: BoundingBox }
  | { kind: 'draw'; start: Point; current: Point }
  | { kind: 'freehand'; points: Point[] };

const CLICK_TOLERANCE_PX = 6;
const IDENTITY_MATRIX = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function DesignCanvas(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragMode>({ kind: 'none' });
  const [, forceRender] = useState(0);

  const document = useDocumentStore((state) => state.document);
  const view = useDocumentStore((state) => state.view);
  const tool = useDocumentStore((state) => state.tool);
  const showGrid = useDocumentStore((state) => state.showGrid);
  const selectedLayerId = useDocumentStore((state) => state.selectedLayerId);
  const store = useDocumentStore;

  const loadedFonts = useFontStore((state) => state.loaded);
  const entryFor = useFontStore((state) => state.entryFor);
  const catalog = useFontStore((state) => state.catalog);

  const fontForLayer = useCallback(
    (layer: Layer): EmbroideryFont | null => {
      if (layer.kind !== 'text') return null;
      const entry = entryFor(layer.font);
      return entry ? (loadedFonts.get(entry.path) ?? null) : null;
    },
    [entryFor, loadedFonts],
  );

  const boundsOf = useCallback(
    (layer: Layer): BoundingBox | null => outlineBounds(layerOutline(layer, fontForLayer(layer))),
    [fontForLayer],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ratio = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = DARK_THEME.background;
    context.fillRect(0, 0, width, height);

    drawHoop(context, view, document, DARK_THEME, showGrid);

    for (const layer of document.layers) {
      if (!layer.visible) continue;
      drawLayer(context, view, layer, layer.id === selectedLayerId, fontForLayer(layer));
    }

    const selected = document.layers.find((layer) => layer.id === selectedLayerId);
    if (selected) {
      const bounds = boundsOf(selected);
      if (bounds) drawSelection(context, view, bounds, DARK_THEME);
    }

    const drag = dragRef.current;
    if (drag.kind === 'draw') {
      drawGhost(context, view, ghostPoints(tool, drag.start, drag.current), true, DARK_THEME);
    } else if (drag.kind === 'freehand') {
      drawGhost(context, view, drag.points, false, DARK_THEME);
    }
  }, [document, view, showGrid, selectedLayerId, tool, fontForLayer, boundsOf]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = (): void => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  // Fit the hoop once the canvas first has a size.
  const fitted = useRef(false);
  useEffect(() => {
    const container = containerRef.current;
    if (fitted.current || !container || container.clientWidth === 0) return;
    fitted.current = true;
    store.getState().fitToHoop(container.clientWidth, container.clientHeight);
  });

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handleAt = (screen: Point, bounds: BoundingBox): number => {
    const corners: Point[] = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
    ];
    for (let i = 0; i < corners.length; i++) {
      const p = toScreen(view, corners[i]);
      if (Math.abs(p.x - screen.x) <= HANDLE_SIZE && Math.abs(p.y - screen.y) <= HANDLE_SIZE) {
        return i;
      }
    }
    return -1;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const screen = pointerPosition(event);
    const point = toDocument(view, screen.x, screen.y);

    // Middle button or shift-drag pans, whatever tool is active.
    if (event.button === 1 || event.shiftKey) {
      dragRef.current = {
        kind: 'pan',
        startX: screen.x,
        startY: screen.y,
        panX: view.panX,
        panY: view.panY,
      };
      return;
    }
    if (event.button !== 0) return;

    if (tool === 'select') {
      const selected = document.layers.find((layer) => layer.id === selectedLayerId);
      if (selected && !selected.locked) {
        const bounds = boundsOf(selected);
        if (bounds) {
          const handle = handleAt(screen, bounds);
          if (handle >= 0) {
            dragRef.current = { kind: 'scale', layerId: selected.id, handle, bounds };
            return;
          }
        }
      }

      // Topmost first, matching what is drawn on top.
      const tolerance = CLICK_TOLERANCE_PX / view.zoom;
      for (let i = document.layers.length - 1; i >= 0; i--) {
        const layer = document.layers[i];
        if (!layer.visible || layer.locked) continue;
        if (!hitTestOutline(layerOutline(layer, fontForLayer(layer)), point, tolerance)) continue;
        store.getState().selectLayer(layer.id);
        dragRef.current = { kind: 'move', layerId: layer.id, last: point };
        return;
      }
      store.getState().selectLayer(null);
      return;
    }

    if (tool === 'text') {
      const entry = catalog[0] ?? null;
      const layer = createTextLayer(
        'Text',
        entry
          ? { path: entry.path, family: entry.family, subfamily: entry.subfamily }
          : { family: 'Arial' },
        mmToUnits(14),
        { index: document.layers.length, origin: point },
      );
      store.getState().addLayer(layer);
      store.getState().setTool('select');
      return;
    }

    if (tool === 'freehand') {
      dragRef.current = { kind: 'freehand', points: [point] };
      return;
    }

    dragRef.current = { kind: 'draw', start: point, current: point };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const drag = dragRef.current;
    if (drag.kind === 'none') return;
    const screen = pointerPosition(event);
    const point = toDocument(view, screen.x, screen.y);

    switch (drag.kind) {
      case 'pan':
        store.getState().setView({
          panX: drag.panX + (screen.x - drag.startX),
          panY: drag.panY + (screen.y - drag.startY),
        });
        return;
      case 'move': {
        const dx = point.x - drag.last.x;
        const dy = point.y - drag.last.y;
        drag.last = point;
        store.getState().updateLayer(drag.layerId, (layer) => ({
          ...layer,
          transform: compose(layer.transform, translation(dx, dy)),
        }));
        return;
      }
      case 'scale': {
        const pivot = oppositeHandle(drag.bounds, drag.handle);
        const startWidth = drag.bounds.maxX - drag.bounds.minX;
        const startHeight = drag.bounds.maxY - drag.bounds.minY;
        if (startWidth < 1e-6 || startHeight < 1e-6) return;
        const scaleX = Math.abs(point.x - pivot.x) / startWidth;
        const scaleY = Math.abs(point.y - pivot.y) / startHeight;
        // Uniform unless Alt is held: squashing a satin column is rarely wanted.
        const uniform = Math.max(scaleX, scaleY);
        const factorX = clampScale(event.altKey ? scaleX : uniform);
        const factorY = clampScale(event.altKey ? scaleY : uniform);
        store.getState().updateLayer(drag.layerId, (layer) => ({
          ...layer,
          transform: compose(layer.transform, scaleAround(factorX, factorY, pivot)),
        }));
        // The transform has been applied, so measure the next move from here.
        const updated = store.getState().document.layers.find((l) => l.id === drag.layerId);
        const next = updated ? boundsOf(updated) : null;
        if (next) drag.bounds = next;
        return;
      }
      case 'draw':
        drag.current = point;
        forceRender((n) => n + 1);
        return;
      case 'freehand': {
        const last = drag.points[drag.points.length - 1];
        // Thin the input: raw pointer events produce far more points than a
        // stitch path can use, and they only make simplification work harder.
        if (Math.hypot(point.x - last.x, point.y - last.y) > mmToUnits(0.5)) {
          drag.points.push(point);
          forceRender((n) => n + 1);
        }
        return;
      }
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const drag = dragRef.current;
    dragRef.current = { kind: 'none' };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag.kind === 'draw') {
      const geometry = shapeFromDrag(tool, drag.start, drag.current);
      if (geometry) {
        store.getState().addShape(geometry);
        store.getState().setTool('select');
      }
    } else if (drag.kind === 'freehand' && drag.points.length >= 2) {
      store.getState().addShape(polyline(drag.points, false));
      store.getState().setTool('select');
    }
    forceRender((n) => n + 1);
  };

  const onWheel = (event: React.WheelEvent<HTMLCanvasElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    store
      .getState()
      .zoomBy(
        event.deltaY < 0 ? 1.12 : 1 / 1.12,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
  };

  return (
    <div className="canvas-host" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className={`design-canvas tool-${tool}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />
    </div>
  );
}

function clampScale(value: number): number {
  return Math.max(0.02, Math.min(50, value));
}

function ghostPoints(tool: ToolId, start: Point, current: Point): Point[] {
  const geometry = shapeFromDrag(tool, start, current);
  if (!geometry) return [start, current];
  if (geometry.type === 'polyline') return geometry.points;
  const outline = layerOutline({
    kind: 'shape',
    geometry,
    transform: IDENTITY_MATRIX,
  } as Layer);
  return outline.rings[0] ?? [start, current];
}

function shapeFromDrag(tool: ToolId, start: Point, current: Point): ShapeGeometry | null {
  const minX = Math.min(start.x, current.x);
  const minY = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  const radius = Math.max(width, height) / 2;

  switch (tool) {
    case 'rectangle':
      return width > 1 && height > 1 ? rectangle(minX, minY, width, height) : null;
    case 'ellipse':
      return width > 1 && height > 1
        ? ellipse(minX + width / 2, minY + height / 2, width / 2, height / 2)
        : null;
    case 'polygon':
      return radius > 1 ? regularPolygon(minX + width / 2, minY + height / 2, radius, 6) : null;
    case 'star':
      return radius > 1
        ? star(minX + width / 2, minY + height / 2, radius, radius * 0.45, 5)
        : null;
    case 'line':
      return Math.hypot(width, height) > 1 ? polyline([start, current], false) : null;
    default:
      return null;
  }
}
