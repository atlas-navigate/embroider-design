import type { BoundingBox } from '../geometry/path.js';
import {
  ascentOf,
  defaultLineHeight,
  descentOf,
  glyphAdvance,
  pairKerning,
  type EmbroideryFont,
} from './font.js';
// The two modules refer to each other, but only this direction carries a
// runtime value: `text-warp` imports nothing from here but types, which are
// erased, so there is no import cycle at run time.
import { applyTextShape, type TextShape } from './text-warp.js';

/**
 * Where each glyph sits, using the font's own metrics.
 *
 * Nothing here knows about stitches — it is pure typesetting, so it can be
 * unit-tested against hand-computed advances and reused by the canvas to draw
 * a text layer's outline before it has been digitized.
 *
 * Coordinates are design units (0.1 mm), Y-down, with the block's top-left at
 * the origin: x grows right, y grows down, and the first baseline sits one
 * ascent below the top.
 */

export type TextAlign = 'left' | 'center' | 'right';

export interface TextLayoutOptions {
  /** Em size in 0.1 mm units. */
  size: number;
  /** Extra space inserted between every pair of glyphs. Can be negative. */
  letterSpacing?: number;
  /** Extra space added to each space character, on top of its own advance. */
  wordSpacing?: number;
  /** Baseline-to-baseline distance. Defaults to the font's own suggestion. */
  lineHeight?: number;
  align?: TextAlign;
  /** Apply the font's kern pairs. Default `true`. */
  kerning?: boolean;
  /** Wrap width in design units. `0`/omitted means never wrap. */
  maxWidth?: number;
  /**
   * Bends the finished line onto a curve. Applied after typesetting, so
   * wrapping, alignment and kerning are all decided on the straight text and a
   * curve never changes where the words break.
   */
  shape?: TextShape;
}

export interface PlacedGlyph {
  char: string;
  /** Pen origin: the glyph's left sidebearing edge, on the baseline. */
  x: number;
  y: number;
  /** This glyph's own advance, excluding letter/word spacing. */
  advance: number;
  lineIndex: number;
  /**
   * Radians to turn the glyph about its pen origin, set by a text shape.
   * Absent means upright, which is every glyph in straight text.
   */
  rotation?: number;
}

export interface LaidOutLine {
  text: string;
  glyphs: PlacedGlyph[];
  /** Width before the alignment offset is applied. */
  width: number;
  baselineY: number;
  offsetX: number;
}

export interface TextLayout {
  lines: LaidOutLine[];
  /** Every glyph from every line, in reading order. */
  glyphs: PlacedGlyph[];
  /**
   * Block width as typeset: the widest line, or the wrap width if one was
   * given. This is the *unwarped* measurement, because it is what alignment
   * and wrapping are defined against — a curved line still centres on the same
   * width it would have had straight. For where the glyphs actually ended up,
   * read `bounds`.
   */
  width: number;
  height: number;
  /**
   * Where the glyphs really are, advance boxes included. Equal to
   * `0,0 – width,height` for straight text, and the reason a curved layer still
   * gets a selection rectangle that hugs it.
   */
  bounds: BoundingBox;
  lineHeight: number;
  ascent: number;
  descent: number;
  size: number;
  /** Characters the font has no glyph for. Surfaced as a layer warning. */
  missing: string[];
}

interface ResolvedOptions {
  size: number;
  letterSpacing: number;
  wordSpacing: number;
  lineHeight: number;
  align: TextAlign;
  kerning: boolean;
  maxWidth: number;
}

function resolveOptions(font: EmbroideryFont, options: TextLayoutOptions): ResolvedOptions {
  const size = Math.max(1, options.size);
  return {
    size,
    letterSpacing: options.letterSpacing ?? 0,
    wordSpacing: options.wordSpacing ?? 0,
    lineHeight: options.lineHeight ?? defaultLineHeight(font.metrics, size),
    align: options.align ?? 'left',
    kerning: options.kerning ?? true,
    maxWidth: Math.max(0, options.maxWidth ?? 0),
  };
}

function isSpace(char: string): boolean {
  return char === ' ' || char === '\t';
}

