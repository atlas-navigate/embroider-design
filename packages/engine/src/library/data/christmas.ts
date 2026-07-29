import type { LibraryShape } from '../types.js';

/**
 * Christmas.
 *
 * The gift box is drawn as four quadrant panels with the ribbon filling the
 * channel between them, rather than as a solid box with a ribbon laid over it.
 * A ribbon on top would double the thread along both bands; cutting the box
 * into panels costs nothing and stitches flat.
 *
 * Snowflakes are one continuous outline that walks around the hub. Drawn the
 * obvious way — three crossing bars — the centre would be three overlapping
 * regions and the machine would stitch it three times.
 */
const SNOW_WHITE = '#f4f7fa';
const SNOW_SHADOW = '#cdd9e5';
const TREE_GREEN = '#2f7d4f';
const TRUNK_BROWN = '#6b4423';
const HOLLY_RED = '#c0392b';
const GOLD = '#d8a13a';
const COAL = '#2b2b30';
const CARROT = '#e2761b';

const SNOWMAN_FACE =
  'M 44 29 C 45.66 29 47 30.34 47 32 C 47 33.66 45.66 35 44 35 C 42.34 35 41 33.66 41 32 C 41 30.34 42.34 29 44 29 Z ' +
  'M 56 29 C 57.66 29 59 30.34 59 32 C 59 33.66 57.66 35 56 35 C 54.34 35 53 33.66 53 32 C 53 30.34 54.34 29 56 29 Z';

const SNOWMAN_BUTTONS =
  'M 50 55 C 51.93 55 53.5 56.57 53.5 58.5 C 53.5 60.43 51.93 62 50 62 C 48.07 62 46.5 60.43 46.5 58.5 C 46.5 56.57 48.07 55 50 55 Z ' +
  'M 50 68 C 51.93 68 53.5 69.57 53.5 71.5 C 53.5 73.43 51.93 75 50 75 C 48.07 75 46.5 73.43 46.5 71.5 C 46.5 69.57 48.07 68 50 68 Z ' +
  'M 50 81 C 51.93 81 53.5 82.57 53.5 84.5 C 53.5 86.43 51.93 88 50 88 C 48.07 88 46.5 86.43 46.5 84.5 C 46.5 82.57 48.07 81 50 81 Z';

