import type { LibraryShape } from '../types.js';

/**
 * Block arrows.
 *
 * The circular and U-turn arrows split their head into its own part rather than
 * drawing it as a second ring in the same one. A head drawn as a second ring
 * sits inside the band's outer contour, and `groupRingsIntoRegions` — which
 * recovers nesting by containment — would correctly but uselessly classify it
 * as a hole. A separate part is a separate layer, so the question never arises;
 * both parts carry the same colour and the compiler merges them into one block.
 */
const ARROW_BLUE = '#4a76c4';

export const ARROW_SHAPES: LibraryShape[] = [
  {
    id: 'arrow-right',
    name: 'Right arrow',
    category: 'arrows',
    keywords: ['east', 'next', 'forward'],
    parts: [{ name: 'Arrow', d: 'M 0 30 L 60 30 L 60 5 L 100 50 L 60 95 L 60 70 L 0 70 Z' }],
  },
  {
    id: 'arrow-left',
    name: 'Left arrow',
    category: 'arrows',
    keywords: ['west', 'back', 'previous'],
    parts: [{ name: 'Arrow', d: 'M 100 30 L 40 30 L 40 5 L 0 50 L 40 95 L 40 70 L 100 70 Z' }],
  },
  {
    id: 'arrow-up',
    name: 'Up arrow',
    category: 'arrows',
    keywords: ['north', 'top', 'rise'],
    parts: [{ name: 'Arrow', d: 'M 30 100 L 30 40 L 5 40 L 50 0 L 95 40 L 70 40 L 70 100 Z' }],
  },
  {
    id: 'arrow-down',
    name: 'Down arrow',
    category: 'arrows',
    keywords: ['south', 'bottom', 'fall'],
    parts: [{ name: 'Arrow', d: 'M 30 0 L 30 60 L 5 60 L 50 100 L 95 60 L 70 60 L 70 0 Z' }],
  },
  {
    id: 'arrow-left-right',
    name: 'Left-right arrow',
    category: 'arrows',
    keywords: ['double', 'horizontal', 'both'],
    parts: [
      {
        name: 'Arrow',
        d: 'M 0 50 L 25 18 L 25 35 L 75 35 L 75 18 L 100 50 L 75 82 L 75 65 L 25 65 L 25 82 Z',
      },
    ],
  },
  {
    id: 'arrow-up-down',
    name: 'Up-down arrow',
    category: 'arrows',
    keywords: ['double', 'vertical', 'both'],
    parts: [
      {
        name: 'Arrow',
        d: 'M 50 0 L 82 25 L 65 25 L 65 75 L 82 75 L 50 100 L 18 75 L 35 75 L 35 25 L 18 25 Z',
      },
    ],
  },
  {
    id: 'arrow-quad',
    name: 'Four-way arrow',
    category: 'arrows',
    keywords: ['move', 'cross', 'all directions'],
    parts: [
      {
        name: 'Arrow',
        d: 'M 50 0 L 72 25 L 58 25 L 58 42 L 75 42 L 75 28 L 100 50 L 75 72 L 75 58 L 58 58 L 58 75 L 72 75 L 50 100 L 28 75 L 42 75 L 42 58 L 25 58 L 25 72 L 0 50 L 25 28 L 25 42 L 42 42 L 42 25 L 28 25 Z',
      },
    ],
  },
  {
    id: 'arrow-bent',
    name: 'Bent arrow',
    category: 'arrows',
    keywords: ['corner', 'turn', 'elbow'],
    parts: [
      {
        name: 'Arrow',
        d: 'M 0 70 L 45 70 L 45 25 L 30 25 L 60 0 L 90 25 L 75 25 L 75 100 L 0 100 Z',
      },
    ],
  },
  {
    id: 'arrow-u-turn',
    name: 'U-turn arrow',
    category: 'arrows',
    keywords: ['return', 'back', 'loop'],
    parts: [
      {
        name: 'Arrow',
        d: 'M 0 100 L 0 45 C 0 20 20 0 45 0 C 70 0 90 20 90 45 L 90 60 L 100 60 L 75 95 L 50 60 L 60 60 L 60 45 C 60 37 53 30 45 30 C 37 30 30 37 30 45 L 30 100 Z',
      },
    ],
  },
  {
    id: 'arrow-circular',
    name: 'Circular arrow',
    category: 'arrows',
    keywords: ['refresh', 'rotate', 'repeat', 'reload', 'cycle'],
    parts: [
      {
        name: 'Band',
        d: 'M 50 0 C 77.61 0 100 22.39 100 50 C 100 77.61 77.61 100 50 100 C 22.39 100 0 77.61 0 50 L 18 50 C 18 67.67 32.33 82 50 82 C 67.67 82 82 67.67 82 50 C 82 32.33 67.67 18 50 18 Z',
        color: ARROW_BLUE,
      },
      { name: 'Head', d: 'M 46 0 L 46 26 L 88 13 Z', color: ARROW_BLUE },
    ],
  },
  {
    id: 'arrow-curved',
    name: 'Curved arrow',
    category: 'arrows',
    keywords: ['bend', 'sweep', 'redo'],
    parts: [
      {
        name: 'Band',
        d: 'M 5 100 C 5 48 48 5 100 5 L 100 33 C 63 33 33 63 33 100 Z',
        color: ARROW_BLUE,
      },
      { name: 'Head', d: 'M 82 0 L 82 38 L 100 19 Z', color: ARROW_BLUE },
    ],
  },
  {
    id: 'arrow-pentagon',
    name: 'Pentagon arrow',
    category: 'arrows',
    keywords: ['banner', 'tag', 'home plate'],
    parts: [{ name: 'Arrow', d: 'M 0 0 L 70 0 L 100 50 L 70 100 L 0 100 Z' }],
  },
  {
    id: 'arrow-notched',
    name: 'Notched arrow',
    category: 'arrows',
    keywords: ['chevron', 'ribbon'],
    parts: [
      {
        name: 'Arrow',
        d: 'M 0 5 L 60 5 L 100 50 L 60 95 L 0 95 L 28 50 Z',
      },
    ],
  },
  {
    id: 'arrow-striped',
    name: 'Striped arrow',
    category: 'arrows',
    keywords: ['dashed', 'motion', 'speed'],
    parts: [
      { name: 'Head', d: 'M 40 5 L 100 50 L 40 95 L 40 70 L 40 30 Z', color: ARROW_BLUE },
      {
        name: 'Stripes',
        d: 'M 0 30 L 10 30 L 10 70 L 0 70 Z M 16 30 L 32 30 L 32 70 L 16 70 Z',
        color: ARROW_BLUE,
      },
    ],
  },
  {
    id: 'arrow-chevron-triple',
    name: 'Triple chevron',
    category: 'arrows',
    keywords: ['forward', 'fast', 'more'],
    parts: [
      {
        name: 'Chevrons',
        d:
          'M 0 8 L 20 8 L 48 50 L 20 92 L 0 92 L 28 50 Z ' +
          'M 24 8 L 44 8 L 72 50 L 44 92 L 24 92 L 52 50 Z ' +
          'M 48 8 L 68 8 L 96 50 L 68 92 L 48 92 L 76 50 Z',
      },
    ],
  },
];
