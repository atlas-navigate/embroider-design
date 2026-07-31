import { useCallback, useMemo } from 'react';
import {
  compose,
  DEFAULT_STITCH_SETTINGS,
  frameCentrePoint,
  mmToUnits,
  resolveStitchSettings,
  rotateAround,
  rotation,
  scaleAround,
  translation,
  unitsToMm,
  type AffineMatrix,
  type CompileResult,
  type EmbroideryFont,
  type Layer,
  type StitchType,
  type UnderlayType,
} from '@embroider-design/engine';
import { useDocumentStore } from '../state/document-store.js';
import { useFontStore } from '../state/font-store.js';
import { frameForLayers, layerOutline, outlineBounds } from '../canvas/geometry.js';
import {
  CheckboxField,
  ColorField,
  NumberField,
  PanelSection,
  SelectField,
  SliderField,
} from '../components/controls.js';
import { CombinePanel } from './CombinePanel.js';
import { TextProperties } from './TextPanel.js';

/**
 * Per-layer settings.
 *
 * These are machine parameters, not styling: density decides whether the
 * fabric puckers, underlay decides whether the satin sinks into it, and pull
 * compensation decides whether adjacent shapes leave a gap. Each control says
 * what it is for, because "0.4" means nothing on its own.
 */

const STITCH_TYPES: { value: StitchType; label: string }[] = [
  { value: 'auto', label: 'Automatic (by width)' },
  { value: 'satin', label: 'Satin column' },
  { value: 'fill', label: 'Tatami fill' },
  { value: 'running', label: 'Running stitch' },
  { value: 'bean', label: 'Bean (triple) stitch' },
];

const UNDERLAY_TYPES: { value: UnderlayType; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'none', label: 'None' },
  { value: 'center-walk', label: 'Centre walk' },
  { value: 'edge-run', label: 'Edge run' },
  { value: 'zigzag', label: 'Zigzag' },
  { value: 'center-walk-and-zigzag', label: 'Centre walk + zigzag' },
  { value: 'edge-run-and-zigzag', label: 'Edge run + zigzag' },
];

interface PropertiesPanelProps {
  compiled: CompileResult | null;
}

