import type { BoundingBox } from '../geometry/path.js';
import { chamferLabelDistance, type Mask } from './mask-ops.js';

/**
 * Deciding which marks on a page belong to the same icon.
 *
 * The rule this replaces was "one connected blob is one icon", with a
 * morphological close beforehand to weld an icon's pieces together. That rule
 * has no setting that works. Real icons are made of parts that do not touch —
 * a snowman's stick arms, a flame floating above its candle, coins scattered
 * over an owl, three ducks sold as one design — separated by anything from five
 * pixels to forty. A close radius large enough to bridge forty pixels reaches
 * the *neighbouring* icon first, because on a tight sheet the icons are barely
 * further apart than an icon is wide. Every radius either splits icons or welds
 * them, and which one it does changes per sheet.
 *
 * So grouping here is by proximity rather than by contact, and the distance is
 * read off the page instead of being a constant. Sheets are laid out: pieces of
 * one icon sit close together and icons sit further apart, and those two
 * populations are separated by a gap in the distribution that can be found. The
 * radius is whatever falls in that gap, which is why the same code handles a
 * 7x7 grid with 20px between neighbours and a sparse page with a flame 30px
 * above its candle without being told which it is looking at.
 *
 * Two things must happen before any of that, in this order, or it all comes
 * apart: printed rules have to go (one hairline across the page joins every
 * icon on it into a single cluster), and rows of caption text have to be
 * recognised (a line of letters chains along itself and then into whatever is
 * beside it).
 */

export interface Component {
  label: number;
  box: BoundingBox;
  pixelCount: number;
}

export interface Cluster {
  labels: Set<number>;
  box: BoundingBox;
  pixelCount: number;
  likelyLabel: boolean;
  labelReason?: LabelReason;
}

export type LabelReason = 'text-row' | 'wide-and-short' | 'tiny' | 'banner' | 'margin';

export type StructuralKind = 'frame' | 'rule' | 'border';

/** A component covering the page in both directions, drawn thin: a printed frame. */
const FRAME_SPAN = 0.9;
const FRAME_FILL = 0.06;
const BORDER_SPAN = 0.98;

/**
 * What makes a rule a rule, rather than a very long thin drawing.
 *
 * All three clauses carry weight, and dropping any one of them misclassifies
 * something real on these sheets:
 *
 *   - **half the page.** A wire between fairy lights is long; it is not seven
 *     hundred pixels long.
 *   - **three pixels thick.** Nothing drawn by hand holds a constant three
 *     pixels across half a page.
 *   - **more than half its box filled.** A row of evenly spaced dots has the
 *     span and the thinness of a rule and is not one.
 */
const RULE_SPAN = 0.5;
const RULE_THICKNESS = 0.004;
const RULE_MIN_THICKNESS = 3;
const RULE_FILL = 0.5;

export function isStructuralComponent(
  component: Component,
  width: number,
  height: number,
): StructuralKind | null {
  const w = component.box.maxX - component.box.minX;
  const h = component.box.maxY - component.box.minY;
  const fill = component.pixelCount / Math.max(1, w * h);

  if (w >= width * BORDER_SPAN && h >= height * BORDER_SPAN && fill < FRAME_FILL) return 'border';
  if (w >= width * FRAME_SPAN && h >= height * FRAME_SPAN && fill < FRAME_FILL) return 'frame';

  const horizontal =
    w >= width * RULE_SPAN &&
    h <= Math.max(RULE_MIN_THICKNESS, Math.round(height * RULE_THICKNESS)) &&
    fill > RULE_FILL;
  const vertical =
    h >= height * RULE_SPAN &&
    w <= Math.max(RULE_MIN_THICKNESS, Math.round(width * RULE_THICKNESS)) &&
    fill > RULE_FILL;
  return horizontal || vertical ? 'rule' : null;
}

export interface GapEdge {
  a: number;
  b: number;
  /** True ink-to-ink distance in pixels, not a distance between boxes. */
  gap: number;
}

/**
 * The distance between every pair of components that are neighbours.
 *
 * Walking the Voronoi diagram rather than the components: wherever two
 * neighbouring pixels are claimed by different components, the two of them
 * together span the shortest path between those components through that point,
 * so the sum of their distances is the gap. Taking the minimum over every such
 * point gives the true separation, exactly, for every pair that has any chance
 * of being adjacent — and pairs with something else between them cannot be
 * candidates for the same icon anyway.
 */
