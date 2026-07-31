import { create } from 'zustand';
import {
  parseCustomLibrary,
  serializeCustomLibrary,
  type LibraryShape,
} from '@embroider-design/engine';

/**
 * The user's own shape library, and their opinion about the shipped one.
 *
 * Kept apart from the document store on purpose: these shapes outlive any one
 * design, and a design that used one carries its geometry baked in, so the
 * library is a convenience and never something a project file depends on. Move
 * an `.embd` to a machine that has never seen the shape and it still opens
 * complete.
 *
 * The whole library is rewritten on every change. It is a handful of kilobytes,
 * and one write is atomic enough that an interrupted save leaves the previous
 * library rather than a half-written one. Everything that changes more than one
 * thing at a time therefore goes through a single `persist` rather than looping
 * over a single-item call.
 */

interface CustomShapeState {
  shapes: LibraryShape[];
  /** Ids of shipped icons put away — see `CustomShapeLibrary.hidden`. */
  hidden: ReadonlySet<string>;
  loading: boolean;
  /** Set when the library could not be read or written. Shown, not thrown. */
  error: string | null;
  loaded: boolean;

  load(): Promise<void>;
  save(shape: LibraryShape): Promise<boolean>;
  /** Adds a whole batch in one write. */
  saveMany(shapes: readonly LibraryShape[]): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  /** Deletes a batch in one write. */
  removeMany(ids: readonly string[]): Promise<boolean>;
  rename(id: string, name: string): Promise<boolean>;
  /** Moves shapes into a collection, or out of one when `collection` is null. */
  moveToCollection(ids: readonly string[], collection: string | null): Promise<boolean>;
  hide(ids: readonly string[]): Promise<boolean>;
  unhide(ids: readonly string[]): Promise<boolean>;
  /** Brings every hidden icon back. */
  unhideAll(): Promise<boolean>;
  shapeById(id: string): LibraryShape | null;
}

export const useCustomShapeStore = create<CustomShapeState>((set, get) => {
  const persist = async (
    shapes: LibraryShape[],
    hidden: ReadonlySet<string>,
  ): Promise<boolean> => {
    const ok = await window.embroider.writeCustomShapes(
      serializeCustomLibrary({ version: 1, shapes, hidden: [...hidden] }),
    );
    set({
      shapes,
      hidden,
      error: ok ? null : 'Your shapes could not be saved to disk.',
    });
    return ok;
  };

  const withShapes = (shapes: LibraryShape[]): Promise<boolean> => persist(shapes, get().hidden);
  const withHidden = (hidden: ReadonlySet<string>): Promise<boolean> =>
    persist(get().shapes, hidden);

  return {
    shapes: [],
    hidden: new Set<string>(),
    loading: false,
    error: null,
    loaded: false,

    load: async () => {
      if (get().loading) return;
      set({ loading: true });
      try {
        const text = await window.embroider.readCustomShapes();
        // A missing file is a machine that has not saved a shape yet, which is
        // every machine on the day it installs the app.
        const library = parseCustomLibrary(text);
        set({ shapes: library.shapes, hidden: new Set(library.hidden), error: null });
      } catch {
        set({ error: 'Your saved shapes could not be read.' });
      } finally {
        set({ loading: false, loaded: true });
      }
    },

    save: async (shape) => {
      // Saving under an id that already exists replaces it, which is what
      // "update this shape" has to mean.
      const existing = get().shapes.filter((entry) => entry.id !== shape.id);
      return withShapes([...existing, shape]);
    },

    /**
     * One write for the whole batch, rather than `save` in a loop.
     *
     * Importing a sheet adds thirty shapes at once. Thirty calls to `save`
     * would be thirty IPC round trips each rewriting the entire library, and a
     * failure at the twentieth would leave two thirds of a sheet on disk with
     * nothing to say so.
     */
    saveMany: async (shapes) => {
      if (shapes.length === 0) return true;
      const incoming = new Set(shapes.map((shape) => shape.id));
      const existing = get().shapes.filter((entry) => !incoming.has(entry.id));
      return withShapes([...existing, ...shapes]);
    },

    remove: async (id) => withShapes(get().shapes.filter((shape) => shape.id !== id)),

    removeMany: async (ids) => {
      if (ids.length === 0) return true;
      const doomed = new Set(ids);
      return withShapes(get().shapes.filter((shape) => !doomed.has(shape.id)));
    },

    rename: async (id, name) => {
      const trimmed = name.trim();
      if (trimmed.length === 0) return false;
      return withShapes(
        get().shapes.map((shape) => (shape.id === id ? { ...shape, name: trimmed } : shape)),
      );
    },

    moveToCollection: async (ids, collection) => {
      if (ids.length === 0) return true;
      const moving = new Set(ids);
      const trimmed = collection?.trim();
      return withShapes(
        get().shapes.map((shape) => {
          if (!moving.has(shape.id)) return shape;
          if (trimmed) return { ...shape, collection: trimmed };
          // Removed rather than set to an empty string: `coerceCollectionName`
          // would drop an empty one on the next read anyway, and a shape whose
          // collection is `''` would sort into a chip with no name.
          const loose = { ...shape };
          delete loose.collection;
          return loose;
        }),
      );
    },

    hide: async (ids) => {
      if (ids.length === 0) return true;
      return withHidden(new Set([...get().hidden, ...ids]));
    },

    unhide: async (ids) => {
      if (ids.length === 0) return true;
      const next = new Set(get().hidden);
      for (const id of ids) next.delete(id);
      return withHidden(next);
    },

    unhideAll: async () => withHidden(new Set<string>()),

    shapeById: (id) => get().shapes.find((shape) => shape.id === id) ?? null,
  };
});
