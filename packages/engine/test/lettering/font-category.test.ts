import { describe, expect, it } from 'vitest';
import {
  categoriesPresent,
  classifyFont,
  FONT_CATEGORY_LABELS,
  type FontCategory,
} from '../../src/lettering/font-category.js';
import type { FontDescriptor } from '../../src/lettering/font-loader.js';

/**
 * Font classification is a heuristic, so these tests pin the behaviour that
 * matters rather than pretending it is exact: a script face must land in
 * `script` however it describes itself, because "show me the cursive ones" is
 * the whole reason the filter exists.
 */

function descriptor(overrides: Partial<FontDescriptor> = {}): FontDescriptor {
  return {
    family: 'Test Family',
    subfamily: 'Regular',
    fullName: 'Test Family Regular',
    postScriptName: 'TestFamily-Regular',
    weight: 400,
    italic: false,
    monospace: false,
    ...overrides,
  };
}

/** PANOSE byte 0 = 3 is "Latin Hand Written". */
const HANDWRITTEN = [3, 2, 5, 2, 4, 5, 2, 3, 3, 4];
/** Latin Text with a sans-serif serif-style byte. */
const SANS = [2, 11, 6, 4, 2, 2, 2, 2, 2, 4];
/** Latin Text with an old-style serif. */
const SERIF = [2, 2, 6, 3, 5, 4, 5, 2, 3, 4];
/** Latin Text with a square slab serif. */
const SLAB = [2, 6, 8, 3, 5, 4, 5, 2, 3, 4];
/** Latin Decorative. */
const DECORATIVE = [4, 4, 5, 2, 4, 5, 2, 3, 3, 4];

describe('classifyFont with PANOSE present', () => {
  it('reads a hand-written face as script', () => {
    expect(classifyFont(descriptor({ panose: HANDWRITTEN }))).toBe('script');
  });

  it('separates sans, serif and slab by serif style', () => {
    expect(classifyFont(descriptor({ panose: SANS }))).toBe('sans');
    expect(classifyFont(descriptor({ panose: SERIF }))).toBe('serif');
    expect(classifyFont(descriptor({ panose: SLAB }))).toBe('slab');
  });

  it('treats a decorative face as display unless its name says script', () => {
    expect(classifyFont(descriptor({ panose: DECORATIVE }))).toBe('display');
    expect(
      classifyFont(descriptor({ panose: DECORATIVE, family: 'Edwardian Script ITC' })),
    ).toBe('script');
  });

  it('lets the name overrule a script face that claims to be plain text', () => {
    // Extremely common: a script face ships with a Latin Text PANOSE. The
    // reverse — a text face named "Script" — essentially does not happen.
    expect(classifyFont(descriptor({ panose: SERIF, family: 'Brush Script MT' }))).toBe('script');
  });
});

describe('classifyFont with PANOSE missing or zeroed', () => {
  it('falls back to sFamilyClass', () => {
    // High byte 10 is the script class; 8 is sans; 12 is decorative.
    expect(classifyFont(descriptor({ familyClass: 10 << 8 }))).toBe('script');
    expect(classifyFont(descriptor({ familyClass: 8 << 8 }))).toBe('sans');
    expect(classifyFont(descriptor({ familyClass: 12 << 8 }))).toBe('display');
    expect(classifyFont(descriptor({ familyClass: 2 << 8 }))).toBe('serif');
  });

  it('falls back to the family name', () => {
    expect(classifyFont(descriptor({ family: 'Great Vibes' }))).toBe('script');
    expect(classifyFont(descriptor({ family: 'Segoe Print' }))).toBe('script');
    expect(classifyFont(descriptor({ family: 'Lucida Handwriting' }))).toBe('script');
    expect(classifyFont(descriptor({ family: 'Times New Roman' }))).toBe('serif');
    expect(classifyFont(descriptor({ family: 'Bebas Neue' }))).toBe('display');
    expect(classifyFont(descriptor({ family: 'Rockwell' }))).toBe('slab');
  });

  it('classifies a font that says nothing at all as sans', () => {
    // Not a guess dressed up as knowledge: most unclassifiable faces really
    // are sans, and putting them in a bucket beats an "Unknown" filter nobody
    // would ever click.
    expect(classifyFont(descriptor())).toBe('sans');
  });
});

describe('classifyFont special cases', () => {
  it('finds blackletter before anything else gets a say', () => {
    expect(classifyFont(descriptor({ panose: SANS, family: 'UnifrakturMaguntia' }))).toBe(
      'blackletter',
    );
    expect(classifyFont(descriptor({ family: 'Old English Text MT' }))).toBe('blackletter');
  });

  it('trusts the monospace flag over the name', () => {
    expect(classifyFont(descriptor({ monospace: true, family: 'Great Vibes' }))).toBe(
      'monospace',
    );
  });

  it('never returns a category without a label', () => {
    const samples: FontDescriptor[] = [
      descriptor({ panose: HANDWRITTEN }),
      descriptor({ panose: SANS }),
      descriptor({ panose: SERIF }),
      descriptor({ panose: SLAB }),
      descriptor({ panose: DECORATIVE }),
      descriptor({ monospace: true }),
      descriptor({ family: 'Fraktur' }),
      descriptor(),
    ];
    for (const sample of samples) {
      const category: FontCategory = classifyFont(sample);
      expect(FONT_CATEGORY_LABELS[category]).toBeTruthy();
    }
  });
});

describe('categoriesPresent', () => {
  it('lists only what is actually there, script first', () => {
    const present = categoriesPresent([
      descriptor({ family: 'Times New Roman' }),
      descriptor({ family: 'Great Vibes' }),
      descriptor({ monospace: true, family: 'Consolas' }),
    ]);
    expect(present).toEqual(['script', 'serif', 'monospace']);
  });

  it('is empty for an empty catalogue', () => {
    expect(categoriesPresent([])).toEqual([]);
  });
});