export function componentGaps(labels: Int32Array, width: number, height: number): GapEdge[] {
  const { distance, nearest } = chamferLabelDistance(labels, width, height);
  const best = new Map<number, number>();

  const consider = (p: number, q: number): void => {
    const a = nearest[p];
    const b = nearest[q];
    if (a < 0 || b < 0 || a === b) return;
    // One orthogonal step to cross from one claim to the other.
    const chamfer = distance[p] + distance[q] + 3;
    const key = a < b ? a * 0x40000000 + b : b * 0x40000000 + a;
    const existing = best.get(key);
    if (existing === undefined || chamfer < existing) best.set(key, chamfer);
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (x + 1 < width) consider(index, index + 1);
      if (y + 1 < height) consider(index, index + width);
    }
  }

  const edges: GapEdge[] = [];
  for (const [key, chamfer] of best) {
    const a = Math.floor(key / 0x40000000);
    edges.push({ a, b: key - a * 0x40000000, gap: chamfer / 3 });
  }
  return edges;
}

/**
 * The empty lanes between the rows and columns of a sheet.
 *
 * This is the strongest signal a page of clip-art gives, and it is worth far
 * more than anything measurable from the gaps alone. Measured on real sheets,
 * the distribution of distances between marks is *continuous* — an icon's own
 * pieces sit anywhere from two pixels to twenty apart, its neighbours from
 * twenty-five to sixty, and the two ranges overlap. There is no valley to find,
 * so no single reach can be right everywhere on the page, and the attempt
 * returns either an icon in eight pieces or four icons in one box.
 *
 * A gutter has none of that ambiguity. It is a band of the page, right across a
 * row, that has nothing at all in it, and every sheet here is laid out with
 * them because that is what makes a sheet readable to a person. Cutting on
 * gutters first turns the hard question — how far is too far — into a much
 * easier one asked inside a box already known to hold a single icon.
 *
 * Two cuts, rows and then columns within each row, and no deeper. Going deeper
 * is where it would start dismantling the icons themselves: the space between
 * two bulbs on a string of fairy lights is an empty lane too, and the only
 * thing that distinguishes it from the space between two icons is that it is
 * *inside* a cell the first two cuts already established.
 */
export function findRegions(
  ink: Mask,
  blockedAt: (index: number) => boolean,
): BoundingBox[] {
  const bounds = inkBounds(ink, blockedAt);
  if (!bounds) return [];

  let regions = cutOnce(ink, blockedAt, bounds);
  // Anything still far bigger than a typical cell is holding more than one
  // icon, so it gets cut again on its own — and measured on its own, where the
  // lanes are no longer competing with the rest of the page's. This is what
  // reaches a row whose icons overhang the lane above it, which is enough to
  // block the first cut across the whole page but not the second one taken
  // inside a single column.
  //
  // The page's own median cell is the stopping rule, and it is the reason this
  // cannot run away: once a box is the size of the other icons it is never
  // oversized again, however much clear air there is inside it between an
  // icon's parts.
  for (let pass = 0; pass < RECUT_PASSES; pass++) {
    const areas = regions
      .map((region) => (region.maxX - region.minX) * (region.maxY - region.minY))
      .sort((a, b) => a - b);
    // The thirtieth percentile, not the median. A sheet laid out as a heading
    // above every group of icons has exactly as many heading-sized boxes as
    // icon-row-sized ones, which puts the median at the bottom of the *large*
    // group — so every row of four icons measures as typical, nothing is ever
    // judged oversized, and each row ships as one cell. Reading lower down finds
    // the size of the small things on the page, which is what "a cell" means.
    const typical = areas[Math.floor(areas.length * TYPICAL_PERCENTILE)] ?? 0;
    const next: BoundingBox[] = [];
    let cut = false;
    for (const region of regions) {
      const area = (region.maxX - region.minX) * (region.maxY - region.minY);
      // A page that came back as one box has no median to judge by, so the
      // first pass always gets to try again.
      const oversized = regions.length === 1 ? pass === 0 : area > typical * OVERSIZE;
      const pieces = oversized ? cutOnce(ink, blockedAt, region) : [region];
      if (pieces.length > 1) cut = true;
      next.push(...(pieces.length > 0 ? pieces : [region]));
    }
    regions = next;
    if (!cut) break;
  }
  return regions;
}

