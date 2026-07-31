import { create } from 'zustand';
import {
  parseCustomShapes,
  serializeCustomShapes,
  type LibraryShape,
} from '@embroider-design/engine';

/**
 * The user's own shape library.
 *
 * Kept apart from the document store on purpose: these shapes outlive any one
 * design, and a design that used one carries its geometry baked in, so the
 * library is a convenience and never something a project file depends on. Move
 * an `.embd` to a machine that has never seen the shape and it still opens
 * complete.
 *
 * The whole library is rewritten on every change. It is a handful of kilobytes,
 * and one write is atomic enough that an interrupted save leaves the previous
 * library rather than a half-written one.
 */

interface CustomShapeState {
  shapes: LibraryShape[];
  loading: boolean;
  /** Set when the library could not be read or written. Shown, not thrown. */
  error: string | null;
  loaded: boolean;

  load(): Promise<void>;
  save(shape: LibraryShape): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  rename(id: string, name: string): Promise<boolean>;
  shapeById(id: string): LibraryShape | null;
}

export const useCustomShapeStore = create<CustomShapeState>((set, get) => {
  const persist = async (shapes: LibraryShape[]): Promise<boolean> => {
    const ok = await window.embroider.writeCustomShapes(serializeCustomShapes(shapes));
    set({
      shapes,
      error: ok ? null : 'Your shapes could not be saved to disk.',
    });
    return ok;
  };

  return {
    shapes: [],
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
        set({ shapes: parseCustomShapes(text), error: null });
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
      return persist([...existing, shape]);
    },

    remove: async (id) => persist(get().shapes.filter((shape) => shape.id !== id)),

    rename: async (id, name) => {
      const trimmed = name.trim();
      if (trimmed.length === 0) return false;
      return persist(
        get().shapes.map((shape) => (shape.id === id ? { ...shape, name: trimmed } : shape)),
      );
    },

    shapeById: (id) => get().shapes.find((shape) => shape.id === id) ?? null,
  };
});
