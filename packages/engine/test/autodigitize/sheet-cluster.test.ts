import { describe, expect, it } from 'vitest';
import type { BoundingBox } from '../../src/geometry/path.js';
import { chamferLabelDistance, createMask, labelComponents } from '../../src/autodigitize/mask-ops.js';
import {
  chooseClusterRadius,
  clusterComponents,
  componentGaps,
  findTextRows,
  isStructuralComponent,
  type Component,
} from '../../src/autodigitize/sheet-cluster.js';

/**
 * The layout rules, on masks rather than on images.
 *
 * Nothing here needs a colour, so nothing here has one. What is being checked
 * is arithmetic about arrangement, and the failures worth guarding against are
 * all of the same shape: a rule that looks sensible in isolation and merges the
 * whole page when it meets a real one.
 */

function box(minX: number, minY: number, maxX: number, maxY: number): BoundingBox {
  return { minX, minY, maxX, maxY };
}

function component(label: number, b: BoundingBox, fill = 1): Component {
  return {
    label,
    box: b,
    pixelCount: Math.round((b.maxX - b.minX) * (b.maxY - b.minY) * fill),
  };
}

/** A mask with filled rectangles on it, and the components they label into. */
function maskOf(width: number, height: number, blocks: BoundingBox[]) {
  const mask = createMask(width, height);
  for (const b of blocks) {
    for (let y = b.minY; y < b.maxY; y++) {
      for (let x = b.minX; x < b.maxX; x++) mask.data[y * width + x] = 1;
    }
  }
  const { labels, sizes } = labelComponents(mask);
  return { mask, labels, sizes, width, height };
}

describe('chamferLabelDistance', () => {
  it('measures the distance between two blocks through the space between them', () => {
    const { labels } = maskOf(60, 30, [box(5, 10, 15, 20), box(35, 10, 45, 20)]);
    const [edge] = componentGaps(labels, 60, 30);
    expect(edge).toBeDefined();
    // Twenty pixels of clear space, to within the chamfer's rounding.
    expect(Math.abs(edge.gap - 20)).toBeLessThanOrEqual(1);
  });

  it('is close enough on a diagonal', () => {
    const { labels } = maskOf(80, 80, [box(5, 5, 15, 15), box(45, 45, 55, 55)]);
    const [edge] = componentGaps(labels, 80, 80);
    const truth = Math.hypot(45 - 15, 45 - 15);
    expect(Math.abs(edge.gap - truth) / truth).toBeLessThan(0.1);
  });

  it('carries the nearest component identity, not just the distance', () => {
    const { labels } = maskOf(60, 20, [box(0, 5, 10, 15), box(50, 5, 60, 15)]);
    const { nearest } = chamferLabelDistance(labels, 60, 20);
    expect(nearest[10 * 60 + 5]).toBe(nearest[10 * 60 + 2]);
    expect(nearest[10 * 60 + 55]).not.toBe(nearest[10 * 60 + 5]);
  });
});

describe('isStructuralComponent', () => {
  const width = 1000;
  const height = 800;

  it('rejects a hairline reaching across the page', () => {
    expect(isStructuralComponent(component(0, box(0, 400, 1000, 401)), width, height)).toBe('rule');
    expect(isStructuralComponent(component(0, box(500, 0, 501, 800)), width, height)).toBe('rule');
  });

  it('rejects a frame drawn round the page', () => {
    expect(isStructuralComponent(component(0, box(0, 0, 1000, 800), 0.02), width, height)).toBe(
      'border',
    );
  });

  it('keeps a long thin thing that is part of a drawing', () => {
    // A wire between fairy lights: thin, and nothing like half a page long.
    expect(isStructuralComponent(component(0, box(100, 400, 380, 403)), width, height)).toBeNull();
    // A row of evenly spaced dots has a rule's span and a rule's thinness, and
    // is not one — which is what the box-fill clause is for.
    expect(isStructuralComponent(component(0, box(0, 400, 900, 403), 0.2), width, height)).toBeNull();
    // And a tall narrow drawing is not a vertical rule.
    expect(isStructuralComponent(component(0, box(480, 0, 520, 780)), width, height)).toBeNull();
  });
});

