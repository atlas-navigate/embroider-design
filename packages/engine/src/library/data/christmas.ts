import type { LibraryShape } from '../types.js';
import { circle, ellipse, ring, star } from './draw.js';
import {
  BROWN,
  BROWN_DARK,
  CREAM,
  GOLD,
  GOLD_DARK,
  GOLD_LIGHT,
  INK,
  INK_SOFT,
  ORANGE,
  PINE,
  PINE_DARK,
  PINE_LIGHT,
  RED,
  RED_DARK,
  RED_LIGHT,
  SILVER_LIGHT,
  SKY,
  SKY_LIGHT,
  WHITE,
  WOOD,
  WOOD_DARK,
  WOOD_LIGHT,
} from './palette.js';

/**
 * Christmas.
 *
 * The gift box is drawn as four quadrant panels with the ribbon filling the
 * channel between them, rather than as a solid box with a ribbon laid over it.
 * A ribbon on top would double the thread along both bands; cutting the box
 * into panels costs nothing and stitches flat.
 *
 * Snowflakes are one continuous outline that walks around the hub. Drawn the
 * obvious way — three crossing bars — the centre would be three overlapping
 * regions and the machine would stitch it three times.
 */

const SNOWMAN_FACE = `${circle(43, 30, 3)} ${circle(57, 30, 3)}`;

const SNOWMAN_MOUTH =
  `${circle(43, 40, 1.8)} ${circle(47, 42, 1.8)} ${circle(53, 42, 1.8)} ${circle(57, 40, 1.8)}`;

const SNOWMAN_BUTTONS = `${circle(50, 60, 3.5)} ${circle(50, 72, 3.5)} ${circle(50, 84, 3.5)}`;

