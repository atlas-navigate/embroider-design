import type { LibraryShape } from '../types.js';
import { circle, flame } from './draw.js';
import {
  BLUE,
  BLUE_DARK,
  CREAM,
  CREAM_DARK,
  GREEN,
  INK_SOFT,
  ORANGE,
  PINK,
  PINK_DARK,
  PURPLE,
  RED,
  RED_DARK,
  SILVER,
  TEAL,
  WHITE,
  YELLOW,
  YELLOW_LIGHT,
} from './palette.js';

/**
 * Birthday.
 *
 * Balloons are the thing worth getting right: a balloon is not a circle. It is
 * widest above its middle and drawn down to a neck, and the knot below the neck
 * is what makes it read as inflated rather than as a dot on a string.
 */

/** A balloon with its neck and knot, sized to a box. */
function balloon(cx: number, top: number, w: number, h: number): string {
  const half = w / 2;
  const bottom = top + h;
  const n = (v: number): string => String(+v.toFixed(2));
  return (
    `M ${n(cx)} ${n(top)} ` +
    `C ${n(cx + half)} ${n(top)} ${n(cx + half)} ${n(top + h * 0.42)} ${n(cx + half * 0.86)} ${n(top + h * 0.66)} ` +
    `C ${n(cx + half * 0.6)} ${n(top + h * 0.86)} ${n(cx + half * 0.2)} ${n(bottom)} ${n(cx)} ${n(bottom)} ` +
    `C ${n(cx - half * 0.2)} ${n(bottom)} ${n(cx - half * 0.6)} ${n(top + h * 0.86)} ${n(cx - half * 0.86)} ${n(top + h * 0.66)} ` +
    `C ${n(cx - half)} ${n(top + h * 0.42)} ${n(cx - half)} ${n(top)} ${n(cx)} ${n(top)} Z ` +
    // The knot, hanging off the neck.
    `M ${n(cx - w * 0.09)} ${n(bottom - h * 0.02)} L ${n(cx + w * 0.09)} ${n(bottom - h * 0.02)} ` +
    `L ${n(cx)} ${n(bottom + h * 0.07)} Z`
  );
}

