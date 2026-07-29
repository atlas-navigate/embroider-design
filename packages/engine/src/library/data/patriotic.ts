import type { LibraryShape } from '../types.js';

const FLAG_RED = '#b22234';
const FLAG_BLUE = '#3c3b6e';
const GOLD = '#d8a13a';

export const PATRIOTIC_SHAPES: LibraryShape[] = [
  {
    id: 'patriotic-firework',
    name: 'Firework',
    category: 'patriotic',
    keywords: ['celebrate', 'burst', 'new year', 'july 4th', 'sparkle'],
    parts: [
      {
        name: 'Burst',
        d: 'M 50 0 L 55.74 36.14 L 85.36 14.64 L 63.86 44.26 L 100 50 L 63.86 55.74 L 85.36 85.36 L 55.74 63.86 L 50 100 L 44.26 63.86 L 14.64 85.36 L 36.14 55.74 L 0 50 L 36.14 44.26 L 14.64 14.64 L 44.26 36.14 Z',
        color: FLAG_RED,
      },
      {
        name: 'Sparks',
        d:
          'M 22 20 C 24.21 20 26 21.79 26 24 C 26 26.21 24.21 28 22 28 C 19.79 28 18 26.21 18 24 C 18 21.79 19.79 20 22 20 Z ' +
          'M 78 20 C 80.21 20 82 21.79 82 24 C 82 26.21 80.21 28 78 28 C 75.79 28 74 26.21 74 24 C 74 21.79 75.79 20 78 20 Z ' +
          'M 22 72 C 24.21 72 26 73.79 26 76 C 26 78.21 24.21 80 22 80 C 19.79 80 18 78.21 18 76 C 18 73.79 19.79 72 22 72 Z ' +
          'M 78 72 C 80.21 72 82 73.79 82 76 C 82 78.21 80.21 80 78 80 C 75.79 80 74 78.21 74 76 C 74 73.79 75.79 72 78 72 Z',
        color: GOLD,
      },
    ],
  },
  {
    id: 'patriotic-flag',
    name: 'Waving flag',
    category: 'patriotic',
    keywords: ['stars', 'stripes', 'usa', 'america', 'banner'],
    parts: [
      {
        name: 'Field',
        d:
          'M 0 14 C 18 6 34 22 52 16 C 70 10 84 22 100 16 L 100 74 C 84 80 70 68 52 74 C 34 80 18 64 0 72 Z ' +
          // Cut the white stripes out rather than laying them over the red.
          'M 1 27 C 18 20 34 35 52 29 C 70 23 84 34 99 28 L 99 37 C 84 43 70 32 52 38 C 34 44 18 29 1 36 Z ' +
          'M 1 47 C 18 40 34 55 52 49 C 70 43 84 54 99 48 L 99 57 C 84 63 70 52 52 58 C 34 64 18 49 1 56 Z ' +
          'M 1 65 C 18 58 34 71 52 66 C 70 60 84 70 99 65 L 99 72 C 84 78 70 68 52 73 C 34 79 18 65 1 72 Z',
        color: FLAG_RED,
      },
      {
        name: 'Canton',
        d: 'M 0 14 C 12 10 22 17 34 14 L 34 45 C 22 48 12 41 0 45 Z',
        color: FLAG_BLUE,
      },
    ],
  },
  {
    id: 'patriotic-banner-star',
    name: 'Star banner',
    category: 'patriotic',
    keywords: ['ribbon', 'award', 'medal', 'usa'],
    parts: [
      {
        name: 'Star',
        d: 'M 50 2 L 58.98 29.64 L 88.04 29.64 L 64.53 46.72 L 73.51 74.36 L 50 57.28 L 26.49 74.36 L 35.47 46.72 L 11.96 29.64 L 41.02 29.64 Z',
        color: FLAG_BLUE,
      },
      {
        name: 'Ribbon',
        d: 'M 30 70 L 44 70 L 40 98 L 30 90 L 20 96 Z M 70 70 L 56 70 L 60 98 L 70 90 L 80 96 Z',
        color: FLAG_RED,
      },
    ],
  },
  {
    id: 'patriotic-eagle',
    name: 'Eagle',
    category: 'patriotic',
    keywords: ['bird', 'soaring', 'america', 'freedom', 'wings'],
    parts: [
      {
        name: 'Eagle',
        d: 'M 50 40 C 44 34 36 30 26 28 C 14 26 6 30 2 38 C 10 38 16 42 20 48 C 12 48 6 52 4 58 C 14 56 22 58 28 62 C 36 68 42 74 46 82 L 50 92 L 54 82 C 58 74 64 68 72 62 C 78 58 86 56 96 58 C 94 52 88 48 80 48 C 84 42 90 38 98 38 C 94 30 86 26 74 28 C 64 30 56 34 50 40 Z',
        color: '#5d4632',
      },
      {
        name: 'Head',
        d: 'M 50 14 C 57 14 62 20 62 28 C 62 36 57 42 50 42 C 43 42 38 36 38 28 C 38 20 43 14 50 14 Z',
        color: '#f2f0e8',
      },
      { name: 'Beak', d: 'M 60 26 L 72 30 L 60 36 Z', color: GOLD },
    ],
  },
  {
    id: 'patriotic-torch',
    name: 'Torch',
    category: 'patriotic',
    keywords: ['liberty', 'flame', 'freedom', 'light'],
    parts: [
      {
        name: 'Flame',
        d: 'M 50 2 C 58 12 66 24 66 36 C 66 46 59 52 50 52 C 41 52 34 46 34 36 C 34 24 42 12 50 2 Z',
        color: '#e2761b',
      },
      { name: 'Cup', d: 'M 32 50 L 68 50 L 63 64 L 37 64 Z', color: GOLD },
      { name: 'Handle', d: 'M 42 64 L 58 64 L 55 100 L 45 100 Z', color: '#a8761f' },
    ],
  },
];