describe('chooseClusterRadius', () => {
  const grid = (columns: number, rows: number, pitch: number, size: number): BoundingBox[] => {
    const boxes: BoundingBox[] = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = 20 + column * pitch;
        const y = 20 + row * pitch;
        boxes.push(box(x, y, x + size, y + size));
      }
    }
    return boxes;
  };

  it('does not reach at all when nothing on the page is fragmented', () => {
    // Every mark's neighbour is a different icon. Reaching far enough to join
    // any two of them joins all of them, because single link is transitive —
    // and that collapsed grouping is perfectly stable, which is exactly why
    // stability alone cannot be trusted to reject it.
    const { labels } = maskOf(400, 400, grid(5, 5, 70, 50));
    const components = grid(5, 5, 70, 50).map((b, i) => component(i, b));
    const chosen = chooseClusterRadius(components, componentGaps(labels, 400, 400), 400, 400);

    expect(chosen.basis).toBe('auto-unimodal');
    expect(chosen.radius).toBeLessThan(10);
  });

  it('reaches far enough to join an icon drawn in two pieces', () => {
    // Pairs eight pixels apart, the pairs themselves eighty apart.
    const boxes: BoundingBox[] = [];
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 4; column++) {
        const x = 30 + column * 90;
        const y = 30 + row * 90;
        boxes.push(box(x, y, x + 20, y + 20));
        boxes.push(box(x + 28, y, x + 44, y + 16));
      }
    }
    const { labels } = maskOf(400, 400, boxes);
    const components = boxes.map((b, i) => component(i, b));
    const edges = componentGaps(labels, 400, 400);
    const chosen = chooseClusterRadius(components, edges, 400, 400);

    expect(chosen.basis).toBe('auto-bimodal');
    expect(clusterComponents(components, edges, chosen.radius)).toHaveLength(16);
  });

  it('copes with a page holding a single mark', () => {
    const single = [component(0, box(10, 10, 40, 40))];
    expect(chooseClusterRadius(single, [], 200, 200).basis).toBe('auto-unimodal');
  });
});

describe('clusterComponents', () => {
  it('joins a chain of parts that are never all near each other', () => {
    // Body, then an arm off the body, then a mitten off the arm. Asking every
    // part to be close to every other part — average link — breaks precisely
    // the icons this exists to keep whole, which is why the link is single.
    const boxes = [box(0, 0, 20, 20), box(26, 5, 40, 15), box(46, 5, 56, 15)];
    const { labels } = maskOf(100, 40, boxes);
    const components = boxes.map((b, i) => component(i, b));

    const clusters = clusterComponents(components, componentGaps(labels, 100, 40), 8);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].box).toEqual(box(0, 0, 56, 20));
  });

  it('keeps a pinned row out of everything that is not in it', () => {
    const boxes = [box(0, 0, 20, 20), box(24, 6, 34, 16)];
    const { labels } = maskOf(100, 40, boxes);
    const components = boxes.map((b, i) => component(i, b));
    const edges = componentGaps(labels, 100, 40);

    expect(clusterComponents(components, edges, 8)).toHaveLength(1);
    // Same distance, but the second one belongs to a caption row.
    const rows = new Map<number, number>([[1, 0]]);
    expect(clusterComponents(components, edges, 8, rows)).toHaveLength(2);
  });
});

describe('findTextRows', () => {
  it('finds a row of letters under a row of drawings', () => {
    const drawings = [box(20, 20, 80, 80), box(120, 20, 180, 80), box(220, 20, 280, 80)];
    const letters: BoundingBox[] = [];
    for (let i = 0; i < 8; i++) letters.push(box(60 + i * 12, 100, 68 + i * 12, 108));

    const components = [...drawings, ...letters].map((b, i) => component(i, b));
    const rows = findTextRows(components, 320, 200);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(8);
  });

  it('does not read a page of small icons as a page of captions', () => {
    // Every row of small icons has a caption's signature — many marks, all the
    // same height, a letter's width apart. What a caption also has, and this
    // does not, is something larger on the same page that it is a caption *to*.
    const boxes: BoundingBox[] = [];
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 8; column++) {
        boxes.push(box(20 + column * 40, 20 + row * 40, 44 + column * 40, 44 + row * 40));
      }
    }
    const components = boxes.map((b, i) => component(i, b));
    expect(findTextRows(components, 400, 400)).toHaveLength(0);
  });

  it('does not read a row of drawings as a caption', () => {
    const boxes: BoundingBox[] = [];
    for (let i = 0; i < 6; i++) boxes.push(box(20 + i * 100, 20, 100 + i * 100, 100));
    const components = boxes.map((b, i) => component(i, b));
    expect(findTextRows(components, 700, 200)).toHaveLength(0);
  });
});
