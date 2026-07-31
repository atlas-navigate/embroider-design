import type { LibraryShape } from '../types.js';
import { circle, ellipse, flame, star } from './draw.js';
import {
  BLUE_LIGHT,
  GOLD,
  GOLD_DARK,
  GOLD_LIGHT,
  INK,
  NAVY,
  ORANGE,
  RED,
  RED_LIGHT,
  WHITE,
  WOOD_DARK,
  YELLOW,
  YELLOW_LIGHT,
} from './palette.js';

/**
 * Patriotic.
 *
 * The flag is drawn with its canton cut out of the stripe field rather than
 * laid over it, so the blue does not sew on top of red and white. Thirteen
 * stripes would be unreadable at 40 mm — seven are used, which is what every
 * embroidered flag does and what the eye reads as "stripes" anyway.
 */

/** Used once, so it stays here rather than in the shared palette. */
const EAGLE_BROWN = '#7a5a44';
const EAGLE_BROWN_DARK = '#4a3628';

export const PATRIOTIC_SHAPES: LibraryShape[] = [
  {
    id: 'patriotic-firework',
    name: 'Firework',
    category: 'patriotic',
    keywords: ['celebrate', 'burst', 'new year', 'july 4th', 'sparkle', 'rocket'],
    parts: [
      {
        name: 'Burst',
        // Rays of two lengths alternating, with a gap before the core: a
        // firework is spreading sparks, not a solid star.
        d:
          'M 47 2 L 53 2 L 52 34 L 48 34 Z M 47 66 L 53 66 L 53 98 L 47 98 Z ' +
          'M 2 47 L 34 48 L 34 52 L 2 53 Z M 66 48 L 98 47 L 98 53 L 66 52 Z ' +
          'M 15 11 L 20 7 L 40 32 L 36 36 Z M 85 11 L 80 7 L 60 32 L 64 36 Z ' +
          'M 15 89 L 20 93 L 40 68 L 36 64 Z M 85 89 L 80 93 L 60 68 L 64 64 Z',
        color: RED,
      },
      {
        name: 'Sparks',
        d:
          'M 30 16 L 34 14 L 44 30 L 41 32 Z M 70 16 L 66 14 L 56 30 L 59 32 Z ' +
          'M 30 84 L 34 86 L 44 70 L 41 68 Z M 70 84 L 66 86 L 56 70 L 59 68 Z ' +
          'M 16 32 L 14 36 L 32 43 L 34 40 Z M 84 32 L 86 36 L 68 43 L 66 40 Z ' +
          'M 16 68 L 14 64 L 32 57 L 34 60 Z M 84 68 L 86 64 L 68 57 L 66 60 Z',
        color: BLUE_LIGHT,
      },
      { name: 'Core', d: circle(50, 50, 15), color: YELLOW },
      { name: 'Centre', d: circle(50, 50, 7), color: WHITE },
    ],
  },
  {
    id: 'patriotic-flag',
    name: 'Waving flag',
    category: 'patriotic',
    keywords: ['stars', 'stripes', 'usa', 'america', 'banner', 'july 4th'],
    parts: [
      { name: 'Pole', d: 'M 2 6 L 10 6 L 10 98 L 2 98 Z', color: WOOD_DARK },
      { name: 'Finial', d: circle(6, 6, 6), color: GOLD },
      {
        name: 'White stripes',
        // The whole field. The red stripes and the canton sew on top of it, so
        // the white is the base rather than four separate bands.
        d: 'M 10 14 C 34 6 62 22 94 14 L 94 78 C 62 86 34 70 10 78 Z',
        color: WHITE,
      },
      {
        name: 'Red stripes',
        // Sagging with the wave, which is what makes the cloth look like cloth.
        d:
          'M 10 14 C 34 6 62 22 94 14 L 94 23 C 62 31 34 15 10 23 Z ' +
          'M 10 32 C 34 24 62 40 94 32 L 94 41 C 62 49 34 33 10 41 Z ' +
          'M 10 50 C 34 42 62 58 94 50 L 94 59 C 62 67 34 51 10 59 Z ' +
          'M 10 68 C 34 60 62 76 94 68 L 94 77 C 62 85 34 69 10 77 Z',
        color: RED,
      },
      {
        name: 'Canton',
        // The stars are cut out of it rather than laid on top, so the white
        // field below shows through and no white sews over navy.
        d:
          'M 10 14 C 22 10 34 14 46 17 L 46 55 C 34 52 22 48 10 52 Z ' +
          `${star(19, 24, 5, 2, 5)} ${star(33, 27, 5, 2, 5)} ` +
          `${star(19, 38, 5, 2, 5)} ${star(33, 41, 5, 2, 5)} ` +
          `${star(26, 31, 5, 2, 5)} ${star(26, 45, 5, 2, 5)}`,
        color: NAVY,
      },
    ],
  },
  {
    id: 'patriotic-banner-star',
    name: 'Star banner',
    category: 'patriotic',
    keywords: ['rosette', 'award', 'ribbon', 'prize', 'july 4th'],
    parts: [
      {
        name: 'Ribbons',
        d: 'M 30 62 L 46 62 L 44 98 L 30 88 L 22 96 Z M 70 62 L 54 62 L 56 98 L 70 88 L 78 96 Z',
        color: RED,
      },
      { name: 'Rosette', d: circle(50, 38, 36), color: RED },
      // Both navy areas sew in one pass, then the white face last with the
      // star cut out of it, so the red beneath shows through as the star and
      // nothing sews on top of anything.
      { name: 'Ribbon folds', d: 'M 38 62 L 46 62 L 44 98 L 38 94 Z M 62 62 L 54 62 L 56 98 L 62 94 Z', color: NAVY },
      {
        name: 'Pleats',
        d:
          `${circle(50, 38, 36)} ${circle(50, 38, 28, false)} ` +
          'M 46 4 L 54 4 L 54 14 L 46 14 Z M 76 20 L 81 26 L 72 33 L 67 27 Z ' +
          'M 81 50 L 76 56 L 67 49 L 72 43 Z M 54 72 L 46 72 L 46 62 L 54 62 Z ' +
          'M 24 56 L 19 50 L 28 43 L 33 49 Z M 19 26 L 24 20 L 33 27 L 28 33 Z',
        color: NAVY,
      },
      { name: 'Face', d: `${circle(50, 38, 28)} ${star(50, 38, 22, 9, 5)}`, color: WHITE },
    ],
  },
  {
    id: 'patriotic-eagle',
    name: 'Eagle',
    category: 'patriotic',
    keywords: ['bald eagle', 'bird', 'america', 'wings', 'freedom'],
    parts: [
      {
        name: 'Wings',
        // Spread with separated primaries at the tips. The finger-like slots
        // are what say raptor rather than seagull.
        d:
          'M 50 42 C 40 34 28 30 16 30 L 22 38 L 8 36 L 14 44 L 2 46 L 12 52 ' +
          'C 24 56 36 58 46 62 Z ' +
          'M 50 42 C 60 34 72 30 84 30 L 78 38 L 92 36 L 86 44 L 98 46 L 88 52 ' +
          'C 76 56 64 58 54 62 Z',
        color: EAGLE_BROWN,
      },
      {
        name: 'Wing shading',
        // Warm dark rather than black: an eagle's wings are brown, and true
        // black beside the white head flattens the whole bird into a stencil.
        d: 'M 30 36 C 38 38 44 44 48 52 L 46 62 C 36 58 24 56 12 52 Z M 70 36 C 62 38 56 44 52 52 L 54 62 C 64 58 76 56 88 52 Z',
        color: EAGLE_BROWN_DARK,
      },
      {
        name: 'Body',
        d: 'M 50 38 C 58 38 62 46 62 58 C 62 74 56 88 50 96 C 44 88 38 74 38 58 C 38 46 42 38 50 38 Z',
        color: EAGLE_BROWN_DARK,
      },
      { name: 'Eyes', d: `${circle(43, 18, 3)} ${circle(57, 18, 3)}`, color: INK },
      // Tail and head are the same white and sew together.
      { name: 'Tail', d: 'M 42 84 L 58 84 L 62 98 L 38 98 Z', color: WHITE },
      { name: 'Head', d: `${ellipse(50, 22, 18, 20)} ${circle(43, 18, 3)} ${circle(57, 18, 3)}`, color: WHITE },
      { name: 'Beak', d: 'M 50 22 L 62 28 C 62 34 56 36 50 34 Z', color: GOLD },
    ],
  },
  {
    id: 'patriotic-torch',
    name: 'Torch',
    category: 'patriotic',
    keywords: ['liberty', 'flame', 'statue', 'freedom', 'light'],
    parts: [
      { name: 'Flame', d: flame(50, 2, 40), color: ORANGE },
      { name: 'Flame core', d: flame(50, 12, 28), color: YELLOW },
      { name: 'Flame heart', d: flame(50, 22, 16), color: YELLOW_LIGHT },
      { name: 'Bowl', d: 'M 30 42 L 70 42 L 64 58 L 36 58 Z', color: GOLD },
      { name: 'Handle', d: 'M 42 58 L 58 58 L 56 88 L 44 88 Z', color: GOLD },
      { name: 'Bowl rim', d: 'M 26 38 L 74 38 L 74 46 L 26 46 Z', color: GOLD_LIGHT },
      { name: 'Handle shading', d: 'M 50 58 L 58 58 L 56 88 L 50 88 Z', color: GOLD_DARK },
      { name: 'Base', d: 'M 36 86 L 64 86 L 68 98 L 32 98 Z', color: GOLD_DARK },
    ],
  },
  {
    id: 'patriotic-ribbon',
    name: 'Ribbon',
    category: 'patriotic',
    keywords: ['awareness', 'loop', 'support', 'cause', 'bow'],
    parts: [
      {
        name: 'Ribbon',
        d:
          'M 50 2 C 66 2 78 18 78 38 C 78 52 70 62 62 70 L 84 96 L 66 96 ' +
          'L 50 74 L 34 96 L 16 96 L 38 70 C 30 62 22 52 22 38 C 22 18 34 2 50 2 Z ' +
          'M 50 16 C 42 16 36 25 36 38 C 36 50 42 58 50 58 C 58 58 64 50 64 38 ' +
          'C 64 25 58 16 50 16 Z',
        color: RED,
      },
      {
        name: 'Crossing',
        // The stretch where the near tail passes over the far one; without it
        // the loop is a keyhole rather than a ribbon.
        d: 'M 38 70 L 50 74 L 44 84 L 32 80 Z',
        color: RED_LIGHT,
      },
      { name: 'Highlight', d: 'M 30 26 C 32 18 38 12 44 10 L 46 20 C 42 22 38 27 37 33 Z', color: RED_LIGHT },
    ],
  },
];
