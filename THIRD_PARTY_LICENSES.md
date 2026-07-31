# Third-Party Licenses

This project (MIT licensed) depends on the following third-party software and
fonts. No GPL-licensed code or assets are used anywhere in this project.

## Runtime dependencies

| Package | License | Used for |
|---|---|---|
| electron | MIT | Desktop app shell |
| react / react-dom | MIT | UI rendering |
| zustand | MIT | Editor state/store |
| opentype.js | MIT | TrueType/OpenType font parsing, glyph outline extraction |
| image-q | MIT | Color quantization for image auto-digitizing |
| simplify-js | BSD-2-Clause | Polygon simplification of traced contours |
| polygon-clipping | MIT | Boolean operations on shapes (weld, subtract, hollow, slice) |

## Build/dev tooling (not shipped in application logic)

| Package | License |
|---|---|
| typescript | Apache-2.0 |
| vite / vite-plugin-electron | MIT |
| electron-builder | MIT |
| vitest | MIT |
| eslint / prettier | MIT |

## Fonts

Two sources, with different licensing consequences.

### Fonts already on the machine

Lettering uses the fonts installed on the machine — `C:\Windows\Fonts` and
`%LOCALAPPDATA%\Microsoft\Windows\Fonts` — which the user already holds a
licence for, plus any `.ttf`/`.otf` the user points at explicitly. These are
read at runtime and never copied into a project file or an exported design; a
saved `.embd` stores only the family, style and path, and glyph outlines are
converted to stitches at compile time.

A typeface's own licence still governs what the *user* may do with work they
set in it. Most retail and system fonts permit embroidery output; a few
restrict commercial use. That is between the user and their font vendor, and
this application makes no claim either way.

### Fonts bundled with this application

**28 typefaces are redistributed in the installer**, in
`packages/app/resources/fonts`. This is a deliberate change from the original
"bundle nothing" position, made because a stock Windows 11 install has only
four usable handwriting faces and no formal cursive at all — Brush Script,
Lucida Handwriting and Monotype Corsiva ship with Microsoft Office, not with
Windows — and a cursive monogram is the most common embroidery job there is.

Every bundled face is under a licence that expressly permits redistribution as
part of a larger work, and **each family's licence file ships beside it** in
the same directory:

| Licence | Families |
|---|---|
| SIL Open Font License 1.1 | Alex Brush, Alfa Slab One, Allura, Bebas Neue, Bungee, Cookie, Courgette, Graduate, Grand Hotel, Great Vibes, Italianno, Kaushan Script, Lobster, Marck Script, Pacifico, Parisienne, Petit Formal Script, Pinyon Script, Playball, Rouge Script, Sacramento, Staatliches, Tangerine, UnifrakturMaguntia |
| Apache License 2.0 | Satisfy, Ultra, Yellowtail |

All were obtained from the [google/fonts](https://github.com/google/fonts)
repository by `packages/app/scripts/fetch-fonts.mjs`, which records exactly
which file came from which directory and refuses to save a font whose licence
file it could not also fetch.

Neither licence is copyleft in a way that affects this project: the OFL's
reciprocity applies to *derivative fonts*, not to software that bundles them,
and it is satisfied here because the fonts are unmodified, carry their original
names, and ship with their licences. Neither licence permits selling the fonts
on their own, which this project does not do.

Adding a family means adding a line to `fetch-fonts.mjs` **and** a row above.
Do not add one from the `ufl/` directory of google/fonts without reading its
terms first.

## Explicitly excluded / not used

- `potrace` (npm) — GPLv2, not used. Raster tracing is our own marching-squares
  implementation in `packages/engine/src/autodigitize/trace.ts`.
- `imagetracerjs` — evaluated and dropped before implementation. It emits its
  own smoothed segment format that would have to be converted back into rings;
  marching squares over the quantized mask yields closed point rings directly,
  which is what the region and stitch code already consume.
- `Ink/Stitch` — GPLv3. Consulted only as public conceptual reference during
  research (stitch-type terminology, general algorithm shape); no code from
  this project was copied or ported.

## Format writer/reader implementations

The DST, PES/PEC, EXP, JEF, VP3, and XXX file format encoders/decoders in
`packages/engine/src/formats/` are original TypeScript implementations
written against publicly documented format structure (see
`docs/file-formats.md`) and cross-checked conceptually against the
behavior of MIT-licensed `pyembroidery` and zlib-licensed `libembroidery` —
no source code from either project was copied.
