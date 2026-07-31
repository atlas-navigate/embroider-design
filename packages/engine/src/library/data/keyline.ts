import { circle, ellipse, heart, leaf, polygon, roundRect, star } from './draw.js';

/**
 * Keylines — the dark outline that makes an icon read as a drawing rather than
 * as a set of adjacent colour patches.
 *
 * ## The house rules for a redrawn icon
 *
 * Every themed icon in the catalogue follows these. They are here rather than
 * in a document because this is the file each redraw imports.
 *
 * 1. **Part order** is backing or shadow, then fills back to front, then
 *    highlights, then blush, then the keyline — which is always last.
 * 2. **Three to five colours**: one palette family's three tones, at most one
 *    accent, plus the keyline. That is about as many thread changes as anyone
 *    will stand for an icon two inches across.
 * 3. **One dark part per icon.** The outline bands, the eyes, the nostrils, the
 *    mouth and every interior detail line live in it together. Two dark parts
 *    means the machine stops twice for the same spool, and
 *    `shape-library.test.ts` fails the shape for it.
 * 4. **Bands go inward.** A band's outer edge sits *on* the silhouette and its
 *    inner edge is inset. An outward band grows the icon past the authoring box
 *    and, worse, silently changes `libraryShapeBounds` — and therefore where
 *    the shape lands when placed.
 * 5. **Solid features sit inside a band's cavity, never across it.** The
 *    compiler unions a part's regions before stitching, so an eye that overlaps
 *    its own outline band closes the band's hole and the keyline comes out as a
 *    solid blob. `keyline.test.ts` checks this.
 *
 * ## Why the keyline is drawn, not generated
 *
 * It would be tempting to derive it — union the parts, hollow the result, done.
 * That fails on all three counts that matter. It can only ever trace the outer
 * silhouette, where half the value of a keyline is the *interior* edges (a
 * gingerbread man's limbs, a tree's tiers, a beard against a hat). It appends a
 * second run of the dark thread to the shipped icons that already use one
 * mid-sequence, which is rule 3. And the shapes panel draws live thumbnails, so
 * every category chip would pay a polygon clip over the whole catalogue to keep
 * the thumbnail honest about what placing the shape would insert.
 *
 * ## A note on winding
 *
 * The cavity rings below are emitted in whatever direction the primitive
 * naturally produces, not deliberately counter-wound. `groupRingsIntoRegions`
 * decides what is a hole purely by containment depth, so direction carries no
 * meaning — and a "reversal" that walked a cubic's control points would move
 * the ring off its own curve, since control points do not lie on it.
 */

/**
 * Keyline width, in authoring units — a fiftieth of the box.
 *
 * Two units is about 1.2 mm of thread at a 60 mm placement and 2.4 mm at
 * 120 mm. Below roughly 40 mm it falls under `minSatinWidth` and the router
 * picks a bean stitch instead, which is exactly what a keyline should become at
 * an inch. **Leave the keyline part's `stitchType` alone** — `chooseStitchType`
 * short-circuits on any explicit type, so forcing `'satin'` would defeat that.
 */
export const KEYLINE = 2;

/**
 * Shrinks a dimension by the wall without letting it reach zero.
 *
 * A cavity that collapses does not error: the band simply becomes a solid
 * shape, and the icon stitches with a filled blob where its outline should be.
 * Keeping a sliver back means a too-thick wall degrades to a thin hole rather
 * than to no hole at all, and `keyline.test.ts` catches the shapes where that
 * happened.
 */
function inset(size: number, wall: number): number {
  return Math.max(size - wall, size * 0.05);
}

/** A band just inside a circle: the contour, plus the cavity it encloses. */
export function circleBand(cx: number, cy: number, r: number, wall = KEYLINE): string {
  return `${circle(cx, cy, r, true)} ${circle(cx, cy, inset(r, wall), false)}`;
}

export function ellipseBand(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  wall = KEYLINE,
): string {
  return (
    `${ellipse(cx, cy, rx, ry, true)} ` +
    `${ellipse(cx, cy, inset(rx, wall), inset(ry, wall), false)}`
  );
}

