import type { LibraryShape } from '../types.js';

/**
 * Speech and thought callouts.
 *
 * Cloud shapes are drawn as one scalloped outline rather than as a pile of
 * overlapping circles. Overlapping rings would each become their own region —
 * neither contains the other — and the machine would stitch the overlaps twice,
 * building up thread exactly where a cloud should look smooth.
 */
export const CALLOUT_SHAPES: LibraryShape[] = [
  {
    id: 'callout-rectangular',
    name: 'Rectangular callout',
    category: 'callouts',
    keywords: ['speech', 'bubble', 'talk', 'say'],
    parts: [
      {
        name: 'Callout',
        d: 'M 0 0 L 100 0 L 100 68 L 52 68 L 30 100 L 32 68 L 0 68 Z',
      },
    ],
  },
  {
    id: 'callout-rounded',
    name: 'Rounded callout',
    category: 'callouts',
    keywords: ['speech', 'bubble', 'message', 'chat'],
    parts: [
      {
        name: 'Callout',
        d: 'M 14 0 L 86 0 C 94 0 100 6 100 14 L 100 54 C 100 62 94 68 86 68 L 52 68 L 30 100 L 32 68 L 14 68 C 6 68 0 62 0 54 L 0 14 C 0 6 6 0 14 0 Z',
      },
    ],
  },
  {
    id: 'callout-oval',
    name: 'Oval callout',
    category: 'callouts',
    keywords: ['speech', 'bubble', 'balloon'],
    parts: [
      {
        name: 'Callout',
        d:
          'M 50 4 C 77.61 4 100 18.33 100 36 C 100 53.67 77.61 68 50 68 C 22.39 68 0 53.67 0 36 C 0 18.33 22.39 4 50 4 Z ' +
          'M 30 64 L 46 66 L 26 100 Z',
      },
    ],
  },
  {
    id: 'callout-cloud',
    name: 'Cloud callout',
    category: 'callouts',
    keywords: ['speech', 'bubble', 'cloud', 'dream'],
    parts: [
      {
        name: 'Cloud',
        d: 'M 25 72 C 11 72 0 61 0 48 C 0 36 9 26 20 24 C 22 11 33 1 47 1 C 59 1 69 8 74 18 C 76 17 79 17 81 17 C 92 17 100 25 100 36 C 100 40 99 44 96 47 C 99 50 100 54 100 58 C 100 66 93 72 85 72 Z',
      },
    ],
  },
  {
    id: 'callout-thought',
    name: 'Thought bubble',
    category: 'callouts',
    keywords: ['cloud', 'dream', 'think', 'idea'],
    parts: [
      {
        name: 'Cloud',
        d: 'M 27 62 C 14 62 4 52 4 40 C 4 29 12 20 22 18 C 24 9 34 1 47 1 C 58 1 67 6 72 14 C 74 13 76 13 78 13 C 88 13 96 20 96 29 C 96 33 95 36 92 39 C 95 42 96 45 96 49 C 96 56 90 62 83 62 Z',
      },
      {
        name: 'Trail',
        d:
          'M 26 68 C 31 68 35 72 35 77 C 35 82 31 86 26 86 C 21 86 17 82 17 77 C 17 72 21 68 26 68 Z ' +
          'M 11 88 C 14.5 88 17 90.5 17 94 C 17 97.5 14.5 100 11 100 C 7.5 100 5 97.5 5 94 C 5 90.5 7.5 88 11 88 Z',
      },
    ],
  },
  {
    id: 'callout-burst',
    name: 'Burst callout',
    category: 'callouts',
    keywords: ['speech', 'shout', 'comic', 'pow', 'exclaim'],
    parts: [
      {
        name: 'Burst',
        d: 'M 50 2 L 60 16 L 76 8 L 78 25 L 95 22 L 88 38 L 100 48 L 86 57 L 94 72 L 77 72 L 74 88 L 60 79 L 50 94 L 40 79 L 26 88 L 23 72 L 6 72 L 14 57 L 0 48 L 12 38 L 5 22 L 22 25 L 24 8 L 40 16 Z',
      },
    ],
  },
  {
    id: 'callout-line',
    name: 'Line callout',
    category: 'callouts',
    keywords: ['label', 'pointer', 'annotation', 'tag'],
    parts: [
      {
        name: 'Box',
        d: 'M 0 0 L 100 0 L 100 55 L 0 55 Z',
      },
      {
        name: 'Pointer',
        d: 'M 22 55 L 34 55 L 16 100 Z',
      },
    ],
  },
];
