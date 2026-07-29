import type { LibraryShape } from '../types.js';

/**
 * Stars, bursts and banners.
 *
 * Star vertices are generated from the point count and an inner-radius ratio
 * rather than drawn by hand. The ratio is chosen per star: a 5-point star wants
 * a deep 0.382 notch to read as a star at all, while a 24-point one needs a
 * shallow 0.85 or the points become spikes too thin to hold a stitch.
 */
export const STAR_BANNER_SHAPES: LibraryShape[] = [
  {
    id: 'star-4',
    name: '4-point star',
    category: 'stars-banners',
    keywords: ['sparkle', 'shine', 'twinkle'],
    parts: [
      {
        name: 'Star',
        d: 'M 50 0 L 62.37 37.63 L 100 50 L 62.37 62.37 L 50 100 L 37.63 62.37 L 0 50 L 37.63 37.63 Z',
      },
    ],
  },
  {
    id: 'star-5',
    name: '5-point star',
    category: 'stars-banners',
    keywords: ['favourite', 'rating', 'classic'],
    parts: [
      {
        name: 'Star',
        d: 'M 50 0 L 61.23 34.55 L 97.55 34.55 L 68.17 55.9 L 79.39 90.45 L 50 69.1 L 20.61 90.45 L 31.83 55.9 L 2.45 34.55 L 38.77 34.55 Z',
      },
    ],
  },
  {
    id: 'star-6',
    name: '6-point star',
    category: 'stars-banners',
    keywords: ['david', 'hexagram'],
    parts: [
      {
        name: 'Star',
        d: 'M 50 0 L 63.75 26.18 L 93.3 25 L 77.5 50 L 93.3 75 L 63.75 73.82 L 50 100 L 36.25 73.82 L 6.7 75 L 22.5 50 L 6.7 25 L 36.25 26.18 Z',
      },
    ],
  },
  {
    id: 'star-7',
    name: '7-point star',
    category: 'stars-banners',
    parts: [
      {
        name: 'Star',
        d: 'M 50 0 L 63.02 22.97 L 89.09 18.83 L 79.25 43.32 L 98.75 61.13 L 73.45 68.7 L 71.69 95.05 L 50 80 L 28.31 95.05 L 26.55 68.7 L 1.25 61.13 L 20.75 43.32 L 10.91 18.83 L 36.98 22.97 Z',
      },
    ],
  },
  {
    id: 'star-8',
    name: '8-point star',
    category: 'stars-banners',
    keywords: ['compass'],
    parts: [
      {
        name: 'Star',
        d: 'M 50 0 L 61.86 21.36 L 85.36 14.64 L 78.64 38.14 L 100 50 L 78.64 61.86 L 85.36 85.36 L 61.86 78.64 L 50 100 L 38.14 78.64 L 14.64 85.36 L 21.36 61.86 L 0 50 L 21.36 38.14 L 14.64 14.64 L 38.14 21.36 Z',
      },
    ],
  },
  {
    id: 'star-10',
    name: '10-point star',
    category: 'stars-banners',
    parts: [
      {
        name: 'Star',
        d: 'M 50 0 L 60.51 17.66 L 79.39 9.55 L 77.51 30.02 L 97.55 34.55 L 84 50 L 97.55 65.45 L 77.51 69.98 L 79.39 90.45 L 60.51 82.34 L 50 100 L 39.49 82.34 L 20.61 90.45 L 22.49 69.98 L 2.45 65.45 L 16 50 L 2.45 34.55 L 22.49 30.02 L 20.61 9.55 L 39.49 17.66 Z',
      },
    ],
  },
  {
    id: 'star-12',
    name: '12-point star',
    category: 'stars-banners',
    parts: [
      {
        name: 'Star',
        d: 'M 50 0 L 59.32 15.23 L 75 6.7 L 75.46 24.54 L 93.3 25 L 84.77 40.68 L 100 50 L 84.77 59.32 L 93.3 75 L 75.46 75.46 L 75 93.3 L 59.32 84.77 L 50 100 L 40.68 84.77 L 25 93.3 L 24.54 75.46 L 6.7 75 L 15.23 59.32 L 0 50 L 15.23 40.68 L 6.7 25 L 24.54 24.54 L 25 6.7 L 40.68 15.23 Z',
      },
    ],
  },
  {
    id: 'star-16',
    name: '16-point star',
    category: 'stars-banners',
    keywords: ['sunburst'],
    parts: [
      {
        name: 'Star',
        d: 'M 50 0 L 57.61 11.75 L 69.13 3.81 L 71.67 17.57 L 85.36 14.64 L 82.43 28.33 L 96.19 30.87 L 88.25 42.39 L 100 50 L 88.25 57.61 L 96.19 69.13 L 82.43 71.67 L 85.36 85.36 L 71.67 82.43 L 69.13 96.19 L 57.61 88.25 L 50 100 L 42.39 88.25 L 30.87 96.19 L 28.33 82.43 L 14.64 85.36 L 17.57 71.67 L 3.81 69.13 L 11.75 57.61 L 0 50 L 11.75 42.39 L 3.81 30.87 L 17.57 28.33 L 14.64 14.64 L 28.33 17.57 L 30.87 3.81 L 42.39 11.75 Z',
      },
    ],
  },
  {
    id: 'star-24',
    name: '24-point star',
    category: 'stars-banners',
    keywords: ['seal', 'medal', 'rosette'],
    parts: [
      {
        name: 'Star',
        d: 'M 50 0 L 55.55 7.86 L 62.94 1.7 L 66.26 10.74 L 75 6.7 L 75.87 16.28 L 85.36 14.64 L 83.72 24.13 L 93.3 25 L 89.26 33.74 L 98.3 37.06 L 92.14 44.45 L 100 50 L 92.14 55.55 L 98.3 62.94 L 89.26 66.26 L 93.3 75 L 83.72 75.87 L 85.36 85.36 L 75.87 83.72 L 75 93.3 L 66.26 89.26 L 62.94 98.3 L 55.55 92.14 L 50 100 L 44.45 92.14 L 37.06 98.3 L 33.74 89.26 L 25 93.3 L 24.13 83.72 L 14.64 85.36 L 16.28 75.87 L 6.7 75 L 10.74 66.26 L 1.7 62.94 L 7.86 55.55 L 0 50 L 7.86 44.45 L 1.7 37.06 L 10.74 33.74 L 6.7 25 L 16.28 24.13 L 14.64 14.64 L 24.13 16.28 L 25 6.7 L 33.74 10.74 L 37.06 1.7 L 44.45 7.86 Z',
      },
    ],
  },
  {
    id: 'star-sparkle',
    name: 'Sparkle',
    category: 'stars-banners',
    keywords: ['shine', 'glint', 'twinkle', 'star thin'],
    parts: [
      {
        name: 'Sparkle',
        d: 'M 50 0 L 55.74 36.14 L 85.36 14.64 L 63.86 44.26 L 100 50 L 63.86 55.74 L 85.36 85.36 L 55.74 63.86 L 50 100 L 44.26 63.86 L 14.64 85.36 L 36.14 55.74 L 0 50 L 36.14 44.26 L 14.64 14.64 L 44.26 36.14 Z',
      },
    ],
  },
  {
    id: 'star-explosion-1',
    name: 'Explosion',
    category: 'stars-banners',
    keywords: ['burst', 'bang', 'boom', 'pow'],
    parts: [
      {
        name: 'Explosion',
        d: 'M 50 0 L 56.49 30.03 L 75.27 15.21 L 70.23 35.31 L 95.18 35.32 L 69 50 L 87.09 62.05 L 68.61 63.52 L 79.39 90.45 L 56.49 69.97 L 50 93 L 42.27 73.78 L 22.08 88.43 L 34.63 61.17 L 12.91 62.05 L 27 50 L 2.45 34.55 L 33.01 37.66 L 24.73 15.21 L 42.27 26.22 Z',
      },
    ],
  },
  {
    id: 'star-explosion-2',
    name: 'Explosion 2',
    category: 'stars-banners',
    keywords: ['burst', 'jagged', 'spiky'],
    parts: [
      {
        name: 'Explosion',
        d: 'M 50 0 L 56.12 23.19 L 69.09 10.36 L 68.7 26.55 L 87.53 20.07 L 72.52 39.15 L 98.75 38.87 L 77.5 50 L 92.9 59.79 L 77.03 63.02 L 87.53 79.93 L 65.59 69.55 L 71.69 95.05 L 56.12 76.81 L 50 94 L 43.32 79.25 L 29.17 93.25 L 34.41 69.55 L 10.91 81.17 L 25.22 61.93 L 7.1 59.79 L 20 50 L 3.2 39.32 L 27.48 39.15 L 10.91 18.83 L 32.85 28.5 L 30.91 10.36 L 43.32 20.75 Z',
      },
    ],
  },
  {
    id: 'banner-ribbon',
    name: 'Ribbon',
    category: 'stars-banners',
    keywords: ['banner', 'flag', 'label', 'name'],
    parts: [{ name: 'Ribbon', d: 'M 0 30 L 100 30 L 86 50 L 100 70 L 0 70 L 14 50 Z' }],
  },
  {
    id: 'banner-tails',
    name: 'Banner with tails',
    category: 'stars-banners',
    keywords: ['ribbon', 'scroll', 'award', 'monogram frame'],
    parts: [
      {
        name: 'Banner',
        d:
          'M 18 18 L 82 18 L 82 62 L 18 62 Z ' +
          'M 0 30 L 18 30 L 18 74 L 0 74 L 9 52 Z ' +
          'M 100 30 L 82 30 L 82 74 L 100 74 L 91 52 Z',
      },
    ],
  },
  {
    id: 'banner-pennant',
    name: 'Pennant',
    category: 'stars-banners',
    keywords: ['flag', 'triangle', 'bunting', 'team'],
    parts: [{ name: 'Pennant', d: 'M 0 20 L 100 42 L 0 64 Z' }],
  },
  {
    id: 'banner-wave',
    name: 'Wave banner',
    category: 'stars-banners',
    keywords: ['ribbon', 'flag', 'curved'],
    parts: [
      {
        name: 'Wave',
        d: 'M 0 30 C 20 15 35 45 50 30 C 65 15 80 45 100 30 L 100 70 C 80 85 65 55 50 70 C 35 85 20 55 0 70 Z',
      },
    ],
  },
  {
    id: 'banner-double-wave',
    name: 'Double wave',
    category: 'stars-banners',
    keywords: ['ribbon', 'water', 'ripple'],
    parts: [
      {
        name: 'Waves',
        d:
          'M 0 18 C 17 5 33 33 50 18 C 67 3 83 31 100 18 L 100 40 C 83 53 67 25 50 40 C 33 55 17 27 0 40 Z ' +
          'M 0 60 C 17 47 33 75 50 60 C 67 45 83 73 100 60 L 100 82 C 83 95 67 67 50 82 C 33 97 17 69 0 82 Z',
      },
    ],
  },
];
