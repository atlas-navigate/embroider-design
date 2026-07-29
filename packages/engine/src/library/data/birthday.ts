import type { LibraryShape } from '../types.js';

const CAKE_PINK = '#e8829f';
const CAKE_CREAM = '#f6e4c8';
const FLAME = '#f2b134';
const PARTY_BLUE = '#4f8bd6';
const PARTY_RED = '#d6485c';

export const BIRTHDAY_SHAPES: LibraryShape[] = [
  {
    id: 'birthday-cake',
    name: 'Birthday cake',
    category: 'birthday',
    keywords: ['candles', 'celebrate', 'party', 'dessert'],
    parts: [
      {
        name: 'Cake',
        d: 'M 8 62 L 92 62 L 92 94 C 92 97 90 98 86 98 L 14 98 C 10 98 8 97 8 94 Z',
        color: CAKE_CREAM,
      },
      {
        name: 'Icing',
        d: 'M 8 62 C 16 70 24 56 32 62 C 40 68 48 56 56 62 C 64 68 72 56 80 62 C 85 65 89 64 92 62 L 92 74 L 8 74 Z',
        color: CAKE_PINK,
      },
      {
        name: 'Candles',
        d: 'M 26 36 L 32 36 L 32 62 L 26 62 Z M 47 36 L 53 36 L 53 62 L 47 62 Z M 68 36 L 74 36 L 74 62 L 68 62 Z',
        color: PARTY_BLUE,
      },
      {
        name: 'Flames',
        d:
          'M 29 20 C 33 26 35 30 35 33 C 35 36 32 38 29 38 C 26 38 23 36 23 33 C 23 30 25 26 29 20 Z ' +
          'M 50 20 C 54 26 56 30 56 33 C 56 36 53 38 50 38 C 47 38 44 36 44 33 C 44 30 46 26 50 20 Z ' +
          'M 71 20 C 75 26 77 30 77 33 C 77 36 74 38 71 38 C 68 38 65 36 65 33 C 65 30 67 26 71 20 Z',
        color: FLAME,
      },
    ],
  },
  {
    id: 'birthday-cupcake',
    name: 'Cupcake',
    category: 'birthday',
    keywords: ['muffin', 'dessert', 'sweet', 'party'],
    parts: [
      {
        name: 'Wrapper',
        d: 'M 22 60 L 78 60 L 70 96 C 69 98 66 98 62 98 L 38 98 C 34 98 31 98 30 96 Z',
        color: PARTY_BLUE,
      },
      {
        name: 'Frosting',
        d: 'M 50 14 C 62 14 70 22 70 32 C 78 34 84 42 84 50 C 84 56 80 60 74 60 L 26 60 C 20 60 16 56 16 50 C 16 42 22 34 30 32 C 30 22 38 14 50 14 Z',
        color: CAKE_PINK,
      },
      {
        name: 'Cherry',
        d: 'M 50 0 C 56.08 0 61 4.92 61 11 C 61 17.08 56.08 22 50 22 C 43.92 22 39 17.08 39 11 C 39 4.92 43.92 0 50 0 Z',
        color: PARTY_RED,
      },
    ],
  },
  {
    id: 'birthday-balloon',
    name: 'Balloon',
    category: 'birthday',
    keywords: ['party', 'float', 'celebrate', 'helium'],
    parts: [
      {
        name: 'Balloon',
        d: 'M 50 2 C 68 2 82 18 82 38 C 82 56 68 72 50 76 C 32 72 18 56 18 38 C 18 18 32 2 50 2 Z',
        color: PARTY_RED,
      },
      { name: 'Knot', d: 'M 45 74 L 55 74 L 50 84 Z', color: PARTY_RED },
      {
        name: 'String',
        d: 'M 48 82 C 52 88 44 92 48 100 L 53 100 C 49 92 57 88 53 82 Z',
        color: '#6b6b70',
      },
    ],
  },
  {
    id: 'birthday-balloons',
    name: 'Balloon cluster',
    category: 'birthday',
    keywords: ['party', 'bunch', 'three', 'celebrate'],
    parts: [
      {
        name: 'Strings',
        d: 'M 22 46 C 30 62 44 72 48 96 L 52 96 C 46 70 34 60 26 44 Z M 50 96 L 54 96 C 58 74 66 62 74 46 L 70 44 C 62 60 54 72 50 96 Z',
        color: '#6b6b70',
      },
      {
        name: 'Left balloon',
        d: 'M 22 2 C 34 2 44 13 44 27 C 44 40 34 50 22 52 C 10 50 0 40 0 27 C 0 13 10 2 22 2 Z',
        color: PARTY_RED,
      },
      {
        name: 'Right balloon',
        d: 'M 78 2 C 90 2 100 13 100 27 C 100 40 90 50 78 52 C 66 50 56 40 56 27 C 56 13 66 2 78 2 Z',
        color: FLAME,
      },
      {
        name: 'Middle balloon',
        d: 'M 50 14 C 62 14 72 25 72 39 C 72 52 62 62 50 64 C 38 62 28 52 28 39 C 28 25 38 14 50 14 Z',
        color: PARTY_BLUE,
      },
    ],
  },
  {
    id: 'birthday-party-hat',
    name: 'Party hat',
    category: 'birthday',
    keywords: ['cone', 'celebrate', 'birthday', 'pom'],
    parts: [
      {
        name: 'Hat',
        d:
          'M 50 14 L 82 96 L 18 96 Z ' +
          'M 44 42 L 58 42 L 61 52 L 41 52 Z ' +
          'M 36 64 L 66 64 L 69 74 L 33 74 Z',
        color: PARTY_BLUE,
      },
      {
        name: 'Pom',
        d: 'M 50 1 C 54.97 1 59 5.03 59 10 C 59 14.97 54.97 19 50 19 C 45.03 19 41 14.97 41 10 C 41 5.03 45.03 1 50 1 Z',
        color: CAKE_PINK,
      },
    ],
  },
  {
    id: 'birthday-candle',
    name: 'Candle',
    category: 'birthday',
    keywords: ['flame', 'light', 'wax', 'celebrate'],
    parts: [
      {
        name: 'Flame',
        d: 'M 50 2 C 60 16 66 26 66 36 C 66 46 59 54 50 54 C 41 54 34 46 34 36 C 34 26 40 16 50 2 Z',
        color: FLAME,
      },
      { name: 'Candle', d: 'M 38 54 L 62 54 L 62 100 L 38 100 Z', color: CAKE_CREAM },
      {
        name: 'Stripes',
        d: 'M 38 62 L 62 62 L 62 70 L 38 70 Z M 38 80 L 62 80 L 62 88 L 38 88 Z',
        color: PARTY_RED,
      },
    ],
  },
  {
    id: 'birthday-confetti',
    name: 'Confetti',
    category: 'birthday',
    keywords: ['party', 'celebrate', 'streamers', 'scatter'],
    parts: [
      {
        name: 'Confetti',
        d:
          'M 8 6 L 22 10 L 16 24 L 2 20 Z ' +
          'M 62 2 L 76 8 L 68 22 L 54 16 Z ' +
          'M 34 30 L 48 26 L 52 40 L 38 44 Z ' +
          'M 82 34 L 96 40 L 88 54 L 74 48 Z ' +
          'M 6 48 L 20 52 L 14 66 L 0 62 Z ' +
          'M 52 60 L 66 64 L 60 78 L 46 74 Z ' +
          'M 22 74 L 36 80 L 28 94 L 14 88 Z ' +
          'M 76 74 L 90 78 L 84 92 L 70 88 Z',
        color: PARTY_RED,
      },
    ],
  },
];
