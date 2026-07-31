import type { Point } from '../geometry/point.js';
import { boundingBoxOfMany, type BoundingBox } from '../geometry/path.js';
import { applyToPoints, compose, rotation, translation } from '../geometry/transform.js';
import type { LaidOutLine, PlacedGlyph, TextLayout } from './text-layout.js';

/**
 * Curved and shaped lettering.
 *
 * Every shape here reduces to one primitive: a baseline curve that answers
 * "where am I, and which way am I pointing, `s` units along?". Glyphs are then
 * placed on it by moving and **rotating** them — never by bending or stretching
 * their outlines.
 *
 * That restriction is not a shortcut, it is the whole design. An embroidered
 * letter is a satin column, and a satin column is defined by having a constant
 * width; distort the outline and the width varies along the stroke, so the
 * width router starts choosing satin at one end of a letter and a tatami fill
 * at the other. `library/instantiate.ts` refuses non-uniform scaling for the
 * same reason. It is also why the envelope effects other design tools offer —
 * bulge, perspective, flag — are **deliberately absent**: they look fine in ink
 * and sew badly, and an effect that quietly ruins the stitching is worse than
 * one the app does not have.
 *
 * Coordinates are the text block's own: design units (0.1 mm), Y-down, top-left
 * of the unwarped block at the origin, first baseline one ascent down.
 */

/**
 * `sweep` is the curve control, in signed degrees across the whole line.
 * Positive arches the text upward into a rainbow, negative bows it downward;
 * ±360 closes it into a full circle. The radius is *derived* from the laid-out
 * width, so turning the curve up bends the text without resizing it — the arc
 * length always equals the width the text would have had in a straight line.
 */
export type TextShape =
  | { type: 'none' }
  | { type: 'arc'; sweep: number }
  | { type: 'wave'; amplitude: number; cycles: number }
  | { type: 'path'; points: Point[] };

export const STRAIGHT: TextShape = { type: 'none' };

/** A full turn, the most a line can be bent before it overlaps itself. */
export const MAX_SWEEP_DEGREES = 360;

export interface BaselineSample {
  point: Point;
  /** Unit tangent. The glyph is rotated to match it. */
  tangent: Point;
}

export interface Baseline {
  /** Arc length of the curve as specified. Text may legitimately run past it. */
  length: number;
  at(s: number): BaselineSample;
}

/**
 * In a Y-down frame the normal is the tangent turned a quarter-turn
 * clockwise-on-screen, which points *below* the baseline — so a descender and a
 * second line both offset the way you would expect.
 */
function normalOf(tangent: Point): Point {
  return { x: -tangent.y, y: tangent.x };
}

/**
 * A circular arc through the middle of the line.
 *
 * The line's midpoint stays exactly where it was and the text bends away from
 * it in both directions, so dragging the curve control does not also drag the
 * text across the hoop.
 */
function arcBaseline(sweepDegrees: number, baselineY: number, width: number): Baseline | null {
  const sweep = (Math.max(-MAX_SWEEP_DEGREES, Math.min(MAX_SWEEP_DEGREES, sweepDegrees)) * Math.PI) / 180;
  if (width < 1e-9 || Math.abs(sweep) < 1e-6) return null;

  // Signed curvature: radians of turn per unit of arc length.
  const k = sweep / width;
  const radius = 1 / k;
  const center = { x: width / 2, y: baselineY + radius };

  return {
    length: width,
    at: (s) => {
      const theta = k * (s - width / 2);
      return {
        point: {
          x: center.x + radius * Math.sin(theta),
          y: center.y - radius * Math.cos(theta),
        },
        tangent: { x: Math.cos(theta), y: Math.sin(theta) },
      };
    },
  };
}

/**
 * Resamples an arbitrary curve by arc length.
 *
 * A sine wave walked at a constant step in `x` crowds its letters where the
 * curve is steep. Building a length table once and looking positions up in it
 * keeps the spacing even, which is the difference between a wave effect and a
 * wave effect that looks like a mistake.
 */
function sampledBaseline(points: readonly Point[]): Baseline | null {
  if (points.length < 2) return null;

  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const step = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    cumulative.push(cumulative[i - 1] + step);
  }
  const total = cumulative[cumulative.length - 1];
  if (total < 1e-9) return null;

  const segmentTangent = (index: number): Point => {
    const from = points[index];
    const to = points[index + 1];
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  };

  return {
    length: total,
    at: (s) => {
      // Off either end, carry on straight along the end tangent rather than
      // piling every overflowing glyph onto the last point.
      if (s <= 0) {
        const tangent = segmentTangent(0);
        return {
          point: { x: points[0].x + tangent.x * s, y: points[0].y + tangent.y * s },
          tangent,
        };
      }
      if (s >= total) {
        const tangent = segmentTangent(points.length - 2);
        const overshoot = s - total;
        const last = points[points.length - 1];
        return {
          point: { x: last.x + tangent.x * overshoot, y: last.y + tangent.y * overshoot },
          tangent,
        };
      }

      let low = 0;
      let high = cumulative.length - 1;
      while (high - low > 1) {
        const middle = (low + high) >> 1;
        if (cumulative[middle] <= s) low = middle;
        else high = middle;
      }
      const span = cumulative[low + 1] - cumulative[low];
      const t = span > 1e-12 ? (s - cumulative[low]) / span : 0;
      const from = points[low];
      const to = points[low + 1];
      return {
        point: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
        tangent: segmentTangent(low),
      };
    },
  };
}

