import type { LibraryShape } from '../types.js';

/**
 * Equation symbols.
 *
 * These are the one group where a shape legitimately spans much less than the
 * authoring box in one axis — a minus sign is a bar. Placement measures real
 * bounds, so a minus dropped into a square box comes out as a wide bar rather
 * than being stretched into a slab.
 */
export const EQUATION_SHAPES: LibraryShape[] = [
  {
    id: 'equation-plus',
    name: 'Plus',
    category: 'equation',
    keywords: ['add', 'cross', 'positive'],
    parts: [
      {
        name: 'Plus',
        d: 'M 40 10 L 60 10 L 60 40 L 90 40 L 90 60 L 60 60 L 60 90 L 40 90 L 40 60 L 10 60 L 10 40 L 40 40 Z',
      },
    ],
  },
  {
    id: 'equation-minus',
    name: 'Minus',
    category: 'equation',
    keywords: ['subtract', 'dash', 'bar', 'negative'],
    parts: [{ name: 'Minus', d: 'M 5 40 L 95 40 L 95 60 L 5 60 Z' }],
  },
  {
    id: 'equation-multiply',
    name: 'Multiply',
    category: 'equation',
    keywords: ['times', 'cross', 'x', 'close'],
    parts: [
      {
        name: 'Multiply',
        d: 'M 20 6 L 50 36 L 80 6 L 94 20 L 64 50 L 94 80 L 80 94 L 50 64 L 20 94 L 6 80 L 36 50 L 6 20 Z',
      },
    ],
  },
  {
    id: 'equation-divide',
    name: 'Divide',
    category: 'equation',
    keywords: ['obelus', 'split'],
    parts: [
      {
        name: 'Divide',
        d:
          'M 6 42 L 94 42 L 94 58 L 6 58 Z ' +
          'M 50 8 C 55.52 8 60 12.48 60 18 C 60 23.52 55.52 28 50 28 C 44.48 28 40 23.52 40 18 C 40 12.48 44.48 8 50 8 Z ' +
          'M 50 72 C 55.52 72 60 76.48 60 82 C 60 87.52 55.52 92 50 92 C 44.48 92 40 87.52 40 82 C 40 76.48 44.48 72 50 72 Z',
      },
    ],
  },
  {
    id: 'equation-equal',
    name: 'Equal',
    category: 'equation',
    keywords: ['equals', 'same', 'is'],
    parts: [
      {
        name: 'Equal',
        d: 'M 5 26 L 95 26 L 95 43 L 5 43 Z M 5 57 L 95 57 L 95 74 L 5 74 Z',
      },
    ],
  },
  {
    id: 'equation-not-equal',
    name: 'Not equal',
    category: 'equation',
    keywords: ['unequal', 'different', 'ne'],
    parts: [
      {
        name: 'Bars',
        d: 'M 5 26 L 95 26 L 95 43 L 5 43 Z M 5 57 L 95 57 L 95 74 L 5 74 Z',
        color: '#4a76c4',
      },
      { name: 'Slash', d: 'M 58 4 L 74 12 L 42 96 L 26 88 Z', color: '#4a76c4' },
    ],
  },
];
