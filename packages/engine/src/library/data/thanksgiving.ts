import type { LibraryShape } from '../types.js';
import { circle, ellipse, leaf } from './draw.js';
import {
  BROWN,
  BROWN_DARK,
  COPPER,
  CREAM,
  CREAM_DARK,
  FUR,
  FUR_DARK,
  GOLD,
  GREEN_DARK,
  INK,
  OLIVE,
  ORANGE,
  ORANGE_DARK,
  ORANGE_LIGHT,
  RED,
  RED_DARK,
  WHITE,
  WOOD,
  WOOD_DARK,
  YELLOW,
  YELLOW_DARK,
} from './palette.js';

/**
 * Autumn and Thanksgiving.
 *
 * Leaves live or die on their lobes and their stalk. A maple leaf is five
 * lobes with deep notches between them and a stalk longer than you expect; an
 * oak is round-lobed with shallow bays. Blur either into a rosette and you get
 * the same anonymous autumn shape twice.
 */

export const THANKSGIVING_SHAPES: LibraryShape[] = [
  {
    id: 'autumn-maple-leaf',
    name: 'Maple leaf',
    category: 'thanksgiving',
    keywords: ['autumn', 'fall', 'red', 'canada', 'tree'],
    parts: [
      {
        name: 'Leaf',
        d:
          'M 50 2 L 58 20 L 70 14 L 66 32 L 84 26 L 74 40 L 98 40 L 82 52 ' +
          'L 96 62 L 74 66 L 82 82 L 60 74 L 56 88 L 50 78 L 44 88 L 40 74 ' +
          'L 18 82 L 26 66 L 4 62 L 18 52 L 2 40 L 26 40 L 16 26 L 34 32 ' +
          'L 30 14 L 42 20 Z',
        color: RED,
      },
      {
        name: 'Veins',
        d:
          'M 47 24 L 53 24 L 53 78 L 47 78 Z ' +
          'M 50 44 L 76 42 L 76 46 L 50 50 Z M 50 44 L 24 42 L 24 46 L 50 50 Z ' +
          'M 50 60 L 70 64 L 69 68 L 50 65 Z M 50 60 L 30 64 L 31 68 L 50 65 Z',
        color: RED_DARK,
      },
      { name: 'Stalk', d: 'M 47 76 L 53 76 L 53 98 L 47 98 Z', color: WOOD_DARK },
    ],
  },
  {
    id: 'autumn-oak-leaf',
    name: 'Oak leaf',
    category: 'thanksgiving',
    keywords: ['autumn', 'fall', 'acorn', 'tree', 'lobed'],
    parts: [
      {
        name: 'Leaf',
        // Round lobes and shallow bays, deliberately unlike the maple's spikes.
        d:
          'M 50 2 C 58 2 62 8 60 16 C 70 12 78 16 78 24 C 88 24 94 32 90 40 ' +
          'C 98 44 98 54 90 58 C 96 66 90 76 82 74 C 82 84 72 88 66 82 ' +
          'C 64 90 54 92 52 84 L 52 96 L 48 96 L 48 84 C 46 92 36 90 34 82 ' +
          'C 28 88 18 84 18 74 C 10 76 4 66 10 58 C 2 54 2 44 10 40 ' +
          'C 6 32 12 24 22 24 C 22 16 30 12 40 16 C 38 8 42 2 50 2 Z',
        color: COPPER,
      },
      {
        name: 'Veins',
        d:
          'M 48 12 L 52 12 L 52 84 L 48 84 Z ' +
          'M 50 28 L 72 22 L 73 26 L 50 33 Z M 50 28 L 28 22 L 27 26 L 50 33 Z ' +
          'M 50 46 L 78 42 L 79 46 L 50 51 Z M 50 46 L 22 42 L 21 46 L 50 51 Z ' +
          'M 50 64 L 72 62 L 72 66 L 50 69 Z M 50 64 L 28 62 L 28 66 L 50 69 Z',
        color: BROWN_DARK,
      },
      { name: 'Stalk', d: 'M 47 82 L 53 82 L 53 98 L 47 98 Z', color: WOOD_DARK },
    ],
  },
  {
    id: 'autumn-acorn',
    name: 'Acorn',
    category: 'thanksgiving',
    keywords: ['nut', 'oak', 'autumn', 'squirrel', 'seed'],
    parts: [
      {
        name: 'Nut',
        d: 'M 18 34 L 82 34 C 82 62 70 92 50 96 C 30 92 18 62 18 34 Z',
        color: WOOD,
      },
      // The nut's shaded side and the stalk are the same dark wood; keeping
      // them together saves a thread change.
      { name: 'Shading', d: 'M 58 34 L 82 34 C 82 62 70 92 50 96 C 62 86 68 62 68 34 Z', color: WOOD_DARK },
      { name: 'Stalk', d: 'M 45 0 L 55 0 L 55 10 L 45 10 Z', color: WOOD_DARK },
      { name: 'Shine', d: 'M 26 42 C 28 54 30 66 34 76 L 28 78 C 24 66 22 54 22 42 Z', color: CREAM_DARK },
      {
        name: 'Cap',
        d: 'M 50 6 C 74 6 92 16 92 26 C 92 34 74 40 50 40 C 26 40 8 34 8 26 C 8 16 26 6 50 6 Z',
        color: BROWN_DARK,
      },
      {
        name: 'Cap texture',
        d:
          'M 20 20 L 80 20 L 80 24 L 20 24 Z M 14 28 L 86 28 L 86 32 L 14 32 Z ' +
          'M 30 12 L 70 12 L 70 16 L 30 16 Z',
        color: BROWN,
      },
    ],
  },
  {
    id: 'autumn-turkey',
    name: 'Turkey',
    category: 'thanksgiving',
    keywords: ['bird', 'thanksgiving', 'feathers', 'fan', 'gobble'],
    parts: [
      {
        name: 'Tail feathers',
        // A fan of alternating tones behind the bird — the fan is the turkey.
        d:
          'M 50 58 L 6 30 L 2 44 L 46 62 Z M 50 58 L 12 12 L 24 6 L 48 56 Z ' +
          'M 50 58 L 50 2 L 62 6 L 52 56 Z M 50 58 L 88 12 L 96 22 L 54 58 Z ' +
          'M 50 58 L 98 40 L 98 54 L 54 64 Z',
        color: ORANGE_DARK,
      },
      {
        name: 'Inner feathers',
        d:
          'M 50 58 L 20 34 L 14 44 L 46 62 Z M 50 58 L 28 18 L 38 12 L 48 56 Z ' +
          'M 50 58 L 62 12 L 72 20 L 54 58 Z M 50 58 L 86 36 L 88 48 L 54 64 Z',
        color: ORANGE_LIGHT,
      },
      {
        name: 'Body',
        d: 'M 50 46 C 66 46 78 60 78 76 C 78 90 66 98 50 98 C 34 98 22 90 22 76 C 22 60 34 46 50 46 Z',
        color: FUR_DARK,
      },
      { name: 'Wing', d: 'M 30 62 C 38 60 44 66 44 76 C 44 86 38 92 30 90 C 24 88 22 80 22 74 C 22 68 25 63 30 62 Z', color: BROWN_DARK },
      { name: 'Head', d: `${ellipse(50, 44, 14, 15)} ${circle(44, 40, 3)} ${circle(56, 40, 3)}`, color: FUR },
      { name: 'Eyes', d: `${circle(44, 40, 3)} ${circle(56, 40, 3)}`, color: INK },
      { name: 'Beak', d: 'M 50 46 L 58 50 L 50 54 L 45 50 Z', color: YELLOW },
      { name: 'Wattle', d: 'M 47 50 C 51 50 53 54 53 60 C 53 66 50 70 47 70 C 44 70 42 66 42 60 C 42 54 44 50 47 50 Z', color: RED },
      { name: 'Feet', d: 'M 40 94 L 46 94 L 44 100 L 34 100 Z M 60 94 L 54 94 L 56 100 L 66 100 Z', color: YELLOW_DARK },
    ],
  },
  {
    id: 'autumn-pumpkin-pie',
    name: 'Pumpkin pie',
    category: 'thanksgiving',
    keywords: ['dessert', 'slice', 'thanksgiving', 'baking', 'cream'],
    parts: [
      {
        name: 'Crust',
        // A wedge seen from the side: crust wall along the back edge, filling
        // sloping to the point. A flat triangle is a slice of nothing.
        d: 'M 50 12 L 96 78 C 98 82 96 86 90 86 L 10 86 C 4 86 2 82 4 78 Z',
        color: WOOD,
      },
      {
        name: 'Filling',
        d: 'M 50 24 L 88 78 L 12 78 Z',
        color: ORANGE_DARK,
      },
      { name: 'Filling shine', d: 'M 50 32 L 66 56 L 34 56 Z', color: ORANGE },
      {
        name: 'Crust edge',
        d:
          'M 4 78 L 96 78 C 98 82 96 86 90 86 L 10 86 C 4 86 2 82 4 78 Z ' +
          'M 18 80 L 26 80 L 26 86 L 18 86 Z M 38 80 L 46 80 L 46 86 L 38 86 Z ' +
          'M 58 80 L 66 80 L 66 86 L 58 86 Z M 78 80 L 86 80 L 86 86 L 78 86 Z',
        color: WOOD_DARK,
      },
      { name: 'Cream', d: `${circle(50, 40, 12)} ${circle(50, 28, 8)} ${circle(50, 18, 5)}`, color: WHITE },
      { name: 'Plate', d: 'M 2 86 L 98 86 L 94 96 C 93 98 91 98 88 98 L 12 98 C 9 98 7 98 6 96 Z', color: CREAM },
    ],
  },
  {
    id: 'autumn-cornucopia',
    name: 'Cornucopia',
    category: 'thanksgiving',
    keywords: ['horn of plenty', 'harvest', 'basket', 'abundance', 'thanksgiving'],
    parts: [
      {
        name: 'Horn',
        // Tapering and curled at the tip — a straight cone is a megaphone.
        d:
          'M 34 34 C 20 40 8 54 4 70 C 2 82 8 92 18 92 C 26 92 32 86 32 78 ' +
          'C 32 72 28 68 22 68 C 18 68 16 70 15 74 C 16 66 22 58 32 52 ' +
          'C 40 46 48 42 56 40 L 52 76 C 52 84 60 90 72 90 L 96 90 ' +
          'C 90 78 84 60 80 44 C 76 30 66 24 54 24 C 46 24 38 28 34 34 Z',
        color: WOOD,
      },
      {
        name: 'Weave',
        d:
          'M 30 54 L 40 46 L 44 52 L 34 60 Z M 22 66 L 30 58 L 34 64 L 26 72 Z ' +
          'M 14 76 L 22 70 L 26 76 L 18 82 Z',
        color: WOOD_DARK,
      },
      { name: 'Grapes', d: `${circle(74, 62, 8)} ${circle(86, 66, 8)} ${circle(80, 78, 8)} ${circle(66, 74, 8)}`, color: BROWN_DARK },
      { name: 'Apple', d: circle(62, 52, 13), color: RED },
      { name: 'Apple shine', d: circle(57, 47, 3.5), color: RED_DARK },
      { name: 'Corn', d: 'M 84 28 C 92 28 98 36 98 48 C 98 58 92 64 84 64 C 76 64 72 58 72 48 C 72 36 76 28 84 28 Z', color: YELLOW },
      { name: 'Corn kernels', d: 'M 76 36 L 92 36 L 92 40 L 76 40 Z M 74 46 L 94 46 L 94 50 L 74 50 Z M 76 56 L 92 56 L 92 60 L 76 60 Z', color: YELLOW_DARK },
      { name: 'Leaves', d: `${leaf(46, 12, 18, 26)} ${leaf(66, 8, 16, 24)}`, color: GREEN_DARK },
    ],
  },
  {
    id: 'autumn-wheat',
    name: 'Wheat',
    category: 'thanksgiving',
    keywords: ['harvest', 'grain', 'sheaf', 'field', 'autumn'],
    parts: [
      // Stalk and leaves are the same olive and sew together, under the ear.
      { name: 'Stalk', d: 'M 47 40 L 53 40 L 53 98 L 47 98 Z', color: OLIVE },
      { name: 'Leaves', d: 'M 46 64 C 34 62 24 70 20 84 C 34 84 44 76 48 68 Z M 54 76 C 66 74 76 82 80 94 C 66 94 56 88 52 80 Z', color: OLIVE },
      {
        name: 'Grains',
        // Paired, alternating up the stalk and tilted outward, the way an ear
        // of wheat actually sits.
        d:
          'M 50 2 C 55 8 55 18 50 24 C 45 18 45 8 50 2 Z ' +
          'M 38 14 C 46 16 51 24 50 32 C 42 30 37 22 38 14 Z ' +
          'M 62 14 C 54 16 49 24 50 32 C 58 30 63 22 62 14 Z ' +
          'M 36 28 C 44 30 49 38 48 46 C 40 44 35 36 36 28 Z ' +
          'M 64 28 C 56 30 51 38 52 46 C 60 44 65 36 64 28 Z ' +
          'M 34 42 C 42 44 47 52 46 60 C 38 58 33 50 34 42 Z ' +
          'M 66 42 C 58 44 53 52 54 60 C 62 58 67 50 66 42 Z',
        color: GOLD,
      },
      {
        name: 'Awns',
        d:
          'M 20 20 L 24 18 L 40 44 L 36 46 Z M 80 20 L 76 18 L 60 44 L 64 46 Z ' +
          'M 14 40 L 18 38 L 36 62 L 32 64 L 14 40 Z M 86 40 L 82 38 L 64 62 L 68 64 Z',
        color: YELLOW_DARK,
      },
    ],
  },
];
