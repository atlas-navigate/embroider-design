import type { LibraryShape } from '../types.js';
import {
  BLUSH,
  CREAM,
  CREAM_DARK,
  GLASS,
  GOLD,
  GOLD_DARK,
  GOLD_LIGHT,
  GREEN,
  GREEN_DARK,
  ICE,
  ICE_LIGHT,
  INK_SOFT,
  ORANGE,
  PINK,
  PINK_DARK,
  RED,
  SILVER_LIGHT,
  WHITE,
  WOOD,
  YELLOW_LIGHT,
} from './palette.js';

/**
 * Wedding.
 *
 * The interlocking rings are two separate parts, and that is not a stylistic
 * choice. In one part, the left ring's inner circle sits inside *both* its own
 * outer circle and the right ring's — nesting depth two, which the region
 * grouper correctly reads as a filled island, and the hole in the left ring
 * would stitch solid. Two parts, two independent nestings, no ambiguity.
 *
 * A third part then re-draws the short stretch of the left band that crosses in
 * front of the right one. Without it the rings merely overlap; with it they
 * interlock, which is the whole point of the symbol.
 */

/** Circle drawn as four cubics. 0.5523 is the standard quarter-arc constant. */
const K = 0.5523;

function circle(cx: number, cy: number, r: number, clockwise = true): string {
  const k = +(r * K).toFixed(2);
  const round = (n: number): string => String(+n.toFixed(2));
  const [x, y] = [round(cx), round(cy)];
  const [l, t, b, right] = [round(cx - r), round(cy - r), round(cy + r), round(cx + r)];
  const [kl, kr, kt, kb] = [round(cx - k), round(cx + k), round(cy - k), round(cy + k)];
  return clockwise
    ? `M ${x} ${t} C ${kr} ${t} ${right} ${kt} ${right} ${y} ` +
        `C ${right} ${kb} ${kr} ${b} ${x} ${b} ` +
        `C ${kl} ${b} ${l} ${kb} ${l} ${y} ` +
        `C ${l} ${kt} ${kl} ${t} ${x} ${t} Z`
    : `M ${x} ${t} C ${kl} ${t} ${l} ${kt} ${l} ${y} ` +
        `C ${l} ${kb} ${kl} ${b} ${x} ${b} ` +
        `C ${kr} ${b} ${right} ${kb} ${right} ${y} ` +
        `C ${right} ${kt} ${kr} ${t} ${x} ${t} Z`;
}

/** An annulus: outer ring, then a counter-ring the grouper reads as the hole. */
function band(cx: number, cy: number, outer: number, inner: number): string {
  return `${circle(cx, cy, outer, true)} ${circle(cx, cy, inner, false)}`;
}

