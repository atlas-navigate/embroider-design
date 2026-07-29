import type { LibraryShape } from '../types.js';

/**
 * Wedding.
 *
 * The interlocking rings are two separate parts, and that is not a stylistic
 * choice. In one part, the left ring's inner circle sits inside *both* its own
 * outer circle and the right ring's — nesting depth two, which the region
 * grouper correctly reads as a filled island, and the hole in the left ring
 * would stitch solid. Two parts, two independent nestings, no ambiguity.
 */
const GOLD = '#d8a13a';
const GOLD_DEEP = '#b8842a';
const CREAM = '#f5efe2';
const BLUSH = '#e8a0b4';
const LEAF = '#5a8f5e';

export const WEDDING_SHAPES: LibraryShape[] = [
  {
    id: 'wedding-rings',
    name: 'Wedding rings',
    category: 'wedding',
    keywords: ['marriage', 'engaged', 'gold', 'bands', 'interlocking'],
    parts: [
      {
        name: 'Left ring',
        d:
          'M 36 21 C 54.78 21 70 36.22 70 55 C 70 73.78 54.78 89 36 89 C 17.22 89 2 73.78 2 55 C 2 36.22 17.22 21 36 21 Z ' +
          'M 36 31 C 22.75 31 12 41.75 12 55 C 12 68.25 22.75 79 36 79 C 49.25 79 60 68.25 60 55 C 60 41.75 49.25 31 36 31 Z',
        color: GOLD,
      },
      {
        name: 'Right ring',
        d:
          'M 64 21 C 82.78 21 98 36.22 98 55 C 98 73.78 82.78 89 64 89 C 45.22 89 30 73.78 30 55 C 30 36.22 45.22 21 64 21 Z ' +
          'M 64 31 C 50.75 31 40 41.75 40 55 C 40 68.25 50.75 79 64 79 C 77.25 79 88 68.25 88 55 C 88 41.75 77.25 31 64 31 Z',
        color: GOLD_DEEP,
      },
    ],
  },
  {
    id: 'wedding-diamond-ring',
    name: 'Diamond ring',
    category: 'wedding',
    keywords: ['engagement', 'proposal', 'gem', 'jewel'],
    parts: [
      {
        name: 'Band',
        d:
          'M 50 36 C 66.57 36 80 49.43 80 66 C 80 82.57 66.57 96 50 96 C 33.43 96 20 82.57 20 66 C 20 49.43 33.43 36 50 36 Z ' +
          'M 50 44 C 37.85 44 28 53.85 28 66 C 28 78.15 37.85 88 50 88 C 62.15 88 72 78.15 72 66 C 72 53.85 62.15 44 50 44 Z',
        color: GOLD,
      },
      {
        name: 'Gem',
        d: 'M 34 16 L 66 16 L 50 40 Z M 34 16 L 42 6 L 58 6 L 66 16 Z',
        color: '#8fd3e8',
      },
    ],
  },
  {
    id: 'wedding-bells',
    name: 'Wedding bells',
    category: 'wedding',
    keywords: ['bells', 'ring', 'chime', 'celebrate'],
    parts: [
      {
        name: 'Left bell',
        d: 'M 28 14 C 30 14 32 16 32 18 C 42 21 49 32 49 46 C 49 60 52 68 56 72 L 0 72 C 4 68 7 60 7 46 C 7 32 14 21 24 18 C 24 16 26 14 28 14 Z',
        color: GOLD,
      },
      {
        name: 'Right bell',
        d: 'M 72 26 C 74 26 76 28 76 30 C 86 33 93 44 93 58 C 93 72 96 80 100 84 L 44 84 C 48 80 51 72 51 58 C 51 44 58 33 68 30 C 68 28 70 26 72 26 Z',
        color: GOLD_DEEP,
      },
      {
        name: 'Clappers',
        d:
          'M 28 74 C 31.31 74 34 76.69 34 80 C 34 83.31 31.31 86 28 86 C 24.69 86 22 83.31 22 80 C 22 76.69 24.69 74 28 74 Z ' +
          'M 72 86 C 75.31 86 78 88.69 78 92 C 78 95.31 75.31 98 72 98 C 68.69 98 66 95.31 66 92 C 66 88.69 68.69 86 72 86 Z',
        color: '#8a6a1f',
      },
    ],
  },
  {
    id: 'wedding-dove',
    name: 'Dove',
    category: 'wedding',
    keywords: ['bird', 'peace', 'white', 'flying'],
    parts: [
      {
        name: 'Body',
        d: 'M 4 58 C 16 46 32 40 48 40 C 54 32 64 26 76 26 C 82 26 88 28 92 32 L 84 36 C 88 40 90 46 90 52 C 90 68 76 82 58 84 L 38 86 C 26 88 14 86 6 80 C 12 78 18 74 22 68 C 14 66 8 62 4 58 Z',
        color: CREAM,
      },
      {
        name: 'Wing',
        d: 'M 38 46 C 50 42 62 46 68 56 C 60 64 48 66 38 62 C 34 56 34 50 38 46 Z',
        color: '#ddd5c4',
      },
      {
        name: 'Beak',
        d: 'M 92 32 L 100 34 L 92 38 Z',
        color: '#e2a53b',
      },
    ],
  },
  {
    id: 'wedding-cake',
    name: 'Wedding cake',
    category: 'wedding',
    keywords: ['tiers', 'celebrate', 'dessert', 'reception'],
    parts: [
      { name: 'Bottom tier', d: 'M 12 74 L 88 74 L 88 96 L 12 96 Z', color: CREAM },
      { name: 'Middle tier', d: 'M 24 52 L 76 52 L 76 72 L 24 72 Z', color: CREAM },
      { name: 'Top tier', d: 'M 34 30 L 66 30 L 66 50 L 34 50 Z', color: CREAM },
      {
        name: 'Icing',
        d:
          'M 12 74 C 20 80 28 68 36 74 C 44 80 52 68 60 74 C 68 80 76 68 88 74 L 88 78 L 12 78 Z ' +
          'M 24 52 C 32 58 40 46 48 52 C 56 58 64 46 76 52 L 76 56 L 24 56 Z',
        color: BLUSH,
      },
      {
        name: 'Topper',
        d: 'M 50 26 C 42 19 38 14 38 9 C 38 5 41 2 45 2 C 47 2 49 3 50 5 C 51 3 53 2 55 2 C 59 2 62 5 62 9 C 62 14 58 19 50 26 Z',
        color: '#d6335a',
      },
    ],
  },
  {
    id: 'wedding-flutes',
    name: 'Champagne flutes',
    category: 'wedding',
    keywords: ['toast', 'glasses', 'celebrate', 'cheers', 'drink'],
    parts: [
      {
        name: 'Left flute',
        d: 'M 4 6 L 40 6 L 34 42 C 34 48 30 52 26 54 L 26 88 L 38 88 L 38 94 L 6 94 L 6 88 L 18 88 L 18 54 C 14 52 10 48 10 42 Z',
        color: '#cfe3ef',
      },
      {
        name: 'Right flute',
        d: 'M 60 6 L 96 6 L 90 42 C 90 48 86 52 82 54 L 82 88 L 94 88 L 94 94 L 62 94 L 62 88 L 74 88 L 74 54 C 70 52 66 48 66 42 Z',
        color: '#cfe3ef',
      },
      {
        name: 'Bubbles',
        d:
          'M 22 18 C 24.21 18 26 19.79 26 22 C 26 24.21 24.21 26 22 26 C 19.79 26 18 24.21 18 22 C 18 19.79 19.79 18 22 18 Z ' +
          'M 30 30 C 31.66 30 33 31.34 33 33 C 33 34.66 31.66 36 30 36 C 28.34 36 27 34.66 27 33 C 27 31.34 28.34 30 30 30 Z ' +
          'M 78 18 C 80.21 18 82 19.79 82 22 C 82 24.21 80.21 26 78 26 C 75.79 26 74 24.21 74 22 C 74 19.79 75.79 18 78 18 Z ' +
          'M 70 30 C 71.66 30 73 31.34 73 33 C 73 34.66 71.66 36 70 36 C 68.34 36 67 34.66 67 33 C 67 31.34 68.34 30 70 30 Z',
        color: '#f2d98a',
      },
    ],
  },
  {
    id: 'wedding-bouquet',
    name: 'Bouquet',
    category: 'wedding',
    keywords: ['flowers', 'bride', 'posy', 'roses'],
    parts: [
      {
        name: 'Leaves',
        d:
          'M 50 52 C 34 50 20 42 12 28 C 26 26 40 34 50 48 Z ' +
          'M 50 52 C 66 50 80 42 88 28 C 74 26 60 34 50 48 Z',
        color: LEAF,
      },
      {
        name: 'Flowers',
        d:
          'M 30 16 C 40 16 46 24 46 34 C 46 44 40 50 30 50 C 20 50 14 44 14 34 C 14 24 20 16 30 16 Z ' +
          'M 70 16 C 80 16 86 24 86 34 C 86 44 80 50 70 50 C 60 50 54 44 54 34 C 54 24 60 16 70 16 Z ' +
          'M 50 2 C 60 2 66 10 66 20 C 66 30 60 36 50 36 C 40 36 34 30 34 20 C 34 10 40 2 50 2 Z',
        color: BLUSH,
      },
      {
        name: 'Ribbon',
        d: 'M 42 52 L 58 52 L 62 92 C 62 96 58 100 50 100 C 42 100 38 96 38 92 Z',
        color: '#e6dcc8',
      },
    ],
  },
  {
    id: 'wedding-arch',
    name: 'Wedding arch',
    category: 'wedding',
    keywords: ['ceremony', 'gate', 'altar', 'flowers'],
    parts: [
      {
        name: 'Arch',
        d: 'M 10 100 L 10 40 C 10 18 28 2 50 2 C 72 2 90 18 90 40 L 90 100 L 74 100 L 74 40 C 74 26 63 16 50 16 C 37 16 26 26 26 40 L 26 100 Z',
        color: '#c9b48a',
      },
      {
        name: 'Flowers',
        d:
          'M 22 22 C 28 16 36 18 38 26 C 32 32 24 30 22 22 Z ' +
          'M 78 22 C 72 16 64 18 62 26 C 68 32 76 30 78 22 Z ' +
          'M 50 2 C 58 2 62 8 60 14 C 54 18 46 18 40 14 C 38 8 42 2 50 2 Z',
        color: BLUSH,
      },
    ],
  },
];
