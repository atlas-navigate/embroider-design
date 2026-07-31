import type { LibraryShape } from '../types.js';
import { circle, ellipse, star } from './draw.js';
import {
  CREAM,
  GOLD,
  GREEN,
  GREEN_DARK,
  GREEN_LIGHT,
  INK,
  INK_SOFT,
  LAVENDER,
  ORANGE,
  ORANGE_DARK,
  PINK,
  PINK_DARK,
  PURPLE,
  RED,
  RED_DARK,
  SHADOW,
  SILVER,
  SILVER_LIGHT,
  SKY_LIGHT,
  TEAL,
  WHITE,
  WOOD,
  WOOD_DARK,
  YELLOW,
  YELLOW_DARK,
  YELLOW_LIGHT,
} from './palette.js';

/**
 * Nature.
 *
 * Insects need three body sections and six legs to read as insects, and the
 * flowers need their petal counts kept honest — a "six-petal flower" with seven
 * petals is the sort of thing nobody notices consciously and everybody notices.
 */

const FLOWER_CENTRE = circle(50, 50, 15);

/** `n` petals evenly spaced about the centre, each a pointed oval. */
function petals(count: number, length: number, width: number): string {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Tip, then the two shoulders, then back through the centre.
    const tip = [50 + cos * length, 50 + sin * length];
    const leftShoulder = [50 + cos * length * 0.45 - sin * width, 50 + sin * length * 0.45 + cos * width];
    const rightShoulder = [50 + cos * length * 0.45 + sin * width, 50 + sin * length * 0.45 - cos * width];
    const n = (v: number): string => String(+v.toFixed(2));
    out.push(
      `M 50 50 C ${n(leftShoulder[0])} ${n(leftShoulder[1])} ${n(tip[0])} ${n(tip[1])} ` +
        `${n(tip[0])} ${n(tip[1])} C ${n(tip[0])} ${n(tip[1])} ${n(rightShoulder[0])} ${n(rightShoulder[1])} 50 50 Z`,
    );
  }
  return out.join(' ');
}

