import type { LibraryShape } from '../types.js';
import { circle, rect, repeat, roundRect } from './draw.js';
import {
  BLUE,
  BLUE_DARK,
  BLUE_LIGHT,
  BROWN_DARK,
  CREAM,
  GOLD,
  GOLD_DARK,
  GREEN,
  GREEN_DARK,
  INK,
  INK_SOFT,
  PINK,
  RED,
  RED_DARK,
  SILVER,
  SILVER_DARK,
  SKY,
  WHITE,
  WOOD,
  WOOD_LIGHT,
  YELLOW,
  YELLOW_DARK,
} from './palette.js';

/**
 * School.
 *
 * These are the objects people know best, so they are the ones least forgiving
 * of a wrong proportion: everybody has held a pencil, and everybody can see
 * when the ferrule is too long. Each drawing here is built from the parts the
 * real object has — ferrule, wood, graphite — rather than from a silhouette
 * with colour patches laid over it, because the part boundaries are exactly
 * where the eye looks.
 */

/** Alternating long and short marks down the edge of the ruler. */
const RULER_TICKS = repeat([10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90], (x, i) =>
  rect(x, 34, 2.5, i % 2 === 0 ? 16 : 10),
);

/** One line of writing on a page, following the page's curve. */
function pageLine(x: number, y: number, sweep: number): string {
  const n = (v: number): string => String(+v.toFixed(2));
  const dip = sweep > 0 ? 4 : -4;
  return (
    `M ${n(x)} ${n(y)} ` +
    `C ${n(x + sweep * 0.34)} ${n(y - dip)} ${n(x + sweep * 0.66)} ${n(y - dip * 0.5)} ${n(x + sweep)} ${n(y + 3)} ` +
    `L ${n(x + sweep)} ${n(y + 6)} ` +
    `C ${n(x + sweep * 0.66)} ${n(y - dip * 0.5 + 3)} ${n(x + sweep * 0.34)} ${n(y - dip + 3)} ${n(x)} ${n(y + 3)} Z`
  );
}

