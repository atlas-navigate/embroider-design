import type { LibraryShape } from '../types.js';

/**
 * Flowchart symbols.
 *
 * The inner bars on "predefined process" and "stored data" are drawn as rings
 * inside the outer one, which the nesting code reads as holes — so they stitch
 * as gaps in the fill rather than as lines laid on top of it. That is both the
 * right look and about a third fewer stitches.
 */
export const FLOWCHART_SHAPES: LibraryShape[] = [
  {
    id: 'flow-process',
    name: 'Process',
    category: 'flowchart',
    keywords: ['rectangle', 'step', 'action'],
    parts: [{ name: 'Process', d: 'M 0 15 L 100 15 L 100 85 L 0 85 Z' }],
  },
  {
    id: 'flow-alternate-process',
    name: 'Alternate process',
    category: 'flowchart',
    keywords: ['rounded', 'step'],
    parts: [
      {
        name: 'Process',
        d: 'M 15 15 L 85 15 C 93 15 100 22 100 30 L 100 70 C 100 78 93 85 85 85 L 15 85 C 7 85 0 78 0 70 L 0 30 C 0 22 7 15 15 15 Z',
      },
    ],
  },
  {
    id: 'flow-decision',
    name: 'Decision',
    category: 'flowchart',
    keywords: ['diamond', 'branch', 'if', 'choice'],
    parts: [{ name: 'Decision', d: 'M 50 0 L 100 50 L 50 100 L 0 50 Z' }],
  },
  {
    id: 'flow-terminator',
    name: 'Terminator',
    category: 'flowchart',
    keywords: ['start', 'end', 'stadium', 'pill'],
    parts: [
      {
        name: 'Terminator',
        d: 'M 30 20 L 70 20 C 86.57 20 100 33.43 100 50 C 100 66.57 86.57 80 70 80 L 30 80 C 13.43 80 0 66.57 0 50 C 0 33.43 13.43 20 30 20 Z',
      },
    ],
  },
  {
    id: 'flow-data',
    name: 'Data',
    category: 'flowchart',
    keywords: ['parallelogram', 'input', 'output'],
    parts: [{ name: 'Data', d: 'M 20 15 L 100 15 L 80 85 L 0 85 Z' }],
  },
  {
    id: 'flow-document',
    name: 'Document',
    category: 'flowchart',
    keywords: ['page', 'report', 'paper'],
    parts: [
      {
        name: 'Document',
        d: 'M 0 10 L 100 10 L 100 78 C 75 94 50 64 25 80 C 16 85 6 83 0 78 Z',
      },
    ],
  },
  {
    id: 'flow-multidocument',
    name: 'Multidocument',
    category: 'flowchart',
    keywords: ['pages', 'reports', 'stack'],
    parts: [
      { name: 'Back pages', d: 'M 10 5 L 100 5 L 100 70 L 90 70 L 90 12 L 10 12 Z' },
      {
        name: 'Front page',
        d: 'M 0 18 L 90 18 L 90 82 C 68 96 45 68 22 84 C 14 89 5 87 0 82 Z',
      },
    ],
  },
  {
    id: 'flow-predefined-process',
    name: 'Predefined process',
    category: 'flowchart',
    keywords: ['subroutine', 'function', 'call'],
    parts: [
      {
        name: 'Process',
        d:
          'M 0 15 L 100 15 L 100 85 L 0 85 Z ' +
          'M 12 15 L 12 85 L 17 85 L 17 15 Z ' +
          'M 83 15 L 83 85 L 88 85 L 88 15 Z',
      },
    ],
  },
  {
    id: 'flow-stored-data',
    name: 'Stored data',
    category: 'flowchart',
    keywords: ['storage', 'memory'],
    parts: [
      {
        name: 'Stored data',
        d: 'M 12 15 L 100 15 C 88 30 88 70 100 85 L 12 85 C 0 70 0 30 12 15 Z',
      },
    ],
  },
  {
    id: 'flow-database',
    name: 'Database',
    category: 'flowchart',
    keywords: ['cylinder', 'disk', 'store', 'sql'],
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
    id: 'flow-manual-input',
    name: 'Manual input',
    category: 'flowchart',
    keywords: ['keyboard', 'entry'],
    parts: [{ name: 'Manual input', d: 'M 0 30 L 100 12 L 100 88 L 0 88 Z' }],
  },
  {
    id: 'flow-preparation',
    name: 'Preparation',
    category: 'flowchart',
    keywords: ['hexagon', 'setup', 'init'],
    parts: [
      { name: 'Preparation', d: 'M 22 15 L 78 15 L 100 50 L 78 85 L 22 85 L 0 50 Z' },
    ],
  },
  {
    id: 'flow-connector',
    name: 'Connector',
    category: 'flowchart',
    keywords: ['circle', 'junction', 'link', 'node'],
    parts: [
      {
        name: 'Connector',
        d: 'M 50 0 C 77.61 0 100 22.39 100 50 C 100 77.61 77.61 100 50 100 C 22.39 100 0 77.61 0 50 C 0 22.39 22.39 0 50 0 Z',
      },
    ],
  },
  {
    id: 'flow-delay',
    name: 'Delay',
    category: 'flowchart',
    keywords: ['wait', 'pause', 'half round'],
    parts: [
      {
        name: 'Delay',
        d: 'M 0 20 L 65 20 C 84.33 20 100 33.43 100 50 C 100 66.57 84.33 80 65 80 L 0 80 Z',
      },
    ],
  },
];
