import { threadToHex, type CompileResult, type Layer } from '@embroider-design/engine';
import { useDocumentStore } from '../state/document-store.js';

/**
 * The layer stack.
 *
 * Order is not cosmetic here — it is the order the machine sews in, so the
 * list reads bottom-of-the-stack-last, and each row shows what the layer
 * actually compiled to. A layer that silently produced nothing is the single
 * most confusing thing an embroidery editor can do, so it says so.
 */

const KIND_LABEL: Record<Layer['kind'], string> = {
  shape: 'Shape',
  text: 'Text',
  image: 'Traced',
  stitch: 'Imported',
};

interface LayerPanelProps {
  compiled: CompileResult | null;
}

export function LayerPanel({ compiled }: LayerPanelProps): JSX.Element {
  const layers = useDocumentStore((state) => state.document.layers);
  const selectedLayerId = useDocumentStore((state) => state.selectedLayerId);
  const selectLayer = useDocumentStore((state) => state.selectLayer);
  const updateLayer = useDocumentStore((state) => state.updateLayer);
  const removeLayer = useDocumentStore((state) => state.removeLayer);
  const duplicateLayer = useDocumentStore((state) => state.duplicateLayer);
  const moveLayer = useDocumentStore((state) => state.moveLayer);

  if (layers.length === 0) {
    return (
      <div className="panel-empty">
        <p>No layers yet.</p>
        <p className="muted">
          Draw a shape, place some text, or import an image to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="layer-list">
      {/* Last sewn at the bottom of the list, like the stack it represents. */}
      {[...layers].reverse().map((layer, reverseIndex) => {
        const index = layers.length - 1 - reverseIndex;
        const result = compiled?.layers.find((entry) => entry.layerId === layer.id);
        const selected = layer.id === selectedLayerId;
        return (
          <div
            key={layer.id}
            className={selected ? 'layer-row layer-row-selected' : 'layer-row'}
            onClick={() => selectLayer(layer.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') selectLayer(layer.id);
            }}
          >
            <button
              type="button"
              className="icon-button"
              title={layer.visible ? 'Hide' : 'Show'}
              onClick={(event) => {
                event.stopPropagation();
                updateLayer(layer.id, { visible: !layer.visible });
              }}
            >
              {layer.visible ? '◉' : '○'}
            </button>
            <span className="swatch" style={{ background: threadToHex(layer.thread) }} />
            <div className="layer-main">
              <input
                className="layer-name"
                value={layer.name}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => updateLayer(layer.id, { name: event.target.value })}
              />
              <span className="layer-meta">
                {KIND_LABEL[layer.kind]}
                {result && !result.skipped && (
                  <>
                    {' · '}
                    {summariseTypes(result.types)}
                    {' · '}
                    {result.stitchCount.toLocaleString()} stitches
                  </>
                )}
                {result?.skipped && layer.visible && (
                  <span className="warn"> · nothing generated</span>
                )}
                {!layer.visible && ' · hidden'}
              </span>
            </div>
            <div className="layer-actions">
              <button
                type="button"
                className="icon-button"
                title={layer.locked ? 'Unlock' : 'Lock'}
                onClick={(event) => {
                  event.stopPropagation();
                  updateLayer(layer.id, { locked: !layer.locked });
                }}
              >
                {layer.locked ? '🔒' : '🔓'}
              </button>
              <button
                type="button"
                className="icon-button"
                title="Sew later"
                disabled={index === layers.length - 1}
                onClick={(event) => {
                  event.stopPropagation();
                  moveLayer(layer.id, 1);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-button"
                title="Sew earlier"
                disabled={index === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  moveLayer(layer.id, -1);
                }}
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-button"
                title="Duplicate"
                onClick={(event) => {
                  event.stopPropagation();
                  duplicateLayer(layer.id);
                }}
              >
                ⧉
              </button>
              <button
                type="button"
                className="icon-button danger"
                title="Delete"
                onClick={(event) => {
                  event.stopPropagation();
                  removeLayer(layer.id);
                }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function summariseTypes(types: readonly string[]): string {
  if (types.length === 0) return '—';
  const counts = new Map<string, number>();
  for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => (count > 1 ? `${count}x ${type}` : type))
    .join(', ');
}