export function roundRectBand(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  wall = KEYLINE,
): string {
  const iw = inset(w, wall * 2);
  const ih = inset(h, wall * 2);
  // Re-centred, so the band is even on all four sides rather than hugging one.
  return (
    `${roundRect(x, y, w, h, r)} ` +
    `${roundRect(x + (w - iw) / 2, y + (h - ih) / 2, iw, ih, Math.max(r - wall, 0))}`
  );
}

/**
 * A band inside a regular polygon.
 *
 * The inner radius comes down by `wall / cos(pi / sides)`, not by `wall`:
 * insetting every *edge* by the wall moves the vertices further than that, and
 * using the plain wall gives a band visibly thin at the corners.
 */
export function polygonBand(
  cx: number,
  cy: number,
  r: number,
  sides: number,
  turn = 0,
  wall = KEYLINE,
): string {
  const count = Math.max(3, Math.round(sides));
  const innerR = inset(r, wall / Math.cos(Math.PI / count));
  return `${polygon(cx, cy, r, count, turn)} ${polygon(cx, cy, innerR, count, turn)}`;
}

/**
 * A band inside a star.
 *
 * Both radii shrink, but the tips need more than the valleys do — a star inset
 * uniformly loses its points first. The correction is deliberately mild: an
 * exact offset of a sharp star gives tips far heavier than the rest of the
 * band, and on fabric a slightly heavy point beats a bald one.
 */
export function starBand(
  cx: number,
  cy: number,
  r: number,
  innerR: number,
  points: number,
  turn = 0,
  wall = KEYLINE,
): string {
  return (
    `${star(cx, cy, r, innerR, points, turn)} ` +
    `${star(cx, cy, inset(r, wall * 1.6), inset(innerR, wall), points, turn)}`
  );
}

export function heartBand(cx: number, top: number, w: number, h: number, wall = KEYLINE): string {
  return `${heart(cx, top, w, h)} ${heart(cx, top + wall, inset(w, wall * 2), inset(h, wall * 2))}`;
}

export function leafBand(cx: number, top: number, w: number, h: number, wall = KEYLINE): string {
  return `${leaf(cx, top, w, h)} ${leaf(cx, top + wall, inset(w, wall * 2), inset(h, wall * 2))}`;
}

/**
 * A band along a centreline the primitives above cannot express.
 *
 * Offsets the author's own points to either side; pure arithmetic, no clipper,
 * and it emits only `L` segments. A **closed** centreline gives a band with a
 * hole — an outline. An **open** one gives a solid ribbon, which is how a rope,
 * a stem, a whisker or a hat brim gets drawn.
 *
 * `width` may be a function of position along the line, from 0 to 1, for a
 * stroke that thickens and thins.
 */
export function strokeBand(
  points: readonly (readonly [number, number])[],
  width: number | ((t: number) => number) = KEYLINE,
  options: { closed?: boolean } = {},
): string {
  const pts = points.map(([x, y]) => ({ x, y }));
  if (pts.length < 2) return '';
  const closed = options.closed ?? false;
  const widthAt = typeof width === 'function' ? width : (): number => width;

  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  const last = pts.length - 1;

  for (let i = 0; i <= last; i++) {
    // The direction at a point is the average of the segments meeting there,
    // which keeps a corner from pinching on the inside of the turn.
    const prev = i === 0 ? (closed ? pts[last] : pts[0]) : pts[i - 1];
    const next = i === last ? (closed ? pts[0] : pts[last]) : pts[i + 1];
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-9) {
      dx = 1;
      dy = 0;
    } else {
      dx /= length;
      dy /= length;
    }
    const half = widthAt(last === 0 ? 0 : i / last) / 2;
    left.push({ x: pts[i].x - dy * half, y: pts[i].y + dx * half });
    right.push({ x: pts[i].x + dy * half, y: pts[i].y - dx * half });
  }

  const draw = (ring: readonly { x: number; y: number }[]): string =>
    `M ${ring.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(' L ')} Z`;

  if (closed) {
    // Two rings: the outer contour and the cavity inside it.
    return `${draw(left)} ${draw(right)}`;
  }
  return draw([...left, ...right.slice().reverse()]);
}

function fmt(value: number): string {
  return String(+value.toFixed(2));
}
