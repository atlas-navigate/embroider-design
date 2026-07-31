import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * A contact sheet of the whole shape catalogue, as one SVG.
 *
 * Two hundred hand-authored icons cannot be reviewed by reading path data. The
 * unit tests prove a shape parses, stays in its box and encloses a region —
 * none of which has any bearing on whether the dog looks like a dog. This is
 * the tool for that question, and it draws from the same `d` strings the app
 * parses, so what you see here is what gets stitched.
 *
 * Run after building the engine:
 *
 *     npm run build -w @embroider-design/engine
 *     node packages/engine/scripts/render-catalogue.mjs
 *
 * Deliberately plain SVG and plain Node: a review tool that needs its own
 * toolchain is a review tool nobody runs. The sheet itself is gitignored — it
 * is a third of a megabyte of generated outlines, and a committed copy would
 * be wrong the moment anybody edited an icon without regenerating it.
 */

const CELL = 96;
const PADDING = 10;
const LABEL = 16;
const COLUMNS = 10;
const HEADER = 30;

const here = dirname(fileURLToPath(import.meta.url));
// `pathToFileURL`, not the bare path: on Windows a dynamic import of "C:\..."
// is read as a URL with a "c:" scheme and refused.
const {
  CATEGORIES,
  shapesInCategory,
  pathFromData,
  shapeToRings,
  shapeToOpenPaths,
  groupRingsIntoRegions,
  regionToRings,
} = await import(pathToFileURL(resolve(here, '..', 'dist', 'index.js')).href);

/** A ring as SVG path data. */
function ringPath(ring) {
  return `M ${ring.map((p) => `${+p.x.toFixed(2)} ${+p.y.toFixed(2)}`).join(' L ')} Z`;
}

function escapeXml(text) {
  return text.replace(/[<>&'"]/g, (char) =>
    char === '<' ? '&lt;' : char === '>' ? '&gt;' : char === '&' ? '&amp;' : char === "'" ? '&apos;' : '&quot;',
  );
}

/**
 * One shape, drawn into a 100-unit cell.
 *
 * Drawn region by region, from the same `groupRingsIntoRegions` nesting the
 * compiler stitches by, rather than by handing the authored `d` straight to
 * the renderer. Both halves of that matter. `fill-rule="evenodd"` within a
 * region is what makes a counter-ring read as the hole it is, so nobody goes
 * off to fix a shape that is perfectly correct — and keeping regions in
 * separate paths is what stops two overlapping rings of one part, the three
 * circles of a cloud, from cancelling into a stencil that will never be sewn.
 */
function renderShape(shape, x, y) {
  const scale = (CELL - PADDING * 2) / 100;
  const parts = shape.parts
    .map((part) => {
      const geometry = pathFromData(part.d);
      const fill = part.color ?? '#8ba3c7';
      const filled = groupRingsIntoRegions(shapeToRings(geometry))
        .map(
          (region) =>
            `<path d="${regionToRings(region).map(ringPath).join(' ')}" fill="${fill}" fill-rule="evenodd"/>`,
        )
        .join('');
      const open = shapeToOpenPaths(geometry)
        .map(
          (path) =>
            `<path d="${`M ${path.map((p) => `${+p.x.toFixed(2)} ${+p.y.toFixed(2)}`).join(' L ')}`}" ` +
            `fill="none" stroke="${fill}" stroke-width="1.5"/>`,
        )
        .join('');
      return filled + open;
    })
    .join('');
  const name = escapeXml(shape.name);
  return (
    `<g transform="translate(${x + PADDING} ${y + PADDING}) scale(${scale.toFixed(4)})">${parts}</g>` +
    `<text x="${x + CELL / 2}" y="${y + CELL + 10}" text-anchor="middle" ` +
    `font-family="Segoe UI, sans-serif" font-size="9" fill="#c8cdd6">${name}</text>`
  );
}

// Optional category filter, so redrawing one theme does not mean re-reading a
// sheet of two hundred icons to find the eight that changed.
const only = new Set(process.argv.slice(2));

const sections = [];
let cursorY = 0;

for (const category of CATEGORIES) {
  if (only.size > 0 && !only.has(category.id)) continue;
  const shapes = shapesInCategory(category.id);
  if (shapes.length === 0) continue;

  sections.push(
    `<text x="8" y="${cursorY + 20}" font-family="Segoe UI, sans-serif" font-size="15" ` +
      `font-weight="600" fill="#ffffff">${escapeXml(category.name)} ` +
      `<tspan fill="#7d8694" font-weight="400">${shapes.length}</tspan></text>`,
  );
  cursorY += HEADER;

  shapes.forEach((shape, index) => {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    sections.push(renderShape(shape, column * CELL, cursorY + row * (CELL + LABEL)));
  });

  cursorY += Math.ceil(shapes.length / COLUMNS) * (CELL + LABEL) + 12;
}

const width = COLUMNS * CELL;
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${cursorY}" ` +
  `viewBox="0 0 ${width} ${cursorY}">` +
  `<rect width="${width}" height="${cursorY}" fill="#16181c"/>` +
  sections.join('') +
  '</svg>';

const output = join(here, '..', only.size > 0 ? 'catalogue-subset.svg' : 'catalogue.svg');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, svg, 'utf8');
console.log(`Wrote ${output} — ${width} x ${cursorY}`);
