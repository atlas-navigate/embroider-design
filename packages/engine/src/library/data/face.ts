import { circle, ellipse } from './draw.js';
import { taper } from './detail.js';

/**
 * The face that goes on an animal.
 *
 * Two conventions are baked in here that the catalogue previously carried by
 * hand in a comment at the top of every file that needed them, and that a
 * hurried redraw would drop.
 *
 * **A solid feature is cut out of the head as well as filled.** The eye's
 * outline goes into the head part as a counter-ring *and* is filled by the dark
 * part, from the same coordinates. Stitching an eye straight on top of a solid
 * fill puts two layers of thread in the same place: stiff, lumpy, and prone to
 * the underneath colour showing through the gaps in the top one. That is why
 * `cuteFace` hands back `sockets` separately — they belong to the head.
 *
 * **Eyes sit low and wide.** Placed on the centre line they read as a skull;
 * dropped below it and set well apart they read as young, which is the whole
 * effect the reference sheets are after.
 */

export interface FaceOptions {
  /** Eye radius. Defaults to a tenth of `size`. */
  eyeR?: number;
  /** Centre-to-centre eye spacing. Defaults to 0.42 of `size`. */
  eyeGap?: number;
  /** How far below `cy` the eyes sit. Defaults to 0.04 of `size`. */
  eyeDrop?: number;
  /** Open dots, closed lashes, or happy upward arcs. */
  look?: 'open' | 'closed' | 'happy';
  /** Cheek ovals. On by default: they are most of the charm. */
  blush?: boolean;
  /** A curved mouth below the eyes. */
  smile?: boolean;
}

export interface FaceParts {
  /** Counter-rings to append to the head part's `d`, so features are cut not stacked. */
  sockets: string;
  /** Eyes, lashes and mouth — all for the icon's single dark part. */
  ink: string;
  /** Cheeks. Their own part, in `BLUSH_LIGHT`. */
  blush: string;
}

/** Closed eyes: a pair of downward lash arcs, as on the sleeping owls. */
export function closedEyes(cx: number, cy: number, size: number, width = 0): string {
  const gap = size * 0.42;
  const half = size * 0.11;
  const w = width > 0 ? width : size * 0.045;
  return [-1, 1]
    .map((side) => {
      const ex = cx + (side * gap) / 2;
      return taper(ex - half, cy, ex + half, cy, w, size * 0.07);
    })
    .join(' ');
}

/** Happy eyes: the same arcs, bowed the other way. */
export function happyEyes(cx: number, cy: number, size: number, width = 0): string {
  const gap = size * 0.42;
  const half = size * 0.11;
  const w = width > 0 ? width : size * 0.045;
  return [-1, 1]
    .map((side) => {
      const ex = cx + (side * gap) / 2;
      return taper(ex - half, cy, ex + half, cy, w, -size * 0.07);
    })
    .join(' ');
}

/** A curved mouth, opening downward. */
export function smile(cx: number, cy: number, width: number, depth: number, weight = 0): string {
  const w = weight > 0 ? weight : width * 0.11;
  return taper(cx - width / 2, cy, cx + width / 2, cy, w, depth);
}

/**
 * A face centred on `(cx, cy)`, scaled to a head of roughly `size` across.
 *
 * The three returned strings go to three different places — see `FaceParts`.
 * Appending `ink` to anything other than the icon's one dark part will fail the
 * unbroken-thread-run check in `shape-library.test.ts`.
 */
export function cuteFace(
  cx: number,
  cy: number,
  size: number,
  options: FaceOptions = {},
): FaceParts {
  const look = options.look ?? 'open';
  const eyeR = options.eyeR ?? size * 0.1;
  const gap = options.eyeGap ?? size * 0.42;
  const drop = options.eyeDrop ?? size * 0.04;
  const eyeY = cy + drop;
  const leftX = cx - gap / 2;
  const rightX = cx + gap / 2;

  const eyes =
    look === 'open'
      ? `${circle(leftX, eyeY, eyeR)} ${circle(rightX, eyeY, eyeR)}`
      : look === 'closed'
        ? closedEyes(cx, eyeY, size)
        : happyEyes(cx, eyeY, size);

  const mouth = options.smile === false ? '' : smile(cx, cy + size * 0.26, size * 0.26, size * 0.07);

  const cheeks =
    options.blush === false
      ? ''
      : `${ellipse(leftX - size * 0.16, eyeY + size * 0.16, size * 0.1, size * 0.07)} ` +
        `${ellipse(rightX + size * 0.16, eyeY + size * 0.16, size * 0.1, size * 0.07)}`;

  return {
    // Only solid eyes need cutting out. A lash is a hairline, and cutting a
    // hairline out of the head would leave a gap the fabric shows through.
    sockets: look === 'open' ? eyes : '',
    ink: [eyes, mouth].filter(Boolean).join(' '),
    blush: cheeks,
  };
}