/** How much bigger than the typical cell before a box is holding more than one icon. */
const OVERSIZE = 2.5;
const RECUT_PASSES = 4;
const TYPICAL_PERCENTILE = 0.3;

function cutOnce(
  ink: Mask,
  blockedAt: (index: number) => boolean,
  bounds: BoundingBox,
): BoundingBox[] {
  // Tightened onto their own ink before anything measures the space between
  // them. The pieces themselves meet edge to edge — they are cut down the
  // middle of each lane — so the distance between two *pieces* is always zero
  // and every lane on the page would read as no lane at all.
  const bands = rejoinSplitRows(
    splitAcross(ink, blockedAt, bounds, 'y', MIN_GUTTER)
      .map((band) => inkBounds(ink, blockedAt, band))
      .filter((band): band is BoundingBox => band !== null),
  );
  // The lanes between the rows set the bar for the lanes between the columns.
  // Within one row the space between two icons and the space between two parts
  // of one icon are both clear lanes, and nothing about that row separates
  // them — but the page has already shown, one axis over, how wide a lane it
  // uses to mean "different icon". Sheets are laid out with roughly the same
  // air in both directions, so that measurement carries across.
  const rowGutters: number[] = [];
  for (let i = 1; i < bands.length; i++) {
    rowGutters.push(Math.max(0, bands[i].minY - bands[i - 1].maxY));
  }
  rowGutters.sort((a, b) => a - b);
  const columnFloor =
    rowGutters.length > 0
      ? Math.max(MIN_GUTTER, Math.round(rowGutters[Math.floor(rowGutters.length / 2)] * ACROSS_AXIS_SHARE))
      : MIN_GUTTER;

  const regions: BoundingBox[] = [];
  for (const band of bands) {
    for (const cell of splitAcross(ink, blockedAt, band, 'x', columnFloor)) {
      const tight = inkBounds(ink, blockedAt, cell);
      if (tight) regions.push(tight);
    }
  }
  return regions;
}

/** A lane narrower than this is a gap inside a drawing, not a lane on a page. */
const MIN_GUTTER = 6;
/**
 * How wide a lane has to be, next to the widest lane in the same box, to count.
 *
 * Relative rather than absolute, because it has to mean the same thing on a
 * sheet of six icons and a sheet of fifty-six. On any one row of a real sheet
 * the lanes between the icons are all about as wide as each other and much
 * wider than anything inside an icon, so half of the widest separates the two
 * populations with room to spare.
 */
const GUTTER_SHARE = 0.5;
/** Ink in a line, as a share of the line's length, that still counts as clear. */
const CLEAR_LANE_SHARE = 0.02;
/** How much of the row spacing a column lane has to match to count as one. */
const ACROSS_AXIS_SHARE = 0.5;

/** A lane has to be this many times the ones around it to be a row boundary. */
const ALTERNATION_RATIO = 2;

/**
 * Puts back a row cut that went through the middle of every icon on the page.
 *
 * A candle with its flame floating above it, laid out six to a row, has a clear
 * lane between every flame and every candle — the icons are identical, so the
 * lane runs the whole width of the page and looks exactly like a lane between
 * two rows. Cut there and every icon on the sheet comes back in halves, which
 * is the "it does not include the whole icon" complaint in its purest form.
 *
 * What gives it away is that the *page* is regular in a way a stack of rows is
 * not: the lanes alternate, narrow then wide then narrow, because the narrow
 * one is inside an icon and the wide one is between rows. A page of ordinary
 * rows has lanes that are all much the same. So the rule is deliberately
 * narrow — it needs a clean two-to-one split in the lane widths *and* a strictly
 * alternating pattern beginning and ending with a narrow one — and it does
 * nothing at all to a page that does not show both.
 */
