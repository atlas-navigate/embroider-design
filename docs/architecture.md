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

A small cursive-heavy set ships with the app (`resources/fonts`, wired up in
`electron-builder.yml`) because Windows itself has almost no script faces;
everything else comes from the machine. `main/fonts.ts` enumerates `C:\Windows\Fonts` and
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

### Curved text

`lettering/text-warp.ts` bends a laid-out line onto a parametric baseline. One
`TextShape` union covers all of it — `arc` with a signed sweep in degrees,
`wave`, an explicit `path`, or `none` — and everything reduces to a single
primitive, `s → { point, tangent }`. The radius is *derived* from the laid-out
line width (`R = width / |sweep|`), which is why dragging the Curve slider
never changes the size of the text, and why ±360° closes a circle exactly.

Glyphs are translated to their point on the baseline and **rotated** to the
tangent. They are never distorted, for the same reason `library/instantiate.ts`
refuses non-uniform scaling: squashing an axis turns a satin column's constant
width into a varying one, and the router then makes different decisions along
one stroke. Envelope warps (bulge, perspective, flag) are left out on that
basis rather than left out by accident. Each glyph is placed by its **centre**
along the arc and stepped back half an advance, so wide letters sit square
instead of leaning.

`shape` is additive on `TextLayer`, so the save format stays at schema version
1: an old file loads unchanged, and a new one still opens in an old build,
minus the curve. `document/serialization.ts` coerces it defensively — an
unknown `type` or a non-finite number falls back to `{ type: 'none' }`.

## Boolean shape editing and custom shapes

`geometry/boolean.ts` wraps `polygon-clipping` (MIT, pure JS) for union,
difference, intersection and exclusion. It is the one third-party geometry
dependency, and the reasoning is in the module header: `offset.ts` fails
softly — a bad inset is skipped and the shape sews without underlay — whereas
a bad boolean hands back a plausible ring list that stitches the wrong thing
and the user cannot tell. Subtracting a rectangle flush with the subject's own
edge is an ordinary CAD request and precisely where hand-rolled clippers go
wrong.

Everything speaks the project's flat ring list. Nesting is not carried across
the boundary: `groupRingsIntoRegions` recovers it on both sides, so holes,
islands and counter-rings keep working with no new rules.
`document/shape-ops.ts` builds the layer operations on top — combine, hollow,
slice with a drawn knife, outline text — and `library/custom-shape.ts` turns a
result back into a catalogue entry, stored as `custom-shapes.json` in
`userData` exactly as the font catalog already is. Placed custom shapes are
baked into the document as geometry, so an `.embd` opened on another machine
still has the artwork: the personal library is a convenience, never a
dependency of the file.

### What counts as a hole

`groupRingsIntoRegions` sorts a flat pile of rings by containment depth — even
depth fills, odd depth is a hole. Containment is tested with a representative
interior point **and** a bounding-box check, and the second half is not
redundant. Artwork is drawn the way people draw: a cloud is three overlapping
circles. The centre of a small circle lands inside a big one without the small
one being a hole in it, and depth-by-interior-point alone therefore cuts a lobe
straight out of the cloud. A real hole is *entirely* inside the ring it is cut
from, so its box is inside that ring's box; overlapping blobs always break out
of the box somewhere, and that is what tells the two apart.

Overlap that survives all this is legal but wasteful — the seam sews twice in
one thread, which is a ridge you can feel — so `compileShapeLayer` runs
`mergeOverlappingRings` first, unioning a part's own regions into single areas.
A bounding-box test short-circuits it, so the common case (a row of ruler
ticks, a scatter of seeds) never reaches the clipper at all.

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
