import { boundingBoxOfMany, type BoundingBox } from './path.js';
import type { Point } from './point.js';
import {
  applyToPoint,
  applyToPoints,
  compose,
  rotateAround,
  rotation,
  scaleAround,
  type AffineMatrix,
} from './transform.js';

/**
 * The oriented box a selection is dragged by.
 *
 * Two things here are deliberate, and both come from bugs in the axis-aligned
 * version this replaces.
 *
 * **It is oriented.** A rotated layer measured with an axis-aligned box gets a
 * box larger than the layer, whose sides do not line up with anything the user
 * can see; scaling one axis of that box shears the layer, because the scale is
 * applied in document axes and the layer's are turned. Measuring in the layer's
 * own frame makes "drag the right edge" mean "make it wider" at every angle.
 *
 * **Nothing here accumulates.** Every function returns the matrix for the whole
 * gesture measured from where it started, not the delta since the last mouse
 * event. The caller snapshots the layers' transforms on pointer-down and
 * re-applies from that snapshot each move. A relative formulation has to
 * re-measure the selection between events, and re-measuring against a stale
 * bounds multiplies the error on every frame — which is how a resize drag ends
 * up accelerating away from the cursor.
 *
 * Frame space `F` and document space `D` differ by a rotation about the origin:
 * `D = rotation(angle) * F`. So a document point enters the frame through
 * `rotation(-angle)`, all the arithmetic below is plain axis-aligned work in
 * `F`, and the result goes back out through `rotation(angle)`.
 */

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

/** The eight resize handles, clockwise from the top-left. */
export const RESIZE_HANDLES: readonly HandleId[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
];

export interface SelectionFrame {
  /** Frame rotation in radians. Zero when the selection has no single angle. */
  angle: number;
  /** Bounds in the frame's own space — that is, after `rotation(-angle)`. */
  bounds: BoundingBox;
}

export interface ScaleOptions {
  /** Preserve the aspect ratio by projecting the drag onto the box diagonal. */
  lockAspect?: boolean;
  /** Pivot about the frame centre rather than the opposite handle. */
  fromCentre?: boolean;
}

export interface RotateOptions {
  /** Snap the result to a multiple of this many radians. */
  snap?: number;
}

/**
 * How far the frame must span on an axis before that axis can be scaled.
 *
 * Below this the axis is treated as having no extent and is left alone rather
 * than the whole drag being refused: a layer drawn as a horizontal line has no
 * height at all, and refusing the drag outright is what made lines permanently
 * un-resizable.
 */
const DEGENERATE = 1e-6;

/**
 * Smallest scale factor magnitude, sign preserved.
 *
 * A factor of exactly zero collapses the layer into a singular matrix that no
 * later drag can recover, so the drag stops just short of it. Passing *through*
 * zero into negative territory is allowed and is how mirroring works.
 */
const MIN_FACTOR = 0.01;

