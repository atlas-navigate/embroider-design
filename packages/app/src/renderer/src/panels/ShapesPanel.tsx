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
 *
 * Removing something means two different things here and the panel keeps them
 * apart. A shape the user made can genuinely be deleted. A shipped icon cannot
 * — `CATALOGUE` is compiled into the bundle — so it is hidden, the word the UI
 * uses, with the way back always on screen.
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

/**
 * What the grid is showing.
 *
 * A collection is not a `CategoryId` and cannot become one — the union is
 * closed and `CATEGORIES` drives it — so the two kinds of grouping are
 * different cases here rather than one widened id.
 */
type Selection =
  | { kind: 'all' }
  | { kind: 'category'; id: CategoryId }
  | { kind: 'collection'; name: string };

function sameSelection(a: Selection, b: Selection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'category' && b.kind === 'category') return a.id === b.id;
  if (a.kind === 'collection' && b.kind === 'collection') return a.name === b.name;
  return true;
}

const isCustom = (shape: LibraryShape): boolean => shape.category === 'custom';

export function ShapesPanel(): JSX.Element {
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Selection>({ kind: 'all' });
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const pendingShapeId = useDocumentStore((state) => state.pendingShapeId);
  const setPendingShape = useDocumentStore((state) => state.setPendingShape);

  const customShapes = useCustomShapeStore((state) => state.shapes);
  const hidden = useCustomShapeStore((state) => state.hidden);
  const customLoaded = useCustomShapeStore((state) => state.loaded);
  const customError = useCustomShapeStore((state) => state.error);
  const loadCustom = useCustomShapeStore((state) => state.load);
  const removeCustom = useCustomShapeStore((state) => state.remove);
  const removeMany = useCustomShapeStore((state) => state.removeMany);
  const renameCustom = useCustomShapeStore((state) => state.rename);
  const moveToCollection = useCustomShapeStore((state) => state.moveToCollection);
  const hide = useCustomShapeStore((state) => state.hide);
  const unhideAll = useCustomShapeStore((state) => state.unhideAll);

  useEffect(() => {
    if (!customLoaded) void loadCustom();
  }, [customLoaded, loadCustom]);

  /**
   * The user's shapes sit at the front of the pool, so a search that matches
   * both finds theirs first — they named it, so they are looking for it.
   *
   * Hiding applies to the shipped catalogue only. A saved shape has a real
   * delete, and offering two ways to make one disappear would leave the user
   * guessing which of them they used.
   */
  const pool = useMemo(
    () => [...customShapes, ...allShapes().filter((shape) => !hidden.has(shape.id))],
    [customShapes, hidden],
  );

  const collections = useMemo(() => {
    const names = new Set<string>();
    for (const shape of customShapes) if (shape.collection) names.add(shape.collection);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [customShapes]);

  const looseCustomCount = useMemo(
    () => customShapes.filter((shape) => !shape.collection).length,
    [customShapes],
  );

  const results = useMemo(() => {
    if (query.trim()) {
      // A search spans everything: someone typing "pumpkin" while the Basic
      // category happens to be selected wants the pumpkin, not nothing.
      return searchShapeList(pool, query);
    }
    if (selection.kind === 'all') return pool;
    if (selection.kind === 'collection') {
      return pool.filter((shape) => shape.collection === selection.name);
    }
    if (selection.id === 'custom') {
      return pool.filter((shape) => isCustom(shape) && !shape.collection);
    }
    return pool.filter((shape) => shape.category === selection.id);
  }, [query, selection, pool]);

  /**
   * Shipped categories that still have something in them.
   *
   * Counted over the pool rather than taken from `populatedCategories()` alone,
   * because that is computed once over `CATALOGUE` and knows nothing about
   * hiding — hide every pumpkin and the Halloween chip would still be there,
   * leading to an empty grid.
   */
  const categories = useMemo(() => {
    const counts = new Map<CategoryId, number>();
    for (const shape of pool) counts.set(shape.category, (counts.get(shape.category) ?? 0) + 1);
    return populatedCategories().filter(
      (entry) => entry.id !== 'custom' && (counts.get(entry.id) ?? 0) > 0,
    );
  }, [pool]);

  const pickedShapes = useMemo(
    () => pool.filter((shape) => picked.has(shape.id)),
    [pool, picked],
  );
  const pickedCustom = pickedShapes.filter(isCustom);
  const pickedShipped = pickedShapes.filter((shape) => !isCustom(shape));

  const stopSelecting = (): void => {
    setSelecting(false);
    setPicked(new Set());
  };

  const toggle = (id: string): void =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deletePicked = (): void => {
    if (pickedCustom.length === 0) return;
    if (
      !window.confirm(
        `Delete ${pickedCustom.length} shape${pickedCustom.length === 1 ? '' : 's'} from your library?\n\n` +
          'This cannot be undone. Designs that already used them keep their own copy of the ' +
          'geometry and are not affected.',
      )
    ) {
      return;
    }
    void removeMany(pickedCustom.map((shape) => shape.id));
    stopSelecting();
  };

  const hidePicked = (): void => {
    if (pickedShipped.length === 0) return;
    void hide(pickedShipped.map((shape) => shape.id));
    stopSelecting();
  };

  const movePicked = (): void => {
    if (pickedCustom.length === 0) return;
    const answer = window.prompt(
      `Move ${pickedCustom.length} shape${pickedCustom.length === 1 ? '' : 's'} to which collection?\n` +
        'Leave it empty to take them out of any collection.',
      pickedCustom[0].collection ?? '',
    );
    if (answer === null) return;
    void moveToCollection(pickedCustom.map((shape) => shape.id), answer.trim() || null);
    stopSelecting();
  };

  const deleteCollection = (name: string): void => {
    const doomed = customShapes.filter((shape) => shape.collection === name);
    if (doomed.length === 0) return;
    if (
      !window.confirm(
        `Delete all ${doomed.length} shape${doomed.length === 1 ? '' : 's'} in “${name}”?\n\n` +
          'This cannot be undone. Designs that already used them keep their own copy of the ' +
          'geometry and are not affected.',
      )
    ) {
      return;
    }
    void removeMany(doomed.map((shape) => shape.id));
    setSelection({ kind: 'all' });
  };

  const chip = (label: string, value: Selection, key: string): JSX.Element => (
    <button
      key={key}
      type="button"
      className={sameSelection(selection, value) ? 'chip chip-active' : 'chip'}
      onClick={() => setSelection(value)}
    >
      {label}
    </button>
  );

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
          {chip('All', { kind: 'all' }, 'all')}
          {categories.map((entry) => chip(entry.name, { kind: 'category', id: entry.id }, entry.id))}
          {collections.map((name) =>
            chip(name, { kind: 'collection', name }, `collection:${name}`),
          )}
          {looseCustomCount > 0 &&
            chip('My shapes', { kind: 'category', id: 'custom' }, 'custom')}
        </div>
      )}

      {customError && <p className="warn small">{customError}</p>}

      {selection.kind === 'collection' && !query.trim() && (
        <p className="muted small">
          {results.length} in “{selection.name}”.{' '}
          <button
            type="button"
            className="link"
            onClick={() => deleteCollection(selection.name)}
          >
            Delete this collection
          </button>
        </p>
      )}

      {selection.kind === 'category' &&
        selection.id === 'custom' &&
        looseCustomCount === 0 && (
          <p className="muted small">
            Nothing saved yet. Select shapes on the canvas and use “Save as a shape”, or import a
            sheet of icons from the Image tab.
          </p>
        )}

      {pendingShapeId && !selecting && (
        <p className="hint hint-active">
          Click the canvas to place it, or drag to set its size.{' '}
          <button type="button" className="link" onClick={() => setPendingShape(null)}>
            Cancel
          </button>
        </p>
      )}

      {selecting ? (
        <div className="selection-bar">
          <span>
            {picked.size} selected
            {pickedShipped.length > 0 && pickedCustom.length > 0 && (
              <span className="muted"> ({pickedCustom.length} saved)</span>
            )}
          </span>
          {pickedCustom.length > 0 && (
            <>
              <button type="button" className="link" onClick={deletePicked}>
                Delete {pickedCustom.length}
              </button>
              <button type="button" className="link" onClick={movePicked}>
                Move to…
              </button>
            </>
          )}
          {pickedShipped.length > 0 && (
            <button type="button" className="link" onClick={hidePicked}>
              Hide {pickedShipped.length}
            </button>
          )}
          <button type="button" className="link" onClick={stopSelecting}>
            Cancel
          </button>
        </div>
      ) : (
        results.length > 0 && (
          <div className="selection-bar">
            <button
              type="button"
              className="link"
              onClick={() => {
                setSelecting(true);
                setPendingShape(null);
              }}
            >
              Select
            </button>
          </div>
        )
      )}

      {results.length === 0 ? (
        <p className="empty">
          {query.trim() ? `Nothing matches “${query.trim()}”.` : 'Nothing here.'}
        </p>
      ) : (
        <div className="shape-grid">
          {results.map((shape) => (
            <div key={shape.id} className="shape-card-wrap">
              <button
                type="button"
                className={
                  (selecting ? picked.has(shape.id) : pendingShapeId === shape.id)
                    ? 'shape-card shape-card-active'
                    : 'shape-card'
                }
                title={
                  selecting
                    ? shape.name
                    : `${shape.name}${shape.parts.length > 1 ? ` — ${shape.parts.length} parts` : ''}`
                }
                aria-pressed={selecting ? picked.has(shape.id) : undefined}
                onClick={() =>
                  selecting
                    ? toggle(shape.id)
                    : setPendingShape(pendingShapeId === shape.id ? null : shape.id)
                }
              >
                <ShapeThumbnail shape={shape} />
                <span className="shape-name">{shape.name}</span>
                {shape.parts.length > 1 && (
                  <span className="shape-parts" title="Placed as a group you can move as one">
                    {shape.parts.length}
                  </span>
                )}
              </button>
              {!selecting && (
                <span className="shape-card-tools">
                  {isCustom(shape) ? (
                    <>
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
                          // Designs that already used it keep their own copy of
                          // the geometry, so this only removes it from the
                          // library.
                          if (
                            window.confirm(
                              `Delete “${shape.name}” from your shapes?\n\n` +
                                'Designs that already used it are not affected.',
                            )
                          ) {
                            void removeCustom(shape.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="link"
                      title="Hidden icons stay installed and can be brought back"
                      onClick={() => void hide([shape.id])}
                    >
                      Hide
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {hidden.size > 0 && (
        <p className="muted small">
          {hidden.size} icon{hidden.size === 1 ? '' : 's'} hidden.{' '}
          <button type="button" className="link" onClick={() => void unhideAll()}>
            Show them again
          </button>
        </p>
      )}

      <p className="hint">
        Multi-part icons arrive as a group with their colours already set — move it as one, or
        press Ctrl+Shift+G to split it apart.
      </p>
    </div>
  );
}
