import { create } from 'zustand';
import {
  addLayer as addLayerTo,
  assignGroup,
  clearGroup,
  compose,
  createDesignDocument,
  createLayerId,
  createShapeLayer,
  DEFAULT_HOOP,
  documentBounds,
  duplicateLayer as duplicateLayerIn,
  expandSelectionToGroups,
  findLayer,
  gatherGroup,
  hoopSizeUnits,
  moveLayer as moveLayerIn,
  removeLayer as removeLayerFrom,
  scaleAround,
  translation,
  updateLayer as updateLayerIn,
  type DesignDocument,
  type HoopOrientation,
  type HoopPreset,
  type Layer,
  type PartialStitchSettings,
  type Point,
  type ShapeGeometry,
} from '@embroider-design/engine';

/**
 * Editor state.
 *
 * The document itself is immutable — every action swaps in a new one — so the
 * compile hook can decide whether to re-digitize by comparing one reference.
 * Digitizing a design is expensive enough that this matters: without it, every
 * mouse move while dragging would re-run the whole stitch pipeline.
 */

export type ToolId =
  | 'select'
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | 'line'
  | 'freehand'
  | 'text'
  | 'library';

/** How a click combines with what is already selected. */
export interface SelectOptions {
  /** Ctrl/Cmd-click: toggle this layer in or out. */
  additive?: boolean;
  /** Shift-click: extend from the primary selection through this layer. */
  range?: boolean;
}

export interface ViewTransform {
  /** Screen pixels per design unit. */
  zoom: number;
  panX: number;
  panY: number;
}

interface DocumentState {
  document: DesignDocument;
  filePath: string | null;
  dirty: boolean;
  /**
   * Everything selected, in stack order.
   *
   * `selectedLayerId` below is kept in step as the *primary* selection — the
   * first entry. The properties and text panels edit one layer at a time and
   * read that, so multi-select did not have to churn through them.
   */
  selectedLayerIds: string[];
  selectedLayerId: string | null;
  /** The shape armed in the Shapes panel, placed by the next canvas click. */
  pendingShapeId: string | null;
  tool: ToolId;
  view: ViewTransform;
  showPreview: boolean;
  showGrid: boolean;

  setDocument(next: DesignDocument, options?: { dirty?: boolean }): void;
  replaceDocument(next: DesignDocument, filePath: string | null): void;
  newDocument(): void;
  markSaved(filePath: string): void;

  addLayer(layer: Layer, select?: boolean): void;
  addLayers(layers: readonly Layer[], select?: boolean): void;
  /** Swaps layers out for the result of a shape operation, in their place. */
  replaceLayersWith(layerIds: readonly string[], replacements: readonly Layer[]): void;
  addShape(geometry: ShapeGeometry): void;
  updateLayer(layerId: string, update: Partial<Layer> | ((layer: Layer) => Layer)): void;
  updateLayerSettings(layerId: string, settings: PartialStitchSettings): void;
  removeLayer(layerId: string): void;
  duplicateLayer(layerId: string): void;
  moveLayer(layerId: string, offset: number): void;
  selectLayer(layerId: string | null, options?: SelectOptions): void;
  selectLayers(layerIds: readonly string[]): void;
  selectAll(): void;
  clearSelection(): void;
  selectedLayer(): Layer | null;
  selectedLayers(): Layer[];

  groupSelection(): void;
  ungroupSelection(): void;
  removeSelection(): void;
  duplicateSelection(): void;
  moveSelectionBy(dx: number, dy: number): void;
  scaleSelectionAround(factorX: number, factorY: number, pivot: Point): void;

  setPendingShape(shapeId: string | null): void;
  setTool(tool: ToolId): void;
  setHoop(hoop: HoopPreset, orientation?: HoopOrientation): void;
  setDocumentSettings(settings: PartialStitchSettings): void;
  setName(name: string): void;

  setView(view: Partial<ViewTransform>): void;
  zoomBy(factor: number, centerX?: number, centerY?: number): void;
  fitToHoop(viewportWidth: number, viewportHeight: number): void;
  togglePreview(): void;
  toggleGrid(): void;
}

const INITIAL_ZOOM = 0.35;

