import type { LibraryShape } from '../types.js';
import { circle, ellipse, ring } from './draw.js';
import {
  BLUE_LIGHT,
  CREAM,
  CREAM_DARK,
  FUR,
  FUR_DARK,
  FUR_LIGHT,
  GOLD,
  GOLD_DARK,
  GREEN_DARK,
  INK,
  INK_SOFT,
  ORANGE,
  ORANGE_DARK,
  ORANGE_LIGHT,
  PINK,
  RED,
  SILVER,
  SILVER_DARK,
  WHITE,
  WOOD,
  WOOD_DARK,
} from './palette.js';

/**
 * Pets.
 *
 * An animal's face is the whole icon, and it is carried almost entirely by two
 * things: the outline of the ears and the placement of the eyes. Every head
 * here is therefore built ears-first, and the eyes sit low and wide rather than
 * centred — a centred eye reads as a doll, and a high one as a person.
 *
 * Muzzles, noses and eyes are cut out of the head as counter-rings *and* filled
 * by their own part. See the note at the top of `halloween.ts`: stitching a
 * feature straight over a solid fill doubles the thread in that spot.
 */

const DOG_FACE =
  `${circle(36, 50, 6)} ${circle(64, 50, 6)} ` +
  'M 50 62 C 56 62 60 65 60 69 C 60 73 56 76 50 76 C 44 76 40 73 40 69 C 40 65 44 62 50 62 Z';

const CAT_FACE = `${ellipse(36, 52, 6, 8)} ${ellipse(64, 52, 6, 8)} M 50 66 L 57 72 L 50 78 L 43 72 Z`;

