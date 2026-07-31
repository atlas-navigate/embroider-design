import type { Point } from '../geometry/point.js';
import { boundingBoxOfMany } from '../geometry/path.js';
import {
  compose,
  identity,
  scaling,
  translation,
  type AffineMatrix,
} from '../geometry/transform.js';
import type { PathGeometry, PathSegment, SubPath } from '../document/shapes.js';
import { AUTHORING_BOX } from './types.js';

/**
 * A small SVG path-data parser, so the shape catalogue can be written as
 * strings.
 *
 * Two hundred shapes authored as `SubPath` object literals would be thousands
 * of unreadable lines; as `d` strings they are one line each and can be checked
 * against any SVG editor. The output is the project's own `SubPath[]`, so
 * library shapes flow through `shapeToRings` and the stitch generator exactly
 * like a rectangle drawn with the mouse.
 *
 * Supports `M m L l H h V v C c S s Q q T t Z z`. **The elliptical arc `A` is
 * deliberately absent**: implementing it means the endpoint-to-centre
 * conversion, out-of-range radius correction and sweep-flag handling from the
 * SVG spec, all to produce curves the catalogue can express as cubics anyway.
 * A parser that quietly mis-draws one arc in fifty is worse than one that
 * refuses the command outright.
 */

/** Thrown rather than guessed: a malformed shape should fail its test, not stitch wrong. */
export class PathDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathDataError';
  }
}

const COMMANDS = new Set('MmLlHhVvCcSsQqTtZz');

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

/**
 * Walks the string once, handing back numbers and command letters.
 *
 * SVG number syntax is looser than it looks: `1.5.5` is two numbers, `1-2` is
 * two numbers, and separators are optional wherever the next character cannot
 * continue the current one. A regex split gets this wrong often enough that a
 * hand-written scanner is the safer choice.
 */
class PathScanner {
  private index = 0;

  constructor(private readonly text: string) {}

  private skipSeparators(): void {
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      if (isWhitespace(char) || char === ',') this.index++;
      else break;
    }
  }

  atEnd(): boolean {
    this.skipSeparators();
    return this.index >= this.text.length;
  }

  /** The next command letter, or null when a number comes next instead. */
  peekCommand(): string | null {
    this.skipSeparators();
    if (this.index >= this.text.length) return null;
    const char = this.text[this.index];
    return COMMANDS.has(char) ? char : null;
  }

  takeCommand(): string {
    const command = this.peekCommand();
    if (command === null) {
      throw new PathDataError(`Expected a command at position ${this.index} in "${this.text}"`);
    }
    this.index++;
    return command;
  }

  number(): number {
    this.skipSeparators();
    const start = this.index;
    if (this.text[this.index] === '+' || this.text[this.index] === '-') this.index++;
    while (this.index < this.text.length && isDigit(this.text[this.index])) this.index++;
    if (this.text[this.index] === '.') {
      this.index++;
      while (this.index < this.text.length && isDigit(this.text[this.index])) this.index++;
    }
    // Exponent, but only when it really is one: "1e" with no digits is not.
    if (this.text[this.index] === 'e' || this.text[this.index] === 'E') {
      const mark = this.index;
      this.index++;
      if (this.text[this.index] === '+' || this.text[this.index] === '-') this.index++;
      if (isDigit(this.text[this.index])) {
        while (this.index < this.text.length && isDigit(this.text[this.index])) this.index++;
      } else {
        this.index = mark;
      }
    }
    const raw = this.text.slice(start, this.index);
    const value = Number(raw);
    if (raw.length === 0 || !Number.isFinite(value)) {
      throw new PathDataError(`Expected a number at position ${start} in "${this.text}"`);
    }
    return value;
  }
}

/** Accumulates one subpath while the commands are read. */
interface Builder {
  start: Point;
  segments: PathSegment[];
  closed: boolean;
}

function reflect(point: Point, about: Point): Point {
  return { x: about.x * 2 - point.x, y: about.y * 2 - point.y };
}

