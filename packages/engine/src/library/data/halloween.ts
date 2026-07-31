import type { LibraryShape } from '../types.js';
import { circle, ellipse, flame } from './draw.js';
import {
  CREAM,
  GREEN_DARK,
  INK,
  INK_SOFT,
  ORANGE,
  ORANGE_DARK,
  ORANGE_LIGHT,
  PURPLE,
  PURPLE_DARK,
  SHADOW,
  SILVER,
  SILVER_LIGHT,
  WHITE,
  YELLOW,
  YELLOW_LIGHT,
} from './palette.js';

/**
 * Halloween.
 *
 * Note the pattern used wherever a dark feature sits on a light body — the
 * ghost's eyes, the skull's sockets, the lantern's face. The feature's outline
 * is cut into the body as a counter-ring *and* filled by its own part, using
 * the same path data for both. Stitching the feature straight on top of a solid
 * fill instead would put two layers of thread in the same place: stiff, lumpy,
 * and prone to the underneath colour showing through the gaps in the top one.
 * This is ordinary practice in commercial digitizing and it is worth the
 * duplication.
 *
 * The hard cases here are the black things. A bat, a spider and a cat are all
 * traditionally solid silhouettes, and a solid silhouette in one dark thread is
 * a blob — worse on fabric than on screen, because there is no outline to catch
 * the light. Each gets a second, lighter tone doing the job an ink outline
 * would: wing membrane, leg joints, the turn of a cat's back.
 */

/** Shared so the lantern is unmistakably the same gourd as the plain pumpkin. */
const PUMPKIN_BODY =
  'M 50 22 C 68 22 78 24 86 32 C 94 40 96 54 96 64 C 96 78 88 92 74 92 ' +
  'C 66 92 60 88 50 88 C 40 88 34 92 26 92 C 12 92 4 78 4 64 ' +
  'C 4 54 6 40 14 32 C 22 24 32 22 50 22 Z';

const PUMPKIN_RIBS =
  'M 24 26 C 16 38 14 52 16 66 C 17 76 21 86 26 92 C 12 92 4 78 4 64 C 4 52 8 34 18 28 Z ' +
  'M 76 26 C 84 38 86 52 84 66 C 83 76 79 86 74 92 C 88 92 96 78 96 64 C 96 52 92 34 82 28 Z';

const PUMPKIN_STEM = 'M 43 6 C 52 6 56 12 56 22 L 46 24 C 46 16 46 14 43 14 Z';

/** Cut out of the lantern and filled by its own part, per the note above. */
const LANTERN_FACE =
  'M 24 44 L 40 44 L 32 60 Z ' +
  'M 76 44 L 60 44 L 68 60 Z ' +
  'M 22 68 L 32 64 L 40 72 L 50 64 L 60 72 L 68 64 L 78 68 ' +
  'C 74 82 62 86 50 86 C 38 86 26 82 22 68 Z';

const GHOST_FACE = `${ellipse(36, 40, 7, 10)} ${ellipse(64, 40, 7, 10)} ${ellipse(50, 62, 9, 7)}`;

const SKULL_FACE =
  `${ellipse(33, 46, 13, 15)} ${ellipse(67, 46, 13, 15)} M 50 62 L 58 76 L 42 76 Z`;

const CAT_FACE = `${ellipse(40, 28, 5, 8)} ${ellipse(60, 28, 5, 8)} M 44 40 L 56 40 L 50 47 Z`;

