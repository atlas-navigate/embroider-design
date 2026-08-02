import { useState } from 'react';
import {
  MAX_ENTRY_BYTES,
  MAX_FONT_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_PACKAGE_ENTRIES,
  classifyPackageEntry,
  libraryShapeFromImage,
  listZipEntries,
  packageCollectionName,
  parseCustomLibrary,
  parsePackageManifest,
  readZipEntry,
  type LibraryShape,
  type PackageManifest,
  type ZipEntryInfo,
} from '@embroider-design/engine';
import { useCustomShapeStore } from '../state/custom-shape-store.js';
import { useFontStore } from '../state/font-store.js';
import { decodeRgbaImage, inflateRaw, rasterizeSvg } from '../utils/decode-image.js';
import { CheckboxField, Field, PanelSection, SliderField } from '../components/controls.js';

/**
 * Installing a package: one zip in, fonts on disk and icons in the library.
 *
 * The split of labour is the app's usual one. Main picks the file and returns
 * bytes; the engine parses the container and validates every name and size;
 * this panel orchestrates — fonts go back to main to be written into the
 * app's own font directory, images go through the same tracer the sheet
 * importer uses, and a `custom-shapes.json` inside the package installs
 * losslessly. Nothing from the archive ever reaches the filesystem under a
 * name the archive chose.
 */

interface PackageIcon {
  entry: ZipEntryInfo;
  kind: 'image' | 'svg';
}

interface OpenedPackage {
  fileName: string;
  bytes: Uint8Array;
  fonts: ZipEntryInfo[];
  icons: PackageIcon[];
  libraries: ZipEntryInfo[];
  /** Entries refused before anything was read: bad names, bad sizes, overflow. */
  refused: number;
  suggestedCollection: string;
}

const decoder = new TextDecoder();

function fileNameOf(entry: ZipEntryInfo): string {
  return entry.name.split('/').pop() ?? entry.name;
}

async function openPackageFile(): Promise<OpenedPackage | null | 'unreadable'> {
  const file = await window.embroider.openPackage();
  if (!file) return null;
  // Copy out of the IPC transfer buffer once, up front.
  const bytes = new Uint8Array(file.data);

  let all: ZipEntryInfo[];
  try {
    all = listZipEntries(bytes);
  } catch {
    return 'unreadable';
  }

  const fonts: ZipEntryInfo[] = [];
  const icons: PackageIcon[] = [];
  const libraries: ZipEntryInfo[] = [];
  let manifestEntry: ZipEntryInfo | null = null;
  let refused = 0;
  let accepted = 0;

  for (const entry of all) {
    if (entry.directory) continue;
    const kind = classifyPackageEntry(entry.name);
    if (kind === 'other') continue;

    const sizeCap = kind === 'font' ? MAX_FONT_BYTES : MAX_ENTRY_BYTES;
    const unusable =
      entry.invalidPath ||
      entry.encrypted ||
      entry.method === 'unsupported' ||
      entry.uncompressedSize === 0 ||
      entry.uncompressedSize > sizeCap;
    if (unusable || accepted >= MAX_PACKAGE_ENTRIES) {
      refused++;
      continue;
    }
    accepted++;

    if (kind === 'font') fonts.push(entry);
    else if (kind === 'image') icons.push({ entry, kind: 'image' });
    else if (kind === 'svg') icons.push({ entry, kind: 'svg' });
    else if (kind === 'shape-library') libraries.push(entry);
    else manifestEntry = entry;
  }

  let manifest: PackageManifest | null = null;
  if (manifestEntry) {
    try {
      manifest = parsePackageManifest(
        decoder.decode(await readZipEntry(bytes, manifestEntry, inflateRaw)),
      );
    } catch {
      // A bad manifest costs the package its name, nothing else.
    }
  }

  return {
    fileName: file.name,
    bytes,
    fonts,
    icons,
    libraries,
    refused,
    suggestedCollection: packageCollectionName(file.name, manifest),
  };
}