export const PET_SHAPES: LibraryShape[] = [
  {
    id: 'pets-paw-print',
    name: 'Paw print',
    category: 'pets',
    keywords: ['dog', 'cat', 'animal', 'track', 'foot', 'print'],
    parts: [
      {
        name: 'Toes',
        // Four toes, splayed and tilted outward. Four upright ovals in a row is
        // the giveaway of a paw nobody looked at twice.
        d:
          'M 16 24 C 23 24 28 31 28 40 C 28 49 23 56 16 56 C 9 56 4 49 4 40 C 4 31 9 24 16 24 Z ' +
          'M 37 8 C 44 8 49 15 49 24 C 49 33 44 40 37 40 C 30 40 25 33 25 24 C 25 15 30 8 37 8 Z ' +
          'M 63 8 C 70 8 75 15 75 24 C 75 33 70 40 63 40 C 56 40 51 33 51 24 C 51 15 56 8 63 8 Z ' +
          'M 84 24 C 91 24 96 31 96 40 C 96 49 91 56 84 56 C 77 56 72 49 72 40 C 72 31 77 24 84 24 Z',
        color: INK,
      },
      {
        name: 'Pad',
        // A heart-shaped heel pad with three lobes at the bottom, which is what
        // a real paw leaves and what an oval does not.
        d:
          'M 50 46 C 64 46 78 56 80 70 C 82 84 72 96 60 96 C 56 96 53 94 50 94 ' +
          'C 47 94 44 96 40 96 C 28 96 18 84 20 70 C 22 56 36 46 50 46 Z',
        color: INK,
      },
    ],
  },
  {
    id: 'pets-bone',
    name: 'Bone',
    category: 'pets',
    keywords: ['dog', 'treat', 'chew', 'puppy', 'biscuit'],
    parts: [
      {
        name: 'Bone',
        d:
          'M 18 28 C 27 28 33 35 32 43 L 68 43 C 67 35 73 28 82 28 ' +
          'C 92 28 100 36 100 47 C 100 58 92 66 82 66 C 73 66 67 59 68 51 ' +
          'L 32 51 C 33 59 27 66 18 66 C 8 66 0 58 0 47 C 0 36 8 28 18 28 Z',
        color: CREAM,
      },
      {
        name: 'Shading',
        d: 'M 82 28 C 92 28 100 36 100 47 C 100 58 92 66 82 66 C 88 60 90 54 90 47 C 90 40 88 34 82 28 Z',
        color: CREAM_DARK,
      },
      { name: 'Shine', d: 'M 12 36 C 16 32 22 32 26 35 L 22 42 C 19 40 16 41 14 44 Z', color: WHITE },
    ],
  },
  {
    id: 'pets-dog',
    name: 'Dog',
    category: 'pets',
    keywords: ['puppy', 'hound', 'canine', 'pet', 'beagle'],
    parts: [
      {
        name: 'Ears',
        // Long and hanging, framing the head. Ears that sit on top of the skull
        // read as a cat however the muzzle is drawn.
        d:
          'M 20 22 C 30 20 36 28 36 42 C 36 58 32 72 22 76 C 10 80 2 68 2 50 C 2 34 8 24 20 22 Z ' +
          'M 80 22 C 70 20 64 28 64 42 C 64 58 68 72 78 76 C 90 80 98 68 98 50 C 98 34 92 24 80 22 Z',
        color: FUR_DARK,
      },
      {
        name: 'Head',
        d: `M 50 10 C 70 10 82 26 82 48 C 82 74 68 92 50 92 C 32 92 18 74 18 48 C 18 26 30 10 50 10 Z ${DOG_FACE}`,
        color: FUR,
      },
      {
        name: 'Muzzle',
        d: 'M 50 56 C 62 56 70 64 70 74 C 70 84 62 92 50 92 C 38 92 30 84 30 74 C 30 64 38 56 50 56 Z',
        color: FUR_LIGHT,
      },
      { name: 'Face', d: DOG_FACE, color: INK },
      { name: 'Eye shine', d: `${circle(34, 47, 2.2)} ${circle(62, 47, 2.2)}`, color: WHITE },
      { name: 'Mouth', d: 'M 48 76 L 52 76 L 52 84 L 48 84 Z M 38 82 C 44 88 56 88 62 82 L 64 86 C 56 94 44 94 36 86 Z', color: INK_SOFT },
      { name: 'Tongue', d: 'M 44 88 C 44 86 56 86 56 88 L 56 94 C 56 98 44 98 44 94 Z', color: PINK },
    ],
  },
  {
    id: 'pets-cat',
    name: 'Cat',
    category: 'pets',
    keywords: ['kitten', 'feline', 'kitty', 'pet', 'tabby'],
    parts: [
      { name: 'Ears', d: 'M 26 34 L 18 6 L 46 22 Z M 74 34 L 82 6 L 54 22 Z', color: SILVER },
      {
        name: 'Head',
        d: `M 50 14 C 74 14 88 32 88 56 C 88 78 72 94 50 94 C 28 94 12 78 12 56 C 12 32 26 14 50 14 Z ${CAT_FACE}`,
        color: SILVER,
      },
      {
        name: 'Stripes',
        // A cat with no markings is a bald cat. Two on the brow and two on each
        // cheek is enough to say tabby without turning into a pattern.
        d:
          'M 44 16 L 48 16 L 48 30 L 44 30 Z M 52 16 L 56 16 L 56 30 L 52 30 Z ' +
          'M 12 48 L 28 52 L 28 56 L 12 52 Z M 12 60 L 28 62 L 28 66 L 12 64 Z ' +
          'M 88 48 L 72 52 L 72 56 L 88 52 Z M 88 60 L 72 62 L 72 66 L 88 64 Z',
        color: SILVER_DARK,
      },
      { name: 'Face', d: CAT_FACE, color: INK },
      // Ear linings and nose are the same pink and sew as one pass.
      {
        name: 'Ears and nose',
        d: 'M 28 30 L 24 14 L 40 24 Z M 72 30 L 76 14 L 60 24 Z M 50 66 L 57 72 L 50 78 L 43 72 Z',
        color: PINK,
      },
      {
        name: 'Highlights',
        d:
          `${circle(34, 48, 2.2)} ${circle(62, 48, 2.2)} ` +
          'M 2 68 L 26 72 L 26 75 L 2 71 Z M 2 80 L 26 78 L 26 81 L 2 83 Z ' +
          'M 98 68 L 74 72 L 74 75 L 98 71 Z M 98 80 L 74 78 L 74 81 L 98 83 Z',
        color: WHITE,
      },
    ],
  },
  {
    id: 'pets-fish',
    name: 'Fish',
    category: 'pets',
    keywords: ['aquarium', 'goldfish', 'swim', 'tank', 'fins'],
    parts: [
      {
        name: 'Tail and fins',
        d:
          'M 22 50 C 12 40 4 26 2 10 C 18 16 30 28 36 42 Z ' +
          'M 22 50 C 12 60 4 74 2 90 C 18 84 30 72 36 58 Z ' +
          'M 56 24 C 62 14 70 8 78 6 C 78 16 74 26 68 32 Z ' +
          'M 56 76 C 62 86 70 92 78 94 C 78 84 74 74 68 68 Z',
        color: ORANGE_DARK,
      },
      {
        name: 'Body',
        d:
          'M 62 18 C 80 24 94 36 98 50 C 94 64 80 76 62 82 ' +
          'C 44 88 26 80 18 66 C 12 56 12 44 18 34 C 26 20 44 12 62 18 Z',
        color: ORANGE,
      },
      {
        name: 'Scales',
        d:
          'M 46 34 C 52 34 56 39 56 45 C 50 45 46 40 46 34 Z ' +
          'M 62 30 C 68 30 72 35 72 41 C 66 41 62 36 62 30 Z ' +
          'M 46 56 C 52 56 56 61 56 67 C 50 67 46 62 46 56 Z ' +
          'M 62 60 C 68 60 72 65 72 71 C 66 71 62 66 62 60 Z ' +
          'M 32 45 C 38 45 42 50 42 56 C 36 56 32 51 32 45 Z',
        // Lit rather than shadowed, so the scales sew after the body instead of
        // sending the machine back to the fin colour.
        color: ORANGE_LIGHT,
      },
      { name: 'Eye', d: circle(80, 42, 8), color: WHITE },
      { name: 'Pupil', d: circle(82, 42, 4.5), color: INK },
      { name: 'Bubbles', d: `${circle(94, 18, 5)} ${circle(88, 8, 3.5)}`, color: BLUE_LIGHT },
    ],
  },
  {
    id: 'pets-birdhouse',
    name: 'Birdhouse',
    category: 'pets',
    keywords: ['bird', 'nest', 'garden', 'home', 'box'],
    parts: [
      {
        name: 'House',
        d: 'M 50 2 L 94 38 L 84 38 L 84 84 L 16 84 L 16 38 L 6 38 Z M 50 40 C 59 40 66 47 66 56 C 66 65 59 72 50 72 C 41 72 34 65 34 56 C 34 47 41 40 50 40 Z',
        color: WOOD,
      },
      {
        name: 'Roof',
        d: 'M 50 2 L 94 38 L 84 38 L 50 10 L 16 38 L 6 38 Z',
        color: RED,
      },
      // Post, boards and perch are all the same dark wood and sew as one pass.
      { name: 'Post', d: 'M 44 84 L 56 84 L 56 100 L 44 100 Z', color: WOOD_DARK },
      { name: 'Boards', d: 'M 16 54 L 34 54 L 34 58 L 16 58 Z M 66 54 L 84 54 L 84 58 L 66 58 Z M 16 70 L 84 70 L 84 74 L 16 74 Z', color: WOOD_DARK },
      { name: 'Perch', d: 'M 46 72 L 54 72 L 54 92 L 46 92 Z', color: WOOD_DARK },
      { name: 'Hole shadow', d: circle(50, 56, 12), color: INK_SOFT },
    ],
  },
  {
    id: 'pets-collar-tag',
    name: 'Collar tag',
    category: 'pets',
    keywords: ['name tag', 'id', 'dog', 'pet', 'buckle'],
    parts: [
      { name: 'Collar', d: 'M 2 8 L 98 8 L 98 28 L 2 28 Z M 30 12 L 38 12 L 38 24 L 30 24 Z M 62 12 L 70 12 L 70 24 L 62 24 Z', color: RED },
      { name: 'Stitching', d: 'M 2 12 L 98 12 L 98 14 L 2 14 Z M 2 22 L 98 22 L 98 24 L 2 24 Z', color: CREAM },
      { name: 'Ring', d: ring(50, 38, 12, 6), color: SILVER },
      { name: 'Tag', d: circle(50, 72, 26), color: GOLD },
      { name: 'Tag rim', d: ring(50, 72, 26, 21), color: GOLD_DARK },
      {
        name: 'Bone mark',
        d: 'M 38 66 C 41 66 43 68 43 71 L 57 71 C 57 68 59 66 62 66 C 66 66 68 69 68 72 C 68 76 66 78 62 78 C 59 78 57 76 57 73 L 43 73 C 43 76 41 78 38 78 C 34 78 32 76 32 72 C 32 69 34 66 38 66 Z',
        color: WHITE,
      },
      { name: 'Grass', d: 'M 6 92 C 14 84 22 86 26 94 C 20 92 12 94 8 98 Z M 94 92 C 86 84 78 86 74 94 C 80 92 88 94 92 98 Z', color: GREEN_DARK },
    ],
  },
];
