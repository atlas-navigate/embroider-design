import type { LibraryShape } from '../types.js';
import { blob, circle, ellipse, smoothClosed } from './draw.js';
import { highlight, taper } from './detail.js';
import { KEYLINE, circleBand, ellipseBand, polyPath, strokeBand } from './keyline.js';
import { cuteFace } from './face.js';
import {
  BLUSH_LIGHT,
  BROWN,
  CHARCOAL,
  CREAM,
  CREAM_DARK,
  FUR,
  FUR_DARK,
  FUR_LIGHT,
  GOLD,
  INK,
  ORANGE,
  ORANGE_DARK,
  ORANGE_LIGHT,
  OUTLINE,
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
 * **One silhouette per icon.** The ears are part of the head's own contour
 * rather than separate shapes behind it, so each animal has exactly one closed
 * keyline band. That is not only tidier: two overlapping bands union into a
 * pocket the compiler stitches as an extra hole, and an ear drawn as its own
 * closed ring behind a head is the commonest way to get one. Colour patches
 * underneath may overlap each other as freely as they like — only the dark
 * part's geometry has to stay disciplined.
 *
 * Eyes and noses are cut out of the head as counter-rings *and* filled by the
 * dark part, which is what `cuteFace` returns its `sockets` for. Stitching a
 * feature straight over a solid fill doubles the thread in that spot.
 */

/** A dog's head, floppy ears included in the contour. */
const DOG_HEAD: [number, number][] = [
  [50, 10],
  [64, 13],
  [74, 22],
  [76, 32],
  [88, 34],
  [94, 48],
  [92, 64],
  [82, 74],
  [74, 70],
  [70, 80],
  [58, 88],
  [42, 88],
  [30, 80],
  [26, 70],
  [18, 74],
  [8, 64],
  [6, 48],
  [12, 34],
  [24, 32],
  [26, 22],
  [36, 13],
];

/** A cat's head: the ears are corners of the same outline, not shapes on top. */
const CAT_HEAD: [number, number][] = [
  [50, 24],
  [62, 22],
  [76, 4],
  [80, 30],
  [88, 42],
  [90, 58],
  [82, 76],
  [66, 88],
  [50, 90],
  [34, 88],
  [18, 76],
  [10, 58],
  [12, 42],
  [20, 30],
  [24, 4],
  [38, 22],
];

/** Body and tail as one outline — a fish is a single silhouette. */
const FISH: [number, number][] = [
  [58, 14],
  [76, 20],
  [90, 32],
  [96, 46],
  [90, 62],
  [76, 76],
  [58, 84],
  [40, 84],
  [26, 74],
  [22, 60],
  [8, 76],
  [4, 50],
  [8, 24],
  [22, 40],
  [26, 26],
  [40, 16],
];

/**
 * The birdhouse: gable and walls. The post is drawn separately rather than
 * notched into this outline — a concave neck that deep does not survive being
 * offset inward and then unioned, and the band came apart into three pieces
 * with no cavity left between them.
 */
const HOUSE: [number, number][] = [
  [50, 4],
  [88, 36],
  [82, 40],
  [82, 84],
  [18, 84],
  [18, 40],
  [12, 36],
];

/**
 * A bone. The knobs need enough points to come out round — at four apiece the
 * spline cut them into hexagons and the icon read as a dumbbell.
 */
const BONE: [number, number][] = [
  [34, 42],
  [32, 34],
  [26, 29],
  [18, 28],
  [10, 32],
  [5, 40],
  [5, 48],
  [5, 56],
  [10, 64],
  [18, 68],
  [26, 67],
  [32, 62],
  [34, 54],
  [66, 54],
  [68, 62],
  [74, 67],
  [82, 68],
  [90, 64],
  [95, 56],
  [95, 48],
  [95, 40],
  [90, 32],
  [82, 28],
  [74, 29],
  [68, 34],
  [66, 42],
];

/** Toes, splayed and tilted outward: four upright ovals in a row is not a paw. */
const TOES: [number, number, number, number][] = [
  [15, 42, 11, 15],
  [37, 24, 12, 16],
  [63, 24, 12, 16],
  [85, 42, 11, 15],
];

/** A heel pad with three lobes at the bottom, which is what a real paw leaves. */
const PAD: [number, number][] = [
  [50, 48],
  [66, 52],
  [78, 64],
  [79, 78],
  [70, 88],
  [60, 84],
  [50, 88],
  [40, 84],
  [30, 88],
  [21, 78],
  [22, 64],
  [34, 52],
];

const DOG_FACE = cuteFace(50, 44, 44, { smile: false, blush: false });
const CAT_FACE = cuteFace(50, 50, 44, { smile: false, blush: false });

/** A dog's nose and the two curves of its mouth, for the dark part. */
const DOG_MUZZLE_INK =
  `${ellipse(50, 62, 8, 6)} ${taper(50, 66, 41, 73, 2.6)} ${taper(50, 66, 59, 73, 2.6)}`;

export const PET_SHAPES: LibraryShape[] = [
  {
    id: 'pets-paw-print',
    name: 'Paw print',
    category: 'pets',
    keywords: ['dog', 'cat', 'animal', 'track', 'foot', 'print'],
    parts: [
      {
        name: 'Pad and toes',
        d: `${smoothClosed(PAD)} ${TOES.map(([x, y, rx, ry]) => ellipse(x, y, rx, ry)).join(' ')}`,
        color: BROWN,
      },
      {
        name: 'Outline',
        d:
          `${strokeBand(PAD, KEYLINE, { closed: true, align: 'inside' })} ` +
          `${TOES.map(([x, y, rx, ry]) => ellipseBand(x, y, rx, ry)).join(' ')}`,
        color: OUTLINE,
      },
    ],
  },
  {
    id: 'pets-bone',
    name: 'Bone',
    category: 'pets',
    keywords: ['dog', 'treat', 'chew', 'puppy', 'biscuit'],
    parts: [
      { name: 'Bone', d: smoothClosed(BONE), color: CREAM },
      {
        name: 'Shading',
        d: smoothClosed([[66, 54], [68, 62], [74, 67], [82, 68], [90, 64], [95, 56], [95, 48], [95, 40], [90, 32], [82, 28], [74, 29], [68, 34], [66, 42], [72, 48]]),
        color: CREAM_DARK,
      },
      { name: 'Shine', d: highlight(18, 48, 13, 1.5), color: WHITE },
      {
        name: 'Outline',
        d: strokeBand(BONE, KEYLINE, { closed: true, align: 'inside' }),
        color: OUTLINE,
      },
    ],
  },
  {
    id: 'pets-dog',
    name: 'Dog',
    category: 'pets',
    keywords: ['puppy', 'hound', 'canine', 'pet', 'beagle', 'retriever'],
    parts: [
      // The head carries the sockets, so the dark part fills the eyes and nose
      // rather than laying a second layer of thread over a solid fill.
      {
        name: 'Head',
        d: `${smoothClosed(DOG_HEAD)} ${DOG_FACE.sockets} ${ellipse(50, 62, 8, 6)}`,
        color: FUR,
      },
      {
        name: 'Ears',
        // Drawn over the head, reaching the silhouette's edge on both sides.
        // They may overlap whatever they like — they are colour, not shape.
        d: `${ellipse(15, 52, 14, 22)} ${ellipse(85, 52, 14, 22)}`,
        color: FUR_DARK,
      },
      { name: 'Muzzle', d: `${blob(50, 54, 38, 34, 0.3)} ${ellipse(50, 62, 8, 6)}`, color: FUR_LIGHT },
      { name: 'Cheeks', d: cuteFace(50, 44, 44).blush, color: BLUSH_LIGHT },
      { name: 'Tongue', d: 'M 44 74 C 44 72 56 72 56 74 L 56 82 C 56 86 44 86 44 82 Z', color: PINK },
      {
        name: 'Outline',
        d:
          `${strokeBand(DOG_HEAD, KEYLINE, { closed: true, align: 'inside' })} ` +
          `${DOG_FACE.ink} ${DOG_MUZZLE_INK}`,
        color: OUTLINE,
      },
    ],
  },
  {
    id: 'pets-cat',
    name: 'Cat',
    category: 'pets',
    keywords: ['kitten', 'feline', 'kitty', 'pet', 'tabby'],
    parts: [
      { name: 'Head', d: `${polyPath(CAT_HEAD)} ${CAT_FACE.sockets}`, color: SILVER },
      {
        name: 'Stripes',
        // A cat with no markings is a bald cat. Two on the brow and two on each
        // cheek is enough to say tabby without turning into a pattern.
        d:
          `${taper(44, 26, 42, 40, 4)} ${taper(56, 26, 58, 40, 4)} ` +
          `${taper(14, 50, 30, 54, 4)} ${taper(15, 62, 31, 63, 4)} ` +
          `${taper(86, 50, 70, 54, 4)} ${taper(85, 62, 69, 63, 4)}`,
        color: SILVER_DARK,
      },
      {
        name: 'Ears and nose',
        d: `${polyPath([[28, 14], [38, 26], [24, 26]])} ${polyPath([[72, 14], [76, 26], [62, 26]])} ${polyPath([[50, 62], [56, 68], [44, 68]])}`,
        color: PINK,
      },
      { name: 'Cheeks', d: cuteFace(50, 50, 44).blush, color: BLUSH_LIGHT },
      {
        name: 'Outline',
        d:
          `${strokeBand(CAT_HEAD, KEYLINE, { closed: true, align: 'inside' })} ` +
          `${CAT_FACE.ink} ` +
          // Whiskers, kept clear of the band so they cannot bridge it.
          `${taper(36, 66, 18, 62, 2)} ${taper(36, 70, 18, 74, 2)} ` +
          `${taper(64, 66, 82, 62, 2)} ${taper(64, 70, 82, 74, 2)}`,
        color: OUTLINE,
      },
    ],
  },
  {
    id: 'pets-fish',
    name: 'Fish',
    category: 'pets',
    keywords: ['aquarium', 'goldfish', 'swim', 'tank', 'fins'],
    parts: [
      { name: 'Fish', d: smoothClosed(FISH), color: ORANGE },
      {
        name: 'Tail',
        d: polyPath([[26, 26], [22, 40], [8, 24], [4, 50], [8, 76], [22, 60], [26, 74], [30, 50]]),
        color: ORANGE_DARK,
      },
      {
        name: 'Scales',
        d:
          `${circle(52, 38, 7)} ${circle(66, 42, 7)} ${circle(52, 60, 7)} ` +
          `${circle(66, 62, 7)} ${circle(42, 50, 7)}`,
        color: ORANGE_LIGHT,
      },
      { name: 'Eye', d: circle(76, 40, 8), color: WHITE },
      {
        name: 'Outline',
        d:
          `${strokeBand(FISH, KEYLINE, { closed: true, align: 'inside' })} ` +
          `${circle(78, 40, 4)} ` +
          // The gill line: well inside the band at both ends.
          `${taper(44, 24, 38, 44, 2.4)}`,
        color: OUTLINE,
      },
    ],
  },
  {
    id: 'pets-birdhouse',
    name: 'Birdhouse',
    category: 'pets',
    keywords: ['bird', 'nest', 'garden', 'home', 'box'],
    parts: [
      { name: 'House', d: `${polyPath(HOUSE)} ${circle(50, 52, 12)}`, color: WOOD },
      { name: 'Roof', d: polyPath([[50, 4], [88, 36], [82, 40], [50, 14], [18, 40], [12, 36]]), color: RED },
      // Post and boards share the dark wood and are adjacent, so the machine
      // changes to it once. The post abuts the wall rather than overlapping it.
      { name: 'Post', d: polyPath([[44, 84], [56, 84], [56, 98], [44, 98]]), color: WOOD_DARK },
      { name: 'Boards', d: `${taper(22, 70, 78, 70, 3)} ${taper(22, 78, 78, 78, 3)}`, color: WOOD_DARK },
      {
        name: 'Entrance',
        // Charcoal rather than the keyline colour, and its own part. A solid
        // disc inside the wall band belongs to neither the outline nor the
        // wall: put it in the dark part and it is one more thing the compiler
        // has to union against the band it sits inside.
        d: circle(50, 52, 12),
        color: CHARCOAL,
      },
      {
        name: 'Outline',
        d: strokeBand(HOUSE, KEYLINE, { closed: true, align: 'inside' }),
        color: OUTLINE,
      },
    ],
  },
  {
    id: 'pets-collar-tag',
    name: 'Collar tag',
    category: 'pets',
    keywords: ['name tag', 'id', 'dog', 'pet', 'buckle'],
    parts: [
      { name: 'Collar', d: polyPath([[2, 8], [98, 8], [98, 30], [2, 30]]), color: RED },
      { name: 'Stitching', d: `${taper(6, 14, 94, 14, 2.5)} ${taper(6, 24, 94, 24, 2.5)}`, color: CREAM },
      // The strap that hangs the tag, drawn before the tag so the tag covers
      // its lower end. Colour only, and no band: a split ring drawn properly
      // between the two crossed both of their bands, and two crossing bands
      // union into a pocket that stitches as a hole nobody drew.
      { name: 'Strap', d: polyPath([[45, 26], [55, 26], [55, 44], [45, 44]]), color: SILVER },
      { name: 'Tag', d: circle(50, 64, 28), color: GOLD },
      {
        name: 'Bone mark',
        d: smoothClosed([[38, 58], [43, 60], [57, 60], [62, 58], [66, 62], [62, 68], [57, 66], [43, 66], [38, 68], [34, 62]]),
        color: WHITE,
      },
      {
        name: 'Outline',
        d:
          `${strokeBand([[2, 8], [98, 8], [98, 30], [2, 30]], KEYLINE, { closed: true, align: 'inside' })} ` +
          `${circleBand(50, 64, 28)}`,
        color: INK,
      },
    ],
  },
];
