import type { LibraryShape } from '../types.js';
import { blob, circle, scallop, smoothClosed } from './draw.js';
import { highlight, taper, veins } from './detail.js';
import {
  KEYLINE,
  circleBand,
  polyPath,
  strokeBand,
  taperBand,
} from './keyline.js';
import { cuteFace } from './face.js';
import {
  BROWN,
  COPPER,
  CREAM,
  FUR,
  FUR_DARK,
  GOLD,
  OLIVE,
  ORANGE,
  ORANGE_DARK,
  ORANGE_LIGHT,
  OUTLINE,
  RED,
  RED_DARK,
  WHITE,
  WOOD,
  WOOD_DARK,
  YELLOW,
  YELLOW_DARK,
} from './palette.js';

/**
 * Autumn and Thanksgiving — the first category redrawn to the keylined style.
 *
 * Leaves live or die on their lobes and their stalk. A maple leaf is five lobes
 * with deep notches between them and a stalk longer than you expect; an oak is
 * round-lobed with shallow bays. Blur either into a rosette and you get the same
 * anonymous autumn shape twice.
 *
 * Every silhouette here is a point array rather than a hand-typed path, because
 * the same array has to serve twice: `smoothClosed` or `polyPath` makes the
 * fill, and `strokeBand(..., { align: 'inside' })` makes the keyline that
 * traces it. Typing the outline separately is how a keyline ends up a quarter
 * of a unit off its own shape, which at an inch reads as a blurred edge.
 *
 * See `keyline.ts` for the house rules. The one that bites here is the last:
 * interior detail must stay clear of the band, or it bridges the cavity and the
 * outline stitches solid.
 */

/** Five lobes, deep notches, long stalk. */
const MAPLE: [number, number][] = [
  [50, 5],
  [58, 22],
  [69, 16],
  [65, 33],
  [82, 27],
  [73, 41],
  [94, 41],
  [80, 52],
  [92, 62],
  [72, 66],
  [79, 80],
  [59, 73],
  [55, 86],
  [50, 77],
  [45, 86],
  [41, 73],
  [21, 80],
  [28, 66],
  [8, 62],
  [20, 52],
  [6, 41],
  [27, 41],
  [18, 27],
  [35, 33],
  [31, 16],
  [42, 22],
];

/** Round lobes and shallow bays, deliberately unlike the maple's spikes. */
const OAK: [number, number][] = [
  // Starts at 6 rather than 4: `smoothClosed` passes through its points but
  // overshoots slightly between them, and at 4 the tip broke the authoring box.
  [50, 6],
  [60, 11],
  [61, 20],
  [72, 19],
  [76, 29],
  [88, 32],
  [87, 43],
  [96, 50],
  [86, 59],
  [90, 70],
  [78, 73],
  [76, 83],
  [64, 81],
  [57, 89],
  [50, 82],
  [43, 89],
  [36, 81],
  [24, 83],
  [22, 73],
  [10, 70],
  [14, 59],
  [4, 50],
  [13, 43],
  [12, 32],
  [24, 29],
  [28, 19],
  [39, 20],
  [40, 10],
];

/**
 * The acorn's cap: a dome that cups the nut.
 *
 * Closed, with the rim as the edge from the last point back to the first.
 * Drawn as a flat ellipse it read as a beret balanced on a chestnut — the cap
 * has to have height, and it has to overhang.
 */
const CAP: [number, number][] = [
  [86, 44],
  [86, 30],
  [80, 18],
  [66, 10],
  [50, 8],
  [34, 10],
  [20, 18],
  [14, 30],
  [14, 44],
];

/** The pie wedge: point at the top, crust wall along the bottom. */
const PIE: [number, number][] = [
  [50, 12],
  [92, 72],
  [94, 78],
  [90, 84],
  [10, 84],
  [6, 78],
  [8, 72],
];

/**
 * The horn: mouth facing up and to the right, tapering down-left to a hooked
 * tip. The hook is the whole shape — a straight taper reads as a megaphone.
 *
 * The mouth is the closing edge, from the last point back to the first. That
 * matters for the keyline, which is drawn as an *open* ribbon over this list
 * and so leaves the mouth unoutlined — which is right, because the fruit sits
 * in front of it.
 */
const HORN: [number, number][] = [
  [66, 14],
  [48, 14],
  [32, 22],
  [20, 38],
  [14, 58],
  [14, 76],
  [22, 88],
  [34, 86],
  [40, 74],
  [46, 62],
  [56, 58],
  [66, 66],
];

