import { describe, expect, it } from 'vitest';
import {
  CUSTOM_LIBRARY_VERSION,
  parseCustomLibrary,
  parseCustomShapes,
  serializeCustomLibrary,
  serializeCustomShapes,
} from '../../src/library/custom-shape.js';
import type { LibraryShape } from '../../src/library/types.js';

/**
 * What survives a trip through the user's library file.
 *
 * This file lives in a profile directory where a bad shutdown can truncate it,
 * and it is read at every launch before the Shapes panel can draw anything.
 * The reader is therefore forgiving by design — losing one saved shape is an
 * annoyance, an app that will not open its library is broken — so these tests
 * are mostly about the forgiveness being deliberate rather than accidental.
 */

const TRIANGLE = 'M 0 0 L 10 0 L 10 10 Z';

function shape(overrides: Partial<LibraryShape> = {}): LibraryShape {
  return {
    id: 'a',
    name: 'A shape',
    category: 'custom',
    parts: [{ name: 'Part', d: TRIANGLE }],
    ...overrides,
  };
}

function stored(record: Record<string, unknown>): string {
  return JSON.stringify({ version: CUSTOM_LIBRARY_VERSION, ...record });
}

describe('collections', () => {
  it('survives serialize and parse', () => {
    const [restored] = parseCustomShapes(
      serializeCustomShapes([shape({ collection: 'Autumn', name: 'Acorn' })]),
    );
    expect(restored.collection).toBe('Autumn');
    expect(restored.name).toBe('Acorn');
  });

  it('reads a library written before collections existed', () => {
    const [restored] = parseCustomShapes(stored({ shapes: [{ id: 'a', name: 'Old', parts: [{ d: TRIANGLE }] }] }));
    expect(restored.collection).toBeUndefined();
    expect(restored.name).toBe('Old');
  });

  it('drops a collection that is not a usable name', () => {
    const shapes = parseCustomShapes(
      stored({
        shapes: [
          { id: 'a', name: 'A', collection: 42, parts: [{ d: TRIANGLE }] },
          { id: 'b', name: 'B', collection: '   ', parts: [{ d: TRIANGLE }] },
          { id: 'c', name: 'C', collection: null, parts: [{ d: TRIANGLE }] },
        ],
      }),
    );
    expect(shapes).toHaveLength(3);
    for (const entry of shapes) expect(entry.collection).toBeUndefined();
  });

  it('caps a name rather than letting it become the panel', () => {
    const [restored] = parseCustomShapes(
      stored({ shapes: [{ id: 'a', name: 'A', collection: 'x'.repeat(500), parts: [{ d: TRIANGLE }] }] }),
    );
    expect(restored.collection?.length).toBeLessThanOrEqual(40);
  });
});

describe('hidden icons', () => {
  it('survives serialize and parse', () => {
    const text = serializeCustomLibrary({
      version: CUSTOM_LIBRARY_VERSION,
      shapes: [shape()],
      hidden: ['halloween-pumpkin', 'christmas-tree'],
    });
    const library = parseCustomLibrary(text);
    expect(library.hidden).toEqual(['halloween-pumpkin', 'christmas-tree']);
    expect(library.shapes).toHaveLength(1);
  });

  it('reads a library written before hiding existed', () => {
    // The panel gets an empty list, never undefined — it builds a Set from this
    // on every load and would throw on the first launch after an upgrade.
    expect(parseCustomLibrary(stored({ shapes: [] })).hidden).toEqual([]);
    expect(parseCustomLibrary(null).hidden).toEqual([]);
    expect(parseCustomLibrary('not json').hidden).toEqual([]);
  });

  it('dedupes, and ignores entries that are not ids', () => {
    const library = parseCustomLibrary(
      stored({ shapes: [], hidden: ['a', 'a', '', 7, null, { id: 'b' }, 'c'] }),
    );
    expect(library.hidden).toEqual(['a', 'c']);
  });

  it('keeps an id it does not recognise', () => {
    // An id matching nothing today is an icon from a version this build does
    // not have. Dropping it would un-hide it the moment the user upgrades.
    expect(parseCustomLibrary(stored({ shapes: [], hidden: ['from-the-future'] })).hidden).toEqual([
      'from-the-future',
    ]);
  });

  it('refuses a library from a newer version outright', () => {
    const future = JSON.stringify({
      version: CUSTOM_LIBRARY_VERSION + 1,
      shapes: [shape()],
      hidden: ['a'],
    });
    const library = parseCustomLibrary(future);
    expect(library.shapes).toEqual([]);
    expect(library.hidden).toEqual([]);
  });

  it('leaves the shapes readable by a build that has never heard of hiding', () => {
    // The version is not bumped for `hidden`, so an older build has to be able
    // to read this file. It reads `shapes` and ignores the rest, which means
    // the icons simply reappear there — the right failure.
    const text = serializeCustomLibrary({
      version: CUSTOM_LIBRARY_VERSION,
      shapes: [shape({ name: 'Still here' })],
      hidden: ['halloween-pumpkin'],
    });
    const asOldBuildSees = JSON.parse(text) as { version: number; shapes: { name: string }[] };
    expect(asOldBuildSees.version).toBe(CUSTOM_LIBRARY_VERSION);
    expect(asOldBuildSees.shapes[0].name).toBe('Still here');
  });
});

describe('the reader stays forgiving', () => {
  it('drops one unreadable shape rather than the whole library', () => {
    const shapes = parseCustomShapes(
      stored({
        shapes: [
          { id: 'a', name: 'Good', parts: [{ d: TRIANGLE }] },
          { id: 'b', name: 'Bad', parts: [{ d: 'M 0 0 A 1 1' }] },
          { id: 'c', name: 'Also good', parts: [{ d: TRIANGLE }] },
        ],
      }),
    );
    expect(shapes.map((entry) => entry.name)).toEqual(['Good', 'Also good']);
  });

  it('refuses a second shape sharing an id', () => {
    const shapes = parseCustomShapes(
      stored({
        shapes: [
          { id: 'a', name: 'First', parts: [{ d: TRIANGLE }] },
          { id: 'a', name: 'Second', parts: [{ d: TRIANGLE }] },
        ],
      }),
    );
    expect(shapes).toHaveLength(1);
    expect(shapes[0].name).toBe('First');
  });
});
