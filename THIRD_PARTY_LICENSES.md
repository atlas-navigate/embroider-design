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

## Build/dev tooling (not shipped in application logic)

| Package | License |
|---|---|
| typescript | Apache-2.0 |
| vite / vite-plugin-electron | MIT |
| electron-builder | MIT |
| vitest | MIT |
| eslint / prettier | MIT |

## Fonts

**No fonts are bundled with this application**, so there is no font
redistribution licensing question at all.

Lettering uses the fonts already installed on the machine — `C:\Windows\Fonts`
and `%LOCALAPPDATA%\Microsoft\Windows\Fonts` — which the user already holds a
licence for, plus any `.ttf`/`.otf` the user points at explicitly. Font files
are read at runtime and never copied into a project file or an exported design;
a saved `.embd` stores only the family, style and path, and glyph outlines are
converted to stitches at compile time.

Note that a typeface's own licence still governs what the *user* may do with
work they set in it. Most retail and system fonts permit embroidery output; a
few restrict commercial use. That is between the user and their font vendor,
and this application makes no claim either way.

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