export function parsePathData(d: string): SubPath[] {
  const scanner = new PathScanner(d);
  const subpaths: SubPath[] = [];
  let builder: Builder | null = null;
  let cursor: Point = { x: 0, y: 0 };
  /** The previous cubic's second control point, for `S`. */
  let lastCubicControl: Point | null = null;
  /** The previous quadratic's control point, for `T`. */
  let lastQuadraticControl: Point | null = null;
  let command = '';

  const flush = (): void => {
    // A subpath with no segments is a stray moveto, not geometry.
    if (builder && builder.segments.length > 0) {
      subpaths.push({ start: builder.start, segments: builder.segments, closed: builder.closed });
    }
    builder = null;
  };

  const require = (): Builder => {
    if (!builder) {
      throw new PathDataError(`"${d}" draws before its first moveto`);
    }
    return builder;
  };

  while (!scanner.atEnd()) {
    const next = scanner.peekCommand();
    if (next !== null) {
      command = scanner.takeCommand();
    } else if (command === '') {
      throw new PathDataError(`"${d}" does not start with a command`);
    } else if (command === 'M') {
      // Extra coordinate pairs after a moveto are linetos, per the spec.
      command = 'L';
    } else if (command === 'm') {
      command = 'l';
    } else if (command === 'Z' || command === 'z') {
      throw new PathDataError(`"${d}" has coordinates after a closepath`);
    }

    const relative = command >= 'a';
    const base = relative ? cursor : { x: 0, y: 0 };

    switch (command.toUpperCase()) {
      case 'M': {
        flush();
        const point = { x: base.x + scanner.number(), y: base.y + scanner.number() };
        builder = { start: point, segments: [], closed: false };
        cursor = point;
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case 'L': {
        const to = { x: base.x + scanner.number(), y: base.y + scanner.number() };
        require().segments.push({ type: 'line', to });
        cursor = to;
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case 'H': {
        const to = { x: base.x + scanner.number(), y: cursor.y };
        require().segments.push({ type: 'line', to });
        cursor = to;
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case 'V': {
        const to = { x: cursor.x, y: base.y + scanner.number() };
        require().segments.push({ type: 'line', to });
        cursor = to;
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case 'C': {
        const control1 = { x: base.x + scanner.number(), y: base.y + scanner.number() };
        const control2 = { x: base.x + scanner.number(), y: base.y + scanner.number() };
        const to = { x: base.x + scanner.number(), y: base.y + scanner.number() };
        require().segments.push({ type: 'cubic', control1, control2, to });
        cursor = to;
        lastCubicControl = control2;
        lastQuadraticControl = null;
        break;
      }
      case 'S': {
        // Smooth: the first control mirrors the previous one, or sits on the
        // current point when the previous segment was not a cubic. The
        // annotation is load-bearing: without it the inferred type of this
        // const depends on `lastCubicControl`, which is assigned from it a few
        // lines down, and the checker reports a circular initializer.
        const control1: Point = lastCubicControl
          ? reflect(lastCubicControl, cursor)
          : { ...cursor };
        const control2 = { x: base.x + scanner.number(), y: base.y + scanner.number() };
        const to = { x: base.x + scanner.number(), y: base.y + scanner.number() };
        require().segments.push({ type: 'cubic', control1, control2, to });
        cursor = to;
        lastCubicControl = control2;
        lastQuadraticControl = null;
        break;
      }
      case 'Q': {
        const control = { x: base.x + scanner.number(), y: base.y + scanner.number() };
        const to = { x: base.x + scanner.number(), y: base.y + scanner.number() };
        require().segments.push({ type: 'quadratic', control, to });
        cursor = to;
        lastQuadraticControl = control;
        lastCubicControl = null;
        break;
      }
      case 'T': {
        const control: Point = lastQuadraticControl
          ? reflect(lastQuadraticControl, cursor)
          : { ...cursor };
        const to = { x: base.x + scanner.number(), y: base.y + scanner.number() };
        require().segments.push({ type: 'quadratic', control, to });
        cursor = to;
        lastQuadraticControl = control;
        lastCubicControl = null;
        break;
      }
      case 'Z': {
        const current = require();
        current.closed = true;
        cursor = { ...current.start };
        flush();
        // Anything drawn after this continues from the point just closed onto,
        // which is what makes "M…Z L…" legal SVG.
        builder = { start: { ...cursor }, segments: [], closed: false };
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      default:
        throw new PathDataError(`Unsupported path command "${command}" in "${d}"`);
    }
  }

  flush();
  return subpaths;
}

/** The catalogue's storage form, ready for `shapeToRings`. */
export function pathFromData(d: string): PathGeometry {
  return { type: 'path', subpaths: parsePathData(d) };
}

/**
 * Two decimals in the authoring box is a hundredth of the shape's own size —
 * on a 60 mm placement that is 6 µm, four times finer than the tolerance the
 * curves were flattened at. More digits would only make the file bigger.
 */
const DEFAULT_DECIMALS = 2;

function trim(value: number, decimals: number): string {
  // `Number()` drops the trailing zeros `toFixed` insists on, and turns a "-0"
  // produced by rounding a tiny negative back into "0".
  return String(Number(value.toFixed(decimals)));
}

/**
 * The writer side of the parser: rings back out as an SVG `d` string.
 *
 * This exists because a shape the user *made* — by cutting, hollowing or
 * welding — has to be storable in the same form as a shape that shipped with
 * the app. One representation for both means the custom library needs no code
 * of its own for thumbnails, placement, search or stitching; it reuses the
 * catalogue's.
 *
 * Only straight segments come out, and that is honest rather than lossy: a
 * boolean operates on flattened rings, so straight segments are all there is
 * left by the time a result exists.
 */
export function pathDataFromRings(
  rings: readonly (readonly Point[])[],
  decimals = DEFAULT_DECIMALS,
): string {
  const parts: string[] = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const coordinates = ring.map((point) => `${trim(point.x, decimals)} ${trim(point.y, decimals)}`);
    parts.push(`M ${coordinates.join(' L ')} Z`);
  }
  return parts.join(' ');
}

/**
 * The transform that fits geometry into the 0-100 authoring box.
 *
 * Returned rather than applied, because a multi-part shape has to be fitted by
 * *one* transform: scaling each part to its own bounds would pull a snowman's
 * hat down over its face. Callers measure everything, ask for the matrix once,
 * and apply it to every part.
 *
 * Uniform, for the reason `instantiate.ts` gives — a squashed satin column
 * stops being a satin column.
 */
export function authoringBoxTransform(
  rings: readonly (readonly Point[])[],
  box = AUTHORING_BOX,
): AffineMatrix {
  const bounds = boundingBoxOfMany(rings);
  if (!bounds) return identity();
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width < 1e-9 && height < 1e-9) return identity();

  const scale = box / Math.max(width, height);
  return compose(
    translation(-bounds.minX, -bounds.minY),
    scaling(scale),
    // Centred on the short axis, so a wide shape sits in the middle of the box
    // rather than along its top edge.
    translation((box - width * scale) / 2, (box - height * scale) / 2),
  );
}
