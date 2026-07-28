import { useMemo, useState } from 'react';
import {
  FORMATS,
  unitsToMm,
  writePattern,
  type CompileResult,
  type FormatId,
} from '@embroider-design/engine';
import { useDocumentStore } from '../state/document-store.js';
import { CheckboxField, PanelSection } from '../components/controls.js';

/**
 * Export.
 *
 * The numbers above the button are the ones that decide whether a design is
 * worth sewing — stitch count is time and stiffness, colour blocks are
 * rethreads, and a design that does not fit the hoop cannot be sewn at all —
 * so they are shown before the format list rather than after it.
 */

interface ExportPanelProps {
  compiled: CompileResult | null;
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return 'under a minute';
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole} min`;
  return `${Math.floor(whole / 60)} h ${whole % 60} min`;
}

export function ExportPanel({ compiled }: ExportPanelProps): JSX.Element {
  const name = useDocumentStore((state) => state.document.name);
  const [center, setCenter] = useState(true);
  const [busy, setBusy] = useState<FormatId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const jumpCount = useMemo(() => {
    if (!compiled) return 0;
    return compiled.pattern.getStatistics().jumpCount;
  }, [compiled]);

  const exportAs = async (id: FormatId): Promise<void> => {
    if (!compiled || compiled.totalStitches === 0) return;
    const format = FORMATS.find((entry) => entry.id === id);
    if (!format) return;
    setBusy(id);
    setError(null);
    setMessage(null);
    try {
      const data = writePattern(compiled.pattern, id, { center, name });
      const saved = await window.embroider.exportPattern(
        {
          suggestedName: `${name || 'design'}${format.extension}`,
          extension: format.extension,
          formatName: format.name,
        },
        data,
      );
      if (saved) setMessage(`Wrote ${(data.length / 1024).toFixed(0)} KB to ${saved}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not write ${format.name}`);
    } finally {
      setBusy(null);
    }
  };

  const empty = !compiled || compiled.totalStitches === 0;

  return (
    <>
      <PanelSection title="This design">
        {empty ? (
          <p className="muted small">Nothing to export yet.</p>
        ) : (
          <dl className="stat-grid">
            <dt>Stitches</dt>
            <dd>{compiled.totalStitches.toLocaleString()}</dd>
            <dt>Thread changes</dt>
            <dd>{Math.max(0, compiled.colorBlocks - 1)}</dd>
            <dt>Jumps</dt>
            <dd>{jumpCount.toLocaleString()}</dd>
            <dt>Size</dt>
            <dd>
              {compiled.bounds
                ? `${unitsToMm(compiled.bounds.maxX - compiled.bounds.minX).toFixed(1)} x ${unitsToMm(
                    compiled.bounds.maxY - compiled.bounds.minY,
                  ).toFixed(1)} mm`
                : '—'}
            </dd>
            <dt>Sewing time</dt>
            <dd>{formatDuration(compiled.estimatedMinutes)}</dd>
          </dl>
        )}
        {compiled && !compiled.hoopFit.fits && (
          <p className="warn small">
            {compiled.hoopFit.message} The machine will refuse it, or the hoop will foul the
            needle — fix it on the Hoop tab before exporting.
          </p>
        )}
        {compiled && compiled.totalStitches > 30000 && (
          <p className="warn small">
            Over 30,000 stitches. That is more than an hour of sewing and the fabric will go stiff;
            consider fewer colours, a coarser fill density, or a smaller design.
          </p>
        )}
      </PanelSection>

      <PanelSection title="Options">
        <CheckboxField
          label="Centre on the machine origin"
          hint="What the machine expects — leave this on"
          checked={center}
          onChange={setCenter}
        />
      </PanelSection>

      <PanelSection title="Save as">
        <div className="format-list">
          {FORMATS.map((format) => (
            <div key={format.id} className="format-row">
              <div className="format-main">
                <div className="format-name">
                  {format.name}
                  <span className="format-ext">{format.extension}</span>
                </div>
                <div className="format-description">
                  {format.description}
                  {!format.storesColor &&
                    ' Colours are lost — write them down before you sew.'}
                </div>
              </div>
              <button
                type="button"
                className={format.id === 'pes' ? 'primary' : ''}
                disabled={empty || busy !== null}
                onClick={() => void exportAs(format.id)}
              >
                {busy === format.id ? 'Saving…' : 'Export'}
              </button>
            </div>
          ))}
        </div>
        {message && <p className="ok small">{message}</p>}
        {error && <p className="warn small">{error}</p>}
      </PanelSection>

      <PanelSection title="Getting it onto the PE900">
        <p className="muted small">
          Export as PES, copy the file to a USB stick formatted FAT32, and plug it into the
          machine&rsquo;s USB port. Keep the file in the root folder — the PE900 does not browse
          deeply nested directories reliably.
        </p>
        <p className="muted small">
          Nothing here has been sewn on a real machine. Run a small test stitch-out on scrap
          fabric before committing a design to anything you care about.
        </p>
      </PanelSection>
    </>
  );
}
