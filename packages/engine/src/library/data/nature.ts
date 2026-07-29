import type { LibraryShape } from '../types.js';

const LEAF_GREEN = '#4f8f45';
const DEEP_GREEN = '#356b32';
const BARK = '#6b4423';
const SKY = '#7cc3e0';
const SUN_GOLD = '#f2b134';
const COAL = '#2b2b30';

export const NATURE_SHAPES: LibraryShape[] = [
  {
    id: 'nature-butterfly',
    name: 'Butterfly',
    category: 'nature',
    keywords: ['insect', 'wings', 'spring', 'garden', 'moth'],
    parts: [
      {
        name: 'Upper wings',
        d:
          'M 46 42 C 36 22 20 8 10 10 C 0 12 0 30 8 42 C 16 52 32 52 46 46 Z ' +
          'M 54 42 C 64 22 80 8 90 10 C 100 12 100 30 92 42 C 84 52 68 52 54 46 Z',
        color: '#e8823a',
      },
      {
        name: 'Lower wings',
        d:
          'M 46 52 C 36 62 22 74 16 86 C 12 94 22 98 32 92 C 40 87 46 74 48 60 Z ' +
          'M 54 52 C 64 62 78 74 84 86 C 88 94 78 98 68 92 C 60 87 54 74 52 60 Z',
        color: '#d6602a',
      },
      {
        name: 'Body',
        d:
          'M 50 26 C 53 26 55 30 55 38 L 55 78 C 55 84 53 88 50 88 C 47 88 45 84 45 78 L 45 38 C 45 30 47 26 50 26 Z ' +
          'M 48 26 C 44 16 38 8 30 4 C 34 14 40 22 46 28 Z ' +
          'M 52 26 C 56 16 62 8 70 4 C 66 14 60 22 54 28 Z',
        color: COAL,
      },
    ],
  },
  {
    id: 'nature-bee',
    name: 'Bee',
    category: 'nature',
    keywords: ['insect', 'honey', 'bumble', 'buzz', 'garden'],
    parts: [
      {
        name: 'Wings',
        d:
          'M 40 30 C 28 14 12 8 6 16 C 0 26 12 40 32 42 Z ' +
          'M 60 30 C 72 14 88 8 94 16 C 100 26 88 40 68 42 Z',
        color: '#cfe6f2',
      },
      {
        name: 'Body',
        d: 'M 50 34 C 68 34 82 48 82 66 C 82 84 68 96 50 96 C 32 96 18 84 18 66 C 18 48 32 34 50 34 Z',
        color: SUN_GOLD,
      },
      {
        name: 'Stripes',
        d:
          'M 25 50 C 32 44 68 44 75 50 L 71 58 C 62 53 38 53 29 58 Z ' +
          'M 19 68 L 81 68 L 79 78 L 21 78 Z ' +
          'M 27 86 C 36 92 64 92 73 86 L 68 92 C 58 97 42 97 32 92 Z',
        color: COAL,
      },
    ],
  },
  {
    id: 'nature-ladybug',
    name: 'Ladybug',
    category: 'nature',
    keywords: ['ladybird', 'beetle', 'insect', 'spots', 'garden'],
    parts: [
      {
        name: 'Shell',
        d:
          'M 50 20 C 74 20 92 42 92 66 C 92 86 74 98 50 98 C 26 98 8 86 8 66 C 8 42 26 20 50 20 Z ' +
          'M 47 24 L 53 24 L 53 96 L 47 96 Z ' +
          'M 28 44 C 32.42 44 36 47.58 36 52 C 36 56.42 32.42 60 28 60 C 23.58 60 20 56.42 20 52 C 20 47.58 23.58 44 28 44 Z ' +
          'M 72 44 C 76.42 44 80 47.58 80 52 C 80 56.42 76.42 60 72 60 C 67.58 60 64 56.42 64 52 C 64 47.58 67.58 44 72 44 Z ' +
          'M 32 72 C 36.42 72 40 75.58 40 80 C 40 84.42 36.42 88 32 88 C 27.58 88 24 84.42 24 80 C 24 75.58 27.58 72 32 72 Z ' +
          'M 68 72 C 72.42 72 76 75.58 76 80 C 76 84.42 72.42 88 68 88 C 63.58 88 60 84.42 60 80 C 60 75.58 63.58 72 68 72 Z',
        color: '#cc2f2f',
      },
      {
        name: 'Head',
        d: 'M 50 4 C 62 4 70 12 70 24 C 70 30 66 34 60 34 L 40 34 C 34 34 30 30 30 24 C 30 12 38 4 50 4 Z',
        color: COAL,
      },
    ],
  },
  {
    id: 'nature-dragonfly',
    name: 'Dragonfly',
    category: 'nature',
    keywords: ['insect', 'wings', 'pond', 'garden'],
    parts: [
      {
        name: 'Wings',
        d:
          'M 44 32 C 30 22 12 18 4 24 C 0 30 10 38 28 40 C 36 41 42 38 44 34 Z ' +
          'M 56 32 C 70 22 88 18 96 24 C 100 30 90 38 72 40 C 64 41 58 38 56 34 Z ' +
          'M 44 44 C 32 46 16 52 10 60 C 6 66 16 70 32 66 C 40 64 44 56 45 48 Z ' +
          'M 56 44 C 68 46 84 52 90 60 C 94 66 84 70 68 66 C 60 64 56 56 55 48 Z',
        color: '#bfe0ef',
      },
      {
        name: 'Body',
        d:
          'M 50 20 C 54 20 57 25 57 34 L 56 60 C 56 76 54 92 50 98 C 46 92 44 76 44 60 L 43 34 C 43 25 46 20 50 20 Z ' +
          'M 50 2 C 56.63 2 62 7.37 62 14 C 62 20.63 56.63 26 50 26 C 43.37 26 38 20.63 38 14 C 38 7.37 43.37 2 50 2 Z',
        color: '#3f7f8f',
      },
    ],
  },
  {
    id: 'nature-flower-5',
    name: 'Flower',
    category: 'nature',
    keywords: ['bloom', 'petals', 'daisy', 'spring', 'garden'],
    parts: [
      {
        name: 'Petals',
        d: 'M 44 39.61 C 35.36 17.11 50 0 50 0 C 50 0 64.64 17.11 56 39.61 Z M 58.03 41.08 C 76.75 25.91 97.55 34.55 97.55 34.55 C 97.55 34.55 85.8 53.76 61.74 52.49 Z M 60.96 54.88 C 81.18 68 79.39 90.45 79.39 90.45 C 79.39 90.45 57.48 85.21 51.25 61.93 Z M 48.75 61.93 C 42.52 85.21 20.61 90.45 20.61 90.45 C 20.61 90.45 18.82 68 39.04 54.88 Z M 38.26 52.49 C 14.2 53.76 2.45 34.55 2.45 34.55 C 2.45 34.55 23.25 25.91 41.97 41.08 Z',
        color: '#e8629a',
      },
      {
        name: 'Centre',
        d: 'M 50 36 C 57.73 36 64 42.27 64 50 C 64 57.73 57.73 64 50 64 C 42.27 64 36 57.73 36 50 C 36 42.27 42.27 36 50 36 Z',
        color: SUN_GOLD,
      },
    ],
  },
  {
    id: 'nature-flower-6',
    name: 'Six-petal flower',
    category: 'nature',
    keywords: ['bloom', 'petals', 'blossom', 'spring'],
    parts: [
      {
        name: 'Petals',
        d: 'M 44.74 39.21 C 37.22 16.35 50 0 50 0 C 50 0 62.78 16.35 55.26 39.21 Z M 56.71 40.05 C 72.75 22.1 93.3 25 93.3 25 C 93.3 25 85.54 44.24 61.97 49.16 Z M 61.97 50.84 C 85.54 55.76 93.3 75 93.3 75 C 93.3 75 72.75 77.9 56.71 59.95 Z M 55.26 60.79 C 62.78 83.65 50 100 50 100 C 50 100 37.22 83.65 44.74 60.79 Z M 43.29 59.95 C 27.25 77.9 6.7 75 6.7 75 C 6.7 75 14.46 55.76 38.03 50.84 Z M 38.03 49.16 C 14.46 44.24 6.7 25 6.7 25 C 6.7 25 27.25 22.1 43.29 40.05 Z',
        color: '#a05fd6',
      },
      {
        name: 'Centre',
        d: 'M 50 36 C 57.73 36 64 42.27 64 50 C 64 57.73 57.73 64 50 64 C 42.27 64 36 57.73 36 50 C 36 42.27 42.27 36 50 36 Z',
        color: SUN_GOLD,
      },
    ],
  },
  {
    id: 'nature-flower-8',
    name: 'Eight-petal flower',
    category: 'nature',
    keywords: ['bloom', 'petals', 'rosette', 'spring'],
    parts: [
      {
        name: 'Petals',
        d: 'M 45.9 38.72 C 40.08 15.39 50 0 50 0 C 50 0 59.92 15.39 54.1 38.72 Z M 55.07 39.12 C 67.45 18.51 85.36 14.64 85.36 14.64 C 85.36 14.64 81.49 32.55 60.88 44.93 Z M 61.28 45.9 C 84.61 40.08 100 50 100 50 C 100 50 84.61 59.92 61.28 54.1 Z M 60.88 55.07 C 81.49 67.45 85.36 85.36 85.36 85.36 C 85.36 85.36 67.45 81.49 55.07 60.88 Z M 54.1 61.28 C 59.92 84.61 50 100 50 100 C 50 100 40.08 84.61 45.9 61.28 Z M 44.93 60.88 C 32.55 81.49 14.64 85.36 14.64 85.36 C 14.64 85.36 18.51 67.45 39.12 55.07 Z M 38.72 54.1 C 15.39 59.92 0 50 0 50 C 0 50 15.39 40.08 38.72 45.9 Z M 39.12 44.93 C 18.51 32.55 14.64 14.64 14.64 14.64 C 14.64 14.64 32.55 18.51 44.93 39.12 Z',
        color: '#f2884d',
      },
      {
        name: 'Centre',
        d: 'M 50 38 C 56.63 38 62 43.37 62 50 C 62 56.63 56.63 62 50 62 C 43.37 62 38 56.63 38 50 C 38 43.37 43.37 38 50 38 Z',
        color: '#b25a1f',
      },
    ],
  },
  {
    id: 'nature-leaf',
    name: 'Leaf',
    category: 'nature',
    keywords: ['plant', 'green', 'nature', 'foliage'],
    parts: [
      {
        name: 'Leaf',
        d:
          'M 50 2 C 78 18 92 44 88 68 C 84 88 68 98 50 98 C 32 98 16 88 12 68 C 8 44 22 18 50 2 Z ' +
          'M 46 24 L 54 24 L 54 96 L 46 96 Z',
        color: LEAF_GREEN,
      },
    ],
  },
  {
    id: 'nature-tree',
    name: 'Tree',
    category: 'nature',
    keywords: ['oak', 'forest', 'plant', 'nature'],
    parts: [
      {
        name: 'Canopy',
        d: 'M 50 2 C 68 2 82 14 84 30 C 94 36 98 48 94 60 C 90 72 78 78 66 76 C 60 84 50 88 40 84 C 30 88 18 84 14 74 C 4 70 0 58 4 46 C 8 36 16 30 24 28 C 28 12 38 2 50 2 Z',
        color: DEEP_GREEN,
      },
      {
        name: 'Trunk',
        d: 'M 44 74 L 56 74 L 58 100 L 42 100 Z',
        color: BARK,
      },
    ],
  },
  {
    id: 'nature-mountain',
    name: 'Mountain',
    category: 'nature',
    keywords: ['peak', 'hike', 'alps', 'outdoors', 'summit'],
    parts: [
      {
        name: 'Range',
        d: 'M 2 92 L 34 34 L 52 64 L 68 40 L 98 92 Z',
        color: '#5a6b7a',
      },
      {
        name: 'Snow',
        d: 'M 34 34 L 46 56 L 40 52 L 34 58 L 28 52 L 22 56 Z M 68 40 L 78 58 L 73 54 L 68 58 L 63 54 L 60 56 Z',
        color: '#f2f6fa',
      },
      { name: 'Ground', d: 'M 0 92 L 100 92 L 100 100 L 0 100 Z', color: '#4a5a68' },
    ],
  },
  {
    id: 'nature-cloud',
    name: 'Cloud',
    category: 'nature',
    keywords: ['weather', 'sky', 'rain', 'fluffy'],
    parts: [
      {
        name: 'Cloud',
        d: 'M 25 84 C 11 84 0 72 0 58 C 0 45 9 34 21 31 C 23 17 34 6 49 6 C 61 6 72 13 77 24 C 79 23 82 23 84 23 C 93 23 100 31 100 41 C 100 46 98 51 95 54 C 98 58 100 63 100 68 C 100 77 93 84 84 84 Z',
        color: '#dfe9f2',
      },
    ],
  },
  {
    id: 'nature-moon',
    name: 'Crescent moon',
    category: 'nature',
    keywords: ['night', 'sleep', 'sky', 'lunar', 'stars'],
    parts: [
      {
        name: 'Moon',
        d: 'M 72 2 C 44 8 24 27 24 50 C 24 73 44 92 72 98 C 46 90 32 72 32 50 C 32 28 46 10 72 2 Z',
        color: '#f2d98a',
      },
    ],
  },
  {
    id: 'nature-rainbow',
    name: 'Rainbow',
    category: 'nature',
    keywords: ['weather', 'colours', 'arc', 'sky', 'pride'],
    parts: [
      {
        name: 'Outer arc',
        d: 'M 0 92 C 0 44 22 8 50 8 C 78 8 100 44 100 92 L 84 92 C 84 54 69 26 50 26 C 31 26 16 54 16 92 Z',
        color: '#d6485c',
      },
      {
        name: 'Middle arc',
        d: 'M 16 92 C 16 54 31 26 50 26 C 69 26 84 54 84 92 L 68 92 C 68 64 60 44 50 44 C 40 44 32 64 32 92 Z',
        color: SUN_GOLD,
      },
      {
        name: 'Inner arc',
        d: 'M 32 92 C 32 64 40 44 50 44 C 60 44 68 64 68 92 L 52 92 C 52 74 51 62 50 62 C 49 62 48 74 48 92 Z',
        color: SKY,
      },
    ],
  },
  {
    id: 'nature-cactus',
    name: 'Cactus',
    category: 'nature',
    keywords: ['desert', 'succulent', 'plant', 'southwest'],
    parts: [
      {
        name: 'Cactus',
        d: 'M 40 20 C 40 12 45 6 50 6 C 55 6 60 12 60 20 L 60 40 C 66 40 70 36 70 30 L 70 24 C 70 18 76 18 76 24 L 76 32 C 76 44 68 52 60 52 L 60 60 C 52 60 48 56 48 50 L 48 44 C 48 38 42 38 42 44 L 42 50 C 42 62 34 70 24 70 L 24 62 C 32 62 36 58 36 50 L 36 44 C 36 34 40 30 40 30 Z',
        color: LEAF_GREEN,
      },
      {
        name: 'Pot',
        d: 'M 26 74 L 74 74 L 68 98 C 67 99 65 100 62 100 L 38 100 C 35 100 33 99 32 98 Z',
        color: '#c07a4a',
      },
    ],
  },
  {
    id: 'nature-mushroom',
    name: 'Mushroom',
    category: 'nature',
    keywords: ['toadstool', 'fungus', 'forest', 'woodland'],
    parts: [
      {
        name: 'Cap',
        d:
          'M 50 6 C 76 6 96 28 96 50 C 96 56 92 58 86 58 L 14 58 C 8 58 4 56 4 50 C 4 28 24 6 50 6 Z ' +
          'M 28 22 C 33.52 22 38 26.48 38 32 C 38 37.52 33.52 42 28 42 C 22.48 42 18 37.52 18 32 C 18 26.48 22.48 22 28 22 Z ' +
          'M 66 18 C 72.63 18 78 23.37 78 30 C 78 36.63 72.63 42 66 42 C 59.37 42 54 36.63 54 30 C 54 23.37 59.37 18 66 18 Z ' +
          'M 46 40 C 50.42 40 54 43.58 54 48 C 54 52.42 50.42 56 46 56 C 41.58 56 38 52.42 38 48 C 38 43.58 41.58 40 46 40 Z',
        color: '#cc3f3f',
      },
      {
        name: 'Stem',
        d: 'M 36 58 L 64 58 L 64 88 C 64 95 58 100 50 100 C 42 100 36 95 36 88 Z',
        color: '#f2e8d6',
      },
    ],
  },
];
