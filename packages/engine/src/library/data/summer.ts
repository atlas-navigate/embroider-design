import type { LibraryShape } from '../types.js';

const SUN_GOLD = '#f2b134';
const SEA_BLUE = '#3fa9c9';
const CORAL = '#e8674f';
const MELON_RED = '#e0455e';
const MELON_GREEN = '#3f8f4f';
const CREAM = '#f6e4c8';

export const SUMMER_SHAPES: LibraryShape[] = [
  {
    id: 'summer-sun',
    name: 'Sun',
    category: 'summer',
    keywords: ['sunshine', 'hot', 'weather', 'rays', 'summer'],
    parts: [
      {
        name: 'Rays',
        d: 'M 45.86 16.25 L 50 0 L 54.14 16.25 Z M 63.28 18.7 L 75 6.7 L 70.46 22.85 Z M 77.15 29.54 L 93.3 25 L 81.3 36.72 Z M 83.75 45.86 L 100 50 L 83.75 54.14 Z M 81.3 63.28 L 93.3 75 L 77.15 70.46 Z M 70.46 77.15 L 75 93.3 L 63.28 81.3 Z M 54.14 83.75 L 50 100 L 45.86 83.75 Z M 36.72 81.3 L 25 93.3 L 29.54 77.15 Z M 22.85 70.46 L 6.7 75 L 18.7 63.28 Z M 16.25 54.14 L 0 50 L 16.25 45.86 Z M 18.7 36.72 L 6.7 25 L 22.85 29.54 Z M 29.54 22.85 L 25 6.7 L 36.72 18.7 Z',
        color: SUN_GOLD,
      },
      {
        name: 'Disc',
        d: 'M 50 16 C 68.78 16 84 31.22 84 50 C 84 68.78 68.78 84 50 84 C 31.22 84 16 68.78 16 50 C 16 31.22 31.22 16 50 16 Z',
        color: '#e8a020',
      },
    ],
  },
  {
    id: 'summer-sunglasses',
    name: 'Sunglasses',
    category: 'summer',
    keywords: ['shades', 'beach', 'cool', 'glasses'],
    parts: [
      {
        name: 'Frame',
        d: 'M 2 34 L 98 34 L 98 44 L 88 44 L 88 46 L 12 46 L 12 44 L 2 44 Z M 44 44 L 56 44 L 56 52 L 44 52 Z',
        color: '#2f3138',
      },
      {
        name: 'Lenses',
        d:
          'M 8 44 L 44 44 C 44 62 36 74 24 74 C 12 74 6 62 8 44 Z ' +
          'M 92 44 L 56 44 C 56 62 64 74 76 74 C 88 74 94 62 92 44 Z',
        color: SEA_BLUE,
      },
    ],
  },
  {
    id: 'summer-flip-flop',
    name: 'Flip-flop',
    category: 'summer',
    keywords: ['sandal', 'beach', 'thong', 'shoe'],
    parts: [
      {
        name: 'Sole',
        d: 'M 50 2 C 68 2 78 14 78 32 C 78 50 74 66 72 78 C 70 92 62 98 50 98 C 38 98 30 92 28 78 C 26 66 22 50 22 32 C 22 14 32 2 50 2 Z',
        color: CREAM,
      },
      {
        name: 'Strap',
        d: 'M 46 36 L 24 14 L 30 8 L 50 28 L 70 8 L 76 14 L 54 36 Z M 46 34 L 54 34 L 53 46 L 47 46 Z',
        color: CORAL,
      },
    ],
  },
  {
    id: 'summer-ice-cream',
    name: 'Ice cream cone',
    category: 'summer',
    keywords: ['cone', 'gelato', 'dessert', 'sweet', 'summer'],
    parts: [
      {
        name: 'Cone',
        d: 'M 26 46 L 74 46 L 54 96 C 53 99 47 99 46 96 Z',
        color: '#d2a86a',
      },
      {
        name: 'Scoop',
        d: 'M 50 4 C 64 4 74 14 74 28 C 80 30 84 36 84 42 C 84 46 81 48 76 48 L 24 48 C 19 48 16 46 16 42 C 16 36 20 30 26 28 C 26 14 36 4 50 4 Z',
        color: '#f4c2d0',
      },
      {
        name: 'Cherry',
        d: 'M 50 0 C 55.52 0 60 4.48 60 10 C 60 15.52 55.52 20 50 20 C 44.48 20 40 15.52 40 10 C 40 4.48 44.48 0 50 0 Z',
        color: MELON_RED,
      },
    ],
  },
  {
    id: 'summer-popsicle',
    name: 'Popsicle',
    category: 'summer',
    keywords: ['ice lolly', 'frozen', 'treat', 'summer'],
    parts: [
      {
        name: 'Ice',
        d: 'M 26 2 L 74 2 C 80 2 84 6 84 12 L 84 66 C 84 72 80 76 74 76 L 26 76 C 20 76 16 72 16 66 L 16 12 C 16 6 20 2 26 2 Z',
        color: MELON_RED,
      },
      {
        name: 'Drip',
        d: 'M 16 30 C 26 24 34 36 44 30 C 54 24 62 36 72 30 C 78 27 82 28 84 30 L 84 46 C 82 44 78 43 72 46 C 62 52 54 40 44 46 C 34 52 26 40 16 46 Z',
        color: '#f2b134',
      },
      { name: 'Stick', d: 'M 42 74 L 58 74 L 58 98 C 58 100 42 100 42 98 Z', color: '#d2a86a' },
    ],
  },
  {
    id: 'summer-watermelon',
    name: 'Watermelon',
    category: 'summer',
    keywords: ['fruit', 'slice', 'picnic', 'summer'],
    parts: [
      {
        name: 'Rind',
        d: 'M 2 20 L 98 20 C 98 62 76 96 50 96 C 24 96 2 62 2 20 Z',
        color: MELON_GREEN,
      },
      {
        name: 'Flesh',
        d: 'M 12 30 L 88 30 C 88 64 71 88 50 88 C 29 88 12 64 12 30 Z',
        color: MELON_RED,
      },
      {
        name: 'Seeds',
        d:
          'M 30 42 C 32.21 42 34 44.69 34 48 C 34 51.31 32.21 54 30 54 C 27.79 54 26 51.31 26 48 C 26 44.69 27.79 42 30 42 Z ' +
          'M 50 44 C 52.21 44 54 46.69 54 50 C 54 53.31 52.21 56 50 56 C 47.79 56 46 53.31 46 50 C 46 46.69 47.79 44 50 44 Z ' +
          'M 70 42 C 72.21 42 74 44.69 74 48 C 74 51.31 72.21 54 70 54 C 67.79 54 66 51.31 66 48 C 66 44.69 67.79 42 70 42 Z ' +
          'M 40 64 C 42.21 64 44 66.69 44 70 C 44 73.31 42.21 76 40 76 C 37.79 76 36 73.31 36 70 C 36 66.69 37.79 64 40 64 Z ' +
          'M 60 64 C 62.21 64 64 66.69 64 70 C 64 73.31 62.21 76 60 76 C 57.79 76 56 73.31 56 70 C 56 66.69 57.79 64 60 64 Z',
        color: '#2b2b30',
      },
    ],
  },
  {
    id: 'summer-beach-ball',
    name: 'Beach ball',
    category: 'summer',
    keywords: ['ball', 'play', 'pool', 'toy'],
    parts: [
      {
        name: 'Ball',
        d:
          'M 50 2 C 76.51 2 98 23.49 98 50 C 98 76.51 76.51 98 50 98 C 23.49 98 2 76.51 2 50 C 2 23.49 23.49 2 50 2 Z ' +
          'M 50 2 C 64 20 64 80 50 98 C 36 80 36 20 50 2 Z',
        color: CORAL,
      },
      {
        name: 'Band',
        d: 'M 50 2 C 64 20 64 80 50 98 C 36 80 36 20 50 2 Z',
        color: '#f6f2e8',
      },
    ],
  },
  {
    id: 'summer-umbrella',
    name: 'Beach umbrella',
    category: 'summer',
    keywords: ['parasol', 'shade', 'rain', 'beach'],
    parts: [
      {
        name: 'Canopy',
        d: 'M 2 56 C 2 26 24 4 50 4 C 76 4 98 26 98 56 C 90 48 82 56 74 56 C 66 56 58 48 50 56 C 42 48 34 56 26 56 C 18 56 10 48 2 56 Z',
        color: CORAL,
      },
      { name: 'Pole', d: 'M 47 52 L 53 52 L 53 88 L 47 88 Z', color: '#8a6a45' },
      {
        name: 'Handle',
        d: 'M 47 84 L 53 84 C 53 94 46 100 38 100 C 32 100 28 96 28 92 L 34 92 C 34 94 36 96 39 96 C 44 96 47 92 47 84 Z',
        color: '#8a6a45',
      },
    ],
  },
  {
    id: 'summer-pineapple',
    name: 'Pineapple',
    category: 'summer',
    keywords: ['fruit', 'tropical', 'ananas', 'summer'],
    parts: [
      {
        name: 'Body',
        d:
          'M 50 26 C 68 26 80 42 80 62 C 80 84 68 98 50 98 C 32 98 20 84 20 62 C 20 42 32 26 50 26 Z ' +
          'M 50 40 L 58 50 L 50 60 L 42 50 Z ' +
          'M 34 56 L 42 66 L 34 76 L 26 66 Z ' +
          'M 66 56 L 74 66 L 66 76 L 58 66 Z ' +
          'M 50 72 L 58 82 L 50 92 L 42 82 Z',
        color: SUN_GOLD,
      },
      {
        name: 'Crown',
        d:
          'M 50 0 C 55 8 57 17 55 27 L 45 27 C 43 17 45 8 50 0 Z ' +
          'M 34 6 C 42 12 47 19 47 27 L 38 27 C 33 21 30 13 34 6 Z ' +
          'M 66 6 C 70 13 67 21 62 27 L 53 27 C 53 19 58 12 66 6 Z',
        color: MELON_GREEN,
      },
    ],
  },
];
