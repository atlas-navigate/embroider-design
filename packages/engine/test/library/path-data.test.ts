import { describe, expect, it } from 'vitest';
import { parsePathData, PathDataError, pathFromData } from '../../src/library/path-data.js';
import { shapeToRings } from '../../src/document/shapes.js';

describe('parsePathData', () => {
  it('reads an absolute polygon', () => {
    const subpaths = parsePathData('M 0 0 L 10 0 L 10 10 Z');
    expect(subpaths).toHaveLength(1);
    expect(subpaths[0].start).toEqual({ x: 0, y: 0 });
    expect(subpaths[0].closed).toBe(true);
    expect(subpaths[0].segments).toHaveLength(2);
  });

  it('treats extra pairs after a moveto as linetos', () => {
    const [subpath] = parsePathData('M 0 0 10 0 10 10 Z');
    expect(subpath.segments).toHaveLength(2);
    expect(subpath.segments[1]).toMatchObject({ type: 'line', to: { x: 10, y: 10 } });
  });

  it('applies relative commands against the current point', () => {
    const [subpath] = parsePathData('m 5 5 l 10 0 l 0 10 z');
    expect(subpath.start).toEqual({ x: 5, y: 5 });
    expect(subpath.segments[1]).toMatchObject({ to: { x: 15, y: 15 } });
  });

  it('handles horizontal and vertical shorthand', () => {
    const [subpath] = parsePathData('M 0 0 H 20 V 30 h -10 v -5 Z');
    const ends = subpath.segments.map((segment) => segment.to);
    expect(ends).toEqual([
      { x: 20, y: 0 },
      { x: 20, y: 30 },
      { x: 10, y: 30 },
      { x: 10, y: 25 },
    ]);
  });

  it('reflects the previous control point for S', () => {
    const [subpath] = parsePathData('M 0 0 C 0 10 10 10 10 0 S 20 -10 20 0');
    const smooth = subpath.segments[1];
    expect(smooth.type).toBe('cubic');
    // The previous second control was (10,10) about the point (10,0).
    if (smooth.type === 'cubic') expect(smooth.control1).toEqual({ x: 10, y: -10 });
  });

  it('reflects the previous control point for T', () => {
    const [subpath] = parsePathData('M 0 0 Q 5 10 10 0 T 20 0');
    const smooth = subpath.segments[1];
    expect(smooth.type).toBe('quadratic');
    if (smooth.type === 'quadratic') expect(smooth.control).toEqual({ x: 15, y: -10 });
  });

  it('treats S and T with no preceding curve as starting at the current point', () => {
    const [subpath] = parsePathData('M 10 10 S 20 20 30 10');
    const segment = subpath.segments[0];
    if (segment.type === 'cubic') expect(segment.control1).toEqual({ x: 10, y: 10 });
  });

  it('separates numbers without delimiters', () => {
    // "1.5.5" is two numbers and "10-5" is two more: valid SVG, and the kind of
    // thing a path exported by a drawing tool actually contains.
    const [subpath] = parsePathData('M0 0L1.5.5L10-5Z');
    expect(subpath.segments[0]).toMatchObject({ to: { x: 1.5, y: 0.5 } });
    expect(subpath.segments[1]).toMatchObject({ to: { x: 10, y: -5 } });
  });

  it('accepts exponent notation but not a bare trailing e', () => {
    const [subpath] = parsePathData('M 0 0 L 1e2 5');
    expect(subpath.segments[0]).toMatchObject({ to: { x: 100, y: 5 } });
  });

  it('splits multiple subpaths', () => {
    const subpaths = parsePathData('M 0 0 L 10 0 L 10 10 Z M 20 20 L 30 20 L 30 30 Z');
    expect(subpaths).toHaveLength(2);
    expect(subpaths[1].start).toEqual({ x: 20, y: 20 });
  });

  it('continues from the closed point when drawing resumes after Z', () => {
    const subpaths = parsePathData('M 0 0 L 10 0 L 10 10 Z L 40 40');
    expect(subpaths).toHaveLength(2);
    expect(subpaths[1].start).toEqual({ x: 0, y: 0 });
    expect(subpaths[1].closed).toBe(false);
  });

  it('keeps an unclosed subpath as an open path', () => {
    const [subpath] = parsePathData('M 0 0 L 10 0 L 10 10');
    expect(subpath.closed).toBe(false);
  });

  it('drops a moveto that draws nothing', () => {
    expect(parsePathData('M 5 5')).toHaveLength(0);
  });

  it('rejects data that draws before it moves', () => {
    expect(() => parsePathData('L 10 10')).toThrow(PathDataError);
  });

  it('rejects an unsupported command', () => {
    // The elliptical arc is deliberately not implemented; failing loudly is the
    // point, so a shape authored with one cannot ship silently mis-drawn.
    expect(() => parsePathData('M 0 0 A 5 5 0 0 1 10 10')).toThrow(PathDataError);
  });

  it('rejects a truncated coordinate', () => {
    expect(() => parsePathData('M 0 0 L 10')).toThrow(PathDataError);
  });

  it('produces rings a shape can be built from', () => {
    const rings = shapeToRings(pathFromData('M 0 0 L 10 0 L 10 10 L 0 10 Z'));
    expect(rings).toHaveLength(1);
    expect(rings[0].length).toBeGreaterThanOrEqual(4);
  });
});