export const NATURE_SHAPES: LibraryShape[] = [
  {
    id: 'nature-butterfly',
    name: 'Butterfly',
    category: 'nature',
    keywords: ['insect', 'wings', 'spring', 'garden', 'monarch'],
    parts: [
      {
        name: 'Wings',
        // Forewing bigger than hindwing on each side, which is true of every
        // butterfly and is what stops the shape reading as a bow tie.
        d:
          'M 46 30 C 38 12 24 2 14 4 C 4 6 2 20 8 32 C 14 44 30 50 46 50 Z ' +
          'M 46 52 C 32 52 18 60 14 72 C 10 84 18 96 28 94 C 38 92 44 76 46 60 Z ' +
          'M 54 30 C 62 12 76 2 86 4 C 96 6 98 20 92 32 C 86 44 70 50 54 50 Z ' +
          'M 54 52 C 68 52 82 60 86 72 C 90 84 82 96 72 94 C 62 92 56 76 54 60 Z',
        color: ORANGE,
      },
      {
        name: 'Wing edges',
        d:
          'M 14 4 C 24 2 38 12 46 30 L 44 36 C 36 20 24 10 14 10 Z ' +
          'M 86 4 C 76 2 62 12 54 30 L 56 36 C 64 20 76 10 86 10 Z ' +
          'M 28 94 C 18 96 10 84 14 72 L 20 74 C 18 84 22 92 30 90 Z ' +
          'M 72 94 C 82 96 90 84 86 72 L 80 74 C 82 84 78 92 70 90 Z',
        color: ORANGE_DARK,
      },
      {
        name: 'Spots',
        d:
          `${circle(26, 20, 5)} ${circle(74, 20, 5)} ${circle(30, 74, 4)} ${circle(70, 74, 4)} ` +
          `${circle(16, 30, 3.5)} ${circle(84, 30, 3.5)}`,
        color: CREAM,
      },
      {
        name: 'Body',
        d: 'M 50 22 C 53 22 55 26 55 34 L 55 84 C 55 92 53 96 50 96 C 47 96 45 92 45 84 L 45 34 C 45 26 47 22 50 22 Z',
        color: INK,
      },
      { name: 'Head', d: circle(50, 20, 7), color: INK },
      {
        name: 'Antennae',
        d: 'M 46 16 L 30 2 L 27 6 L 44 20 Z M 54 16 L 70 2 L 73 6 L 56 20 Z',
        color: INK_SOFT,
      },
    ],
  },
  {
    id: 'nature-bee',
    name: 'Bee',
    category: 'nature',
    keywords: ['insect', 'honey', 'buzz', 'garden', 'bumblebee'],
    parts: [
      {
        name: 'Wings',
        d:
          'M 36 34 C 24 20 10 14 4 20 C 0 26 8 40 24 46 C 30 48 34 44 36 40 Z ' +
          'M 64 34 C 76 20 90 14 96 20 C 100 26 92 40 76 46 C 70 48 66 44 64 40 Z',
        color: SKY_LIGHT,
      },
      { name: 'Wing veins', d: 'M 8 22 L 34 40 L 33 44 L 6 26 Z M 92 22 L 66 40 L 67 44 L 94 26 Z', color: SILVER },
      { name: 'Body', d: ellipse(50, 62, 28, 32), color: YELLOW },
      {
        name: 'Stripes',
        // Curved to wrap the abdomen; straight bars flatten it.
        d:
          'M 24 50 C 34 44 66 44 76 50 L 74 60 C 64 54 36 54 26 60 Z ' +
          'M 26 70 C 36 64 64 64 74 70 L 70 80 C 62 74 38 74 30 80 Z ' +
          'M 34 88 C 40 84 60 84 66 88 L 60 94 C 56 92 44 92 40 94 Z',
        color: INK,
      },
      { name: 'Head', d: `${circle(50, 26, 18)} ${circle(43, 22, 4)} ${circle(57, 22, 4)}`, color: INK },
      { name: 'Eyes', d: `${circle(43, 22, 4)} ${circle(57, 22, 4)}`, color: WHITE },
      { name: 'Antennae', d: 'M 44 12 L 34 2 L 31 6 L 42 16 Z M 56 12 L 66 2 L 69 6 L 58 16 Z', color: INK_SOFT },
    ],
  },
  {
    id: 'nature-ladybug',
    name: 'Ladybug',
    category: 'nature',
    keywords: ['insect', 'beetle', 'spots', 'garden', 'ladybird'],
    parts: [
      {
        name: 'Legs',
        d:
          'M 24 44 L 4 34 L 2 39 L 22 49 Z M 20 62 L 0 62 L 0 67 L 20 67 Z ' +
          'M 24 78 L 6 90 L 9 94 L 27 83 Z M 76 44 L 96 34 L 98 39 L 78 49 Z ' +
          'M 80 62 L 100 62 L 100 67 L 80 67 Z M 76 78 L 94 90 L 91 94 L 73 83 Z',
        color: INK_SOFT,
      },
      { name: 'Shell', d: ellipse(50, 60, 38, 38), color: RED },
      { name: 'Shell shading', d: 'M 66 30 C 80 38 88 52 88 62 C 88 82 72 98 50 98 C 68 92 78 78 78 60 C 78 48 74 38 66 30 Z', color: RED_DARK },
      // Head, wing split and spots are all black and sew in one run.
      { name: 'Head', d: 'M 50 8 C 62 8 70 16 70 26 L 30 26 C 30 16 38 8 50 8 Z', color: INK },
      { name: 'Split', d: 'M 47 24 L 53 24 L 53 98 L 47 98 Z', color: INK },
      {
        name: 'Spots',
        d:
          `${circle(30, 46, 7)} ${circle(70, 46, 7)} ${circle(26, 68, 6)} ` +
          `${circle(74, 68, 6)} ${circle(38, 84, 5)} ${circle(62, 84, 5)}`,
        color: INK,
      },
      { name: 'Eyes', d: `${circle(41, 18, 4)} ${circle(59, 18, 4)}`, color: WHITE },
    ],
  },
  {
    id: 'nature-dragonfly',
    name: 'Dragonfly',
    category: 'nature',
    keywords: ['insect', 'wings', 'pond', 'summer', 'darter'],
    parts: [
      {
        name: 'Wings',
        // Four, long and narrow, angled forward and back. Two wings makes a
        // damselfly at best and a moth at worst.
        d:
          'M 44 30 C 30 22 12 18 4 22 C 0 26 6 34 20 38 C 30 41 40 38 44 34 Z ' +
          'M 56 30 C 70 22 88 18 96 22 C 100 26 94 34 80 38 C 70 41 60 38 56 34 Z ' +
          'M 44 42 C 32 42 16 48 10 56 C 6 62 14 66 26 62 C 36 59 42 50 44 44 Z ' +
          'M 56 42 C 68 42 84 48 90 56 C 94 62 86 66 74 62 C 64 59 58 50 56 44 Z',
        color: SKY_LIGHT,
      },
      {
        name: 'Wing veins',
        d:
          'M 8 24 L 44 32 L 44 35 L 8 28 Z M 92 24 L 56 32 L 56 35 L 92 28 Z ' +
          'M 12 58 L 44 44 L 45 47 L 14 61 Z M 88 58 L 56 44 L 55 47 L 86 61 Z',
        color: TEAL,
      },
      {
        name: 'Body',
        d: 'M 50 20 C 54 20 56 24 56 32 L 55 92 C 55 96 53 98 50 98 C 47 98 45 96 45 92 L 44 32 C 44 24 46 20 50 20 Z',
        color: TEAL,
      },
      {
        name: 'Segments',
        d: 'M 45 48 L 55 48 L 55 52 L 45 52 Z M 45 60 L 55 60 L 55 64 L 45 64 Z M 46 72 L 54 72 L 54 76 L 46 76 Z M 46 84 L 54 84 L 54 88 L 46 88 Z',
        color: GREEN_DARK,
      },
      { name: 'Head', d: circle(50, 14, 11), color: GREEN },
      { name: 'Eyes', d: `${circle(43, 11, 5)} ${circle(57, 11, 5)}`, color: INK },
    ],
  },
  {
    id: 'nature-flower-5',
    name: 'Flower',
    category: 'nature',
    keywords: ['bloom', 'petals', 'garden', 'spring', 'five'],
    parts: [
      { name: 'Petals', d: petals(5, 48, 22), color: PINK },
      { name: 'Petal shading', d: petals(5, 26, 12), color: PINK_DARK },
      { name: 'Centre', d: FLOWER_CENTRE, color: YELLOW },
      { name: 'Pollen', d: `${circle(46, 46, 3)} ${circle(55, 48, 3)} ${circle(49, 55, 3)}`, color: YELLOW_DARK },
    ],
  },
  {
    id: 'nature-flower-6',
    name: 'Six-petal flower',
    category: 'nature',
    keywords: ['bloom', 'petals', 'garden', 'six', 'daisy'],
    parts: [
      { name: 'Petals', d: petals(6, 48, 19), color: PURPLE },
      { name: 'Petal shading', d: petals(6, 26, 10), color: LAVENDER },
      { name: 'Centre', d: FLOWER_CENTRE, color: YELLOW },
      { name: 'Pollen', d: `${circle(46, 46, 3)} ${circle(55, 48, 3)} ${circle(49, 55, 3)}`, color: YELLOW_DARK },
    ],
  },
  {
    id: 'nature-flower-8',
    name: 'Eight-petal flower',
    category: 'nature',
    keywords: ['bloom', 'petals', 'garden', 'eight', 'rosette'],
    parts: [
      { name: 'Petals', d: petals(8, 48, 15), color: ORANGE },
      { name: 'Petal shading', d: petals(8, 26, 8), color: ORANGE_DARK },
      { name: 'Centre', d: FLOWER_CENTRE, color: WOOD_DARK },
      { name: 'Pollen', d: `${circle(46, 46, 3)} ${circle(55, 48, 3)} ${circle(49, 55, 3)}`, color: GOLD },
    ],
  },
  {
    id: 'nature-leaf',
    name: 'Leaf',
    category: 'nature',
    keywords: ['plant', 'green', 'foliage', 'nature', 'veins'],
    parts: [
      {
        name: 'Leaf',
        // A drawn-out tip and a shoulder near the base — the asymmetry down the
        // length is what makes it a leaf rather than an eye.
        d:
          'M 62 2 C 78 14 88 34 88 54 C 88 76 74 92 54 96 L 50 96 ' +
          'C 30 92 16 76 16 54 C 16 34 26 14 42 2 Z',
        color: GREEN,
      },
      { name: 'Shading', d: 'M 62 2 C 78 14 88 34 88 54 C 88 76 74 92 54 96 L 52 96 L 52 4 Z', color: GREEN_DARK },
      {
        name: 'Veins',
        d:
          'M 48 4 L 54 4 L 54 96 L 48 96 Z ' +
          'M 51 24 L 70 16 L 72 20 L 51 30 Z M 51 24 L 32 16 L 30 20 L 51 30 Z ' +
          'M 51 46 L 78 38 L 79 42 L 51 52 Z M 51 46 L 24 38 L 23 42 L 51 52 Z ' +
          'M 51 68 L 74 62 L 75 66 L 51 74 Z M 51 68 L 28 62 L 27 66 L 51 74 Z',
        color: GREEN_LIGHT,
      },
      { name: 'Stalk', d: 'M 48 92 L 54 92 L 54 100 L 48 100 Z', color: WOOD_DARK },
    ],
  },
  {
    id: 'nature-tree',
    name: 'Tree',
    category: 'nature',
    keywords: ['oak', 'trunk', 'canopy', 'wood', 'shade'],
    parts: [
      { name: 'Trunk', d: 'M 42 56 L 58 56 L 62 96 L 38 96 Z', color: WOOD },
      { name: 'Branches', d: 'M 44 62 L 24 44 L 20 50 L 44 70 Z M 56 62 L 76 44 L 80 50 L 56 70 Z', color: WOOD },
      { name: 'Bark', d: 'M 50 56 L 58 56 L 62 96 L 50 96 Z M 56 62 L 76 44 L 78 47 L 56 66 Z', color: WOOD_DARK },
      {
        name: 'Canopy',
        // Built from overlapping lobes so the edge is bumpy. A smooth dome is a
        // lollipop, and everyone can tell.
        d:
          `${circle(50, 26, 26)} ${circle(26, 38, 20)} ${circle(74, 38, 20)} ` +
          `${circle(38, 50, 17)} ${circle(62, 50, 17)}`,
        color: GREEN,
      },
      {
        name: 'Canopy shading',
        // One connected crescent down the shaded side. Separate discs read as
        // fruit rather than as shadow.
        d: 'M 64 8 C 82 16 94 30 94 44 C 94 56 84 64 70 66 C 78 58 82 46 78 34 C 74 22 70 14 64 8 Z',
        color: GREEN_DARK,
      },
      { name: 'Highlight', d: 'M 30 14 C 22 22 18 32 18 42 L 28 44 C 28 34 32 24 38 18 Z', color: GREEN_LIGHT },
    ],
  },
  {
    id: 'nature-mountain',
    name: 'Mountain',
    category: 'nature',
    keywords: ['peak', 'range', 'hike', 'snow', 'alps'],
    parts: [
      // The far peak is a colder, darker grey than the near one's shadow —
      // distance drains colour, and it keeps the two greys from merging.
      { name: 'Back peak', d: 'M 68 18 L 100 82 L 44 82 Z', color: INK_SOFT },
      { name: 'Back snow', d: 'M 68 18 L 80 42 L 72 38 L 64 44 L 56 38 Z', color: SILVER_LIGHT },
      { name: 'Front peak', d: 'M 34 6 L 74 82 L 0 82 Z', color: SILVER },
      {
        name: 'Front shading',
        d: 'M 34 6 L 74 82 L 34 82 Z',
        color: SHADOW,
      },
      { name: 'Front snow', d: 'M 34 6 L 50 36 L 42 30 L 34 38 L 26 30 L 18 36 Z', color: WHITE },
      { name: 'Ground', d: 'M 0 82 L 100 82 L 100 94 L 0 94 Z', color: GREEN_DARK },
    ],
  },
  {
    id: 'nature-cloud',
    name: 'Cloud',
    category: 'nature',
    keywords: ['sky', 'weather', 'fluffy', 'rain', 'cumulus'],
    parts: [
      {
        name: 'Cloud',
        // One outline round the whole thing rather than a pile of circles on a
        // bar. The lobes are the same shape either way, but as one contour the
        // cloud has no internal seams to sew over and no square corner where
        // the bar used to end.
        d:
          'M 14 76 C 7 76 2 70 2 63 C 2 56 7 50 14 50 ' +
          'C 15 38 25 28 38 28 C 44 19 55 15 65 19 C 74 23 80 32 80 42 ' +
          'C 89 43 96 51 96 60 C 96 69 88 76 79 76 Z',
        color: WHITE,
      },
      {
        name: 'Shading',
        // A band along the flat base, scalloped where the lobes meet it. Three
        // separate circles underneath read as balls hanging off the cloud.
        d: 'M 14 76 C 18 68 28 66 36 70 C 44 74 54 66 64 68 C 72 70 76 73 79 76 Z',
        color: SILVER_LIGHT,
      },
    ],
  },
  {
    id: 'nature-moon',
    name: 'Crescent moon',
    category: 'nature',
    keywords: ['night', 'sky', 'lunar', 'stars', 'sleep'],
    parts: [
      {
        name: 'Moon',
        // The bite is a circle offset from the disc, which is the only way a
        // crescent ends in true points rather than blunt ones.
        d: `${circle(46, 50, 46)} ${circle(62, 42, 36, false)}`,
        color: GOLD,
      },
      {
        name: 'Craters',
        d: `${circle(26, 46, 7)} ${circle(34, 70, 5)} ${circle(20, 62, 4)}`,
        color: YELLOW_DARK,
      },
      { name: 'Stars', d: `${star(84, 16, 9, 3.5, 4)} ${star(92, 44, 6, 2.5, 4)} ${star(74, 84, 7, 3, 4)}`, color: YELLOW_LIGHT },
    ],
  },
  {
    id: 'nature-rainbow',
    name: 'Rainbow',
    category: 'nature',
    keywords: ['colours', 'arc', 'sky', 'weather', 'pride'],
    parts: [
      { name: 'Red band', d: 'M 2 88 C 2 42 24 12 50 12 C 76 12 98 42 98 88 L 84 88 C 84 50 68 26 50 26 C 32 26 16 50 16 88 Z', color: RED },
      { name: 'Orange band', d: 'M 16 88 C 16 50 32 26 50 26 C 68 26 84 50 84 88 L 70 88 C 70 58 62 40 50 40 C 38 40 30 58 30 88 Z', color: ORANGE },
      { name: 'Yellow band', d: 'M 30 88 C 30 58 38 40 50 40 C 62 40 70 58 70 88 L 56 88 C 56 66 54 54 50 54 C 46 54 44 66 44 88 Z', color: YELLOW },
      { name: 'Green band', d: 'M 44 88 C 44 66 46 54 50 54 C 54 54 56 66 56 88 Z', color: GREEN },
      { name: 'Clouds', d: `${circle(12, 86, 12)} ${circle(26, 89, 9)} ${circle(88, 86, 12)} ${circle(74, 89, 9)}`, color: WHITE },
    ],
  },
  {
    id: 'nature-cactus',
    name: 'Cactus',
    category: 'nature',
    keywords: ['desert', 'succulent', 'plant', 'spines', 'saguaro'],
    parts: [
      {
        name: 'Plant',
        d:
          'M 42 10 C 42 4 46 0 50 0 C 54 0 58 4 58 10 L 58 84 L 42 84 Z ' +
          'M 18 34 C 18 28 22 26 26 26 C 30 26 34 28 34 34 L 34 46 ' +
          'C 34 58 40 64 46 66 L 46 78 C 32 76 18 66 18 48 Z ' +
          'M 82 46 C 82 40 78 38 74 38 C 70 38 66 40 66 46 L 66 54 ' +
          'C 66 64 60 68 54 70 L 54 82 C 68 80 82 70 82 58 Z',
        color: GREEN,
      },
      {
        name: 'Ribs',
        d:
          'M 47 4 L 53 4 L 53 84 L 47 84 Z ' +
          'M 22 30 L 28 30 L 28 48 C 28 60 34 68 44 72 L 42 78 C 28 72 22 62 22 46 Z ' +
          'M 78 42 L 72 42 L 72 56 C 72 66 66 72 56 76 L 58 82 C 72 76 78 68 78 54 Z',
        color: GREEN_DARK,
      },
      { name: 'Flowers', d: `${circle(50, 7, 7)} ${circle(26, 24, 6)}`, color: PINK },
      { name: 'Pot', d: 'M 24 82 L 76 82 L 70 98 C 69 99 67 100 64 100 L 36 100 C 33 100 31 99 30 98 Z', color: ORANGE_DARK },
      { name: 'Pot rim', d: 'M 20 78 L 80 78 L 80 88 L 20 88 Z', color: ORANGE },
    ],
  },
  {
    id: 'nature-mushroom',
    name: 'Mushroom',
    category: 'nature',
    keywords: ['toadstool', 'fungus', 'forest', 'spots', 'fly agaric'],
    parts: [
      {
        name: 'Cap',
        d: 'M 50 6 C 76 6 96 28 96 50 C 96 56 92 58 84 58 L 16 58 C 8 58 4 56 4 50 C 4 28 24 6 50 6 Z',
        color: RED,
      },
      { name: 'Cap shading', d: 'M 66 10 C 84 18 96 34 96 50 C 96 56 92 58 84 58 L 66 58 Z', color: RED_DARK },
      {
        name: 'Spots',
        d:
          `${circle(30, 28, 9)} ${circle(58, 20, 8)} ${circle(76, 38, 8)} ` +
          `${circle(20, 46, 6)} ${circle(46, 44, 6)} ${circle(66, 50, 5)}`,
        color: CREAM,
      },
      {
        name: 'Stalk',
        d: 'M 36 58 L 64 58 L 66 90 C 66 96 60 98 50 98 C 40 98 34 96 34 90 Z',
        color: CREAM,
      },
      { name: 'Skirt', d: 'M 28 58 L 72 58 L 74 68 C 66 72 34 72 26 68 Z', color: CREAM },
      { name: 'Stalk shading', d: 'M 54 68 L 64 68 L 66 90 C 66 96 60 98 50 98 C 56 94 56 80 54 68 Z', color: SILVER_LIGHT },
      { name: 'Grass', d: 'M 4 92 C 12 82 20 84 24 96 C 18 92 10 94 6 98 Z M 96 92 C 88 82 80 84 76 96 C 82 92 90 94 94 98 Z', color: GREEN_DARK },
    ],
  },
];