function rejoinSplitRows(bands: BoundingBox[]): BoundingBox[] {
  if (bands.length < 4) return bands;
  const gaps: number[] = [];
  for (let i = 1; i < bands.length; i++) gaps.push(Math.max(0, bands[i].minY - bands[i - 1].maxY));

  const sorted = [...gaps].sort((a, b) => a - b);
  let bestRatio = 0;
  let cut = 0;
  for (let i = 0; i + 1 < sorted.length; i++) {
    const ratio = sorted[i + 1] / Math.max(1, sorted[i]);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      cut = sorted[i];
    }
  }
  if (bestRatio < ALTERNATION_RATIO) return bands;

  // narrow, wide, narrow, wide, …, narrow — one icon per row, split in two.
  if (gaps.length % 2 === 0) return bands;
  for (let i = 0; i < gaps.length; i++) {
    const narrow = gaps[i] <= cut;
    if (narrow !== (i % 2 === 0)) return bands;
  }

  const joined: BoundingBox[] = [];
  for (let i = 0; i < bands.length; i++) {
    const band = { ...bands[i] };
    while (i < bands.length - 1 && gaps[i] <= cut) {
      i++;
      band.minX = Math.min(band.minX, bands[i].minX);
      band.maxX = Math.max(band.maxX, bands[i].maxX);
      band.maxY = bands[i].maxY;
    }
    joined.push(band);
  }
  return joined;
}

function splitAcross(
  ink: Mask,
  blockedAt: (index: number) => boolean,
  within: BoundingBox,
  axis: 'x' | 'y',
  floor: number,
): BoundingBox[] {
  const along = axis === 'y' ? within.maxY - within.minY : within.maxX - within.minX;
  if (along <= 0) return [];

  const across = axis === 'y' ? within.maxX - within.minX : within.maxY - within.minY;
  const counts = new Int32Array(along);
  for (let y = within.minY; y < within.maxY; y++) {
    for (let x = within.minX; x < within.maxX; x++) {
      const index = y * ink.width + x;
      if (ink.data[index] === 0 || blockedAt(index)) continue;
      counts[axis === 'y' ? y - within.minY : x - within.minX]++;
    }
  }

  // A lane is clear when it is *nearly* empty, not exactly empty. Demanding
  // exactly empty is what makes projection profiles brittle: one speck of JPEG
  // ringing anywhere along a row, or the tip of one ribbon overhanging into the
  // lane, and the whole lane disappears — taking the row structure of the page
  // with it and returning a single box around everything. A real row of icons
  // puts hundreds of pixels in every line it occupies, so the margin between
  // "nearly empty" and "occupied" is enormous and nothing is at risk.
  const clearIfUnder = Math.max(2, Math.round(across * CLEAR_LANE_SHARE));
  const occupied = new Uint8Array(along);
  for (let i = 0; i < along; i++) occupied[i] = counts[i] > clearIfUnder ? 1 : 0;

  // Empty runs strictly between the first and last occupied line: the margins
  // outside them are not lanes, they are just the edge of the page.
  const runs: { from: number; to: number }[] = [];
  let first = -1;
  let last = -1;
  for (let i = 0; i < along; i++) {
    if (!occupied[i]) continue;
    if (first < 0) first = i;
    last = i;
  }
  if (first < 0) return [];
  for (let i = first; i <= last; i++) {
    if (occupied[i]) continue;
    const from = i;
    while (i <= last && !occupied[i]) i++;
    runs.push({ from, to: i });
  }

  // Measured against the *typical* lane on this axis, not the widest one. The
  // widest is routinely an outlier — the band of white under a sheet's title is
  // twice any lane between two rows of icons — and anchoring to it sets the bar
  // above every regular lane on the page, which collapses the whole grid back
  // into one box. The median is what "a lane on this sheet" actually looks like.
  const widths = runs.map((run) => run.to - run.from).sort((a, b) => a - b);
  const typical = widths[Math.floor(widths.length / 2)] ?? 0;
  const minimum = Math.max(floor, typical * GUTTER_SHARE);
  const cuts = runs.filter((run) => run.to - run.from >= minimum);

  // Cut down the *middle* of each lane, not at the point the line count first
  // dropped below the tolerance. Those are not the same place: a round icon's
  // topmost rows hold only a few pixels each, so they read as clear, and a
  // piece ending where the clear reading began stops short of the icon's own
  // edge. `inkBounds` then tightens onto the truncated piece and the cell comes
  // back with the top and bottom of every icon shaved off — the crop is wrong,
  // the trace is wrong, and nothing anywhere says so. Splitting at the midpoint
  // leaves every pixel inside one piece or the other and lets `inkBounds` find
  // the real extent.
  const boundaries = cuts.map((cut) => Math.floor((cut.from + cut.to) / 2));
  const pieces: BoundingBox[] = [];
  let start = 0;
  for (const boundary of [...boundaries, along]) {
    if (boundary <= start) continue;
    pieces.push(
      axis === 'y'
        ? { ...within, minY: within.minY + start, maxY: within.minY + boundary }
        : { ...within, minX: within.minX + start, maxX: within.minX + boundary },
    );
    start = boundary;
  }
  return pieces;
}

