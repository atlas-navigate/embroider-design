/**
 * Interior detail: the lines drawn *on* a shape rather than around it.
 *
 * Every one of these is a closed filled area, never a stroke, because that is
 * the only thing the catalogue can hold — a `LibraryPart` is a region. So a
 * "line" here is a long thin lens, and the reason it is a lens rather than a
 * rectangle is thread: a rib that ends in a square butt reads as a dropped
 * stitch, while one that tapers to a point reads as a line that was drawn.
 *
 * These all belong in the icon's single dark part, alongside the keyline. See
 * `keyline.ts` for why there is exactly one of those per icon.
 */

function n(value: number): string {
  return String(+value.toFixed(2));
}

/**
 * A spindle from a to b — `width` across at the middle, pointed at both ends.
 *
 * `bow` bends the midline perpendicular to its own direction, which is what
 * turns a straight vein into one that follows the curve of a leaf. Positive is
 * to the left of the direction of travel.
 */
export function taper(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
  bow = 0,
): string {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return '';
  // Unit normal, left of travel.
  const nx = -dy / length;
  const ny = dx / length;
  const half = width / 2;

  // Control points at the quarter and three-quarter marks, pushed out to the
  // half width and along by the bow. One cubic per side gives a clean lens.
  const p = (t: number, offset: number): { x: number; y: number } => ({
    x: ax + dx * t + nx * (offset + bow * Math.sin(Math.PI * t)),
    y: ay + dy * t + ny * (offset + bow * Math.sin(Math.PI * t)),
  });

  const r1 = p(0.25, half);
  const r2 = p(0.75, half);
  const l2 = p(0.75, -half);
  const l1 = p(0.25, -half);
  return (
    `M ${n(ax)} ${n(ay)} ` +
    `C ${n(r1.x)} ${n(r1.y)} ${n(r2.x)} ${n(r2.y)} ${n(bx)} ${n(by)} ` +
    `C ${n(l2.x)} ${n(l2.y)} ${n(l1.x)} ${n(l1.y)} ${n(ax)} ${n(ay)} Z`
  );
}

/** One pair of side veins: where along the midrib, how long, and how swept back. */
export interface VeinPair {
  /** Position along the midrib, 0 at the root and 1 at the tip. */
  at: number;
  /** Length as a fraction of the midrib. */
  length: number;
  /** Angle from the midrib, in radians. Larger is more splayed. */
  spread: number;
}

/**
 * A midrib with pairs of side veins branching off it.
 *
 * Leaf veins, feather barbs, fur tufts, wheat awns, whiskers. Replaces the
 * hand-typed quads these used to be — a maple leaf's veins were a dozen lines
 * of literal coordinates that nobody could adjust without redrawing them.
 */
export function veins(
  rootX: number,
  rootY: number,
  tipX: number,
  tipY: number,
  pairs: readonly VeinPair[],
  width = 1.6,
): string {
  const dx = tipX - rootX;
  const dy = tipY - rootY;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return '';
  const axis = Math.atan2(dy, dx);

  const parts = [taper(rootX, rootY, tipX, tipY, width)];
  for (const pair of pairs) {
    const bx = rootX + dx * pair.at;
    const by = rootY + dy * pair.at;
    const reach = length * pair.length;
    for (const side of [-1, 1]) {
      const angle = axis + side * pair.spread;
      parts.push(
        // Side veins are finer than the midrib they come off, which is both
        // true of leaves and what keeps them from crowding it out at an inch.
        taper(bx, by, bx + Math.cos(angle) * reach, by + Math.sin(angle) * reach, width * 0.7),
      );
    }
  }
  return parts.filter(Boolean).join(' ');
}

/**
 * Evenly spaced curved lines across an ellipse — the lobes of a pumpkin, the
 * stripes of a melon, the ridges of a shell, the staves of a barrel.
 *
 * `sweep` is the fraction of the ellipse's width the ribs are spread over.
 * Leaving a margin matters: ribs that run to the silhouette's edge merge with
 * the keyline there and the whole thing reads as a bundle of sticks.
 */
export function ribs(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
  width = 1.6,
  sweep = 0.72,
): string {
  const lines = Math.max(1, Math.round(count));
  const parts: string[] = [];
  for (let i = 0; i < lines; i++) {
    // Spread across (-1, 1), skipping the extremes so nothing lands on the edge.
    const t = lines === 1 ? 0 : (i / (lines - 1)) * 2 - 1;
    const offset = t * rx * sweep;
    // Ribs bow away from the centre line, and the outer ones bow hardest —
    // that curvature is the whole difference between a pumpkin and a beach ball
    // drawn with straight lines.
    const bow = -t * rx * 0.22;
    // Shorter as they near the edge, following the ellipse.
    const reach = ry * Math.sqrt(Math.max(0, 1 - (offset / rx) ** 2)) * 0.94;
    if (reach < width) continue;
    parts.push(taper(cx + offset, cy - reach, cx + offset, cy + reach, width, bow));
  }
  return parts.join(' ');
}

/**
 * A crosshatch lattice inside a box: basket weave, pie lattice, netting,
 * waffle, plaid.
 *
 * Bars are lenses like everything else here, so the lattice thins where the
 * strands cross rather than piling four layers of thread into one point.
 */
export function weave(
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  width = 2.2,
): string {
  const lines = Math.max(1, Math.round(count));
  const parts: string[] = [];
  for (let i = 0; i < lines; i++) {
    const t = (i + 0.5) / lines;
    parts.push(taper(x, y + h * t, x + w, y + h * t, width));
    parts.push(taper(x + w * t, y, x + w * t, y + h, width));
  }
  return parts.join(' ');
}

/**
 * The standing highlight on a round thing.
 *
 * Top-left by default, because the catalogue lights everything from the top
 * left and a highlight that wanders is the fastest way to make a set of icons
 * look like it was drawn by several people.
 */
export function highlight(cx: number, cy: number, r: number, arc = 1.4, width = 0): string {
  const thickness = width > 0 ? width : r * 0.22;
  const inner = Math.max(r * 0.78, r - thickness);
  const turn = (-3 * Math.PI) / 4;
  const from = turn - arc / 2;
  const to = turn + arc / 2;
  const a = { x: cx + Math.cos(from) * r, y: cy + Math.sin(from) * r };
  const b = { x: cx + Math.cos(to) * r, y: cy + Math.sin(to) * r };
  const mid = turn;
  const outer = { x: cx + Math.cos(mid) * r, y: cy + Math.sin(mid) * r };
  const back = { x: cx + Math.cos(mid) * inner, y: cy + Math.sin(mid) * inner };
  // Two quadratic-ish cubics: out along the rim, back along a shallower curve.
  return (
    `M ${n(a.x)} ${n(a.y)} ` +
    `C ${n(a.x + (outer.x - a.x) * 0.6)} ${n(a.y + (outer.y - a.y) * 0.6)} ` +
    `${n(b.x + (outer.x - b.x) * 0.6)} ${n(b.y + (outer.y - b.y) * 0.6)} ${n(b.x)} ${n(b.y)} ` +
    `C ${n(b.x + (back.x - b.x) * 0.6)} ${n(b.y + (back.y - b.y) * 0.6)} ` +
    `${n(a.x + (back.x - a.x) * 0.6)} ${n(a.y + (back.y - a.y) * 0.6)} ${n(a.x)} ${n(a.y)} Z`
  );
}