export const HALLOWEEN_SHAPES: LibraryShape[] = [
  {
    id: 'halloween-pumpkin',
    name: 'Pumpkin',
    category: 'halloween',
    keywords: ['gourd', 'squash', 'autumn', 'fall', 'harvest', 'orange'],
    parts: [
      { name: 'Body', d: PUMPKIN_BODY, color: ORANGE },
      // The lobes of a pumpkin, which is what tells it from an orange.
      { name: 'Ribs', d: PUMPKIN_RIBS, color: ORANGE_DARK },
      { name: 'Shine', d: 'M 30 36 C 24 44 22 54 24 64 L 32 62 C 31 54 32 46 36 40 Z', color: ORANGE_LIGHT },
      { name: 'Stem', d: PUMPKIN_STEM, color: GREEN_DARK },
      { name: 'Vine', d: 'M 56 10 C 66 4 78 6 82 14 C 76 12 68 12 62 16 Z', color: GREEN_DARK },
    ],
  },
  {
    id: 'halloween-jack-o-lantern',
    name: "Jack-o'-lantern",
    category: 'halloween',
    keywords: ['pumpkin', 'carved', 'face', 'lantern', 'spooky', 'jack o lantern'],
    parts: [
      // The glow goes down first, so the carved openings have something behind
      // them to show rather than a hole through to the fabric.
      { name: 'Glow', d: ellipse(50, 60, 40, 28), color: YELLOW },
      { name: 'Lantern', d: `${PUMPKIN_BODY} ${LANTERN_FACE}`, color: ORANGE },
      { name: 'Ribs', d: PUMPKIN_RIBS, color: ORANGE_DARK },
      { name: 'Stem', d: PUMPKIN_STEM, color: GREEN_DARK },
    ],
  },
  {
    id: 'halloween-ghost',
    name: 'Ghost',
    category: 'halloween',
    keywords: ['spook', 'boo', 'spirit', 'haunt', 'sheet'],
    parts: [
      {
        name: 'Body',
        d:
          'M 50 4 C 72 4 88 22 88 46 L 88 92 L 76 82 L 64 94 L 50 82 L 36 94 L 24 82 L 12 92 ' +
          'L 12 46 C 12 22 28 4 50 4 Z ' +
          GHOST_FACE,
        color: WHITE,
      },
      {
        name: 'Shading',
        d: 'M 66 10 C 80 18 88 30 88 46 L 88 92 L 76 82 L 68 90 L 68 20 Z',
        color: SILVER_LIGHT,
      },
      { name: 'Face', d: GHOST_FACE, color: INK },
    ],
  },
  {
    id: 'halloween-bat',
    name: 'Bat',
    category: 'halloween',
    keywords: ['vampire', 'wings', 'night', 'spooky', 'flying'],
    parts: [
      {
        name: 'Wings',
        // Scalloped trailing edges and a clear break between wing and body: a
        // bat is read from the scallops, and a smooth-edged silhouette is a
        // bird.
        d:
          'M 50 34 C 56 26 64 20 74 18 C 72 24 72 28 74 32 ' +
          'C 80 26 88 24 96 26 L 90 36 C 94 38 96 42 96 48 ' +
          'C 88 46 82 48 78 54 C 74 60 70 66 62 70 ' +
          'C 60 62 56 56 50 52 C 44 56 40 62 38 70 ' +
          'C 30 66 26 60 22 54 C 18 48 12 46 4 48 ' +
          'C 4 42 6 38 10 36 L 4 26 C 12 24 20 26 26 32 ' +
          'C 28 28 28 24 26 18 C 36 20 44 26 50 34 Z',
        color: INK,
      },
      // Ears before the membrane, so both black parts sew in one run. Parts
      // sharing a thread are kept adjacent throughout this file: a colour that
      // comes back later stops the machine for a change it did not need.
      { name: 'Ears', d: 'M 42 30 L 38 14 L 47 26 Z M 58 30 L 62 14 L 53 26 Z', color: INK },
      {
        name: 'Membrane',
        // The lighter panels between the finger bones. Without them the wings
        // are one flat area and the shape stops reading at any distance.
        d:
          'M 50 40 C 55 34 60 30 66 28 C 65 34 66 40 68 44 C 62 50 56 56 54 62 Z ' +
          'M 50 40 C 45 34 40 30 34 28 C 35 34 34 40 32 44 C 38 50 44 56 46 62 Z',
        color: INK_SOFT,
      },
      {
        name: 'Body',
        d: 'M 50 26 C 55 26 58 31 58 40 C 58 52 55 62 50 68 C 45 62 42 52 42 40 C 42 31 45 26 50 26 Z',
        color: INK_SOFT,
      },
      { name: 'Eyes', d: `${circle(45, 34, 3)} ${circle(55, 34, 3)}`, color: YELLOW },
    ],
  },
  {
    id: 'halloween-spider',
    name: 'Spider',
    category: 'halloween',
    keywords: ['bug', 'arachnid', 'creepy', 'legs', 'eight'],
    parts: [
      {
        name: 'Legs',
        // Eight of them, jointed, and thick enough to survive being stitched.
        // Hairline legs are the classic way a spider icon vanishes on fabric.
        d:
          'M 34 48 L 16 34 L 4 42 L 8 47 L 17 41 L 32 54 Z ' +
          'M 34 57 L 14 55 L 2 65 L 7 69 L 16 61 L 33 62 Z ' +
          'M 34 64 L 16 71 L 10 85 L 16 87 L 21 75 L 36 69 Z ' +
          'M 38 69 L 30 84 L 32 96 L 38 95 L 37 85 L 43 73 Z ' +
          'M 66 48 L 84 34 L 96 42 L 92 47 L 83 41 L 68 54 Z ' +
          'M 66 57 L 86 55 L 98 65 L 93 69 L 84 61 L 67 62 Z ' +
          'M 66 64 L 84 71 L 90 85 L 84 87 L 79 75 L 64 69 Z ' +
          'M 62 69 L 70 84 L 68 96 L 62 95 L 63 85 L 57 73 Z',
        color: INK,
      },
      { name: 'Abdomen', d: ellipse(50, 62, 22, 24), color: INK },
      { name: 'Head', d: ellipse(50, 36, 15, 13), color: INK_SOFT },
      {
        name: 'Marking',
        // The hourglass, and the only reason the abdomen reads as a body rather
        // than as a gap in the middle of the legs.
        d: 'M 42 52 L 58 52 L 51 62 L 58 74 L 42 74 L 49 62 Z',
        color: ORANGE,
      },
      {
        name: 'Eyes',
        d: `${circle(44, 33, 3.5)} ${circle(56, 33, 3.5)} ${circle(47, 41, 2.2)} ${circle(53, 41, 2.2)}`,
        color: YELLOW,
      },
    ],
  },
  {
    id: 'halloween-web',
    name: 'Spider web',
    category: 'halloween',
    keywords: ['cobweb', 'corner', 'spooky', 'net', 'silk'],
    parts: [
      {
        name: 'Radials',
        // A corner web, anchored top-left, which is how a web is actually hung
        // and far more legible than a free-floating wheel.
        d:
          'M 1 1 L 7 1 L 9 96 L 3 96 Z ' +
          'M 1 1 L 6 1 L 45 92 L 39 94 Z ' +
          'M 1 1 L 5 1 L 73 74 L 68 79 Z ' +
          'M 1 1 L 2 1 L 94 39 L 92 45 Z ' +
          'M 1 1 L 1 2 L 96 3 L 96 9 Z',
        color: SILVER,
      },
      {
        name: 'Threads',
        // Each strand sags between its anchors: a web drawn with straight
        // chords looks like a folding fan.
        d:
          'M 3 22 C 11 24 17 18 23 3 L 27 5 C 21 22 13 30 4 28 Z ' +
          'M 4 46 C 19 48 35 34 47 4 L 52 6 C 39 40 21 56 5 52 Z ' +
          'M 5 72 C 27 74 51 52 71 5 L 77 8 C 56 58 31 82 6 78 Z ' +
          'M 6 94 C 35 96 67 68 93 7 L 98 10 C 71 76 39 100 7 98 Z',
        color: SILVER_LIGHT,
      },
    ],
  },
  {
    id: 'halloween-witch-hat',
    name: 'Witch hat',
    category: 'halloween',
    keywords: ['wizard', 'magic', 'pointed', 'costume', 'brim'],
    parts: [
      {
        name: 'Cone',
        d: 'M 56 4 C 62 12 66 34 70 56 C 72 66 68 72 56 74 C 46 76 36 74 32 70 C 34 50 42 20 56 4 Z',
        color: PURPLE,
      },
      {
        name: 'Brim',
        d: 'M 50 66 C 74 66 96 74 96 84 C 96 94 74 98 50 98 C 26 98 4 94 4 84 C 4 74 26 66 50 66 Z',
        color: PURPLE,
      },
      {
        name: 'Cone shading',
        d: 'M 56 4 C 62 12 66 34 70 56 C 72 66 68 72 56 74 C 60 60 58 30 52 12 Z',
        color: PURPLE_DARK,
      },
      {
        name: 'Brim shading',
        d: 'M 50 82 C 74 82 96 79 96 84 C 96 94 74 98 50 98 C 26 98 4 94 4 84 C 4 79 26 82 50 82 Z',
        color: PURPLE_DARK,
      },
      { name: 'Band', d: 'M 33 62 L 71 62 L 73 76 C 62 79 44 79 32 74 Z', color: INK },
      {
        name: 'Buckle',
        d: 'M 44 63 L 58 63 L 58 76 L 44 76 Z M 48 66 L 54 66 L 54 73 L 48 73 Z',
        color: YELLOW,
      },
    ],
  },
  {
    id: 'halloween-cauldron',
    name: 'Cauldron',
    category: 'halloween',
    keywords: ['pot', 'witch', 'brew', 'potion', 'bubbling'],
    parts: [
      { name: 'Fire', d: `${flame(28, 78, 18)} ${flame(50, 76, 22)} ${flame(72, 78, 18)}`, color: ORANGE },
      { name: 'Legs', d: 'M 20 74 L 32 74 L 28 94 L 14 94 Z M 80 74 L 68 74 L 72 94 L 86 94 Z', color: INK },
      {
        name: 'Pot',
        d:
          'M 10 40 C 10 34 14 30 22 30 L 78 30 C 86 30 90 34 90 40 ' +
          'C 90 66 76 84 50 84 C 24 84 10 66 10 40 Z',
        color: INK,
      },
      {
        name: 'Pot shading',
        d: 'M 64 32 C 78 40 84 56 78 70 C 72 80 62 84 50 84 C 70 80 78 56 66 34 Z',
        color: INK_SOFT,
      },
      { name: 'Rim', d: 'M 4 24 L 96 24 L 96 38 L 4 38 Z', color: INK_SOFT },
      {
        name: 'Brew',
        d: 'M 10 36 C 20 30 30 38 42 36 C 54 34 62 28 74 32 C 82 35 86 34 90 36 C 88 44 80 48 50 48 C 20 48 12 44 10 36 Z',
        color: GREEN_DARK,
      },
      {
        name: 'Bubbles',
        d: `${circle(34, 14, 8)} ${circle(58, 6, 6)} ${circle(70, 18, 4.5)}`,
        color: GREEN_DARK,
      },
    ],
  },
  {
    id: 'halloween-candy-corn',
    name: 'Candy corn',
    category: 'halloween',
    keywords: ['sweet', 'treat', 'candy', 'trick or treat', 'sugar'],
    parts: [
      {
        name: 'Base',
        d: 'M 50 2 C 58 12 66 34 72 60 C 76 78 66 92 50 92 C 34 92 24 78 28 60 C 34 34 42 12 50 2 Z',
        color: YELLOW,
      },
      {
        name: 'Middle',
        d: 'M 39 34 C 47 32 55 32 61 34 C 66 46 70 58 72 60 C 76 78 66 92 50 92 C 34 92 24 78 28 60 C 30 58 34 46 39 34 Z',
        color: ORANGE,
      },
      {
        name: 'Tip',
        d: 'M 32 68 C 44 64 58 64 68 68 C 72 82 64 92 50 92 C 36 92 28 82 32 68 Z',
        color: WHITE,
      },
    ],
  },
  {
    id: 'halloween-tombstone',
    name: 'Tombstone',
    category: 'halloween',
    keywords: ['grave', 'rip', 'graveyard', 'headstone', 'cemetery'],
    parts: [
      {
        name: 'Stone',
        d: 'M 16 92 L 16 42 C 16 22 31 8 50 8 C 69 8 84 22 84 42 L 84 92 Z',
        color: SILVER,
      },
      {
        name: 'Shading',
        d: 'M 64 14 C 76 20 84 30 84 42 L 84 92 L 68 92 L 68 40 C 68 30 67 20 64 14 Z',
        color: SHADOW,
      },
      {
        name: 'Inscription',
        // R and I and P, drawn as strokes.
        d:
          'M 28 38 L 42 38 L 42 52 L 36 52 L 42 64 L 35 64 L 30 52 L 30 64 L 28 64 Z ' +
          'M 33 44 L 38 44 L 38 47 L 33 47 Z ' +
          'M 46 38 L 52 38 L 52 64 L 46 64 Z ' +
          'M 56 38 L 70 38 L 70 54 L 62 54 L 62 64 L 56 64 Z ' +
          'M 62 44 L 65 44 L 65 48 L 62 48 Z',
        color: INK_SOFT,
      },
      {
        name: 'Ground',
        d: 'M 4 88 C 20 82 34 86 50 86 C 66 86 80 82 96 88 L 96 98 L 4 98 Z',
        color: GREEN_DARK,
      },
    ],
  },
  {
    id: 'halloween-cat',
    name: 'Black cat',
    category: 'halloween',
    keywords: ['kitty', 'feline', 'arched', 'spooky', 'witch'],
    parts: [
      {
        name: 'Tail',
        // Curled up beside the haunch. A cat sitting with its tail out is the
        // pose that reads at a glance; an arched back needs a second look to
        // resolve into an animal at all.
        d: 'M 74 88 C 90 86 98 72 94 56 L 84 58 C 87 70 83 78 70 80 Z',
        color: INK,
      },
      {
        name: 'Body',
        d: 'M 36 44 C 30 54 24 70 22 92 L 78 92 C 76 70 70 54 64 44 Z',
        color: INK,
      },
      { name: 'Ears', d: 'M 30 18 L 24 2 L 44 12 Z M 70 18 L 76 2 L 56 12 Z', color: INK },
      {
        name: 'Head',
        d: `${ellipse(50, 30, 23, 21)} ${CAT_FACE}`,
        color: INK,
      },
      { name: 'Ear insides', d: 'M 32 16 L 29 8 L 39 13 Z M 68 16 L 71 8 L 61 13 Z', color: PURPLE_DARK },
      {
        name: 'Chest',
        // The one lighter shape on the silhouette, so it is not a flat field of
        // black with a face floating on it.
        d: 'M 50 50 C 58 50 64 62 64 76 C 64 86 58 92 50 92 C 42 92 36 86 36 76 C 36 62 42 50 50 50 Z',
        color: INK_SOFT,
      },
      { name: 'Face', d: CAT_FACE, color: YELLOW_LIGHT },
      {
        name: 'Whiskers',
        d:
          'M 4 30 L 26 33 L 26 36 L 4 34 Z M 4 42 L 26 39 L 26 42 L 4 45 Z ' +
          'M 96 30 L 74 33 L 74 36 L 96 34 Z M 96 42 L 74 39 L 74 42 L 96 45 Z',
        color: SILVER,
      },
    ],
  },
  {
    id: 'halloween-skull',
    name: 'Skull',
    category: 'halloween',
    keywords: ['bone', 'skeleton', 'dead', 'spooky', 'head'],
    parts: [
      {
        name: 'Cranium',
        d:
          'M 50 4 C 76 4 92 24 92 48 C 92 62 86 72 78 78 L 78 90 C 78 94 75 96 70 96 ' +
          'L 30 96 C 25 96 22 94 22 90 L 22 78 C 14 72 8 62 8 48 C 8 24 24 4 50 4 Z ' +
          SKULL_FACE,
        color: CREAM,
      },
      {
        name: 'Teeth',
        d:
          'M 30 82 L 70 82 L 70 96 L 30 96 Z ' +
          'M 38 82 L 41 82 L 41 96 L 38 96 Z M 48 82 L 52 82 L 52 96 L 48 96 Z ' +
          'M 59 82 L 62 82 L 62 96 L 59 96 Z',
        color: CREAM,
      },
      {
        name: 'Shading',
        // Stops above the teeth rather than running to the jaw, so it can sew
        // before them without covering the gaps that make them teeth.
        d: 'M 68 10 C 84 18 92 32 92 48 C 92 62 86 72 78 78 L 78 80 L 72 80 C 72 60 72 26 68 10 Z',
        color: SILVER,
      },
      { name: 'Shine', d: 'M 22 26 C 26 18 32 12 40 9 L 43 16 C 37 19 32 24 29 30 Z', color: WHITE },
      { name: 'Sockets', d: SKULL_FACE, color: INK },
    ],
  },
];
