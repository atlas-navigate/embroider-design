import type { LibraryShape } from '../types.js';

/**
 * Basic drawing shapes, the ones every presentation tool has.
 *
 * Regular polygon vertices are computed rather than eyeballed — an octagon
 * whose sides differ by a millimetre looks wrong once it is stitched at 80 mm,
 * and satin along an uneven edge changes width visibly.
 *
 * Holes are simply rings drawn inside another ring in the same part;
 * `groupRingsIntoRegions` recovers nesting by containment, so winding direction
 * does not matter here.
 */
export const BASIC_SHAPES: LibraryShape[] = [
  {
    id: 'basic-rectangle',
    name: 'Rectangle',
    category: 'basic',
    keywords: ['square', 'box'],
    parts: [{ name: 'Rectangle', d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z' }],
  },
  {
    id: 'basic-rounded-rectangle',
    name: 'Rounded rectangle',
    category: 'basic',
    keywords: ['box', 'radius'],
    parts: [
      {
        name: 'Rounded rectangle',
        d: 'M 18 0 L 82 0 C 92 0 100 8 100 18 L 100 82 C 100 92 92 100 82 100 L 18 100 C 8 100 0 92 0 82 L 0 18 C 0 8 8 0 18 0 Z',
      },
    ],
  },
  {
    id: 'basic-circle',
    name: 'Circle',
    category: 'basic',
    keywords: ['round', 'ellipse', 'oval', 'dot'],
    parts: [
      {
        name: 'Circle',
        d: 'M 50 0 C 77.61 0 100 22.39 100 50 C 100 77.61 77.61 100 50 100 C 22.39 100 0 77.61 0 50 C 0 22.39 22.39 0 50 0 Z',
      },
    ],
  },
  {
    id: 'basic-oval',
    name: 'Oval',
    category: 'basic',
    keywords: ['ellipse', 'round'],
    parts: [
      {
        name: 'Oval',
        d: 'M 50 15 C 77.61 15 100 30.67 100 50 C 100 69.33 77.61 85 50 85 C 22.39 85 0 69.33 0 50 C 0 30.67 22.39 15 50 15 Z',
      },
    ],
  },
  {
    id: 'basic-triangle',
    name: 'Triangle',
    category: 'basic',
    keywords: ['isosceles'],
    parts: [{ name: 'Triangle', d: 'M 50 0 L 100 100 L 0 100 Z' }],
  },
  {
    id: 'basic-right-triangle',
    name: 'Right triangle',
    category: 'basic',
    parts: [{ name: 'Right triangle', d: 'M 0 0 L 0 100 L 100 100 Z' }],
  },
  {
    id: 'basic-diamond',
    name: 'Diamond',
    category: 'basic',
    keywords: ['rhombus', 'kite'],
    parts: [{ name: 'Diamond', d: 'M 50 0 L 100 50 L 50 100 L 0 50 Z' }],
  },
  {
    id: 'basic-pentagon',
    name: 'Pentagon',
    category: 'basic',
    keywords: ['5', 'five'],
    parts: [
      { name: 'Pentagon', d: 'M 50 0 L 97.55 34.55 L 79.39 90.45 L 20.61 90.45 L 2.45 34.55 Z' },
    ],
  },
  {
    id: 'basic-hexagon',
    name: 'Hexagon',
    category: 'basic',
    keywords: ['6', 'six', 'honeycomb'],
    parts: [{ name: 'Hexagon', d: 'M 50 0 L 93.3 25 L 93.3 75 L 50 100 L 6.7 75 L 6.7 25 Z' }],
  },
  {
    id: 'basic-heptagon',
    name: 'Heptagon',
    category: 'basic',
    keywords: ['7', 'seven'],
    parts: [
      {
        name: 'Heptagon',
        d: 'M 50 0 L 89.09 18.83 L 98.75 61.13 L 71.69 95.05 L 28.31 95.05 L 1.25 61.13 L 10.91 18.83 Z',
      },
    ],
  },
  {
    id: 'basic-octagon',
    name: 'Octagon',
    category: 'basic',
    keywords: ['8', 'eight', 'stop'],
    parts: [
      {
        name: 'Octagon',
        d: 'M 69.13 3.81 L 96.19 30.87 L 96.19 69.13 L 69.13 96.19 L 30.87 96.19 L 3.81 69.13 L 3.81 30.87 L 30.87 3.81 Z',
      },
    ],
  },
  {
    id: 'basic-decagon',
    name: 'Decagon',
    category: 'basic',
    keywords: ['10', 'ten'],
    parts: [
      {
        name: 'Decagon',
        d: 'M 50 0 L 79.39 9.55 L 97.55 34.55 L 97.55 65.45 L 79.39 90.45 L 50 100 L 20.61 90.45 L 2.45 65.45 L 2.45 34.55 L 20.61 9.55 Z',
      },
    ],
  },
  {
    id: 'basic-dodecagon',
    name: 'Dodecagon',
    category: 'basic',
    keywords: ['12', 'twelve'],
    parts: [
      {
        name: 'Dodecagon',
        d: 'M 50 0 L 75 6.7 L 93.3 25 L 100 50 L 93.3 75 L 75 93.3 L 50 100 L 25 93.3 L 6.7 75 L 0 50 L 6.7 25 L 25 6.7 Z',
      },
    ],
  },
  {
    id: 'basic-trapezoid',
    name: 'Trapezoid',
    category: 'basic',
    parts: [{ name: 'Trapezoid', d: 'M 22 0 L 78 0 L 100 100 L 0 100 Z' }],
  },
  {
    id: 'basic-parallelogram',
    name: 'Parallelogram',
    category: 'basic',
    keywords: ['slant'],
    parts: [{ name: 'Parallelogram', d: 'M 25 0 L 100 0 L 75 100 L 0 100 Z' }],
  },
  {
    id: 'basic-cross',
    name: 'Cross',
    category: 'basic',
    keywords: ['plus', 'add', 'medical'],
    parts: [
      {
        name: 'Cross',
        d: 'M 35 0 L 65 0 L 65 35 L 100 35 L 100 65 L 65 65 L 65 100 L 35 100 L 35 65 L 0 65 L 0 35 L 35 35 Z',
      },
    ],
  },
  {
    id: 'basic-chevron',
    name: 'Chevron',
    category: 'basic',
    keywords: ['arrow', 'point'],
    parts: [{ name: 'Chevron', d: 'M 0 0 L 62 0 L 100 50 L 62 100 L 0 100 L 38 50 Z' }],
  },
  {
    id: 'basic-teardrop',
    name: 'Teardrop',
    category: 'basic',
    keywords: ['drop', 'water'],
    parts: [
      {
        name: 'Teardrop',
        d: 'M 50 100 C 22.39 100 0 77.61 0 50 C 0 22.39 22.39 0 50 0 L 100 0 L 100 50 C 100 77.61 77.61 100 50 100 Z',
      },
    ],
  },
  {
    id: 'basic-l-shape',
    name: 'L shape',
    category: 'basic',
    keywords: ['corner', 'elbow'],
    parts: [{ name: 'L shape', d: 'M 0 0 L 35 0 L 35 65 L 100 65 L 100 100 L 0 100 Z' }],
  },
  {
    id: 'basic-frame',
    name: 'Frame',
    category: 'basic',
    keywords: ['border', 'square ring', 'picture'],
    parts: [
      {
        name: 'Frame',
        d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z M 18 18 L 18 82 L 82 82 L 82 18 Z',
      },
    ],
  },
  {
    id: 'basic-donut',
    name: 'Donut',
    category: 'basic',
    keywords: ['ring', 'annulus', 'circle outline', 'o'],
    parts: [
      {
        name: 'Donut',
        d:
          'M 50 0 C 77.61 0 100 22.39 100 50 C 100 77.61 77.61 100 50 100 C 22.39 100 0 77.61 0 50 C 0 22.39 22.39 0 50 0 Z ' +
          'M 50 22 C 34.54 22 22 34.54 22 50 C 22 65.46 34.54 78 50 78 C 65.46 78 78 65.46 78 50 C 78 34.54 65.46 22 50 22 Z',
      },
    ],
  },
  {
    id: 'basic-pie',
    name: 'Pie',
    category: 'basic',
    keywords: ['wedge', 'chart', 'three quarter'],
    parts: [
      {
        name: 'Pie',
        d: 'M 50 50 L 50 0 C 77.61 0 100 22.39 100 50 C 100 77.61 77.61 100 50 100 C 22.39 100 0 77.61 0 50 Z',
      },
    ],
  },
  {
    id: 'basic-arc',
    name: 'Arc band',
    category: 'basic',
    keywords: ['rainbow', 'curve', 'bridge'],
    parts: [
      {
        name: 'Arc band',
        d: 'M 0 50 C 0 22.39 22.39 0 50 0 C 77.61 0 100 22.39 100 50 L 72 50 C 72 37.85 62.15 28 50 28 C 37.85 28 28 37.85 28 50 Z',
      },
    ],
  },
  {
    id: 'basic-lightning',
    name: 'Lightning bolt',
    category: 'basic',
    keywords: ['flash', 'storm', 'zap', 'electric'],
    parts: [{ name: 'Bolt', d: 'M 58 0 L 20 55 L 44 55 L 34 100 L 80 40 L 54 40 Z' }],
  },
  {
    id: 'basic-cube',
    name: 'Cube',
    category: 'basic',
    keywords: ['3d', 'box', 'isometric'],
    parts: [
      { name: 'Front', d: 'M 0 30 L 70 30 L 70 100 L 0 100 Z', color: '#4a76c4' },
      { name: 'Top', d: 'M 0 30 L 30 0 L 100 0 L 70 30 Z', color: '#7ba3e0' },
      { name: 'Side', d: 'M 70 30 L 100 0 L 100 70 L 70 100 Z', color: '#31558f' },
    ],
  },
  {
    id: 'basic-cylinder',
    name: 'Cylinder',
    category: 'basic',
    keywords: ['can', 'tube', 'drum'],
    parts: [
      {
        name: 'Body',
        d: 'M 0 15 C 0 6.72 22.39 0 50 0 C 77.61 0 100 6.72 100 15 L 100 85 C 100 93.28 77.61 100 50 100 C 22.39 100 0 93.28 0 85 Z',
        color: '#4a76c4',
      },
      {
        name: 'Top',
        d: 'M 50 0 C 77.61 0 100 6.72 100 15 C 100 23.28 77.61 30 50 30 C 22.39 30 0 23.28 0 15 C 0 6.72 22.39 0 50 0 Z',
        color: '#7ba3e0',
      },
    ],
  },
  {
    id: 'basic-smiley',
    name: 'Smiley face',
    category: 'basic',
    keywords: ['smile', 'happy', 'emoji', 'face'],
    parts: [
      {
        name: 'Face',
        d:
          'M 50 0 C 77.61 0 100 22.39 100 50 C 100 77.61 77.61 100 50 100 C 22.39 100 0 77.61 0 50 C 0 22.39 22.39 0 50 0 Z ' +
          'M 50 8 C 26.8 8 8 26.8 8 50 C 8 73.2 26.8 92 50 92 C 73.2 92 92 73.2 92 50 C 92 26.8 73.2 8 50 8 Z',
        color: '#f2c230',
      },
      {
        name: 'Eyes',
        d:
          'M 34 28 C 38.42 28 42 31.58 42 36 C 42 40.42 38.42 44 34 44 C 29.58 44 26 40.42 26 36 C 26 31.58 29.58 28 34 28 Z ' +
          'M 66 28 C 70.42 28 74 31.58 74 36 C 74 40.42 70.42 44 66 44 C 61.58 44 58 40.42 58 36 C 58 31.58 61.58 28 66 28 Z',
        color: '#2b2b2b',
      },
      {
        name: 'Mouth',
        d: 'M 25 60 C 32 80 68 80 75 60 L 66 56 C 60 70 40 70 34 56 Z',
        color: '#2b2b2b',
      },
    ],
  },
];
