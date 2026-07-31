/**
 * Path-data helpers for authoring the catalogue.
 *
 * These emit `d` strings, not geometry. Everything in the catalogue is stored
 * as a string so it can be checked against any SVG editor and diffed like text
 * — see `library/path-data.ts` — and a helper that returned points would have
 * to be undone before the shape could be stored.
 *
 * A circle is four cubics rather than an elliptical arc for the reason
 * `path-data.ts` gives at length: the parser deliberately refuses `A`, because
 * an arc implementation that mis-draws one shape in fifty is worse than no arc
 * at all.
 */

/** Control-point offset for a quarter circle of radius 1. */
const KAPPA = 0.5523;

function n(value: number): string {
  return String(+value.toFixed(2));
}

/**
 * A circle. `clockwise` only decides the winding, which nothing downstream
 * reads — `groupRingsIntoRegions` sorts holes out by containment, not by
 * direction — but keeping counters wound the other way makes the intent
 * legible to whoever edits the path next.
 */
export function circle(cx: number, cy: number, r: number, clockwise = true): string {
  return ellipse(cx, cy, r, r, clockwise);
}

export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  clockwise = true,
): string {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  const [l, r, t, b] = [cx - rx, cx + rx, cy - ry, cy + ry];
  return clockwise
    ? `M ${n(cx)} ${n(t)} C ${n(cx + kx)} ${n(t)} ${n(r)} ${n(cy - ky)} ${n(r)} ${n(cy)} ` +
        `C ${n(r)} ${n(cy + ky)} ${n(cx + kx)} ${n(b)} ${n(cx)} ${n(b)} ` +
        `C ${n(cx - kx)} ${n(b)} ${n(l)} ${n(cy + ky)} ${n(l)} ${n(cy)} ` +
        `C ${n(l)} ${n(cy - ky)} ${n(cx - kx)} ${n(t)} ${n(cx)} ${n(t)} Z`
    : `M ${n(cx)} ${n(t)} C ${n(cx - kx)} ${n(t)} ${n(l)} ${n(cy - ky)} ${n(l)} ${n(cy)} ` +
        `C ${n(l)} ${n(cy + ky)} ${n(cx - kx)} ${n(b)} ${n(cx)} ${n(b)} ` +
        `C ${n(cx + kx)} ${n(b)} ${n(r)} ${n(cy + ky)} ${n(r)} ${n(cy)} ` +
        `C ${n(r)} ${n(cy - ky)} ${n(cx + kx)} ${n(t)} ${n(cx)} ${n(t)} Z`;
}

/**
 * An annulus: outer ring plus a counter-ring the region grouper reads as the
 * hole. This is how every donut, wheel and ring in the catalogue is drawn, and
 * why they stitch as bands rather than as discs with discs on top.
 */
export function ring(cx: number, cy: number, outer: number, inner: number): string {
  return `${circle(cx, cy, outer, true)} ${circle(cx, cy, inner, false)}`;
}

/** A regular polygon, first point straight up. */
export function polygon(cx: number, cy: number, r: number, sides: number, turn = 0): string {
  const points: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = turn - Math.PI / 2 + (i / sides) * Math.PI * 2;
    points.push(`${n(cx + Math.cos(angle) * r)} ${n(cy + Math.sin(angle) * r)}`);
  }
  return `M ${points.join(' L ')} Z`;
}

/** A star: `points` spikes at `r`, valleys at `innerR`. */
export function star(
  cx: number,
  cy: number,
  r: number,
  innerR: number,
  points: number,
  turn = 0,
): string {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = turn - Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const radius = i % 2 === 0 ? r : innerR;
    out.push(`${n(cx + Math.cos(angle) * radius)} ${n(cy + Math.sin(angle) * radius)}`);
  }
  return `M ${out.join(' L ')} Z`;
}

