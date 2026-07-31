import type { LibraryShape } from '../types.js';
import { circle, leaf, rect, roundRect } from './draw.js';
import {
  BLUE,
  CREAM,
  CREAM_DARK,
  GOLD,
  GOLD_DARK,
  GREEN,
  GREEN_DARK,
  GREEN_LIGHT,
  INK,
  ORANGE,
  RED,
  RED_LIGHT,
  SKY_LIGHT,
  WATER,
  WHITE,
  WOOD,
  WOOD_DARK,
  WOOD_LIGHT,
  YELLOW,
  YELLOW_DARK,
  YELLOW_LIGHT,
} from './palette.js';

/**
 * Summer.
 *
 * Three of these — the sun, the ball and the umbrella — are radial, and radial
 * shapes are the ones hand-authoring gets wrong: a ray or a panel that is two
 * degrees off is obvious in a way a wobbly leaf never is. They are generated
 * from angles here and emitted as ordinary path data, so what ships is still a
 * `d` string that any SVG editor can open.
 */

function n(value: number): string {
  return String(+value.toFixed(2));
}

/** Triangular rays around a hub, bases tucked under the disc that covers them. */
function rays(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  count: number,
  spread: number,
): string {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const [l, r] = [a - spread, a + spread];
    out.push(
      `M ${n(cx + Math.cos(l) * inner)} ${n(cy + Math.sin(l) * inner)} ` +
        `L ${n(cx + Math.cos(a) * outer)} ${n(cy + Math.sin(a) * outer)} ` +
        `L ${n(cx + Math.cos(r) * inner)} ${n(cy + Math.sin(r) * inner)} Z`,
    );
  }
  return out.join(' ');
}

/**
 * Bands crossing the curved edge of a half-ellipse — the stripes on a
 * watermelon rind. Each band is a quad between two nearby angles, so the
 * stripes stay square to the rind instead of leaning as they round the bottom.
 */
function rindStripes(angles: readonly number[]): string {
  const [cx, cy] = [50, 20];
  const at = (a: number, rx: number, ry: number): string =>
    `${n(cx + Math.cos(a) * rx)} ${n(cy + Math.sin(a) * ry)}`;
  const w = 0.1;
  return angles
    .map(
      (a) =>
        `M ${at(a - w, 48, 76)} L ${at(a + w, 48, 76)} ` +
        `L ${at(a + w, 42, 69)} L ${at(a - w, 42, 69)} Z`,
    )
    .join(' ');
}

/** A diamond, which is all the pineapple's rind texture is. */
function diamond(cx: number, cy: number, w: number, h: number): string {
  return `M ${n(cx)} ${n(cy - h)} L ${n(cx + w)} ${n(cy)} L ${n(cx)} ${n(cy + h)} L ${n(cx - w)} ${n(cy)} Z`;
}

/**
 * One panel of a beach ball, between two meridians. `f` runs −1 (left edge of
 * the sphere) to +1 (right edge); scaling the circle's own control points by it
 * is what makes the seams bulge like a sphere rather than close like a lens.
 */
function ballPanel(f1: number, f2: number): string {
  const x = (f: number, k: number): string => n(50 + 48 * f * k);
  return (
    `M 50 2 ` +
    `C ${x(f1, 0.552)} 2 ${x(f1, 1)} 23.5 ${x(f1, 1)} 50 ` +
    `C ${x(f1, 1)} 76.5 ${x(f1, 0.552)} 98 50 98 ` +
    `C ${x(f2, 0.552)} 98 ${x(f2, 1)} 76.5 ${x(f2, 1)} 50 ` +
    `C ${x(f2, 1)} 23.5 ${x(f2, 0.552)} 2 50 2 Z`
  );
}

const WAFFLE = [
  ...[36, 50, 64].map((x) => diamond(x, 68, 4.5, 5)),
  ...[43, 57].map((x) => diamond(x, 78, 4.5, 5)),
  diamond(50, 88, 4.5, 5),
].join(' ');