export const BIRTHDAY_SHAPES: LibraryShape[] = [
  {
    id: 'birthday-cake',
    name: 'Birthday cake',
    category: 'birthday',
    keywords: ['candles', 'celebrate', 'party', 'dessert', 'tiers'],
    parts: [
      { name: 'Flames', d: `${flame(30, 4, 18)} ${flame(50, 4, 18)} ${flame(70, 4, 18)}`, color: ORANGE },
      { name: 'Flame cores', d: `${flame(30, 10, 10)} ${flame(50, 10, 10)} ${flame(70, 10, 10)}`, color: YELLOW_LIGHT },
      { name: 'Candles', d: 'M 26 24 L 34 24 L 34 46 L 26 46 Z M 46 24 L 54 24 L 54 46 L 46 46 Z M 66 24 L 74 24 L 74 46 L 66 46 Z', color: CREAM },
      { name: 'Top tier', d: 'M 20 52 L 80 52 L 80 70 L 20 70 Z', color: CREAM_DARK },
      { name: 'Bottom tier', d: 'M 8 70 L 92 70 L 92 92 L 8 92 Z', color: CREAM_DARK },
      {
        name: 'Icing',
        // Drips over the edge of each tier, which is what says "cake" rather
        // than "stack of boxes".
        d:
          'M 20 46 L 80 46 L 80 56 C 74 62 70 54 64 60 C 58 66 54 54 48 60 ' +
          'C 42 66 38 54 32 60 C 26 66 22 56 20 56 Z ' +
          'M 8 64 L 92 64 L 92 76 C 84 84 80 72 72 78 C 64 84 60 72 52 78 ' +
          'C 44 84 40 72 32 78 C 24 84 16 74 8 76 Z',
        color: PINK,
      },
      {
        name: 'Candle stripes',
        d: 'M 26 30 L 34 30 L 34 34 L 26 34 Z M 46 30 L 54 30 L 54 34 L 46 34 Z M 66 30 L 74 30 L 74 34 L 66 34 Z M 26 40 L 34 40 L 34 44 L 26 44 Z M 46 40 L 54 40 L 54 44 L 46 44 Z M 66 40 L 74 40 L 74 44 L 66 44 Z',
        color: PINK_DARK,
      },
      {
        name: 'Sprinkles',
        d:
          'M 18 80 L 22 78 L 26 84 L 22 86 Z M 40 82 L 44 80 L 48 86 L 44 88 Z ' +
          'M 62 80 L 66 78 L 70 84 L 66 86 Z M 78 84 L 82 82 L 86 88 L 82 90 Z',
        color: TEAL,
      },
      { name: 'Plate', d: 'M 2 92 L 98 92 L 94 98 L 6 98 Z', color: SILVER },
    ],
  },
  {
    id: 'birthday-cupcake',
    name: 'Cupcake',
    category: 'birthday',
    keywords: ['muffin', 'frosting', 'treat', 'party', 'sweet'],
    parts: [
      { name: 'Cherry stalk', d: 'M 48 4 C 56 4 60 10 60 20 L 54 20 C 54 14 52 10 48 10 Z', color: GREEN },
      { name: 'Cherry', d: circle(46, 16, 10), color: RED },
      {
        name: 'Frosting',
        // Three swirls of decreasing width. A single dome is a mushroom.
        d:
          'M 22 58 C 14 58 10 52 12 46 C 14 40 20 38 26 40 C 24 32 30 26 38 28 ' +
          'C 38 20 46 14 54 18 C 60 12 70 14 72 22 C 82 22 88 30 84 38 ' +
          'C 92 42 92 52 84 56 C 80 58 76 58 72 58 Z',
        color: PINK,
      },
      {
        name: 'Frosting shading',
        d: 'M 72 22 C 82 22 88 30 84 38 C 92 42 92 52 84 56 C 80 58 76 58 72 58 L 60 58 C 74 52 78 36 72 22 Z',
        color: PINK_DARK,
      },
      { name: 'Case', d: 'M 18 58 L 82 58 L 74 94 C 73 97 70 98 66 98 L 34 98 C 30 98 27 97 26 94 Z', color: BLUE },
      {
        name: 'Pleats',
        d: 'M 34 58 L 40 58 L 38 98 L 32 98 Z M 48 58 L 54 58 L 54 98 L 48 98 Z M 62 58 L 68 58 L 70 98 L 64 98 Z',
        color: BLUE_DARK,
      },
      {
        name: 'Sprinkles',
        d: `${circle(34, 44, 3)} ${circle(52, 34, 3)} ${circle(68, 44, 3)} ${circle(44, 52, 3)} ${circle(62, 52, 3)}`,
        color: YELLOW,
      },
    ],
  },
  {
    id: 'birthday-balloon',
    name: 'Balloon',
    category: 'birthday',
    keywords: ['party', 'helium', 'float', 'celebrate', 'string'],
    parts: [
      { name: 'String', d: 'M 48 74 C 52 82 44 88 48 96 L 52 98 C 48 90 56 84 52 74 Z', color: INK_SOFT },
      { name: 'Balloon', d: balloon(50, 4, 62, 66), color: RED },
      {
        name: 'Shading',
        d: 'M 66 10 C 78 18 82 34 76 50 C 72 60 64 68 56 70 C 66 60 70 44 66 30 C 64 22 68 14 66 10 Z',
        color: RED_DARK,
      },
      { name: 'Shine', d: 'M 30 20 C 34 14 42 12 46 15 L 40 26 C 37 25 33 27 32 31 Z', color: WHITE },
    ],
  },
  {
    id: 'birthday-balloons',
    name: 'Balloon cluster',
    category: 'birthday',
    keywords: ['party', 'bunch', 'three', 'celebrate', 'helium'],
    parts: [
      {
        name: 'Strings',
        d:
          'M 24 52 C 30 66 40 74 48 92 L 52 90 C 44 72 34 64 28 50 Z ' +
          'M 76 52 C 70 66 60 74 52 92 L 48 90 C 56 72 66 64 72 50 Z ' +
          'M 50 66 L 54 66 L 54 92 L 50 92 Z',
        color: INK_SOFT,
      },
      { name: 'Left balloon', d: balloon(24, 6, 44, 46), color: RED },
      { name: 'Right balloon', d: balloon(76, 6, 44, 46), color: YELLOW },
      { name: 'Middle balloon', d: balloon(52, 20, 46, 48), color: BLUE },
      {
        name: 'Shines',
        d:
          'M 12 18 C 15 14 20 12 23 14 L 19 22 C 17 21 14 22 13 25 Z ' +
          'M 64 18 C 67 14 72 12 75 14 L 71 22 C 69 21 66 22 65 25 Z ' +
          'M 40 32 C 43 28 48 26 51 28 L 47 36 C 45 35 42 36 41 39 Z',
        color: WHITE,
      },
      {
        name: 'Ribbon',
        d: 'M 44 88 C 48 84 52 84 56 88 C 52 92 48 92 44 88 Z M 40 94 L 60 94 L 60 99 L 40 99 Z',
        color: PINK,
      },
    ],
  },
  {
    id: 'birthday-party-hat',
    name: 'Party hat',
    category: 'birthday',
    keywords: ['cone', 'celebrate', 'pompom', 'costume', 'party'],
    parts: [
      { name: 'Pompom', d: circle(50, 10, 10), color: YELLOW },
      { name: 'Cone', d: 'M 50 14 L 86 86 L 14 86 Z', color: BLUE },
      { name: 'Shading', d: 'M 50 14 L 86 86 L 50 86 Z', color: BLUE_DARK },
      {
        name: 'Stripes',
        // Following the taper, so the cone reads as a cone.
        d:
          'M 43 28 L 57 28 L 60 40 L 40 40 Z ' +
          'M 36 52 L 64 52 L 67 64 L 33 64 Z ' +
          'M 29 76 L 71 76 L 76 86 L 24 86 Z',
        color: PINK,
      },
      { name: 'Brim', d: 'M 10 84 L 90 84 L 90 94 L 10 94 Z', color: WHITE },
    ],
  },
  {
    id: 'birthday-candle',
    name: 'Candle',
    category: 'birthday',
    keywords: ['flame', 'wax', 'wick', 'celebrate', 'light'],
    parts: [
      { name: 'Flame', d: flame(50, 2, 30), color: ORANGE },
      { name: 'Flame core', d: flame(50, 12, 18), color: YELLOW_LIGHT },
      { name: 'Wick', d: 'M 47 28 L 53 28 L 53 40 L 47 40 Z', color: INK_SOFT },
      { name: 'Wax', d: 'M 32 36 L 68 36 L 68 98 L 32 98 Z', color: CREAM },
      { name: 'Melt', d: 'M 32 36 C 38 42 44 32 50 38 C 56 44 62 34 68 40 L 68 44 L 32 44 Z', color: WHITE },
      { name: 'Wax shading', d: 'M 58 44 L 68 44 L 68 98 L 58 98 Z', color: CREAM_DARK },
      {
        name: 'Stripes',
        d: 'M 32 50 L 68 50 L 68 60 L 32 60 Z M 32 70 L 68 70 L 68 80 L 32 80 Z M 32 90 L 68 90 L 68 98 L 32 98 Z',
        color: RED,
      },
    ],
  },
  {
    id: 'birthday-confetti',
    name: 'Confetti',
    category: 'birthday',
    keywords: ['party', 'celebrate', 'streamers', 'scatter', 'new year'],
    parts: [
      {
        name: 'Streamers',
        // Curling ribbons, not only chips: the curls give the scatter some
        // direction instead of letting it look like static.
        d:
          'M 6 12 C 18 18 18 32 6 38 L 12 44 C 28 34 28 16 12 6 Z ' +
          'M 94 58 C 82 64 82 78 94 84 L 88 90 C 72 80 72 62 88 52 Z',
        color: PINK,
      },
      {
        name: 'Chips',
        d:
          'M 30 6 L 40 10 L 34 20 L 24 16 Z M 64 14 L 74 10 L 80 20 L 70 24 Z ' +
          'M 20 46 L 30 42 L 36 52 L 26 56 Z M 56 44 L 66 48 L 60 58 L 50 54 Z ' +
          'M 34 74 L 44 70 L 50 80 L 40 84 Z M 66 76 L 76 80 L 70 90 L 60 86 Z',
        color: TEAL,
      },
      {
        name: 'More chips',
        d:
          'M 48 4 L 58 8 L 52 18 L 42 14 Z M 82 34 L 92 30 L 98 40 L 88 44 Z ' +
          'M 4 62 L 14 66 L 8 76 L 2 72 Z M 44 90 L 54 86 L 60 96 L 50 98 Z ' +
          'M 76 62 L 86 66 L 80 76 L 70 72 Z M 14 84 L 24 88 L 18 98 L 8 94 Z',
        color: YELLOW,
      },
      {
        name: 'Last chips',
        d: 'M 40 30 L 50 26 L 56 36 L 46 40 Z M 62 62 L 72 58 L 78 68 L 68 72 Z M 22 26 L 30 30 L 26 38 L 18 34 Z',
        color: PURPLE,
      },
    ],
  },
];