/** A teardrop flame, point upward. Used by every candle in the catalogue. */
export function flame(cx: number, top: number, height: number): string {
  const w = height * 0.42;
  const base = top + height;
  return (
    `M ${n(cx)} ${n(top)} ` +
    `C ${n(cx + w)} ${n(top + height * 0.42)} ${n(cx + w)} ${n(base - height * 0.1)} ${n(cx)} ${n(base)} ` +
    `C ${n(cx - w)} ${n(base - height * 0.1)} ${n(cx - w)} ${n(top + height * 0.42)} ${n(cx)} ${n(top)} Z`
  );
}

/** A rectangle, for the many parts that are honestly just rectangles. */
export function rect(x: number, y: number, w: number, h: number): string {
  return `M ${n(x)} ${n(y)} L ${n(x + w)} ${n(y)} L ${n(x + w)} ${n(y + h)} L ${n(x)} ${n(y + h)} Z`;
}

/** A rounded rectangle. `r` is clamped to what the box can actually take. */
export function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, h / 2);
  const k = radius * (1 - KAPPA);
  return (
    `M ${n(x + radius)} ${n(y)} L ${n(x + w - radius)} ${n(y)} ` +
    `C ${n(x + w - k)} ${n(y)} ${n(x + w)} ${n(y + k)} ${n(x + w)} ${n(y + radius)} ` +
    `L ${n(x + w)} ${n(y + h - radius)} ` +
    `C ${n(x + w)} ${n(y + h - k)} ${n(x + w - k)} ${n(y + h)} ${n(x + w - radius)} ${n(y + h)} ` +
    `L ${n(x + radius)} ${n(y + h)} ` +
    `C ${n(x + k)} ${n(y + h)} ${n(x)} ${n(y + h - k)} ${n(x)} ${n(y + h - radius)} ` +
    `L ${n(x)} ${n(y + radius)} ` +
    `C ${n(x)} ${n(y + k)} ${n(x + k)} ${n(y)} ${n(x + radius)} ${n(y)} Z`
  );
}

/**
 * A heart, sized to a box. Spelled out rather than assembled from circles
 * because the join between the lobes is the part that has to be right: two
 * overlapping discs give a cleavage that is visibly a pair of circles.
 */
export function heart(cx: number, top: number, w: number, h: number): string {
  const half = w / 2;
  return (
    `M ${n(cx)} ${n(top + h)} ` +
    `C ${n(cx - half * 0.62)} ${n(top + h * 0.72)} ${n(cx - half)} ${n(top + h * 0.52)} ${n(cx - half)} ${n(top + h * 0.33)} ` +
    `C ${n(cx - half)} ${n(top + h * 0.1)} ${n(cx - half * 0.55)} ${n(top)} ${n(cx - half * 0.28)} ${n(top)} ` +
    `C ${n(cx - half * 0.12)} ${n(top)} ${n(cx)} ${n(top + h * 0.08)} ${n(cx)} ${n(top + h * 0.2)} ` +
    `C ${n(cx)} ${n(top + h * 0.08)} ${n(cx + half * 0.12)} ${n(top)} ${n(cx + half * 0.28)} ${n(top)} ` +
    `C ${n(cx + half * 0.55)} ${n(top)} ${n(cx + half)} ${n(top + h * 0.1)} ${n(cx + half)} ${n(top + h * 0.33)} ` +
    `C ${n(cx + half)} ${n(top + h * 0.52)} ${n(cx + half * 0.62)} ${n(top + h * 0.72)} ${n(cx)} ${n(top + h)} Z`
  );
}

/** A leaf: a pointed oval, tip up. */
export function leaf(cx: number, top: number, w: number, h: number): string {
  const half = w / 2;
  return (
    `M ${n(cx)} ${n(top)} ` +
    `C ${n(cx + half)} ${n(top + h * 0.28)} ${n(cx + half)} ${n(top + h * 0.72)} ${n(cx)} ${n(top + h)} ` +
    `C ${n(cx - half)} ${n(top + h * 0.72)} ${n(cx - half)} ${n(top + h * 0.28)} ${n(cx)} ${n(top)} Z`
  );
}

/**
 * A plump body.
 *
 * `bulge` 0 is an ellipse; 1 pushes the widest point below centre and narrows
 * the shoulders, giving something that sits on its base. Nearly every animal,
 * egg, acorn and ghost in the catalogue is one of these, and drawing them from
 * one function is what stops a squirrel and a bunny reading as different hands.
 */
