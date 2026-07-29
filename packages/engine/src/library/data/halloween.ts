import type { LibraryShape } from '../types.js';

/**
 * Halloween.
 *
 * Note the pattern used wherever a dark feature sits on a light body — the
 * ghost's eyes, the cat's eyes, the skull's teeth. The feature's outline is cut
 * into the body as a counter-ring *and* filled by its own part, using the same
 * path data for both. Stitching the feature straight on top of a solid fill
 * instead would put two layers of thread in the same place: stiff, lumpy, and
 * prone to the underneath colour showing through the gaps in the top one. This
 * is ordinary practice in commercial digitizing and it is worth the duplication.
 */
const PUMPKIN_ORANGE = '#e8761a';
const PUMPKIN_DARK = '#c25a0c';
const STEM_GREEN = '#4b7233';
const NIGHT_BLACK = '#1f1f24';
const GHOST_WHITE = '#f2f2ef';
const CAT_EYE = '#f2c230';

/** Shared so the lantern is unmistakably the same gourd as the plain pumpkin. */
const PUMPKIN_BODY =
  'M 50 20 C 74 20 92 36 92 57 C 92 78 74 94 50 94 C 26 94 8 78 8 57 C 8 36 26 20 50 20 Z';

const PUMPKIN_STEM =
  'M 45 5 C 45 3 50 2 53 5 C 57 9 57 15 56 21 L 45 21 C 44 15 44 10 45 5 Z';

const GHOST_FACE =
  'M 38 32 C 42 32 45 37 45 43 C 45 49 42 54 38 54 C 34 54 31 49 31 43 C 31 37 34 32 38 32 Z ' +
  'M 62 32 C 66 32 69 37 69 43 C 69 49 66 54 62 54 C 58 54 55 49 55 43 C 55 37 58 32 62 32 Z ' +
  'M 50 60 C 55 60 58 64 58 69 C 58 74 55 78 50 78 C 45 78 42 74 42 69 C 42 64 45 60 50 60 Z';

const CAT_EYES =
  'M 42 40 C 45 40 47 43 47 47 C 47 51 45 54 42 54 C 39 54 37 51 37 47 C 37 43 39 40 42 40 Z ' +
  'M 62 40 C 65 40 67 43 67 47 C 67 51 65 54 62 54 C 59 54 57 51 57 47 C 57 43 59 40 62 40 Z';

const SKULL_TEETH =
  'M 34 84 L 38 84 L 38 92 L 34 92 Z M 44 84 L 48 84 L 48 92 L 44 92 Z ' +
  'M 54 84 L 58 84 L 58 92 L 54 92 Z M 64 84 L 68 84 L 68 92 L 64 92 Z';