export const WEDDING_SHAPES: LibraryShape[] = [
  {
    id: 'wedding-diamond-ring',
    name: 'Diamond ring',
    category: 'wedding',
    keywords: ['engagement', 'proposal', 'gem', 'jewel', 'solitaire', 'brilliant', 'stone'],
    parts: [
      { name: 'Band', d: band(50, 74, 24, 16), color: GOLD },
      {
        name: 'Setting',
        // The basket the stone sits in, and the two claws that grip its girdle.
        d:
          'M 41 41 L 59 41 L 56 57 L 44 57 Z ' +
          'M 24 23 L 31 21 L 33 35 L 26 36 Z ' +
          'M 76 23 L 69 21 L 67 35 L 74 36 Z',
        color: GOLD_DARK,
      },
      {
        name: 'Stone',
        // A round brilliant seen face on: table across the top, crown sloping
        // out to the girdle, pavilion tapering to the culet.
        d: 'M 36 6 L 64 6 L 76 24 L 50 52 L 24 24 Z',
        color: ICE,
      },
      {
        name: 'Facets',
        d:
          'M 36 6 L 64 6 L 58 20 L 42 20 Z ' +
          'M 24 24 L 36 24 L 50 52 Z ' +
          'M 76 24 L 64 24 L 50 52 Z',
        color: ICE_LIGHT,
      },
      {
        name: 'Highlights',
        // One spark on the table, one on the inside curve of the band — the two
        // places light actually lands on a ring worn face on.
        d:
          'M 40 9 L 47 9 L 45 17 L 38 17 Z ' +
          'M 32 62 C 35 58 39 55 44 54 L 46 60 C 42 61 39 64 37 67 Z',
        color: GOLD_LIGHT,
      },
    ],
  },
  {
    id: 'wedding-band',
    name: 'Wedding band',
    category: 'wedding',
    keywords: ['ring', 'plain', 'gold', 'marriage', 'vow', 'no stone'],
    parts: [
      {
        name: 'Band',
        // Slightly taller than wide: a ring lying face on is a circle, and a
        // ring standing up is an ellipse. The ellipse reads as an object.
        d:
          'M 50 6 C 72.09 6 90 27.7 90 52 C 90 76.3 72.09 98 50 98 ' +
          'C 27.91 98 10 76.3 10 52 C 10 27.7 27.91 6 50 6 Z ' +
          'M 50 20 C 34.54 20 22 34.33 22 52 C 22 69.67 34.54 84 50 84 ' +
          'C 65.46 84 78 69.67 78 52 C 78 34.33 65.46 20 50 20 Z',
        color: GOLD,
      },
      {
        name: 'Shadow',
        // The far side of the band, where the metal turns away from the light.
        d: 'M 78 40 C 80 47 80 58 78 66 L 87 70 C 90 60 90 44 87 34 Z',
        color: GOLD_DARK,
      },
      {
        name: 'Shine',
        d:
          'M 16 40 C 20 27 30 15 43 11 L 47 22 C 37 26 29 35 26 45 Z ' +
          'M 58 88 C 65 86 71 82 76 76 L 83 82 C 77 89 69 94 60 96 Z',
        color: GOLD_LIGHT,
      },
    ],
  },
  {
    id: 'wedding-rings',
    name: 'Wedding rings',
    category: 'wedding',
    keywords: ['marriage', 'engaged', 'gold', 'bands', 'interlocking', 'pair', 'two rings'],
    parts: [
      { name: 'Left ring', d: band(36, 56, 32, 23), color: GOLD },
      { name: 'Right ring', d: band(64, 56, 32, 23), color: GOLD_DARK },
      {
        name: 'Interlock',
        // The stretch of the left band that passes in front of the right one.
        // Sewn last and in the lit tone rather than the left ring's own gold:
        // it has to come after the right ring to read as crossing over it, and
        // a third pass of the same gold would mean rethreading the same spool.
        // A highlight along the crossing is what a photographed pair shows
        // anyway.
        d: 'M 54.4 29.8 L 62.2 37.6 L 54.8 42.8 L 49.2 37.2 Z',
        color: GOLD_LIGHT,
      },
      {
        name: 'Shine',
        d: 'M 10 46 C 12 36 18 28 27 24 L 31 33 C 25 36 21 42 19 49 Z',
        color: GOLD_LIGHT,
      },
    ],
  },
  {
    id: 'wedding-bells',
    name: 'Wedding bells',
    category: 'wedding',
    keywords: ['bells', 'ring', 'chime', 'celebrate'],
    parts: [
      {
        name: 'Left bell',
        d:
          'M 28 8 C 30.8 8 33 10.2 33 13 C 33 14 32.8 14.9 32.4 15.7 ' +
          'C 43 19.5 50 30 50 44 C 50 56 52 64 57 69 L 0 69 ' +
          'C 5 64 7 56 7 44 C 7 30 13 19.5 23.6 15.7 ' +
          'C 23.2 14.9 23 14 23 13 C 23 10.2 25.2 8 28 8 Z',
        color: GOLD,
      },
      {
        name: 'Right bell',
        d:
          'M 72 22 C 74.8 22 77 24.2 77 27 C 77 28 76.8 28.9 76.4 29.7 ' +
          'C 87 33.5 93 44 93 58 C 93 70 95 78 100 83 L 43 83 ' +
          'C 48 78 50 70 50 58 C 50 44 57 33.5 67.6 29.7 ' +
          'C 67.2 28.9 67 28 67 27 C 67 24.2 69.2 22 72 22 Z',
        color: GOLD,
      },
      // Both rims and the clappers sew in one dark-gold run, after both bells.
      { name: 'Left rim', d: 'M 0 69 L 57 69 L 57 76 L 0 76 Z', color: GOLD_DARK },
      { name: 'Right rim', d: 'M 43 83 L 100 83 L 100 90 L 43 90 Z', color: GOLD_DARK },
      {
        name: 'Clappers',
        d: `${circle(28, 82, 6)} ${circle(72, 94, 6)}`,
        color: GOLD_DARK,
      },
      {
        name: 'Shine',
        d: 'M 14 40 C 16 30 20 23 26 20 L 29 27 C 25 30 22 36 21 43 Z',
        color: GOLD_LIGHT,
      },
    ],
  },
  {
    id: 'wedding-dove',
    name: 'Dove',
    category: 'wedding',
    keywords: ['bird', 'peace', 'white', 'flying', 'olive'],
    parts: [
      {
        name: 'Body',
        // Head, breast, back and a fanned tail, drawn as one silhouette so the
        // bird has a single clean outline to satin around.
        d:
          'M 82 22 C 88 22 92 26 92 32 C 92 34 91.5 36 90.5 37.5 ' +
          'L 99 40 L 89 44 C 88 58 80 70 68 76 ' +
          'C 60 80 50 82 40 82 L 12 88 L 26 74 L 4 76 L 22 62 ' +
          'C 24 46 34 34 48 30 C 58 27 68 26 74 26 C 76 23 79 22 82 22 Z',
        color: WHITE,
      },
      {
        name: 'Wing',
        d:
          'M 40 30 C 52 26 64 30 70 40 C 66 52 54 60 40 58 ' +
          'C 32 56 28 48 30 40 C 32 34 36 31 40 30 Z',
        color: CREAM,
      },
      { name: 'Wing edge', d: 'M 44 54 C 54 56 63 50 68 42 L 70 46 C 64 56 54 62 42 60 Z', color: CREAM_DARK },
      { name: 'Beak', d: 'M 90.5 37.5 L 100 39 L 89 44 Z', color: ORANGE },
      { name: 'Eye', d: circle(83, 30, 3), color: INK_SOFT },
    ],
  },
  {
    id: 'wedding-cake',
    name: 'Wedding cake',
    category: 'wedding',
    keywords: ['tiers', 'celebrate', 'dessert', 'reception'],
    parts: [
      { name: 'Bottom tier', d: 'M 10 74 L 90 74 L 90 96 L 10 96 Z', color: CREAM },
      { name: 'Middle tier', d: 'M 22 50 L 78 50 L 78 72 L 22 72 Z', color: CREAM },
      { name: 'Top tier', d: 'M 33 28 L 67 28 L 67 48 L 33 48 Z', color: CREAM },
      {
        name: 'Shading',
        d: 'M 74 74 L 90 74 L 90 96 L 74 96 Z M 66 50 L 78 50 L 78 72 L 66 72 Z M 59 28 L 67 28 L 67 48 L 59 48 Z',
        color: CREAM_DARK,
      },
      {
        name: 'Icing',
        // Scalloped piping along the top of each tier, the detail that makes a
        // stack of rectangles read as a cake.
        d:
          'M 10 74 C 18 82 26 68 34 74 C 42 80 50 68 58 74 C 66 80 76 68 90 74 L 90 79 L 10 79 Z ' +
          'M 22 50 C 30 57 38 45 46 50 C 54 55 62 45 78 50 L 78 55 L 22 55 Z ' +
          'M 33 28 C 40 34 47 24 54 28 C 60 31 64 26 67 28 L 67 33 L 33 33 Z',
        color: PINK,
      },
      { name: 'Ribbons', d: 'M 46 79 L 54 79 L 54 96 L 46 96 Z M 46 55 L 54 55 L 54 72 L 46 72 Z', color: PINK_DARK },
      {
        name: 'Topper',
        d: 'M 50 24 C 41 16 36 11 36 6 C 36 2.5 38.5 0 42 0 C 45 0 48 2 50 5 C 52 2 55 0 58 0 C 61.5 0 64 2.5 64 6 C 64 11 59 16 50 24 Z',
        color: RED,
      },
    ],
  },
  {
    id: 'wedding-flutes',
    name: 'Champagne flutes',
    category: 'wedding',
    keywords: ['toast', 'glasses', 'celebrate', 'cheers', 'drink'],
    parts: [
      {
        name: 'Left flute',
        d:
          'M 4 4 L 42 4 L 36 40 C 35 47 31 51 27 53 L 27 88 L 39 88 ' +
          'C 41 88 42 89 42 91 C 42 93 41 94 39 94 L 7 94 C 5 94 4 93 4 91 ' +
          'C 4 89 5 88 7 88 L 19 88 L 19 53 C 15 51 11 47 10 40 Z',
        color: GLASS,
      },
      {
        name: 'Right flute',
        d:
          'M 58 4 L 96 4 L 90 40 C 89 47 85 51 81 53 L 81 88 L 93 88 ' +
          'C 95 88 96 89 96 91 C 96 93 95 94 93 94 L 61 94 C 59 94 58 93 58 91 ' +
          'C 58 89 59 88 61 88 L 73 88 L 73 53 L 73 53 C 69 51 65 47 64 40 Z',
        color: GLASS,
      },
      {
        name: 'Champagne',
        d: 'M 8 18 L 38 18 L 34 40 C 33 46 29 49 23 49 C 17 49 13 46 12 40 Z ' +
          'M 62 18 L 92 18 L 88 40 C 87 46 83 49 77 49 C 71 49 67 46 66 40 Z',
        color: YELLOW_LIGHT,
      },
      {
        name: 'Bubbles',
        d: `${circle(20, 26, 3.5)} ${circle(28, 35, 2.5)} ${circle(24, 42, 2)} ${circle(80, 26, 3.5)} ${circle(72, 35, 2.5)} ${circle(76, 42, 2)}`,
        color: SILVER_LIGHT,
      },
    ],
  },
  {
    id: 'wedding-bouquet',
    name: 'Bouquet',
    category: 'wedding',
    keywords: ['flowers', 'bride', 'posy', 'roses'],
    parts: [
      {
        name: 'Leaves',
        d:
          'M 50 50 C 34 50 20 42 10 28 C 26 24 42 32 52 48 Z ' +
          'M 50 50 C 66 50 80 42 90 28 C 74 24 58 32 48 48 Z ' +
          'M 50 54 C 42 50 36 42 34 32 C 42 36 48 44 50 52 Z ' +
          'M 50 54 C 58 50 64 42 66 32 C 58 36 52 44 50 52 Z',
        color: GREEN,
      },
      {
        name: 'Roses',
        d: `${circle(28, 30, 15)} ${circle(72, 30, 15)} ${circle(50, 18, 16)} ${circle(38, 46, 12)} ${circle(62, 46, 12)}`,
        color: PINK,
      },
      {
        name: 'Rose centres',
        d: `${circle(28, 30, 6)} ${circle(72, 30, 6)} ${circle(50, 18, 6.5)} ${circle(38, 46, 5)} ${circle(62, 46, 5)}`,
        color: PINK_DARK,
      },
      { name: 'Stems', d: 'M 44 56 L 56 56 L 58 84 L 42 84 Z', color: GREEN_DARK },
      {
        name: 'Ribbon',
        d: 'M 40 82 L 60 82 L 62 92 C 62 97 57 100 50 100 C 43 100 38 97 38 92 Z',
        color: BLUSH,
      },
    ],
  },
  {
    id: 'wedding-arch',
    name: 'Wedding arch',
    category: 'wedding',
    keywords: ['ceremony', 'gate', 'altar', 'flowers'],
    parts: [
      {
        name: 'Arch',
        d:
          'M 8 100 L 8 42 C 8 20 27 2 50 2 C 73 2 92 20 92 42 L 92 100 L 76 100 ' +
          'L 76 42 C 76 28 64 17 50 17 C 36 17 24 28 24 42 L 24 100 Z',
        color: WOOD,
      },
      {
        name: 'Greenery',
        d:
          'M 12 30 C 16 20 24 12 34 8 L 38 16 C 30 20 23 27 20 35 Z ' +
          'M 88 30 C 84 20 76 12 66 8 L 62 16 C 70 20 77 27 80 35 Z ' +
          'M 8 62 C 12 60 16 61 18 64 L 12 72 C 9 70 8 66 8 62 Z ' +
          'M 92 62 C 88 60 84 61 82 64 L 88 72 C 91 70 92 66 92 62 Z',
        color: GREEN_DARK,
      },
      {
        name: 'Flowers',
        d: `${circle(20, 26, 8)} ${circle(80, 26, 8)} ${circle(50, 10, 9)} ${circle(34, 15, 7)} ${circle(66, 15, 7)} ${circle(11, 70, 6)} ${circle(89, 70, 6)}`,
        color: PINK,
      },
      {
        name: 'Flower centres',
        d: `${circle(20, 26, 3)} ${circle(80, 26, 3)} ${circle(50, 10, 3.5)} ${circle(34, 15, 2.5)} ${circle(66, 15, 2.5)}`,
        color: PINK_DARK,
      },
    ],
  },
];
