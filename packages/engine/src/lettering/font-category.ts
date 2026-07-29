import type { FontDescriptor } from './font-loader.js';

/**
 * Sorting a font list into kinds, so "show me the cursive ones" is one click.
 *
 * A machine with 280 fonts installed is unusable as a flat list, and the thing
 * an embroiderer most often wants — a script face for a monogram — is exactly
 * the hardest to find by name, because script fonts are named after people and
 * places rather than after what they look like.
 *
 * Three signals, in order of trustworthiness:
 *
 * 1. **PANOSE byte 0**, the font's own statement of its family kind. When it
 *    is set it is nearly always right.
 * 2. **OS/2 sFamilyClass**, whose high byte is the IBM family class. Coarser,
 *    but it distinguishes serif from sans, which PANOSE alone does not do
 *    without reading further bytes.
 * 3. **The family name.** A fallback, not a first resort — but a large share
 *    of fonts leave PANOSE entirely zeroed, and "Brush Script MT" is not
 *    ambiguous to a human.
 */

export type FontCategory =
  | 'script'
  | 'serif'
  | 'sans'
  | 'slab'
  | 'display'
  | 'blackletter'
  | 'monospace';

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  script: 'Cursive & script',
  serif: 'Serif',
  sans: 'Sans serif',
  slab: 'Slab serif',
  display: 'Display',
  blackletter: 'Blackletter',
  monospace: 'Monospace',
};

/** PANOSE byte 0. */
const PANOSE_LATIN_TEXT = 2;
const PANOSE_LATIN_HAND_WRITTEN = 3;
const PANOSE_LATIN_DECORATIVE = 4;

/** PANOSE byte 1 (serif style) values that mean "no serifs". */
const PANOSE_SANS_SERIF_STYLES = new Set([11, 12, 13]);
/** PANOSE byte 1 values for the square/slab serif families. */
const PANOSE_SLAB_SERIF_STYLES = new Set([5, 6, 7, 8]);

const SCRIPT_WORDS = [
  'script',
  'cursive',
  'handwriting',
  'hand written',
  'handwritten',
  'brush',
  'calligraph',
  'chancery',
  'italic hand',
  'signature',
  'swash',
  'vibes',
  'corsiva',
  'mistral',
  'vivaldi',
  'edwardian',
  'kunstler',
  'freestyle',
  'palace',
  'rage',
  'segoe print',
  'ink free',
  'gabriola',
  'lucida handwriting',
  'allura',
  'sacramento',
  'parisienne',
  'italianno',
  'tangerine',
  'pacifico',
  'satisfy',
  'courgette',
  'yellowtail',
  'cookie',
  'grand hotel',
  'marck',
  'playball',
  'lobster',
  'pinyon',
];

const BLACKLETTER_WORDS = ['fraktur', 'blackletter', 'gothic text', 'old english', 'textura'];

const DISPLAY_WORDS = [
  'display',
  'poster',
  'stencil',
  'shadow',
  'outline',
  'jokerman',
  'curlz',
  'papyrus',
  'impact',
  'showcard',
  'bungee',
  'bebas',
  'staatliches',
  'graduate',
  'alfa slab',
  'ultra',
];

const SLAB_WORDS = ['slab', 'rockwell', 'clarendon', 'courier'];

const SERIF_WORDS = [
  'serif',
  'times',
  'georgia',
  'garamond',
  'baskerville',
  'cambria',
  'book antiqua',
  'palatino',
  'bookman',
  'century',
  'constantia',
  'sylfaen',
  'playfair',
];

const MONO_WORDS = ['mono', 'consolas', 'courier', 'code', 'terminal'];

function haystackOf(descriptor: FontDescriptor): string {
  return `${descriptor.family} ${descriptor.subfamily} ${descriptor.fullName}`.toLowerCase();
}

function matches(haystack: string, words: readonly string[]): boolean {
  return words.some((word) => haystack.includes(word));
}

/**
 * Best guess at what kind of face this is.
 *
 * Never throws and never returns nothing: an unclassifiable font is `sans`,
 * which is what the great majority of unclassifiable fonts turn out to be.
 */
export function classifyFont(descriptor: FontDescriptor): FontCategory {
  const haystack = haystackOf(descriptor);

  // Blackletter and monospace are checked before anything else because both are
  // regularly mislabelled by their own metadata — plenty of blackletter faces
  // declare themselves plain Latin text.
  if (matches(haystack, BLACKLETTER_WORDS)) return 'blackletter';
  if (descriptor.monospace || matches(haystack, MONO_WORDS)) return 'monospace';

  const panose = descriptor.panose ?? [];
  const kind = panose[0] ?? 0;
  const serifStyle = panose[1] ?? 0;

  if (kind === PANOSE_LATIN_HAND_WRITTEN) return 'script';
  if (kind === PANOSE_LATIN_DECORATIVE) {
    // Decorative covers both "a wild display face" and a good many scripts, so
    // the name gets the casting vote here.
    return matches(haystack, SCRIPT_WORDS) ? 'script' : 'display';
  }

  // The name outranks a "Latin text" PANOSE for scripts: a script face that
  // declares itself as text is common, the reverse is not.
  if (matches(haystack, SCRIPT_WORDS)) return 'script';

  if (kind === PANOSE_LATIN_TEXT && serifStyle > 0) {
    if (PANOSE_SANS_SERIF_STYLES.has(serifStyle)) return 'sans';
    if (PANOSE_SLAB_SERIF_STYLES.has(serifStyle)) return 'slab';
    return 'serif';
  }

  // sFamilyClass high byte: 1-7 are the serif classes, 8 is sans, 10 is script,
  // 12 is "decorative/display".
  const familyClass = (descriptor.familyClass ?? 0) >> 8;
  if (familyClass === 10) return 'script';
  if (familyClass === 8) return 'sans';
  if (familyClass === 12) return 'display';
  if (familyClass === 5) return 'slab';
  if (familyClass >= 1 && familyClass <= 7) return 'serif';

  if (matches(haystack, DISPLAY_WORDS)) return 'display';
  if (matches(haystack, SLAB_WORDS)) return 'slab';
  if (matches(haystack, SERIF_WORDS)) return 'serif';
  return 'sans';
}

/** Categories present in a catalogue, in a stable display order. */
export function categoriesPresent(
  descriptors: readonly FontDescriptor[],
): FontCategory[] {
  const order: FontCategory[] = [
    'script',
    'serif',
    'sans',
    'slab',
    'display',
    'blackletter',
    'monospace',
  ];
  const present = new Set(descriptors.map(classifyFont));
  return order.filter((category) => present.has(category));
}
