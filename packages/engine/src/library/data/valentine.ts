import type { LibraryShape } from '../types.js';
import { circle, heart } from './draw.js';
import {
  CRIMSON,
  GOLD,
  GREEN,
  GREEN_DARK,
  INK,
  PINK,
  PINK_DARK,
  PINK_LIGHT,
  RED,
  RED_DARK,
  RED_LIGHT,
  SILVER,
  WHITE,
  WOOD,
  YELLOW,
} from './palette.js';

/**
 * Valentine's.
 *
 * The heart is the one shape here everybody already knows by heart, which makes
 * it unforgiving: the cleavage between the lobes and the sharpness of the point
 * are the two places a wrong curve is instantly visible. It is drawn once in
 * `draw.ts` and shared, so every heart in the catalogue is the same heart.
 */

/** The classic heart, shared by everything here that needs one. */
export const HEART_PATH = heart(50, 8, 92, 88);

export const VALENTINE_SHAPES: LibraryShape[] = [
  {
    id: 'valentine-heart',
    name: 'Heart',
    category: 'valentine',
    keywords: ['love', 'romance', 'valentine', 'red'],
    parts: [
      { name: 'Heart', d: HEART_PATH, color: RED },
      {
        name: 'Shading',
        d: 'M 62 10 C 78 10 92 24 92 42 C 92 62 76 80 50 96 C 68 76 78 58 78 42 C 78 28 72 16 62 10 Z',
        color: RED_DARK,
      },
      { name: 'Shine', d: 'M 22 24 C 27 16 36 14 42 18 L 36 30 C 32 28 27 30 25 34 Z', color: RED_LIGHT },
    ],
  },
  {
    id: 'valentine-heart-outline',
    name: 'Heart outline',
    category: 'valentine',
    keywords: ['love', 'ring', 'hollow', 'romance', 'border'],
    parts: [
      {
        name: 'Outline',
        d: `${HEART_PATH} ${heart(50, 24, 62, 60)}`,
        color: RED,
      },
      { name: 'Shine', d: 'M 22 24 C 27 16 36 14 42 18 L 38 27 C 34 25 29 27 27 31 Z', color: RED_LIGHT },
    ],
  },
  {
    id: 'valentine-double-heart',
    name: 'Double heart',
    category: 'valentine',
    keywords: ['love', 'couple', 'pair', 'two', 'romance'],
    parts: [
      { name: 'Back heart', d: heart(64, 20, 70, 66), color: PINK },
      { name: 'Back shading', d: 'M 78 22 C 90 24 99 36 99 50 C 99 64 88 76 64 86 C 80 74 88 62 88 50 C 88 38 84 28 78 22 Z', color: PINK_DARK },
      { name: 'Front heart', d: heart(36, 26, 68, 66), color: RED },
      { name: 'Front shading', d: 'M 48 28 C 60 30 69 42 69 56 C 69 70 58 82 36 92 C 52 80 60 68 60 56 C 60 44 55 34 48 28 Z', color: RED_DARK },
      { name: 'Shine', d: 'M 14 42 C 18 34 26 32 32 36 L 27 46 C 23 44 19 46 17 50 Z', color: RED_LIGHT },
    ],
  },
  {
    id: 'valentine-heart-arrow',
    name: 'Heart with arrow',
    category: 'valentine',
    keywords: ['cupid', 'love', 'struck', 'romance', 'bow'],
    parts: [
      {
        name: 'Shaft',
        d: 'M 2 78 L 22 60 L 30 68 L 10 86 Z M 70 20 L 90 2 L 98 10 L 78 28 Z',
        color: WOOD,
      },
      {
        name: 'Fletching',
        // Two vanes swept back along the shaft, rather than a square block:
        // the sweep is what reads as feather.
        d: 'M 2 78 L 22 60 L 26 72 L 10 88 Z M 10 88 L 26 72 L 30 84 L 12 98 Z',
        color: RED_LIGHT,
      },
      { name: 'Heart', d: heart(50, 20, 76, 72), color: RED },
      {
        name: 'Shading',
        d: 'M 62 22 C 76 22 88 34 88 50 C 88 66 74 82 50 92 C 66 76 76 62 76 50 C 76 38 70 28 62 22 Z',
        color: RED_DARK,
      },
      { name: 'Arrowhead', d: 'M 78 28 L 98 10 L 96 30 L 84 34 Z', color: SILVER },
    ],
  },
  {
    id: 'valentine-rose',
    name: 'Rose',
    category: 'valentine',
    keywords: ['flower', 'romance', 'bloom', 'stem', 'thorn'],
    parts: [
      {
        name: 'Leaves',
        d:
          'M 46 66 C 34 62 22 66 14 76 C 26 82 40 80 48 72 Z ' +
          'M 54 78 C 66 74 78 78 86 88 C 74 94 60 92 52 84 Z',
        color: GREEN,
      },
      // Stem and veins share a thread, so they sew together and the stem still
      // lands in front of the leaves it grows through.
      { name: 'Stem', d: 'M 46 52 L 54 52 L 56 95 L 44 95 Z', color: GREEN_DARK },
      { name: 'Leaf veins', d: 'M 20 76 L 46 70 L 46 73 L 21 79 Z M 80 88 L 54 82 L 54 85 L 79 91 Z', color: GREEN_DARK },
      {
        name: 'Bloom',
        // Overlapping petals rather than a disc: a rose is read from the spiral
        // at its centre, and a circle on a stick is a lollipop.
        d:
          'M 50 2 C 68 2 82 16 82 34 C 82 50 68 62 50 62 C 32 62 18 50 18 34 C 18 16 32 2 50 2 Z',
        color: RED,
      },
      {
        name: 'Petals',
        d:
          'M 50 8 C 62 8 70 16 70 26 C 70 38 60 46 48 46 C 38 46 30 38 30 28 C 30 18 38 8 50 8 Z ' +
          'M 18 34 C 18 46 26 56 38 60 C 30 50 28 42 30 32 Z ' +
          'M 82 34 C 82 46 74 56 62 60 C 70 50 72 42 70 32 Z',
        color: RED_DARK,
      },
      {
        name: 'Centre',
        d: 'M 50 18 C 58 18 62 23 62 29 C 62 36 56 40 49 40 C 43 40 39 36 39 30 C 39 24 44 18 50 18 Z M 50 24 C 46 24 44 27 44 30 C 44 33 46 35 49 35 C 53 35 56 33 56 29 C 56 26 54 24 50 24 Z',
        color: CRIMSON,
      },
    ],
  },
  {
    id: 'valentine-love-birds',
    name: 'Love birds',
    category: 'valentine',
    keywords: ['birds', 'couple', 'romance', 'pair', 'perch'],
    parts: [
      { name: 'Branch', d: 'M 2 88 L 98 82 L 98 90 L 2 96 Z', color: WOOD },
      {
        name: 'Left bird',
        // Facing each other, heads tilted in: the tilt is what turns two birds
        // into a pair.
        d:
          'M 34 34 C 42 34 48 40 48 50 C 48 60 44 70 36 78 L 40 86 L 10 86 ' +
          'C 12 78 10 70 12 60 C 14 46 22 34 34 34 Z',
        color: PINK,
      },
      {
        name: 'Right bird',
        d:
          'M 66 34 C 58 34 52 40 52 50 C 52 60 56 70 64 78 L 60 86 L 90 86 ' +
          'C 88 78 90 70 88 60 C 86 46 78 34 66 34 Z',
        color: PINK,
      },
      { name: 'Left wing', d: 'M 26 52 C 34 50 40 54 42 62 C 36 70 26 70 20 64 C 18 58 20 54 26 52 Z', color: PINK_DARK },
      { name: 'Right wing', d: 'M 74 52 C 66 50 60 54 58 62 C 64 70 74 70 80 64 C 82 58 80 54 74 52 Z', color: PINK_DARK },
      { name: 'Beaks', d: 'M 42 44 L 50 47 L 42 50 Z M 58 44 L 50 47 L 58 50 Z', color: GOLD },
      { name: 'Eyes', d: `${circle(28, 44, 3)} ${circle(72, 44, 3)}`, color: INK },
      { name: 'Heart', d: heart(50, 2, 30, 28), color: RED },
    ],
  },
  {
    id: 'valentine-love-letter',
    name: 'Love letter',
    category: 'valentine',
    keywords: ['envelope', 'note', 'post', 'card', 'sealed'],
    parts: [
      { name: 'Envelope', d: 'M 4 22 L 96 22 L 96 86 L 4 86 Z', color: WHITE },
      { name: 'Shading', d: 'M 76 22 L 96 22 L 96 86 L 76 86 Z', color: SILVER },
      {
        name: 'Flap',
        d: 'M 4 22 L 96 22 L 50 62 Z M 4 86 L 38 52 L 44 58 L 12 86 Z M 96 86 L 62 52 L 56 58 L 88 86 Z',
        color: PINK_LIGHT,
      },
      { name: 'Seal', d: heart(50, 44, 30, 30), color: RED },
      { name: 'Seal shine', d: circle(44, 52, 3.5), color: RED_LIGHT },
      { name: 'Stamp', d: 'M 72 28 L 90 28 L 90 46 L 72 46 Z', color: YELLOW },
    ],
  },
];
