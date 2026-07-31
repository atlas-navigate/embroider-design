import type { LibraryShape } from '../types.js';
import { circle, ellipse } from './draw.js';
import {
  CREAM,
  CREAM_DARK,
  GREEN,
  GREEN_DARK,
  INK,
  LAVENDER,
  ORANGE,
  ORANGE_DARK,
  PINK,
  PINK_DARK,
  PURPLE,
  SILVER_LIGHT,
  SKY,
  WHITE,
  WOOD,
  WOOD_DARK,
  YELLOW,
  YELLOW_DARK,
  YELLOW_LIGHT,
} from './palette.js';

/**
 * Easter and spring.
 *
 * The egg is one shared outline — narrower at the top than the bottom, which is
 * the difference between an egg and an oval, and the thing people notice
 * without being able to say why.
 */

const EGG_BODY =
  'M 50 4 C 68 4 82 30 82 56 C 82 80 68 96 50 96 C 32 96 18 80 18 56 C 18 30 32 4 50 4 Z';

const BUNNY_EARS =
  'M 36 2 C 41 2 45 13 45 28 C 45 38 41 44 36 44 C 31 44 27 38 27 28 C 27 13 31 2 36 2 Z ' +
  'M 64 2 C 69 2 73 13 73 28 C 73 38 69 44 64 44 C 59 44 55 38 55 28 C 55 13 59 2 64 2 Z';

const BUNNY_FACE = `${circle(38, 60, 4.5)} ${circle(62, 60, 4.5)}`;

const CHICK_FACE = `${circle(40, 42, 4)} ${circle(60, 42, 4)}`;

