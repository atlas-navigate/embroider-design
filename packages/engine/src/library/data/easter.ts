import type { LibraryShape } from '../types.js';

const EGG_CREAM = '#f6e7cf';
const EGG_BLUE = '#7fc4d8';
const EGG_PINK = '#eba3bd';
const BUNNY_GREY = '#dcd8d2';
const BUNNY_PINK = '#e8a8b8';
const CHICK_YELLOW = '#f2cb4d';
const BEAK_ORANGE = '#e2882b';
const LEAF_GREEN = '#5a9153';
const COAL = '#33333a';

const EGG_BODY =
  'M 50 4 C 68 4 82 30 82 56 C 82 80 68 96 50 96 C 32 96 18 80 18 56 C 18 30 32 4 50 4 Z';

const BUNNY_EARS =
  'M 38 4 C 42 4 45 14 45 28 C 45 37 42 42 38 42 C 34 42 31 37 31 28 C 31 14 34 4 38 4 Z ' +
  'M 62 4 C 66 4 69 14 69 28 C 69 37 66 42 62 42 C 58 42 55 37 55 28 C 55 14 58 4 62 4 Z';

export const EASTER_SHAPES: LibraryShape[] = [
  {
    id: 'easter-egg',
    name: 'Easter egg',
    category: 'easter',
    keywords: ['spring', 'egg', 'hunt'],
    parts: [{ name: 'Egg', d: EGG_BODY, color: EGG_CREAM }],
  },
  {
    id: 'easter-egg-decorated',
    name: 'Decorated egg',
    category: 'easter',
    keywords: ['spring', 'painted', 'stripes', 'hunt'],
    parts: [
      { name: 'Egg', d: EGG_BODY, color: EGG_BLUE },
      {
        name: 'Bands',
        d:
          'M 20 40 C 34 34 66 34 80 40 L 80 50 C 66 44 34 44 20 50 Z ' +
          'M 19 66 C 34 60 66 60 81 66 L 81 76 C 66 70 34 70 19 76 Z',
        color: EGG_PINK,
      },
      {
        name: 'Dots',
        d:
          'M 34 22 C 36.76 22 39 24.24 39 27 C 39 29.76 36.76 32 34 32 C 31.24 32 29 29.76 29 27 C 29 24.24 31.24 22 34 22 Z ' +
          'M 62 20 C 64.76 20 67 22.24 67 25 C 67 27.76 64.76 30 62 30 C 59.24 30 57 27.76 57 25 C 57 22.24 59.24 20 62 20 Z ' +
          'M 50 84 C 52.76 84 55 86.24 55 89 C 55 91.76 52.76 94 50 94 C 47.24 94 45 91.76 45 89 C 45 86.24 47.24 84 50 84 Z',
        color: '#f2d24d',
      },
    ],
  },
  {
    id: 'easter-bunny',
    name: 'Bunny',
    category: 'easter',
    keywords: ['rabbit', 'hare', 'spring', 'easter'],
    parts: [
      { name: 'Ears', d: BUNNY_EARS, color: BUNNY_GREY },
      {
        name: 'Inner ears',
        d:
          'M 38 14 C 40 14 41.5 19 41.5 27 C 41.5 32 40 35 38 35 C 36 35 34.5 32 34.5 27 C 34.5 19 36 14 38 14 Z ' +
          'M 62 14 C 64 14 65.5 19 65.5 27 C 65.5 32 64 35 62 35 C 60 35 58.5 32 58.5 27 C 58.5 19 60 14 62 14 Z',
        color: BUNNY_PINK,
      },
      {
        name: 'Head',
        d: 'M 50 34 C 68 34 82 50 82 70 C 82 88 68 98 50 98 C 32 98 18 88 18 70 C 18 50 32 34 50 34 Z',
        color: BUNNY_GREY,
      },
      {
        name: 'Face',
        d:
          'M 39 58 C 41.21 58 43 60.24 43 63 C 43 65.76 41.21 68 39 68 C 36.79 68 35 65.76 35 63 C 35 60.24 36.79 58 39 58 Z ' +
          'M 61 58 C 63.21 58 65 60.24 65 63 C 65 65.76 63.21 68 61 68 C 58.79 68 57 65.76 57 63 C 57 60.24 58.79 58 61 58 Z',
        color: COAL,
      },
      { name: 'Nose', d: 'M 50 72 L 57 78 L 50 84 L 43 78 Z', color: BUNNY_PINK },
    ],
  },
  {
    id: 'easter-chick',
    name: 'Chick',
    category: 'easter',
    keywords: ['bird', 'baby', 'spring', 'hatch', 'yellow'],
    parts: [
      {
        name: 'Body',
        d: 'M 50 10 C 70 10 86 30 86 56 C 86 80 70 96 50 96 C 30 96 14 80 14 56 C 14 30 30 10 50 10 Z',
        color: CHICK_YELLOW,
      },
      {
        name: 'Wing',
        d: 'M 76 50 C 88 50 96 58 96 68 C 96 78 88 84 78 82 C 74 74 74 60 76 50 Z',
        color: '#e0b73c',
      },
      {
        name: 'Eyes',
        d:
          'M 40 38 C 43.31 38 46 41.13 46 45 C 46 48.87 43.31 52 40 52 C 36.69 52 34 48.87 34 45 C 34 41.13 36.69 38 40 38 Z ' +
          'M 62 38 C 65.31 38 68 41.13 68 45 C 68 48.87 65.31 52 62 52 C 58.69 52 56 48.87 56 45 C 56 41.13 58.69 38 62 38 Z',
        color: COAL,
      },
      { name: 'Beak', d: 'M 44 58 L 62 62 L 44 68 Z', color: BEAK_ORANGE },
      {
        name: 'Feet',
        d: 'M 34 94 L 40 94 L 40 100 L 26 100 Z M 60 94 L 66 94 L 74 100 L 60 100 Z',
        color: BEAK_ORANGE,
      },
    ],
  },
  {
    id: 'easter-basket',
    name: 'Easter basket',
    category: 'easter',
    keywords: ['hamper', 'eggs', 'hunt', 'spring'],
    parts: [
      {
        name: 'Handle',
        d: 'M 22 56 C 22 26 78 26 78 56 L 68 56 C 68 40 32 40 32 56 Z',
        color: '#b9884a',
      },
      {
        name: 'Basket',
        d:
          'M 10 56 L 90 56 L 80 96 C 79 99 76 100 72 100 L 28 100 C 24 100 21 99 20 96 Z ' +
          'M 24 68 L 78 68 L 76 76 L 26 76 Z',
        color: '#c99a58',
      },
      {
        name: 'Eggs',
        d:
          'M 32 40 C 39 40 44 47 44 55 L 20 55 C 20 47 25 40 32 40 Z ' +
          'M 66 38 C 73 38 78 45 78 55 L 54 55 C 54 45 59 38 66 38 Z',
        color: EGG_PINK,
      },
    ],
  },
  {
    id: 'easter-tulip',
    name: 'Tulip',
    category: 'easter',
    keywords: ['flower', 'spring', 'bloom', 'garden'],
    parts: [
      {
        name: 'Bloom',
        d: 'M 26 22 C 26 12 32 4 38 4 C 42 4 46 8 50 16 C 54 8 58 4 62 4 C 68 4 74 12 74 22 C 74 40 64 54 50 54 C 36 54 26 40 26 22 Z',
        color: '#d6486e',
      },
      { name: 'Stem', d: 'M 46 52 L 54 52 L 54 100 L 46 100 Z', color: LEAF_GREEN },
      {
        name: 'Leaves',
        d:
          'M 46 66 C 34 62 22 68 16 82 C 30 88 42 80 46 72 Z ' +
          'M 54 78 C 66 74 78 80 84 94 C 70 100 58 92 54 84 Z',
        color: LEAF_GREEN,
      },
    ],
  },
  {
    id: 'easter-daffodil',
    name: 'Daffodil',
    category: 'easter',
    keywords: ['flower', 'narcissus', 'spring', 'yellow'],
    parts: [
      {
        name: 'Petals',
        d: 'M 44.74 39.21 C 37.22 16.35 50 0 50 0 C 50 0 62.78 16.35 55.26 39.21 Z M 56.71 40.05 C 72.75 22.1 93.3 25 93.3 25 C 93.3 25 85.54 44.24 61.97 49.16 Z M 61.97 50.84 C 85.54 55.76 93.3 75 93.3 75 C 93.3 75 72.75 77.9 56.71 59.95 Z M 55.26 60.79 C 62.78 83.65 50 100 50 100 C 50 100 37.22 83.65 44.74 60.79 Z M 43.29 59.95 C 27.25 77.9 6.7 75 6.7 75 C 6.7 75 14.46 55.76 38.03 50.84 Z M 38.03 49.16 C 14.46 44.24 6.7 25 6.7 25 C 6.7 25 27.25 22.1 43.29 40.05 Z',
        color: '#f2d24d',
      },
      {
        name: 'Trumpet',
        d: 'M 50 34 C 58.84 34 66 41.16 66 50 C 66 58.84 58.84 66 50 66 C 41.16 66 34 58.84 34 50 C 34 41.16 41.16 34 50 34 Z',
        color: BEAK_ORANGE,
      },
    ],
  },
  {
    id: 'easter-carrot',
    name: 'Carrot',
    category: 'easter',
    keywords: ['vegetable', 'bunny', 'garden', 'orange'],
    parts: [
      {
        name: 'Root',
        d: 'M 62 26 C 74 34 76 46 70 58 L 30 98 C 26 102 20 96 24 92 Z',
        color: '#e2761b',
      },
      {
        name: 'Tops',
        d:
          'M 62 26 C 62 14 68 4 80 2 C 82 14 76 24 66 28 Z ' +
          'M 58 22 C 52 12 54 2 62 0 C 68 8 68 20 62 26 Z ' +
          'M 68 32 C 78 26 90 28 96 36 C 88 44 76 42 70 36 Z',
        color: LEAF_GREEN,
      },
    ],
  },
];
