import { regionToRings } from '../geometry/regions.js';
import { applyToPoints } from '../geometry/transform.js';
import { threadLuminance, threadToHex, type ThreadColor } from '../pattern/thread.js';
import type { RgbaImage } from '../autodigitize/image-data.js';
import { autoDigitizeImage, mergeSimilarColors } from '../autodigitize/pipeline.js';
import { createCustomShapeId } from './custom-shape.js';
import { authoringBoxTransform, pathDataFromRings } from './path-data.js';
import { AUTHORING_BOX, type LibraryPart, type LibraryShape } from './types.js';

/**
 * One traced image, rebuilt as a catalogue shape.
 *
 * This is the join between the two halves of the app that already existed
 * separately: the auto-digitizer, which turns pixels into coloured regions, and
 * the shape library, which stores artwork as path data in a 0-100 box. What
 * comes out is a `LibraryShape` and nothing more — so an imported icon gets
 * thumbnails, search, placement, grouping and stitching for free, exactly as a
 * shape saved from the canvas does.
 *
 * It is deliberately not held to the rules `shape-library.test.ts` applies to
 * the shipped catalogue. Those assert things a person drawing by hand can
 * promise — one unbroken run per thread, a small colour budget — and a tracer
 * working from a JPEG cannot. Holding imports to them would mean rejecting
 * most real artwork rather than improving it.
 */

export interface ShapeFromImageOptions {
  name: string;
  /** Threads the icon reduces to. Each one is a stop at the machine. */
  colors?: number;
  /** Morphological cleanup radius; higher loses detail and gains smooth edges. */
  smoothing?: number;
  /** Collapse colours no thread could tell apart. On by default. */
  mergeSimilar?: boolean;
  /** The user's grouping for this shape. */
  collection?: string;
  keywords?: string[];
  /**
   * Move the dark outline to the end, so it sews over the finished artwork the
   * way a hand-drawn icon's keyline does. On by default.
   */
  keylineLast?: boolean;
}

const DEFAULT_COLORS = 5;
const DEFAULT_SMOOTHING = 1;

/**
 * The smallest feature worth keeping, in authoring units.
 *
 * `autoDigitizeImage` measures this in square millimetres of *finished design*,
 * and its 1 mm² default is calibrated for one imported at its real size. Traced
 * into the 100-unit authoring box the whole icon is nominally 10 mm across, so
 * that default would throw away anything under a tenth of the icon — every eye,
 * every nostril, every highlight. Three units square is the honest threshold
 * here: below that nothing survives being sewn anyway.
 */
const MIN_FEATURE_UNITS = 3;

/** Above this share of the icon a dark colour is the subject, not its outline. */
const KEYLINE_MAX_COVERAGE = 0.25;
/** Below this luminance a colour reads as the dark that draws edges. */
const KEYLINE_MAX_LUMINANCE = 96;

interface TracedPart {
  part: LibraryPart;
  color: ThreadColor;
  coverage: number;
}

/**
 * Picks the part that is acting as the icon's keyline.
 *
 * Dark *and* thin, both. Darkness alone would pull a black cat's body to the
 * end of the sequence, where it would sew over its own face.
 */
function keylineIndex(parts: readonly TracedPart[]): number {
  let best = -1;
  let darkest = KEYLINE_MAX_LUMINANCE;
  parts.forEach((entry, index) => {
    if (entry.coverage > KEYLINE_MAX_COVERAGE) return;
    const luminance = threadLuminance(entry.color);
    if (luminance >= darkest) return;
    darkest = luminance;
    best = index;
  });
  return best;
}

export function libraryShapeFromImage(
  image: RgbaImage,
  options: ShapeFromImageOptions,
): LibraryShape | null {
  let traced = autoDigitizeImage(image, {
    targetWidth: AUTHORING_BOX,
    colors: options.colors ?? DEFAULT_COLORS,
    removeBackground: true,
    morphology: options.smoothing ?? DEFAULT_SMOOTHING,
    minRegionAreaMm2: (MIN_FEATURE_UNITS / 10) ** 2,
  });
  if (options.mergeSimilar ?? true) traced = mergeSimilarColors(traced);
  if (traced.colors.length === 0) return null;

  const colours = traced.colors.map((entry) => ({
    color: entry.color,
    coverage: entry.coverage,
    // Flat, outer-then-holes: `groupRingsIntoRegions` recovers the nesting from
    // the stored string, so a ring traced with a hole in it stays a ring.
    rings: entry.regions.flatMap(regionToRings),
  }));

  /**
   * One transform for every part, measured over all of them at once.
   *
   * Fitting each part to its own bounds is the mistake `path-data.ts` warns
   * about: it scales the pieces independently and the icon comes back with its
   * outline the size of its body.
   */
  const matrix = authoringBoxTransform(colours.flatMap((entry) => entry.rings));

  const built: TracedPart[] = [];
  for (const entry of colours) {
    const d = pathDataFromRings(entry.rings.map((ring) => applyToPoints(matrix, ring)));
    if (d.length === 0) continue;
    built.push({
      color: entry.color,
      coverage: entry.coverage,
      part: { name: 'Colour', d, color: threadToHex(entry.color) },
    });
  }
  if (built.length === 0) return null;

  // `autoDigitizeImage` already returns the broadest colour first, which is both
  // the right stacking order and the right sewing order. All this does is lift
  // the outline out of the middle of that sequence and put it on the end.
  const ordered = [...built];
  const keyline = (options.keylineLast ?? true) ? keylineIndex(ordered) : -1;
  if (keyline >= 0) ordered.push(...ordered.splice(keyline, 1));

  const parts = ordered.map((entry, index): LibraryPart => ({
    ...entry.part,
    name:
      keyline >= 0 && index === ordered.length - 1 ? 'Outline' : `Colour ${index + 1}`,
  }));

  const trimmed = options.name.trim();
  return {
    id: createCustomShapeId(),
    name: trimmed.length > 0 ? trimmed : 'Imported icon',
    category: 'custom',
    ...(options.collection ? { collection: options.collection } : {}),
    keywords: [
      ...new Set(
        ['imported', 'traced', ...(options.collection ? [options.collection] : []), ...(options.keywords ?? [])]
          .map((keyword) => keyword.trim().toLowerCase())
          .filter(Boolean),
      ),
    ],
    parts,
  };
}
