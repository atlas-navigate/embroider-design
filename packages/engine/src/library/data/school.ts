import type { LibraryShape } from '../types.js';

const APPLE_RED = '#c8342f';
const LEAF_GREEN = '#4f8f45';
const PENCIL_YELLOW = '#e8b62c';
const WOOD = '#d2a86a';
const NAVY = '#2f4a7a';
const BUS_YELLOW = '#f2b71c';
const COAL = '#2b2b30';

export const SCHOOL_SHAPES: LibraryShape[] = [
  {
    id: 'school-apple',
    name: 'Apple',
    category: 'school',
    keywords: ['teacher', 'fruit', 'class', 'healthy'],
    parts: [
      {
        name: 'Apple',
        d: 'M 50 26 C 60 20 74 22 82 32 C 92 44 90 66 80 82 C 72 94 62 100 54 98 C 52 97 48 97 46 98 C 38 100 28 94 20 82 C 10 66 8 44 18 32 C 26 22 40 20 50 26 Z',
        color: APPLE_RED,
      },
      { name: 'Stem', d: 'M 47 6 L 53 6 L 53 24 L 47 24 Z', color: '#6b4423' },
      {
        name: 'Leaf',
        d: 'M 53 20 C 60 8 74 3 86 6 C 84 18 72 26 56 26 Z',
        color: LEAF_GREEN,
      },
    ],
  },
  {
    id: 'school-pencil',
    name: 'Pencil',
    category: 'school',
    keywords: ['write', 'draw', 'stationery', 'school'],
    parts: [
      { name: 'Body', d: 'M 10 76 L 24 90 L 88 26 L 74 12 Z', color: PENCIL_YELLOW },
      { name: 'Wood', d: 'M 2 98 L 10 76 L 24 90 Z', color: WOOD },
      { name: 'Tip', d: 'M 2 98 L 6 87 L 13 94 Z', color: COAL },
      { name: 'Ferrule', d: 'M 74 12 L 88 26 L 94 20 L 80 6 Z', color: '#9aa0a6' },
      { name: 'Eraser', d: 'M 80 6 L 94 20 L 98 16 C 100 14 100 10 98 8 L 92 2 C 90 0 86 0 84 2 Z', color: '#e8829f' },
    ],
  },
  {
    id: 'school-graduation-cap',
    name: 'Graduation cap',
    category: 'school',
    keywords: ['mortarboard', 'graduate', 'college', 'degree'],
    parts: [
      { name: 'Board', d: 'M 50 8 L 96 30 L 50 52 L 4 30 Z', color: COAL },
      {
        name: 'Cap',
        d: 'M 26 40 L 74 40 L 74 68 C 74 78 62 84 50 84 C 38 84 26 78 26 68 Z',
        color: '#3f4148',
      },
      {
        name: 'Tassel',
        d: 'M 93 32 L 99 32 L 99 66 C 99 72 95 76 90 76 L 90 70 C 92 70 93 68 93 66 Z M 86 70 L 94 70 L 96 96 L 84 96 Z',
        color: PENCIL_YELLOW,
      },
    ],
  },
  {
    id: 'school-book',
    name: 'Book',
    category: 'school',
    keywords: ['read', 'library', 'study', 'textbook'],
    parts: [
      {
        name: 'Cover',
        d: 'M 6 8 L 86 8 C 92 8 96 12 96 18 L 96 84 C 96 90 92 94 86 94 L 6 94 Z',
        color: NAVY,
      },
      { name: 'Pages', d: 'M 20 16 L 86 16 L 86 86 L 20 86 Z', color: '#f2efe6' },
      { name: 'Spine', d: 'M 6 8 L 20 8 L 20 94 L 6 94 Z', color: '#22355c' },
      {
        name: 'Bookmark',
        d: 'M 66 16 L 78 16 L 78 46 L 72 38 L 66 46 Z',
        color: APPLE_RED,
      },
    ],
  },
  {
    id: 'school-bus',
    name: 'School bus',
    category: 'school',
    keywords: ['transport', 'yellow', 'ride', 'vehicle'],
    parts: [
      {
        name: 'Body',
        d:
          'M 4 26 C 4 20 8 16 14 16 L 86 16 C 92 16 96 20 96 26 L 96 74 C 96 80 92 84 86 84 L 14 84 C 8 84 4 80 4 74 Z ' +
          'M 14 30 L 36 30 L 36 48 L 14 48 Z ' +
          'M 44 30 L 66 30 L 66 48 L 44 48 Z ' +
          'M 74 30 L 90 30 L 90 48 L 74 48 Z',
        color: BUS_YELLOW,
      },
      {
        name: 'Wheels',
        d:
          'M 26 74 C 33.73 74 40 80.27 40 88 C 40 95.73 33.73 100 26 100 C 18.27 100 12 95.73 12 88 C 12 80.27 18.27 74 26 74 Z ' +
          'M 74 74 C 81.73 74 88 80.27 88 88 C 88 95.73 81.73 100 74 100 C 66.27 100 60 95.73 60 88 C 60 80.27 66.27 74 74 74 Z',
        color: COAL,
      },
    ],
  },
  {
    id: 'school-ruler',
    name: 'Ruler',
    category: 'school',
    keywords: ['measure', 'straight', 'stationery', 'geometry'],
    parts: [
      {
        name: 'Ruler',
        d:
          'M 2 34 L 98 34 L 98 66 L 2 66 Z ' +
          'M 12 34 L 16 34 L 16 50 L 12 50 Z ' +
          'M 26 34 L 30 34 L 30 44 L 26 44 Z ' +
          'M 40 34 L 44 34 L 44 50 L 40 50 Z ' +
          'M 54 34 L 58 34 L 58 44 L 54 44 Z ' +
          'M 68 34 L 72 34 L 72 50 L 68 50 Z ' +
          'M 82 34 L 86 34 L 86 44 L 82 44 Z',
        color: WOOD,
      },
    ],
  },
  {
    id: 'school-backpack',
    name: 'Backpack',
    category: 'school',
    keywords: ['bag', 'rucksack', 'satchel', 'school'],
    parts: [
      {
        name: 'Bag',
        d: 'M 12 40 C 12 26 24 16 50 16 C 76 16 88 26 88 40 L 88 88 C 88 94 84 98 78 98 L 22 98 C 16 98 12 94 12 88 Z',
        color: NAVY,
      },
      {
        name: 'Straps',
        d: 'M 34 18 C 34 6 42 2 50 2 C 58 2 66 6 66 18 L 58 18 C 58 12 55 10 50 10 C 45 10 42 12 42 18 Z',
        color: '#22355c',
      },
      {
        name: 'Flap',
        d: 'M 12 44 C 12 32 24 26 50 26 C 76 26 88 32 88 44 L 88 58 C 88 62 84 64 78 64 L 22 64 C 16 64 12 62 12 58 Z',
        color: '#3f5f96',
      },
      { name: 'Buckle', d: 'M 42 58 L 58 58 L 58 74 L 42 74 Z', color: PENCIL_YELLOW },
    ],
  },
];