function inkBounds(
  ink: Mask,
  blockedAt: (index: number) => boolean,
  within?: BoundingBox,
): BoundingBox | null {
  const x0 = Math.max(0, within?.minX ?? 0);
  const y0 = Math.max(0, within?.minY ?? 0);
  const x1 = Math.min(ink.width, within?.maxX ?? ink.width);
  const y1 = Math.min(ink.height, within?.maxY ?? ink.height);

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const index = y * ink.width + x;
      if (ink.data[index] === 0 || blockedAt(index)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + 1 > maxX) maxX = x + 1;
      if (y + 1 > maxY) maxY = y + 1;
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/**
 * How far to reach inside one cell of the grid.
 *
 * Generously, because the gutters have already done the hard part: everything
 * in this box is one icon unless a lane was missed, so the reach only has to
 * cross the space between an icon's own pieces and cannot cross to a
 * neighbour whatever it is set to.
 */
const REGION_REACH = 0.35;

export function reachWithin(region: BoundingBox): number {
  const span = Math.max(region.maxX - region.minX, region.maxY - region.minY);
  return Math.max(MIN_RADIUS, Math.round(span * REGION_REACH));
}

export type SeparationBasis = 'auto-grid' | 'auto-bimodal' | 'auto-unimodal' | 'given';

export interface RadiusChoice {
  radius: number;
  basis: SeparationBasis;
}

/** Below this much clear air past the chosen distance, there is no grouping to do. */
const BIMODAL_RATIO = 1.8;
const MAX_RADIUS_SHARE = 0.06;
const UNIMODAL_SHARE = 0.0015;
const MIN_RADIUS = 2;
/**
 * When one cluster reaches this far across the page in both directions, single
 * link has stopped finding icons and started threading the sheet onto itself.
 */
const COLLAPSE_SPAN = 0.6;
/** Enough marks that everything ending up in one group cannot be right. */
const COLLAPSE_MIN_COMPONENTS = 3;

interface Grouping {
  parent: Int32Array;
  boxes: BoundingBox[];
  members: Int32Array;
  count: number;
}

function beginGrouping(components: readonly Component[]): Grouping {
  return {
    parent: Int32Array.from(components, (_, at) => at),
    boxes: components.map((component) => ({ ...component.box })),
    members: new Int32Array(components.length).fill(1),
    count: components.length,
  };
}

function findRoot(grouping: Grouping, at: number): number {
  const { parent } = grouping;
  let root = at;
  while (parent[root] !== root) root = parent[root];
  while (parent[at] !== root) {
    const next = parent[at];
    parent[at] = root;
    at = next;
  }
  return root;
}

function joinInto(grouping: Grouping, a: number, b: number): void {
  const rootA = findRoot(grouping, a);
  const rootB = findRoot(grouping, b);
  if (rootA === rootB) return;
  const keep = grouping.members[rootA] >= grouping.members[rootB] ? rootA : rootB;
  const drop = keep === rootA ? rootB : rootA;
  grouping.parent[drop] = keep;
  grouping.members[keep] += grouping.members[drop];
  grouping.boxes[keep] = {
    minX: Math.min(grouping.boxes[keep].minX, grouping.boxes[drop].minX),
    minY: Math.min(grouping.boxes[keep].minY, grouping.boxes[drop].minY),
    maxX: Math.max(grouping.boxes[keep].maxX, grouping.boxes[drop].maxX),
    maxY: Math.max(grouping.boxes[keep].maxY, grouping.boxes[drop].maxY),
  };
  grouping.count--;
}

/**
 * How far apart two marks can be and still be the same icon.
 *
 * Reach a little way from every mark and some of them join up; reach further
 * and more do; reach far enough and the whole page becomes one blob. The right
 * distance is the one after which you would have to reach *much* further before
 * anything else joined — where the grouping is stable. That is a property of
 * how the page is laid out, which is why the same rule handles a tight grid
 * with twenty pixels between neighbours and a sparse page with a flame thirty
 * pixels above its candle, without being told which it is looking at.
 *
 * Two things stop it running away, and it needs both:
 *
 *   - **stability is scored as a ratio, not a difference.** "Nothing else joins
 *     until three times this distance" means the same thing on a page of small
 *     icons and a page of large ones.
 *   - **a grouping that has collapsed is not a candidate, however stable.** On a
 *     tight grid the first distance that joins anything joins *everything*,
 *     because each icon is within reach of the next and single link is
 *     transitive — and the resulting one-blob-per-page is beautifully stable
 *     right up to infinity. Rejecting it is the only thing that separates that
 *     page from a fragmented one, since by every measure of the gaps alone the
 *     two look identical.
 *
 * The scan walks the gaps in order and never restarts, so the whole search
 * costs one pass of union-find rather than one clustering per candidate.
 */
export function chooseClusterRadius(
  components: readonly Component[],
  edges: readonly GapEdge[],
  width: number,
  height: number,
  restrictedTo?: ReadonlyMap<number, string | number>,
): RadiusChoice {
  const unimodal: RadiusChoice = {
    radius: Math.max(MIN_RADIUS, Math.round(UNIMODAL_SHARE * Math.max(width, height))),
    basis: 'auto-unimodal',
  };
  if (components.length < 2 || edges.length === 0) return unimodal;

  const index = new Map<number, number>();
  components.forEach((component, at) => index.set(component.label, at));
  const usable = edges
    .filter((edge) => {
      if (!index.has(edge.a) || !index.has(edge.b)) return false;
      if (!restrictedTo) return true;
      return restrictedTo.get(edge.a) === restrictedTo.get(edge.b);
    })
    .sort((a, b) => a.gap - b.gap);
  if (usable.length === 0) return unimodal;

  const maxRadius = MAX_RADIUS_SHARE * Math.min(width, height);
  const grouping = beginGrouping(components);
  let best = { radius: unimodal.radius, score: 0 };

  let i = 0;
  while (i < usable.length) {
    const gap = usable[i].gap;
    if (gap > maxRadius) break;
    while (i < usable.length && usable[i].gap <= gap) {
      const edge = usable[i++];
      joinInto(grouping, index.get(edge.a) as number, index.get(edge.b) as number);
    }

    let collapsed = grouping.count === 1 && components.length > COLLAPSE_MIN_COMPONENTS;
    if (!collapsed) {
      for (let at = 0; at < components.length && !collapsed; at++) {
        if (findRoot(grouping, at) !== at) continue;
        const box = grouping.boxes[at];
        collapsed =
          box.maxX - box.minX >= width * COLLAPSE_SPAN &&
          box.maxY - box.minY >= height * COLLAPSE_SPAN;
      }
    }
    // Reaching further can only merge more, so once it has collapsed there is
    // nothing better further on.
    if (collapsed) break;

    const next = i < usable.length ? usable[i].gap : Number.POSITIVE_INFINITY;
    const score = next / Math.max(1, gap);
    if (score > best.score) best = { radius: Math.max(MIN_RADIUS, Math.round(gap)), score };
  }

  return best.score < BIMODAL_RATIO ? unimodal : { radius: best.radius, basis: 'auto-bimodal' };
}

/**
 * Single-link grouping: two components join when anything in one is within the
 * radius of anything in the other.
 *
 * Single link is right here and average link would not be. An icon is a chain —
 * body, then arm off the body, then mitten off the arm — and asking every part
 * to be near every other part breaks exactly the icons this exists to keep
 * whole.
 */
export function clusterComponents(
  components: readonly Component[],
  edges: readonly GapEdge[],
  radius: number,
  restrictedTo?: ReadonlyMap<number, string | number>,
  reachOf?: (label: number) => number,
): Cluster[] {
  const index = new Map<number, number>();
  components.forEach((component, at) => index.set(component.label, at));

  const parent = components.map((_, at) => at);
  const find = (at: number): number => {
    let root = at;
    while (parent[root] !== root) root = parent[root];
    while (parent[at] !== root) {
      const next = parent[at];
      parent[at] = root;
      at = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  for (const edge of edges) {
    const a = index.get(edge.a);
    const b = index.get(edge.b);
    if (a === undefined || b === undefined) continue;
    // A component only ever joins within its own compartment — its cell of the
    // grid, its caption row, or both. Without this a caption chains along
    // itself and then into the icon above it, and a row of icons chains into
    // the row below.
    if (restrictedTo && restrictedTo.get(edge.a) !== restrictedTo.get(edge.b)) continue;
    const reach = reachOf ? Math.min(reachOf(edge.a), reachOf(edge.b)) : radius;
    if (edge.gap > reach) continue;
    union(a, b);
  }

  const byRoot = new Map<number, Cluster>();
  components.forEach((component, at) => {
    const root = find(at);
    const existing = byRoot.get(root);
    if (!existing) {
      byRoot.set(root, {
        labels: new Set([component.label]),
        box: { ...component.box },
        pixelCount: component.pixelCount,
        likelyLabel: false,
      });
      return;
    }
    existing.labels.add(component.label);
    existing.box.minX = Math.min(existing.box.minX, component.box.minX);
    existing.box.minY = Math.min(existing.box.minY, component.box.minY);
    existing.box.maxX = Math.max(existing.box.maxX, component.box.maxX);
    existing.box.maxY = Math.max(existing.box.maxY, component.box.maxY);
    existing.pixelCount += component.pixelCount;
  });
  return [...byRoot.values()];
}

/** Members must all be about the same height for a band to read as a line of text. */
const TEXT_MIN_MEMBERS = 6;
const TEXT_HEIGHT_SPREAD = 0.35;
const TEXT_MAX_HEIGHT_SHARE = 0.04;
const TEXT_MAX_GAP_SHARE = 1.5;
/**
 * A caption is short next to the *other rows on its own page*, not just short
 * next to the page.
 *
 * Without a relative test the rule reads a sheet of small icons as a sheet of
 * captions — every row of them is a row of same-sized marks a letter's width
 * apart, which is the signature it looks for — and flags the whole import.
 *
 * Rows, and not components, is what it is measured against, and the difference
 * is not a detail. A captioned sheet has ten letters for every drawing, so by
 * component the typical thing on the page *is* a letter and every caption looks
 * normal-sized. By row there are as many drawing rows as caption rows, so the
 * comparison is between the two kinds of row, which is the actual question.
 */
const TEXT_MAX_HEIGHT_OF_ROW = 0.6;

/**
 * Rows of small, evenly sized, evenly spaced marks: captions and labels.
 *
 * Format rows ("DST EXP PES JEF"), per-icon captions, category headings and
 * size banners are all letters, and letters have a signature nothing drawn does
 * — a lot of them in a line, all the same height, all about a letter's width
 * apart. Every clause is a guard against something real on these sheets: the
 * member count keeps a two-part icon out, the height spread keeps a row of
 * different drawings out, the absolute height keeps a row of *large* icons out,
 * and the spacing keeps four icons laid across a page out.
 *
 * A row that qualifies is grouped with itself and flagged, never dropped. The
 * heuristic is good, not perfect, and the cost of it being wrong has to stay at
 * one click.
 */
export function findTextRows(
  components: readonly Component[],
  width: number,
  height: number,
): number[][] {
  const byTop = [...components].sort((a, b) => a.box.minY - b.box.minY);
  const bands: Component[][] = [];
  let bottom = Number.NEGATIVE_INFINITY;
  for (const component of byTop) {
    if (bands.length === 0 || component.box.minY >= bottom) {
      bands.push([component]);
      bottom = component.box.maxY;
    } else {
      bands[bands.length - 1].push(component);
      bottom = Math.max(bottom, component.box.maxY);
    }
  }

  const bandExtents = bands
    .map((band) =>
      Math.max(...band.map((c) => c.box.maxY)) - Math.min(...band.map((c) => c.box.minY)),
    )
    .sort((a, b) => a - b);
  const medianBand = bandExtents[Math.floor(bandExtents.length / 2)] ?? 0;

  const rows: number[][] = [];
  for (const band of bands) {
    if (band.length < TEXT_MIN_MEMBERS) continue;
    const heights = band.map((c) => c.box.maxY - c.box.minY).sort((a, b) => a - b);
    const medianHeight = heights[Math.floor(heights.length / 2)];
    if (medianHeight <= 0 || medianHeight > height * TEXT_MAX_HEIGHT_SHARE) continue;
    if (medianHeight > medianBand * TEXT_MAX_HEIGHT_OF_ROW) continue;
    const uniform = band.every((c) => {
      const h = c.box.maxY - c.box.minY;
      return Math.abs(h - medianHeight) <= medianHeight * TEXT_HEIGHT_SPREAD;
    });
    if (!uniform) continue;

    const ordered = [...band].sort((a, b) => a.box.minX - b.box.minX);
    const widths = ordered.map((c) => c.box.maxX - c.box.minX).sort((a, b) => a - b);
    const medianWidth = Math.max(1, widths[Math.floor(widths.length / 2)]);
    const gaps: number[] = [];
    for (let i = 1; i < ordered.length; i++) {
      gaps.push(Math.max(0, ordered[i].box.minX - ordered[i - 1].box.maxX));
    }
    gaps.sort((a, b) => a - b);
    const medianGap = gaps[Math.floor(gaps.length / 2)];
    if (medianGap > medianWidth * TEXT_MAX_GAP_SHARE) continue;
    // A band spanning the page in one unbroken run of glyphs is a heading; one
    // that is four drawings with captions under them is not, and the width test
    // above has already let it through, so nothing more is needed here.
    void width;

    rows.push(ordered.map((c) => c.label));
  }
  return rows;
}

export interface ClassifyOptions {
  /** Below this share of the median cell's area, a cell is a stray mark. */
  minCellFraction?: number;
}

const DEFAULT_MIN_CELL_FRACTION = 0.04;
/** Below four cells there is no median worth measuring anything against. */
const CLASSIFY_MIN_CLUSTERS = 4;
const SHORT_SHARE = 0.5;
const WIDE_RATIO = 2.5;
const BANNER_WIDTH = 0.8;
const BANNER_HEIGHT = 0.15;
const MARGIN_BAND = 0.08;
const MARGIN_WIDTH = 0.35;

/**
 * Marks a cell as something other than an icon, without removing it.
 *
 * Everything here is measured against the *median cell on this page*, not
 * against the page. "A twentieth of the page" means one thing on a sheet of
 * four icons and something else entirely on a sheet of fifty-six; "a twentieth
 * of the size of the other icons" means the same thing on both.
 */
export function classifyClusters(
  clusters: Cluster[],
  textRowLabels: ReadonlySet<number>,
  width: number,
  height: number,
  options: ClassifyOptions = {},
): void {
  for (const cluster of clusters) {
    for (const label of cluster.labels) {
      if (!textRowLabels.has(label)) continue;
      cluster.likelyLabel = true;
      cluster.labelReason = 'text-row';
      break;
    }
  }
  if (clusters.length < CLASSIFY_MIN_CLUSTERS) return;

  const heights = clusters.map((c) => c.box.maxY - c.box.minY).sort((a, b) => a - b);
  const areas = clusters
    .map((c) => (c.box.maxX - c.box.minX) * (c.box.maxY - c.box.minY))
    .sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)];
  const medianArea = areas[Math.floor(areas.length / 2)];
  const minFraction = options.minCellFraction ?? DEFAULT_MIN_CELL_FRACTION;

  for (const cluster of clusters) {
    if (cluster.likelyLabel) continue;
    const w = cluster.box.maxX - cluster.box.minX;
    const h = cluster.box.maxY - cluster.box.minY;

    if (w >= width * BANNER_WIDTH && h <= height * BANNER_HEIGHT) {
      cluster.likelyLabel = true;
      cluster.labelReason = 'banner';
    } else if (
      (cluster.box.maxY <= height * MARGIN_BAND ||
        cluster.box.minY >= height * (1 - MARGIN_BAND)) &&
      w >= width * MARGIN_WIDTH
    ) {
      cluster.likelyLabel = true;
      cluster.labelReason = 'margin';
    } else if (h < medianHeight * SHORT_SHARE && h > 0 && w / h >= WIDE_RATIO) {
      cluster.likelyLabel = true;
      cluster.labelReason = 'wide-and-short';
    } else if (w * h < medianArea * minFraction) {
      cluster.likelyLabel = true;
      cluster.labelReason = 'tiny';
    }
  }
}

