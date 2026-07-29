import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createStitchLayer,
  deserializeDocument,
  formatForExtension,
  readPattern,
  mmToUnits,
  serializeDocument,
  unitsToMm,
  type FormatId,
} from '@embroider-design/engine';
import type { MenuCommand } from '../../shared/ipc-contract.js';
import { useDocumentStore, type ToolId } from './state/document-store.js';
import { useFontStore } from './state/font-store.js';
import { useCompiledPattern } from './state/use-compiled-pattern.js';
import { DesignCanvas } from './canvas/DesignCanvas.js';
import { StitchPreview } from './canvas/StitchPreview.js';
import { LayerPanel } from './panels/LayerPanel.js';
import { PropertiesPanel } from './panels/PropertiesPanel.js';
import { ShapesPanel } from './panels/ShapesPanel.js';
import { ImageImportPanel } from './panels/ImageImportPanel.js';
import { HoopPanel } from './panels/HoopPanel.js';
import { ExportPanel } from './panels/ExportPanel.js';
import { UpdateBanner, updateStatusLabel, useUpdateState } from './components/UpdateBanner.js';

/**
 * The application shell.
 *
 * One compile result feeds the canvas, the layer list, the preview and the
 * export panel, so every number the user sees comes from the same pass that
 * writes the file. The tabs on the right are a deliberate choice over floating
 * palettes: on a laptop screen the canvas is the scarce resource.
 */

const TOOLS: { id: ToolId; label: string; title: string; key: string }[] = [
  { id: 'select', label: '↖', title: 'Select and move (V)', key: 'v' },
  { id: 'rectangle', label: '▭', title: 'Rectangle (R)', key: 'r' },
  { id: 'ellipse', label: '◯', title: 'Ellipse (E)', key: 'e' },
  { id: 'polygon', label: '⬡', title: 'Polygon (P)', key: 'p' },
  { id: 'star', label: '★', title: 'Star (S)', key: 's' },
  { id: 'line', label: '╱', title: 'Line (L)', key: 'l' },
  { id: 'freehand', label: '✎', title: 'Freehand (F)', key: 'f' },
  { id: 'text', label: 'T', title: 'Text (T)', key: 't' },
];

/** Arrow-key nudge directions, in document space (Y grows downwards). */
const NUDGE_KEYS: Record<string, { x: number; y: number } | undefined> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

type PanelTab = 'layers' | 'properties' | 'shapes' | 'image' | 'hoop' | 'export';

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'layers', label: 'Layers' },
  { id: 'properties', label: 'Settings' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'image', label: 'Image' },
  { id: 'hoop', label: 'Hoop' },
  { id: 'export', label: 'Export' },
];

