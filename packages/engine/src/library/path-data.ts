import type { Point } from '../geometry/point.js';
import type { PathGeometry, PathSegment, SubPath } from '../document/shapes.js';

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
