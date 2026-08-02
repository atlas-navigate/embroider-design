import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, nativeImage } from 'electron';

/**
 * What the icon-sheet scanner actually does to real sheets.
 *
 * The unit tests pin the behaviour on pages built to be awkward in one way
 * each. They cannot tell you whether the constants are right, because a page
 * written to exercise a rule always exercises it. This runs the real thing over
 * real clip-art and prints what came back, which is the only way to know.
 *
 * Run it after building the engine:
 *
 *     npm run build -w @embroider-design/engine
 *     npx electron packages/app/scripts/scan-sheets.mjs
 *     npx electron packages/app/scripts/scan-sheets.mjs --crops
 *     npx electron packages/app/scripts/scan-sheets.mjs --trace
 *
 * Electron rather than plain Node, and in this package rather than in the
 * engine's, for one reason: something has to decode a JPEG. The engine promises
 * zero native dependencies and takes decoded pixels from its caller, and that
 * promise is worth more than the convenience of `node` here — so this borrows
 * the decoder Electron already ships, which is also the one the app itself uses
 * at runtime. Nothing is added to any dependency list.
 *
 * The sheets it reads are gitignored third-party artwork. Without them this
 * says so and exits, so it is safe to run anywhere.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..');
const sheetsDirectory = join(root, 'Icon styles');
const outputDirectory = join(root, 'packages', 'app', 'sheet-scan');

const args = process.argv.slice(2);
const wantCrops = args.includes('--crops');
const wantJson = args.includes('--json');
const wantTrace = args.includes('--trace');
const filters = args.filter((argument) => !argument.startsWith('--'));

function optionValue(name, fallback) {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? Number(args[at + 1]) : fallback;
}

/**
 * Electron hands back raw pixels in Skia's native order, which on every
 * little-endian platform is blue, green, red, alpha. The engine wants them the
 * other way round. Swapping in place rather than copying: these buffers reach
 * fifty megabytes on the larger sheets.
 */
function swapRedAndBlue(bytes) {
  for (let i = 0; i < bytes.length; i += 4) {
    const blue = bytes[i];
    bytes[i] = bytes[i + 2];
    bytes[i + 2] = blue;
  }
  return bytes;
}

function decode(path) {
  const image = nativeImage.createFromPath(path);
  if (image.isEmpty()) return null;
  const { width, height } = image.getSize();
  const data = new Uint8ClampedArray(swapRedAndBlue(Buffer.from(image.toBitmap())));
  return { data, width, height };
}

async function encodePng(image, path) {
  const bytes = Buffer.from(image.data.buffer.slice(0));
  swapRedAndBlue(bytes);
  const out = nativeImage.createFromBitmap(bytes, {
    width: image.width,
    height: image.height,
  });
  await writeFile(path, out.toPNG());
}

/** Draws a box into an RGBA buffer directly — no canvas, no font, no dependency. */
function strokeBox(image, box, rgb) {
  const plot = (x, y) => {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
    const i = (y * image.width + x) * 4;
    image.data[i] = rgb[0];
    image.data[i + 1] = rgb[1];
    image.data[i + 2] = rgb[2];
    image.data[i + 3] = 255;
  };
  for (let x = box.minX; x < box.maxX; x++) {
    plot(x, box.minY);
    plot(x, box.maxY - 1);
  }
  for (let y = box.minY; y < box.maxY; y++) {
    plot(box.minX, y);
    plot(box.maxX - 1, y);
  }
  // A solid corner tab, so a box can be found at a glance without any text.
  for (let y = box.minY; y < Math.min(box.minY + 6, box.maxY); y++) {
    for (let x = box.minX; x < Math.min(box.minX + 6, box.maxX); x++) plot(x, y);
  }
}

function copyOf(image) {
  return {
    data: new Uint8ClampedArray(image.data),
    width: image.width,
    height: image.height,
  };
}

