import { useEffect, useMemo, useState } from 'react';
import {
  assessSuitability,
  capHeightOf,
  categoriesPresent,
  classifyFont,
  FONT_CATEGORY_LABELS,
  measureStrokeWidth,
  minimumUsableCapHeight,
  mmToUnits,
  resolveStitchSettings,
  sizeForCapHeight,
  unitsToMm,
  MAX_SWEEP_DEGREES,
  sweepOf,
  type FontCatalogEntry,
  type FontCategory,
  type SuitabilityReport,
  type TextAlign,
  type TextLayer,
  type TextShape,
} from '@embroider-design/engine';
import { useDocumentStore } from '../state/document-store.js';
import { useFontStore } from '../state/font-store.js';
import { NumberField, PanelSection, SelectField, SliderField } from '../components/controls.js';

/**
 * Text layer controls.
 *
 * The important part is the suitability readout. Choosing a font by how it
 * looks on screen is how people end up with 0.4 mm strokes that vanish into
 * the fabric, so the panel measures the real outlines at the chosen size and
 * says plainly whether they will hold as satin — and what size would.
 */

const ALIGNMENTS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
];

/**
 * The curve control is one number, the way people expect it.
 *
 * −100 to 100 maps onto a full turn either way, so the extremes are the two
 * halves of a patch — the top text arching over and the bottom text curving
 * under it — and the middle is straight.
 */
const CURVE_RANGE = 100;

function curveToSweep(curve: number): number {
  return (curve / CURVE_RANGE) * MAX_SWEEP_DEGREES;
}

function sweepToCurve(sweep: number): number {
  return Math.round((sweep / MAX_SWEEP_DEGREES) * CURVE_RANGE);
}

/**
 * The presets, in the order someone reaches for them. Each is a real value of
 * the same curve control, so picking one and then dragging the slider does
 * something sensible rather than fighting it.
 */
const SHAPE_PRESETS: { label: string; title: string; shape: TextShape }[] = [
  { label: 'Straight', title: 'No curve', shape: { type: 'none' } },
  { label: 'Arch', title: 'Curve upward, like the top of a patch', shape: { type: 'arc', sweep: 90 } },
  { label: 'Valley', title: 'Curve downward, like the bottom of a patch', shape: { type: 'arc', sweep: -90 } },
  { label: 'Full circle', title: 'Close the line into a ring', shape: { type: 'arc', sweep: 360 } },
  {
    label: 'Bottom ring',
    title: 'Read the right way up along the bottom of a ring',
    shape: { type: 'arc', sweep: -360 },
  },
  { label: 'Wave', title: 'Ripple the baseline', shape: { type: 'wave', amplitude: 0, cycles: 2 } },
];

function shapeMatches(shape: TextShape | undefined, preset: TextShape): boolean {
  const current = shape ?? { type: 'none' };
  if (current.type !== preset.type) return false;
  if (current.type === 'arc' && preset.type === 'arc') return current.sweep === preset.sweep;
  return true;
}

function TextShapeControls({ layer }: { layer: TextLayer }): JSX.Element {
  const updateLayer = useDocumentStore((state) => state.updateLayer);
  const shape: TextShape = layer.shape ?? { type: 'none' };

  const setShape = (next: TextShape): void => {
    updateLayer(layer.id, {
      shape: next.type === 'none' ? undefined : next,
    } as Partial<TextLayer>);
  };

  return (
    <PanelSection title="Shape">
      <div className="shape-categories">
        {SHAPE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={shapeMatches(layer.shape, preset.shape) ? 'chip chip-active' : 'chip'}
            title={preset.title}
            onClick={() =>
              setShape(
                // The wave preset carries no amplitude of its own: give it one
                // proportional to the letter height, or choosing it looks like
                // nothing happened.
                preset.shape.type === 'wave'
                  ? { type: 'wave', amplitude: layer.size * 0.35, cycles: 2 }
                  : preset.shape,
              )
            }
          >
            {preset.label}
          </button>
        ))}
      </div>

      {shape.type !== 'wave' && (
        <>
          <SliderField
            label="Curve"
            hint="Bends the line without changing its size"
            value={sweepToCurve(sweepOf(shape))}
            min={-CURVE_RANGE}
            max={CURVE_RANGE}
            step={1}
            format={(v) => (v === 0 ? 'Straight' : `${Math.round(curveToSweep(v))}°`)}
            onChange={(value) =>
              setShape(value === 0 ? { type: 'none' } : { type: 'arc', sweep: curveToSweep(value) })
            }
          />
          <p className="muted small">
            Letters are turned to follow the curve, never stretched — a satin column has to keep
            its width to stitch evenly.
          </p>
        </>
      )}

      {shape.type === 'wave' && (
        <>
          <SliderField
            label="Wave height"
            value={unitsToMm(shape.amplitude)}
            min={0}
            max={40}
            step={0.5}
            format={(v) => `${v.toFixed(1)} mm`}
            onChange={(value) => setShape({ ...shape, amplitude: mmToUnits(value) })}
          />
          <SliderField
            label="Waves"
            value={shape.cycles}
            min={0.5}
            max={6}
            step={0.5}
            format={(v) => `${v}`}
            onChange={(value) => setShape({ ...shape, cycles: value })}
          />
        </>
      )}

      {shape.type === 'path' && (
        <p className="muted small">
          Following a custom path from the design. Pick a preset above to replace it.
        </p>
      )}
    </PanelSection>
  );
}