export const HALLOWEEN_SHAPES: LibraryShape[] = [
  {
    id: 'halloween-pumpkin',
    name: 'Pumpkin',
    category: 'halloween',
    keywords: ['gourd', 'squash', 'autumn', 'fall', 'harvest'],
    parts: [
      { name: 'Body', d: PUMPKIN_BODY, color: PUMPKIN_ORANGE },
      {
        name: 'Ridges',
        d:
          'M 32 25 C 25 39 25 75 32 89 L 38 87 C 32 73 32 41 38 27 Z ' +
          'M 68 25 C 75 39 75 75 68 89 L 62 87 C 68 73 68 41 62 27 Z',
        color: PUMPKIN_DARK,
      },
      { name: 'Stem', d: PUMPKIN_STEM, color: STEM_GREEN },
    ],
  },
  {
    id: 'halloween-jack-o-lantern',
    name: "Jack-o'-lantern",
    category: 'halloween',
    keywords: ['pumpkin', 'carved', 'face', 'lantern', 'spooky'],
    parts: [
      {
        name: 'Lantern',
        d:
          `${PUMPKIN_BODY} ` +
          'M 30 44 L 44 44 L 37 60 Z ' +
          'M 70 44 L 56 44 L 63 60 Z ' +
          'M 50 58 L 56 70 L 44 70 Z ' +
          'M 30 76 L 38 76 L 42 82 L 46 76 L 54 76 L 58 82 L 62 76 L 70 76 L 66 88 L 34 88 Z',
        color: PUMPKIN_ORANGE,
      },
      { name: 'Stem', d: PUMPKIN_STEM, color: STEM_GREEN },
    ],
  },
  {
    id: 'halloween-ghost',
    name: 'Ghost',
    category: 'halloween',
    keywords: ['spook', 'boo', 'spirit', 'haunt'],
    parts: [
      {
        name: 'Body',
        d:
          'M 50 6 C 71 6 86 22 86 44 L 86 92 L 74 82 L 62 94 L 50 82 L 38 94 L 26 82 L 14 92 L 14 44 C 14 22 29 6 50 6 Z ' +
          GHOST_FACE,
        color: GHOST_WHITE,
      },
      { name: 'Face', d: GHOST_FACE, color: NIGHT_BLACK },
    ],
  },
  {
    id: 'halloween-bat',
    name: 'Bat',
    category: 'halloween',
    keywords: ['vampire', 'wings', 'night', 'spooky'],
    parts: [
      {
        name: 'Bat',
        d: 'M 2 34 C 10 30 20 32 28 38 C 32 32 36 28 42 27 L 38 12 L 48 24 L 52 24 L 62 12 L 58 27 C 64 28 68 32 72 38 C 80 32 90 30 98 34 C 92 42 90 52 92 62 C 84 58 76 58 70 62 C 64 66 58 72 50 78 C 42 72 36 66 30 62 C 24 58 16 58 8 62 C 10 52 8 42 2 34 Z',
        color: NIGHT_BLACK,
      },
    ],
  },
  {
    id: 'halloween-spider',
    name: 'Spider',
    category: 'halloween',
    keywords: ['bug', 'arachnid', 'creepy', 'legs'],
    parts: [
      {
        name: 'Legs',
        d:
          'M 28 52 L 6 26 L 11 22 L 32 48 Z ' +
          'M 27 61 L 2 48 L 4 43 L 29 56 Z ' +
          'M 27 71 L 2 80 L 4 85 L 29 76 Z ' +
          'M 29 79 L 12 97 L 16 99 L 33 83 Z ' +
          'M 72 52 L 94 26 L 89 22 L 68 48 Z ' +
          'M 73 61 L 98 48 L 96 43 L 71 56 Z ' +
          'M 73 71 L 98 80 L 96 85 L 71 76 Z ' +
          'M 71 79 L 88 97 L 84 99 L 67 83 Z',
        color: NIGHT_BLACK,
      },
      {
        name: 'Body',
        d:
          'M 50 40 C 62 40 72 51 72 65 C 72 79 62 89 50 89 C 38 89 28 79 28 65 C 28 51 38 40 50 40 Z ' +
          'M 50 22 C 57 22 63 29 63 37 C 63 45 57 50 50 50 C 43 50 37 45 37 37 C 37 29 43 22 50 22 Z',
        color: NIGHT_BLACK,
      },
    ],
  },
  {
    id: 'halloween-web',
    name: 'Spider web',
    category: 'halloween',
    keywords: ['cobweb', 'corner', 'spooky', 'net'],
    parts: [
      {
        name: 'Web',
        d:
          // Three strands radiating from the top-left corner...
          'M 2 2 L 8 2 L 8 98 L 2 98 Z ' +
          'M 2 2 L 2 8 L 98 8 L 98 2 Z ' +
          'M 2 2 L 7 2 L 76 71 L 72 76 Z ' +
          // ...crossed by three arcs at increasing radius from the same corner.
          'M 2 34 C 20 34 34 20 34 2 L 40 2 C 40 23 23 40 2 40 Z ' +
          'M 2 62 C 35 62 62 35 62 2 L 68 2 C 68 39 39 68 2 68 Z ' +
          'M 2 90 C 50 90 90 50 90 2 L 96 2 C 96 54 54 96 2 96 Z',
        color: NIGHT_BLACK,
      },
    ],
  },
  {
    id: 'halloween-witch-hat',
    name: 'Witch hat',
    category: 'halloween',
    keywords: ['wizard', 'magic', 'pointed', 'costume'],
    parts: [
      {
        name: 'Hat',
        d: 'M 56 8 C 60 22 66 50 74 68 C 62 74 38 74 26 68 C 36 52 48 26 56 8 Z',
        color: NIGHT_BLACK,
      },
      {
        name: 'Brim',
        d: 'M 50 66 C 76 66 96 74 96 84 C 96 94 76 100 50 100 C 24 100 4 94 4 84 C 4 74 24 66 50 66 Z',
        color: NIGHT_BLACK,
      },
      {
        name: 'Band',
        d: 'M 30 62 C 42 68 58 68 70 62 L 72 72 C 58 78 42 78 28 72 Z',
        color: '#7b3fb5',
      },
    ],
  },
  {
    id: 'halloween-cauldron',
    name: 'Cauldron',
    category: 'halloween',
    keywords: ['pot', 'witch', 'brew', 'potion'],
    parts: [
      {
        name: 'Pot',
        d: 'M 12 44 C 10 50 8 54 8 60 C 8 80 26 96 50 96 C 74 96 92 80 92 60 C 92 54 90 50 88 44 Z',
        color: NIGHT_BLACK,
      },
      { name: 'Rim', d: 'M 4 30 L 96 30 L 96 44 L 4 44 Z', color: NIGHT_BLACK },
      {
        name: 'Brew',
        d: 'M 18 30 C 28 22 34 30 44 24 C 54 18 60 26 70 20 C 76 17 80 20 84 24 L 84 30 Z',
        color: '#5ec36a',
      },
    ],
  },
  {
    id: 'halloween-candy-corn',
    name: 'Candy corn',
    category: 'halloween',
    keywords: ['sweet', 'treat', 'candy', 'trick or treat'],
    parts: [
      {
        name: 'Base',
        d: 'M 26 66 L 74 66 C 74 84 63 98 50 98 C 37 98 26 84 26 66 Z',
        color: '#f2b134',
      },
      { name: 'Middle', d: 'M 16 34 L 84 34 L 80 66 L 20 66 Z', color: '#f27d1a' },
      { name: 'Tip', d: 'M 50 2 C 60 2 70 16 84 34 L 16 34 C 30 16 40 2 50 2 Z', color: '#f7f2e6' },
    ],
  },
  {
    id: 'halloween-tombstone',
    name: 'Tombstone',
    category: 'halloween',
    keywords: ['grave', 'rip', 'graveyard', 'headstone'],
    parts: [
      {
        name: 'Stone',
        d:
          'M 14 96 L 14 42 C 14 20 30 6 50 6 C 70 6 86 20 86 42 L 86 96 Z ' +
          'M 34 34 L 40 34 L 40 44 L 46 44 L 46 34 L 52 34 L 52 60 L 46 60 L 46 50 L 40 50 L 40 60 L 34 60 Z ' +
          'M 56 34 L 68 34 L 68 40 L 62 40 L 62 44 L 68 44 L 68 60 L 56 60 L 56 54 L 62 54 L 62 50 L 56 50 Z',
        color: '#8e9299',
      },
    ],
  },
  {
    id: 'halloween-cat',
    name: 'Black cat',
    category: 'halloween',
    keywords: ['kitty', 'feline', 'sitting', 'spooky'],
    parts: [
      {
        name: 'Cat',
        d:
          'M 30 34 L 26 12 L 44 24 C 48 23 52 23 56 24 L 74 12 L 70 34 C 76 40 78 48 76 56 C 82 66 86 80 86 96 L 26 96 C 24 84 26 70 32 58 C 28 50 27 42 30 34 Z ' +
          CAT_EYES,
        color: NIGHT_BLACK,
      },
      {
        name: 'Tail',
        d: 'M 84 96 C 84 82 88 72 96 66 L 100 74 C 94 79 92 87 92 96 Z',
        color: NIGHT_BLACK,
      },
      { name: 'Eyes', d: CAT_EYES, color: CAT_EYE },
    ],
  },
  {
    id: 'halloween-skull',
    name: 'Skull',
    category: 'halloween',
    keywords: ['bone', 'skeleton', 'dead', 'spooky'],
    parts: [
      {
        name: 'Skull',
        d:
          'M 50 4 C 76 4 92 24 92 48 C 92 62 86 72 78 78 L 78 92 L 22 92 L 22 78 C 14 72 8 62 8 48 C 8 24 24 4 50 4 Z ' +
          'M 32 40 C 39 40 44 46 44 54 C 44 62 39 66 32 66 C 25 66 20 62 20 54 C 20 46 25 40 32 40 Z ' +
          'M 68 40 C 75 40 80 46 80 54 C 80 62 75 66 68 66 C 61 66 56 62 56 54 C 56 46 61 40 68 40 Z ' +
          'M 50 66 L 57 80 L 43 80 Z ' +
          SKULL_TEETH,
        color: '#f2f0e8',
      },
    ],
  },
];
