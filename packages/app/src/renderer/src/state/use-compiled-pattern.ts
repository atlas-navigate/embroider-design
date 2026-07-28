import { useEffect, useRef, useState } from 'react';
import {
  compileDesignDocument,
  type CompileResult,
  type DesignDocument,
} from '@embroider-design/engine';
import { useDocumentStore } from './document-store.js';
import { useFontStore } from './font-store.js';

/**
 * Recompiles the design when it changes, and not before.
 *
 * Digitizing is not cheap — a page of lettering is a few hundred milliseconds
 * of skeletonisation — so this debounces, and it never runs during a drag.
 * Preview and export share the single result, which is what keeps "what you
 * see" and "what you export" the same thing by construction.
 */

const DEBOUNCE_MS = 180;

export interface CompileState {
  result: CompileResult | null;
  compiling: boolean;
  /** How long the last compile took, shown in the status bar. */
  durationMs: number;
  error: string | null;
}

export function useCompiledPattern(): CompileState {
  const document = useDocumentStore((state) => state.document);
  const loadedFonts = useFontStore((state) => state.loaded);
  const entryFor = useFontStore((state) => state.entryFor);
  const ensureLoaded = useFontStore((state) => state.ensureLoaded);

  const [state, setState] = useState<CompileState>({
    result: null,
    compiling: false,
    durationMs: 0,
    error: null,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Any font a text layer names has to be parsed before the compile can use
  // it; kick that off here and let the resulting store update retrigger us.
  useEffect(() => {
    for (const layer of document.layers) {
      if (layer.kind !== 'text') continue;
      const entry = entryFor(layer.font);
      if (entry && !loadedFonts.has(entry.path)) void ensureLoaded(entry.path);
    }
  }, [document, loadedFonts, entryFor, ensureLoaded]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setState((previous) => ({ ...previous, compiling: true }));

    timer.current = setTimeout(() => {
      const started = performance.now();
      try {
        const result = compileDesignDocument(document as DesignDocument, {
          resolveFont: (reference) => {
            const entry = entryFor(reference);
            return entry ? (loadedFonts.get(entry.path) ?? null) : null;
          },
        });
        setState({
          result,
          compiling: false,
          durationMs: performance.now() - started,
          error: null,
        });
      } catch (error) {
        setState({
          result: null,
          compiling: false,
          durationMs: performance.now() - started,
          error: error instanceof Error ? error.message : 'Could not generate stitches',
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [document, loadedFonts, entryFor]);

  return state;
}