export function TextProperties({ layer }: { layer: TextLayer }): JSX.Element {
  const updateLayer = useDocumentStore((state) => state.updateLayer);
  const documentSettings = useDocumentStore((state) => state.document.settings);

  const catalog = useFontStore((state) => state.catalog);
  const families = useFontStore((state) => state.families);
  const loading = useFontStore((state) => state.loading);
  const progress = useFontStore((state) => state.progress);
  const loadedFonts = useFontStore((state) => state.loaded);
  const entryFor = useFontStore((state) => state.entryFor);
  const ensureLoaded = useFontStore((state) => state.ensureLoaded);
  const addFontFile = useFontStore((state) => state.addFontFile);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FontCategory | 'all'>('all');
  const entry = entryFor(layer.font);
  const font = entry ? (loadedFonts.get(entry.path) ?? null) : null;

  useEffect(() => {
    if (entry && !loadedFonts.has(entry.path)) void ensureLoaded(entry.path);
  }, [entry, loadedFonts, ensureLoaded]);

  const settings = useMemo(
    () => resolveStitchSettings({ ...documentSettings, ...layer.settings }),
    [documentSettings, layer.settings],
  );

  // Measuring rasterises a handful of glyphs, so cache it per font.
  const measurement = useMemo(() => (font ? measureStrokeWidth(font) : null), [font]);
  const report: SuitabilityReport | null = useMemo(
    () => (measurement ? assessSuitability(measurement, layer.size, settings) : null),
    [measurement, layer.size, settings],
  );
  const minimumHeight = useMemo(
    () => (font && measurement ? minimumUsableCapHeight(font, measurement, settings) : null),
    [font, measurement, settings],
  );

  /**
   * Which kinds of face this machine actually has, so the filter never offers
   * a category that would come back empty.
   */
  const categories = useMemo(() => categoriesPresent(catalog), [catalog]);

  const shownFamilies = useMemo(() => {
    let shown = families;
    if (category !== 'all') {
      // A family counts as script if any of its styles does — classification
      // works per face, and mixed families are rare but real.
      shown = shown.filter((group) => group.styles.some((style) => classifyFont(style) === category));
    }
    const needle = query.trim().toLowerCase();
    if (needle) shown = shown.filter((group) => group.family.toLowerCase().includes(needle));
    return shown;
  }, [families, query, category]);

  const selectFont = (chosen: FontCatalogEntry): void => {
    updateLayer(layer.id, {
      font: {
        path: chosen.path,
        family: chosen.family,
        subfamily: chosen.subfamily,
        postScriptName: chosen.postScriptName,
      },
    } as Partial<TextLayer>);
    void ensureLoaded(chosen.path);
  };

  const capHeight = font ? capHeightOf(font.metrics, layer.size) : layer.size * 0.7;

  return (
    <>
      <PanelSection title="Text">
        <label className="field">
          <span className="field-label">Content</span>
          <textarea
            className="text-area"
            rows={3}
            value={layer.text}
            onChange={(event) =>
              updateLayer(layer.id, { text: event.target.value } as Partial<TextLayer>)
            }
          />
        </label>

        <NumberField
          label="Letter height"
          hint="Height of a capital — what you actually measure"
          unit="mm"
          value={unitsToMm(capHeight)}
          min={2}
          max={200}
          step={1}
          decimals={1}
          onChange={(value) => {
            const target = mmToUnits(value);
            const size = font ? sizeForCapHeight(font.metrics, target) : target / 0.7;
            updateLayer(layer.id, { size } as Partial<TextLayer>);
          }}
        />
        <SelectField
          label="Alignment"
          value={layer.align}
          options={ALIGNMENTS}
          onChange={(align) => updateLayer(layer.id, { align } as Partial<TextLayer>)}
        />
        <SliderField
          label="Letter spacing"
          value={unitsToMm(layer.letterSpacing)}
          min={-2}
          max={10}
          step={0.1}
          format={(v) => `${v.toFixed(1)} mm`}
          onChange={(value) =>
            updateLayer(layer.id, { letterSpacing: mmToUnits(value) } as Partial<TextLayer>)
          }
        />
        <SliderField
          label="Line spacing"
          value={unitsToMm(layer.lineHeight ?? layer.size)}
          min={1}
          max={100}
          step={0.5}
          format={(v) => `${v.toFixed(1)} mm`}
          onChange={(value) =>
            updateLayer(layer.id, { lineHeight: mmToUnits(value) } as Partial<TextLayer>)
          }
        />
      </PanelSection>

      <TextShapeControls layer={layer} />

      {report && (
        <PanelSection title="Will it stitch?">
          <div className={`verdict verdict-${report.suitability}`}>
            <strong>
              {report.suitability === 'good'
                ? 'Good for satin'
                : report.suitability === 'thin'
                  ? 'Close to the limit'
                  : report.suitability === 'too-thin'
                    ? 'Too thin at this size'
                    : 'Will be filled, not satined'}
            </strong>
            <p>{report.message}</p>
            {report.recommendedSize !== null && font && (
              <button
                type="button"
                onClick={() =>
                  updateLayer(layer.id, {
                    size: report.recommendedSize as number,
                  } as Partial<TextLayer>)
                }
              >
                Resize to {unitsToMm(capHeightOf(font.metrics, report.recommendedSize)).toFixed(0)}{' '}
                mm letters
              </button>
            )}
          </div>
          {minimumHeight !== null && (
            <p className="muted small">
              This font needs letters of about {unitsToMm(minimumHeight).toFixed(0)} mm or taller
              to satin cleanly. A bolder weight lowers that.
            </p>
          )}
        </PanelSection>
      )}

      <PanelSection
        title="Font"
        action={
          <button type="button" className="link-button" onClick={() => void addFontFile()}>
            Add a file…
          </button>
        }
      >
        {loading && (
          <p className="muted small">
            Reading installed fonts
            {progress ? ` — ${progress.done} of ${progress.total}` : ''}…
          </p>
        )}
        {!loading && catalog.length === 0 && (
          <p className="muted small">
            No fonts found. Use “Add a file…” to point at a .ttf or .otf.
          </p>
        )}
        <input
          className="search-input"
          type="search"
          placeholder={`Search ${families.length} families`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="shape-categories">
          <button
            type="button"
            className={category === 'all' ? 'chip chip-active' : 'chip'}
            onClick={() => setCategory('all')}
          >
            All
          </button>
          {categories.map((id) => (
            <button
              key={id}
              type="button"
              className={category === id ? 'chip chip-active' : 'chip'}
              onClick={() => setCategory(id)}
            >
              {FONT_CATEGORY_LABELS[id]}
            </button>
          ))}
        </div>
        <div className="font-list">
          {shownFamilies.slice(0, 300).map((group) => (
            <div key={group.family} className="font-family">
              <div className="font-family-name">{group.family}</div>
              <div className="font-styles">
                {group.styles.map((style) => (
                  <button
                    key={style.path}
                    type="button"
                    className={
                      entry?.path === style.path ? 'chip chip-active' : 'chip'
                    }
                    onClick={() => selectFont(style)}
                    title={style.path}
                  >
                    {style.subfamily || 'Regular'}
                    {style.weight >= 700 ? ' ●' : ''}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {entry && (
          <p className="muted small">
            Using {entry.family} {entry.subfamily}. Weights marked ● are bold or heavier, which
            give a wider satin column at the same letter height.
          </p>
        )}
        {!entry && layer.font.family && (
          <p className="warn small">
            “{layer.font.family}” is not installed on this machine. Pick another font, or add the
            file.
          </p>
        )}
      </PanelSection>
    </>
  );
}
