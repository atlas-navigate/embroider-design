# Embroider Design

A free, open-source embroidery CAD application for Windows. Design shapes and
lettering, import a photo/logo and auto-digitize it into stitches, preview the
stitch-out, and export machine-ready embroidery files — including Brother's
`.PES` format for the Brother PE900 — without buying commercial digitizing
software or format add-ons.

## Install

1. Download **`Embroider-Design-<version>-setup.exe`** from the
   [latest release](https://github.com/atlas-navigate/embroider-design/releases/latest).
2. Run it. Windows will show a blue **"Windows protected your PC"** screen —
   click **More info ▸ Run anyway**. This appears because the installer is not
   code signed, which is a cost rather than a technical obstacle; see
   `docs/roadmap.md`.
3. It installs for your user only, so there is no administrator prompt, and it
   goes to `%LOCALAPPDATA%\Programs\Embroider Design` unless you change it.

Then start it from the **Embroider Design** shortcut on your desktop or Start
menu. Windows 10 or 11, 64-bit; nothing else to install.

The app checks for a new version every 30 minutes, downloads it quietly in the
background, and asks before restarting — it will never interrupt you mid-design.
Full end-user instructions are in [`docs/installing.md`](docs/installing.md).

## Running it

It is a normal desktop application, so there is no command to memorize — the
shortcut is the answer. If you want to launch it from a terminal anyway:

| You have | Command |
|---|---|
| The installed app | `& "$env:LOCALAPPDATA\Programs\Embroider Design\Embroider Design.exe"` |
| This source checkout | `npm install` then `npm run dev` |
| A local build, not installed | `& ".\packages\app\release\win-unpacked\Embroider Design.exe"` |

## Features

- **A library of 227 shapes and icons** — the drawing shapes you would expect
  from a presentation tool (basic shapes, block arrows, stars and banners,
  callouts, flowchart, equation) plus seasonal and thematic icons across
  Halloween, Christmas, Valentine's, weddings, Easter, Thanksgiving, patriotic,
  birthdays, summer, school, pets, nautical, nature and **Jewish holidays** —
  a nine-branch chanukiah and a seven-branch Temple menorah both, dreidel,
  shofar, seder plate, challah, hamsa and more. Every icon is built in layers
  the way an embroiderer works — silhouette, shading, detail — so it reads as
  an object at 40 mm rather than as a flat sticker, and multi-part icons (a
  snowman, a jack-o'-lantern, a diamond ring) arrive as a **group** with their
  colours already set and ordered so each thread is used once
- **Curved and shaped text**, the way Canva does it: one Curve slider bends a
  line into an arch, a bottom arc or a full circle, plus a wave. Letters are
  rotated along the baseline rather than distorted, which is what keeps satin
  columns an even width — so curved lettering stitches as cleanly as straight
- **Cut, weld and hollow shapes into new ones**: union, subtract, intersect and
  exclude any selection, hollow a shape to a wall thickness you set in mm, or
  convert text to outlines and cut that. Save the result to **My shapes**, where
  it stays across restarts and behaves like any other catalogue entry
- Vector design canvas: rectangles, ellipses, stars, polygons, lines, freehand
  paths — draw, move, scale and rotate with live stitch regeneration
- **Multi-select and grouping**: Ctrl+A selects everything, Ctrl-click and
  Shift-click extend a selection, a rubber-band drag picks up whatever it
  touches, Ctrl+G groups so a design moves and scales as one, and the arrow
  keys nudge by 0.5 mm (5 mm with Shift)
- Lettering with **28 bundled typefaces plus every font on your PC**. The
  bundled set is cursive-heavy on purpose — Great Vibes, Allura, Alex Brush,
  Parisienne, Sacramento, Italianno, Tangerine and a dozen more — because
  Windows itself ships almost no script faces. Filter the picker by Cursive,
  Serif, Sans, Display or Blackletter. It measures the font's real stroke width
  at the size you chose and tells you plainly whether it will hold as satin —
  and what size would.
- Image import with automatic digitizing: colour quantization, background
  removal, despeckling, contour tracing, and per-region fill/satin generation,
  with a live preview of the trace before you commit it
- **Import a whole sheet of icons at once.** Point it at a page of clip-art —
  the kind sold as thirty little drawings in rows — and it finds each drawing,
  cuts it out and rebuilds it as a proper multi-layer shape in your library,
  filed under a collection you name. A contact sheet shows every icon it found
  with a box round it, so you can see it got the right ones and click to leave
  any out before committing. One slider joins an icon's scattered pieces or
  splits neighbours that ran together, and there is a plain rows-and-columns
  mode for pages it cannot read on its own
- **Delete what you do not want.** Remove saved shapes one at a time or by the
  selection, delete a whole collection when an import comes out wrong, and hide
  the shipped icons you never use. Hidden icons stay installed and come back
  whenever you ask — and deleting a saved shape never touches a design that
  already used it, because designs carry their own copy of the geometry
- Satin built from the shape's medial axis, so branching letters and tapering
  strokes come out as proper columns instead of thread dragged across the glyph
- Underlay, fill density, fill angle, stitch length and pull compensation, per
  layer or as document defaults
- Layer panel showing what each layer actually compiled to, and warning when a
  layer generated nothing
- Stitch preview with stitch-by-stitch playback, a scrubber, jump/trim display
  and per-colour visibility
- Open existing embroidery files too — it is a viewer and converter as well as
  an editor (open a `.DST`, export a `.PES`)
- Export to Brother PES/PEC, Tajima DST, Melco EXP, Janome JEF, Pfaff/Husqvarna
  VP3, and Singer XXX
- Hoop-size validation (Brother PE900 5"x7" preset included, plus other
  common hoop sizes), with per-edge overflow in mm and a one-click shrink-to-fit
- Stitch count, thread changes, jumps and estimated sewing time before you
  export
- **Automatic updates**: the installed app checks this repository's releases
  every 30 minutes, downloads in the background, and asks before restarting
- Runs as a standalone Windows installer — no Python, no subscription, no
  separate data-format add-ons required

## Repository layout

This is an npm-workspaces monorepo:

- `packages/engine` — pure TypeScript core: geometry, the internal stitch
  pattern model, stitch-generation algorithms, lettering, auto-digitizing,
  and embroidery file format readers/writers. Zero Electron/React
  dependencies, fully unit-testable on its own.
- `packages/app` — the Electron + React desktop application (canvas editor,
  layer/property panels, stitch preview, export flow) built on top of the
  engine.

See `docs/installing.md` for the end-user install guide,
`docs/architecture.md` for the full design, `docs/file-formats.md` for notes on
the embroidery file formats this project implements, `docs/releasing.md` for how
to cut a release the auto-updater will find, and `docs/roadmap.md` for planned
future work.

## Development

Requires Node.js 18+ and npm.

```bash
npm install
npm run build    # type-checks and builds engine + app
npm test         # runs the engine test suite (unit, round-trip and golden-file)
npm run dev      # builds the engine, then launches the app in development mode
npm run package  # produces a Windows installer via electron-builder
```

The app resolves `@embroider-design/engine` through its built `dist/`, which is
why `dev` and `package` build the engine first.

If `npm run package` fails while unpacking electron-builder's `winCodeSign`
bundle ("Cannot create symbolic link"), that archive contains macOS symlinks
Windows will not create without Developer Mode. Either enable Developer Mode,
or pre-extract it without the macOS tree:

```powershell
$cache = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
& .\node_modules\7zip-bin\win\x64\7za.exe x -bd "$cache\winCodeSign-2.6.0.7z" `
    "-o$cache\winCodeSign-2.6.0" '-x!darwin' -y
```

## Getting a design onto a Brother PE900

Export as PES, copy the file to the **root** of a FAT32-formatted USB stick,
and plug it into the machine. The PE900 does not reliably browse deeply nested
folders. Its hoop is 5" × 7" (127 × 178 mm), it sews at about 650 stitches a
minute, and it trims jumps automatically.

## Important safety note

No public specification exists for every Brother PES/PEC variant used by
modern machines, and this project has been built and tested **without access
to a physical embroidery machine**. The writers are verified by automated
round-trip tests (write → read back with our own reader → compare the sewn
needle path) and by byte-for-byte golden-file fixtures, and the geometry is
checked numerically and visually — but no amount of that substitutes for
thread and fabric. **Always stitch out a small, cheap test design on your
actual machine before trusting a larger or important one.**

## License

MIT — see `LICENSE`. Third-party dependency licenses are listed in
`THIRD_PARTY_LICENSES.md`, including the 28 bundled typefaces: 25 under the SIL
Open Font License and 3 under Apache-2.0, each shipping with its own licence
file. Lettering also uses the fonts already installed on your machine, which
are never copied into a project or an exported design.