export function PackageImportPanel(): JSX.Element {
  const saveMany = useCustomShapeStore((state) => state.saveMany);

  const [pkg, setPkg] = useState<OpenedPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [installing, setInstalling] = useState<{ done: number; total: number } | null>(null);

  const [collection, setCollection] = useState('');
  const [colors, setColors] = useState(5);
  const [smoothing, setSmoothing] = useState(1);
  const [mergeSimilar, setMergeSimilar] = useState(true);

  const pickFile = async (): Promise<void> => {
    const opened = await openPackageFile();
    if (opened === null) return;
    setStatus(null);
    if (opened === 'unreadable') {
      setError('That file is not a zip archive this app can read.');
      return;
    }
    setError(null);
    setPkg(opened);
    setCollection(opened.suggestedCollection);
  };

  const runInstall = async (): Promise<void> => {
    if (!pkg || installing) return;
    const total = pkg.fonts.length + pkg.libraries.length + pkg.icons.length;
    let done = 0;
    setInstalling({ done, total });
    setStatus(null);
    setError(null);

    let skipped = pkg.refused;
    const targetCollection = collection.trim();

    // Fonts first: they are quick, and a package that is only fonts should
    // feel instant. Read every face out of the archive, hand the batch to
    // main, and let its sanitiser have the final word on names.
    const fontFiles: { name: string; data: Uint8Array }[] = [];
    for (const entry of pkg.fonts) {
      try {
        fontFiles.push({
          name: fileNameOf(entry),
          data: await readZipEntry(pkg.bytes, entry, inflateRaw),
        });
      } catch {
        skipped++;
      }
      setInstalling({ done: ++done, total });
    }
    const installedFonts =
      fontFiles.length > 0 ? await window.embroider.installFonts(fontFiles) : [];
    skipped += fontFiles.length - installedFonts.length;

    const shapes: LibraryShape[] = [];

    // A shape-library JSON installs losslessly — ids kept, so reinstalling a
    // package replaces its shapes rather than duplicating them. Shapes that
    // arrive without a collection take the package's.
    for (const entry of pkg.libraries) {
      try {
        const text = decoder.decode(await readZipEntry(pkg.bytes, entry, inflateRaw));
        for (const shape of parseCustomLibrary(text).shapes) {
          shapes.push(
            shape.collection || !targetCollection
              ? shape
              : { ...shape, collection: targetCollection },
          );
        }
      } catch {
        skipped++;
      }
      setInstalling({ done: ++done, total });
    }

    for (const { entry, kind } of pkg.icons) {
      // One icon per turn of the event loop, exactly like the sheet importer:
      // a package of two hundred images is two hundred full traces.
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      try {
        const data = await readZipEntry(pkg.bytes, entry, inflateRaw);
        const base = fileNameOf(entry);
        const decoded =
          kind === 'svg' ? await rasterizeSvg(base, data) : await decodeRgbaImage(base, data);
        if (
          !decoded ||
          decoded.image.width > MAX_IMAGE_DIMENSION ||
          decoded.image.height > MAX_IMAGE_DIMENSION
        ) {
          skipped++;
        } else {
          const shape = libraryShapeFromImage(decoded.image, {
            name: base.replace(/\.[^.]+$/, '').trim() || 'Icon',
            colors,
            smoothing,
            mergeSimilar,
            ...(targetCollection ? { collection: targetCollection } : {}),
          });
          if (shape) shapes.push(shape);
          else skipped++;
        }
      } catch {
        skipped++;
      }
      setInstalling({ done: ++done, total });
    }

    let saved = true;
    if (shapes.length > 0) saved = await saveMany(shapes);
    if (installedFonts.length > 0) await useFontStore.getState().scan();
    setInstalling(null);

    if (!saved) {
      setError('The icons could not be saved to your library.');
      return;
    }
    const report: string[] = [];
    if (installedFonts.length > 0) {
      report.push(`${installedFonts.length} font${installedFonts.length === 1 ? '' : 's'} installed`);
    }
    if (shapes.length > 0) {
      report.push(
        `${shapes.length} icon${shapes.length === 1 ? '' : 's'} added` +
          (targetCollection ? ` to “${targetCollection}”` : ''),
      );
    }
    if (skipped > 0) report.push(`${skipped} skipped`);
    setStatus(
      report.length > 0
        ? `${report.join(' · ')}. Fonts are in the Text panel; icons are in the Shapes tab.`
        : 'Nothing in that package could be installed.',
    );
  };

  const hasIcons = pkg !== null && pkg.icons.length > 0;
  const hasAnything =
    pkg !== null && pkg.fonts.length + pkg.icons.length + pkg.libraries.length > 0;

  return (
    <>
      <PanelSection title="Install a font or icon package">
        <p className="muted small">
          A zip of fonts and artwork, installed in one go. Fonts (.ttf, .otf) are copied into the
          app and survive a restart; images and SVGs are traced into your shape library; a shape
          file exported from this app installs exactly as it was.
        </p>
        <button type="button" className="primary" onClick={() => void pickFile()}>
          Choose a package…
        </button>
        {pkg && <p className="muted small">{pkg.fileName}</p>}
        {error && <p className="warn small">{error}</p>}
      </PanelSection>

      {pkg && (
        <>
          <PanelSection title="What is inside">
            <p className="muted small">
              {pkg.fonts.length} font{pkg.fonts.length === 1 ? '' : 's'} · {pkg.icons.length}{' '}
              icon image{pkg.icons.length === 1 ? '' : 's'} · {pkg.libraries.length} shape file
              {pkg.libraries.length === 1 ? '' : 's'}
              {pkg.refused > 0 && ` · ${pkg.refused} unusable entr${pkg.refused === 1 ? 'y' : 'ies'} left out`}
            </p>
            {!hasAnything && (
              <p className="warn small">
                Nothing installable in there — the archive has no fonts, images or shape files.
              </p>
            )}
          </PanelSection>

          {hasIcons && (
            <>
              <PanelSection title="How each icon is traced">
                <SliderField
                  label="Colours"
                  hint="One thread change each"
                  value={colors}
                  min={2}
                  max={8}
                  step={1}
                  onChange={setColors}
                />
                <SliderField
                  label="Smoothing"
                  hint="Raise it for scanned or heavily compressed artwork"
                  value={smoothing}
                  min={0}
                  max={3}
                  step={1}
                  onChange={setSmoothing}
                />
                <CheckboxField
                  label="Merge near-identical colours"
                  hint="Saves a thread change for no visible loss"
                  checked={mergeSimilar}
                  onChange={setMergeSimilar}
                />
              </PanelSection>

              <PanelSection title="Where the icons go">
                <Field label="Collection">
                  <input
                    type="text"
                    value={collection}
                    maxLength={40}
                    placeholder="Woodland friends"
                    onChange={(event) => setCollection(event.target.value)}
                  />
                </Field>
              </PanelSection>
            </>
          )}

          <PanelSection title="Install">
            <button
              type="button"
              className="primary"
              onClick={() => void runInstall()}
              disabled={!hasAnything || installing !== null}
            >
              {installing
                ? `Installing ${installing.done} of ${installing.total}…`
                : 'Install the package'}
            </button>
            {status && <p className="muted small">{status}</p>}
          </PanelSection>
        </>
      )}
    </>
  );
}