export function blob(cx: number, top: number, w: number, h: number, bulge = 0.5): string {
  const half = w / 2;
  const upper = h * (0.5 + 0.2 * bulge); // top down to the widest point
  const lower = h - upper;
  const my = top + upper;
  const bottom = top + h;
  // Narrower shoulders as the bulge grows: the whole point is that the mass
  // is low, and an ellipse with a low waist but full shoulders reads as a pear.
  const kTopX = half * KAPPA * (1 - 0.3 * bulge);
  const kBotX = half * KAPPA;
  const kUpY = upper * KAPPA;
  const kLoY = lower * KAPPA;
  return (
    `M ${n(cx)} ${n(top)} ` +
    `C ${n(cx + kTopX)} ${n(top)} ${n(cx + half)} ${n(my - kUpY)} ${n(cx + half)} ${n(my)} ` +
    `C ${n(cx + half)} ${n(my + kLoY)} ${n(cx + kBotX)} ${n(bottom)} ${n(cx)} ${n(bottom)} ` +
    `C ${n(cx - kBotX)} ${n(bottom)} ${n(cx - half)} ${n(my + kLoY)} ${n(cx - half)} ${n(my)} ` +
    `C ${n(cx - half)} ${n(my - kUpY)} ${n(cx - kTopX)} ${n(top)} ${n(cx)} ${n(top)} Z`
  );
}

/**
 * A rounded top on a square base. `shoulder` is the corner radius up top, and
 * at `w / 2` the whole top is a half circle.
 *
 * Tombstones, gift lids, books, bells, tree tiers, lanterns, mailboxes.
 */
export function domeRect(x: number, y: number, w: number, h: number, shoulder: number): string {
  const sh = Math.min(shoulder, w / 2, h);
  const k = sh * (1 - KAPPA);
  return (
    `M ${n(x)} ${n(y + h)} L ${n(x)} ${n(y + sh)} ` +
    `C ${n(x)} ${n(y + k)} ${n(x + k)} ${n(y)} ${n(x + sh)} ${n(y)} ` +
    `L ${n(x + w - sh)} ${n(y)} ` +
    `C ${n(x + w - k)} ${n(y)} ${n(x + w)} ${n(y + k)} ${n(x + w)} ${n(y + sh)} ` +
    `L ${n(x + w)} ${n(y + h)} Z`
  );
}

/** A point on a circle. */
function at(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

/**
 * Cubic control-point offset for an arc of `sweep` radians, as a multiple of
 * the radius, measured along the tangent. The standard circle approximation:
 * at a quarter turn it comes out to KAPPA.
 */
function arcK(sweep: number): number {
  return (4 / 3) * Math.tan(sweep / 4);
}

/** Cubic segments along a circular arc, appended to an already-started path. */
function arcTo(cx: number, cy: number, r: number, from: number, to: number): string {
  // Split so no single cubic covers more than a quarter turn, where the
  // approximation is good to about one part in a thousand.
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) / (Math.PI / 2)));
  const step = (to - from) / steps;
  const k = arcK(step) * r;
  let out = '';
  for (let i = 0; i < steps; i++) {
    const a0 = from + step * i;
    const a1 = a0 + step;
    const p0 = at(cx, cy, r, a0);
    const p1 = at(cx, cy, r, a1);
    // Tangents are the radius turned a quarter turn in the direction of travel.
    const c1 = { x: p0.x - Math.sin(a0) * k, y: p0.y + Math.cos(a0) * k };
    const c2 = { x: p1.x + Math.sin(a1) * k, y: p1.y - Math.cos(a1) * k };
    out += ` C ${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(p1.x)} ${n(p1.y)}`;
  }
  return out;
}

/**
 * A lune — the lit edge of a round thing.
 *
 * Spans `arc` radians centred on `turn`, bulging out to `r` and back along a
 * shallower inner curve, so it tapers to a point at both tips. The highlight on
 * a bauble, an apple, a balloon; also a crescent moon at a wide enough arc.
 */
