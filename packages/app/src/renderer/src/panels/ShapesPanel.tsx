import { useEffect, useMemo, useRef, useState } from 'react';

import {
  allShapes,
  groupRingsIntoRegions,
  libraryShapeBounds,
  pathFromData,
  populatedCategories,
  regionToRings,
  searchShapeList,
  shapeToOpenPaths,
  shapeToRings,
  type CategoryId,
  type LibraryShape,
  type Point,
} from '@embroider-design/engine';
import { useDocumentStore } from '../state/document-store.js';
import { useCustomShapeStore } from '../state/custom-shape-store.js';

/**
 * The shape and icon library.
 *
 * Thumbnails are drawn from the same parsed path data that placement uses, so
 * a thumbnail can never show something different from what gets inserted.
 * That also means no image assets: 200 PNGs would have to be kept in step with
 * 200 path strings by hand, and they would drift.
 */

const THUMB_SIZE = 56;
const THUMB_PADDING = 5;

function drawShapeThumbnail(canvas: HTMLCanvasElement, shape: LibraryShape): void {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = THUMB_SIZE * ratio;
  canvas.height = THUMB_SIZE * ratio;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);

  const bounds = libraryShapeBounds(shape);
  if (!bounds) return;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width < 1e-6 || height < 1e-6) return;

  const scale = Math.min(
    (THUMB_SIZE - THUMB_PADDING * 2) / width,
    (THUMB_SIZE - THUMB_PADDING * 2) / height,
  );
  const offsetX = (THUMB_SIZE - width * scale) / 2 - bounds.minX * scale;
  const offsetY = (THUMB_SIZE - height * scale) / 2 - bounds.minY * scale;
  const project = (point: Point): Point => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY,
  });

  for (const part of shape.parts) {
    const geometry = pathFromData(part.d);
    const colour = part.color ?? '#8ba3c7';
    context.fillStyle = colour;
    // One path per filled region. Even-odd within a region is what makes a
    // counter-ring read as the hole it is rather than filling over the thing
    // it is cut out of; keeping regions apart is what stops two overlapping
    // rings of one part — the three circles of a cloud — from cancelling each
    // other out into a stencil.
    for (const region of groupRingsIntoRegions(shapeToRings(geometry))) {
      context.beginPath();
      for (const ring of regionToRings(region)) {
        ring.forEach((point, index) => {
          const p = project(point);
          if (index === 0) context.moveTo(p.x, p.y);
          else context.lineTo(p.x, p.y);
        });
        context.closePath();
      }
      context.fill('evenodd');
    }
    for (const path of shapeToOpenPaths(geometry)) {
      context.beginPath();
      path.forEach((point, index) => {
        const p = project(point);
        if (index === 0) context.moveTo(p.x, p.y);
        else context.lineTo(p.x, p.y);
      });
      context.strokeStyle = colour;
      context.lineWidth = 1.5;
      context.stroke();
    }
  }
}

function ShapeThumbnail({ shape }: { shape: LibraryShape }): JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) drawShapeThumbnail(ref.current, shape);
  }, [shape]);
  return (
    <canvas
      ref={ref}
      className="shape-thumb"
      style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
      aria-hidden="true"
    />
  );
}

export function ShapesPanel(): JSX.Element {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const pendingShapeId = useDocumentStore((state) => state.pendingShapeId);
  const setPendingShape = useDocumentStore((state) => state.setPendingShape);

  const customShapes = useCustomShapeStore((state) => state.shapes);
  const customLoaded = useCustomShapeStore((state) => state.loaded);
  const customError = useCustomShapeStore((state) => state.error);
  const loadCustom = useCustomShapeStore((state) => state.load);
  const removeCustom = useCustomShapeStore((state) => state.remove);
  const renameCustom = useCustomShapeStore((state) => state.rename);

  useEffect(() => {
    if (!customLoaded) void loadCustom();
  }, [customLoaded, loadCustom]);

  /**
   * The user's shapes sit at the front of the pool, so a search that matches
   * both finds theirs first — they named it, so they are looking for it.
   */
  const pool = useMemo(() => [...customShapes, ...allShapes()], [customShapes]);

  const results = useMemo(() => {
    if (query.trim()) {
      // A search spans everything: someone typing "pumpkin" while the Basic
      // category happens to be selected wants the pumpkin, not nothing.
      return searchShapeList(pool, query);
    }
    if (category === 'all') return pool;
    return pool.filter((shape) => shape.category === category);
  }, [query, category, pool]);

  // Categories that shipped empty are hidden, and "My shapes" only appears once
  // there is something in it — an empty chip is a dead end.
  const categories = useMemo(
    () =>
      populatedCategories().filter(
        (entry) => entry.id !== 'custom' || customShapes.length > 0,
      ),
    [customShapes.length],
  );

  const isCustom = (shape: LibraryShape): boolean => shape.category === 'custom';

  return (
    <div className="panel shapes-panel">
      <input
        type="search"
        className="shape-search"
        placeholder={`Search ${pool.length} shapes and icons…`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search shapes"
      />

      {!query.trim() && (
        <div className="shape-categories">
          <button
            type="button"
            className={category === 'all' ? 'chip chip-active' : 'chip'}
            onClick={() => setCategory('all')}
          >
            All
          </button>
          {categories.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={category === entry.id ? 'chip chip-active' : 'chip'}
              onClick={() => setCategory(entry.id)}
            >
              {entry.name}
            </button>
          ))}
        </div>
      )}

      {customError && <p className="warn small">{customError}</p>}

      {category === 'custom' && customShapes.length === 0 && (
        <p className="muted small">
          Nothing saved yet. Select shapes on the canvas, combine or hollow them in the Settings
          tab, then use “Save as a shape”.
        </p>
      )}

      {pendingShapeId && (
        <p className="hint hint-active">
          Click the canvas to place it, or drag to set its size.{' '}
          <button type="button" className="link" onClick={() => setPendingShape(null)}>
            Cancel
          </button>
        </p>
      )}

      {results.length === 0 ? (
        <p className="empty">Nothing matches “{query.trim()}”.</p>
      ) : (
        <div className="shape-grid">
          {results.map((shape) => (
            <div key={shape.id} className="shape-card-wrap">
              <button
                type="button"
                className={
                  pendingShapeId === shape.id ? 'shape-card shape-card-active' : 'shape-card'
                }
                title={`${shape.name}${shape.parts.length > 1 ? ` — ${shape.parts.length} parts` : ''}`}
                onClick={() => setPendingShape(pendingShapeId === shape.id ? null : shape.id)}
              >
                <ShapeThumbnail shape={shape} />
                <span className="shape-name">{shape.name}</span>
                {shape.parts.length > 1 && (
                  <span className="shape-parts" title="Placed as a group you can move as one">
                    {shape.parts.length}
                  </span>
                )}
              </button>
              {isCustom(shape) && (
                <span className="shape-card-tools">
                  <button
                    type="button"
                    className="link"
                    title="Rename this shape"
                    onClick={() => {
                      const next = window.prompt('Rename this shape', shape.name);
                      if (next !== null) void renameCustom(shape.id, next);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="link"
                    title="Delete this shape from your library"
                    onClick={() => {
                      // Designs that already used it keep their own copy of the
                      // geometry, so this only removes it from the library.
                      if (window.confirm(`Delete “${shape.name}” from your shapes?`)) {
                        void removeCustom(shape.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="hint">
        Multi-part icons arrive as a group with their colours already set — move it as one, or
        press Ctrl+Shift+G to split it apart.
      </p>
    </div>
  );
}
