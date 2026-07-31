import type { LibraryShape } from '../types.js';
import {
  BLUE,
  BLUE_DARK,
  BLUE_LIGHT,
  BROWN,
  CREAM,
  CREAM_DARK,
  GOLD,
  GOLD_DARK,
  GOLD_LIGHT,
  GREEN,
  GREEN_DARK,
  INK_SOFT,
  ORANGE,
  ORANGE_LIGHT,
  PINE,
  RED,
  RED_DARK,
  SILVER,
  SILVER_DARK,
  SILVER_LIGHT,
  WOOD,
  WOOD_DARK,
  YELLOW,
  YELLOW_LIGHT,
} from './palette.js';

/**
 * Jewish holidays and symbols.
 *
 * Drawn to be recognised by someone who knows them, which mostly means getting
 * the counts right: a chanukiah has **nine** branches, not seven, and the
 * middle one — the shamash — stands proud of the rest. A seven-branch menorah
 * is a different object entirely (the Temple menorah), and it is here too,
 * separately, rather than being quietly substituted.
 *
 * The Star of David is a genuine hexagram of two interwoven triangles rather
 * than a six-pointed star polygon: the overlapping bands are what the symbol
 * is, and a solid star is a different shape that merely resembles it.
 */

const K = 0.5523;

function circle(cx: number, cy: number, r: number, clockwise = true): string {
  const k = +(r * K).toFixed(2);
  const round = (n: number): string => String(+n.toFixed(2));
  const [x, y] = [round(cx), round(cy)];
  const [l, t, b, right] = [round(cx - r), round(cy - r), round(cy + r), round(cx + r)];
  const [kl, kr, kt, kb] = [round(cx - k), round(cx + k), round(cy - k), round(cy + k)];
  return clockwise
    ? `M ${x} ${t} C ${kr} ${t} ${right} ${kt} ${right} ${y} C ${right} ${kb} ${kr} ${b} ${x} ${b} ` +
        `C ${kl} ${b} ${l} ${kb} ${l} ${y} C ${l} ${kt} ${kl} ${t} ${x} ${t} Z`
    : `M ${x} ${t} C ${kl} ${t} ${l} ${kt} ${l} ${y} C ${l} ${kb} ${kl} ${b} ${x} ${b} ` +
        `C ${kr} ${b} ${right} ${kb} ${right} ${y} C ${right} ${kt} ${kr} ${t} ${x} ${t} Z`;
}

/** A candle flame: a teardrop with its point at the top. */
function flame(cx: number, top: number, height: number): string {
  const w = height * 0.42;
  const base = top + height;
  return (
    `M ${cx} ${top} C ${+(cx + w).toFixed(2)} ${+(top + height * 0.42).toFixed(2)} ` +
    `${+(cx + w).toFixed(2)} ${+(base - height * 0.1).toFixed(2)} ${cx} ${base} ` +
    `C ${+(cx - w).toFixed(2)} ${+(base - height * 0.1).toFixed(2)} ` +
    `${+(cx - w).toFixed(2)} ${+(top + height * 0.42).toFixed(2)} ${cx} ${top} Z`
  );
}

/**
 * One branch of a menorah: a flattened half-circle band whose two ends rise to
 * the candle line.
 *
 * Every branch shares a centre and a top, which is the whole trick — that is
 * what makes them nest inside one another and meet the candles in a straight
 * row. Branches drawn instead as arcs running from each outer end up to a point
 * on the stem give an umbrella, which is what this file had before.
 */
function arm(cx: number, top: number, rx: number, ry: number, width: number): string {
  const n = (v: number): string => String(+v.toFixed(2));
  const half = width / 2;
  const sweep = (radiusX: number, radiusY: number, leftToRight: boolean): string => {
    const [kx, ky] = [radiusX * K, radiusY * K];
    const [near, far] = leftToRight ? [-1, 1] : [1, -1];
    return (
      `C ${n(cx + near * radiusX)} ${n(top + ky)} ${n(cx + near * kx)} ${n(top + radiusY)} ${n(cx)} ${n(top + radiusY)} ` +
      `C ${n(cx + far * kx)} ${n(top + radiusY)} ${n(cx + far * radiusX)} ${n(top + ky)} ${n(cx + far * radiusX)} ${n(top)}`
    );
  };
  return (
    `M ${n(cx - rx - half)} ${n(top)} ${sweep(rx + half, ry + half, true)} ` +
    `L ${n(cx + rx - half)} ${n(top)} ${sweep(rx - half, ry - half, false)} Z`
  );
}

/** Where the chanukiah's eight branch candles land, from the arm radii above. */
const BRANCHES = [6, 18, 30, 41, 59, 70, 82, 94];

/** And the Temple menorah's seven lamps, centre one included. */
const LAMPS = [10, 23, 36, 50, 64, 77, 90];

/** Shades only this file needs; the shared palette stays free of one-offs. */
const CRUST = '#d9b381';
const POPPY = '#4a3220';
const ARIL = '#f0a0a8';