/** Splits into code points, so emoji and accented pairs stay whole. */
function toChars(text: string): string[] {
  return Array.from(text);
}

function layoutChars(
  font: EmbroideryFont,
  chars: readonly string[],
  options: ResolvedOptions,
): { glyphs: Omit<PlacedGlyph, 'y' | 'lineIndex'>[]; width: number } {
  const glyphs: Omit<PlacedGlyph, 'y' | 'lineIndex'>[] = [];
  let pen = 0;
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (i > 0) {
      pen += options.letterSpacing;
      if (options.kerning) pen += pairKerning(font, chars[i - 1], char, options.size);
    }
    const advance = glyphAdvance(font, char, options.size);
    glyphs.push({ char, x: pen, advance });
    pen += advance;
    if (isSpace(char)) pen += options.wordSpacing;
  }
  return { glyphs, width: pen };
}

/** Width of a single line of text in design units, ignoring newlines. */
export function measureText(
  font: EmbroideryFont,
  text: string,
  options: TextLayoutOptions,
): number {
  return layoutChars(font, toChars(text), resolveOptions(font, options)).width;
}

/**
 * Greedy word wrap. A single word wider than the limit is left overflowing
 * rather than broken mid-word — hyphenating a monogram would be worse than a
 * line that runs wide, and the hoop check will catch it anyway.
 */
function wrapParagraph(
  font: EmbroideryFont,
  text: string,
  options: ResolvedOptions,
): string[] {
  if (options.maxWidth <= 0) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line.length > 0 ? `${line} ${word}` : word;
    if (line.length === 0 || layoutChars(font, toChars(candidate), options).width <= options.maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

export function layoutText(
  font: EmbroideryFont,
  text: string,
  options: TextLayoutOptions,
): TextLayout {
  const resolved = resolveOptions(font, options);
  const ascent = ascentOf(font.metrics, resolved.size);
  const descent = descentOf(font.metrics, resolved.size);

  const paragraphs = text.replace(/\r\n?/g, '\n').split('\n');
  const rawLines: string[] = [];
  for (const paragraph of paragraphs) {
    for (const line of wrapParagraph(font, paragraph, resolved)) rawLines.push(line);
  }

  const lines: LaidOutLine[] = [];
  let widest = 0;
  for (let index = 0; index < rawLines.length; index++) {
    // Trailing spaces would push a centred line off-centre.
    const lineText = rawLines[index].replace(/[ \t]+$/, '');
    const { glyphs, width } = layoutChars(font, toChars(lineText), resolved);
    if (width > widest) widest = width;
    lines.push({
      text: lineText,
      glyphs: glyphs.map((glyph) => ({ ...glyph, y: 0, lineIndex: index })),
      width,
      baselineY: ascent + index * resolved.lineHeight,
      offsetX: 0,
    });
  }

  const blockWidth = Math.max(widest, resolved.maxWidth);
  const placed: PlacedGlyph[] = [];
  for (const line of lines) {
    line.offsetX =
      resolved.align === 'center'
        ? (blockWidth - line.width) / 2
        : resolved.align === 'right'
          ? blockWidth - line.width
          : 0;
    for (const glyph of line.glyphs) {
      glyph.x += line.offsetX;
      glyph.y = line.baselineY;
      placed.push(glyph);
    }
  }

  const missing: string[] = [];
  for (const glyph of placed) {
    if (isSpace(glyph.char) || font.hasGlyph(glyph.char)) continue;
    if (!missing.includes(glyph.char)) missing.push(glyph.char);
  }

  const height = ascent + (lines.length - 1) * resolved.lineHeight + descent;
  const straight: TextLayout = {
    lines,
    glyphs: placed,
    width: blockWidth,
    height,
    bounds: { minX: 0, minY: 0, maxX: blockWidth, maxY: height },
    lineHeight: resolved.lineHeight,
    ascent,
    descent,
    size: resolved.size,
    missing,
  };

  // Shaping comes last, on a finished block: bending the text must not be able
  // to change where the words broke or how the lines aligned.
  return applyTextShape(straight, options.shape);
}

/** The block's extent, for placing a text layer on the canvas. */
export function textLayoutBounds(layout: TextLayout): BoundingBox {
  return layout.bounds;
}