/**
 * The horn's outline, pulled back from the mouth at both ends.
 *
 * The fill still runs flush to the pile so there is no gap to see, but the
 * ribbon stops short: an end cap landing on the pile's band merges with it, and
 * the union closes the pile's cavity — the whole spill then stitches solid.
 */
const HORN_EDGE: [number, number][] = [[61, 14], ...HORN.slice(1, -1), [62, 63]];

/**
 * The spill of fruit, as one silhouette starting at the horn's mouth.
 *
 * Outlining each fruit separately was the obvious thing and it was wrong twice
 * over. Two round keylines that cross union into a pocket the compiler stitches
 * as an extra hole; and keeping them far enough apart not to cross left the
 * fruit as loose dots beside a brown sausage, with nothing to say they had come
 * out of the horn. One outline round the whole pile fixes both, and is how a
 * commercial design does it — the individual fruit are colour, not shape.
 *
 * The first and last points sit on the horn's mouth, so this band draws the
 * edge between pile and horn exactly once.
 */
const PILE: [number, number][] = [
  [66, 14],
  [76, 8],
  [88, 12],
  [96, 24],
  [98, 40],
  [96, 56],
  [86, 66],
  [74, 68],
  [66, 66],
];

/**
 * Fruit within the pile: colour patches, not shapes. They carry no outline of
 * their own, and they are drawn big enough that the pile's own colour is only
 * the gaps between them — at the size they were first drawn the pile read as a
 * gold slab with three dots on it.
 */
const APPLE: [number, number, number] = [82, 26, 13];
const GOURD: [number, number, number] = [84, 52, 13];

/**
 * Grain positions up the ear: x, y, and the angle each one tilts outward.
 *
 * Each grain runs `GRAIN_LENGTH` from its root, so the topmost sits at 22 and
 * not at 8 — a grain rooted any higher sends its tip off the top of the box.
 */
const GRAIN_LENGTH = 15;
const GRAINS: [number, number, number][] = [
  [50, 22, -Math.PI / 2],
  [44, 32, -2.3],
  [56, 32, -0.84],
  [42, 44, -2.4],
  [58, 44, -0.74],
  [41, 56, -2.45],
  [59, 56, -0.69],
];

/** A grain's tip, from its root and angle. */
function grainTip([x, y, a]: [number, number, number]): [number, number] {
  return [x + Math.cos(a) * GRAIN_LENGTH, y + Math.sin(a) * GRAIN_LENGTH];
}

/** The turkey's fan, as tip positions on an arc. */
const FAN_TIPS: [number, number][] = [
  [8, 46],
  [12, 26],
  [26, 12],
  [50, 5],
  [74, 12],
  [88, 26],
  [92, 46],
];

/** One tail feather: a lens from the body's centre out to a tip. */
function feather(tip: [number, number], width: number): string {
  return taper(50, 62, tip[0], tip[1], width);
}

/**
 * The turkey's face, built once so the sockets cut into the head and the eyes
 * filled by the dark part come from the same coordinates.
 */
const TURKEY_FACE = cuteFace(50, 44, 30, { blush: false });