/** Keeps the primary selection and the selection list from ever disagreeing. */
function selection(ids: readonly string[]): {
  selectedLayerIds: string[];
  selectedLayerId: string | null;
} {
  return { selectedLayerIds: [...ids], selectedLayerId: ids[0] ?? null };
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  document: createDesignDocument(),
  filePath: null,
  dirty: false,
  selectedLayerIds: [],
  selectedLayerId: null,
  pendingShapeId: null,
  tool: 'select',
  view: { zoom: INITIAL_ZOOM, panX: 40, panY: 40 },
  showPreview: false,
  showGrid: true,

  setDocument: (next, options) => {
    set({ document: next, dirty: options?.dirty ?? true });
  },

  replaceDocument: (next, filePath) => {
    set({
      document: next,
      filePath,
      dirty: false,
      ...selection(next.layers[0] ? [next.layers[0].id] : []),
    });
  },

  newDocument: () => {
    set({
      document: createDesignDocument({ hoop: get().document.hoop }),
      filePath: null,
      dirty: false,
      ...selection([]),
    });
  },

  markSaved: (filePath) => {
    set({ filePath, dirty: false });
  },

  addLayer: (layer, select = true) => {
    set((state) => ({
      document: addLayerTo(state.document, layer),
      dirty: true,
      ...(select ? selection([layer.id]) : {}),
    }));
  },

  addLayers: (layers, select = true) => {
    set((state) => {
      let document = state.document;
      for (const layer of layers) document = addLayerTo(document, layer);
      return {
        document,
        dirty: true,
        ...(select ? selection(layers.map((layer) => layer.id)) : {}),
      };
    });
  },

  /**
   * The result of a boolean lands where its inputs were.
   *
   * Appending it instead would put a welded shape on top of the stack, and in
   * embroidery the stack is the sewing order — a shape that was sewn first
   * before the operation would suddenly be sewn last, on top of everything it
   * used to sit under.
   */
  replaceLayersWith: (layerIds, replacements) => {
    set((state) => {
      const doomed = new Set(layerIds);
      if (doomed.size === 0 || replacements.length === 0) return {};
      const index = state.document.layers.findIndex((layer) => doomed.has(layer.id));
      if (index < 0) return {};

      const kept = state.document.layers.filter((layer) => !doomed.has(layer.id));
      // Count how many survivors sat below the topmost removed layer; the
      // replacement belongs at that depth.
      const below = state.document.layers
        .slice(0, index)
        .filter((layer) => !doomed.has(layer.id)).length;
      const layers = [...kept.slice(0, below), ...replacements, ...kept.slice(below)];

      return {
        document: { ...state.document, layers, modifiedAt: new Date().toISOString() },
        dirty: true,
        ...selection(replacements.map((layer) => layer.id)),
      };
    });
  },

  addShape: (geometry) => {
    const state = get();
    const layer = createShapeLayer(geometry, { index: state.document.layers.length });
    state.addLayer(layer);
  },

  updateLayer: (layerId, update) => {
    set((state) => ({ document: updateLayerIn(state.document, layerId, update), dirty: true }));
  },

  updateLayerSettings: (layerId, settings) => {
    set((state) => ({
      document: updateLayerIn(state.document, layerId, (layer) => ({
        ...layer,
        settings: {
          ...layer.settings,
          ...settings,
          underlay: { ...layer.settings.underlay, ...settings.underlay },
        },
      })),
      dirty: true,
    }));
  },

  removeLayer: (layerId) => {
    set((state) => ({
      document: removeLayerFrom(state.document, layerId),
      dirty: true,
      ...selection(state.selectedLayerIds.filter((id) => id !== layerId)),
    }));
  },

  duplicateLayer: (layerId) => {
    set((state) => {
      const next = duplicateLayerIn(state.document, layerId);
      const index = next.layers.findIndex((layer) => layer.id === layerId);
      const copy = next.layers[index + 1];
      return {
        document: next,
        dirty: true,
        ...(copy ? selection([copy.id]) : {}),
      };
    });
  },

  moveLayer: (layerId, offset) => {
    set((state) => ({ document: moveLayerIn(state.document, layerId, offset), dirty: true }));
  },

  selectLayer: (layerId, options = {}) => {
    set((state) => {
      if (!layerId) return selection([]);
      const order = state.document.layers.map((layer) => layer.id);

      if (options.range && state.selectedLayerId) {
        const from = order.indexOf(state.selectedLayerId);
        const to = order.indexOf(layerId);
        if (from >= 0 && to >= 0) {
          const [lo, hi] = from <= to ? [from, to] : [to, from];
          return selection(
            expandSelectionToGroups(state.document, order.slice(lo, hi + 1)),
          );
        }
      }

      if (options.additive) {
        const current = new Set(state.selectedLayerIds);
        // Toggling any member of a group toggles the whole group with it.
        const affected = expandSelectionToGroups(state.document, [layerId]);
        const removing = current.has(layerId);
        for (const id of affected) {
          if (removing) current.delete(id);
          else current.add(id);
        }
        return selection(order.filter((id) => current.has(id)));
      }

      return selection(expandSelectionToGroups(state.document, [layerId]));
    });
  },

  selectLayers: (layerIds) => {
    set((state) => {
      const wanted = new Set(expandSelectionToGroups(state.document, layerIds));
      return selection(
        state.document.layers.map((layer) => layer.id).filter((id) => wanted.has(id)),
      );
    });
  },

  selectAll: () => {
    set((state) => selection(state.document.layers.map((layer) => layer.id)));
  },

  clearSelection: () => {
    set(selection([]));
  },

  selectedLayer: () => {
    const { document, selectedLayerId } = get();
    return selectedLayerId ? findLayer(document, selectedLayerId) : null;
  },

  selectedLayers: () => {
    const { document, selectedLayerIds } = get();
    const ids = new Set(selectedLayerIds);
    return document.layers.filter((layer) => ids.has(layer.id));
  },

  groupSelection: () => {
    set((state) => {
      if (state.selectedLayerIds.length < 2) return {};
      const groupId = createLayerId('group');
      const grouped = assignGroup(state.document, state.selectedLayerIds, groupId);
      // Bring the members together so nothing else sews between them.
      const document = gatherGroup(grouped, groupId);
      return {
        document,
        dirty: true,
        ...selection(
          document.layers.filter((layer) => layer.groupId === groupId).map((layer) => layer.id),
        ),
      };
    });
  },

  ungroupSelection: () => {
    set((state) => {
      if (state.selectedLayerIds.length === 0) return {};
      return { document: clearGroup(state.document, state.selectedLayerIds), dirty: true };
    });
  },

  removeSelection: () => {
    set((state) => {
      let document = state.document;
      for (const id of state.selectedLayerIds) document = removeLayerFrom(document, id);
      return { document, dirty: true, ...selection([]) };
    });
  },

  duplicateSelection: () => {
    set((state) => {
      let document = state.document;
      const copies: string[] = [];
      for (const id of state.selectedLayerIds) {
        const before = document.layers.length;
        document = duplicateLayerIn(document, id);
        if (document.layers.length > before) {
          const index = document.layers.findIndex((layer) => layer.id === id);
          const copy = document.layers[index + 1];
          if (copy) copies.push(copy.id);
        }
      }
      return { document, dirty: true, ...(copies.length > 0 ? selection(copies) : {}) };
    });
  },

  moveSelectionBy: (dx, dy) => {
    set((state) => {
      if (state.selectedLayerIds.length === 0 || (dx === 0 && dy === 0)) return {};
      const ids = new Set(state.selectedLayerIds);
      let document = state.document;
      for (const id of ids) {
        const layer = findLayer(document, id);
        if (!layer || layer.locked) continue;
        document = updateLayerIn(document, id, (current) => ({
          ...current,
          transform: compose(current.transform, translation(dx, dy)),
        }));
      }
      return { document, dirty: true };
    });
  },

  scaleSelectionAround: (factorX, factorY, pivot) => {
    set((state) => {
      if (state.selectedLayerIds.length === 0) return {};
      // One matrix for the whole selection, so a group keeps its proportions
      // and its parts keep their positions relative to each other.
      const matrix = scaleAround(factorX, factorY, pivot);
      let document = state.document;
      for (const id of state.selectedLayerIds) {
        const layer = findLayer(document, id);
        if (!layer || layer.locked) continue;
        document = updateLayerIn(document, id, (current) => ({
          ...current,
          transform: compose(current.transform, matrix),
        }));
      }
      return { document, dirty: true };
    });
  },

  setPendingShape: (shapeId) => {
    set({ pendingShapeId: shapeId, tool: shapeId ? 'library' : 'select' });
  },

  setTool: (tool) => {
    set((state) => ({
      tool,
      // Leaving the library tool disarms whatever was queued for placement.
      pendingShapeId: tool === 'library' ? state.pendingShapeId : null,
    }));
  },

  setHoop: (hoop, orientation) => {
    set((state) => ({
      document: {
        ...state.document,
        hoop,
        hoopOrientation: orientation ?? state.document.hoopOrientation,
        modifiedAt: new Date().toISOString(),
      },
      dirty: true,
    }));
  },

  setDocumentSettings: (settings) => {
    set((state) => ({
      document: {
        ...state.document,
        settings: {
          ...state.document.settings,
          ...settings,
          underlay: { ...state.document.settings.underlay, ...settings.underlay },
        },
        modifiedAt: new Date().toISOString(),
      },
      dirty: true,
    }));
  },

  setName: (name) => {
    set((state) => ({ document: { ...state.document, name }, dirty: true }));
  },

  setView: (view) => {
    set((state) => ({ view: { ...state.view, ...view } }));
  },

  zoomBy: (factor, centerX, centerY) => {
    set((state) => {
      const zoom = Math.max(0.05, Math.min(8, state.view.zoom * factor));
      if (centerX === undefined || centerY === undefined) return { view: { ...state.view, zoom } };
      // Keep the point under the cursor fixed while zooming.
      const scale = zoom / state.view.zoom;
      return {
        view: {
          zoom,
          panX: centerX - (centerX - state.view.panX) * scale,
          panY: centerY - (centerY - state.view.panY) * scale,
        },
      };
    });
  },

  fitToHoop: (viewportWidth, viewportHeight) => {
    const state = get();
    const size = hoopSizeUnits(state.document.hoop, state.document.hoopOrientation);
    const margin = 48;
    const zoom = Math.max(
      0.05,
      Math.min(
        (viewportWidth - margin * 2) / size.width,
        (viewportHeight - margin * 2) / size.height,
      ),
    );
    set({
      view: {
        zoom,
        panX: (viewportWidth - size.width * zoom) / 2,
        panY: (viewportHeight - size.height * zoom) / 2,
      },
    });
  },

  togglePreview: () => {
    set((state) => ({ showPreview: !state.showPreview }));
  },

  toggleGrid: () => {
    set((state) => ({ showGrid: !state.showGrid }));
  },
}));

export { DEFAULT_HOOP, documentBounds };
