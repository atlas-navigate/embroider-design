import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Generates `resources/icon.png`, which electron-builder converts to a `.ico`.
 *
 * Written by hand rather than with an image library: the only thing this needs
 * is a PNG encoder, and a build-time dependency that pulls in native bindings
 * would be a much bigger cost than forty lines of zlib and CRC. Re-run with
 * `npm run icon -w @embroider-design/app` after changing the artwork below.
 *
 * The mark is a hoop with a satin stitch column running across it — the two
 * things this program is about.
 */

const SIZE = 256;
const CENTER = SIZE / 2;

const BACKGROUND = [22, 24, 28, 255];
const HOOP_OUTER = [90, 98, 112, 255];
const HOOP_INNER = [30, 33, 40, 255];
const THREAD = [76, 154, 255, 255];
const THREAD_DARK = [40, 96, 170, 255];

const pixels = new Uint8Array(SIZE * SIZE * 4);

function put(x, y, rgba, alpha = 1) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  const a = alpha * (rgba[3] / 255);
  if (a <= 0) return;
  for (let c = 0; c < 3; c++) {
    pixels[i + c] = Math.round(pixels[i + c] * (1 - a) + rgba[c] * a);
  }
  pixels[i + 3] = Math.round(pixels[i + 3] + (255 - pixels[i + 3]) * a);
}

/** Coverage of one pixel by a ring, sampled 3x3 so the curve does not stair-step. */
function ringCoverage(x, y, radius, halfWidth) {
  let hits = 0;
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const px = x + (sx + 0.5) / 3 - CENTER;
      const py = y + (sy + 0.5) / 3 - CENTER;
      if (Math.abs(Math.hypot(px, py) - radius) <= halfWidth) hits++;
    }
  }
  return hits / 9;
}

function discCoverage(x, y, radius) {
  let hits = 0;
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const px = x + (sx + 0.5) / 3 - CENTER;
      const py = y + (sy + 0.5) / 3 - CENTER;
      if (Math.hypot(px, py) <= radius) hits++;
    }
  }
  return hits / 9;
}

// Background.
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) put(x, y, BACKGROUND, 1);

// The fabric inside the hoop, then the hoop rings.
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const inside = discCoverage(x, y, 96);
    if (inside > 0) put(x, y, HOOP_INNER, inside);
    const outer = ringCoverage(x, y, 100, 7);
    if (outer > 0) put(x, y, HOOP_OUTER, outer);
    const inner = ringCoverage(x, y, 84, 3);
    if (inner > 0) put(x, y, HOOP_OUTER, inner * 0.55);
  }
}

/**
 * A satin column: pairs of rails with the thread zig-zagging between them,
 * drawn the way the stitch generator actually lays one down.
 */
function drawSatinStitch(x0, y0, x1, y1, rgba) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const weight = dx === 0 && dy === 0 ? 1 : 0.35;
        put(Math.round(x) + dx, Math.round(y) + dy, rgba, weight);
      }
    }
  }
}

// The column runs on a diagonal through the hoop; each stitch crosses it.
const COLUMN_ANGLE = -Math.PI / 7;
const COLUMN_LENGTH = 150;
const COLUMN_HALF_WIDTH = 26;
const STITCH_SPACING = 5;

const ux = Math.cos(COLUMN_ANGLE);
const uy = Math.sin(COLUMN_ANGLE);
const nx = -uy;
const ny = ux;

for (let s = -COLUMN_LENGTH / 2; s <= COLUMN_LENGTH / 2; s += STITCH_SPACING) {
  // Taper the ends, so it reads as a stroke rather than a bar.
  const taper = 1 - Math.pow(Math.abs(s) / (COLUMN_LENGTH / 2), 3);
  const half = COLUMN_HALF_WIDTH * taper;
  const side = Math.round(s / STITCH_SPACING) % 2 === 0 ? 1 : -1;

  const ax = CENTER + ux * s + nx * half * side;
  const ay = CENTER + uy * s + ny * half * side;
  const bx = CENTER + ux * (s + STITCH_SPACING) - nx * half * side;
  const by = CENTER + uy * (s + STITCH_SPACING) - ny * half * side;
  drawSatinStitch(ax, ay, bx, by, side > 0 ? THREAD : THREAD_DARK);
}

// --- PNG encoding

function crc32(data) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, body) {
  const out = Buffer.alloc(body.length + 12);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'ascii');
  body.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // truecolour with alpha
// Compression, filter and interlace methods are all 0.

// One filter byte per scanline; filter 0 (none) keeps this readable.
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  Buffer.from(pixels.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources');
mkdirSync(target, { recursive: true });
writeFileSync(join(target, 'icon.png'), png);
console.log(`wrote ${join(target, 'icon.png')} (${SIZE}x${SIZE}, ${png.length} bytes)`);