export const SCHOOL_SHAPES: LibraryShape[] = [
  {
    id: 'school-apple',
    name: 'Apple',
    category: 'school',
    keywords: ['teacher', 'fruit', 'class', 'healthy'],
    parts: [
      {
        name: 'Apple',
        // Two lobes meeting in a dimple at the stem and again at the base.
        // A single oval is what the old drawing had, and an oval with a stem
        // is a cherry.
        d:
          'M 50 30 C 60 22 78 22 86 36 C 94 50 90 74 78 88 C 71 96 62 99 55 97 ' +
          'C 52 96 48 96 45 97 C 38 99 29 96 22 88 C 10 74 6 50 14 36 ' +
          'C 22 22 40 22 50 30 Z',
        color: RED,
      },
      {
        name: 'Shading',
        d: 'M 74 30 C 86 40 90 62 80 82 C 76 88 70 94 64 96 C 74 86 80 70 78 54 C 77 44 76 36 74 30 Z',
        color: RED_DARK,
      },
      {
        name: 'Highlight',
        d: 'M 26 42 C 30 34 38 29 46 29 C 40 34 34 41 32 50 C 28 50 25 47 26 42 Z',
        color: WHITE,
      },
      { name: 'Stem', d: 'M 46 30 C 44 20 46 12 54 6 L 58 10 C 52 15 50 22 52 30 Z', color: BROWN_DARK },
      { name: 'Leaf', d: 'M 56 24 C 64 12 78 8 90 10 C 88 22 76 30 58 30 Z', color: GREEN },
      { name: 'Vein', d: 'M 60 29 C 69 23 78 17 88 13 L 89 15 C 80 20 70 25 62 31 Z', color: GREEN_DARK },
    ],
  },
  {
    id: 'school-pencil',
    name: 'Pencil',
    category: 'school',
    keywords: ['write', 'draw', 'stationery', 'school'],
    parts: [
      { name: 'Body', d: 'M 10 76 L 24 90 L 88 26 L 74 12 Z', color: YELLOW },
      { name: 'Body shading', d: 'M 17 83 L 24 90 L 88 26 L 81 19 Z', color: YELLOW_DARK },
      { name: 'Wood', d: 'M 2 98 L 10 76 L 24 90 Z', color: WOOD_LIGHT },
      { name: 'Graphite', d: 'M 2 98 L 6 87 L 13 94 Z', color: INK },
      { name: 'Ferrule', d: 'M 74 12 L 88 26 L 94 20 L 80 6 Z', color: SILVER },
      {
        name: 'Ferrule bands',
        // Square to the pencil, not along it: the crimp rings on a real
        // ferrule run around the barrel.
        d:
          'M 75.8 10.2 L 89.8 24.2 L 90.52 23.48 L 76.52 9.48 Z ' +
          'M 77.6 8.4 L 91.6 22.4 L 92.32 21.68 L 78.32 7.68 Z',
        color: SILVER_DARK,
      },
      {
        name: 'Eraser',
        d: 'M 80 6 L 94 20 L 97 17 C 99 15 99 11 97 9 L 91 3 C 89 1 85 1 83 3 Z',
        color: PINK,
      },
    ],
  },
  {
    id: 'school-graduation-cap',
    name: 'Graduation cap',
    category: 'school',
    keywords: ['mortarboard', 'graduate', 'college', 'degree'],
    parts: [
      // Crown first, board over it: the board's near edge is what hides the
      // top of the crown, and drawing it second is what gives the cap depth.
      {
        name: 'Crown',
        d: 'M 28 42 L 72 42 L 72 66 C 72 76 62 82 50 82 C 38 82 28 76 28 66 Z',
        color: INK_SOFT,
      },
      { name: 'Board', d: 'M 50 12 L 96 34 L 50 56 L 4 34 Z', color: INK },
      {
        name: 'Cord and tassel',
        // The cord lies along the board and sags as it goes, then drops off
        // the corner. A right-angled cord reads as a bracket, and a mortarboard
        // with a bracket on it reads as a hammer.
        d:
          'M 50 31 C 68 31 84 33 93 36 L 91 43 C 82 40 68 38 50 38 Z ' +
          'M 88 40 L 94 40 L 94 62 L 88 62 Z ' +
          'M 84 60 L 98 60 L 95 86 L 87 86 Z',
        color: GOLD,
      },
      {
        name: 'Button and strands',
        d: `${circle(50, 34, 4)} ${rect(87, 64, 2, 20)} ${rect(90.5, 64, 2, 20)} ${rect(93.5, 64, 2, 16)}`,
        color: GOLD_DARK,
      },
    ],
  },
  {
    id: 'school-book',
    name: 'Book',
    category: 'school',
    keywords: ['read', 'library', 'study', 'textbook'],
    parts: [
      // Open rather than shut. A closed book is a rectangle with a stripe, and
      // at 40 mm a rectangle with a stripe is a brick.
      {
        name: 'Cover',
        d:
          'M 4 22 C 20 14 38 16 50 22 C 62 16 80 14 96 22 L 96 84 ' +
          'C 80 76 62 78 50 84 C 38 78 20 76 4 84 Z',
        color: BLUE,
      },
      { name: 'Spine', d: 'M 44 22 C 46 20 54 20 56 22 L 56 84 C 54 82 46 82 44 84 Z', color: BLUE_DARK },
      {
        name: 'Pages',
        d:
          'M 10 28 C 22 22 36 24 47 30 L 47 80 C 36 74 22 72 10 78 Z ' +
          'M 90 28 C 78 22 64 24 53 30 L 53 80 C 64 74 78 72 90 78 Z',
        color: CREAM,
      },
      {
        name: 'Lines',
        d: [
          pageLine(15, 40, 28),
          pageLine(15, 52, 28),
          pageLine(15, 64, 28),
          pageLine(85, 40, -28),
          pageLine(85, 52, -28),
          pageLine(85, 64, -28),
        ].join(' '),
        color: SILVER,
      },
      { name: 'Bookmark', d: 'M 46 78 L 54 78 L 54 96 L 50 91 L 46 96 Z', color: RED },
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
          'M 4 24 C 4 19 8 16 13 16 L 66 16 C 72 16 76 19 79 25 L 88 43 ' +
          'C 93 49 96 54 96 62 L 96 72 C 96 77 92 80 87 80 L 13 80 ' +
          'C 8 80 4 77 4 72 Z',
        color: YELLOW,
      },
      {
        name: 'Windows',
        // Three side lights and a raked windscreen over the hood, which is
        // the one detail that tells you which way the bus is pointing.
        d:
          `${rect(12, 26, 20, 18)} ${rect(38, 26, 20, 18)} ` +
          'M 64 26 L 74 26 L 83 44 L 64 44 Z',
        color: SKY,
      },
      { name: 'Stripe', d: rect(6, 52, 88, 6), color: INK },
      { name: 'Wheels', d: `${circle(26, 80, 14)} ${circle(74, 80, 14)}`, color: INK },
      { name: 'Hubs', d: `${circle(26, 80, 6)} ${circle(74, 80, 6)}`, color: SILVER },
      { name: 'Bumper', d: rect(88, 66, 9, 8), color: SILVER_DARK },
      { name: 'Beacons', d: `${rect(20, 10, 8, 6)} ${rect(72, 10, 8, 6)}`, color: RED },
    ],
  },
  {
    id: 'school-ruler',
    name: 'Ruler',
    category: 'school',
    keywords: ['measure', 'straight', 'stationery', 'geometry'],
    parts: [
      { name: 'Ruler', d: roundRect(2, 34, 96, 32, 4), color: WOOD },
      { name: 'Bevel', d: rect(6, 58, 88, 4), color: WOOD_LIGHT },
      // Marks run off the measuring edge and alternate length, which is what
      // makes a plank read as a ruler.
      { name: 'Marks', d: RULER_TICKS, color: INK },
    ],
  },
  {
    id: 'school-backpack',
    name: 'Backpack',
    category: 'school',
    keywords: ['bag', 'rucksack', 'satchel', 'school'],
    parts: [
      { name: 'Straps', d: 'M 32 20 C 32 6 40 2 50 2 C 60 2 68 6 68 20 L 60 20 C 60 12 56 10 50 10 C 44 10 40 12 40 20 Z', color: BLUE_DARK },
      {
        name: 'Bag',
        d:
          'M 12 40 C 12 26 26 16 50 16 C 74 16 88 26 88 40 L 88 88 ' +
          'C 88 94 84 98 78 98 L 22 98 C 16 98 12 94 12 88 Z',
        color: BLUE,
      },
      {
        name: 'Flap and pocket',
        d:
          'M 12 42 C 12 30 26 22 50 22 C 74 22 88 30 88 42 L 88 56 ' +
          'C 88 60 84 62 78 62 L 22 62 C 16 62 12 60 12 56 Z ' +
          'M 26 70 L 74 70 C 78 70 80 72 80 76 L 80 90 C 80 94 78 96 74 96 ' +
          'L 26 96 C 22 96 20 94 20 90 L 20 76 C 20 72 22 70 26 70 Z',
        color: BLUE_LIGHT,
      },
      {
        name: 'Buckle',
        // Frame, not a slab: the counter-ring makes the middle a hole so the
        // flap shows through it.
        d: `${rect(42, 54, 16, 16)} ${rect(46, 58, 8, 8)}`,
        color: GOLD,
      },
      { name: 'Zip', d: `${rect(24, 78, 52, 4)} M 46 82 L 54 82 L 52 88 L 48 88 Z`, color: SILVER },
    ],
  },
];
