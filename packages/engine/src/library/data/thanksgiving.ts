import type { LibraryShape } from '../types.js';

const LEAF_RED = '#c4471f';
const LEAF_ORANGE = '#dd8020';
const LEAF_GOLD = '#d8a13a';
const BARK = '#7a5230';
const TURKEY_BROWN = '#8a5a30';
const CREAM = '#f2e3c6';

export const THANKSGIVING_SHAPES: LibraryShape[] = [
  {
    id: 'autumn-maple-leaf',
    name: 'Maple leaf',
    category: 'thanksgiving',
    keywords: ['fall', 'autumn', 'canada', 'tree', 'leaf'],
    parts: [
      {
        name: 'Leaf',
        d: 'M 50 0 L 58 22 L 72 16 L 68 34 L 92 28 L 82 44 L 100 48 L 84 58 L 92 72 L 70 68 L 74 88 L 56 76 L 54 100 L 46 100 L 44 76 L 26 88 L 30 68 L 8 72 L 16 58 L 0 48 L 18 44 L 8 28 L 32 34 L 28 16 L 42 22 Z',
        color: LEAF_RED,
      },
    ],
  },
  {
    id: 'autumn-oak-leaf',
    name: 'Oak leaf',
    category: 'thanksgiving',
    keywords: ['fall', 'autumn', 'lobed', 'tree'],
    parts: [
      {
        name: 'Leaf',
        d: 'M 50 2 C 58 2 62 8 60 16 C 68 12 76 16 74 26 C 84 24 90 32 84 40 C 94 42 96 52 88 58 C 96 64 92 74 82 74 C 86 84 78 92 68 88 C 68 96 60 100 54 94 L 54 100 L 46 100 L 46 94 C 40 100 32 96 32 88 C 22 92 14 84 18 74 C 8 74 4 64 12 58 C 4 52 6 42 16 40 C 10 32 16 24 26 26 C 24 16 32 12 40 16 C 38 8 42 2 50 2 Z',
        color: LEAF_ORANGE,
      },
    ],
  },
  {
    id: 'autumn-acorn',
    name: 'Acorn',
    category: 'thanksgiving',
    keywords: ['nut', 'oak', 'fall', 'squirrel'],
    parts: [
      {
        name: 'Nut',
        d: 'M 20 38 L 80 38 C 80 68 68 94 50 94 C 32 94 20 68 20 38 Z',
        color: '#c08a4a',
      },
      {
        name: 'Cap',
        d: 'M 50 10 C 70 10 86 20 86 30 C 86 36 80 40 70 40 L 30 40 C 20 40 14 36 14 30 C 14 20 30 10 50 10 Z',
        color: BARK,
      },
      { name: 'Stalk', d: 'M 46 2 L 54 2 L 54 12 L 46 12 Z', color: BARK },
    ],
  },
  {
    id: 'autumn-turkey',
    name: 'Turkey',
    category: 'thanksgiving',
    keywords: ['bird', 'thanksgiving', 'feast', 'gobble'],
    parts: [
      {
        name: 'Tail feathers',
        d: 'M 45.9 38.72 C 40.08 15.39 50 0 50 0 C 50 0 59.92 15.39 54.1 38.72 Z M 55.07 39.12 C 67.45 18.51 85.36 14.64 85.36 14.64 C 85.36 14.64 81.49 32.55 60.88 44.93 Z M 61.28 45.9 C 84.61 40.08 100 50 100 50 C 100 50 84.61 59.92 61.28 54.1 Z M 44.93 39.12 C 32.55 18.51 14.64 14.64 14.64 14.64 C 14.64 14.64 18.51 32.55 39.12 44.93 Z M 38.72 45.9 C 15.39 40.08 0 50 0 50 C 0 50 15.39 59.92 38.72 54.1 Z',
        color: LEAF_ORANGE,
      },
      {
        name: 'Body',
        d: 'M 50 40 C 64 40 74 54 74 72 C 74 88 64 98 50 98 C 36 98 26 88 26 72 C 26 54 36 40 50 40 Z',
        color: TURKEY_BROWN,
      },
      {
        name: 'Head',
        d: 'M 50 26 C 58 26 64 33 64 42 C 64 51 58 56 50 56 C 42 56 36 51 36 42 C 36 33 42 26 50 26 Z',
        color: '#a5703f',
      },
      {
        name: 'Beak and wattle',
        d: 'M 50 42 L 62 48 L 50 52 Z M 54 52 C 60 54 62 60 58 66 C 54 70 48 68 48 62 Z',
        color: '#c4471f',
      },
    ],
  },
  {
    id: 'autumn-pumpkin-pie',
    name: 'Pumpkin pie',
    category: 'thanksgiving',
    keywords: ['dessert', 'slice', 'thanksgiving', 'food'],
    parts: [
      { name: 'Crust', d: 'M 4 82 L 96 82 L 88 96 L 12 96 Z', color: '#d2a86a' },
      { name: 'Filling', d: 'M 50 10 L 96 82 L 4 82 Z', color: '#c07a2e' },
      {
        name: 'Cream',
        d: 'M 50 40 C 58 40 64 46 64 54 C 64 62 58 68 50 68 C 42 68 36 62 36 54 C 36 46 42 40 50 40 Z',
        color: CREAM,
      },
    ],
  },
  {
    id: 'autumn-cornucopia',
    name: 'Cornucopia',
    category: 'thanksgiving',
    keywords: ['horn of plenty', 'harvest', 'basket', 'feast'],
    parts: [
      {
        name: 'Horn',
        d: 'M 54 34 C 36 34 20 46 14 62 C 8 78 14 92 26 96 C 32 98 38 96 40 90 C 34 88 30 82 32 74 C 36 60 48 52 62 52 Z',
        color: '#b9884a',
      },
      {
        name: 'Fruit',
        d:
          'M 62 34 C 76 34 88 42 92 54 C 82 62 68 62 58 54 C 54 46 56 38 62 34 Z ' +
          'M 74 60 C 84 60 92 66 94 76 C 84 82 72 80 66 72 C 64 66 68 60 74 60 Z ' +
          'M 52 62 C 60 62 66 68 66 76 C 58 82 48 80 44 72 C 44 66 48 62 52 62 Z',
        color: LEAF_RED,
      },
      {
        name: 'Leaves',
        d: 'M 66 30 C 74 20 88 18 96 26 C 90 36 76 38 68 34 Z',
        color: '#5a8f4a',
      },
    ],
  },
  {
    id: 'autumn-wheat',
    name: 'Wheat',
    category: 'thanksgiving',
    keywords: ['grain', 'harvest', 'stalk', 'barley'],
    parts: [
      {
        name: 'Stalk',
        d: 'M 47 40 L 53 40 L 53 100 L 47 100 Z',
        color: LEAF_GOLD,
      },
      {
        name: 'Grains',
        d:
          'M 50 2 C 56 8 56 18 50 24 C 44 18 44 8 50 2 Z ' +
          'M 38 18 C 46 20 50 28 46 36 C 38 34 34 26 38 18 Z ' +
          'M 62 18 C 66 26 62 34 54 36 C 50 28 54 20 62 18 Z ' +
          'M 34 36 C 42 38 46 46 42 54 C 34 52 30 44 34 36 Z ' +
          'M 66 36 C 70 44 66 52 58 54 C 54 46 58 38 66 36 Z ' +
          'M 32 56 C 40 58 44 66 40 74 C 32 72 28 64 32 56 Z ' +
          'M 68 56 C 72 64 68 72 60 74 C 56 66 60 58 68 56 Z',
        color: LEAF_GOLD,
      },
    ],
  },
];
