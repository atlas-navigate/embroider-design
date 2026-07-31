import {
  canCombine,
  combineLayers,
  customShapeFromLayers,
  hollowLayer,
  outlineLayer,
  type BooleanOp,
  type FontReference,
  type Layer,
  type ShapeOpContext,
} from '@embroider-design/engine';
import { useDocumentStore } from './document-store.js';
import { useCustomShapeStore } from './custom-shape-store.js';
import { useFontStore } from './font-store.js';

/**
 * The shape operations, in one place.
 *
 * Both the Combine panel and the Shape menu run these, and they must run
 * *identically* — a menu item that subtracts in a different order from the
 * button beside it is a bug waiting to be reported as "sometimes it cuts the
 * wrong shape". Reading the stores directly rather than taking them as
 * arguments is what lets a menu handler, which has no React context, call the
 * same code the panel does.
 *
 * Each returns a message for the status bar, or `null` when it worked and there
 * is nothing to say.
 */

export function shapeOpContext(): ShapeOpContext {
  const fonts = useFontStore.getState();
  return {
    resolveFont: (reference: FontReference) => {
      const entry = fonts.entryFor(reference);
      return entry ? (fonts.loaded.get(entry.path) ?? null) : null;
    },
  };
}

/** The selection in stack order, which is the order the operations care about. */
export function selectedLayersInStackOrder(): Layer[] {
  const state = useDocumentStore.getState();
  const ids = new Set(state.selectedLayerIds);
  return state.document.layers.filter((layer) => ids.has(layer.id));
}

export function combinableSelection(context = shapeOpContext()): Layer[] {
  return selectedLayersInStackOrder().filter((layer) => canCombine(layer, context));
}

function replace(inputs: readonly Layer[], produced: readonly Layer[]): void {
  useDocumentStore.getState().replaceLayersWith(
    inputs.map((layer) => layer.id),
    produced,
  );
}

export function applyCombine(op: BooleanOp): string | null {
  const context = shapeOpContext();
  const usable = combinableSelection(context);
  const result = combineLayers(usable, op, context);
  if (!result.layer) return result.message ?? 'That did not produce a shape.';
  replace(usable, [result.layer]);
  return null;
}

export function applyHollow(wallUnits: number): string | null {
  const context = shapeOpContext();
  const usable = combinableSelection(context);
  if (usable.length === 0) return 'Select a shape to hollow.';

  const produced: Layer[] = [];
  let message: string | undefined;
  for (const layer of usable) {
    const result = hollowLayer(layer, wallUnits, context);
    if (result.layer) produced.push(result.layer);
    else message = result.message;
  }
  if (produced.length === 0) return message ?? 'Nothing there could be hollowed.';
  replace(usable, produced);
  return null;
}

export function applyOutline(): string | null {
  const context = shapeOpContext();
  const usable = combinableSelection(context);
  const produced = usable
    .map((layer) => outlineLayer(layer, context))
    .filter((layer): layer is NonNullable<typeof layer> => layer !== null);
  if (produced.length === 0) return 'Those layers have no outline to freeze.';
  replace(usable, produced);
  return null;
}

export async function saveSelectionAsShape(name: string): Promise<string> {
  const context = shapeOpContext();
  const usable = combinableSelection(context);
  const shape = customShapeFromLayers(name, usable, context);
  if (!shape) return 'Nothing in the selection has an outline to save.';
  const ok = await useCustomShapeStore.getState().save(shape);
  return ok
    ? `Saved “${shape.name}” — find it under My shapes.`
    : 'That shape could not be written to disk.';
}