/** Wraps an angle to (-pi, pi]. */
function wrapAngle(angle: number): number {
  const turned = (((angle + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return turned - Math.PI;
}

/**
 * The angle a frame should sit at for `m`.
 *
 * `rotationOf` reads the matrix's x axis, which is right until the layer is
 * mirrored — and `scaleMatrix` deliberately permits negative factors, so
 * mirroring is a normal outcome of dragging a handle past its pivot rather than
 * an exotic case. `rotation(t)` composed with a flip gives `atan2(-sin t,
 * -cos t)`, half a turn out, and the frame then labels its own corners
 * backwards: the north-west handle draws at the visual bottom right, and every
 * cursor points the wrong way.
 *
 * A reflected matrix has two equally defensible frame angles, one per axis, and
 * no answer flatters both flips. Taking the one nearer zero means a layer that
 * was upright stays upright whichever axis it was flipped on, which is the case
 * a user can actually produce by accident.
 */
export function frameAngleOf(m: AffineMatrix): number {
  const alongX = Math.atan2(m.b, m.a);
  if (m.a * m.d - m.b * m.c >= 0) return alongX;
  const alongY = Math.atan2(-m.c, m.d);
  return Math.abs(wrapAngle(alongX)) <= Math.abs(wrapAngle(alongY)) ? alongX : alongY;
}

/** Builds a frame from geometry already in document space. */
export function selectionFrame(
  rings: readonly (readonly Point[])[],
  angle = 0,
): SelectionFrame | null {
  const toFrame = rotation(-angle);
  const bounds = boundingBoxOfMany(rings.map((ring) => applyToPoints(toFrame, ring)));
  return bounds ? { angle, bounds } : null;
}

/** The frame's centre, in frame space. */
export function frameCentre(frame: SelectionFrame): Point {
  return {
    x: (frame.bounds.minX + frame.bounds.maxX) / 2,
    y: (frame.bounds.minY + frame.bounds.maxY) / 2,
  };
}

/** The frame's centre, in document space. */
export function frameCentrePoint(frame: SelectionFrame): Point {
  return applyToPoint(rotation(frame.angle), frameCentre(frame));
}

/**
 * Fallback gap between the top edge and the rotate handle, as a fraction of the
 * frame's height.
 *
 * Callers that draw on screen should pass their own `rotateGap` in document
 * units — typically a fixed pixel distance divided by the zoom — because a gap
 * proportional to the selection puts the rotate handle on top of the box for a
 * small object, where it competes with the corner handles for the same clicks.
 * The proportional value is only a reasonable default for callers with no
 * notion of zoom.
 */
export const ROTATE_HANDLE_GAP = 0.18;

function rotateGapFor(frame: SelectionFrame, rotateGap?: number): number {
  if (rotateGap !== undefined) return rotateGap;
  const height = frame.bounds.maxY - frame.bounds.minY;
  return Math.max(height, DEGENERATE) * ROTATE_HANDLE_GAP;
}

/** Where a handle sits, in frame space. */
export function handlePointInFrame(
  frame: SelectionFrame,
  handle: HandleId,
  rotateGap?: number,
): Point {
  const { minX, minY, maxX, maxY } = frame.bounds;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  switch (handle) {
    case 'nw':
      return { x: minX, y: minY };
    case 'n':
      return { x: midX, y: minY };
    case 'ne':
      return { x: maxX, y: minY };
    case 'e':
      return { x: maxX, y: midY };
    case 'se':
      return { x: maxX, y: maxY };
    case 's':
      return { x: midX, y: maxY };
    case 'sw':
      return { x: minX, y: maxY };
    case 'w':
      return { x: minX, y: midY };
    case 'rotate':
      return { x: midX, y: minY - rotateGapFor(frame, rotateGap) };
  }
}

/** Where a handle sits, in document space. */
export function handlePoint(
  frame: SelectionFrame,
  handle: HandleId,
  rotateGap?: number,
): Point {
  return applyToPoint(rotation(frame.angle), handlePointInFrame(frame, handle, rotateGap));
}

/**
 * The handle under a document-space point, or `null`.
 *
 * Corners are tested before the edges that meet them, because on a small
 * selection a corner and its two adjacent edge handles all fall within one
 * tolerance of each other and the corner would otherwise be unreachable.
 * Rotate comes last for the same reason in reverse: it lives outside the box,
 * so it only ever wins where nothing else is competing.
 */
export function handleAtPoint(
  frame: SelectionFrame,
  point: Point,
  tolerance: number,
  rotateGap?: number,
): HandleId | null {
  const order: HandleId[] = ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w', 'rotate'];
  for (const handle of order) {
    const at = handlePoint(frame, handle, rotateGap);
    if (Math.abs(at.x - point.x) <= tolerance && Math.abs(at.y - point.y) <= tolerance) {
      return handle;
    }
  }
  return null;
}

/** The handle a scale drag pivots about — the one diagonally opposite. */
export function oppositeHandle(handle: HandleId): HandleId {
  switch (handle) {
    case 'nw':
      return 'se';
    case 'n':
      return 's';
    case 'ne':
      return 'sw';
    case 'e':
      return 'w';
    case 'se':
      return 'nw';
    case 's':
      return 'n';
    case 'sw':
      return 'ne';
    case 'w':
      return 'e';
    case 'rotate':
      return 's';
  }
}

/** Which axes a handle is allowed to change. */
function axesFor(handle: HandleId): { x: boolean; y: boolean } {
  switch (handle) {
    case 'n':
    case 's':
      return { x: false, y: true };
    case 'e':
    case 'w':
      return { x: true, y: false };
    default:
      return { x: true, y: true };
  }
}

function clampFactor(value: number): number {
  if (!Number.isFinite(value)) return 1;
  if (Math.abs(value) >= MIN_FACTOR) return value;
  return value < 0 ? -MIN_FACTOR : MIN_FACTOR;
}

/**
 * The matrix for a scale drag, measured from the frame the gesture started in.
 *
 * `pointer` is in document space and is the *current* pointer position, not a
 * delta — call this with the raw position on every move and apply the result to
 * the pointer-down snapshot.
 */
export function scaleMatrix(
  frame: SelectionFrame,
  handle: HandleId,
  pointer: Point,
  options: ScaleOptions = {},
): AffineMatrix {
  const pointerF = applyToPoint(rotation(-frame.angle), pointer);
  const grabbed = handlePointInFrame(frame, handle);
  const pivot = options.fromCentre
    ? frameCentre(frame)
    : handlePointInFrame(frame, oppositeHandle(handle));

  const spanX = grabbed.x - pivot.x;
  const spanY = grabbed.y - pivot.y;
  const axes = axesFor(handle);

  // A degenerate axis has no span to divide by, so it simply does not scale.
  const canX = axes.x && Math.abs(spanX) > DEGENERATE;
  const canY = axes.y && Math.abs(spanY) > DEGENERATE;

  let fx = canX ? (pointerF.x - pivot.x) / spanX : 1;
  let fy = canY ? (pointerF.y - pivot.y) / spanY : 1;

  if (options.lockAspect && canX && canY) {
    /*
     * Project the drag onto the diagonal from pivot to grabbed handle.
     *
     * The obvious `Math.max(fx, fy)` is wrong in a way that is easy to miss: it
     * makes the box chase the cursor on whichever axis happens to be winning,
     * so dragging a corner straight sideways also grows the box downwards. It
     * is also discontinuous where the two factors cross, which shows up as the
     * shape twitching whenever the pointer nears the diagonal.
     */
    const scale =
      ((pointerF.x - pivot.x) * spanX + (pointerF.y - pivot.y) * spanY) /
      (spanX * spanX + spanY * spanY);
    fx = scale;
    fy = scale;
  }

  const scaleF = scaleAround(clampFactor(fx), clampFactor(fy), pivot);
  return compose(rotation(-frame.angle), scaleF, rotation(frame.angle));
}

/** The angle a rotate drag has swept, before snapping. */
export function rotateAngle(frame: SelectionFrame, from: Point, to: Point): number {
  const centre = frameCentrePoint(frame);
  return (
    Math.atan2(to.y - centre.y, to.x - centre.x) -
    Math.atan2(from.y - centre.y, from.x - centre.x)
  );
}

/**
 * The matrix for a rotate drag, measured from where the gesture started.
 *
 * `snap` is applied to the frame's resulting absolute angle rather than to the
 * swept delta, so holding the modifier lands on true multiples of the step
 * regardless of where the object already sat.
 */
export function rotateMatrix(
  frame: SelectionFrame,
  from: Point,
  to: Point,
  options: RotateOptions = {},
): AffineMatrix {
  let delta = rotateAngle(frame, from, to);
  if (options.snap && options.snap > 0) {
    const absolute = frame.angle + delta;
    delta = Math.round(absolute / options.snap) * options.snap - frame.angle;
  }
  return rotateAround(delta, frameCentrePoint(frame));
}

const RESIZE_CURSORS = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];

/** The compass direction a handle points, in eighths of a turn clockwise from north. */
function handleOctant(handle: HandleId): number {
  switch (handle) {
    case 'n':
      return 0;
    case 'ne':
      return 1;
    case 'e':
      return 2;
    case 'se':
      return 3;
    case 's':
      return 4;
    case 'sw':
      return 5;
    case 'w':
      return 6;
    case 'nw':
      return 7;
    case 'rotate':
      return 0;
  }
}

/**
 * The CSS cursor for a handle, turned with the frame.
 *
 * There are only four resize cursors for eight handles, and each covers two
 * opposite directions — so the octant is taken modulo four after the frame's
 * rotation is folded in. Without this a rotated object shows a cursor
 * disagreeing with the direction the edge actually runs.
 */
export function cursorFor(frame: SelectionFrame, handle: HandleId): string {
  if (handle === 'rotate') return 'grab';
  const turns = frame.angle / (Math.PI / 4);
  const octant = Math.round(handleOctant(handle) + turns);
  return RESIZE_CURSORS[((octant % 4) + 4) % 4];
}
