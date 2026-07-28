import { useCallback, useEffect, useRef, useState } from 'react';
import {
  autoDigitizeImage,
  createImageTraceLayer,
  mergeSimilarColors,
  mmToUnits,
  threadToHex,
  unitsToMm,
  type AutoDigitizeResult,
  type RgbaImage,
} from '@embroider-design/engine';
import { useDocumentStore } from '../state/document-store.js';
import { CheckboxField, NumberField, PanelSection, SliderField } from '../components/controls.js';

/**
 * Image import and auto-digitizing.
 *
 * The renderer decodes the file — the engine takes raw RGBA and knows nothing
 * about PNG — and then every control here re-runs the trace so the user can
 * see what each one does. Colour count is the one that matters most: it is
 * literally the number of times they will have to rethread the machine.
 */

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

export function ImageImportPanel(): JSX.Element {
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
    const file = await window.embroider.openImage();
    if (!file) return;
    setError(null);
    const decoded = await decodeImage(file.name, file.data);
    if (!decoded) {
      setError('That image could not be read.');
      return;
    }
    setSource(decoded);
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
