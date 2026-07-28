import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  threadToHex,
  unitsToMm,
  type CompileResult,
} from '@embroider-design/engine';
import { useDocumentStore } from '../state/document-store.js';
import { DARK_THEME, drawHoop, toDocument } from './render.js';
import { drawPattern } from './preview-render.js';

/**
 * The stitch-out preview.
 *
 * This draws the compiled pattern and nothing else — every line on screen is a
 * stitch the machine will make. Playback exists because a static picture hides
 * the two things that actually go wrong: a jump across the design that should
 * have been a trim, and a colour order that makes you rethread twice.
 */

interface StitchPreviewProps {
  compiled: CompileResult | null;
}

const SPEEDS = [
  { label: '1x', stitchesPerFrame: 8 },
  { label: '4x', stitchesPerFrame: 32 },
  { label: '16x', stitchesPerFrame: 128 },
];

export function StitchPreview({ compiled }: StitchPreviewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);

  const document = useDocumentStore((state) => state.document);
  const view = useDocumentStore((state) => state.view);
  const showGrid = useDocumentStore((state) => state.showGrid);
  const store = useDocumentStore;

  const total = compiled?.pattern.stitches.length ?? 0;
  const [position, setPosition] = useState(total);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showJumps, setShowJumps] = useState(true);
  const [hiddenBlocks, setHiddenBlocks] = useState<Set<number>>(new Set());

  const blocks = useMemo(() => compiled?.pattern.getColorBlocks() ?? [], [compiled]);

  // A recompile changes the stitch list under us; jump to the end rather than
  // leaving the scrubber pointing at a stitch that no longer exists.
  useEffect(() => {
    setPosition(total);
    setPlaying(false);
  }, [total]);

  const visibleBlocks = useMemo(() => {
    if (hiddenBlocks.size === 0) return undefined;
    const visible = new Set<number>();
    for (let i = 0; i < blocks.length; i++) if (!hiddenBlocks.has(i)) visible.add(i);
    return visible;
  }, [hiddenBlocks, blocks.length]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ratio = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = DARK_THEME.background;
    context.fillRect(0, 0, width, height);
    drawHoop(context, view, document, DARK_THEME, showGrid);

    if (compiled) {
      drawPattern(context, view, compiled.pattern, {
        showJumps,
        upTo: position,
        visibleBlocks,
        showNeedle: playing || position < total,
      });
    }
  }, [compiled, view, document, showGrid, showJumps, position, visibleBlocks, playing, total]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = (): void => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  useEffect(() => {
    if (!playing) return;
    const step = (): void => {
      setPosition((current) => {
        const next = current + SPEEDS[speed].stitchesPerFrame;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [playing, speed, total]);

  const toggleBlock = (index: number): void => {
    setHiddenBlocks((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const onWheel = (event: React.WheelEvent<HTMLCanvasElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    store
      .getState()
      .zoomBy(
        event.deltaY < 0 ? 1.12 : 1 / 1.12,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
  };

  const panRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { x: event.clientX, y: event.clientY, panX: view.panX, panY: view.panY };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const pan = panRef.current;
    if (!pan) return;
    store.getState().setView({
      panX: pan.panX + (event.clientX - pan.x),
      panY: pan.panY + (event.clientY - pan.y),
    });
  };
  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  void toDocument;

  return (
    <div className="preview-host">
      <div className="canvas-host" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="design-canvas preview-canvas"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <div className="playback">
        <button
          type="button"
          className="playback-button"
          onClick={() => {
            if (position >= total) setPosition(0);
            setPlaying((value) => !value);
          }}
          disabled={total === 0}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className="playback-button"
          onClick={() => {
            setPlaying(false);
            setPosition(total);
          }}
          disabled={total === 0}
        >
          Show all
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(1, total)}
          value={position}
          onChange={(event) => {
            setPlaying(false);
            setPosition(Number(event.target.value));
          }}
          disabled={total === 0}
          aria-label="Stitch position"
        />
        <span className="playback-count">
          {position.toLocaleString()} / {total.toLocaleString()}
        </span>
        <div className="playback-speeds">
          {SPEEDS.map((entry, index) => (
            <button
              key={entry.label}
              type="button"
              className={index === speed ? 'chip chip-active' : 'chip'}
              onClick={() => setSpeed(index)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={showJumps}
            onChange={(event) => setShowJumps(event.target.checked)}
          />
          Jumps &amp; trims
        </label>
      </div>

      {blocks.length > 0 && (
        <div className="block-legend">
          {blocks.map((block, index) => (
            <button
              key={`${index}-${threadToHex(block.thread)}`}
              type="button"
              className={hiddenBlocks.has(index) ? 'legend-item legend-hidden' : 'legend-item'}
              onClick={() => toggleBlock(index)}
              title={hiddenBlocks.has(index) ? 'Show this colour' : 'Hide this colour'}
            >
              <span className="swatch" style={{ background: threadToHex(block.thread) }} />
              <span className="legend-label">
                {index + 1}. {block.thread.description ?? threadToHex(block.thread)}
              </span>
              <span className="legend-count">{block.stitches.length.toLocaleString()}</span>
            </button>
          ))}
          {compiled?.bounds && (
            <span className="legend-size">
              {unitsToMm(compiled.bounds.maxX - compiled.bounds.minX).toFixed(0)} x{' '}
              {unitsToMm(compiled.bounds.maxY - compiled.bounds.minY).toFixed(0)} mm
            </span>
          )}
        </div>
      )}
    </div>
  );
}