export function App(): JSX.Element {
  const store = useDocumentStore;
  const documentName = useDocumentStore((state) => state.document.name);
  const dirty = useDocumentStore((state) => state.dirty);
  const showPreview = useDocumentStore((state) => state.showPreview);
  const tool = useDocumentStore((state) => state.tool);
  const setTool = useDocumentStore((state) => state.setTool);
  const view = useDocumentStore((state) => state.view);

  const scanFonts = useFontStore((state) => state.scan);
  const addFontFile = useFontStore((state) => state.addFontFile);

  const compile = useCompiledPattern();
  const update = useUpdateState();
  const [tab, setTab] = useState<PanelTab>('layers');
  const [status, setStatus] = useState<string | null>(null);

  // Menu commands arrive asynchronously, so the handler is kept in a ref and
  // the IPC subscription is made once. Re-subscribing on every render would
  // drop commands that land between the unsubscribe and the resubscribe.
  const commandRef = useRef<(command: MenuCommand) => void>(() => undefined);

  useEffect(() => {
    void scanFonts();
  }, [scanFonts]);

  useEffect(() => {
    window.embroider.setDocumentEdited(dirty, documentName || 'Untitled');
  }, [dirty, documentName]);

  const saveProject = useCallback(
    async (forcePrompt = false): Promise<boolean> => {
      const state = store.getState();
      const saved = await window.embroider.saveProject(
        {
          path: forcePrompt ? null : state.filePath,
          suggestedName: `${state.document.name || 'design'}.embd`,
        },
        serializeDocument(state.document),
      );
      if (!saved) return false;
      store.getState().markSaved(saved.path);
      setStatus(`Saved to ${saved.path}`);
      return true;
    },
    [store],
  );

  /** Returns false when the user cancels. */
  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    const state = store.getState();
    if (!state.dirty) return true;
    const answer = await window.embroider.confirmDiscard(state.document.name || 'Untitled');
    if (answer === 'cancel') return false;
    if (answer === 'discard') return true;
    return saveProject();
  }, [store, saveProject]);

  const openProject = useCallback(async (): Promise<void> => {
    if (!(await confirmDiscard())) return;
    const file = await window.embroider.openProject();
    if (!file) return;
    try {
      store.getState().replaceDocument(deserializeDocument(file.text), file.path);
      setStatus(`Opened ${file.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'That project could not be opened');
    }
  }, [confirmDiscard, store]);

  const openEmbroideryFile = useCallback(async (): Promise<void> => {
    const file = await window.embroider.openEmbroidery();
    if (!file) return;
    try {
      const format = formatForExtension(file.name);
      const pattern = readPattern(file.data, format?.id as FormatId | undefined);
      if (pattern.stitches.length === 0) {
        setStatus(`${file.name} contains no stitches`);
        return;
      }
      // Machine files sit around the origin; move it into the hoop so it is
      // visible instead of a quarter off the top-left corner.
      const state = store.getState();
      const layer = createStitchLayer(pattern.stitches, pattern.threads, {
        sourceFormat: format?.id,
        sourceName: file.name,
        name: file.name,
        index: state.document.layers.length,
      });
      state.addLayer(layer);
      const bounds = pattern.getBounds();
      state.updateLayer(layer.id, (current) => ({
        ...current,
        transform: {
          ...current.transform,
          e: current.transform.e - bounds.minX + 100,
          f: current.transform.f - bounds.minY + 100,
        },
      }));
      setStatus(
        `Imported ${pattern.stitches.length.toLocaleString()} stitches from ${file.name}` +
          ` (${unitsToMm(bounds.maxX - bounds.minX).toFixed(0)} x ` +
          `${unitsToMm(bounds.maxY - bounds.minY).toFixed(0)} mm)`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'That file could not be read');
    }
  }, [store]);

  commandRef.current = (command: MenuCommand): void => {
    const state = store.getState();
    switch (command) {
      case 'new':
        void confirmDiscard().then((ok) => {
          if (ok) store.getState().newDocument();
        });
        return;
      case 'open':
        void openProject();
        return;
      case 'save':
        void saveProject();
        return;
      case 'save-as':
        void saveProject(true);
        return;
      case 'import-image':
        setTab('image');
        return;
      case 'import-embroidery':
        void openEmbroideryFile();
        return;
      case 'add-font':
        void addFontFile();
        return;
      case 'export':
        setTab('export');
        return;
      case 'zoom-in':
        state.zoomBy(1.25);
        return;
      case 'zoom-out':
        state.zoomBy(1 / 1.25);
        return;
      case 'zoom-fit': {
        const host = window.document.querySelector('.canvas-host');
        if (host) state.fitToHoop(host.clientWidth, host.clientHeight);
        return;
      }
      case 'toggle-preview':
        state.togglePreview();
        return;
      case 'delete-layer':
        state.removeSelection();
        return;
      case 'duplicate-layer':
        state.duplicateSelection();
        return;
      case 'select-all':
        state.selectAll();
        return;
      case 'deselect':
        state.clearSelection();
        return;
      case 'group':
        state.groupSelection();
        return;
      case 'ungroup':
        state.ungroupSelection();
        return;
      case 'shapes':
        setTab('shapes');
        return;
      case 'check-for-updates':
        void window.embroider.checkForUpdates().then((result) => {
          setStatus(updateStatusLabel(result) ?? 'You are on the latest version.');
        });
        return;
      case 'about':
        void window.embroider.getVersion().then((version) => {
          setStatus(
            `Embroider Design ${version} — free embroidery CAD. Always test-stitch before you trust a design.`,
          );
        });
        return;
    }
  };

  useEffect(() => {
    const offMenu = window.embroider.onMenuCommand((command) => commandRef.current(command));
    const offClose = window.embroider.onCloseRequested(() => {
      void confirmDiscard().then((ok) => {
        if (ok) window.embroider.closeWindow();
      });
    });
    return () => {
      offMenu();
      offClose();
    };
  }, [confirmDiscard]);

  // Editing shortcuts, but never while typing into a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const state = store.getState();
      const control = event.ctrlKey || event.metaKey;

      // Ctrl combinations also arrive from the application menu's accelerators.
      // Handling them here as well keeps the shortcuts working when focus is
      // somewhere the menu does not reach, and both paths call the same action.
      if (control) {
        switch (event.key.toLowerCase()) {
          case 'a':
            if (event.shiftKey) state.clearSelection();
            else state.selectAll();
            event.preventDefault();
            return;
          case 'g':
            if (event.shiftKey) state.ungroupSelection();
            else state.groupSelection();
            event.preventDefault();
            return;
          default:
            return;
        }
      }
      if (event.altKey) return;

      if (event.key === 'Escape') {
        state.setTool('select');
        state.setPendingShape(null);
        state.clearSelection();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (state.selectedLayerIds.length > 0) {
          state.removeSelection();
          event.preventDefault();
        }
        return;
      }

      const nudge = NUDGE_KEYS[event.key];
      if (nudge) {
        if (state.selectedLayerIds.length === 0) return;
        // Shift nudges by a whole 5 mm; the plain step is 0.5 mm, which is
        // about the finest adjustment that survives being stitched.
        const step = mmToUnits(event.shiftKey ? 5 : 0.5);
        state.moveSelectionBy(nudge.x * step, nudge.y * step);
        event.preventDefault();
        return;
      }

      const match = TOOLS.find((entry) => entry.key === event.key.toLowerCase());
      if (match) state.setTool(match.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  const result = compile.result;

  return (
    <div className="app">
      <header className="toolbar">
        <div className="tool-group">
          {TOOLS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={tool === entry.id ? 'tool-button tool-active' : 'tool-button'}
              title={entry.title}
              onClick={() => setTool(entry.id)}
              disabled={showPreview}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="tool-group">
          <button
            type="button"
            className={showPreview ? 'toggle-button tool-active' : 'toggle-button'}
            onClick={() => store.getState().togglePreview()}
            title="Stitch preview (Ctrl+P)"
          >
            {showPreview ? 'Editing off' : 'Stitch preview'}
          </button>
          <button type="button" onClick={() => store.getState().zoomBy(1 / 1.25)} title="Zoom out">
            −
          </button>
          {/* 100% is life size on a 96 dpi screen: 1 unit = 0.1 mm = 0.378 px. */}
          <span className="zoom-readout">{Math.round((view.zoom / 0.37795) * 100)}%</span>
          <button type="button" onClick={() => store.getState().zoomBy(1.25)} title="Zoom in">
            +
          </button>
          <button
            type="button"
            onClick={() => {
              const host = window.document.querySelector('.canvas-host');
              if (host) store.getState().fitToHoop(host.clientWidth, host.clientHeight);
            }}
          >
            Fit
          </button>
        </div>

        <div className="tool-group grow">
          <input
            className="document-name"
            value={documentName}
            onChange={(event) => store.getState().setName(event.target.value)}
            aria-label="Design name"
          />
          {dirty && <span className="dirty-dot" title="Unsaved changes" />}
        </div>

        <div className="tool-group">
          <button type="button" onClick={() => void saveProject()}>
            Save
          </button>
          <button type="button" className="primary" onClick={() => setTab('export')}>
            Export
          </button>
        </div>
      </header>

      <UpdateBanner state={update} />

      <main className="workspace">
        <div className="stage">
          {showPreview ? <StitchPreview compiled={result} /> : <DesignCanvas />}
        </div>

        <aside className="side-panel">
          <nav className="tab-bar">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={tab === entry.id ? 'tab tab-active' : 'tab'}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </nav>
          <div className="panel-scroll">
            {tab === 'layers' && <LayerPanel compiled={result} />}
            {tab === 'properties' && <PropertiesPanel compiled={result} />}
            {tab === 'shapes' && <ShapesPanel />}
            {tab === 'image' && <ImageImportPanel />}
            {tab === 'hoop' && <HoopPanel compiled={result} />}
            {tab === 'export' && <ExportPanel compiled={result} />}
          </div>
        </aside>
      </main>

      <footer className="status-bar">
        <span>
          {compile.compiling
            ? 'Generating stitches…'
            : compile.error
              ? compile.error
              : result
                ? `${result.totalStitches.toLocaleString()} stitches · ${result.colorBlocks} colour${
                    result.colorBlocks === 1 ? '' : 's'
                  } · ${Math.round(result.estimatedMinutes)} min`
                : 'Ready'}
        </span>
        {result && !result.hoopFit.fits && <span className="warn">{result.hoopFit.message}</span>}
        {result && result.warnings.length > 0 && result.hoopFit.fits && (
          <span className="warn" title={result.warnings.join('\n')}>
            {result.warnings.length} warning{result.warnings.length === 1 ? '' : 's'}
          </span>
        )}
        <span className="grow" />
        {updateStatusLabel(update) && (
          <span className={update.status === 'error' ? 'warn' : 'muted'}>
            {updateStatusLabel(update)}
          </span>
        )}
        {status && (
          <span className="status-message" onClick={() => setStatus(null)} role="presentation">
            {status}
          </span>
        )}
        {!compile.compiling && result && (
          <span className="muted">{compile.durationMs.toFixed(0)} ms</span>
        )}
      </footer>
    </div>
  );
}