/** Enough samples that a full-width wave is smooth without being expensive. */
const WAVE_SAMPLES = 256;

function waveBaseline(
  amplitude: number,
  cycles: number,
  baselineY: number,
  width: number,
): Baseline | null {
  if (width < 1e-9 || Math.abs(amplitude) < 1e-9 || Math.abs(cycles) < 1e-9) return null;
  const points: Point[] = [];
  for (let i = 0; i <= WAVE_SAMPLES; i++) {
    const x = (i / WAVE_SAMPLES) * width;
    points.push({ x, y: baselineY + amplitude * Math.sin((x / width) * cycles * Math.PI * 2) });
  }
  return sampledBaseline(points);
}

/**
 * The curve a shape describes for a given layout, or `null` when the shape is
 * straight or degenerate — which callers should read as "change nothing".
 */
export function baselineFor(shape: TextShape | undefined, layout: TextLayout): Baseline | null {
  if (!shape || shape.type === 'none') return null;
  const baselineY = layout.ascent;
  switch (shape.type) {
    case 'arc':
      return arcBaseline(shape.sweep, baselineY, layout.width);
    case 'wave':
      return waveBaseline(shape.amplitude, shape.cycles, baselineY, layout.width);
    case 'path':
      return sampledBaseline(shape.points);
  }
}

/**
 * Where a glyph's own quad lands once it is placed, for measuring the block.
 *
 * The advance box rather than the outline: it needs no font, it is what the
 * selection rectangle should hug, and it is stable while the user is typing.
 */
function glyphQuad(glyph: PlacedGlyph, ascent: number, descent: number): Point[] {
  const corners: Point[] = [
    { x: 0, y: -ascent },
    { x: glyph.advance, y: -ascent },
    { x: glyph.advance, y: descent },
    { x: 0, y: descent },
  ];
  const matrix = compose(rotation(glyph.rotation ?? 0), translation(glyph.x, glyph.y));
  return applyToPoints(matrix, corners);
}

export function layoutBoundsOf(layout: TextLayout): BoundingBox {
  const quads = layout.glyphs.map((glyph) => glyphQuad(glyph, layout.ascent, layout.descent));
  return (
    boundingBoxOfMany(quads) ?? { minX: 0, minY: 0, maxX: layout.width, maxY: layout.height }
  );
}

/**
 * Bends a finished layout onto a shape.
 *
 * Each glyph is placed by its **centre**, not its left edge: measure to the
 * middle of the advance, find that point on the curve, then step back half an
 * advance along the tangent. Placing by the left edge makes wide letters lean
 * out of the curve, which is visible on any arc tight enough to be worth
 * drawing.
 *
 * A glyph's distance below the first baseline is carried along the curve's
 * normal, so descenders stay attached and a second line nests concentrically
 * inside the first.
 */
export function applyTextShape(layout: TextLayout, shape: TextShape | undefined): TextLayout {
  const baseline = baselineFor(shape, layout);
  if (!baseline) return layout;

  const place = (glyph: PlacedGlyph): PlacedGlyph => {
    const center = glyph.x + glyph.advance / 2;
    const { point, tangent } = baseline.at(center);
    const normal = normalOf(tangent);
    const offset = glyph.y - layout.ascent;
    return {
      ...glyph,
      x: point.x + normal.x * offset - (tangent.x * glyph.advance) / 2,
      y: point.y + normal.y * offset - (tangent.y * glyph.advance) / 2,
      rotation: Math.atan2(tangent.y, tangent.x),
    };
  };

  const lines: LaidOutLine[] = [];
  const glyphs: PlacedGlyph[] = [];
  for (const line of layout.lines) {
    const placed = line.glyphs.map(place);
    for (const glyph of placed) glyphs.push(glyph);
    lines.push({ ...line, glyphs: placed });
  }

  const shaped: TextLayout = { ...layout, lines, glyphs };
  return { ...shaped, bounds: layoutBoundsOf(shaped) };
}

/** Reads back the curve control for the UI, in degrees. Straight text is 0. */
export function sweepOf(shape: TextShape | undefined): number {
  return shape && shape.type === 'arc' ? shape.sweep : 0;
}
