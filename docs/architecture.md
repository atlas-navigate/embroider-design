# Architecture

## Goals

Embroider Design is a Windows desktop application that lets a user create
embroidery designs (shapes, lettering, auto-digitized images) and export them
as machine-ready embroidery files, primarily for a Brother PE900 (`.PES`) but
also in other major consumer/prosumer formats (`.DST`, `.EXP`, `.JEF`, `.VP3`,
`.XXX`) for portability across machines.

## Packages

```
packages/
  engine/   @embroider-design/engine — pure TypeScript, zero native deps,
            zero Electron/React deps. Fully unit-testable standalone.
  app/      @embroider-design/app — Electron + React desktop application,
            depends on engine via a workspace reference.
```

`engine` never imports from `app`. This keeps every stitch-generation and
file-format algorithm testable in isolation, and would let a future CLI or
batch-processing tool reuse the same engine without pulling in Electron.

## The two data models

### 1. `EmbPattern` — the stitch-pattern intermediate representation

Every stitch generator (`stitchgen/*`, `lettering/*`, `autodigitize/*`)
produces or appends to an `EmbPattern`. Every file format writer's *only*
input is an `EmbPattern`. This is the single seam that decouples "how do we
turn a shape into stitches" from "how do we encode stitches as bytes for
machine X."

- Stitches are stored as **absolute coordinates** in 0.1mm units (matching
  the de facto precision used across all the formats we target), each
  tagged with a `StitchCommand` (`STITCH`, `JUMP`, `TRIM`, `COLOR_CHANGE`,
  `STOP`, `SEQUIN`, `END`).
- Absolute coordinates make bounding-box computation, hoop-fit validation,
  whole-pattern transforms, and preview rendering straightforward; the one
  place every format actually needs *relative* deltas (their wire encoding)
  is handled once, centrally, by `EmbPattern#toDeltaEncoding()` — including
  splitting any single delta that exceeds a format's maximum per-stitch
  travel distance into multiple jump-chained steps.
- A `threads: ThreadColor[]` palette records the color in effect at each
  `COLOR_CHANGE`.

### 2. `DesignDocument` — what the UI actually edits

A `DesignDocument` is an ordered list of `Layer`s (shape, text, or
image-trace), each carrying its own thread color and `StitchSettings`
(density, stitch type, underlay on/off, pull compensation, fill angle). This
is a purely vector/parametric, non-destructively-editable model — nothing
about it is stitches yet.

`document/compile.ts` exposes the single function `compileDesignDocument()`
that walks the layers in z-order and produces one final `EmbPattern` by
calling into `stitchgen`/`lettering`/`autodigitize` per layer, inserting
`COLOR_CHANGE` on thread transitions and `TRIM` before long jumps. This same
compiled pattern feeds both the live stitch preview and the file export path,
so "what you preview is what you export" by construction.

## Stitch generation

- **Running / bean stitch** — direct point-to-point stitches along a path,
  optionally doubled back (bean) for a bolder line.
- **Tatami / fill stitch** — scanline fill at a configurable angle, alternating
  direction row-to-row (boustrophedon) with staggered row-start offsets so
  adjacent rows' stitch ends don't line up into a visible seam.
- **Underlay** — a lower-density fill pass, perpendicular to the top stitch
  angle, stitched first to stabilize the fabric before the visible stitching.
- **Satin column** — zigzag stitches spanning a shape's width, at a configured
  spacing; pull compensation slightly widens the column to counter the
  thread-tension narrowing that happens once it is actually stitched. Shapes
  wider than ~12 mm are better served by fill than satin (long stitches snag on
  real fabric), and that decision lives in `stitchgen/stitch-router.ts`.

### Why satin is built from the medial axis

The obvious way to satin a closed shape is to split its outline into two rails
and walk them in lockstep. That is only valid for a true ribbon. On a letter
"H" the outline is a single loop that runs up one leg, across the bar and down
the other, so paired rails end up joining points on opposite sides of the
glyph: measured on Arial Bold at 15 mm, that produced stitches up to **10 mm
long across a 1.7 mm stroke** — thread laid over the fabric rather than into it.

So `stitchgen/skeleton.ts` extracts the shape's **medial axis** instead
(Zhang–Suen thinning over a rasterised region, with an exact Euclidean distance
transform supplying the half-width at every skeleton pixel), splits it into
branches at junctions, prunes spurs, and `stitchgen/auto-satin.ts` builds one
satin column per branch driven from that centreline. A branching glyph becomes
several columns, each a genuine ribbon. The same code handles narrow traced
shapes from image import, including tapering strokes, where the column width
follows the taper.

Two details that matter and are easy to get wrong:

- The **simple-point test** during thinning must count 8-connected components
  properly. The usual crossing-number test treats N and W as disconnected when
  NW is empty, which is wrong — they are one diagonal step apart — and it
  leaves the skeleton fragmented (an "O" came out as 36 branches instead of one
  loop). `RING_ADJACENCY` in `skeleton.ts` encodes the real adjacency.
- Rails are paced from the **centreline normal**, not by proportional arc
  length along two rails. On a reverse curve such as an "S" the outer rail
  swaps sides halfway, so matching rails by fraction pairs up points nowhere
  near each other.