export const THANKSGIVING_SHAPES: LibraryShape[] = [
  {
    id: 'autumn-maple-leaf',
    name: 'Maple leaf',
    category: 'thanksgiving',
    keywords: ['autumn', 'fall', 'red', 'canada', 'tree'],
    parts: [
      { name: 'Leaf', d: polyPath(MAPLE), color: RED },
      {
        name: 'Shading',
        // The half turned away from the light. Cut along the midrib, so it
        // reads as one leaf catching the light rather than as two leaves.
        d: polyPath([[50, 5], ...MAPLE.slice(1, 14), [50, 77]]),
        color: RED_DARK,
      },
      { name: 'Stalk', d: taper(50, 74, 50, 97, 5), color: WOOD_DARK },
      {
        name: 'Outline',
        // Veins stop well short of the band. A vein that reaches it bridges the
        // cavity, and the whole keyline then stitches as a solid leaf.
        d:
          `${strokeBand(MAPLE, KEYLINE, { closed: true, align: 'inside' })} ` +
          veins(50, 72, 50, 26, [
            { at: 0.3, length: 0.3, spread: 1.15 },
            { at: 0.58, length: 0.26, spread: 1.05 },
          ]),
        color: OUTLINE,
      },
    ],
  },
  {
    id: 'autumn-oak-leaf',
    name: 'Oak leaf',
    category: 'thanksgiving',
    keywords: ['autumn', 'fall', 'acorn', 'tree', 'lobed'],
    parts: [
      { name: 'Leaf', d: smoothClosed(OAK), color: COPPER },
      {
        name: 'Shading',
        d: smoothClosed([[50, 6], ...OAK.slice(1, 15), [50, 82]]),
        color: BROWN,
      },
      { name: 'Stalk', d: taper(50, 80, 50, 97, 5), color: WOOD_DARK },
      {
        name: 'Outline',
        d:
          `${strokeBand(OAK, KEYLINE, { closed: true, align: 'inside' })} ` +
          veins(50, 78, 50, 20, [
            { at: 0.26, length: 0.26, spread: 1.2 },
            { at: 0.5, length: 0.28, spread: 1.15 },
            { at: 0.72, length: 0.22, spread: 1.1 },
          ]),
        color: OUTLINE,
      },
    ],
  },
  {
    id: 'autumn-acorn',
    name: 'Acorn',
    category: 'thanksgiving',
    keywords: ['nut', 'oak', 'autumn', 'squirrel', 'seed'],
    parts: [
      // A plump nut rather than the old flat-topped tumbler. The cap sits on
      // top of it and is drawn after, so the join needs no trimming.
      { name: 'Nut', d: blob(50, 30, 62, 66, 0.35), color: WOOD },
      {
        name: 'Shading',
        d: 'M 62 34 C 76 44 80 66 70 84 C 64 92 56 96 50 96 C 64 84 70 60 62 34 Z',
        color: WOOD_DARK,
      },
      { name: 'Shine', d: highlight(50, 62, 28, 1.1), color: CREAM },
      {
        name: 'Cap',
        // A dome that cups the nut, not a flat ellipse laid across the top —
        // as an ellipse it read as a beret balanced on a chestnut.
        d: `${smoothClosed(CAP)} ${taper(50, 2, 50, 14, 8)}`,
        color: BROWN,
      },
      {
        name: 'Outline',
        d:
          // The nut is outlined *open*, along the edge you can actually see.
          // Closing it would draw the nut's shoulder where the cap covers it,
          // and that ring then crosses the cap's band and merges with it —
          // giving the compiler two overlapping outlines to union, and the
          // acorn a seam across its middle.
          // Starts below the cap's lower edge at y=46. Running it up under the
          // cap would put this ribbon across the cap's band, and the union of
          // the two encloses a pocket that stitches as an extra hole.
          `${strokeBand(
            [
              [24, 52],
              [22, 66],
              [28, 82],
              [50, 96],
              [72, 82],
              [78, 66],
              [76, 52],
            ],
            KEYLINE,
          )} ` +
          `${strokeBand(CAP, KEYLINE, { closed: true, align: 'inside' })} ` +
          // Cap scales: two courses of short dashes. Dashes, not a lattice —
          // anything spanning the cap would bridge its cavity and the band
          // would stitch as a solid dome.
          `${[24, 36, 48, 60].map((x) => taper(x, 22, x + 8, 22, 2.4)).join(' ')} ` +
          `${[20, 32, 44, 56, 68].map((x) => taper(x, 34, x + 8, 34, 2.4)).join(' ')}`,
        color: OUTLINE,
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
        d: FAN_TIPS.map((tip) => feather(tip, 22)).join(' '),
        color: ORANGE_DARK,
      },
      {
        name: 'Inner feathers',
        d: FAN_TIPS.map((tip) => feather(tip, 12)).join(' '),
        color: ORANGE_LIGHT,
      },
      { name: 'Body', d: blob(50, 48, 46, 50, 0.6), color: FUR_DARK },
      // The head is cut for its own eyes, so the dark part fills them rather
      // than laying a second layer of thread over a solid fill.
      { name: 'Head', d: `${circle(50, 46, 16)} ${TURKEY_FACE.sockets}`, color: FUR },
      { name: 'Wattle', d: 'M 57 52 C 63 55 64 63 60 69 C 56 73 52 70 52 64 C 52 58 54 53 57 52 Z', color: RED },
      // Beak and feet share the yellow and are adjacent, so the machine changes
      // to it once. Splitting them across the wattle would cost a second stop.
      {
        name: 'Beak and feet',
        d: `M 44 50 L 33 55 L 44 60 Z ${taper(42, 90, 36, 98, 5)} ${taper(58, 90, 64, 98, 5)}`,
        color: YELLOW,
      },
      { name: 'Outline', d: `${circleBand(50, 46, 16)} ${TURKEY_FACE.ink}`, color: OUTLINE },
    ],
  },
  {
    id: 'autumn-pumpkin-pie',
    name: 'Pumpkin pie',
    category: 'thanksgiving',
    keywords: ['dessert', 'slice', 'thanksgiving', 'baking', 'cream'],
    parts: [
      // A wedge seen from the side: crust wall along the back edge, filling
      // sloping to the point. A flat triangle is a slice of nothing.
      { name: 'Crust', d: polyPath(PIE), color: WOOD },
      { name: 'Filling', d: 'M 50 26 L 86 74 L 14 74 Z', color: ORANGE_DARK },
      { name: 'Filling shine', d: 'M 50 34 L 65 56 L 35 56 Z', color: ORANGE },
      { name: 'Crust edge', d: scallop(6, 72, 88, 12, 7), color: WOOD_DARK },
      {
        name: 'Cream',
        // A dollop, sitting on the filling. At the size it was first drawn it
        // covered the slice and the icon read as a scoop of something white.
        d: `${circle(50, 58, 7)} ${circle(50, 50, 5)} ${circle(50, 44, 3.2)}`,
        color: WHITE,
      },
      {
        name: 'Outline',
        d: strokeBand(PIE, KEYLINE, { closed: true, align: 'inside' }),
        color: OUTLINE,
      },
    ],
  },
  {
    id: 'autumn-cornucopia',
    name: 'Cornucopia',
    category: 'thanksgiving',
    keywords: ['horn of plenty', 'harvest', 'basket', 'abundance', 'thanksgiving'],
    parts: [
      // Tapering and hooked at the tip — a straight cone is a megaphone.
      { name: 'Horn', d: smoothClosed(HORN), color: WOOD },
      {
        name: 'Shading',
        d: smoothClosed([[66, 14], [48, 14], [32, 22], [20, 38], [14, 58], [14, 76], [22, 88], [32, 82], [34, 70], [40, 56], [50, 46], [64, 38]]),
        color: WOOD_DARK,
      },
      { name: 'Spill', d: smoothClosed(PILE), color: ORANGE },
      { name: 'Gourd', d: circle(GOURD[0], GOURD[1], GOURD[2]), color: GOLD },
      { name: 'Apple', d: circle(APPLE[0], APPLE[1], APPLE[2]), color: RED },
      {
        name: 'Outline',
        d:
          // The horn is open, so the mouth is left to the pile's band, which
          // draws that edge once rather than both of them drawing it twice.
          `${strokeBand(HORN_EDGE, KEYLINE)} ` +
          `${strokeBand(PILE, KEYLINE, { closed: true, align: 'inside' })} ` +
          // Basketry: short dashes across the horn, never a lattice. Anything
          // spanning it would bridge the ribbon and close the weave into it.
          `${taper(48, 20, 50, 32, 2)} ${taper(36, 28, 40, 40, 2)} ${taper(26, 42, 32, 52, 2)} ${taper(20, 58, 28, 64, 2)} ${taper(19, 74, 27, 76, 2)}`,
        color: OUTLINE,
      },
    ],
  },
  {
    id: 'autumn-wheat',
    name: 'Wheat',
    category: 'thanksgiving',
    keywords: ['harvest', 'grain', 'sheaf', 'field', 'autumn'],
    parts: [
      // Stalk and leaves share the olive and sew together, under the ear.
      { name: 'Stalk', d: taper(50, 50, 50, 98, 5), color: OLIVE },
      {
        name: 'Leaves',
        d: `${taper(48, 70, 22, 86, 8, 8)} ${taper(52, 80, 78, 94, 8, -8)}`,
        color: OLIVE,
      },
      {
        name: 'Grains',
        // Paired, alternating up the stalk and tilted outward, the way an ear
        // of wheat actually sits.
        d: GRAINS.map((grain) => {
          const [tx, ty] = grainTip(grain);
          return taper(grain[0], grain[1], tx, ty, 9);
        }).join(' '),
        color: GOLD,
      },
      {
        name: 'Awns',
        d: `${taper(40, 46, 22, 22, 2.5)} ${taper(60, 46, 78, 22, 2.5)} ${taper(42, 60, 26, 40, 2.5)} ${taper(58, 60, 74, 40, 2.5)}`,
        color: YELLOW_DARK,
      },
      {
        name: 'Outline',
        // Every grain gets its own band. An ear is a bundle of small shapes,
        // and a single silhouette around the bundle would read as a mitten.
        d: GRAINS.map((grain) => {
          const [tx, ty] = grainTip(grain);
          return taperBand(grain[0], grain[1], tx, ty, 9);
        }).join(' '),
        color: OUTLINE,
      },
    ],
  },
];
