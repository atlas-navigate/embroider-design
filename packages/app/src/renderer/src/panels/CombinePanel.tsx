import { useMemo, useState } from 'react';
import { mmToUnits, type BooleanOp } from '@embroider-design/engine';
import { useDocumentStore } from '../state/document-store.js';
import { useFontStore } from '../state/font-store.js';
import {
  applyCombine,
  applyHollow,
  applyOutline,
  combinableSelection,
  saveSelectionAsShape,
} from '../state/shape-actions.js';
import { PanelSection, SliderField } from '../components/controls.js';

/**
 * Cutting, hollowing and keeping the result.
 *
 * The panel lives at the top of the properties tab rather than in a tab of its
 * own, because these are things you do *to* the shapes you have just selected,
 * and a tab switch in between takes the selection out of view at the moment it
 * matters most.
 *
 * Every button says what it does to the stack in plain words. "Subtract" is
 * meaningless on its own; "cuts the shapes on top out of the bottom one" is
 * not, and it is the part people get wrong.
 *
 * The operations themselves live in `state/shape-actions.ts`, shared with the
 * Shape menu so the two can never drift apart.
 */

const DEFAULT_WALL_MM = 2;

const OPERATIONS: { op: BooleanOp; label: string; title: string }[] = [
  { op: 'union', label: 'Weld', title: 'Merge the selection into one shape' },
  { op: 'difference', label: 'Subtract', title: 'Cut the shapes on top out of the bottom one' },
  { op: 'intersection', label: 'Overlap', title: 'Keep only where every shape overlaps' },
  { op: 'xor', label: 'Exclude', title: 'Keep everything except the overlap' },
];

export function CombinePanel(): JSX.Element | null {
  const selectedLayerIds = useDocumentStore((state) => state.selectedLayerIds);
  const layers = useDocumentStore((state) => state.document.layers);
  // Not read directly, but the panel has to re-measure what is combinable when
  // a font finishes loading: text has no outline until then.
  const loadedFonts = useFontStore((state) => state.loaded);

  const [wallMm, setWallMm] = useState(DEFAULT_WALL_MM);
  const [shapeName, setShapeName] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const { selectedCount, usableCount, hasText } = useMemo(() => {
    const ids = new Set(selectedLayerIds);
    const selected = layers.filter((layer) => ids.has(layer.id));
    const usable = combinableSelection();
    return {
      selectedCount: selected.length,
      usableCount: usable.length,
      hasText: usable.some((layer) => layer.kind === 'text'),
    };
    // `loadedFonts` is the dependency that matters here; see above.
  }, [selectedLayerIds, layers, loadedFonts]);

  if (selectedCount === 0) return null;

  const skipped = selectedCount - usableCount;

  return (
    <PanelSection title="Combine shapes">
      {usableCount < 2 ? (
        <p className="muted small">Select two or more shapes to weld, subtract or overlap them.</p>
      ) : (
        <>
          <div className="button-row">
            {OPERATIONS.map((entry) => (
              <button
                key={entry.op}
                type="button"
                title={entry.title}
                onClick={() => setStatus(applyCombine(entry.op))}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <p className="muted small">
            Subtract cuts the shapes on top out of the bottom one. The result keeps the bottom
            layer&apos;s colour and stitch settings, and takes its place in the sewing order.
          </p>
        </>
      )}

      {usableCount > 0 && (
        <>
          <SliderField
            label="Wall thickness"
            hint="For hollowing a shape into an outline"
            value={wallMm}
            min={0.5}
            max={15}
            step={0.5}
            format={(v) => `${v.toFixed(1)} mm`}
            onChange={setWallMm}
          />
          <div className="button-row">
            <button
              type="button"
              onClick={() => setStatus(applyHollow(mmToUnits(wallMm)))}
              title="Cut the middle out, leaving a wall of the thickness above"
            >
              Hollow
            </button>
            {hasText && (
              <button
                type="button"
                onClick={() => setStatus(applyOutline())}
                title="Freeze the lettering into shapes that can be cut"
              >
                Text to outlines
              </button>
            )}
          </div>
        </>
      )}

      {skipped > 0 && (
        <p className="muted small">
          {skipped} selected layer{skipped === 1 ? ' has' : 's have'} no outline to work with and
          will be left alone — imported stitches, or text whose font is missing.
        </p>
      )}

      {usableCount > 0 && (
        <div className="field">
          <span className="field-label">Save as a shape</span>
          <span className="number-input">
            <input
              type="text"
              value={shapeName}
              placeholder="Name it…"
              onChange={(event) => setShapeName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                void saveSelectionAsShape(shapeName).then((message) => {
                  setStatus(message);
                  setShapeName('');
                });
              }}
            />
            <button
              type="button"
              onClick={() => {
                void saveSelectionAsShape(shapeName).then((message) => {
                  setStatus(message);
                  setShapeName('');
                });
              }}
            >
              Save
            </button>
          </span>
        </div>
      )}

      {status && <p className="muted small">{status}</p>}
    </PanelSection>
  );
}