export const JEWISH_SHAPES: LibraryShape[] = [
  {
    id: 'jewish-star-of-david',
    name: 'Star of David',
    category: 'jewish',
    keywords: ['magen david', 'jewish', 'hexagram', 'shield', 'israel', 'judaism'],
    parts: [
      {
        name: 'Star',
        // Two overlapping triangles as one outline: the twelve-point star
        // polygon, with the hexagon in the middle left as a counter so the
        // interlace reads instead of filling solid.
        d:
          'M 50 2 L 63.5 25.5 L 90.5 25.5 L 77 49 L 90.5 72.5 L 63.5 72.5 ' +
          'L 50 96 L 36.5 72.5 L 9.5 72.5 L 23 49 L 9.5 25.5 L 36.5 25.5 Z ' +
          'M 50 20 L 36.5 43.5 L 43 55 L 57 55 L 63.5 43.5 Z',
        color: BLUE,
      },
      {
        name: 'Interlace',
        // The three bands of the upward triangle that pass over the downward
        // one — what makes the two triangles look woven rather than merged.
        d:
          'M 36.5 25.5 L 43 37 L 30 37 Z ' +
          'M 63.5 25.5 L 57 37 L 70 37 Z ' +
          'M 43 61 L 57 61 L 50 73 Z',
        color: BLUE_DARK,
      },
      {
        name: 'Highlight',
        d: 'M 50 2 L 57 14 L 43 14 Z',
        color: BLUE_LIGHT,
      },
    ],
  },
  {
    id: 'jewish-menorah-hanukkah',
    name: 'Chanukiah',
    category: 'jewish',
    keywords: [
      'hanukkah',
      'chanukah',
      'menorah',
      'nine',
      'candles',
      'shamash',
      'festival of lights',
    ],
    parts: [
      {
        name: 'Stand',
        d: 'M 46 40 L 54 40 L 54 84 L 70 84 C 73 84 75 87 75 90 L 75 96 L 25 96 L 25 90 C 25 87 27 84 30 84 L 46 84 Z',
        color: GOLD_DARK,
      },
      {
        name: 'Branches',
        // Four nested arcs, all centred on the stem and all ending on the same
        // line, which is where the eight candles stand.
        d: [
          arm(50, 40, 44, 24, 4.5),
          arm(50, 40, 32, 17, 4.5),
          arm(50, 40, 20, 11, 4.5),
          arm(50, 40, 9, 5, 4.5),
        ].join(' '),
        color: GOLD,
      },
      {
        name: 'Candles',
        // Eight branch candles at a common height, plus the shamash on the stem
        // standing proud of them, because it is the one the rest are lit from.
        d:
          BRANCHES.map((x) => `M ${x - 4} 26 L ${x + 4} 26 L ${x + 4} 40 L ${x - 4} 40 Z`).join(' ') +
          ' M 46 12 L 54 12 L 54 40 L 46 40 Z',
        color: CREAM,
      },
      {
        name: 'Flames',
        d: `${BRANCHES.map((x) => flame(x, 14, 12)).join(' ')} ${flame(50, 0, 12)}`,
        color: ORANGE,
      },
      {
        name: 'Flame cores',
        d: `${BRANCHES.map((x) => flame(x, 18, 7)).join(' ')} ${flame(50, 4, 7)}`,
        color: YELLOW_LIGHT,
      },
    ],
  },
  {
    id: 'jewish-menorah-temple',
    name: 'Temple menorah',
    category: 'jewish',
    keywords: ['seven', 'branches', 'lampstand', 'temple', 'israel', 'emblem'],
    parts: [
      {
        name: 'Stand',
        d: 'M 46 40 L 54 40 L 54 84 L 71 84 C 74 84 76 87 76 90 L 76 96 L 24 96 L 24 90 C 24 87 26 84 29 84 L 46 84 Z',
        color: GOLD_DARK,
      },
      {
        name: 'Branches',
        d: [arm(50, 40, 40, 22, 4.5), arm(50, 40, 27, 15, 4.5), arm(50, 40, 14, 8, 4.5)].join(' '),
        color: GOLD,
      },
      {
        name: 'Lamps',
        // Seven at one height. The Temple menorah has no shamash, so nothing
        // here stands proud — that difference is the whole point of shipping
        // both lampstands rather than one.
        d: LAMPS.map((x) => `M ${x - 6} 28 L ${x + 6} 28 L ${x + 4} 40 L ${x - 4} 40 Z`).join(' '),
        color: GOLD_LIGHT,
      },
      {
        name: 'Flames',
        d: LAMPS.map((x) => flame(x, 14, 14)).join(' '),
        color: ORANGE,
      },
    ],
  },
  {
    id: 'jewish-dreidel',
    name: 'Dreidel',
    category: 'jewish',
    keywords: ['hanukkah', 'spinning top', 'sevivon', 'game', 'nun gimel hey shin'],
    parts: [
      { name: 'Handle', d: 'M 44 2 L 56 2 L 56 18 L 44 18 Z', color: WOOD_DARK },
      {
        name: 'Body',
        // A square body over a tapered point — the four-sided top, not a cone.
        d: 'M 18 18 L 82 18 L 82 62 L 50 96 L 18 62 Z',
        color: BLUE,
      },
      {
        name: 'Shading',
        d: 'M 50 18 L 82 18 L 82 62 L 50 96 Z',
        color: BLUE_DARK,
      },
      {
        name: 'Letter',
        // The Hebrew letter nun, drawn as strokes rather than typeset: the
        // catalogue carries no font, and a shape has to be geometry. One
        // outline, traced the way the letter is written — a short bar left
        // along the top, down the right, then a longer bar left along the foot.
        d: 'M 38 28 L 62 28 L 62 72 L 30 72 L 30 64 L 54 64 L 54 36 L 38 36 Z',
        color: CREAM,
      },
      { name: 'Tip', d: 'M 44 84 L 56 84 L 50 96 Z', color: WOOD },
    ],
  },
  {
    id: 'jewish-shofar',
    name: 'Shofar',
    category: 'jewish',
    keywords: ['rosh hashanah', 'ram horn', 'yom kippur', 'high holidays', 'blow', 'trumpet'],
    parts: [
      {
        name: 'Horn',
        // A ram's horn read from narrow mouthpiece to flared bell, drawn as one
        // outline whose two edges diverge along the curve. Two parallel edges
        // would give a banana; the taper is what makes it a horn.
        d:
          'M 4 46 C 20 40 42 42 60 52 C 74 60 84 70 96 74 ' +
          'L 96 96 L 62 88 L 80 84 C 70 78 60 70 50 64 C 36 56 18 54 6 58 Z',
        color: CREAM_DARK,
      },
      {
        name: 'Shading',
        d:
          'M 6 52 C 20 50 36 54 48 61 C 58 67 70 76 82 81 L 74 84 ' +
          'C 62 79 52 71 43 65 C 32 58 18 55 6 56 Z',
        color: WOOD,
      },
      {
        name: 'Bell',
        // The flared end, cut square: the opening is what is blown through.
        d: 'M 88 71 L 96 74 L 96 96 L 66 89 Z',
        color: WOOD_DARK,
      },
      { name: 'Mouthpiece', d: 'M 4 46 C 9 44 13 45 14 48 L 12 56 C 10 53 7 53 6 58 Z', color: WOOD_DARK },
      {
        name: 'Ridges',
        d:
          'M 24 48 L 27 47 L 29 56 L 26 56 Z M 40 52 L 43 52 L 47 61 L 44 62 Z ' +
          'M 56 60 L 59 61 L 65 70 L 62 71 Z M 72 70 L 75 72 L 82 80 L 79 82 Z',
        color: CREAM,
      },
    ],
  },
  {
    id: 'jewish-challah',
    name: 'Challah',
    category: 'jewish',
    keywords: ['shabbat', 'bread', 'braided', 'loaf', 'sabbath', 'kiddush'],
    parts: [
      {
        name: 'Loaf',
        d:
          'M 4 60 C 4 44 20 32 50 32 C 80 32 96 44 96 60 C 96 76 80 86 50 86 ' +
          'C 20 86 4 76 4 60 Z',
        color: CRUST,
      },
      {
        name: 'Braid',
        // Six overlapping strands laid diagonally — a braid reads as a braid
        // only if the strands cross the loaf at an angle.
        d:
          'M 8 54 C 14 40 26 34 38 38 C 48 42 50 54 44 64 C 38 74 24 76 14 70 C 8 66 6 60 8 54 Z ' +
          'M 30 52 C 36 38 48 32 60 36 C 70 40 72 52 66 62 C 60 72 46 74 36 68 C 30 64 28 58 30 52 Z ' +
          'M 52 54 C 58 40 70 34 82 38 C 92 42 94 54 88 64 C 82 74 68 76 58 70 C 52 66 50 60 52 54 Z',
        color: WOOD,
      },
      {
        name: 'Crust',
        d:
          'M 12 48 C 18 40 28 38 36 42 L 34 47 C 28 44 20 45 15 51 Z ' +
          'M 34 46 C 40 38 50 36 58 40 L 56 45 C 50 42 42 43 37 49 Z ' +
          'M 56 48 C 62 40 72 38 80 42 L 78 47 C 72 44 64 45 59 51 Z',
        color: ORANGE_LIGHT,
      },
      {
        name: 'Seeds',
        d:
          `${circle(24, 52, 2)} ${circle(38, 58, 2)} ${circle(52, 48, 2)} ` +
          `${circle(64, 58, 2)} ${circle(76, 50, 2)} ${circle(46, 68, 2)} ${circle(70, 68, 2)}`,
        color: CREAM,
      },
    ],
  },
  {
    id: 'jewish-shabbat-candles',
    name: 'Shabbat candles',
    category: 'jewish',
    keywords: ['sabbath', 'candlesticks', 'friday night', 'blessing', 'pair'],
    parts: [
      {
        name: 'Candlesticks',
        d:
          'M 14 52 L 30 52 L 28 68 C 28 74 30 78 34 82 L 38 86 L 6 86 L 10 82 ' +
          'C 14 78 16 74 16 68 Z ' +
          'M 70 52 L 86 52 L 84 68 C 84 74 86 78 90 82 L 94 86 L 62 86 L 66 82 ' +
          'C 70 78 72 74 72 68 Z',
        color: SILVER,
      },
      {
        name: 'Stick shading',
        d: 'M 22 52 L 30 52 L 28 68 C 28 74 30 78 34 82 L 38 86 L 22 86 Z ' +
          'M 78 52 L 86 52 L 84 68 C 84 74 86 78 90 82 L 94 86 L 78 86 Z',
        color: SILVER_DARK,
      },
      {
        name: 'Candles',
        d: 'M 16 22 L 28 22 L 28 52 L 16 52 Z M 72 22 L 84 22 L 84 52 L 72 52 Z',
        color: CREAM,
      },
      { name: 'Wax', d: 'M 22 22 L 28 22 L 28 52 L 22 52 Z M 78 22 L 84 22 L 84 52 L 78 52 Z', color: CREAM_DARK },
      { name: 'Flames', d: `${flame(22, 2, 20)} ${flame(78, 2, 20)}`, color: ORANGE },
      { name: 'Flame cores', d: `${flame(22, 8, 12)} ${flame(78, 8, 12)}`, color: YELLOW_LIGHT },
    ],
  },
  {
    id: 'jewish-kiddush-cup',
    name: 'Kiddush cup',
    category: 'jewish',
    keywords: ['wine', 'goblet', 'shabbat', 'blessing', 'silver', 'cup', 'seder'],
    parts: [
      {
        name: 'Cup',
        d:
          'M 22 8 L 78 8 L 74 44 C 73 54 66 60 56 62 L 56 82 L 72 86 ' +
          'C 76 87 78 90 78 94 L 78 98 L 22 98 L 22 94 C 22 90 24 87 28 86 ' +
          'L 44 82 L 44 62 C 34 60 27 54 26 44 Z',
        color: SILVER,
      },
      {
        name: 'Shading',
        d: 'M 50 8 L 78 8 L 74 44 C 73 54 66 60 56 62 L 56 82 L 72 86 C 76 87 78 90 78 94 L 78 98 L 50 98 Z',
        color: SILVER_DARK,
      },
      { name: 'Wine', d: 'M 27 18 L 73 18 L 70 42 C 69 50 62 55 50 55 C 38 55 31 50 30 42 Z', color: RED_DARK },
      { name: 'Rim', d: 'M 22 8 L 78 8 L 77 16 L 23 16 Z', color: SILVER_LIGHT },
      {
        name: 'Engraving',
        d: 'M 36 26 L 42 34 L 36 42 L 30 34 Z M 64 26 L 70 34 L 64 42 L 58 34 Z',
        color: RED,
      },
    ],
  },
  {
    id: 'jewish-hamantaschen',
    name: 'Hamantaschen',
    category: 'jewish',
    keywords: ['purim', 'cookie', 'pastry', 'triangle', 'poppy', 'treat'],
    parts: [
      {
        name: 'Pastry',
        // A rounded triangle, because the dough is folded rather than cut.
        d:
          'M 50 6 C 54 6 57 8 59 11 L 92 68 C 95 73 95 78 92 82 C 89 86 84 88 78 88 ' +
          'L 22 88 C 16 88 11 86 8 82 C 5 78 5 73 8 68 L 41 11 C 43 8 46 6 50 6 Z',
        color: CREAM_DARK,
      },
      {
        name: 'Filling',
        // The window of filling is small: three corners folded *over* the dough
        // leave a modest triangle showing, and a big dark centre reads as a
        // hole rather than as poppy seed.
        d: 'M 50 40 C 52 40 54 41 55 43 L 68 66 C 70 69 69 71 65 71 L 35 71 C 31 71 30 69 32 66 L 45 43 C 46 41 48 40 50 40 Z',
        color: POPPY,
      },
      {
        name: 'Folds',
        // Each corner is a flap of dough turned in, and the ridge along its
        // inner edge is what makes the fold read as a fold.
        d:
          'M 50 6 C 54 6 57 8 59 11 L 72 33 L 62 39 L 55 43 C 54 41 52 40 50 40 ' +
          'C 48 40 46 41 45 43 L 38 39 L 28 33 L 41 11 C 43 8 46 6 50 6 Z ' +
          'M 8 82 C 5 78 5 73 8 68 L 21 46 L 31 52 L 38 56 L 32 66 ' +
          'C 30 69 31 71 35 71 L 35 83 L 35 88 L 22 88 C 16 88 11 86 8 82 Z ' +
          'M 92 82 C 95 78 95 73 92 68 L 79 46 L 69 52 L 62 56 L 68 66 ' +
          'C 70 69 69 71 65 71 L 65 83 L 65 88 L 78 88 C 84 88 89 86 92 82 Z',
        color: CRUST,
      },
      {
        name: 'Seeds',
        d: `${circle(42, 56, 2)} ${circle(56, 54, 2)} ${circle(50, 65, 2)} ${circle(62, 66, 2)} ${circle(38, 67, 2)}`,
        color: INK_SOFT,
      },
    ],
  },
  {
    id: 'jewish-matzah',
    name: 'Matzah',
    category: 'jewish',
    keywords: ['passover', 'pesach', 'unleavened', 'bread', 'seder', 'cracker'],
    parts: [
      { name: 'Matzah', d: 'M 6 14 L 94 14 L 94 90 L 6 90 Z', color: CREAM },
      {
        name: 'Perforations',
        // Rows of docking holes, the marks that make a cracker read as matzah.
        d:
          `${circle(18, 26, 2.4)} ${circle(34, 26, 2.4)} ${circle(50, 26, 2.4)} ${circle(66, 26, 2.4)} ${circle(82, 26, 2.4)} ` +
          `${circle(18, 42, 2.4)} ${circle(34, 42, 2.4)} ${circle(50, 42, 2.4)} ${circle(66, 42, 2.4)} ${circle(82, 42, 2.4)} ` +
          `${circle(18, 58, 2.4)} ${circle(34, 58, 2.4)} ${circle(50, 58, 2.4)} ${circle(66, 58, 2.4)} ${circle(82, 58, 2.4)} ` +
          `${circle(18, 74, 2.4)} ${circle(34, 74, 2.4)} ${circle(50, 74, 2.4)} ${circle(66, 74, 2.4)} ${circle(82, 74, 2.4)}`,
        color: WOOD,
      },
      {
        name: 'Toasting',
        d:
          'M 6 14 L 94 14 L 94 20 L 6 20 Z M 6 84 L 94 84 L 94 90 L 6 90 Z ' +
          'M 6 14 L 12 14 L 12 90 L 6 90 Z M 88 14 L 94 14 L 94 90 L 88 90 Z',
        color: CREAM_DARK,
      },
    ],
  },
  {
    id: 'jewish-seder-plate',
    name: 'Seder plate',
    category: 'jewish',
    keywords: ['passover', 'pesach', 'ke’ara', 'six', 'symbols', 'meal'],
    parts: [
      { name: 'Plate', d: circle(50, 50, 48), color: BLUE },
      { name: 'Rim', d: `${circle(50, 50, 48)} ${circle(50, 50, 41, false)}`, color: BLUE_DARK },
      {
        name: 'Wells',
        d:
          `${circle(50, 20, 11)} ${circle(76, 35, 11)} ${circle(76, 65, 11)} ` +
          `${circle(50, 80, 11)} ${circle(24, 65, 11)} ${circle(24, 35, 11)}`,
        color: CREAM,
      },
      {
        name: 'Foods',
        // Six of them, and each a different colour, because that is the whole
        // point of the plate.
        d: circle(50, 20, 7),
        color: GREEN,
      },
      { name: 'Bone', d: circle(76, 35, 7), color: CREAM_DARK },
      { name: 'Egg', d: circle(76, 65, 7), color: YELLOW_LIGHT },
      { name: 'Charoset', d: circle(50, 80, 7), color: BROWN },
      { name: 'Maror', d: circle(24, 65, 7), color: GREEN_DARK },
      { name: 'Karpas', d: circle(24, 35, 7), color: PINE },
    ],
  },
  {
    id: 'jewish-torah-scroll',
    name: 'Torah scroll',
    category: 'jewish',
    keywords: ['sefer torah', 'simchat torah', 'scroll', 'reading', 'law', 'shavuot'],
    parts: [
      {
        name: 'Rollers',
        d:
          'M 8 8 L 22 8 L 22 92 L 8 92 Z M 78 8 L 92 8 L 92 92 L 78 92 Z ' +
          'M 4 4 L 26 4 L 26 12 L 4 12 Z M 4 88 L 26 88 L 26 96 L 4 96 Z ' +
          'M 74 4 L 96 4 L 96 12 L 74 12 Z M 74 88 L 96 88 L 96 96 L 74 96 Z',
        color: WOOD_DARK,
      },
      { name: 'Parchment', d: 'M 22 14 L 78 14 L 78 86 L 22 86 Z', color: CREAM },
      {
        name: 'Curl',
        d: 'M 22 14 L 32 14 L 32 86 L 22 86 Z M 68 14 L 78 14 L 78 86 L 68 86 Z',
        color: CREAM_DARK,
      },
      {
        name: 'Text',
        // Columns of writing suggested as rules, not letters: at 40 mm real
        // characters would be a smudge, and a smudge is not a nicer smudge for
        // being accurate.
        d:
          'M 36 22 L 64 22 L 64 26 L 36 26 Z M 36 32 L 64 32 L 64 36 L 36 36 Z ' +
          'M 36 42 L 64 42 L 64 46 L 36 46 Z M 36 52 L 64 52 L 64 56 L 36 56 Z ' +
          'M 36 62 L 64 62 L 64 66 L 36 66 Z M 36 72 L 56 72 L 56 76 L 36 76 Z',
        color: INK_SOFT,
      },
    ],
  },
  {
    id: 'jewish-tablets',
    name: 'Tablets of the Law',
    category: 'jewish',
    keywords: ['ten commandments', 'luchot', 'shavuot', 'sinai', 'stone', 'moses'],
    parts: [
      {
        name: 'Tablets',
        d:
          'M 6 34 C 6 18 14 8 27 8 C 40 8 48 18 48 34 L 48 94 L 6 94 Z ' +
          'M 52 34 C 52 18 60 8 73 8 C 86 8 94 18 94 34 L 94 94 L 52 94 Z',
        color: SILVER,
      },
      {
        name: 'Shading',
        d: 'M 34 12 C 44 16 48 24 48 34 L 48 94 L 34 94 Z M 80 12 C 90 16 94 24 94 34 L 94 94 L 80 94 Z',
        color: SILVER_DARK,
      },
      {
        name: 'Commandments',
        // Five rules on each tablet, which is how the tablets are always shown
        // and the only detail anyone checks.
        d:
          'M 14 40 L 40 40 L 40 44 L 14 44 Z M 14 52 L 40 52 L 40 56 L 14 56 Z ' +
          'M 14 64 L 40 64 L 40 68 L 14 68 Z M 14 76 L 40 76 L 40 80 L 14 80 Z ' +
          'M 14 86 L 40 86 L 40 90 L 14 90 Z ' +
          'M 60 40 L 86 40 L 86 44 L 60 44 Z M 60 52 L 86 52 L 86 56 L 60 56 Z ' +
          'M 60 64 L 86 64 L 86 68 L 60 68 Z M 60 76 L 86 76 L 86 80 L 60 80 Z ' +
          'M 60 86 L 86 86 L 86 90 L 60 90 Z',
        color: INK_SOFT,
      },
    ],
  },
  {
    id: 'jewish-chai',
    name: 'Chai',
    category: 'jewish',
    keywords: ['life', 'hebrew', 'symbol', 'lucky', 'eighteen', 'pendant'],
    parts: [
      {
        name: 'Chet',
        // Hebrew reads right to left, so chet — the first letter — is the one
        // on the **right**. It is a bridge: two legs under a bar, drawn as a
        // single outline so it does not read as scaffolding.
        d: 'M 52 12 L 96 12 L 96 92 L 80 92 L 80 28 L 68 28 L 68 92 L 52 92 Z',
        color: BLUE,
      },
      {
        name: 'Yod',
        // Yod is small and hangs from the top line, never full height — that
        // difference in size is most of what makes the pair read as chai. A
        // yod drawn at the chet's weight reads as a second full letter, and
        // the word stops being a word.
        d: 'M 14 12 L 38 12 L 30 46 L 18 46 Z',
        color: BLUE,
      },
      {
        name: 'Highlight',
        d: 'M 52 12 L 96 12 L 96 19 L 52 19 Z M 14 12 L 38 12 L 36.5 19 L 14 19 Z',
        color: BLUE_LIGHT,
      },
    ],
  },
  {
    id: 'jewish-hamsa',
    name: 'Hamsa',
    category: 'jewish',
    keywords: ['hand', 'protection', 'miriam', 'amulet', 'evil eye', 'khamsa'],
    parts: [
      {
        name: 'Hand',
        // Symmetrical, with a thumb at each side — a hamsa is not a hand with
        // one thumb, and drawing it with one is the usual mistake.
        d:
          'M 50 8 C 57 8 62 14 62 22 L 62 44 ' +
          'C 66 36 72 30 78 30 C 86 30 92 37 92 46 C 92 54 88 60 82 64 ' +
          'C 86 76 78 92 62 96 C 58 97 54 98 50 98 C 46 98 42 97 38 96 ' +
          'C 22 92 14 76 18 64 C 12 60 8 54 8 46 C 8 37 14 30 22 30 ' +
          'C 28 30 34 36 38 44 L 38 22 C 38 14 43 8 50 8 Z',
        color: BLUE,
      },
      {
        name: 'Palm',
        d: 'M 50 44 C 64 44 74 56 74 70 C 74 84 64 92 50 92 C 36 92 26 84 26 70 C 26 56 36 44 50 44 Z',
        color: BLUE_LIGHT,
      },
      {
        name: 'Eye',
        d: 'M 50 58 C 60 58 68 64 70 70 C 68 76 60 82 50 82 C 40 82 32 76 30 70 C 32 64 40 58 50 58 Z',
        color: CREAM,
      },
      { name: 'Pupil', d: circle(50, 70, 7), color: BLUE_DARK },
    ],
  },
  {
    id: 'jewish-mezuzah',
    name: 'Mezuzah',
    category: 'jewish',
    keywords: ['doorpost', 'shin', 'scroll', 'case', 'home', 'blessing'],
    parts: [
      {
        name: 'Case',
        // A mezuzah hangs on the doorpost at an angle, and drawing it upright
        // loses the one detail that says what it is. Wide enough to carry the
        // letter, because the letter is the point.
        d:
          'M 50 2 C 68 2 78 12 78 30 L 78 70 C 78 88 68 98 50 98 ' +
          'C 32 98 22 88 22 70 L 22 30 C 22 12 32 2 50 2 Z',
        color: SILVER,
      },
      {
        name: 'Case shading',
        d: 'M 56 3 C 70 7 78 17 78 30 L 78 70 C 78 83 70 93 56 97 Z',
        color: SILVER_DARK,
      },
      {
        name: 'Shin',
        // Shin: three strokes rising out of one bowl, the outer two splayed
        // away from the middle. Traced as a single outline rather than as
        // three bars dropped onto a cup — where those overlapped the bowl, the
        // same thread was being sewn twice over the join.
        d:
          'M 30 22 L 38 22 L 40 48 L 46 48 L 46 22 L 54 22 L 54 48 L 60 48 L 62 22 L 70 22 ' +
          'L 69 64 C 68 72 61 78 50 78 C 39 78 32 72 31 64 Z',
        color: BLUE_DARK,
      },
      { name: 'Fixings', d: `${circle(50, 12, 4)} ${circle(50, 88, 4)}`, color: SILVER_LIGHT },
    ],
  },
  {
    id: 'jewish-apple-honey',
    name: 'Apple and honey',
    category: 'jewish',
    keywords: ['rosh hashanah', 'new year', 'sweet', 'dipper', 'shana tova'],
    parts: [
      {
        name: 'Apple',
        d:
          'M 30 26 C 38 26 42 30 46 30 C 50 30 54 26 62 26 C 76 26 86 40 86 56 ' +
          'C 86 74 74 92 62 92 C 56 92 52 89 46 89 C 40 89 36 92 30 92 ' +
          'C 18 92 6 74 6 56 C 6 40 16 26 30 26 Z',
        color: RED,
      },
      { name: 'Apple shine', d: 'M 22 40 C 26 34 32 32 36 34 L 33 42 C 30 41 26 43 24 47 Z', color: RED_DARK },
      { name: 'Stalk', d: 'M 44 10 C 50 10 54 16 54 26 L 48 26 C 48 20 46 16 44 16 Z', color: BROWN },
      { name: 'Leaf', d: 'M 54 14 C 64 8 76 10 80 18 C 72 26 60 24 54 18 Z', color: GREEN },
      {
        name: 'Honey jar',
        d: 'M 60 62 L 96 62 L 96 92 C 96 96 93 98 88 98 L 68 98 C 63 98 60 96 60 92 Z',
        color: YELLOW,
      },
      { name: 'Honey', d: 'M 64 70 L 92 70 L 92 90 C 92 92 91 93 88 93 L 68 93 C 65 93 64 92 64 90 Z', color: ORANGE },
      { name: 'Dipper', d: 'M 74 40 L 80 40 L 80 66 L 74 66 Z M 68 62 L 86 62 L 86 70 L 68 70 Z', color: WOOD },
    ],
  },
  {
    id: 'jewish-pomegranate',
    name: 'Pomegranate',
    category: 'jewish',
    keywords: ['rimon', 'rosh hashanah', 'seeds', 'fruit', 'new year', 'mitzvot'],
    parts: [
      {
        name: 'Fruit',
        d:
          'M 50 20 C 74 20 92 40 92 62 C 92 82 74 96 50 96 C 26 96 8 82 8 62 ' +
          'C 8 40 26 20 50 20 Z',
        color: RED,
      },
      { name: 'Shading', d: 'M 66 26 C 82 34 92 46 92 62 C 92 82 74 96 50 96 C 68 90 78 76 78 60 C 78 46 74 34 66 26 Z', color: RED_DARK },
      {
        name: 'Crown',
        // The calyx: a pomegranate's little crown is the thing that tells it
        // apart from an apple at a glance.
        d: 'M 40 4 L 46 16 L 50 4 L 54 16 L 60 4 L 62 22 L 38 22 Z',
        color: RED_DARK,
      },
      {
        name: 'Seeds',
        d:
          `${circle(38, 48, 5)} ${circle(54, 46, 5)} ${circle(30, 62, 5)} ${circle(46, 62, 5)} ` +
          `${circle(62, 60, 5)} ${circle(38, 76, 5)} ${circle(54, 76, 5)} ${circle(24, 76, 4)}`,
        color: ARIL,
      },
    ],
  },
  {
    id: 'jewish-lulav-etrog',
    name: 'Lulav and etrog',
    category: 'jewish',
    keywords: ['sukkot', 'four species', 'palm', 'citron', 'myrtle', 'willow'],
    parts: [
      // The etrog goes down first so the palm's own greens stay in one run.
      {
        name: 'Etrog',
        d:
          'M 78 58 C 90 58 98 68 98 80 C 98 91 90 98 78 98 C 66 98 58 91 58 80 ' +
          'C 58 68 66 58 78 58 Z',
        color: YELLOW,
      },
      { name: 'Etrog shine', d: 'M 66 70 C 69 66 73 64 76 65 L 74 71 C 71 71 69 73 68 76 Z', color: YELLOW_LIGHT },
      {
        name: 'Palm frond',
        // A lulav is a closed palm frond: a tall spine with the leaves swept
        // *upward* along it. Leaves fanning downward make a conifer, which is
        // exactly the wrong tree.
        d: 'M 34 6 L 42 2 L 48 74 L 36 74 Z',
        color: GREEN,
      },
      {
        name: 'Leaves',
        d:
          'M 38 20 C 30 12 22 8 14 8 C 18 18 26 26 36 30 Z ' +
          'M 40 20 C 46 10 54 4 62 2 C 60 14 52 24 42 30 Z ' +
          'M 40 40 C 32 32 24 28 17 28 C 21 38 29 46 38 50 Z ' +
          'M 42 40 C 48 30 55 24 63 22 C 61 34 53 44 44 50 Z ' +
          'M 42 58 C 35 51 28 48 22 48 C 26 57 32 63 40 66 Z ' +
          'M 44 58 C 49 49 56 44 62 42 C 60 53 53 62 46 66 Z',
        color: GREEN_DARK,
      },
      // The pitam sews with the other dark greens rather than on its own.
      { name: 'Pitam', d: 'M 75 52 L 81 52 L 81 60 L 75 60 Z', color: GREEN_DARK },
      {
        name: 'Myrtle and willow',
        // The other two of the four species, bound alongside the palm.
        d: 'M 24 40 L 30 40 L 34 74 L 26 74 Z M 50 44 L 56 44 L 54 74 L 46 74 Z',
        color: PINE,
      },
      { name: 'Binding', d: 'M 22 72 L 58 72 L 58 84 L 22 84 Z', color: WOOD },
    ],
  },
  {
    id: 'jewish-sukkah',
    name: 'Sukkah',
    category: 'jewish',
    keywords: ['sukkot', 'booth', 'hut', 'schach', 'tabernacles', 'harvest'],
    parts: [
      { name: 'Walls', d: 'M 12 34 L 88 34 L 88 94 L 12 94 Z', color: WOOD },
      {
        name: 'Planks',
        d: 'M 12 46 L 88 46 L 88 50 L 12 50 Z M 12 62 L 88 62 L 88 66 L 12 66 Z M 12 78 L 88 78 L 88 82 L 12 82 Z',
        color: WOOD_DARK,
      },
      {
        name: 'Doorway',
        d: 'M 38 58 C 38 50 43 46 50 46 C 57 46 62 50 62 58 L 62 94 L 38 94 Z',
        color: WOOD_DARK,
      },
      {
        name: 'Schach',
        // Branches laid loosely across the top, gaps and all: a sukkah roof has
        // to be open to the sky, and a solid roof would be the wrong picture.
        d:
          'M 4 22 L 96 22 L 96 34 L 4 34 Z ' +
          'M 10 10 L 18 10 L 22 22 L 14 22 Z M 26 8 L 34 8 L 38 22 L 30 22 Z ' +
          'M 44 6 L 52 6 L 56 22 L 48 22 Z M 62 8 L 70 8 L 74 22 L 66 22 Z ' +
          'M 78 10 L 86 10 L 90 22 L 82 22 Z',
        color: GREEN_DARK,
      },
      { name: 'Leaves', d: `${circle(20, 14, 6)} ${circle(38, 12, 6)} ${circle(56, 10, 6)} ${circle(74, 12, 6)}`, color: GREEN },
    ],
  },
  {
    id: 'jewish-gelt',
    name: 'Hanukkah gelt',
    category: 'jewish',
    keywords: ['coins', 'chocolate', 'hanukkah', 'money', 'gold', 'stack'],
    parts: [
      {
        name: 'Coins',
        d: `${circle(32, 66, 30)} ${circle(70, 46, 26)} ${circle(56, 82, 16)}`,
        color: GOLD,
      },
      {
        name: 'Rims',
        d:
          `${circle(32, 66, 30)} ${circle(32, 66, 24, false)} ` +
          `${circle(70, 46, 26)} ${circle(70, 46, 21, false)}`,
        color: GOLD_DARK,
      },
      {
        name: 'Marks',
        // A star on the big coin, a candle stub on the small one — gelt is
        // stamped, and blank discs read as buttons.
        d:
          'M 32 52 L 36 62 L 46 62 L 38 68 L 41 78 L 32 72 L 23 78 L 26 68 L 18 62 L 28 62 Z ' +
          'M 66 36 L 74 36 L 74 56 L 66 56 Z',
        color: GOLD_LIGHT,
      },
    ],
  },
  {
    id: 'jewish-grogger',
    name: 'Grogger',
    category: 'jewish',
    keywords: ['purim', 'noisemaker', 'ra’ashan', 'rattle', 'megillah', 'spin'],
    parts: [
      { name: 'Handle', d: 'M 42 62 L 58 62 L 58 98 L 42 98 Z', color: WOOD_DARK },
      {
        name: 'Box',
        d: 'M 16 12 C 16 8 19 6 23 6 L 77 6 C 81 6 84 8 84 12 L 84 58 C 84 62 81 64 77 64 L 23 64 C 19 64 16 62 16 58 Z',
        color: RED,
      },
      { name: 'Box shading', d: 'M 50 6 L 77 6 C 81 6 84 8 84 12 L 84 58 C 84 62 81 64 77 64 L 50 64 Z', color: RED_DARK },
      {
        name: 'Crank',
        d: 'M 84 20 L 96 20 L 96 26 L 84 26 Z M 90 20 L 96 20 L 96 44 L 90 44 Z M 84 38 L 96 38 L 96 44 L 84 44 Z',
        color: SILVER_DARK,
      },
      {
        name: 'Star',
        d: 'M 50 16 L 55 28 L 68 28 L 58 36 L 62 48 L 50 40 L 38 48 L 42 36 L 32 28 L 45 28 Z',
        color: YELLOW_LIGHT,
      },
    ],
  },
];