const PINEAPPLE_LATTICE = [
  ...[40, 50, 60].map((x) => diamond(x, 44, 5, 6)),
  ...[35, 45, 55, 65].map((x) => diamond(x, 56, 5, 6)),
  ...[30, 40, 50, 60, 70].map((x) => diamond(x, 68, 5, 6)),
  ...[35, 45, 55, 65].map((x) => diamond(x, 80, 5, 6)),
  ...[40, 50, 60].map((x) => diamond(x, 92, 5, 6)),
].join(' ');

export const SUMMER_SHAPES: LibraryShape[] = [
  {
    id: 'summer-sun',
    name: 'Sun',
    category: 'summer',
    keywords: ['sunshine', 'hot', 'weather', 'rays', 'summer'],
    parts: [
      { name: 'Rays', d: rays(50, 50, 32, 49, 12, 0.14), color: ORANGE },
      { name: 'Disc', d: circle(50, 50, 34), color: YELLOW },
      {
        name: 'Shading',
        // A crescent along the underside rather than a smaller disc in the
        // middle: a concentric ring reads as a target, a crescent reads as a
        // sphere lit from above.
        d: 'M 16 50 C 16 68.78 31.22 84 50 84 C 68.78 84 84 68.78 84 50 C 76 74 24 74 16 50 Z',
        color: YELLOW_DARK,
      },
      {
        name: 'Highlight',
        d: 'M 16 50 C 16 31.22 31.22 16 50 16 C 68.78 16 84 31.22 84 50 C 76 26 24 26 16 50 Z',
        color: YELLOW_LIGHT,
      },
    ],
  },
  {
    id: 'summer-sunglasses',
    name: 'Sunglasses',
    category: 'summer',
    keywords: ['shades', 'beach', 'cool', 'glasses'],
    parts: [
      {
        name: 'Frame',
        // One closed loop: brow bar, down and around the right lens, back
        // under the bridge, around the left. The glass is cut out of it as
        // counter-rings, so the lenses sew into holes instead of on top of
        // the frame and the rim stays an even width all the way round.
        d:
          'M 2 26 L 98 26 L 98 36 ' +
          'C 98 60 86 76 68 76 C 56 76 50 62 52 40 L 48 40 ' +
          'C 50 62 44 76 32 76 C 14 76 2 60 2 36 Z ' +
          'M 8 34 L 42 34 C 44 56 40 70 30 70 C 18 70 7 56 8 34 Z ' +
          'M 92 34 L 58 34 C 56 56 60 70 70 70 C 82 70 93 56 92 34 Z',
        color: INK,
      },
      {
        name: 'Lenses',
        d:
          'M 8 34 L 42 34 C 44 56 40 70 30 70 C 18 70 7 56 8 34 Z ' +
          'M 92 34 L 58 34 C 56 56 60 70 70 70 C 82 70 93 56 92 34 Z',
        color: WATER,
      },
      {
        name: 'Glint',
        d: 'M 16 38 L 24 38 L 16 56 L 11 50 Z M 84 38 L 76 38 L 84 56 L 89 50 Z',
        color: SKY_LIGHT,
      },
    ],
  },
  {
    id: 'summer-flip-flop',
    name: 'Flip-flop',
    category: 'summer',
    keywords: ['sandal', 'beach', 'thong', 'shoe'],
    parts: [
      {
        // Waisted at the arch. An unwaisted sole is an oval, and an oval with
        // a Y on it is a balloon with a string.
        name: 'Sole',
        d:
          'M 50 2 C 64 2 74 12 74 26 C 74 37 71 46 70 55 C 69 63 69 68 70 75 ' +
          'C 71 85 64 98 50 98 C 36 98 29 85 30 75 C 31 68 31 63 30 55 ' +
          'C 29 46 26 37 26 26 C 26 12 36 2 50 2 Z',
        color: CREAM_DARK,
      },
      {
        name: 'Footbed',
        d:
          'M 50 5 C 62 5 71 14 71 26 C 71 36 68 46 67 55 C 66 63 66 68 67 75 ' +
          'C 68 83 62 95 50 95 C 38 95 32 83 33 75 C 34 68 34 63 33 55 ' +
          'C 32 46 29 36 29 26 C 29 14 38 5 50 5 Z',
        color: CREAM,
      },
      {
        name: 'Straps',
        // The V and the toe post are one loop, not two overlapping ones —
        // where they cross would otherwise sew twice. The arms run all the way
        // out to the edge of the sole, because that is where they are riveted.
        d: 'M 45 40 L 28 20 L 34 12 L 50 30 L 66 12 L 72 20 L 55 40 L 54 54 L 46 54 Z',
        color: RED,
      },
      {
        name: 'Strap highlight',
        d: 'M 32 20 L 36 15 L 48 29 L 46 33 Z M 68 20 L 64 15 L 52 29 L 54 33 Z',
        color: RED_LIGHT,
      },
    ],
  },
  {
    id: 'summer-ice-cream',
    name: 'Ice cream cone',
    category: 'summer',
    keywords: ['cone', 'gelato', 'dessert', 'sweet', 'summer'],
    parts: [
      { name: 'Cone', d: 'M 22 60 L 78 60 L 54 94 C 53 97 47 97 46 94 Z', color: WOOD_LIGHT },
      { name: 'Waffle', d: WAFFLE, color: WOOD_DARK },
      {
        name: 'Swirl',
        // Soft serve rather than a ball on a cone: three tiers stepping in as
        // they rise is what the eye reads as ice cream at 40 mm.
        d:
          'M 50 18 C 57 18 60 24 57 28 C 68 28 72 36 67 41 C 78 41 82 51 74 56 ' +
          'C 82 57 82 60 76 60 L 24 60 C 18 60 18 57 26 56 C 18 51 22 41 33 41 ' +
          'C 28 36 32 28 43 28 C 40 24 43 18 50 18 Z',
        color: CREAM,
      },
      {
        name: 'Swirl shading',
        d:
          'M 57 28 C 68 28 72 36 67 41 L 60 41 C 64 37 63 31 55 29 Z ' +
          'M 67 41 C 78 41 82 51 74 56 L 66 56 C 71 51 71 45 63 42 Z',
        color: CREAM_DARK,
      },
      { name: 'Stem', d: 'M 49 11 C 50 6 52 3 57 2 L 59 5 C 55 6 53 9 53 13 Z', color: GREEN_DARK },
      { name: 'Cherry', d: circle(48, 15, 9), color: RED },
      { name: 'Cherry gloss', d: circle(45, 12, 3), color: RED_LIGHT },
    ],
  },
  {
    id: 'summer-popsicle',
    name: 'Popsicle',
    category: 'summer',
    keywords: ['ice lolly', 'frozen', 'treat', 'summer'],
    parts: [
      // Stick first so the ice sews over its top rather than the other way
      // round — a stick that stops short of the ice leaves a visible seam.
      { name: 'Stick', d: 'M 42 66 L 58 66 L 58 92 C 58 97 42 97 42 92 Z', color: WOOD_LIGHT },
      { name: 'Stick shading', d: 'M 50 66 L 58 66 L 58 92 C 58 96 54 97 50 97 Z', color: WOOD_DARK },
      { name: 'Ice', d: roundRect(24, 4, 52, 66, 12), color: RED },
      // The bands stop at the straight part of the sides, so neither has to
      // repeat the corner curve and neither can drift off the edge.
      { name: 'Middle band', d: rect(24, 26, 52, 18), color: WHITE },
      {
        name: 'Bottom band',
        d: 'M 24 46 L 76 46 L 76 58 C 76 64.63 70.63 70 64 70 L 36 70 C 29.37 70 24 64.63 24 58 Z',
        color: BLUE,
      },
    ],
  },
  {
    id: 'summer-watermelon',
    name: 'Watermelon',
    category: 'summer',
    keywords: ['fruit', 'slice', 'picnic', 'summer'],
    parts: [
      // Rind, pith and flesh all reach the cut edge along the top. Insetting
      // the flesh from that edge — which the old drawing did — puts green
      // where the knife went, which no melon does.
      {
        name: 'Rind',
        d: 'M 2 20 L 98 20 C 98 62 76 96 50 96 C 24 96 2 62 2 20 Z',
        color: GREEN_DARK,
      },
      {
        name: 'Stripes',
        d: rindStripes([0.32, 0.72, 1.12, 1.52, 1.92, 2.32, 2.72]),
        color: GREEN_LIGHT,
      },
      { name: 'Pith', d: 'M 8 20 L 92 20 C 92 60 72 89 50 89 C 28 89 8 60 8 20 Z', color: CREAM },
      { name: 'Flesh', d: 'M 14 20 L 86 20 C 86 57 68 82 50 82 C 32 82 14 57 14 20 Z', color: RED },
      {
        name: 'Seeds',
        d: [
          leaf(32, 40, 7, 12),
          leaf(50, 38, 7, 12),
          leaf(68, 40, 7, 12),
          leaf(40, 58, 7, 12),
          leaf(60, 58, 7, 12),
          leaf(50, 62, 6, 11),
        ].join(' '),
        color: INK,
      },
    ],
  },
  {
    id: 'summer-beach-ball',
    name: 'Beach ball',
    category: 'summer',
    keywords: ['ball', 'play', 'pool', 'toy'],
    parts: [
      { name: 'Ball', d: circle(50, 50, 48), color: WHITE },
      { name: 'Red panel', d: ballPanel(-2 / 3, -1 / 3), color: RED },
      { name: 'Blue panel', d: ballPanel(0, 1 / 3), color: BLUE },
      { name: 'Yellow panel', d: ballPanel(2 / 3, 1), color: YELLOW },
    ],
  },
  {
    id: 'summer-umbrella',
    name: 'Beach umbrella',
    category: 'summer',
    keywords: ['parasol', 'shade', 'rain', 'beach'],
    parts: [
      // Pole first, canopy over it: the join then needs no seam at all.
      {
        name: 'Pole',
        d: 'M 46 8 L 46 6 C 46 2 54 2 54 6 L 54 8 L 54 88 L 50 98 L 46 88 Z',
        color: WOOD,
      },
      { name: 'Pole shading', d: 'M 50 3 C 53 3 54 4 54 7 L 54 88 L 50 98 Z', color: WOOD_DARK },
      {
        name: 'Canopy',
        d:
          'M 2 58 C 2 30 24 8 50 8 C 76 8 98 30 98 58 ' +
          'C 96 48 84 48 82 58 C 80 48 68 48 66 58 C 64 48 52 48 50 58 ' +
          'C 48 48 36 48 34 58 C 32 48 20 48 18 58 C 16 48 4 48 2 58 Z',
        color: CREAM,
      },
      {
        name: 'Panels',
        // Alternate segments only, each bounded by the same ribs and scallops
        // the canopy already uses, so the two never disagree along an edge.
        d:
          'M 50 8 C 40 16 26 34 18 58 C 20 48 32 48 34 58 C 38 32 44 16 50 8 Z ' +
          'M 50 8 L 50 58 C 52 48 64 48 66 58 C 62 32 56 16 50 8 Z ' +
          'M 50 8 C 60 16 74 34 82 58 C 84 48 96 48 98 58 C 98 30 76 8 50 8 Z',
        color: RED,
      },
    ],
  },
  {
    id: 'summer-pineapple',
    name: 'Pineapple',
    category: 'summer',
    keywords: ['fruit', 'tropical', 'ananas', 'summer'],
    parts: [
      {
        name: 'Back leaves',
        d:
          'M 20 16 C 30 18 38 24 41 33 L 32 33 C 26 30 20 24 20 16 Z ' +
          'M 80 16 C 80 24 74 30 68 33 L 59 33 C 62 24 70 18 80 16 Z',
        color: GREEN_DARK,
      },
      {
        name: 'Crown',
        d:
          'M 50 2 C 55 12 57 21 55 32 L 45 32 C 43 21 45 12 50 2 Z ' +
          'M 33 6 C 42 12 47 21 47 32 L 38 32 C 33 25 30 14 33 6 Z ' +
          'M 67 6 C 70 14 67 25 62 32 L 53 32 C 53 21 58 12 67 6 Z',
        color: GREEN,
      },
      {
        name: 'Body',
        d:
          'M 50 28 C 68 28 80 44 80 64 C 80 84 68 98 50 98 ' +
          'C 32 98 20 84 20 64 C 20 44 32 28 50 28 Z',
        color: GOLD,
      },
      // Separate diamonds, not a lattice cut out of the body: cutting them out
      // would leave the rind as holes, and a pineapple sewn full of holes is
      // a pineapple you can see the shirt through.
      { name: 'Rind', d: PINEAPPLE_LATTICE, color: GOLD_DARK },
    ],
  },
];
