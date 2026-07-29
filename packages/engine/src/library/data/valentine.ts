import type { LibraryShape } from '../types.js';

/** The classic heart, shared by everything here that needs one. */
export const HEART_PATH =
  'M 50 96 C 20 74 4 54 4 34 C 4 18 16 6 30 6 C 39 6 46 11 50 18 C 54 11 61 6 70 6 C 84 6 96 18 96 34 C 96 54 80 74 50 96 Z';

const LOVE_RED = '#d6335a';
const LOVE_PINK = '#f2879f';
const STEM_GREEN = '#3f8f4f';

export const VALENTINE_SHAPES: LibraryShape[] = [
  {
    id: 'valentine-heart',
    name: 'Heart',
    category: 'valentine',
    keywords: ['love', 'valentine', 'romance', 'like'],
    parts: [{ name: 'Heart', d: HEART_PATH, color: LOVE_RED }],
  },
  {
    id: 'valentine-heart-outline',
    name: 'Heart outline',
    category: 'valentine',
    keywords: ['love', 'ring', 'hollow', 'satin'],
    parts: [
      {
        name: 'Heart',
        d:
          HEART_PATH +
          ' M 50 82 C 26 63 14 47 14 33 C 14 23 21 16 30 16 C 38 16 44 21 50 31 C 56 21 62 16 70 16 C 79 16 86 23 86 33 C 86 47 74 63 50 82 Z',
        color: LOVE_RED,
      },
    ],
  },
  {
    id: 'valentine-double-heart',
    name: 'Double heart',
    category: 'valentine',
    keywords: ['love', 'couple', 'two', 'anniversary'],
    parts: [
      {
        name: 'Back heart',
        d: 'M 66 84 C 44 68 32 53 32 38 C 32 26 41 17 51 17 C 58 17 63 21 66 26 C 69 21 74 17 81 17 C 91 17 100 26 100 38 C 100 53 88 68 66 84 Z',
        color: LOVE_PINK,
      },
      {
        name: 'Front heart',
        d: 'M 34 92 C 12 76 0 61 0 46 C 0 34 9 25 19 25 C 26 25 31 29 34 34 C 37 29 42 25 49 25 C 59 25 68 34 68 46 C 68 61 56 76 34 92 Z',
        color: LOVE_RED,
      },
    ],
  },
  {
    id: 'valentine-heart-arrow',
    name: 'Heart with arrow',
    category: 'valentine',
    keywords: ['cupid', 'love', 'struck', 'romance'],
    parts: [
      {
        name: 'Heart',
        d: 'M 50 92 C 22 71 8 52 8 33 C 8 18 19 7 32 7 C 41 7 47 12 50 18 C 53 12 59 7 68 7 C 81 7 92 18 92 33 C 92 52 78 71 50 92 Z',
        color: LOVE_RED,
      },
      {
        name: 'Arrow',
        d:
          'M 0 76 L 22 62 L 26 68 L 4 82 Z ' +
          'M 74 30 L 96 16 L 100 22 L 78 36 Z ' +
          'M 92 8 L 100 20 L 88 26 Z',
        color: '#8a5a2b',
      },
    ],
  },
  {
    id: 'valentine-rose',
    name: 'Rose',
    category: 'valentine',
    keywords: ['flower', 'love', 'romance', 'bloom'],
    parts: [
      {
        name: 'Bloom',
        d:
          'M 50 6 C 66 6 78 18 78 34 C 78 50 66 62 50 62 C 34 62 22 50 22 34 C 22 18 34 6 50 6 Z ' +
          'M 50 16 C 41 16 34 23 34 32 C 34 41 41 48 50 48 C 59 48 66 41 66 32 C 66 23 59 16 50 16 Z ' +
          'M 50 26 C 46 26 43 29 43 33 C 43 37 46 40 50 40 C 54 40 57 37 57 33 C 57 29 54 26 50 26 Z',
        color: LOVE_RED,
      },
      {
        name: 'Stem',
        d:
          'M 46 60 L 54 60 L 54 100 L 46 100 Z ' +
          'M 46 72 C 34 68 24 70 18 78 C 28 84 40 82 46 76 Z ' +
          'M 54 84 C 66 80 76 82 82 90 C 72 96 60 94 54 88 Z',
        color: STEM_GREEN,
      },
    ],
  },
  {
    id: 'valentine-love-birds',
    name: 'Love birds',
    category: 'valentine',
    keywords: ['birds', 'couple', 'romance', 'kiss'],
    parts: [
      {
        name: 'Birds',
        d:
          'M 34 34 C 42 34 48 41 48 50 C 48 62 40 72 28 76 C 16 80 4 76 2 66 C 0 56 8 48 18 46 C 22 38 27 34 34 34 Z ' +
          'M 66 34 C 58 34 52 41 52 50 C 52 62 60 72 72 76 C 84 80 96 76 98 66 C 100 56 92 48 82 46 C 78 38 73 34 66 34 Z',
        color: '#5b8fc4',
      },
      {
        name: 'Heart',
        d: 'M 50 30 C 42 23 38 18 38 12 C 38 7 42 3 47 3 C 48 3 49 4 50 6 C 51 4 52 3 53 3 C 58 3 62 7 62 12 C 62 18 58 23 50 30 Z',
        color: LOVE_RED,
      },
    ],
  },
];