async function main() {
  if (!existsSync(sheetsDirectory)) {
    console.log(`No "Icon styles" directory at ${sheetsDirectory}.`);
    console.log('It holds gitignored third-party reference sheets — nothing to check without it.');
    return 0;
  }

  const engine = await import(
    pathToFileURL(join(root, 'packages', 'engine', 'dist', 'index.js')).href
  );

  const names = (await readdir(sheetsDirectory))
    .filter((name) => ['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(extname(name).toLowerCase()))
    .filter((name) => filters.length === 0 || filters.some((f) => name.toLowerCase().includes(f.toLowerCase())))
    .sort();

  if (names.length === 0) {
    console.log('No sheets matched.');
    return 0;
  }

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const options = {};
  const maxDimension = optionValue('--max-dimension', undefined);
  const separation = optionValue('--separation', undefined);
  const tolerance = optionValue('--tolerance', undefined);
  if (maxDimension !== undefined) options.maxDimension = maxDimension;
  if (separation !== undefined) options.separation = separation;
  if (tolerance !== undefined) options.tolerance = tolerance;
  if (tolerance !== undefined) options.backgroundTolerance = tolerance;

  const summary = [];
  let totalIcons = 0;
  let totalLabels = 0;

  for (const name of names) {
    const decoded = decode(join(sheetsDirectory, name));
    if (!decoded) {
      console.log(`${name}: could not be decoded.`);
      continue;
    }

    const started = Date.now();
    const scan = engine.scanIconSheet(decoded, options);
    const elapsed = Date.now() - started;
    const icons = scan.cells.filter((cell) => !cell.likelyLabel);
    totalIcons += icons.length;
    totalLabels += scan.labelCount;

    console.log(
      `${name.padEnd(42)} ${String(decoded.width).padStart(4)}x${String(decoded.height).padEnd(5)}` +
        ` scale ${scan.scale.toFixed(2)}  icons ${String(icons.length).padStart(3)}` +
        ` (+${scan.labelCount} labels)`,
    );
    console.log(
      `${' '.repeat(42)} sep ${String(scan.separationUsed).padStart(3)} ${scan.separationBasis.padEnd(14)}` +
        ` tol ${String(scan.toleranceUsed).padStart(3)} soft ${String(scan.softToleranceUsed).padStart(3)}` +
        ` noise ${String(scan.noiseFloor).padStart(3)}` +
        `${scan.crowded ? '  RAN TOGETHER' : ''}  ${elapsed}ms`,
    );

    const annotated = copyOf(scan.cells.length > 0 || true ? decoded : decoded);
    // Boxes are in working-raster coordinates; the annotation is drawn on the
    // original, so they scale up by exactly the factor the crops use.
    for (const cell of scan.cells) {
      strokeBox(annotated, cell.sourceBox, cell.likelyLabel ? [230, 150, 20] : [40, 120, 240]);
    }
    await encodePng(annotated, join(outputDirectory, `${name.replace(/\.[^.]+$/, '')}.png`));

    if (wantCrops) {
      const cropDirectory = join(outputDirectory, name.replace(/\.[^.]+$/, ''));
      await mkdir(cropDirectory, { recursive: true });
      for (const cell of scan.cells) {
        const tag = String(cell.index + 1).padStart(3, '0');
        const suffix = cell.likelyLabel ? `-${cell.labelReason ?? 'label'}` : '';
        await encodePng(cell.crop(), join(cropDirectory, `${tag}${suffix}.png`));
      }
    }

    if (wantTrace) {
      // The second half of the import: run the tracer over every kept crop,
      // exactly as the panel does, and report how much of the ink came back as
      // filled regions. Coverage near 1 is a fully filled icon; well under 1
      // is the "not fully filled in" complaint, made measurable. Slightly over
      // 1 is normal — the seam-closing overlap and enclosed ground-coloured
      // pockets both count as traced area without counting as ink.
      const ground = {
        r: scan.background[0],
        g: scan.background[1],
        b: scan.background[2],
      };
      let coverageSum = 0;
      let coverageMin = Infinity;
      let tracedCount = 0;
      for (const cell of scan.cells) {
        if (cell.likelyLabel) continue;
        const crop = cell.crop();
        const traced = engine.mergeSimilarColors(
          engine.autoDigitizeImage(crop, {
            targetWidth: 100,
            colors: 5,
            removeBackground: true,
            morphology: 1,
            minRegionAreaMm2: 0.09,
          }),
        );

        const unitsPerPixel = 100 / traced.rasterWidth;
        let net = 0;
        for (const colour of traced.colors) {
          for (const region of colour.regions) {
            net += Math.abs(engine.polygonArea(region.outer));
            for (const hole of region.holes) net -= Math.abs(engine.polygonArea(hole));
          }
        }
        const tracedPixels = net / (unitsPerPixel * unitsPerPixel);

        let inkPixels = 0;
        for (let i = 0; i < crop.width * crop.height; i++) {
          const colour = {
            r: crop.data[i * 4],
            g: crop.data[i * 4 + 1],
            b: crop.data[i * 4 + 2],
          };
          if (engine.threadDistance(colour, ground) >= 40) inkPixels++;
        }
        const rasterScale = traced.rasterWidth / crop.width;
        const inkAtRaster = inkPixels * rasterScale * rasterScale;
        const coverage = inkAtRaster > 0 ? tracedPixels / inkAtRaster : 1;

        coverageSum += coverage;
        coverageMin = Math.min(coverageMin, coverage);
        tracedCount++;
        console.log(
          `    crop ${String(cell.index + 1).padStart(3, '0')}` +
            `  colours ${traced.colors.length}` +
            ` (+${traced.droppedColors.length} dropped)` +
            `  coverage ${coverage.toFixed(2)}`,
        );
      }
      if (tracedCount > 0) {
        console.log(
          `${' '.repeat(42)} traced ${tracedCount} crops · mean coverage ` +
            `${(coverageSum / tracedCount).toFixed(2)} · worst ${coverageMin.toFixed(2)}`,
        );
      }
    }

    summary.push({
      sheet: name,
      width: decoded.width,
      height: decoded.height,
      icons: icons.length,
      labels: scan.labelCount,
      separationUsed: scan.separationUsed,
      separationBasis: scan.separationBasis,
      toleranceUsed: scan.toleranceUsed,
      noiseFloor: scan.noiseFloor,
      crowded: scan.crowded,
      ms: elapsed,
    });
  }

  console.log(`\n${names.length} sheets · ${totalIcons} icons · ${totalLabels} flagged as labels`);
  console.log(`Annotated pages in ${outputDirectory}`);
  if (wantJson) {
    await writeFile(join(outputDirectory, 'summary.json'), JSON.stringify(summary, null, 2));
  }
  return 0;
}

app.disableHardwareAcceleration();
app
  .whenReady()
  .then(main)
  .then((code) => app.exit(code))
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