## Lettering

Text layers are digitized, not rendered as pre-made embroidery font glyphs.

**No fonts are bundled.** `main/fonts.ts` enumerates `C:\Windows\Fonts` and
`%LOCALAPPDATA%\Microsoft\Windows\Fonts`, plus any file the user adds by hand;
`lettering/font-loader.ts` parses one with `opentype.js` when a layer needs it,
and `lettering/font-catalog.ts` does the pure dedupe/group/search work over the
resulting descriptors. The parsed catalog is cached in `userData`, keyed by
path, size and mtime, so only the first launch pays for the scan.

Glyph outlines are read from `glyph.path.commands` and scaled and Y-flipped by
hand rather than via `glyph.getPath(x, y, size)`, whose scale comes from a
field that is populated differently depending on how the font was constructed.
`text-layout.ts` positions glyphs using the font's own `unitsPerEm`,
`advanceWidth` and kerning tables; `glyph-to-stitch.ts` hands each glyph's
regions to the same router every other layer uses, so a normal weight becomes
satin and a very heavy or very large one becomes fill.

`lettering/font-metrics.ts` measures a font's **real stroke width** by
rasterising sample glyphs and taking width statistics from the distance
transform. That is what drives the "will it stitch?" readout: choosing a font
by how it looks on screen is how people end up with 0.4 mm strokes that vanish
into the fabric.

## Auto-digitizing (image import)

The renderer decodes the image file (`createImageBitmap` → canvas →
`ImageData`) and hands the engine a plain RGBA buffer, so the engine keeps zero
DOM and zero native dependencies and the pipeline stays testable on synthetic
buffers.

1. **Resize** to a bounded working raster so tracing cost does not scale with
   upload size (`autodigitize/image-data.ts`).
2. **Quantize** to a small palette with `image-q`, optionally dropping the
   background colour sampled from the border (`autodigitize/quantize.ts`).
3. **Clean** each colour's mask — open/close, despeckle, fill pinholes
   (`autodigitize/mask-ops.ts`). Speckle is what turns a photo into thousands
   of unstitchable dots.
4. **Trace** each mask into closed rings with marching squares
   (`autodigitize/trace.ts`), then simplify and group into regions with holes.
5. **Emit** `TracedColorRegion[]` ordered by coverage descending — which is
   both the correct nesting order and a sane sewing order
   (`autodigitize/pipeline.ts`). These become ordinary `ImageTraceLayer`s the
   user can still edit, recolour and restitch.

Tracing is our own marching-squares implementation rather than `imagetracerjs`:
that library emits its own smoothed segment format which would have to be
converted back into rings, whereas marching squares over the quantized mask
yields exactly the closed point rings that `groupRingsIntoRegions` and
`generateRegionStitches` already consume.

## File formats

See `docs/file-formats.md` for per-format structural notes. All writers and
readers share `formats/common/byte-writer.ts` / `byte-reader.ts` for
little/big-endian primitive I/O and `formats/common/palette-match.ts` for
mapping RGB threads onto a machine's fixed colour chart, and are registered in
`formats/format-registry.ts` with capability flags (stores colour, has a real
trim command, maximum stitch and jump distance).

Readers exist for every format we write, which makes the app a viewer and
converter as well as an editor: open a `.DST`, export a `.PES`.

### What "round-trips" means here

Writing a pattern and reading it back does **not** reproduce the same command
stream, and expecting it to is a mistake worth writing down:

- PEC (inside PES) writes a zero-delta stitch on landing after travel, which is
  the anchor that ties the thread down where a run starts.
- VP3 has no jump record at all. Travel is a trim followed by an ordinary move,
  so a jump's destination and the first stitch of the next run are the same
  record.
- DST, EXP, JEF and XXX split a travel move longer than their encoding allows
  into several chained jumps, adding intermediate points.

The invariant that does hold, and the one the tests assert, is that **the
sequence of sewn needle positions is preserved** to within each format's
integer grid (0.1 mm). `test/formats/golden.test.ts` additionally pins the
exact bytes of one small pattern per format, so a refactor cannot silently
change wire output while staying self-consistent with our own reader.

## Automatic updates

`main/updater.ts` checks this project's GitHub Releases every 30 minutes via
`electron-updater`, downloads in the background, and never restarts on its own
— digitizing a design is unsaved work. See `docs/releasing.md`.

## Why Electron

The dev machine (and, by design, any target end-user machine) should not need
Python or any pre-installed runtime — Electron bundles Chromium + Node, and
`electron-builder` produces a normal Windows installer (NSIS). The engine
package has no Electron dependency, so in principle a future CLI could reuse
it, but the shipped product is a single Windows desktop app.

### Where the work happens

The **renderer** runs the entire engine: geometry, digitizing, format encoding.
The **main** process does only what needs a filesystem — dialogs, reading and
writing bytes, enumerating fonts, the menu, and updates. No design data crosses
the IPC boundary; only files do. That avoids serialising patterns over IPC,
keeps one compile path shared by preview and export, and sidesteps ESM/CJS
friction in the main bundle.
