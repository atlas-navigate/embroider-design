import type { LibraryShape } from '../types.js';

const NAVY = '#1f3f66';
const SEA = '#2f89b5';
const ROPE = '#d2b276';
const CANVAS = '#f4f1e6';
const RED = '#c0392b';

export const NAUTICAL_SHAPES: LibraryShape[] = [
  {
    id: 'nautical-anchor',
    name: 'Anchor',
    category: 'nautical',
    keywords: ['ship', 'sea', 'sailor', 'boat', 'marine'],
    parts: [
      {
        name: 'Ring',
        d: 'M 50 0 C 56.63 0 62 5.37 62 12 C 62 18.63 56.63 24 50 24 C 43.37 24 38 18.63 38 12 C 38 5.37 43.37 0 50 0 Z M 50 6 C 46.69 6 44 8.69 44 12 C 44 15.31 46.69 18 50 18 C 53.31 18 56 15.31 56 12 C 56 8.69 53.31 6 50 6 Z',
        color: NAVY,
      },
      { name: 'Shank', d: 'M 45 20 L 55 20 L 55 88 L 45 88 Z', color: NAVY },
      { name: 'Stock', d: 'M 24 32 L 76 32 L 76 42 L 24 42 Z', color: NAVY },
      {
        name: 'Flukes',
        d: 'M 50 98 C 30 98 13 83 11 64 L 21 62 C 23 77 35 88 50 88 C 65 88 77 77 79 62 L 89 64 C 87 83 70 98 50 98 Z M 4 54 L 24 58 L 12 74 Z M 96 54 L 76 58 L 88 74 Z',
        color: NAVY,
      },
    ],
  },
  {
    id: 'nautical-ship-wheel',
    name: 'Ship wheel',
    category: 'nautical',
    keywords: ['helm', 'steer', 'captain', 'boat'],
    parts: [
      {
        name: 'Rim',
        d: 'M 50 2 C 76.51 2 98 23.49 98 50 C 98 76.51 76.51 98 50 98 C 23.49 98 2 76.51 2 50 C 2 23.49 23.49 2 50 2 Z M 50 14 C 30.12 14 14 30.12 14 50 C 14 69.88 30.12 86 50 86 C 69.88 86 86 69.88 86 50 C 86 30.12 69.88 14 50 14 Z',
        color: ROPE,
      },
      {
        name: 'Spokes',
        d: 'M 44 12 L 56 12 L 56 44 L 88 44 L 88 56 L 56 56 L 56 88 L 44 88 L 44 56 L 12 56 L 12 44 L 44 44 Z',
        color: ROPE,
      },
    ],
  },
  {
    id: 'nautical-sailboat',
    name: 'Sailboat',
    category: 'nautical',
    keywords: ['yacht', 'boat', 'sail', 'sea', 'ship'],
    parts: [
      {
        name: 'Hull',
        d: 'M 4 76 L 96 76 L 84 94 C 83 96 81 98 78 98 L 22 98 C 19 98 17 96 16 94 Z',
        color: NAVY,
      },
      { name: 'Mast', d: 'M 48 6 L 52 6 L 52 76 L 48 76 Z', color: '#8a6a45' },
      { name: 'Main sail', d: 'M 46 10 L 46 70 L 8 70 Z', color: CANVAS },
      { name: 'Jib', d: 'M 54 20 L 54 70 L 90 70 Z', color: RED },
    ],
  },
  {
    id: 'nautical-lighthouse',
    name: 'Lighthouse',
    category: 'nautical',
    keywords: ['beacon', 'light', 'coast', 'tower'],
    parts: [
      {
        name: 'Tower',
        d:
          'M 34 34 L 66 34 L 76 92 L 24 92 Z ' +
          'M 36 46 L 65 46 L 67 58 L 34 58 Z ' +
          'M 38 68 L 68 68 L 70 80 L 32 80 Z',
        color: CANVAS,
      },
      { name: 'Base', d: 'M 14 92 L 86 92 L 86 100 L 14 100 Z', color: '#6e6b66' },
      { name: 'Gallery', d: 'M 28 28 L 72 28 L 72 36 L 28 36 Z', color: NAVY },
      { name: 'Lantern', d: 'M 38 8 L 62 8 L 62 28 L 38 28 Z', color: '#f2c230' },
      { name: 'Roof', d: 'M 50 0 L 68 10 L 32 10 Z', color: RED },
    ],
  },
  {
    id: 'nautical-whale',
    name: 'Whale',
    category: 'nautical',
    keywords: ['sea', 'ocean', 'spout', 'mammal'],
    parts: [
      {
        name: 'Body',
        d:
          'M 40 34 C 62 34 82 44 90 58 C 96 68 92 80 80 84 C 64 90 40 90 26 82 C 14 76 8 64 10 54 C 12 44 24 34 40 34 Z ' +
          'M 34 50 C 37.31 50 40 53.13 40 57 C 40 60.87 37.31 64 34 64 C 30.69 64 28 60.87 28 57 C 28 53.13 30.69 50 34 50 Z',
        color: SEA,
      },
      {
        name: 'Tail',
        d: 'M 88 60 C 94 52 98 40 98 28 C 88 34 80 44 78 54 Z M 90 70 C 96 76 100 86 100 96 C 90 92 82 84 80 74 Z',
        color: '#20699a',
      },
      {
        name: 'Spout',
        d: 'M 38 30 C 34 20 36 10 44 4 C 48 12 46 22 42 30 Z M 44 30 C 48 20 56 14 66 14 C 62 22 54 28 46 30 Z',
        color: '#8fd3e8',
      },
      {
        name: 'Eye',
        d: 'M 34 50 C 37.31 50 40 53.13 40 57 C 40 60.87 37.31 64 34 64 C 30.69 64 28 60.87 28 57 C 28 53.13 30.69 50 34 50 Z',
        color: '#2b2b30',
      },
    ],
  },
  {
    id: 'nautical-starfish',
    name: 'Starfish',
    category: 'nautical',
    keywords: ['sea star', 'beach', 'shore', 'ocean'],
    parts: [
      {
        name: 'Starfish',
        d: 'M 50 2 C 56 2 58 8 60 18 C 62 28 64 32 70 34 C 78 37 86 36 92 34 C 98 32 100 38 96 44 C 90 52 84 56 80 62 C 76 68 76 76 78 86 C 80 94 74 96 68 92 C 60 86 54 84 50 84 C 46 84 40 86 32 92 C 26 96 20 94 22 86 C 24 76 24 68 20 62 C 16 56 10 52 4 44 C 0 38 2 32 8 34 C 14 36 22 37 30 34 C 36 32 38 28 40 18 C 42 8 44 2 50 2 Z',
        color: '#e2a13a',
      },
    ],
  },
  {
    id: 'nautical-shell',
    name: 'Seashell',
    category: 'nautical',
    keywords: ['scallop', 'beach', 'ocean', 'shore'],
    parts: [
      {
        name: 'Shell',
        d:
          'M 50 6 C 76 6 98 34 98 66 C 98 76 92 82 84 82 C 78 82 74 78 72 72 C 70 80 64 86 56 86 C 52 86 50 84 50 82 C 50 84 48 86 44 86 C 36 86 30 80 28 72 C 26 78 22 82 16 82 C 8 82 2 76 2 66 C 2 34 24 6 50 6 Z ' +
          'M 46 20 L 54 20 L 54 80 L 46 80 Z ' +
          'M 26 28 L 34 26 L 44 78 L 36 80 Z ' +
          'M 74 28 L 66 26 L 56 78 L 64 80 Z',
        color: '#eec1c8',
      },
    ],
  },
  {
    id: 'nautical-wave',
    name: 'Wave',
    category: 'nautical',
    keywords: ['sea', 'ocean', 'surf', 'water', 'curl'],
    parts: [
      {
        name: 'Wave',
        d: 'M 4 78 C 4 46 26 22 56 22 C 74 22 88 30 96 44 C 88 38 78 36 68 40 C 78 46 84 56 84 68 C 76 58 64 54 52 58 C 40 62 32 72 32 84 C 22 82 12 82 4 86 Z',
        color: SEA,
      },
      {
        name: 'Foam',
        d: 'M 2 90 C 14 84 26 88 38 92 C 50 96 62 92 74 88 C 84 85 92 86 98 90 L 98 100 L 2 100 Z',
        color: '#a8dcef',
      },
    ],
  },
  {
    id: 'nautical-life-ring',
    name: 'Life ring',
    category: 'nautical',
    keywords: ['buoy', 'rescue', 'float', 'safety'],
    parts: [
      {
        name: 'Ring',
        d: 'M 50 2 C 76.51 2 98 23.49 98 50 C 98 76.51 76.51 98 50 98 C 23.49 98 2 76.51 2 50 C 2 23.49 23.49 2 50 2 Z M 50 26 C 36.75 26 26 36.75 26 50 C 26 63.25 36.75 74 50 74 C 63.25 74 74 63.25 74 50 C 74 36.75 63.25 26 50 26 Z',
        color: CANVAS,
      },
      {
        name: 'Bands',
        d:
          'M 38 5 L 62 5 L 62 28 L 38 28 Z ' +
          'M 38 72 L 62 72 L 62 95 L 38 95 Z ' +
          'M 5 38 L 28 38 L 28 62 L 5 62 Z ' +
          'M 72 38 L 95 38 L 95 62 L 72 62 Z',
        color: RED,
      },
    ],
  },
];
