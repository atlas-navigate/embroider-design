# Embroidery file formats

Reference notes for the six formats `packages/engine/src/formats/` writes and reads.

These are our own notes, written from studying the formats and cross-checking behaviour
against [pyembroidery](https://github.com/EmbroidePy/pyembroidery) (MIT) and
[libembroidery](https://github.com/Embroidermodder/libembroidery) (zlib). No code was copied
from either; where our behaviour deliberately diverges, the reason is called out below.

---

## Shared conventions

### Units

Every coordinate in an `EmbPattern` is in **0.1 mm units**. That is the native resolution of
all six formats, so a writer rounds exactly once — at the very end — instead of accumulating
error through the pipeline.

### Orientation

`EmbPattern` is **Y-down**, matching the design canvas. Machine formats mostly are not:

| Format | Stitch data | Notes |
| --- | --- | --- |
| DST | Y-up | Writer flips |
| EXP | Y-up | Writer flips |
| JEF | Y-up | Writer flips |
| XXX | Y-up | Writer flips |
| **PES / PEC** | **Y-down** | No flip — this is why DST→PES conversion needs a vertical flip |
| VP3 | Y-down (stitches) | Header geometry is Y-up; the format is genuinely mixed |

The flip is a single `flipY` flag on `toDeltaEncoding`, so no writer re-derives it.

### Relative encoding

All six store *relative* moves. `toDeltaEncoding` does the conversion once, and two details
there are load-bearing:

1. **Rounding is applied to absolute positions, not deltas.** Rounding each delta
   independently accumulates error, and a long fill visibly drifts off its outline. Tracking
   an integer machine position and diffing against it bounds the error at half a unit forever.
2. **Long moves are split iteratively.** Each step is clamped to the format's limit and the
   remainder recomputed from the true target, so the final position is exact no matter how the
   intermediate rounding fell.

### Per-format move limits (0.1 mm units)

| Format | Max stitch | Max jump | Why |
| --- | --- | --- | --- |
| DST | 121 | 121 | 81+27+9+3+1 — the ternary encoding's ceiling |
| PES/PEC | 127 | 2047 | Encoding reaches 2047, but a 20 cm stitch is not sewable |
| EXP | 127 | 127 | −128 encodes as `0x80`, which is the escape byte |
| JEF | 127 | 127 | Signed byte pairs |
| VP3 | 32000 | 32000 | Deliberately unsplit — see the VP3 section |
| XXX | 124 | 124 | Keeps coordinate bytes clear of the `0x7D`–`0x7F` escapes |

### Design placement

Writers centre the design's bounding box on the machine origin by default (`center: true`),
because the carriage starts at the hoop centre. This is what commercial digitizing software
does on export. Pass `center: false` to keep absolute coordinates.

---

## DST (Tajima)

The oldest and most universal format, and the simplest. `.dst`

**Header** — 512 bytes of ASCII, each field terminated by `\r`, then `0x1A`, then space padding:

```
LA:<name padded to 16>\r    ST:<stitches, width 7>\r    CO:<colour changes, width 3>\r
+X:<width 5>\r  -X:<width 5>\r  +Y:<width 5>\r  -Y:<width 5>\r
AX:+<width 5>\r AY:+<width 5>\r MX:+<width 5>\r MY:+<width 5>\r  PD:******\r
```

`AX`/`AY` are the final needle position. Optional extended fields (`AU:` author, `CP:`
copyright, `TC:` thread) are off by default because older readers can choke on them.

**Body** — 3-byte records. Each axis is decomposed into signed contributions of 81, 27, 9, 3
and 1, scattered across specific bits:

| Contribution | +X | −X | +Y | −Y |
| --- | --- | --- | --- | --- |
| 81 | b2 bit 2 | b2 bit 3 | b2 bit 5 | b2 bit 4 |
| 27 | b1 bit 2 | b1 bit 3 | b1 bit 5 | b1 bit 4 |
| 9 | b0 bit 2 | b0 bit 3 | b0 bit 5 | b0 bit 4 |
| 3 | b1 bit 0 | b1 bit 1 | b1 bit 7 | b1 bit 6 |
| 1 | b0 bit 0 | b0 bit 1 | b0 bit 7 | b0 bit 6 |

Coordinate records always set b2 bits 0 and 1; jumps additionally set bit 7.

**Control records** (b2 only; bit 6 is set on all of them and never by a coordinate, which is
what makes them unambiguous):

| Record | b2 |
| --- | --- |
| Colour change / stop | `0b11000011` |
| End | `0b11110011` |
| Sequin mode | `0b01000011` |

**Trims.** DST has no trim record. The convention is three jumps that net to zero
displacement: `(+2,+2)`, `(−4,−4)`, `(+2,+2)`. Our reader collapses the shortest zero-net jump
burst back into a `TRIM`; requiring zero net displacement is what keeps that detection safe.

**Colours.** DST stores none. Exported DSTs carry stitch data only.

**Where we diverge:** pyembroidery writes `+Y`/`-Y` from its internal Y-down bounds without
flipping, which swaps them. We compute the header extents in DST space. Both are identical for
a centred design; ours is right for an off-centre one.

---

## PES / PEC (Brother) — the PE900's format

PES is a container. The machine seeks to the embedded **PEC block** and ignores the rest, so
the PEC block is the part that has to be correct. `.pes`

### PES container (version 1)

```
offset 0   "#PES0001"
offset 8   uint32le  absolute offset of the PEC block
offset 12  uint16le  scale-to-fit flag (1)
offset 14  uint16le  hoop selection (1)
offset 16  uint16le  distinct block objects (1, or 0 when empty)
offset 18  uint16le  0xFFFF then 0x0000  (0x0000 0x0000 when empty)
           CEmbOne / CSewSeg vector blocks
           PEC block
```

The `CEmbOne`/`CSewSeg` blocks describe the design as polylines for desktop editors
(PE-Design). Machines never read them. `{ truncated: true }` skips them and emits a 22-byte
stub pointing straight at the PEC block — smaller, still machine-readable, and a useful
fallback if a tool ever objects to the vector section.

Each vector block is a length-prefixed name (`uint16le` length, then ASCII) followed by its
payload. `CSewSeg` segments are: `uint16le` flag (0 sewn, 1 jump), `uint16le` colour index,
`uint16le` point count, then `int16le` x/y pairs, with `0x8003` separating segments. A colour
transition log (`uint16le` count, then section/colour pairs) closes the block.

### PEC block

**Header — exactly 512 bytes** from the start of the block:

| Offset | Bytes | Content |
| --- | --- | --- |
| +0 | 20 | `LA:` + name (max 8 chars) padded to 16 + `\r` |
| +20 | 14 | 12 spaces, then `0xFF 0x00` |
| +34 | 1 | Thumbnail byte stride (6) |
| +35 | 1 | Thumbnail height (38) |
| +36 | 12 | Spaces |
| +48 | 1 | Colour block count − 1 (`0xFF` means none) |
| +49 | n | One chart index per colour block |
| +49+n | — | Spaces to +512 |

**Stitch block:**

| Offset | Bytes | Content |
| --- | --- | --- |
| +512 | 2 | `0x00 0x00` |
| +514 | 3 | uint24le length of the stitch block, measured from +512 |
| +517 | 3 | `0x31 0xFF 0xF0` |
| +520 | 2 | uint16le design width |
| +522 | 2 | uint16le design height |
| +524 | 4 | uint16le `0x01E0`, uint16le `0x01B0` (fixed) |
| +528 | … | Stitch stream, terminated by `0xFF` |

**Stitch encoding.** Each coordinate is written independently:

- **Short form** — one byte, 7-bit two's complement, for values in (−64, 63).
- **Long form** — two bytes, big-endian. Bit 15 marks it long, bits 12–13 carry the flag
  (`0x10` jump, `0x20` trim), and the low 12 bits hold the signed value.

A colour change is `0xFE 0xB0` followed by an alternating `0x02`/`0x01` marker. A `0x00 0x00`
landing stitch is emitted after travel before sewing resumes.

**Thumbnails.** After the stitch block: one 48×38 monochrome bitmap for the whole design, then
one per colour block. 6 bytes per row, LSB-first, 228 bytes each. The machine shows these when
browsing a USB stick — a file without them parses but looks broken to the operator.

**Colours** are *indices into Brother's built-in 64-entry chart*, not RGB. See
`formats/common/thread-charts.ts`. Index 0 is reserved, so valid indices are 1–64.

**Where we diverge:** pyembroidery flags every jump after the first as a trim. We use
`JUMP_CODE` for plain travel and `TRIM_CODE` only where the pattern actually asked for a trim.
Both codes exist for exactly this distinction, and discarding it would make the machine cut and
re-thread on every internal jump.

---

## EXP (Melco)

No header at all — just a stream of signed byte pairs. `.exp`

| Record | Bytes |
| --- | --- |
| Stitch | `dx`, `dy` |
| Jump | `0x80 0x04`, `dx`, `dy` |
| Trim | `0x80 0x80 0x07 0x00` |
| Colour change / stop | `0x80 0x01 0x00 0x00` |
| End | (file simply ends) |

The ±127 limit is not padding: −128 encodes as `0x80`, which a reader takes as the start of an
escape sequence. EXP has no long form to fall back on, so the splitting in `toDeltaEncoding` is
the only thing standing between a long stitch and a corrupt file.

Because EXP has no signature, `detectFormat` deliberately never guesses it — returning it as a
catch-all would make every unrecognised file decode into stitch soup instead of failing.

---

## JEF (Janome)

`.jef`

**Header — 116 bytes (`0x74`):**

| Offset | Type | Content |
| --- | --- | --- |
| 0 | uint32le | Offset of the stitch data: `0x74 + colours × 8` |
| 4 | uint32le | `0x14` (format constant) |
| 8 | 14 bytes | Date, `YYYYMMDDHHMMSS` |
| 22 | 2 bytes | Zero |
| 24 | uint32le | Colour count |
| 28 | uint32le | Point count (2-byte records, including the terminator) |
| 32 | uint32le | Hoop code |
| 36 | 4 × int32le | Half width, half height, twice |
| 52 | 16 × int32le | Four hoop-clearance groups (110×110, 50×50, 140×200, custom) |

Then `colours × uint32le` chart indices, then `colours × uint32le` of `0x0D` (sew type).

A hoop-clearance group of four `−1`s means the design does not fit that hoop, which is how the
machine decides which hoops to offer.

**Stitch records:** `dx, dy` for a stitch; `0x80 0x02 dx dy` for a jump; `0x80 0x01 dx dy` for
a colour change; `0x80 0x10` terminates the file.

**Trims.** JEF has no trim command; the convention is a burst of zero-length jumps. We emit
them by default (`trims: true`, three per trim) — pyembroidery defaults these off, but dropping
trims leaves the machine dragging thread between every separated region. The reader collapses
a run of zero-length jumps back into a `TRIM`.

**Colours** are indices into Janome's chart (79 entries, index 0 reserved). We use a
*non-repeat* assignment rather than a globally unique one: only consecutive blocks are
guaranteed distinct indices, which avoids pushing distant colours to poor matches in a chart
this large.

---

## VP3 (Pfaff / Husqvarna Viking)

Big-endian throughout, structured as nested length-prefixed blocks. `.vp3`

```
"%vsm%" 0x00  <utf16be string: producer>
  00 02 00  <int32be bytes-to-end>   file block
    <utf16be notes>  4 × int32be extents  uint32be stitch count
    0x00, colour block count, 0x0C, 0x00, design count
    00 03 00  <int32be bytes-to-end>  design block
      centre x/y, half extents, width, height, notes, transform, "xxPP"
      uint16be colour block count
      00 05 00  <int32be bytes-to-end>  colour block
        start x/y (relative to centre), thread record, block shift
        00 01 00  <int32be bytes-to-end>  stitch block
          0x0A 0xF6 0x00, then stitch data
```

Every length field counts the bytes *after* the field itself.

**Thread record:** `0x01 0x00`, uint24be RGB, `0x00 0x00 0x00 0x05 0x28`, then three
length-prefixed strings (catalogue number, description, brand).

**Stitch records:** `dx, dy` as signed bytes; a long stitch is `0x80 0x01`, two int16be values,
then `0x80 0x02`; `0x80 0x03` is a trim.

Two things catch people out:

- **There is no jump command.** Travel is an ordinary long stitch, and a preceding trim is what
  makes it travel rather than sew. Our jumps are folded into the following stitch's delta, and
  the reader turns "long stitch after a trim" back into a `JUMP`.
- **Mixed scales.** Header geometry is in 1/1000 mm (our units × 100) while stitch deltas stay
  in 1/10 mm. This is the format, not a conversion bug.

**Why VP3 alone does not pre-split long moves.** Splitting travel at a sewable length turns one
travel move into a row of real needle penetrations — and it compounds: export, re-import,
re-export, and the stitch count climbs every cycle, because the jump that justified the long
move no longer exists. The long form encodes ±32767 natively, which covers any hoop, so nothing
is split and the round trip is stable. This is covered by a regression test.

---

## XXX (Singer)

`.xxx`

**Header — 256 bytes**, mostly reserved zeros:

| Offset | Type | Content |
| --- | --- | --- |
| 0x00 | 23 bytes | Zero |
| 0x17 | uint32le | Stitch record count |
| 0x1B | 12 bytes | Zero |
| 0x27 | uint32le | Thread count |
| 0x2D | int16le ×2 | Width, height |
| 0x31 | int16le ×2 | Final needle position |
| 0x35 | int16le ×2 | Offset from the design's minimum corner to the origin |
| 0xF2 | uint16le | `0x20` |
| 0xFC | uint32le | Absolute offset of the end of the stitch data |

**Stitch records:** signed byte pair for a short stitch; `0x7D` + two int16le for a long one;
`0x7F 0x01 dx dy` jump, `0x7F 0x03 dx dy` trim, `0x7F 0x08 dx dy` colour change.

After the stitches: `0x7F 0x7F 0x02 0x14`, then the colour table — two pad bytes, then
`0x00, r, g, b` per thread, zero-filled to 21 slots, then `0xFFFFFF00` and `0x00 0x01`.

The 124-unit limit keeps coordinate bytes clear of the `0x7D`–`0x7F` escape values.

---

## Verifying changes to a writer

1. `npm test -w @embroider-design/engine` — round-trip tests write a fixture, read it back with
   our own reader, and compare every sewn stitch position. `byte-layout.test.ts` additionally
   checks fixed offsets, back-patched lengths, and that the file size accounts for every byte.
2. Open the output in a free viewer (Embroidermodder 2, or an online PES viewer) and confirm
   the stitch paths look sane — no runaway jumps, correct fill direction, correct colour order.
3. **A test stitch-out on the real machine is still required.** Round-trip tests prove we can
   read what we wrote; they cannot prove a Brother PE900 agrees. Sew a small design on scrap
   before trusting a large one.