export function PropertiesPanel({ compiled }: PropertiesPanelProps): JSX.Element {
  const selectedLayerId = useDocumentStore((state) => state.selectedLayerId);
  const layers = useDocumentStore((state) => state.document.layers);
  const documentSettings = useDocumentStore((state) => state.document.settings);
  const updateLayer = useDocumentStore((state) => state.updateLayer);
  const updateLayerSettings = useDocumentStore((state) => state.updateLayerSettings);
  const setDocumentSettings = useDocumentStore((state) => state.setDocumentSettings);
  const selectedLayerIds = useDocumentStore((state) => state.selectedLayerIds);
  const captureSelectionTransforms = useDocumentStore((state) => state.captureSelectionTransforms);
  const applyToSelection = useDocumentStore((state) => state.applyToSelection);

  const loadedFonts = useFontStore((state) => state.loaded);
  const entryFor = useFontStore((state) => state.entryFor);

  const layer = layers.find((entry) => entry.id === selectedLayerId) ?? null;

  const fontFor = useCallback(
    (target: Layer): EmbroideryFont | null => {
      if (target.kind !== 'text') return null;
      const entry = entryFor(target.font);
      return entry ? (loadedFonts.get(entry.path) ?? null) : null;
    },
    [entryFor, loadedFonts],
  );

  const selection = useMemo(
    () => layers.filter((entry) => selectedLayerIds.includes(entry.id)),
    [layers, selectedLayerIds],
  );

  /**
   * The whole selection's oriented frame, so this panel agrees with the canvas.
   *
   * Everything that changes the selection's size or angle goes through it.
   * Rotating used to turn only the primary layer about its own centre, which
   * meant a multi-selection came apart the moment anyone pressed a rotate
   * button; and the size fields used to *read* the primary layer's upright
   * bounding box while *writing* through the frame, so on a rotated layer the
   * two disagreed by up to a factor of root two and typing back the number
   * already shown would resize the layer.
   *
   * These hooks sit above the "nothing selected" return below because they have
   * to: hooks cannot be called conditionally.
   */
  const frame = useMemo(() => frameForLayers(selection, fontFor), [selection, fontFor]);

  if (!layer) {
    const defaults = resolveStitchSettings(documentSettings);
    return (
      <>
        <PanelSection title="Design defaults">
          <p className="muted small">
            Applied to every layer that has not been changed itself. Select a layer to override
            these for that layer alone.
          </p>
          <SliderField
            label="Fill density"
            hint="Distance between fill rows"
            value={unitsToMm(defaults.fillSpacing)}
            min={0.2}
            max={1.5}
            step={0.05}
            format={(v) => `${v.toFixed(2)} mm`}
            onChange={(value) => setDocumentSettings({ fillSpacing: mmToUnits(value) })}
          />
          <SliderField
            label="Satin density"
            hint="Spacing along one rail"
            value={unitsToMm(defaults.satinDensity)}
            min={0.2}
            max={1}
            step={0.05}
            format={(v) => `${v.toFixed(2)} mm`}
            onChange={(value) => setDocumentSettings({ satinDensity: mmToUnits(value) })}
          />
          <SliderField
            label="Fill angle"
            value={defaults.fillAngle}
            min={0}
            max={179}
            step={1}
            format={(v) => `${v}°`}
            onChange={(value) => setDocumentSettings({ fillAngle: value })}
          />
          <SliderField
            label="Pull compensation"
            hint="Widens shapes to offset thread tension"
            value={unitsToMm(defaults.pullCompensation)}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${v.toFixed(2)} mm`}
            onChange={(value) => setDocumentSettings({ pullCompensation: mmToUnits(value) })}
          />
          <SelectField
            label="Underlay"
            value={defaults.underlay.type}
            options={UNDERLAY_TYPES}
            onChange={(value) => setDocumentSettings({ underlay: { type: value } })}
          />
        </PanelSection>
      </>
    );
  }

  const settings = resolveStitchSettings({
    ...documentSettings,
    ...layer.settings,
    underlay: { ...documentSettings.underlay, ...layer.settings.underlay },
  });
  const result = compiled?.layers.find((entry) => entry.layerId === layer.id);
  // This one stays the *layer's* own upright box, deliberately: it labels that
  // layer's compiled stitch count below, so it should describe that layer and
  // not the selection frame around it.
  const layerBounds = outlineBounds(layerOutline(layer, fontFor(layer)));

  const nudge = (dx: number, dy: number): void => {
    updateLayer(layer.id, (current) => ({
      ...current,
      transform: compose(current.transform, translation(dx, dy)),
    }));
  };

  const transformSelection = (matrix: AffineMatrix): void => {
    applyToSelection(captureSelectionTransforms(), matrix);
  };

  const rotate = (degrees: number): void => {
    if (!frame) return;
    transformSelection(rotateAround((degrees * Math.PI) / 180, frameCentrePoint(frame)));
  };

  /** Sets one axis of the selection to an exact size in millimetres. */
  const resizeTo = (axis: 'x' | 'y', mm: number): void => {
    if (!frame || mm <= 0) return;
    const width = frame.bounds.maxX - frame.bounds.minX;
    const height = frame.bounds.maxY - frame.bounds.minY;
    const span = axis === 'x' ? width : height;
    if (span < 1e-6) return;
    const factor = mmToUnits(mm) / span;
    // Anchor the top-left of the frame, so typing a size grows the layer to the
    // right and down rather than shifting it out from under the cursor.
    const pivot = { x: frame.bounds.minX, y: frame.bounds.minY };
    const scale = scaleAround(axis === 'x' ? factor : 1, axis === 'y' ? factor : 1, pivot);
    transformSelection(compose(rotation(-frame.angle), scale, rotation(frame.angle)));
  };

  /** Turns the selection to an exact absolute angle. */
  const setAngle = (degrees: number): void => {
    if (!frame) return;
    const target = (degrees * Math.PI) / 180;
    transformSelection(rotateAround(target - frame.angle, frameCentrePoint(frame)));
  };

  return (
    <>
      <CombinePanel />

      <PanelSection title={layer.name}>
        <ColorField
          label="Thread colour"
          value={layer.thread}
          onChange={(thread) => updateLayer(layer.id, { thread })}
        />
        {layer.kind !== 'stitch' && (
          <SelectField
            label="Stitch type"
            hint={result?.reasons[0]}
            value={layer.stitchType}
            options={STITCH_TYPES}
            onChange={(stitchType) => updateLayer(layer.id, { stitchType })}
          />
        )}
        {result && !result.skipped && (
          <p className="muted small">
            {result.stitchCount.toLocaleString()} stitches
            {layerBounds && (
              <>
                {' · '}
                {unitsToMm(layerBounds.maxX - layerBounds.minX).toFixed(1)} x{' '}
                {unitsToMm(layerBounds.maxY - layerBounds.minY).toFixed(1)} mm
              </>
            )}
          </p>
        )}
        {result?.warnings.map((warning) => (
          <p key={warning} className="warn small">
            {warning}
          </p>
        ))}
      </PanelSection>

      {layer.kind === 'text' && <TextProperties layer={layer} />}

      <PanelSection title="Position">
        <div className="nudge-grid">
          <button type="button" onClick={() => nudge(0, -mmToUnits(1))}>
            ↑
          </button>
          <button type="button" onClick={() => nudge(-mmToUnits(1), 0)}>
            ←
          </button>
          <button type="button" onClick={() => nudge(mmToUnits(1), 0)}>
            →
          </button>
          <button type="button" onClick={() => nudge(0, mmToUnits(1))}>
            ↓
          </button>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => rotate(-15)}>
            Rotate -15°
          </button>
          <button type="button" onClick={() => rotate(15)}>
            Rotate +15°
          </button>
          <button type="button" onClick={() => rotate(90)}>
            Rotate 90°
          </button>
        </div>
        {/*
          Measured on the selection frame, which is what `resizeTo` writes
          through — so typing back the number already shown is exactly a no-op,
          at any rotation and for any number of selected layers.
        */}
        {frame && (
          <>
            <NumberField
              label="Width"
              unit="mm"
              min={0.1}
              step={0.5}
              decimals={1}
              value={unitsToMm(frame.bounds.maxX - frame.bounds.minX)}
              onChange={(mm) => resizeTo('x', mm)}
            />
            <NumberField
              label="Height"
              unit="mm"
              min={0.1}
              step={0.5}
              decimals={1}
              value={unitsToMm(frame.bounds.maxY - frame.bounds.minY)}
              onChange={(mm) => resizeTo('y', mm)}
            />
          </>
        )}
        {/*
          Only for a single layer. Several layers have no one angle between
          them, so the frame is upright by definition and an "absolute" field
          over it would really be a relative one — type 45 twice and the
          selection turns 90°. Better to have no field than a lying one.
        */}
        {frame && selection.length === 1 && (
          <NumberField
            label="Angle"
            unit="°"
            step={5}
            decimals={1}
            value={(frame.angle * 180) / Math.PI}
            onChange={setAngle}
          />
        )}
        {selection.length > 1 && (
          <p className="muted small">
            Several layers have no single angle between them, so there is nothing to set — the
            rotate buttons turn the group about its centre.
          </p>
        )}
        <p className="muted small">
          Drag to move; drag a side handle to change one dimension, a corner to change both, or the
          round handle above to rotate. Shift keeps the proportions while resizing and snaps
          rotation to 15°; Alt resizes about the centre.
        </p>
      </PanelSection>

      {layer.kind !== 'stitch' && (
        <>
          <PanelSection title="Stitch settings">
            <p className="muted small">
              Overrides the design defaults for this layer only.
            </p>
            <SliderField
              label="Fill density"
              value={unitsToMm(settings.fillSpacing)}
              min={0.2}
              max={1.5}
              step={0.05}
              format={(v) => `${v.toFixed(2)} mm`}
              onChange={(value) => updateLayerSettings(layer.id, { fillSpacing: mmToUnits(value) })}
            />
            <SliderField
              label="Fill angle"
              value={settings.fillAngle}
              min={0}
              max={179}
              step={1}
              format={(v) => `${v}°`}
              onChange={(value) => updateLayerSettings(layer.id, { fillAngle: value })}
            />
            <SliderField
              label="Satin density"
              value={unitsToMm(settings.satinDensity)}
              min={0.2}
              max={1}
              step={0.05}
              format={(v) => `${v.toFixed(2)} mm`}
              onChange={(value) =>
                updateLayerSettings(layer.id, { satinDensity: mmToUnits(value) })
              }
            />
            <SliderField
              label="Pull compensation"
              value={unitsToMm(settings.pullCompensation)}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${v.toFixed(2)} mm`}
              onChange={(value) =>
                updateLayerSettings(layer.id, { pullCompensation: mmToUnits(value) })
              }
            />
            <NumberField
              label="Stitch length"
              unit="mm"
              value={unitsToMm(settings.stitchLength)}
              min={0.5}
              max={12}
              step={0.1}
              decimals={1}
              onChange={(value) =>
                updateLayerSettings(layer.id, { stitchLength: mmToUnits(value) })
              }
            />
            <NumberField
              label="Max satin width"
              hint="Wider than this gets filled instead"
              unit="mm"
              value={unitsToMm(settings.maxSatinWidth)}
              min={2}
              max={20}
              step={0.5}
              decimals={1}
              onChange={(value) =>
                updateLayerSettings(layer.id, { maxSatinWidth: mmToUnits(value) })
              }
            />
          </PanelSection>

          <PanelSection title="Underlay">
            <p className="muted small">
              Sewn first, to tack the fabric down and lift the top stitching off it.
            </p>
            <SelectField
              label="Type"
              value={settings.underlay.type}
              options={UNDERLAY_TYPES}
              onChange={(value) => updateLayerSettings(layer.id, { underlay: { type: value } })}
            />
            <NumberField
              label="Inset"
              hint="Keeps the underlay from peeking out"
              unit="mm"
              value={unitsToMm(settings.underlay.inset)}
              min={0}
              max={3}
              step={0.1}
              decimals={1}
              onChange={(value) =>
                updateLayerSettings(layer.id, { underlay: { inset: mmToUnits(value) } })
              }
            />
            <CheckboxField
              label="Use the design defaults"
              checked={Object.keys(layer.settings).length === 0}
              hint="Clears every override on this layer"
              onChange={(checked) => {
                if (checked) updateLayer(layer.id, { settings: {} });
              }}
            />
          </PanelSection>
        </>
      )}

      <PanelSection title="Reference">
        <p className="muted small">
          Defaults are {unitsToMm(DEFAULT_STITCH_SETTINGS.fillSpacing).toFixed(1)} mm fill spacing
          and {unitsToMm(DEFAULT_STITCH_SETTINGS.satinDensity).toFixed(1)} mm satin density —
          a conservative middle for 40-weight thread on medium fabric with a cutaway stabiliser.
        </p>
      </PanelSection>
    </>
  );
}