export function crescent(
  cx: number,
  cy: number,
  r: number,
  thickness: number,
  turn = -Math.PI / 2,
  arc = 2.2,
): string {
  const from = turn - arc / 2;
  const to = turn + arc / 2;
  const inner = Math.max(r - thickness, 0);
  const start = at(cx, cy, r, from);
  // The inner return runs on a circle pushed toward the tips, so the lune
  // closes to a point rather than ending in two blunt little walls.
  const push = (r - inner) / 2;
  const ix = cx + Math.cos(turn) * push;
  const iy = cy + Math.sin(turn) * push;
  const innerR = r - push;
  const innerFrom = Math.atan2(start.y - iy, start.x - ix);
  const end = at(cx, cy, r, to);
  const innerTo = Math.atan2(end.y - iy, end.x - ix);
  return (
    `M ${n(start.x)} ${n(start.y)}` +
    arcTo(cx, cy, r, from, to) +
    arcTo(ix, iy, innerR, innerTo, innerFrom) +
    ' Z'
  );
}

/**
 * A box with one scalloped edge — `count` bumps along the bottom, or the top
 * when `up` is set. Cake icing, cupcake frosting, a Santa hat's trim, pie
 * crust, cloud bases.
 */
export function scallop(
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  up = false,
): string {
  const bumps = Math.max(1, Math.round(count));
  const bw = w / bumps;
  const r = bw / 2;
  const edge = up ? y : y + h;
  // 4/3 of the radius is the control offset that makes one cubic a half circle.
  const reach = up ? edge - (r * 4) / 3 : edge + (r * 4) / 3;
  let out = up
    ? `M ${n(x)} ${n(y + h)} L ${n(x + w)} ${n(y + h)} L ${n(x + w)} ${n(edge)}`
    : `M ${n(x)} ${n(y)} L ${n(x + w)} ${n(y)} L ${n(x + w)} ${n(edge)}`;
  for (let i = bumps - 1; i >= 0; i--) {
    const rightX = x + bw * (i + 1);
    const leftX = x + bw * i;
    out += ` C ${n(rightX)} ${n(reach)} ${n(leftX)} ${n(reach)} ${n(leftX)} ${n(edge)}`;
  }
  return `${out} Z`;
}

/**
 * A closed ring of rounded lobes: wreath, sunflower, mane, dahlia, doily.
 *
 * Built as a rounded star — tips at `r + bump`, valleys at `r`, joined by
 * cubics whose tangents run perpendicular to the radius, so the lobes meet
 * smoothly instead of in the little spikes a straight-sided star gives.
 */
export function scallopRing(
  cx: number,
  cy: number,
  r: number,
  bump: number,
  count: number,
): string {
  const lobes = Math.max(3, Math.round(count));
  const step = Math.PI / lobes; // tip, valley, tip, valley...
  const radiusAt = (i: number): number => (i % 2 === 0 ? r + bump : r);
  const total = lobes * 2;
  const start = at(cx, cy, radiusAt(0), -Math.PI / 2);
  let out = `M ${n(start.x)} ${n(start.y)}`;
  for (let i = 0; i < total; i++) {
    const a0 = -Math.PI / 2 + step * i;
    const a1 = a0 + step;
    const r0 = radiusAt(i);
    const r1 = radiusAt(i + 1);
    const p0 = at(cx, cy, r0, a0);
    const p1 = at(cx, cy, r1, a1);
    const k = arcK(step);
    const c1 = { x: p0.x - Math.sin(a0) * k * r0, y: p0.y + Math.cos(a0) * k * r0 };
    const c2 = { x: p1.x + Math.sin(a1) * k * r1, y: p1.y - Math.cos(a1) * k * r1 };
    out += ` C ${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(p1.x)} ${n(p1.y)}`;
  }
  return `${out} Z`;
}

/** Repeats a path-maker over a list of positions, joining the results. */
export function repeat<T>(items: readonly T[], make: (item: T, index: number) => string): string {
  return items.map(make).join(' ');
}
