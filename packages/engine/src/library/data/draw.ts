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

/** Repeats a path-maker over a list of positions, joining the results. */
export function repeat<T>(items: readonly T[], make: (item: T, index: number) => string): string {
  return items.map(make).join(' ');
}