export const CHRISTMAS_SHAPES: LibraryShape[] = [
  {
    id: 'christmas-tree',
    name: 'Christmas tree',
    category: 'christmas',
    keywords: ['fir', 'pine', 'spruce', 'evergreen', 'decorated'],
    parts: [
      {
        name: 'Foliage',
        // Boughs that sag and come to points, rather than three flat triangles.
        // A fir droops, and the droop is most of what makes it a fir.
        d:
          'M 50 2 C 56 10 62 20 68 28 L 60 27 C 66 38 74 50 82 60 L 72 58 ' +
          'C 80 68 88 78 96 86 L 4 86 C 12 78 20 68 28 58 L 18 60 ' +
          'C 26 50 34 38 40 27 L 32 28 C 38 20 44 10 50 2 Z',
        color: PINE,
      },
      {
        name: 'Shadow',
        // The underside of each bough, not the whole right half — a tree lit
        // from one side still has needles on both.
        d:
          'M 32 28 L 68 28 L 64 33 L 36 33 Z ' +
          'M 18 60 L 82 60 L 78 65 L 22 65 Z ' +
          'M 4 86 L 96 86 L 96 88 L 4 88 Z',
        color: PINE_DARK,
      },
      {
        name: 'Highlight',
        d: 'M 50 12 L 44 24 L 40 27 C 44 18 47 12 50 6 Z M 42 40 L 34 54 L 28 58 C 34 48 38 42 42 34 Z',
        color: PINE_LIGHT,
      },
      { name: 'Trunk', d: 'M 42 86 L 58 86 L 58 98 L 42 98 Z', color: WOOD_DARK },
      {
        name: 'Baubles',
        d: `${circle(38, 44, 4)} ${circle(62, 52, 4)} ${circle(50, 68, 4)} ${circle(28, 74, 4)} ${circle(72, 76, 4)}`,
        color: RED,
      },
      { name: 'Star', d: star(50, 13, 11, 4.5, 5), color: GOLD },
    ],
  },
  {
    id: 'christmas-snowman',
    name: 'Snowman',
    category: 'christmas',
    keywords: ['snow', 'winter', 'frosty', 'carrot', 'hat', 'scarf'],
    parts: [
      // Ordered so each thread sews in one unbroken run — the black of the hat,
      // the eyes and the buttons is one pass, not three. Otherwise a snowman
      // stops the machine to rethread the same spool twice over.
      { name: 'Base', d: ellipse(50, 76, 30, 22), color: WHITE },
      { name: 'Middle', d: ellipse(50, 54, 23, 18), color: WHITE },
      { name: 'Head', d: `${circle(50, 34, 17)} ${SNOWMAN_FACE} ${SNOWMAN_MOUTH}`, color: WHITE },
      {
        name: 'Shading',
        // A snowman on a white ground is invisible without it, and white thread
        // on white fabric needs the shadow more still.
        d:
          'M 66 24 C 76 30 78 44 68 48 C 74 42 72 32 62 27 Z ' +
          'M 70 42 C 76 48 76 62 66 68 C 74 60 74 50 66 44 Z ' +
          'M 74 62 C 82 70 82 86 68 94 C 78 84 78 72 70 64 Z',
        color: SILVER_LIGHT,
      },
      {
        name: 'Arms',
        d:
          'M 26 52 L 6 42 L 4 46 L 24 57 Z M 10 44 L 2 36 L 0 40 L 8 47 Z ' +
          'M 74 52 L 94 42 L 96 46 L 76 57 Z M 90 44 L 98 36 L 100 40 L 92 47 Z',
        color: BROWN,
      },
      { name: 'Hat crown', d: 'M 34 2 L 66 2 L 66 20 L 34 20 Z', color: INK },
      { name: 'Hat brim', d: 'M 26 20 L 74 20 L 74 26 L 26 26 Z', color: INK },
      { name: 'Face', d: `${SNOWMAN_FACE} ${SNOWMAN_MOUTH}`, color: INK },
      { name: 'Buttons', d: SNOWMAN_BUTTONS, color: INK },
      { name: 'Hat band', d: 'M 34 14 L 66 14 L 66 21 L 34 21 Z', color: RED },
      {
        name: 'Scarf',
        d:
          'M 30 46 C 40 52 60 52 70 46 L 72 56 C 60 62 40 62 28 56 Z ' +
          'M 66 54 L 78 52 L 82 74 L 70 76 Z',
        color: RED,
      },
      { name: 'Nose', d: 'M 50 34 L 72 38 L 50 41 Z', color: ORANGE },
    ],
  },
  {
    id: 'christmas-snowflake',
    name: 'Snowflake',
    category: 'christmas',
    keywords: ['snow', 'ice', 'winter', 'crystal', 'frost'],
    parts: [
      {
        name: 'Crystal',
        d:
          'M 46 4 L 54 4 L 54 30 L 76 17 L 80 24 L 58 37 L 58 43 L 80 30 L 84 37 L 62 50 ' +
          'L 84 63 L 80 70 L 58 57 L 58 63 L 80 76 L 76 83 L 54 70 L 54 96 L 46 96 L 46 70 ' +
          'L 24 83 L 20 76 L 42 63 L 42 57 L 20 70 L 16 63 L 38 50 ' +
          'L 16 37 L 20 30 L 42 43 L 42 37 L 20 24 L 24 17 L 46 30 Z',
        color: SKY,
      },
      { name: 'Hub', d: circle(50, 50, 8), color: WHITE },
    ],
  },
  {
    id: 'christmas-snowflake-branched',
    name: 'Branched snowflake',
    category: 'christmas',
    keywords: ['snow', 'ice', 'winter', 'crystal', 'six', 'dendrite'],
    parts: [
      {
        name: 'Crystal',
        // Six arms, each with a pair of side branches at the same two heights.
        // The regularity is the point: a real dendrite is symmetric, and an
        // irregular one just looks like a mistake.
        d:
          'M 45 2 L 55 2 L 55 98 L 45 98 Z ' +
          'M 8 21 L 13 12 L 92 79 L 87 88 Z ' +
          'M 92 21 L 87 12 L 8 79 L 13 88 Z ' +
          'M 50 10 L 68 22 L 63 29 L 50 20 L 37 29 L 32 22 Z ' +
          'M 50 90 L 68 78 L 63 71 L 50 80 L 37 71 L 32 78 Z ' +
          'M 14 26 L 35 28 L 34 37 L 21 36 L 22 48 L 13 47 Z ' +
          'M 86 74 L 65 72 L 66 63 L 79 64 L 78 52 L 87 53 Z ' +
          'M 86 26 L 65 28 L 66 37 L 79 36 L 78 48 L 87 47 Z ' +
          'M 14 74 L 35 72 L 34 63 L 21 64 L 22 52 L 13 53 Z',
        color: SKY,
      },
      { name: 'Hub', d: circle(50, 50, 10), color: WHITE },
    ],
  },
  {
    id: 'christmas-snowflake-fine',
    name: 'Fine snowflake',
    category: 'christmas',
    keywords: ['snow', 'ice', 'winter', 'crystal', 'delicate', 'star'],
    parts: [
      { name: 'Crystal', d: star(50, 50, 48, 12, 6), color: SKY },
      { name: 'Inner star', d: star(50, 50, 26, 8, 6, Math.PI / 6), color: WHITE },
      { name: 'Hub', d: circle(50, 50, 7), color: SKY_LIGHT },
    ],
  },
  {
    id: 'christmas-ornament',
    name: 'Ornament',
    category: 'christmas',
    keywords: ['bauble', 'ball', 'tree', 'decoration', 'hanging'],
    parts: [
      { name: 'Hook', d: 'M 46 2 C 54 2 58 6 58 12 L 52 12 C 52 9 50 8 46 8 Z', color: GOLD_DARK },
      { name: 'Cap', d: 'M 40 12 L 60 12 L 58 24 L 42 24 Z', color: GOLD },
      { name: 'Ball', d: circle(50, 60, 38), color: RED },
      {
        name: 'Shading',
        d: 'M 68 32 C 82 44 84 68 72 82 C 66 88 58 92 50 94 C 68 88 78 68 74 50 C 72 42 70 36 66 30 Z',
        color: RED_DARK,
      },
      { name: 'Shine', d: 'M 28 42 C 32 34 40 30 46 32 L 42 42 C 38 42 34 46 33 50 Z', color: RED_LIGHT },
      {
        name: 'Band',
        d: 'M 13 52 C 22 46 34 50 50 50 C 66 50 78 46 87 52 L 87 62 C 78 56 66 60 50 60 C 34 60 22 56 13 62 Z',
        color: GOLD_LIGHT,
      },
    ],
  },
  {
    id: 'christmas-candy-cane',
    name: 'Candy cane',
    category: 'christmas',
    keywords: ['peppermint', 'sweet', 'stripe', 'treat', 'hook'],
    parts: [
      {
        name: 'Cane',
        d:
          'M 34 98 L 34 34 C 34 16 46 4 62 4 C 78 4 90 16 90 34 L 90 44 L 72 44 ' +
          'L 72 34 C 72 28 68 22 62 22 C 56 22 52 28 52 34 L 52 98 Z',
        color: WHITE,
      },
      {
        name: 'Stripes',
        // Angled, not horizontal: a candy cane's stripes wrap the stick, and
        // the angle is what says "wrapped" rather than "ringed".
        d:
          'M 34 88 L 46 76 L 52 76 L 52 90 L 40 98 L 34 98 Z ' +
          'M 34 62 L 52 44 L 52 58 L 34 76 Z ' +
          'M 34 36 L 52 22 L 52 32 L 34 50 Z ' +
          'M 46 14 L 60 4 L 68 6 L 52 22 Z ' +
          'M 76 10 L 88 22 L 90 34 L 76 24 Z ' +
          'M 90 40 L 90 44 L 72 44 L 72 36 Z',
        color: RED,
      },
    ],
  },
  {
    id: 'christmas-holly',
    name: 'Holly',
    category: 'christmas',
    keywords: ['leaves', 'berries', 'sprig', 'wreath', 'green'],
    parts: [
      {
        name: 'Leaves',
        // The spines are the whole identity of a holly leaf: a smooth-edged
        // one is a laurel. Drawn large, so those spines survive being sewn.
        d:
          'M 50 46 C 38 38 22 42 10 32 C 20 28 24 20 20 8 C 30 15 38 11 46 2 ' +
          'C 50 12 58 15 68 12 C 60 22 60 34 68 42 C 58 42 54 44 50 46 Z ' +
          'M 46 52 C 32 52 22 64 8 64 C 14 72 14 82 8 90 C 20 87 30 92 36 98 ' +
          'C 39 89 45 84 54 84 C 47 75 47 63 54 57 C 51 54 48 52 46 52 Z ' +
          'M 56 52 C 70 52 80 64 94 64 C 88 72 88 82 94 90 C 82 87 72 92 66 98 ' +
          'C 63 89 57 84 48 84 C 55 75 55 63 48 57 C 51 54 54 52 56 52 Z',
        color: PINE,
      },
      {
        name: 'Veins',
        d: 'M 45 8 L 49 8 L 49 44 L 45 44 Z M 34 60 L 38 60 L 36 94 L 32 94 Z M 66 60 L 70 60 L 68 94 L 64 94 Z',
        color: PINE_DARK,
      },
      { name: 'Berries', d: `${circle(38, 40, 11)} ${circle(60, 44, 11)} ${circle(48, 58, 11)}`, color: RED },
      {
        name: 'Berry shine',
        d: `${circle(34, 36, 3.5)} ${circle(56, 40, 3.5)} ${circle(44, 54, 3.5)}`,
        color: RED_LIGHT,
      },
    ],
  },
  {
    id: 'christmas-gift',
    name: 'Gift',
    category: 'christmas',
    keywords: ['present', 'box', 'ribbon', 'bow', 'wrapped'],
    parts: [
      {
        name: 'Box',
        // Four panels around the ribbon channel; see the note at the top of
        // the file for why the ribbon is not laid on top.
        d:
          'M 8 38 L 44 38 L 44 96 L 8 96 Z M 56 38 L 92 38 L 92 96 L 56 96 Z',
        color: RED,
      },
      { name: 'Box shading', d: 'M 70 38 L 92 38 L 92 96 L 70 96 Z', color: RED_DARK },
      { name: 'Lid', d: 'M 4 24 L 44 24 L 44 38 L 4 38 Z M 56 24 L 96 24 L 96 38 L 56 38 Z', color: RED_LIGHT },
      { name: 'Ribbon', d: 'M 44 24 L 56 24 L 56 96 L 44 96 Z M 4 24 L 96 24 L 96 38 L 4 38 Z', color: GOLD },
      {
        name: 'Bow',
        // The loops stop short of the top edge. Drawn any closer, satin rails
        // and pull compensation push the sewn outline past the placement box,
        // which the catalogue's own stitch test refuses.
        d:
          'M 50 24 C 44 24 34 20 30 15 C 26 9 30 5 38 5 C 45 5 50 13 50 24 Z ' +
          'M 50 24 C 56 24 66 20 70 15 C 74 9 70 5 62 5 C 55 5 50 13 50 24 Z ' +
          'M 44 17 L 56 17 L 58 26 L 42 26 Z',
        color: GOLD,
      },
      {
        name: 'Bow shading',
        d: 'M 50 24 C 56 24 66 20 70 15 C 74 9 70 5 62 5 C 66 10 60 18 50 24 Z',
        color: GOLD_DARK,
      },
    ],
  },
  {
    id: 'christmas-bell',
    name: 'Bell',
    category: 'christmas',
    keywords: ['jingle', 'ring', 'chime', 'gold', 'sleigh'],
    parts: [
      {
        name: 'Bell',
        d:
          'M 50 6 C 55 6 59 10 59 15 C 59 17 58 19 57 21 ' +
          'C 74 27 84 44 84 64 C 84 74 86 80 92 84 L 8 84 ' +
          'C 14 80 16 74 16 64 C 16 44 26 27 43 21 ' +
          'C 42 19 41 17 41 15 C 41 10 45 6 50 6 Z',
        color: GOLD,
      },
      { name: 'Shine', d: 'M 30 44 C 32 36 36 30 42 26 L 46 32 C 41 36 38 42 37 48 Z', color: GOLD_LIGHT },
      { name: 'Shading', d: 'M 62 24 C 78 34 84 48 84 64 C 84 74 86 80 92 84 L 62 84 Z', color: GOLD_DARK },
      { name: 'Rim', d: 'M 8 84 L 92 84 L 92 92 L 8 92 Z', color: GOLD_DARK },
      { name: 'Clapper', d: circle(50, 93, 6), color: GOLD_DARK },
    ],
  },
  {
    id: 'christmas-stocking',
    name: 'Stocking',
    category: 'christmas',
    keywords: ['sock', 'fireplace', 'presents', 'hang', 'chimney'],
    parts: [
      {
        name: 'Sock',
        d:
          'M 24 24 L 66 24 L 66 56 C 66 62 62 66 54 70 ' +
          'C 40 78 30 84 22 92 C 14 98 4 96 4 86 C 4 76 12 68 24 60 Z',
        color: RED,
      },
      {
        name: 'Heel and toe',
        d:
          'M 24 60 C 18 66 12 72 8 78 C 4 84 6 92 14 92 C 8 86 12 76 24 68 Z ' +
          'M 4 86 C 4 78 10 72 18 80 C 24 86 22 96 12 96 C 6 96 4 92 4 86 Z',
        color: RED_DARK,
      },
      { name: 'Cuff', d: 'M 20 4 L 70 4 L 70 26 L 20 26 Z', color: WHITE },
      { name: 'Cuff shading', d: 'M 56 4 L 70 4 L 70 26 L 56 26 Z', color: SILVER_LIGHT },
      { name: 'Hanger', d: 'M 70 6 L 78 6 L 78 22 L 70 22 Z', color: PINE },
      {
        name: 'Trim',
        d: 'M 24 34 L 66 34 L 66 42 L 24 42 Z',
        color: PINE,
      },
    ],
  },
  {
    id: 'christmas-wreath',
    name: 'Wreath',
    category: 'christmas',
    keywords: ['door', 'circle', 'garland', 'holly', 'ring'],
    parts: [
      { name: 'Ring', d: ring(50, 50, 38, 22), color: PINE },
      {
        name: 'Sprigs',
        // Tufts breaking the outer edge, so the wreath is foliage and not a
        // green doughnut.
        d:
          `${circle(50, 12, 9)} ${circle(77, 23, 9)} ${circle(88, 50, 9)} ` +
          `${circle(77, 77, 9)} ${circle(50, 88, 9)} ${circle(23, 77, 9)} ` +
          `${circle(12, 50, 9)} ${circle(23, 23, 9)}`,
        color: PINE_DARK,
      },
      {
        name: 'Berries',
        d:
          `${circle(36, 22, 4.5)} ${circle(68, 30, 4.5)} ${circle(78, 62, 4.5)} ` +
          `${circle(38, 80, 4.5)} ${circle(18, 42, 4.5)} ${circle(60, 76, 4.5)}`,
        color: RED,
      },
      {
        name: 'Bow',
        d:
          'M 50 88 C 42 88 30 94 26 100 L 24 88 C 30 82 42 80 50 84 Z ' +
          'M 50 88 C 58 88 70 94 74 100 L 76 88 C 70 82 58 80 50 84 Z ' +
          'M 43 82 L 57 82 L 59 96 L 41 96 Z',
        color: RED_DARK,
      },
    ],
  },
  {
    id: 'christmas-reindeer',
    name: 'Reindeer',
    category: 'christmas',
    keywords: ['deer', 'rudolph', 'antlers', 'sleigh', 'red nose'],
    parts: [
      {
        name: 'Antlers',
        // Branched and asymmetric within each side, because a symmetric rack
        // reads as a plant.
        d:
          'M 30 34 L 22 20 L 10 16 L 6 6 L 12 4 L 16 12 L 26 16 L 22 4 L 28 2 L 34 18 L 38 32 Z ' +
          'M 70 34 L 78 20 L 90 16 L 94 6 L 88 4 L 84 12 L 74 16 L 78 4 L 72 2 L 66 18 L 62 32 Z ' +
          'M 16 14 L 4 22 L 8 27 L 20 20 Z M 84 14 L 96 22 L 92 27 L 80 20 Z',
        color: WOOD_DARK,
      },
      { name: 'Ears', d: `${ellipse(24, 44, 10, 7)} ${ellipse(76, 44, 10, 7)}`, color: BROWN_DARK },
      {
        name: 'Head',
        d: 'M 50 26 C 68 26 78 40 78 58 C 78 76 66 90 50 90 C 34 90 22 76 22 58 C 22 40 32 26 50 26 Z',
        color: BROWN,
      },
      {
        name: 'Muzzle',
        d: ellipse(50, 74, 20, 15),
        color: WOOD_LIGHT,
      },
      { name: 'Eyes', d: `${circle(38, 52, 5)} ${circle(62, 52, 5)}`, color: INK },
      { name: 'Eye shine', d: `${circle(36, 50, 1.8)} ${circle(60, 50, 1.8)}`, color: WHITE },
      { name: 'Nose', d: ellipse(50, 70, 10, 8), color: RED },
      { name: 'Nose shine', d: circle(47, 67, 3), color: RED_LIGHT },
      { name: 'Mouth', d: 'M 46 80 L 54 80 L 54 88 L 46 88 Z M 38 84 L 62 84 L 62 88 L 38 88 Z', color: INK_SOFT },
    ],
  },
  {
    id: 'christmas-santa-hat',
    name: 'Santa hat',
    category: 'christmas',
    keywords: ['father christmas', 'red', 'pompom', 'costume', 'cap'],
    parts: [
      {
        name: 'Cap',
        d:
          'M 8 68 C 8 40 26 18 52 18 C 66 18 76 22 84 30 ' +
          'C 76 40 68 50 62 58 C 56 66 52 70 46 72 L 8 72 Z',
        color: RED,
      },
      {
        name: 'Tail',
        d: 'M 84 30 C 90 36 94 44 94 52 C 94 60 88 66 80 66 C 74 66 70 62 68 56 C 74 48 80 38 84 30 Z',
        color: RED,
      },
      {
        name: 'Shading',
        d: 'M 62 22 C 72 26 80 34 84 30 C 76 40 68 50 62 58 C 56 66 52 70 46 72 L 34 72 C 46 66 56 50 62 22 Z',
        color: RED_DARK,
      },
      {
        name: 'Brim',
        d: 'M 2 66 C 2 62 6 60 12 60 L 52 60 C 58 60 62 62 62 66 L 62 84 C 62 88 58 90 52 90 L 12 90 C 6 90 2 88 2 84 Z',
        color: WHITE,
      },
      { name: 'Pompom', d: circle(81, 56, 14), color: WHITE },
      {
        name: 'Brim shading',
        d: 'M 46 60 L 52 60 C 58 60 62 62 62 66 L 62 84 C 62 88 58 90 52 90 L 46 90 Z',
        color: SILVER_LIGHT,
      },
      { name: 'Pompom shading', d: 'M 88 46 C 96 54 94 68 84 70 C 90 64 90 54 84 48 Z', color: SILVER_LIGHT },
    ],
  },
  {
    id: 'christmas-gingerbread',
    name: 'Gingerbread man',
    category: 'christmas',
    keywords: ['cookie', 'biscuit', 'baking', 'icing', 'treat'],
    parts: [
      {
        name: 'Body',
        d:
          'M 50 2 C 60 2 68 10 68 20 C 68 24 67 27 65 30 L 78 30 ' +
          'C 88 30 96 36 96 44 C 96 52 88 56 78 56 L 68 56 L 72 84 ' +
          'C 74 94 68 98 60 98 C 54 98 50 94 50 88 C 50 94 46 98 40 98 ' +
          'C 32 98 26 94 28 84 L 32 56 L 22 56 C 12 56 4 52 4 44 ' +
          'C 4 36 12 30 22 30 L 35 30 C 33 27 32 24 32 20 C 32 10 40 2 50 2 Z',
        color: WOOD,
      },
      {
        name: 'Shading',
        d: 'M 60 4 C 66 8 68 14 68 20 C 68 24 67 27 65 30 L 78 30 C 88 30 96 36 96 44 C 96 52 88 56 78 56 L 68 56 L 72 84 C 74 94 68 98 60 98 C 66 92 66 84 64 74 L 58 40 Z',
        color: BROWN,
      },
      { name: 'Eyes', d: `${circle(42, 18, 3.5)} ${circle(58, 18, 3.5)}`, color: INK },
      { name: 'Mouth', d: 'M 40 25 C 44 30 56 30 60 25 L 62 28 C 58 34 42 34 38 28 Z', color: INK },
      {
        name: 'Icing',
        d:
          'M 20 38 C 26 44 34 44 40 38 L 42 44 C 34 52 24 52 18 44 Z ' +
          'M 60 38 C 66 44 74 44 80 38 L 82 44 C 74 52 64 52 58 44 Z ' +
          'M 34 62 C 40 68 60 68 66 62 L 68 68 C 60 76 40 76 32 68 Z',
        color: WHITE,
      },
      { name: 'Buttons', d: `${circle(50, 48, 5)} ${circle(50, 64, 5)}`, color: RED },
    ],
  },
  {
    id: 'christmas-mitten',
    name: 'Mitten',
    category: 'christmas',
    keywords: ['glove', 'winter', 'knit', 'warm', 'hand'],
    parts: [
      {
        name: 'Mitten',
        // A thumb is not optional: without one the shape is a sock.
        d:
          'M 30 30 L 74 30 C 84 30 90 38 90 50 L 90 76 C 90 88 84 96 74 96 ' +
          'L 40 96 C 30 96 24 88 24 76 L 24 62 L 16 62 C 8 62 2 56 2 46 ' +
          'C 2 36 8 30 16 30 C 22 30 26 34 28 40 L 30 46 Z',
        color: RED,
      },
      {
        name: 'Shading',
        d: 'M 60 30 L 74 30 C 84 30 90 38 90 50 L 90 76 C 90 88 84 96 74 96 L 60 96 Z',
        color: RED_DARK,
      },
      { name: 'Cuff', d: 'M 26 12 L 92 12 L 92 34 L 26 34 Z', color: WHITE },
      { name: 'Cuff shading', d: 'M 78 12 L 92 12 L 92 34 L 78 34 Z', color: SILVER_LIGHT },
      {
        name: 'Pattern',
        d:
          'M 40 52 L 48 44 L 56 52 L 48 60 Z M 62 60 L 70 52 L 78 60 L 70 68 Z ' +
          'M 40 76 L 48 68 L 56 76 L 48 84 Z',
        color: CREAM,
      },
      { name: 'Cord', d: 'M 92 18 C 98 24 98 34 92 40 L 88 34 C 92 30 92 26 88 22 Z', color: PINE },
    ],
  },
];
