import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  autoDigitizeImage,
  createImageTraceLayer,
  libraryShapeFromImage,
  mergeSimilarColors,
  mmToUnits,
  scanIconSheet,
  sliceSheetGrid,
  threadToHex,
  unitsToMm,
  type AutoDigitizeResult,
  type LibraryShape,
  type RgbaImage,
  type SheetScan,
} from '@embroider-design/engine';
import { useDocumentStore } from '../state/document-store.js';
import { useCustomShapeStore } from '../state/custom-shape-store.js';
import {
  CheckboxField,
  Field,
  NumberField,
  PanelSection,
  SelectField,
  SliderField,
} from '../components/controls.js';

/**
 * Image import: one design, or a sheet of icons.
 *
 * The renderer decodes the file — the engine takes raw RGBA and knows nothing
 * about PNG — and then every control here re-runs the work so the user can see
 * what each one does. Colour count is the one that matters most: it is
 * literally the number of times they will have to rethread the machine.
 *
 * The two modes share this panel rather than getting a tab each. They share
 * the decode, the busy and error handling, and every trace control; what
 * differs is only whether the result becomes layers in the current design or
 * shapes in the library.
 */

export type ImageImportMode = 'design' | 'sheet';

interface DecodedImage {
  name: string;
  image: RgbaImage;
  /** Downscaled copy kept in the project file so it can be re-traced later. */
  dataUrl: string;
}

async function decodeImage(name: string, data: Uint8Array): Promise<DecodedImage | null> {
  // Copy into a buffer of exactly the right length: the bytes arrive over IPC
  // as a view that may sit inside a larger pooled buffer.
  const blob = new Blob([new Uint8Array(data).buffer]);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(bitmap, 0, 0);
  const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);

  // Keep a small copy for the project file, not the original megabytes.
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const thumb = document.createElement('canvas');
  thumb.width = Math.max(1, Math.round(bitmap.width * scale));
  thumb.height = Math.max(1, Math.round(bitmap.height * scale));
  thumb.getContext('2d')?.drawImage(bitmap, 0, 0, thumb.width, thumb.height);
  bitmap.close();

  return {
    name,
    image: { data: imageData.data, width: imageData.width, height: imageData.height },
    dataUrl: thumb.toDataURL('image/png'),
  };
}

/** Strips the extension, so "autumn-icons.jpg" suggests "autumn-icons". */
function baseNameOf(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim() || 'Icon';
}

async function pickImage(): Promise<DecodedImage | null | 'unreadable'> {
  const file = await window.embroider.openImage();
  if (!file) return null;
  return (await decodeImage(file.name, file.data)) ?? 'unreadable';
}

export function ImageImportPanel({
  mode,
  onModeChange,
}: {
  mode: ImageImportMode;
  onModeChange(mode: ImageImportMode): void;
}): JSX.Element {
  return (
    <>
      <div className="segmented" role="tablist" aria-label="What the image is">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'design'}
          className={mode === 'design' ? 'segment segment-active' : 'segment'}
          onClick={() => onModeChange('design')}
        >
          One design
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'sheet'}
          className={mode === 'sheet' ? 'segment segment-active' : 'segment'}
          onClick={() => onModeChange('sheet')}
        >
          Sheet of icons
        </button>
      </div>
      {mode === 'design' ? <DesignImport /> : <SheetImport />}
    </>
  );
}