export const EASTER_SHAPES: LibraryShape[] = [
  {
    id: 'easter-egg',
    name: 'Easter egg',
    category: 'easter',
    keywords: ['spring', 'egg', 'hunt', 'plain'],
    parts: [
      { name: 'Egg', d: EGG_BODY, color: CREAM },
      {
        name: 'Shading',
        d: 'M 62 8 C 74 18 82 38 82 56 C 82 80 68 96 50 96 C 64 90 72 74 72 54 C 72 36 68 20 62 8 Z',
        color: CREAM_DARK,
      },
      { name: 'Shine', d: 'M 30 30 C 33 22 38 16 44 14 L 46 22 C 41 24 37 30 35 36 Z', color: WHITE },
    ],
  },
  {
    id: 'easter-egg-decorated',
    name: 'Decorated egg',
    category: 'easter',
    keywords: ['spring', 'painted', 'stripes', 'hunt', 'dyed'],
    parts: [
      { name: 'Egg', d: EGG_BODY, color: SKY },
      {
        name: 'Bands',
        // Curved to follow the shell. Straight bands make the egg look flat,
        // which is the single most common way a painted egg goes wrong.
        d:
          'M 20 40 C 34 32 66 32 80 40 L 80 50 C 66 42 34 42 20 50 Z ' +
          'M 19 66 C 34 58 66 58 81 66 L 81 76 C 66 68 34 68 19 76 Z',
        color: PINK,
      },
      {
        name: 'Zigzag',
        d: 'M 22 54 L 30 60 L 38 54 L 46 60 L 54 54 L 62 60 L 70 54 L 78 60 L 78 64 L 70 58 L 62 64 L 54 58 L 46 64 L 38 58 L 30 64 L 22 58 Z',
        color: PURPLE,
      },
      {
        name: 'Dots',
        d: `${circle(34, 26, 5)} ${circle(62, 24, 5)} ${circle(50, 88, 5)} ${circle(30, 84, 4)} ${circle(70, 84, 4)}`,
        color: YELLOW,
      },
    ],
  },
  {
    id: 'easter-bunny',
    name: 'Bunny',
    category: 'easter',
    keywords: ['rabbit', 'spring', 'ears', 'hare', 'easter'],
    parts: [
      { name: 'Ears', d: BUNNY_EARS, color: SILVER_LIGHT },
      {
        name: 'Head',
        d: `M 50 34 C 72 34 86 50 86 70 C 86 88 70 98 50 98 C 30 98 14 88 14 70 C 14 50 28 34 50 34 Z ${BUNNY_FACE}`,
        color: SILVER_LIGHT,
      },
      { name: 'Cheeks', d: `${ellipse(34, 78, 15, 12)} ${ellipse(66, 78, 15, 12)}`, color: WHITE },
      // Ear linings and nose share a pink, so they sew in one pass.
      {
        name: 'Ears and nose',
        d:
          'M 36 10 C 39 10 41 17 41 28 C 41 34 39 38 36 38 C 33 38 31 34 31 28 C 31 17 33 10 36 10 Z ' +
          'M 64 10 C 67 10 69 17 69 28 C 69 34 67 38 64 38 C 61 38 59 34 59 28 C 59 17 61 10 64 10 Z ' +
          'M 50 68 L 58 74 L 50 80 L 42 74 Z',
        color: PINK,
      },
      { name: 'Face', d: BUNNY_FACE, color: INK },
      {
        name: 'Whiskers',
        d:
          'M 2 74 L 24 76 L 24 79 L 2 77 Z M 2 86 L 24 82 L 24 85 L 2 89 Z ' +
          'M 98 74 L 76 76 L 76 79 L 98 77 Z M 98 86 L 76 82 L 76 85 L 98 89 Z',
        color: PINK_DARK,
      },
    ],
  },
  {
    id: 'easter-chick',
    name: 'Chick',
    category: 'easter',
    keywords: ['baby', 'bird', 'spring', 'hatch', 'yellow'],
    parts: [
      { name: 'Body', d: ellipse(50, 62, 36, 34), color: YELLOW },
      { name: 'Head', d: `${circle(50, 36, 28)} ${CHICK_FACE}`, color: YELLOW },
      {
        name: 'Shading',
        d: 'M 68 46 C 82 54 88 72 78 86 C 72 92 62 96 50 96 C 68 90 78 74 74 58 C 72 52 70 48 68 46 Z',
        color: YELLOW_DARK,
      },
      {
        name: 'Wing',
        d: 'M 24 58 C 34 54 44 58 48 68 C 42 78 28 80 20 74 C 16 68 18 61 24 58 Z',
        color: YELLOW_LIGHT,
      },
      { name: 'Tuft', d: 'M 46 12 C 46 6 48 2 50 2 C 52 2 54 6 54 12 L 54 18 L 46 18 Z', color: YELLOW_LIGHT },
      { name: 'Face', d: CHICK_FACE, color: INK },
      { name: 'Beak', d: 'M 50 46 L 62 52 L 50 58 L 44 52 Z', color: ORANGE },
      { name: 'Feet', d: 'M 34 92 L 42 92 L 42 98 L 30 98 Z M 66 92 L 58 92 L 58 98 L 70 98 Z', color: ORANGE_DARK },
    ],
  },
  {
    id: 'easter-basket',
    name: 'Easter basket',
    category: 'easter',
    keywords: ['hunt', 'eggs', 'handle', 'wicker', 'spring'],
    parts: [
      {
        name: 'Handle',
        d: 'M 50 6 C 74 6 90 24 90 48 L 80 48 C 80 30 68 16 50 16 C 32 16 20 30 20 48 L 10 48 C 10 24 26 6 50 6 Z',
        color: WOOD,
      },
      {
        name: 'Basket',
        d: 'M 8 56 L 92 56 L 84 94 C 83 97 80 98 76 98 L 24 98 C 20 98 17 97 16 94 Z',
        color: WOOD,
      },
      { name: 'Eggs', d: `${ellipse(30, 48, 13, 16)} ${ellipse(70, 48, 13, 16)} ${ellipse(50, 42, 14, 17)}`, color: PINK },
      { name: 'Egg bands', d: 'M 18 46 L 42 46 L 42 52 L 18 52 Z M 58 46 L 82 46 L 82 52 L 58 52 Z M 36 40 L 64 40 L 64 46 L 36 46 Z', color: LAVENDER },
      {
        name: 'Weave',
        // Vertical stakes crossed by two bands: enough to read as wicker
        // without turning into a plaid.
        d:
          'M 8 66 L 92 66 L 91 74 L 9 74 Z M 12 82 L 88 82 L 87 90 L 13 90 Z ' +
          'M 26 56 L 34 56 L 31 98 L 23 98 Z M 46 56 L 54 56 L 54 98 L 46 98 Z ' +
          'M 66 56 L 74 56 L 77 98 L 69 98 Z',
        color: WOOD_DARK,
      },
      { name: 'Rim', d: 'M 4 50 L 96 50 L 96 60 L 4 60 Z', color: WOOD_DARK },
      { name: 'Grass', d: 'M 12 56 C 20 46 28 48 32 58 M 40 56 C 48 44 56 46 60 58 M 68 56 C 76 46 84 48 88 58 M 12 56 C 20 46 28 48 32 58 L 12 58 Z M 40 56 C 48 44 56 46 60 58 L 40 58 Z M 68 56 C 76 46 84 48 88 58 L 68 58 Z', color: GREEN },
    ],
  },
  {
    id: 'easter-tulip',
    name: 'Tulip',
    category: 'easter',
    keywords: ['flower', 'spring', 'bloom', 'bulb', 'garden'],
    parts: [
      { name: 'Stem', d: 'M 46 44 L 54 44 L 54 98 L 46 98 Z', color: GREEN_DARK },
      {
        name: 'Leaves',
        d:
          'M 46 62 C 30 58 18 68 12 88 C 30 88 42 78 48 66 Z ' +
          'M 54 74 C 68 70 80 78 86 94 C 70 94 58 88 52 78 Z',
        color: GREEN,
      },
      {
        name: 'Petals',
        // Three petals with the middle one in front: a tulip's cup, not a bell.
        d:
          'M 22 12 C 22 6 26 2 30 6 C 34 10 36 20 36 32 C 36 42 32 48 26 48 ' +
          'C 20 48 18 40 18 30 C 18 22 20 16 22 12 Z ' +
          'M 78 12 C 78 6 74 2 70 6 C 66 10 64 20 64 32 C 64 42 68 48 74 48 ' +
          'C 80 48 82 40 82 30 C 82 22 80 16 78 12 Z',
        color: PINK_DARK,
      },
      {
        name: 'Cup',
        d:
          'M 50 2 C 58 2 66 12 66 28 C 66 42 60 52 50 52 C 40 52 34 42 34 28 C 34 12 42 2 50 2 Z ' +
          // The centre fold, cut out so the darker petals behind show through
          // it. One less thread change than laying a fold on top.
          'M 50 8 C 52 14 53 21 53 30 C 53 40 52 47 50 51 C 48 47 47 40 47 30 C 47 21 48 14 50 8 Z',
        color: PINK,
      },
    ],
  },
  {
    id: 'easter-daffodil',
    name: 'Daffodil',
    category: 'easter',
    keywords: ['flower', 'spring', 'narcissus', 'trumpet', 'yellow'],
    parts: [
      { name: 'Stem', d: 'M 46 62 L 54 62 L 54 98 L 46 98 Z', color: GREEN_DARK },
      { name: 'Leaves', d: 'M 46 74 C 32 70 22 78 16 94 C 32 94 42 86 48 76 Z M 54 82 C 66 78 76 84 82 96 C 68 96 58 92 52 84 Z', color: GREEN },
      {
        name: 'Petals',
        // Six of them, and the count matters: five reads as a generic flower.
        d:
          'M 50 2 C 58 2 62 10 62 20 C 62 28 57 34 50 34 C 43 34 38 28 38 20 C 38 10 42 2 50 2 Z ' +
          'M 92 22 C 96 29 93 37 84 42 C 77 46 69 44 66 38 C 62 32 65 24 74 20 C 82 16 88 16 92 22 Z ' +
          'M 92 66 C 88 72 82 72 74 68 C 65 64 62 56 66 50 C 69 44 77 42 84 46 C 93 51 96 59 92 66 Z ' +
          'M 50 86 C 43 86 38 78 38 68 C 38 60 43 54 50 54 C 57 54 62 60 62 68 C 62 78 58 86 50 86 Z ' +
          'M 8 66 C 4 59 7 51 16 46 C 23 42 31 44 34 50 C 38 56 35 64 26 68 C 18 72 12 72 8 66 Z ' +
          'M 8 22 C 12 16 18 16 26 20 C 35 24 38 32 34 38 C 31 44 23 46 16 42 C 7 37 4 29 8 22 Z',
        color: YELLOW,
      },
      { name: 'Trumpet', d: circle(50, 44, 18), color: ORANGE },
      { name: 'Trumpet rim', d: 'M 50 26 C 60 26 68 34 68 44 C 68 48 67 51 65 54 C 63 46 57 40 50 40 C 43 40 37 46 35 54 C 33 51 32 48 32 44 C 32 34 40 26 50 26 Z', color: ORANGE_DARK },
    ],
  },
  {
    id: 'easter-carrot',
    name: 'Carrot',
    category: 'easter',
    keywords: ['vegetable', 'bunny', 'orange', 'garden', 'root'],
    parts: [
      {
        name: 'Root',
        d: 'M 34 30 L 66 30 C 66 30 62 70 54 96 C 52 100 48 100 46 96 C 38 70 34 30 34 30 Z',
        color: ORANGE,
      },
      {
        name: 'Grooves',
        // The rings around a carrot, which is what stops it reading as a cone.
        d:
          'M 36 42 L 64 42 L 63 47 L 37 47 Z M 39 56 L 61 56 L 60 61 L 40 61 Z ' +
          'M 43 70 L 57 70 L 56 75 L 44 75 Z',
        color: ORANGE_DARK,
      },
      { name: 'Shine', d: 'M 40 34 L 46 34 C 47 50 49 66 52 80 L 47 80 C 44 66 41 50 40 34 Z', color: YELLOW_LIGHT },
      {
        name: 'Leaves',
        // Springing from the crown of the root, not floating above it: a gap
        // between top and root turns the carrot into two objects.
        d:
          'M 50 0 C 56 6 58 18 56 32 L 44 32 C 42 18 44 6 50 0 Z ' +
          'M 30 6 C 38 10 44 20 46 32 L 36 34 C 32 24 28 16 30 6 Z ' +
          'M 70 6 C 62 10 56 20 54 32 L 64 34 C 68 24 72 16 70 6 Z',
        color: GREEN,
      },
      {
        name: 'Leaf veins',
        d: 'M 48 6 L 52 6 L 52 32 L 48 32 Z M 32 12 L 36 10 L 44 32 L 40 34 Z M 68 12 L 64 10 L 56 32 L 60 34 Z',
        color: GREEN_DARK,
      },
    ],
  },
];
