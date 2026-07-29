import { describe, expect, it } from 'vitest';
import {
  addLayer,
  assignGroup,
  clearGroup,
  createDesignDocument,
  createShapeLayer,
  expandSelectionToGroups,
  gatherGroup,
  layersInGroup,
} from '../../src/document/index.js';
import { compileDesignDocument } from '../../src/document/compile.js';
import { deserializeDocument, serializeDocument } from '../../src/document/serialization.js';
import { rectangle } from '../../src/document/shapes.js';
import { thread } from '../../src/pattern/thread.js';
import { mmToUnits } from '../../src/pattern/units.js';
import type { DesignDocument } from '../../src/document/design-document.js';

/**
 * Grouping is an editing convenience and must stay one.
 *
 * The load-bearing claim is that it changes nothing about the stitching: the
 * machine has no concept of a group, so a design that has been grouped must
 * compile to exactly the same pattern as the same design ungrouped. If that
 * ever stops being true, grouping has quietly become a stitch-order feature
 * and every saved project's output has shifted.
 */

function box(x: number, size = 20): ReturnType<typeof rectangle> {
  return rectangle(mmToUnits(x), mmToUnits(10), mmToUnits(size), mmToUnits(size));
}

function documentWith(count: number): DesignDocument {
  let document = createDesignDocument({ name: 'grouped' });
  for (let i = 0; i < count; i++) {
    document = addLayer(
      document,
      createShapeLayer(box(5 + i * 25), { name: `Layer ${i + 1}`, index: i }),
    );
  }
  return document;
}

describe('assignGroup and clearGroup', () => {
  it('marks the chosen layers and leaves the rest alone', () => {
    const document = documentWith(4);
    const ids = [document.layers[0].id, document.layers[2].id];
    const grouped = assignGroup(document, ids, 'g1');

    expect(grouped.layers[0].groupId).toBe('g1');
    expect(grouped.layers[1].groupId).toBeUndefined();
    expect(grouped.layers[2].groupId).toBe('g1');
    expect(layersInGroup(grouped, 'g1')).toHaveLength(2);
  });

  it('removes the mark again', () => {
    const document = documentWith(3);
    const ids = document.layers.map((layer) => layer.id);
    const grouped = assignGroup(document, ids, 'g1');
    const cleared = clearGroup(grouped, ids);
    for (const layer of cleared.layers) expect(layer.groupId).toBeUndefined();
  });

  it('is a no-op for an empty id list, so the document reference is kept', () => {
    const document = documentWith(2);
    expect(assignGroup(document, [], 'g1')).toBe(document);
    expect(clearGroup(document, [])).toBe(document);
  });
});

describe('expandSelectionToGroups', () => {
  it('pulls in the rest of a group when one member is selected', () => {
    const document = assignGroup(documentWith(4), [], 'g1');
    const grouped = assignGroup(document, [document.layers[1].id, document.layers[3].id], 'g1');
    const expanded = expandSelectionToGroups(grouped, [grouped.layers[1].id]);
    expect(expanded).toHaveLength(2);
    expect(expanded).toContain(grouped.layers[3].id);
  });

  it('returns ungrouped selections unchanged', () => {
    const document = documentWith(3);
    const ids = [document.layers[0].id];
    expect(expandSelectionToGroups(document, ids)).toEqual(ids);
  });

  it('returns ids in stack order, not selection order', () => {
    const document = documentWith(3);
    const grouped = assignGroup(
      document,
      [document.layers[0].id, document.layers[2].id],
      'g1',
    );
    const expanded = expandSelectionToGroups(grouped, [grouped.layers[2].id]);
    expect(expanded).toEqual([grouped.layers[0].id, grouped.layers[2].id]);
  });
});

describe('gatherGroup', () => {
  it('brings scattered members together without reordering anything else', () => {
    const document = documentWith(5);
    const grouped = assignGroup(
      document,
      [document.layers[0].id, document.layers[3].id],
      'g1',
    );
    const gathered = gatherGroup(grouped, 'g1');

    const indexes = gathered.layers
      .map((layer, index) => (layer.groupId === 'g1' ? index : -1))
      .filter((index) => index >= 0);
    expect(indexes).toEqual([0, 1]);
    expect(gathered.layers).toHaveLength(5);
    // The layers that were not grouped keep their relative order.
    const others = gathered.layers.filter((layer) => layer.groupId !== 'g1').map((l) => l.name);
    expect(others).toEqual(['Layer 2', 'Layer 3', 'Layer 5']);
  });

  it('leaves a group of one alone', () => {
    const document = documentWith(3);
    const grouped = assignGroup(document, [document.layers[1].id], 'g1');
    expect(gatherGroup(grouped, 'g1')).toBe(grouped);
  });
});

describe('grouping does not change the stitching', () => {
  it('compiles to the same pattern grouped or not', () => {
    const plain = documentWith(3);
    const grouped = assignGroup(
      plain,
      plain.layers.map((layer) => layer.id),
      'g1',
    );

    const a = compileDesignDocument(plain);
    const b = compileDesignDocument(grouped);

    expect(b.totalStitches).toBe(a.totalStitches);
    expect(b.colorBlocks).toBe(a.colorBlocks);
    expect(b.pattern.stitches).toEqual(a.pattern.stitches);
  });

  it('still merges same-threaded members into one colour block', () => {
    const shared = thread(10, 20, 30);
    let document = createDesignDocument({ name: 'one colour' });
    for (let i = 0; i < 3; i++) {
      document = addLayer(
        document,
        createShapeLayer(box(5 + i * 25), { name: `Part ${i}`, thread: shared }),
      );
    }
    const grouped = assignGroup(
      document,
      document.layers.map((layer) => layer.id),
      'g1',
    );
    expect(compileDesignDocument(grouped).colorBlocks).toBe(1);
  });
});

describe('serialization', () => {
  it('round-trips groupId without a schema bump', () => {
    const document = documentWith(3);
    const grouped = assignGroup(
      document,
      [document.layers[0].id, document.layers[1].id],
      'g-abc',
    );
    const restored = deserializeDocument(serializeDocument(grouped));

    expect(restored.layers[0].groupId).toBe('g-abc');
    expect(restored.layers[1].groupId).toBe('g-abc');
    expect(restored.layers[2].groupId).toBeUndefined();
  });

  it('opens a project written before groups existed', () => {
    // The field is optional and additive, so an older file simply has no
    // groups — it must not fail to load.
    const document = documentWith(2);
    const payload = JSON.parse(serializeDocument(document)) as Record<string, unknown>;
    for (const layer of payload.layers as Record<string, unknown>[]) delete layer.groupId;
    const restored = deserializeDocument(JSON.stringify(payload));
    expect(restored.layers).toHaveLength(2);
    for (const layer of restored.layers) expect(layer.groupId).toBeUndefined();
  });
});
