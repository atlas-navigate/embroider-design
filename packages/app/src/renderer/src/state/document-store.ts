import { create } from 'zustand';
import {
  addLayer as addLayerTo,
  createDesignDocument,
  createShapeLayer,
  DEFAULT_HOOP,
  documentBounds,
  duplicateLayer as duplicateLayerIn,
  findLayer,
  hoopSizeUnits,
  moveLayer as moveLayerIn,
  removeLayer as removeLayerFrom,
  updateLayer as updateLayerIn,
  type DesignDocument,
  type HoopOrientation,
  type HoopPreset,
  type Layer,
  type PartialStitchSettings,
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
  | 'text';

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
  selectedLayerId: string | null;
  tool: ToolId;
  view: ViewTransform;
  showPreview: boolean;
  showGrid: boolean;

  setDocument(next: DesignDocument, options?: { dirty?: boolean }): void;
  replaceDocument(next: DesignDocument, filePath: string | null): void;
  newDocument(): void;
  markSaved(filePath: string): void;

  addLayer(layer: Layer, select?: boolean): void;
  addShape(geometry: ShapeGeometry): void;
  updateLayer(layerId: string, update: Partial<Layer> | ((layer: Layer) => Layer)): void;
  updateLayerSettings(layerId: string, settings: PartialStitchSettings): void;
  removeLayer(layerId: string): void;
  duplicateLayer(layerId: string): void;
  moveLayer(layerId: string, offset: number): void;
  selectLayer(layerId: string | null): void;
  selectedLayer(): Layer | null;

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

export const useDocumentStore = create<DocumentState>((set, get) => ({
  document: createDesignDocument(),
  filePath: null,
  dirty: false,
  selectedLayerId: null,
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
      selectedLayerId: next.layers[0]?.id ?? null,
    });
  },

  newDocument: () => {
    set({
      document: createDesignDocument({ hoop: get().document.hoop }),
      filePath: null,
      dirty: false,
      selectedLayerId: null,
    });
  },

  markSaved: (filePath) => {
    set({ filePath, dirty: false });
  },

  addLayer: (layer, select = true) => {
    set((state) => ({
      document: addLayerTo(state.document, layer),
      dirty: true,
      selectedLayerId: select ? layer.id : state.selectedLayerId,
    }));
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
      selectedLayerId: state.selectedLayerId === layerId ? null : state.selectedLayerId,
    }));
  },

  duplicateLayer: (layerId) => {
    set((state) => {
      const next = duplicateLayerIn(state.document, layerId);
      const index = next.layers.findIndex((layer) => layer.id === layerId);
      return {
        document: next,
        dirty: true,
        selectedLayerId: next.layers[index + 1]?.id ?? state.selectedLayerId,
      };
    });
  },

  moveLayer: (layerId, offset) => {
    set((state) => ({ document: moveLayerIn(state.document, layerId, offset), dirty: true }));
  },

  selectLayer: (layerId) => {
    set({ selectedLayerId: layerId });
  },

  selectedLayer: () => {
    const { document, selectedLayerId } = get();
    return selectedLayerId ? findLayer(document, selectedLayerId) : null;
  },

  setTool: (tool) => {
    set({ tool });
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