export const CHRISTMAS_SHAPES: LibraryShape[] = [
  {
    id: 'christmas-tree',
    name: 'Christmas tree',
    category: 'christmas',
    keywords: ['fir', 'pine', 'evergreen', 'xmas'],
    parts: [
      {
        name: 'Tree',
        d: 'M 50 2 L 72 34 L 60 34 L 78 62 L 64 62 L 86 92 L 14 92 L 36 62 L 22 62 L 40 34 L 28 34 Z',
        color: TREE_GREEN,
      },
      { name: 'Trunk', d: 'M 42 92 L 58 92 L 58 100 L 42 100 Z', color: TRUNK_BROWN },
    ],
  },
  {
    id: 'christmas-snowman',
    name: 'Snowman',
    category: 'christmas',
    keywords: ['snow', 'winter', 'frosty', 'carrot'],
    parts: [
      {
        name: 'Body',
        d:
          'M 50 18 C 58 18 64 24 64 32 C 64 36 63 39 61 42 C 70 45 76 51 76 58 C 76 62 74 66 71 69 ' +
          'C 82 73 90 80 90 88 C 90 96 72 100 50 100 C 28 100 10 96 10 88 C 10 80 18 73 29 69 ' +
          'C 26 66 24 62 24 58 C 24 51 30 45 39 42 C 37 39 36 36 36 32 C 36 24 42 18 50 18 Z ' +
          SNOWMAN_FACE +
          ' ' +
          SNOWMAN_BUTTONS,
        color: SNOW_WHITE,
      },
      {
        name: 'Arms',
        d:
          'M 24 54 L 5 44 L 3 48 L 23 58 Z M 12 47 L 4 40 L 2 43 L 10 50 Z ' +
          'M 76 54 L 95 44 L 97 48 L 77 58 Z M 88 47 L 96 40 L 98 43 L 90 50 Z',
        color: TRUNK_BROWN,
      },
      { name: 'Hat brim', d: 'M 26 15 L 74 15 L 74 22 L 26 22 Z', color: COAL },
      { name: 'Hat crown', d: 'M 36 1 L 64 1 L 64 15 L 36 15 Z', color: COAL },
      { name: 'Eyes', d: SNOWMAN_FACE, color: COAL },
      { name: 'Buttons', d: SNOWMAN_BUTTONS, color: COAL },
      { name: 'Nose', d: 'M 50 33 L 64 36 L 50 39 Z', color: CARROT },
    ],
  },
  {
    id: 'christmas-snowflake',
    name: 'Snowflake',
    category: 'christmas',
    keywords: ['snow', 'winter', 'frost', 'ice'],
    parts: [
      {
        name: 'Snowflake',
        d: 'M 48.59 41.11 L 46.39 4.14 L 50 0 L 53.61 4.14 L 51.41 41.11 L 53.69 43.61 L 56.99 44.34 L 87.91 23.95 L 93.3 25 L 91.52 30.2 L 58.4 46.77 L 57.38 50 L 58.4 53.23 L 91.52 69.8 L 93.3 75 L 87.91 76.05 L 56.99 55.66 L 53.69 56.39 L 51.41 58.89 L 53.61 95.86 L 50 100 L 46.39 95.86 L 48.59 58.89 L 46.31 56.39 L 43.01 55.66 L 12.09 76.05 L 6.7 75 L 8.48 69.8 L 41.6 53.23 L 42.62 50 L 41.6 46.77 L 8.48 30.2 L 6.7 25 L 12.09 23.95 L 43.01 44.34 L 46.31 43.61 Z',
        color: SNOW_SHADOW,
      },
    ],
  },
  {
    id: 'christmas-snowflake-branched',
    name: 'Branched snowflake',
    category: 'christmas',
    keywords: ['snow', 'winter', 'frost', 'crystal'],
    parts: [
      {
        name: 'Snowflake',
        d: 'M 49.03 42.06 L 47.32 28.16 L 37.26 18.48 L 47.95 22.08 L 47.19 4.09 L 50 0 L 52.81 4.09 L 52.05 22.08 L 62.74 18.48 L 52.68 28.16 L 50.97 42.06 L 53.28 44.32 L 56.39 45.19 L 67.57 36.76 L 70.93 23.21 L 73.16 34.26 L 88.36 24.61 L 93.3 25 L 91.17 29.47 L 75.21 37.81 L 83.67 45.27 L 70.25 41.4 L 57.36 46.87 L 56.56 50 L 57.36 53.13 L 70.25 58.6 L 83.67 54.73 L 75.21 62.19 L 91.17 70.53 L 93.3 75 L 88.36 75.39 L 73.16 65.74 L 70.93 76.79 L 67.57 63.24 L 56.39 54.81 L 53.28 55.68 L 50.97 57.94 L 52.68 71.84 L 62.74 81.52 L 52.05 77.92 L 52.81 95.91 L 50 100 L 47.19 95.91 L 47.95 77.92 L 37.26 81.52 L 47.32 71.84 L 49.03 57.94 L 46.72 55.68 L 43.61 54.81 L 32.43 63.24 L 29.07 76.79 L 26.84 65.74 L 11.64 75.39 L 6.7 75 L 8.83 70.53 L 24.79 62.19 L 16.33 54.73 L 29.75 58.6 L 42.64 53.13 L 43.44 50 L 42.64 46.87 L 29.75 41.4 L 16.33 45.27 L 24.79 37.81 L 8.83 29.47 L 6.7 25 L 11.64 24.61 L 26.84 34.26 L 29.07 23.21 L 32.43 36.76 L 43.61 45.19 L 46.72 44.32 Z',
        color: SNOW_SHADOW,
      },
    ],
  },
  {
    id: 'christmas-snowflake-fine',
    name: 'Fine snowflake',
    category: 'christmas',
    keywords: ['snow', 'winter', 'eight', 'star'],
    parts: [
      {
        name: 'Snowflake',
        d: 'M 49.16 42.04 L 47.49 26.13 L 40.35 18.44 L 48.12 20.06 L 47.59 4.06 L 50 0 L 52.41 4.06 L 51.88 20.06 L 59.65 18.44 L 52.51 26.13 L 50.84 42.04 L 52.51 43.94 L 55.03 43.78 L 65.1 31.35 L 65.49 20.86 L 69.84 27.5 L 80.78 15.82 L 85.36 14.64 L 84.18 19.22 L 72.5 30.16 L 79.14 34.51 L 68.65 34.9 L 56.22 44.97 L 56.06 47.49 L 57.96 49.16 L 73.87 47.49 L 81.56 40.35 L 79.94 48.12 L 95.94 47.59 L 100 50 L 95.94 52.41 L 79.94 51.88 L 81.56 59.65 L 73.87 52.51 L 57.96 50.84 L 56.06 52.51 L 56.22 55.03 L 68.65 65.1 L 79.14 65.49 L 72.5 69.84 L 84.18 80.78 L 85.36 85.36 L 80.78 84.18 L 69.84 72.5 L 65.49 79.14 L 65.1 68.65 L 55.03 56.22 L 52.51 56.06 L 50.84 57.96 L 52.51 73.87 L 59.65 81.56 L 51.88 79.94 L 52.41 95.94 L 50 100 L 47.59 95.94 L 48.12 79.94 L 40.35 81.56 L 47.49 73.87 L 49.16 57.96 L 47.49 56.06 L 44.97 56.22 L 34.9 68.65 L 34.51 79.14 L 30.16 72.5 L 19.22 84.18 L 14.64 85.36 L 15.82 80.78 L 27.5 69.84 L 20.86 65.49 L 31.35 65.1 L 43.78 55.03 L 43.94 52.51 L 42.04 50.84 L 26.13 52.51 L 18.44 59.65 L 20.06 51.88 L 4.06 52.41 L 0 50 L 4.06 47.59 L 20.06 48.12 L 18.44 40.35 L 26.13 47.49 L 42.04 49.16 L 43.94 47.49 L 43.78 44.97 L 31.35 34.9 L 20.86 34.51 L 27.5 30.16 L 15.82 19.22 L 14.64 14.64 L 19.22 15.82 L 30.16 27.5 L 34.51 20.86 L 34.9 31.35 L 44.97 43.78 L 47.49 43.94 Z',
        color: SNOW_SHADOW,
      },
    ],
  },
  {
    id: 'christmas-ornament',
    name: 'Ornament',
    category: 'christmas',
    keywords: ['bauble', 'ball', 'decoration', 'tree'],
    parts: [
      {
        name: 'Ball',
        d: 'M 50 26 C 68.78 26 84 41.22 84 60 C 84 78.78 68.78 94 50 94 C 31.22 94 16 78.78 16 60 C 16 41.22 31.22 26 50 26 Z',
        color: HOLLY_RED,
      },
      { name: 'Cap', d: 'M 42 14 L 58 14 L 58 28 L 42 28 Z', color: GOLD },
      {
        name: 'Hanger',
        d: 'M 43 14 C 43 5 57 5 57 14 L 52 14 C 52 10 48 10 48 14 Z',
        color: GOLD,
      },
    ],
  },
  {
    id: 'christmas-candy-cane',
    name: 'Candy cane',
    category: 'christmas',
    keywords: ['sweet', 'peppermint', 'stripe', 'treat'],
    parts: [
      {
        name: 'Cane',
        d:
          'M 34 100 L 34 34 C 34 16 48 4 66 4 C 84 4 98 16 98 34 L 78 34 C 78 26 73 22 66 22 C 59 22 54 26 54 34 L 54 100 Z ' +
          // Stripes are cut out, not laid on: the fabric shows through, which is
          // what a white stripe on a red cane actually is.
          'M 34 50 L 54 42 L 54 52 L 34 60 Z ' +
          'M 34 70 L 54 62 L 54 72 L 34 80 Z ' +
          'M 34 90 L 54 82 L 54 92 L 34 98 Z',
        color: HOLLY_RED,
      },
    ],
  },
  {
    id: 'christmas-holly',
    name: 'Holly',
    category: 'christmas',
    keywords: ['leaves', 'berries', 'sprig', 'mistletoe'],
    parts: [
      {
        name: 'Leaves',
        d:
          'M 48 54 C 30 52 18 42 12 28 C 22 30 28 26 30 20 C 34 28 40 30 46 28 C 44 36 46 46 48 54 Z ' +
          'M 52 54 C 70 52 82 42 88 28 C 78 30 72 26 70 20 C 66 28 60 30 54 28 C 56 36 54 46 52 54 Z',
        color: TREE_GREEN,
      },
      {
        name: 'Berries',
        d:
          'M 40 60 C 45.52 60 50 64.48 50 70 C 50 75.52 45.52 80 40 80 C 34.48 80 30 75.52 30 70 C 30 64.48 34.48 60 40 60 Z ' +
          'M 62 62 C 67.52 62 72 66.48 72 72 C 72 77.52 67.52 82 62 82 C 56.48 82 52 77.52 52 72 C 52 66.48 56.48 62 62 62 Z ' +
          'M 50 82 C 55.52 82 60 86.48 60 92 C 60 97.52 55.52 100 50 100 C 44.48 100 40 97.52 40 92 C 40 86.48 44.48 82 50 82 Z',
        color: HOLLY_RED,
      },
    ],
  },
  {
    id: 'christmas-gift',
    name: 'Gift',
    category: 'christmas',
    keywords: ['present', 'box', 'ribbon', 'bow', 'birthday'],
    parts: [
      {
        name: 'Box',
        d:
          'M 6 34 L 44 34 L 44 52 L 6 52 Z M 56 34 L 94 34 L 94 52 L 56 52 Z ' +
          'M 6 64 L 44 64 L 44 96 L 6 96 Z M 56 64 L 94 64 L 94 96 L 56 96 Z',
        color: HOLLY_RED,
      },
      {
        name: 'Ribbon',
        d: 'M 44 34 L 56 34 L 56 52 L 94 52 L 94 64 L 56 64 L 56 96 L 44 96 L 44 64 L 6 64 L 6 52 L 44 52 Z',
        color: GOLD,
      },
      {
        name: 'Bow',
        d:
          'M 44 34 C 34 20 20 18 22 28 C 24 36 36 34 44 34 Z ' +
          'M 56 34 C 66 20 80 18 78 28 C 76 36 64 34 56 34 Z',
        color: GOLD,
      },
    ],
  },
  {
    id: 'christmas-bell',
    name: 'Bell',
    category: 'christmas',
    keywords: ['jingle', 'ring', 'chime'],
    parts: [
      {
        name: 'Bell',
        d: 'M 50 6 C 53 6 55 8 55 11 C 69 15 79 30 79 48 C 79 66 83 76 89 82 L 11 82 C 17 76 21 66 21 48 C 21 30 31 15 45 11 C 45 8 47 6 50 6 Z',
        color: GOLD,
      },
      {
        name: 'Clapper',
        d: 'M 50 84 C 54.42 84 58 87.58 58 92 C 58 96.42 54.42 100 50 100 C 45.58 100 42 96.42 42 92 C 42 87.58 45.58 84 50 84 Z',
        color: '#a8761f',
      },
    ],
  },
  {
    id: 'christmas-stocking',
    name: 'Stocking',
    category: 'christmas',
    keywords: ['sock', 'fireplace', 'santa', 'gift'],
    parts: [
      {
        name: 'Boot',
        d: 'M 28 26 L 72 26 L 72 60 C 72 68 78 72 86 76 C 94 80 98 88 96 96 C 95 99 92 100 88 100 L 48 100 C 37 100 28 91 28 80 Z',
        color: HOLLY_RED,
      },
      { name: 'Cuff', d: 'M 22 6 L 78 6 L 78 28 L 22 28 Z', color: SNOW_WHITE },
    ],
  },
  {
    id: 'christmas-wreath',
    name: 'Wreath',
    category: 'christmas',
    keywords: ['garland', 'door', 'ring', 'holly'],
    parts: [
      {
        name: 'Ring',
        d:
          'M 50 2 C 76.51 2 98 23.49 98 50 C 98 76.51 76.51 98 50 98 C 23.49 98 2 76.51 2 50 C 2 23.49 23.49 2 50 2 Z ' +
          'M 50 24 C 35.64 24 24 35.64 24 50 C 24 64.36 35.64 76 50 76 C 64.36 76 76 64.36 76 50 C 76 35.64 64.36 24 50 24 Z',
        color: TREE_GREEN,
      },
      {
        name: 'Bow',
        d: 'M 50 80 C 42 72 28 72 30 82 C 32 90 44 88 50 84 C 56 88 68 90 70 82 C 72 72 58 72 50 80 Z',
        color: HOLLY_RED,
      },
    ],
  },
  {
    id: 'christmas-reindeer',
    name: 'Reindeer',
    category: 'christmas',
    keywords: ['deer', 'rudolph', 'antlers', 'sleigh'],
    parts: [
      {
        name: 'Antlers',
        d:
          'M 40 42 L 33 22 L 21 20 L 29 13 L 23 3 L 36 10 L 40 1 L 45 19 L 46 40 Z ' +
          'M 60 42 L 67 22 L 79 20 L 71 13 L 77 3 L 64 10 L 60 1 L 55 19 L 54 40 Z',
        color: '#6b4423',
      },
      {
        name: 'Head',
        d:
          'M 50 40 C 62 40 70 51 70 65 C 70 81 62 94 50 94 C 38 94 30 81 30 65 C 30 51 38 40 50 40 Z ' +
          'M 42 58 C 44.21 58 46 60.24 46 63 C 46 65.76 44.21 68 42 68 C 39.79 68 38 65.76 38 63 C 38 60.24 39.79 58 42 58 Z ' +
          'M 58 58 C 60.21 58 62 60.24 62 63 C 62 65.76 60.21 68 58 68 C 55.79 68 54 65.76 54 63 C 54 60.24 55.79 58 58 58 Z ' +
          'M 50 78 C 55.52 78 60 82.48 60 88 C 60 93.52 55.52 98 50 98 C 44.48 98 40 93.52 40 88 C 40 82.48 44.48 78 50 78 Z',
        color: '#a5763f',
      },
      {
        name: 'Eyes',
        d:
          'M 42 58 C 44.21 58 46 60.24 46 63 C 46 65.76 44.21 68 42 68 C 39.79 68 38 65.76 38 63 C 38 60.24 39.79 58 42 58 Z ' +
          'M 58 58 C 60.21 58 62 60.24 62 63 C 62 65.76 60.21 68 58 68 C 55.79 68 54 65.76 54 63 C 54 60.24 55.79 58 58 58 Z',
        color: COAL,
      },
      {
        name: 'Nose',
        d: 'M 50 78 C 55.52 78 60 82.48 60 88 C 60 93.52 55.52 98 50 98 C 44.48 98 40 93.52 40 88 C 40 82.48 44.48 78 50 78 Z',
        color: HOLLY_RED,
      },
    ],
  },
  {
    id: 'christmas-santa-hat',
    name: 'Santa hat',
    category: 'christmas',
    keywords: ['father christmas', 'pom', 'red hat'],
    parts: [
      {
        name: 'Cone',
        d: 'M 10 74 C 14 46 34 20 62 12 C 74 9 84 16 84 28 C 84 40 74 48 62 52 L 22 78 Z',
        color: HOLLY_RED,
      },
      {
        name: 'Brim',
        d: 'M 8 70 L 44 70 C 50 70 54 75 54 81 C 54 87 50 92 44 92 L 8 92 C 2 92 2 70 8 70 Z',
        color: SNOW_WHITE,
      },
      {
        name: 'Pom',
        d: 'M 84 18 C 89.52 18 94 22.48 94 28 C 94 33.52 89.52 38 84 38 C 78.48 38 74 33.52 74 28 C 74 22.48 78.48 18 84 18 Z',
        color: SNOW_WHITE,
      },
    ],
  },
  {
    id: 'christmas-gingerbread',
    name: 'Gingerbread man',
    category: 'christmas',
    keywords: ['cookie', 'biscuit', 'baking', 'sweet'],
    parts: [
      {
        name: 'Cookie',
        d:
          'M 50 4 C 58 4 64 10 64 18 C 64 22 63 25 61 28 L 74 30 C 82 30 92 34 96 40 C 98 44 96 48 92 48 L 70 44 L 70 60 L 78 88 ' +
          'C 80 94 76 98 70 98 C 66 98 63 96 62 92 L 54 68 L 46 68 L 38 92 C 37 96 34 98 30 98 C 24 98 20 94 22 88 L 30 60 L 30 44 ' +
          'L 8 48 C 4 48 2 44 4 40 C 8 34 18 30 26 30 L 39 28 C 37 25 36 22 36 18 C 36 10 42 4 50 4 Z ' +
          'M 50 52 C 52.21 52 54 53.79 54 56 C 54 58.21 52.21 60 50 60 C 47.79 60 46 58.21 46 56 C 46 53.79 47.79 52 50 52 Z ' +
          'M 50 36 C 52.21 36 54 37.79 54 40 C 54 42.21 52.21 44 50 44 C 47.79 44 46 42.21 46 40 C 46 37.79 47.79 36 50 36 Z',
        color: '#b5763b',
      },
      {
        name: 'Buttons',
        d:
          'M 50 52 C 52.21 52 54 53.79 54 56 C 54 58.21 52.21 60 50 60 C 47.79 60 46 58.21 46 56 C 46 53.79 47.79 52 50 52 Z ' +
          'M 50 36 C 52.21 36 54 37.79 54 40 C 54 42.21 52.21 44 50 44 C 47.79 44 46 42.21 46 40 C 46 37.79 47.79 36 50 36 Z',
        color: SNOW_WHITE,
      },
    ],
  },
  {
    id: 'christmas-mitten',
    name: 'Mitten',
    category: 'christmas',
    keywords: ['glove', 'winter', 'warm', 'hand'],
    parts: [
      {
        name: 'Mitten',
        d: 'M 30 28 L 72 28 C 80 28 86 34 86 42 L 86 86 C 86 94 80 100 72 100 L 44 100 C 36 100 30 94 30 86 Z',
        color: HOLLY_RED,
      },
      {
        name: 'Thumb',
        d: 'M 30 48 C 22 46 12 50 10 58 C 8 66 14 72 22 72 L 30 72 Z',
        color: HOLLY_RED,
      },
      { name: 'Cuff', d: 'M 26 10 L 90 10 L 90 30 L 26 30 Z', color: SNOW_WHITE },
    ],
  },
];
