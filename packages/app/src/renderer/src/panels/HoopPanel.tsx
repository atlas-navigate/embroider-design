import {
  compose,
  HOOP_PRESETS,
  scaleAround,
  scaleToFitHoop,
  unitsToMm,
  type CompileResult,
  type HoopOrientation,
} from '@embroider-design/engine';
import { useDocumentStore } from '../state/document-store.js';
import { PanelSection, SelectField } from '../components/controls.js';

/**
 * Hoop selection and the fit check.
 *
 * A design that does not fit the hoop cannot be sewn at all, so this reports
 * it in millimetres past each edge rather than as a yes/no, and offers the one
 * fix that always works.
 */

export function HoopPanel({ compiled }: { compiled: CompileResult | null }): JSX.Element {
  const document = useDocumentStore((state) => state.document);
  const setHoop = useDocumentStore((state) => state.setHoop);
  const updateLayer = useDocumentStore((state) => state.updateLayer);
  const showGrid = useDocumentStore((state) => state.showGrid);
  const toggleGrid = useDocumentStore((state) => state.toggleGrid);

  const fit = compiled?.hoopFit ?? null;

  const shrinkToFit = (): void => {
    if (!compiled?.bounds) return;
    const factor = scaleToFitHoop(compiled.bounds, document.hoop, document.hoopOrientation);
    if (factor >= 1) return;
    const pivot = { x: compiled.bounds.minX, y: compiled.bounds.minY };
    for (const layer of document.layers) {
      updateLayer(layer.id, (current) => ({
        ...current,
        transform: compose(current.transform, scaleAround(factor, factor, pivot)),
      }));
    }
  };

  return (
    <>
      <PanelSection title="Hoop">
        <SelectField
          label="Size"
          value={document.hoop.id}
          options={HOOP_PRESETS.map((preset) => ({
            value: preset.id,
            label: preset.machine ? `${preset.name} — ${preset.machine}` : preset.name,
          }))}
          onChange={(id) => {
            const preset = HOOP_PRESETS.find((entry) => entry.id === id);
            if (preset) setHoop(preset);
          }}
        />
        <SelectField
          label="Orientation"
          value={document.hoopOrientation}
          options={[
            { value: 'portrait' as HoopOrientation, label: 'Portrait' },
            { value: 'landscape' as HoopOrientation, label: 'Landscape' },
          ]}
          onChange={(orientation) => setHoop(document.hoop, orientation)}
        />
        <label className="checkbox-field">
          <input type="checkbox" checked={showGrid} onChange={toggleGrid} />
          <span>
            Show grid<span className="field-hint">10 mm minor, 50 mm major</span>
          </span>
        </label>
      </PanelSection>

      <PanelSection title="Fit">
        {!fit || !compiled?.bounds ? (
          <p className="muted small">Nothing to measure yet.</p>
        ) : (
          <>
            <p className={fit.fits ? 'ok small' : 'warn small'}>{fit.message}</p>
            <dl className="stat-grid">
              <dt>Design</dt>
              <dd>
                {unitsToMm(fit.usedWidth).toFixed(1)} x {unitsToMm(fit.usedHeight).toFixed(1)} mm
              </dd>
              <dt>Hoop</dt>
              <dd>
                {unitsToMm(fit.hoopWidth).toFixed(0)} x {unitsToMm(fit.hoopHeight).toFixed(0)} mm
              </dd>
              {!fit.fits && (
                <>
                  <dt>Over the edge</dt>
                  <dd>
                    {(['left', 'right', 'top', 'bottom'] as const)
                      .filter((side) => fit.overflow[side] > 0)
                      .map((side) => `${side} ${unitsToMm(fit.overflow[side]).toFixed(1)} mm`)
                      .join(', ')}
                  </dd>
                </>
              )}
            </dl>
            {!fit.fits && (
              <button type="button" onClick={shrinkToFit}>
                Shrink everything to fit
              </button>
            )}
          </>
        )}
      </PanelSection>

      <PanelSection title="Machine notes">
        <p className="muted small">
          The Brother PE900 sews at about 650 stitches a minute and trims jumps automatically.
          Designs beyond roughly 30,000 stitches get stiff and take over an hour; a hoop-sized
          design usually lands between 10,000 and 25,000.
        </p>
      </PanelSection>
    </>
  );
}