function DesignImport(): JSX.Element {
  const addLayer = useDocumentStore((state) => state.addLayer);
  const hoop = useDocumentStore((state) => state.document.hoop);
  const layerCount = useDocumentStore((state) => state.document.layers.length);

  const [source, setSource] = useState<DecodedImage | null>(null);
  const [result, setResult] = useState<AutoDigitizeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [colors, setColors] = useState(5);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [mergeSimilar, setMergeSimilar] = useState(true);
  const [smoothing, setSmoothing] = useState(1);
  const [widthMm, setWidthMm] = useState(Math.round(hoop.widthMm * 0.7));

  const previewRef = useRef<HTMLCanvasElement | null>(null);

  const pickFile = async (): Promise<void> => {
    const picked = await pickImage();
    if (picked === null) return;
    if (picked === 'unreadable') {
      setError('That image could not be read.');
      return;
    }
    setError(null);
    setSource(picked);
  };

  const retrace = useCallback(() => {
    if (!source) return;
    setBusy(true);
    setError(null);
    // Let the "working" state paint before a long synchronous trace.
    setTimeout(() => {
      try {
        let traced = autoDigitizeImage(source.image, {
          targetWidth: mmToUnits(widthMm),
          colors,
          removeBackground,
          morphology: smoothing,
        });
        if (mergeSimilar) traced = mergeSimilarColors(traced);
        setResult(traced);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not trace that image');
        setResult(null);
      } finally {
        setBusy(false);
      }
    }, 0);
  }, [source, widthMm, colors, removeBackground, smoothing, mergeSimilar]);

  useEffect(() => {
    retrace();
  }, [retrace]);

  // Draw the traced regions so the settings can be judged before committing.
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !result) return;
    const width = canvas.clientWidth;
    const height = Math.round((width * result.height) / Math.max(1, result.width));
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const scale = width / result.width;

    for (const traced of result.colors) {
      context.fillStyle = threadToHex(traced.color);
      context.beginPath();
      for (const region of traced.regions) {
        for (const ring of [region.outer, ...region.holes]) {
          ring.forEach((point, index) => {
            const x = point.x * scale;
            const y = point.y * scale;
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.closePath();
        }
      }
      context.fill('evenodd');
    }
  }, [result]);

  const addAsLayers = (): void => {
    if (!result || !source) return;
    let index = layerCount;
    for (const traced of result.colors) {
      addLayer(
        createImageTraceLayer(traced.regions, {
          name: `${source.name} — ${traced.color.description ?? threadToHex(traced.color)}`,
          index: index++,
          thread: traced.color,
          source: {
            name: source.name,
            dataUrl: source.dataUrl,
            width: source.image.width,
            height: source.image.height,
          },
          traceOptions: { colors, removeBackground, smoothing, widthMm },
        }),
        false,
      );
    }
  };

  return (
    <>
      <PanelSection title="Import an image">
        <p className="muted small">
          Photographs rarely embroider well; flat logos and line art do. Fewer colours means fewer
          thread changes.
        </p>
        <button type="button" className="primary" onClick={() => void pickFile()}>
          Choose an image…
        </button>
        {source && <p className="muted small">{source.name}</p>}
        {error && <p className="warn small">{error}</p>}
      </PanelSection>

      {source && (
        <>
          <PanelSection title="Trace settings">
            <SliderField
              label="Colours"
              hint="One thread change each"
              value={colors}
              min={2}
              max={12}
              step={1}
              onChange={setColors}
            />
            <NumberField
              label="Design width"
              unit="mm"
              value={widthMm}
              min={10}
              max={Math.round(Math.max(hoop.widthMm, hoop.heightMm))}
              step={5}
              decimals={0}
              onChange={setWidthMm}
            />
            <SliderField
              label="Smoothing"
              hint="Removes speckle and jagged edges"
              value={smoothing}
              min={0}
              max={3}
              step={1}
              onChange={setSmoothing}
            />
            <CheckboxField
              label="Drop the background"
              hint="Removes the colour around the edges"
              checked={removeBackground}
              onChange={setRemoveBackground}
            />
            <CheckboxField
              label="Merge near-identical colours"
              hint="Saves a thread change for no visible loss"
              checked={mergeSimilar}
              onChange={setMergeSimilar}
            />
          </PanelSection>

          <PanelSection title="Preview">
            {busy && <p className="muted small">Tracing…</p>}
            <canvas ref={previewRef} className="trace-preview" />
            {result && (
              <>
                <div className="trace-colors">
                  {result.colors.map((traced, index) => (
                    <span key={index} className="trace-color">
                      <span
                        className="swatch"
                        style={{ background: threadToHex(traced.color) }}
                      />
                      {(traced.coverage * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
                <p className="muted small">
                  {result.colors.length} colours ·{' '}
                  {result.colors.reduce((sum, entry) => sum + entry.regions.length, 0)} shapes ·{' '}
                  {unitsToMm(result.width).toFixed(0)} x {unitsToMm(result.height).toFixed(0)} mm
                  {result.droppedColors.length > 0 &&
                    ` · ${result.droppedColors.length} colour(s) too small to keep`}
                </p>
                <button
                  type="button"
                  className="primary"
                  onClick={addAsLayers}
                  disabled={result.colors.length === 0}
                >
                  Add {result.colors.length} layer{result.colors.length === 1 ? '' : 's'}
                </button>
              </>
            )}
          </PanelSection>
        </>
      )}
    </>
  );
}

/** Marks a new collection in the destination list, rather than an existing one. */
const NEW_COLLECTION = ' new';

function SheetImport(): JSX.Element {
  const customShapes = useCustomShapeStore((state) => state.shapes);
  const saveMany = useCustomShapeStore((state) => state.saveMany);

  const [source, setSource] = useState<DecodedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [detection, setDetection] = useState<'auto' | 'grid'>('auto');
  const [rows, setRows] = useState(4);
  const [columns, setColumns] = useState(4);
  // Both of these are measured from the page unless the user takes them over.
  // The measured value is almost always better than a number typed in — the
  // right background tolerance differs by a factor of ten between a clean JPEG
  // and a photograph of linen — so the slider starts disabled and showing what
  // the scan decided, and unchecking Auto seeds it from there.
  const [autoSeparation, setAutoSeparation] = useState(true);
  const [separation, setSeparation] = useState(20);
  const [autoTolerance, setAutoTolerance] = useState(true);
  const [tolerance, setTolerance] = useState(28);
  const [minSize, setMinSize] = useState(4);

  const [colors, setColors] = useState(5);
  const [smoothing, setSmoothing] = useState(1);
  const [mergeSimilar, setMergeSimilar] = useState(true);

  const [scan, setScan] = useState<SheetScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());

  const [destination, setDestination] = useState<string>(NEW_COLLECTION);
  const [newCollection, setNewCollection] = useState('');
  const [baseName, setBaseName] = useState('Icon');
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);

  const contactRef = useRef<HTMLCanvasElement | null>(null);

  const collections = useMemo(() => {
    const names = new Set<string>();
    for (const shape of customShapes) if (shape.collection) names.add(shape.collection);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [customShapes]);

  const pickFile = async (): Promise<void> => {
    const picked = await pickImage();
    if (picked === null) return;
    if (picked === 'unreadable') {
      setError('That image could not be read.');
      return;
    }
    setError(null);
    setStatus(null);
    setSource(picked);
    setExcluded(new Set());
    setBaseName(baseNameOf(picked.name));
    if (!newCollection.trim()) setNewCollection(baseNameOf(picked.name));
  };

  // Re-scan whenever anything that changes where the cuts fall changes. The
  // trace settings deliberately are *not* in here: they affect what each icon
  // looks like, not how many there are, and re-scanning on them would make the
  // contact sheet flicker for no reason.
  useEffect(() => {
    if (!source) {
      setScan(null);
      return;
    }
    setScanning(true);
    let cancelled = false;
    // Long enough that dragging a slider queues one scan rather than one per
    // input event: a sheet takes the better part of a second to read.
    const timer = setTimeout(() => {
      try {
        const options = {
          ...(autoSeparation ? {} : { separation }),
          ...(autoTolerance ? {} : { backgroundTolerance: tolerance }),
          minCellFraction: minSize / 100,
        };
        const found =
          detection === 'grid'
            ? sliceSheetGrid(source.image, rows, columns, options)
            : scanIconSheet(source.image, options);
        if (cancelled) return;
        setScan(found);
        // Captions, headings and stray marks start unticked. Nothing is ever
        // dropped for looking like one — a wrong guess has to cost a click.
        setExcluded(new Set(found.cells.filter((cell) => cell.likelyLabel).map((cell) => cell.index)));
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        setScan(null);
        setError(caught instanceof Error ? caught.message : 'That sheet could not be read');
      } finally {
        if (!cancelled) setScanning(false);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, detection, rows, columns, autoSeparation, separation, autoTolerance, tolerance, minSize]);

  // The contact sheet: the page with every cell boxed and numbered. This is the
  // checkpoint — "found twelve" and "found the right twelve" are different
  // claims, and only looking at it separates them.
  useEffect(() => {
    const canvas = contactRef.current;
    if (!canvas || !scan || !source) return;

    const image = new Image();
    image.onload = () => {
      const width = canvas.clientWidth;
      const height = Math.round((width * scan.height) / Math.max(1, scan.width));
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.height = `${height}px`;

      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const scale = width / scan.width;
      context.lineWidth = 1.5;
      context.font = '10px system-ui, sans-serif';
      context.textBaseline = 'top';
      for (const cell of scan.cells) {
        const off = excluded.has(cell.index);
        const x = cell.box.minX * scale;
        const y = cell.box.minY * scale;
        const w = (cell.box.maxX - cell.box.minX) * scale;
        const h = (cell.box.maxY - cell.box.minY) * scale;
        if (off) {
          context.fillStyle = 'rgba(12, 14, 18, 0.6)';
          context.fillRect(x, y, w, h);
        }
        // A cell the scan took for a caption keeps its dashed amber outline
        // after the user puts it back, so "this was left out for a reason"
        // stays on the page instead of vanishing at the moment it is overruled.
        context.setLineDash(cell.likelyLabel ? [4, 3] : []);
        context.strokeStyle = off ? '#8a8f98' : cell.likelyLabel ? '#e0a020' : '#4da3ff';
        context.strokeRect(x, y, w, h);
        context.fillStyle = off ? '#8a8f98' : cell.likelyLabel ? '#e0a020' : '#4da3ff';
        context.fillText(String(cell.index + 1), x + 2, y + 2);
      }
      context.setLineDash([]);
    };
    image.src = source.dataUrl;
  }, [scan, source, excluded]);

  const toggleCell = (event: MouseEvent<HTMLCanvasElement>): void => {
    const canvas = contactRef.current;
    if (!canvas || !scan) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * scan.width;
    const y = ((event.clientY - rect.top) / rect.height) * scan.height;
    // Last match wins, so a small cell drawn inside a larger one is reachable.
    const hit = [...scan.cells]
      .reverse()
      .find(
        (cell) =>
          x >= cell.box.minX && x < cell.box.maxX && y >= cell.box.minY && y < cell.box.maxY,
      );
    if (!hit) return;
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(hit.index)) next.delete(hit.index);
      else next.add(hit.index);
      return next;
    });
  };

  const included = useMemo(
    () => (scan ? scan.cells.filter((cell) => !excluded.has(cell.index)) : []),
    [scan, excluded],
  );

  const targetCollection =
    destination === NEW_COLLECTION ? newCollection.trim() : destination;

  const runImport = async (): Promise<void> => {
    if (included.length === 0) return;
    setImporting({ done: 0, total: included.length });
    setStatus(null);
    setError(null);

    const shapes: LibraryShape[] = [];
    let skipped = 0;
    for (let i = 0; i < included.length; i++) {
      // One icon per turn of the event loop. A sheet of thirty is thirty full
      // traces, and doing them in one synchronous run freezes the window with
      // no sign of progress.
      await new Promise((resolve) => setTimeout(resolve, 0));
      try {
        const shape = libraryShapeFromImage(included[i].crop(), {
          name: `${baseName.trim() || 'Icon'} ${i + 1}`,
          colors,
          smoothing,
          mergeSimilar,
          ...(targetCollection ? { collection: targetCollection } : {}),
        });
        if (shape) shapes.push(shape);
        else skipped++;
      } catch {
        skipped++;
      }
      setImporting({ done: i + 1, total: included.length });
    }

    const ok = await saveMany(shapes);
    setImporting(null);
    if (!ok) {
      setError('Those icons could not be saved to your library.');
      return;
    }
    setStatus(
      `Added ${shapes.length} icon${shapes.length === 1 ? '' : 's'}` +
        (targetCollection ? ` to “${targetCollection}”` : '') +
        (skipped > 0 ? ` · ${skipped} had nothing to trace` : '') +
        '. They are in the Shapes tab.',
    );
  };

  return (
    <>
      <PanelSection title="Import a sheet of icons">
        <p className="muted small">
          A page of separate drawings, cut apart and added to your shape library one icon at a
          time. Each icon is traced from the original file rather than from the preview, so it
          keeps whatever detail the sheet had. Textured and photographed backgrounds are read as
          well as plain white.
        </p>
        <button type="button" className="primary" onClick={() => void pickFile()}>
          Choose a sheet…
        </button>
        {source && <p className="muted small">{source.name}</p>}
        {error && <p className="warn small">{error}</p>}
      </PanelSection>

      {source && (
        <>
          <PanelSection title="Finding the icons">
            <div className="segmented segmented-small">
              <button
                type="button"
                className={detection === 'auto' ? 'segment segment-active' : 'segment'}
                onClick={() => setDetection('auto')}
              >
                Auto-detect
              </button>
              <button
                type="button"
                className={detection === 'grid' ? 'segment segment-active' : 'segment'}
                onClick={() => setDetection('grid')}
              >
                Grid
              </button>
            </div>

            {detection === 'grid' ? (
              <>
                <NumberField
                  label="Rows"
                  value={rows}
                  min={1}
                  max={20}
                  step={1}
                  decimals={0}
                  onChange={setRows}
                />
                <NumberField
                  label="Columns"
                  value={columns}
                  min={1}
                  max={20}
                  step={1}
                  decimals={0}
                  onChange={setColumns}
                />
              </>
            ) : (
              <>
                <CheckboxField
                  label="Work out the spacing"
                  hint="Reads the rows and columns off the page itself"
                  checked={autoSeparation}
                  onChange={(next) => {
                    if (!next && scan) setSeparation(scan.separationUsed);
                    setAutoSeparation(next);
                  }}
                />
                <SliderField
                  label="Joining distance"
                  hint="Raise it to join one icon's pieces, lower it to split neighbours apart"
                  value={autoSeparation && scan ? scan.separationUsed : separation}
                  min={0}
                  max={120}
                  step={1}
                  disabled={autoSeparation}
                  format={(value) => `${value} px`}
                  onChange={setSeparation}
                />
              </>
            )}
            <CheckboxField
              label="Work out the background"
              hint="Measures the page's own texture instead of guessing"
              checked={autoTolerance}
              onChange={(next) => {
                if (!next && scan) setTolerance(scan.toleranceUsed);
                setAutoTolerance(next);
              }}
            />
            <SliderField
              label="Background tolerance"
              hint="How different from the page a pixel must be to count as drawing"
              value={autoTolerance && scan ? scan.toleranceUsed : tolerance}
              min={6}
              max={96}
              step={2}
              disabled={autoTolerance}
              onChange={setTolerance}
            />
            <SliderField
              label="Smallest icon"
              hint="Share of the other icons' size below which a mark is a stray"
              value={minSize}
              min={1}
              max={25}
              step={1}
              format={(value) => `${value}%`}
              onChange={setMinSize}
            />
          </PanelSection>

          <PanelSection
            title="What was found"
            action={
              scan && scan.cells.length > 0 ? (
                <span className="section-actions">
                  <button type="button" className="link" onClick={() => setExcluded(new Set())}>
                    All
                  </button>
                  <button
                    type="button"
                    className="link"
                    onClick={() => setExcluded(new Set(scan.cells.map((cell) => cell.index)))}
                  >
                    None
                  </button>
                </span>
              ) : undefined
            }
          >
            {scanning && <p className="muted small">Looking…</p>}
            <canvas
              ref={contactRef}
              className="trace-preview contact-sheet"
              onClick={toggleCell}
            />
            <p className="muted small">
              {scan
                ? `${included.length} of ${scan.cells.length} icon${scan.cells.length === 1 ? '' : 's'} selected`
                : 'Nothing found yet'}
              . Click one to leave it out.
            </p>
            {scan && scan.labelCount > 0 && (
              <p className="muted small">
                {scan.labelCount} look{scan.labelCount === 1 ? 's' : ''} like a caption, a heading
                or a stray mark and {scan.labelCount === 1 ? 'is' : 'are'} left out. Click one to
                put it back.
              </p>
            )}
            {scan?.crowded && (
              <p className="warn small">
                The page has no readable background — the drawings and whatever they sit on run
                together, so the icons cannot be told apart. Switch to Grid and give it the rows
                and columns, or crop the sheet down to the artwork first.
              </p>
            )}
            {scan && scan.cells.length === 0 && !scan.crowded && (
              <p className="warn small">
                No icons found. Try a lower background tolerance, or switch to Grid and give it
                the rows and columns.
              </p>
            )}
          </PanelSection>

          <PanelSection title="How each icon is traced">
            <SliderField
              label="Colours"
              hint="One thread change each"
              value={colors}
              min={2}
              max={8}
              step={1}
              onChange={setColors}
            />
            <SliderField
              label="Smoothing"
              hint="Raise it for a scanned or heavily compressed sheet"
              value={smoothing}
              min={0}
              max={3}
              step={1}
              onChange={setSmoothing}
            />
            <CheckboxField
              label="Merge near-identical colours"
              hint="Saves a thread change for no visible loss"
              checked={mergeSimilar}
              onChange={setMergeSimilar}
            />
          </PanelSection>

          <PanelSection title="Where they go">
            <SelectField
              label="Collection"
              value={destination}
              options={[
                ...collections.map((name) => ({ value: name, label: name })),
                { value: NEW_COLLECTION, label: 'New collection…' },
              ]}
              onChange={setDestination}
            />
            {destination === NEW_COLLECTION && (
              <Field label="Name it">
                <input
                  type="text"
                  value={newCollection}
                  maxLength={40}
                  placeholder="Autumn"
                  onChange={(event) => setNewCollection(event.target.value)}
                />
              </Field>
            )}
            <Field label="Icon names">
              <input
                type="text"
                value={baseName}
                onChange={(event) => setBaseName(event.target.value)}
              />
            </Field>
            <p className="muted small">
              Numbered as you go — “{baseName.trim() || 'Icon'} 1”, “{baseName.trim() || 'Icon'} 2”
              — and renameable afterwards in the Shapes tab.
            </p>

            <button
              type="button"
              className="primary"
              onClick={() => void runImport()}
              disabled={included.length === 0 || importing !== null}
            >
              {importing
                ? `Tracing ${importing.done} of ${importing.total}…`
                : `Add ${included.length} icon${included.length === 1 ? '' : 's'}` +
                  (targetCollection ? ` to “${targetCollection}”` : '')}
            </button>
            {status && <p className="muted small">{status}</p>}
          </PanelSection>
        </>
      )}
    </>
  );
}
