import type { LibraryShape } from '../types.js';
import { circle, ring } from './draw.js';
import {
  CREAM,
  CREAM_DARK,
  INK,
  PINK,
  PINK_LIGHT,
  RED,
  RED_DARK,
  SAND,
  SILVER,
  SILVER_DARK,
  SKY,
  SKY_LIGHT,
  WATER,
  WATER_DARK,
  WHITE,
  WOOD,
  WOOD_DARK,
  YELLOW,
} from './palette.js';

/**
 * Nautical.
 *
 * Water is the recurring problem. A single blue shape reads as a hill; what
 * makes it water is a second tone behind the first at a slight offset, so the
 * eye sees one wave passing in front of another. Every sea in this file is
 * built that way.
 */

/** Sandier than the shared orange, and only used here. */
const STARFISH = '#e08a4a';

export const NAUTICAL_SHAPES: LibraryShape[] = [
  {
    id: 'nautical-anchor',
    name: 'Anchor',
    category: 'nautical',
    keywords: ['ship', 'sea', 'boat', 'harbour', 'sailor'],
    parts: [
      {
        name: 'Anchor',
        d:
          'M 44 22 L 56 22 L 56 88 L 44 88 Z ' +
          'M 26 34 L 74 34 L 74 44 L 26 44 Z ' +
          'M 6 54 L 16 54 C 16 74 30 88 50 88 C 70 88 84 74 84 54 L 94 54 ' +
          'C 94 82 74 98 50 98 C 26 98 6 82 6 54 Z',
        color: SILVER,
      },
      // Shackle ring and flukes are the same dark steel and sew in one pass.
      { name: 'Ring', d: ring(50, 12, 11, 6), color: SILVER_DARK },
      {
        name: 'Flukes',
        d: 'M 6 54 L 16 54 L 16 44 L 2 62 Z M 94 54 L 84 54 L 84 44 L 98 62 Z',
        color: SILVER_DARK,
      },
      { name: 'Shine', d: 'M 44 26 L 48 26 L 48 84 L 44 84 Z', color: WHITE },
    ],
  },
  {
    id: 'nautical-ship-wheel',
    name: 'Ship wheel',
    category: 'nautical',
    keywords: ['helm', 'steering', 'captain', 'sail', 'boat'],
    parts: [
      { name: 'Rim', d: ring(50, 50, 40, 30), color: WOOD },
      { name: 'Hub', d: circle(50, 50, 14), color: WOOD },
      // Spokes, hub centre and knobs are all the dark wood and sew as one pass.
      {
        name: 'Handles',
        // Eight spokes running past the rim into knobbed handles, which is what
        // makes it a helm and not a bicycle wheel.
        d:
          'M 46 2 L 54 2 L 54 98 L 46 98 Z M 2 46 L 98 46 L 98 54 L 2 54 Z ' +
          'M 13 7 L 7 13 L 87 93 L 93 87 Z M 87 7 L 93 13 L 13 93 L 7 87 Z',
        color: WOOD_DARK,
      },
      { name: 'Hub centre', d: circle(50, 50, 6), color: WOOD_DARK },
      {
        name: 'Knobs',
        d:
          `${circle(50, 6, 5)} ${circle(50, 94, 5)} ${circle(6, 50, 5)} ${circle(94, 50, 5)} ` +
          `${circle(18, 18, 5)} ${circle(82, 18, 5)} ${circle(18, 82, 5)} ${circle(82, 82, 5)}`,
        color: WOOD_DARK,
      },
    ],
  },
  {
    id: 'nautical-sailboat',
    name: 'Sailboat',
    category: 'nautical',
    keywords: ['yacht', 'sail', 'boat', 'sea', 'sailing'],
    parts: [
      { name: 'Mast', d: 'M 48 4 L 53 4 L 53 68 L 48 68 Z', color: WOOD_DARK },
      { name: 'Mainsail', d: 'M 53 8 L 88 66 L 53 66 Z', color: CREAM },
      { name: 'Jib', d: 'M 46 12 L 46 66 L 14 66 Z', color: CREAM_DARK },
      { name: 'Pennant', d: 'M 53 4 L 74 9 L 53 14 Z', color: RED },
      {
        name: 'Hull',
        d: 'M 6 68 L 94 68 L 82 88 C 80 91 76 92 70 92 L 30 92 C 24 92 20 91 18 88 Z',
        color: RED_DARK,
      },
      { name: 'Gunwale', d: 'M 6 68 L 94 68 L 92 75 L 8 75 Z', color: WOOD },
      {
        name: 'Sea',
        // Two tones: the far swell behind, the near one in front.
        d: 'M 0 84 C 14 78 26 90 40 84 C 54 78 66 90 80 84 C 90 80 96 82 100 86 L 100 100 L 0 100 Z',
        color: WATER_DARK,
      },
      {
        name: 'Foam',
        d: 'M 0 92 C 14 86 26 98 40 92 C 54 86 66 98 80 92 C 90 88 96 90 100 94 L 100 100 L 0 100 Z',
        color: WATER,
      },
    ],
  },
  {
    id: 'nautical-lighthouse',
    name: 'Lighthouse',
    category: 'nautical',
    keywords: ['beacon', 'coast', 'light', 'tower', 'sea'],
    parts: [
      // The two yellows sew together, then the tower, then all the grey metal.
      { name: 'Beams', d: 'M 46 20 L 2 6 L 2 30 Z M 54 20 L 98 6 L 98 30 Z', color: YELLOW },
      { name: 'Lantern', d: 'M 38 12 L 62 12 L 62 30 L 38 30 Z', color: YELLOW },
      {
        name: 'Tower',
        d: 'M 38 34 L 62 34 L 72 88 L 28 88 Z',
        color: WHITE,
      },
      {
        name: 'Stripes',
        // Following the taper, so the tower reads as a cone rather than a
        // rectangle with lines on it.
        d: 'M 39 42 L 61 42 L 62.5 52 L 37.5 52 Z M 41 62 L 59 62 L 65 72 L 35 72 Z M 43 82 L 57 82 L 72 88 L 28 88 Z',
        color: RED,
      },
      { name: 'Roof', d: 'M 50 0 L 68 12 L 32 12 Z', color: RED_DARK },
      { name: 'Gallery', d: 'M 32 30 L 68 30 L 68 36 L 32 36 Z', color: SILVER_DARK },
      { name: 'Lantern frame', d: 'M 38 12 L 62 12 L 62 16 L 38 16 Z M 46 12 L 54 12 L 54 30 L 46 30 Z', color: SILVER_DARK },
      { name: 'Rocks', d: 'M 10 88 C 22 80 34 86 44 86 C 56 86 68 80 90 88 L 96 100 L 4 100 Z', color: SILVER_DARK },
    ],
  },
  {
    id: 'nautical-whale',
    name: 'Whale',
    category: 'nautical',
    keywords: ['sea', 'ocean', 'spout', 'blue whale', 'mammal'],
    parts: [
      {
        name: 'Body',
        // A blunt head and a long tapering tail stock: a smoothly tapered
        // spindle reads as a fish.
        d:
          'M 26 34 C 46 30 64 38 74 52 C 82 62 90 68 98 70 ' +
          'C 92 76 82 78 74 74 C 64 86 46 92 30 88 C 12 84 2 70 4 56 ' +
          'C 6 44 14 36 26 34 Z',
        color: WATER,
      },
      {
        name: 'Belly',
        d: 'M 30 88 C 46 92 64 86 74 74 C 66 82 52 86 38 84 C 26 82 18 76 14 68 C 16 78 22 86 30 88 Z',
        color: SKY_LIGHT,
      },
      { name: 'Fluke', d: 'M 74 52 C 82 44 92 38 100 38 L 96 56 L 98 70 C 90 68 82 62 74 52 Z', color: WATER_DARK },
      { name: 'Fin', d: 'M 40 64 C 48 62 56 66 60 74 C 52 80 42 78 36 72 C 34 68 36 65 40 64 Z', color: WATER_DARK },
      { name: 'Eye', d: circle(22, 52, 5), color: WHITE },
      { name: 'Pupil', d: circle(21, 52, 2.8), color: INK },
      { name: 'Spout', d: 'M 24 30 C 22 20 26 10 34 4 C 32 14 32 24 34 32 Z M 20 32 C 12 26 8 16 10 6 C 16 14 20 22 24 30 Z', color: SKY },
    ],
  },
  {
    id: 'nautical-starfish',
    name: 'Starfish',
    category: 'nautical',
    keywords: ['sea star', 'beach', 'ocean', 'shore', 'five'],
    parts: [
      {
        name: 'Body',
        // Arms with a bulge at the base rather than straight sides, so it reads
        // as an animal and not as a sheriff's badge.
        d:
          'M 50 2 C 54 2 56 6 58 16 C 60 28 64 34 74 36 C 88 38 96 40 97 45 ' +
          'C 98 50 94 53 84 60 C 74 68 71 74 73 86 C 75 97 74 100 69 100 ' +
          'C 65 100 61 97 50 90 C 39 97 35 100 31 100 C 26 100 25 97 27 86 ' +
          'C 29 74 26 68 16 60 C 6 53 2 50 3 45 C 4 40 12 38 26 36 ' +
          'C 36 34 40 28 42 16 C 44 6 46 2 50 2 Z',
        color: STARFISH,
      },
      {
        name: 'Shading',
        d: 'M 50 2 C 54 2 56 6 58 16 C 60 28 64 34 74 36 C 88 38 96 40 97 45 C 98 50 94 53 84 60 C 74 68 71 74 73 86 C 75 97 74 100 69 100 C 65 100 61 97 50 90 Z',
        color: RED_DARK,
      },
      {
        name: 'Bumps',
        d:
          `${circle(50, 26, 4)} ${circle(50, 44, 4.5)} ${circle(50, 62, 4)} ` +
          `${circle(32, 50, 4)} ${circle(68, 50, 4)} ${circle(38, 74, 3.5)} ${circle(62, 74, 3.5)} ` +
          `${circle(24, 46, 3.5)} ${circle(76, 46, 3.5)}`,
        color: SAND,
      },
    ],
  },
  {
    id: 'nautical-shell',
    name: 'Seashell',
    category: 'nautical',
    keywords: ['scallop', 'beach', 'shore', 'ocean', 'clam'],
    parts: [
      {
        name: 'Shell',
        // A scallop: a fan with a scalloped lip and two little ears at the
        // hinge. The ears are the detail everyone leaves off.
        d:
          'M 50 6 C 74 6 94 34 96 66 L 88 76 L 80 66 L 72 78 L 64 68 L 56 80 ' +
          'L 50 70 L 44 80 L 36 68 L 28 78 L 20 66 L 12 76 L 4 66 ' +
          'C 6 34 26 6 50 6 Z',
        color: PINK,
      },
      {
        name: 'Ribs',
        d:
          'M 47 8 L 53 8 L 53 72 L 47 72 Z ' +
          'M 34 12 L 40 10 L 30 74 L 24 72 Z M 66 12 L 60 10 L 70 74 L 76 72 Z ' +
          'M 20 20 L 26 17 L 14 72 L 8 70 Z M 80 20 L 74 17 L 86 72 L 92 70 Z',
        color: PINK_LIGHT,
      },
      { name: 'Hinge', d: 'M 40 4 L 60 4 L 60 14 L 40 14 Z M 34 6 L 40 4 L 40 12 L 32 12 Z M 66 6 L 60 4 L 60 12 L 68 12 Z', color: CREAM },
      { name: 'Sand', d: 'M 2 86 C 20 80 34 88 50 88 C 66 88 80 80 98 86 L 98 98 L 2 98 Z', color: SAND },
    ],
  },
  {
    id: 'nautical-wave',
    name: 'Wave',
    category: 'nautical',
    keywords: ['surf', 'ocean', 'break', 'curl', 'sea'],
    parts: [
      {
        name: 'Wave',
        // A breaking curl: the lip throws forward over a hollow. Without the
        // hollow it is just a hill.
        d:
          'M 96 14 C 96 44 76 68 46 68 C 26 68 12 58 8 44 ' +
          'C 16 54 28 60 42 60 C 66 60 84 44 86 20 ' +
          'C 92 22 96 20 96 14 Z',
        color: WATER_DARK,
      },
      {
        name: 'Face',
        d: 'M 86 20 C 84 44 66 60 42 60 C 28 60 16 54 8 44 C 20 50 34 50 48 44 C 66 36 78 26 86 20 Z',
        color: WATER,
      },
      {
        name: 'Foam',
        d:
          'M 96 14 C 90 20 82 22 76 18 C 82 16 86 12 88 6 C 92 8 96 10 96 14 Z ' +
          'M 2 74 C 18 68 34 80 50 74 C 66 68 82 80 98 74 L 98 84 C 82 90 66 78 50 84 ' +
          'C 34 90 18 78 2 84 Z ' +
          'M 2 88 C 18 82 34 94 50 88 C 66 82 82 94 98 88 L 98 98 L 2 98 Z',
        color: SKY_LIGHT,
      },
    ],
  },
  {
    id: 'nautical-life-ring',
    name: 'Life ring',
    category: 'nautical',
    keywords: ['buoy', 'rescue', 'float', 'safety', 'preserver'],
    parts: [
      { name: 'Ring', d: ring(50, 50, 46, 22), color: WHITE },
      {
        name: 'Bands',
        // Four quadrants, which is what a life ring has, and they must line up
        // with the rope lashings.
        d:
          'M 50 4 L 50 28 C 40 28 32 36 28 46 L 4 46 C 8 22 26 6 50 4 Z ' +
          'M 96 50 L 72 50 C 72 62 62 72 50 72 L 50 96 C 76 94 96 74 96 50 Z',
        color: RED,
      },
      {
        name: 'Rope',
        d:
          'M 46 2 L 54 2 L 54 12 L 46 12 Z M 46 88 L 54 88 L 54 98 L 46 98 Z ' +
          'M 2 46 L 12 46 L 12 54 L 2 54 Z M 88 46 L 98 46 L 98 54 L 88 54 Z',
        color: WOOD,
      },
    ],
  },
];





