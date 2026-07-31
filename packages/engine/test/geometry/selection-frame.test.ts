import { describe, expect, it } from 'vitest';
import {
  cursorFor,
  frameAngleOf,
  frameCentrePoint,
  handleAtPoint,
  handlePoint,
  RESIZE_HANDLES,
  rotateMatrix,
  scaleMatrix,
  selectionFrame,
  type SelectionFrame,
} from '../../src/geometry/selection-frame.js';
import {
  applyToPoint,
  compose,
  determinant,
  invert,
  rotation,
  rotationOf,
  scaleFactorX,
  scaleFactorY,
  scaling,
  identity,
  type AffineMatrix,
} from '../../src/geometry/transform.js';

/**
 * These are regression tests before they are unit tests.
 *
 * Every case below names a defect the axis-aligned, incremental version of this
 * code actually shipped with: a resize that accelerated away from the cursor, a
 * corner drag that moved diagonally when the pointer moved sideways, edges that
 * could not be grabbed at all, and lines that could not be resized. The point of
 * pinning them here rather than testing in the app is that `packages/app` has no
 * test harness, and this is the maths that broke.
 */

/** A 100x60 box at the origin, unrotated. */
const BOX: SelectionFrame = {
  angle: 0,
  bounds: { minX: 0, minY: 0, maxX: 100, maxY: 60 },
};

function tilted(angle: number): SelectionFrame {
  return { angle, bounds: BOX.bounds };
}

/** Width and height of the frame after `m` is applied, measured in frame space. */
function extentAfter(frame: SelectionFrame, m: AffineMatrix): { width: number; height: number } {
  const toFrame = rotation(-frame.angle);
  const corners = [
    { x: frame.bounds.minX, y: frame.bounds.minY },
    { x: frame.bounds.maxX, y: frame.bounds.minY },
    { x: frame.bounds.maxX, y: frame.bounds.maxY },
    { x: frame.bounds.minX, y: frame.bounds.maxY },
  ]
    .map((p) => applyToPoint(rotation(frame.angle), p))
    .map((p) => applyToPoint(m, p))
    .map((p) => applyToPoint(toFrame, p));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

describe('selectionFrame', () => {
  it('measures an unrotated selection as its axis-aligned bounds', () => {
    const frame = selectionFrame([
      [
        { x: 10, y: 20 },
        { x: 40, y: 20 },
        { x: 40, y: 50 },
      ],
    ]);
    expect(frame?.bounds).toEqual({ minX: 10, minY: 20, maxX: 40, maxY: 50 });
  });

  it('measures a rotated selection in its own frame, not an inflated box', () => {
    // A 40x20 rectangle turned 90 degrees. Measured axis-aligned it is 20x40;
    // measured in its own frame it is still 40x20, which is what the handles
    // have to reflect for "drag the right edge" to mean "make it wider".
    const angle = Math.PI / 2;
    const turn = rotation(angle);
    const rect = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 20 },
      { x: 0, y: 20 },
    ].map((p) => applyToPoint(turn, p));

    const frame = selectionFrame([rect], angle);
    expect(frame).not.toBeNull();
    if (!frame) return;
    expect(frame.bounds.maxX - frame.bounds.minX).toBeCloseTo(40, 9);
    expect(frame.bounds.maxY - frame.bounds.minY).toBeCloseTo(20, 9);
  });

  it('returns null for an empty selection', () => {
    expect(selectionFrame([])).toBeNull();
  });
});

describe('handles', () => {
  it('places all nine handles, with rotate clear of the top edge', () => {
    expect(handlePoint(BOX, 'nw')).toEqual({ x: 0, y: 0 });
    expect(handlePoint(BOX, 'se')).toEqual({ x: 100, y: 60 });
    expect(handlePoint(BOX, 'n')).toEqual({ x: 50, y: 0 });
    expect(handlePoint(BOX, 'e')).toEqual({ x: 100, y: 30 });
    expect(handlePoint(BOX, 'rotate').x).toBeCloseTo(50, 9);
    expect(handlePoint(BOX, 'rotate').y).toBeLessThan(0);
  });

  it('turns the handles with the frame', () => {
    const frame = tilted(Math.PI / 2);
    // The east handle of a frame turned a quarter turn points south.
    const e = handlePoint(frame, 'e');
    expect(e.x).toBeCloseTo(-30, 9);
    expect(e.y).toBeCloseTo(100, 9);
  });

  it('finds a handle under the pointer', () => {
    expect(handleAtPoint(BOX, { x: 101, y: 61 }, 4)).toBe('se');
    expect(handleAtPoint(BOX, { x: 50, y: 60 }, 4)).toBe('s');
    expect(handleAtPoint(BOX, { x: 50, y: 30 }, 4)).toBeNull();
  });

  it('prefers a corner over the edges that meet there', () => {
    // On a short frame the corner and both adjacent edge handles fall within
    // one tolerance of each other; the corner has to win or a corner can never
    // be grabbed.
    const squat: SelectionFrame = { angle: 0, bounds: { minX: 0, minY: 0, maxX: 12, maxY: 12 } };
    expect(handleAtPoint(squat, { x: 0, y: 0 }, 8)).toBe('nw');
  });

  it('holds the rotate handle at the gap the caller asks for', () => {
    /*
     * The default gap is a fraction of the frame's height, which puts the
     * rotate handle inside the corner handles' grab zone once the selection is
     * small — it would steal clicks meant for the corner. A caller drawing on
     * screen passes a fixed distance instead, and that has to be honoured.
     */
    const squat: SelectionFrame = { angle: 0, bounds: { minX: 0, minY: 0, maxX: 12, maxY: 12 } };
    expect(handlePoint(squat, 'rotate', 40)).toEqual({ x: 6, y: -40 });
    expect(handleAtPoint(squat, { x: 6, y: -40 }, 8, 40)).toBe('rotate');
    // Far enough out that the corners are unaffected.
    expect(handleAtPoint(squat, { x: 0, y: 0 }, 8, 40)).toBe('nw');
  });
});

describe('scaleMatrix', () => {
  it('does not compound when applied repeatedly from the same snapshot', () => {
    /*
     * The defect this pins: the old drag re-measured the selection between
     * pointer events and applied a *relative* factor, so the same pointer
     * position produced a different result each frame and the error multiplied
     * at frame rate. Here the same pointer must give the same matrix however
     * many times it is asked for.
     */
    const pointer = { x: 150, y: 90 };
    const first = scaleMatrix(BOX, 'se', pointer);
    for (let i = 0; i < 100; i++) {
      const again = scaleMatrix(BOX, 'se', pointer);
      expect(again).toEqual(first);
    }
    // And it is the honest answer: the grabbed corner lands under the pointer.
    expect(applyToPoint(first, { x: 100, y: 60 })).toEqual(pointer);
  });

  it('puts the grabbed corner exactly under the pointer', () => {
    for (const pointer of [
      { x: 200, y: 200 },
      { x: 20, y: 15 },
      { x: 137.5, y: 3.25 },
    ]) {
      const m = scaleMatrix(BOX, 'se', pointer);
      const moved = applyToPoint(m, { x: 100, y: 60 });
      expect(moved.x).toBeCloseTo(pointer.x, 9);
      expect(moved.y).toBeCloseTo(pointer.y, 9);
    }
  });

  it('leaves the pivot corner where it was', () => {
    const m = scaleMatrix(BOX, 'se', { x: 250, y: 250 });
    const pivot = applyToPoint(m, { x: 0, y: 0 });
    expect(pivot.x).toBeCloseTo(0, 9);
    expect(pivot.y).toBeCloseTo(0, 9);
  });

  it('changes one axis only for an edge handle', () => {
    // The "it only sizes diagonal" complaint: there were no edge handles at all.
    const east = extentAfter(BOX, scaleMatrix(BOX, 'e', { x: 200, y: 400 }));
    expect(east.width).toBeCloseTo(200, 9);
    expect(east.height).toBeCloseTo(60, 9);

    const north = extentAfter(BOX, scaleMatrix(BOX, 'n', { x: 400, y: -60 }));
    expect(north.width).toBeCloseTo(100, 9);
    expect(north.height).toBeCloseTo(120, 9);
  });

  it('does not drift diagonally when a corner is dragged straight sideways', () => {
    /*
     * `Math.max(scaleX, scaleY)` made the box chase the cursor on whichever
     * axis was winning, so a purely horizontal drag also grew the height. Free
     * scaling must leave the untouched axis alone.
     */
    const m = scaleMatrix(BOX, 'se', { x: 200, y: 60 });
    const after = extentAfter(BOX, m);
    expect(after.width).toBeCloseTo(200, 9);
    expect(after.height).toBeCloseTo(60, 9);
  });

  it('locks the aspect ratio smoothly through the diagonal', () => {
    /*
     * The old aspect lock was discontinuous where the two factors crossed,
     * which the user saw as the shape twitching. Sweeping the pointer across
     * the diagonal must give a monotonic, continuous factor.
     */
    const widths: number[] = [];
    for (let t = 0; t <= 20; t++) {
      const pointer = { x: 100 + t * 5, y: 60 + t * 3 };
      const m = scaleMatrix(BOX, 'se', pointer, { lockAspect: true });
      const after = extentAfter(BOX, m);
      // Aspect held: a 100x60 box stays 5:3 at every step.
      expect(after.width / after.height).toBeCloseTo(100 / 60, 9);
      widths.push(after.width);
    }
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1]);
      // No jump: the step between samples stays near the first one's size.
      expect(Math.abs(widths[i] - widths[i - 1])).toBeLessThan(widths[1] - widths[0] + 1e-6);
    }
  });

  it('scales about the centre when asked', () => {
    const m = scaleMatrix(BOX, 'se', { x: 150, y: 90 }, { fromCentre: true });
    const centre = applyToPoint(m, { x: 50, y: 30 });
    expect(centre.x).toBeCloseTo(50, 9);
    expect(centre.y).toBeCloseTo(30, 9);
  });

  it('mirrors when dragged past the pivot, and stays invertible', () => {
    const m = scaleMatrix(BOX, 'se', { x: -100, y: 60 });
    expect(determinant(m)).toBeLessThan(0);
    expect(invert(m)).not.toBeNull();
    // Dragging back the other side un-mirrors it: nothing was destroyed.
    const back = scaleMatrix(BOX, 'se', { x: 100, y: 60 });
    expect(back.a).toBeCloseTo(1, 9);
    expect(back.d).toBeCloseTo(1, 9);
  });

  it('never produces a singular matrix, even at the pivot', () => {
    const m = scaleMatrix(BOX, 'se', { x: 0, y: 0 });
    expect(invert(m)).not.toBeNull();
  });

  it('still scales the good axis of a degenerate frame', () => {
    // A horizontal line has no height. The old code refused the whole drag,
    // which made lines permanently un-resizable.
    const line: SelectionFrame = { angle: 0, bounds: { minX: 0, minY: 30, maxX: 100, maxY: 30 } };
    const m = scaleMatrix(line, 'se', { x: 200, y: 30 });
    expect(applyToPoint(m, { x: 100, y: 30 }).x).toBeCloseTo(200, 9);
    expect(invert(m)).not.toBeNull();
  });

  it('scales a rotated frame along its own axes without shearing', () => {
    /*
     * The whole reason the frame is oriented. Widening a layer turned 30
     * degrees must widen it, not skew it: the rotation and the perpendicular
     * scale both have to come out unchanged.
     */
    const angle = Math.PI / 6;
    const frame = tilted(angle);
    const grabbed = handlePoint(frame, 'e');
    // Push the east handle 50 further along the frame's own x axis.
    const along = applyToPoint(rotation(angle), { x: 1, y: 0 });
    const pointer = { x: grabbed.x + along.x * 50, y: grabbed.y + along.y * 50 };

    const m = scaleMatrix(frame, 'e', pointer);
    const composed = compose(rotation(angle), m);
    expect(rotationOf(composed)).toBeCloseTo(angle, 9);
    expect(scaleFactorY(composed)).toBeCloseTo(1, 9);
    expect(scaleFactorX(composed)).toBeCloseTo(1.5, 9);
  });

  it('keeps the edge-handle contract at every frame angle', () => {
    for (const angle of [0, 0.3, Math.PI / 4, 1.9, -2.2]) {
      const frame = tilted(angle);
      const grabbed = handlePoint(frame, 'e');
      const along = applyToPoint(rotation(angle), { x: 1, y: 0 });
      const pointer = { x: grabbed.x + along.x * 100, y: grabbed.y + along.y * 100 };
      const after = extentAfter(frame, scaleMatrix(frame, 'e', pointer));
      expect(after.width).toBeCloseTo(200, 6);
      expect(after.height).toBeCloseTo(60, 6);
    }
  });
});

describe('rotateMatrix', () => {
  it('sweeps the angle the pointer swept, about the frame centre', () => {
    const centre = frameCentrePoint(BOX);
    const from = { x: centre.x + 50, y: centre.y };
    const to = { x: centre.x, y: centre.y + 50 };
    const m = rotateMatrix(BOX, from, to);
    expect(rotationOf(m)).toBeCloseTo(Math.PI / 2, 9);
    // The centre is the pivot, so it does not move.
    const moved = applyToPoint(m, centre);
    expect(moved.x).toBeCloseTo(centre.x, 9);
    expect(moved.y).toBeCloseTo(centre.y, 9);
  });

  it('returns to the original transform after a there-and-back rotation', () => {
    const centre = frameCentrePoint(BOX);
    const from = { x: centre.x + 50, y: centre.y };
    const via = { x: centre.x, y: centre.y + 50 };
    const round = compose(rotateMatrix(BOX, from, via), rotateMatrix(BOX, via, from));
    const start = identity();
    for (const key of ['a', 'b', 'c', 'd', 'e', 'f'] as const) {
      expect(round[key]).toBeCloseTo(start[key], 9);
    }
  });

  it('does not compound when applied repeatedly from the same snapshot', () => {
    const centre = frameCentrePoint(BOX);
    const from = { x: centre.x + 50, y: centre.y };
    const to = { x: centre.x + 40, y: centre.y + 30 };
    const first = rotateMatrix(BOX, from, to);
    for (let i = 0; i < 50; i++) {
      expect(rotateMatrix(BOX, from, to)).toEqual(first);
    }
  });

  it('snaps to absolute multiples of the step, not to multiples of the sweep', () => {
    const step = Math.PI / 12; // 15 degrees
    // A frame already sitting at 10 degrees, nudged by 4 more.
    const frame = tilted((10 * Math.PI) / 180);
    const centre = frameCentrePoint(frame);
    const from = { x: centre.x + 50, y: centre.y };
    const nudge = (4 * Math.PI) / 180;
    const to = {
      x: centre.x + Math.cos(nudge) * 50,
      y: centre.y + Math.sin(nudge) * 50,
    };
    const m = rotateMatrix(frame, from, to, { snap: step });
    // 10 + 4 = 14 degrees, which snaps to 15 — so the delta is +5, not 0.
    expect(frame.angle + rotationOf(m)).toBeCloseTo(step, 9);
  });
});

describe('cursorFor', () => {
  it('names the four resize cursors for an upright frame', () => {
    expect(cursorFor(BOX, 'n')).toBe('ns-resize');
    expect(cursorFor(BOX, 's')).toBe('ns-resize');
    expect(cursorFor(BOX, 'e')).toBe('ew-resize');
    expect(cursorFor(BOX, 'nw')).toBe('nwse-resize');
    expect(cursorFor(BOX, 'ne')).toBe('nesw-resize');
    expect(cursorFor(BOX, 'rotate')).toBe('grab');
  });

  it('turns the cursor with the frame', () => {
    // A quarter turn swaps the two axis cursors: what was the top edge now
    // faces east, so it must offer a horizontal resize.
    const frame = tilted(Math.PI / 2);
    expect(cursorFor(frame, 'n')).toBe('ew-resize');
    expect(cursorFor(frame, 'e')).toBe('ns-resize');
  });
});

describe('frameAngleOf', () => {
  /*
   * `scaleMatrix` deliberately permits negative factors, so a user mirrors a
   * layer simply by dragging a handle past its pivot — an everyday accident,
   * not an exotic case. `rotationOf` reads only the matrix's x axis and comes
   * back half a turn out for those, which used to leave the frame labelling its
   * own corners backwards.
   */
  it('reports no rotation for a layer mirrored on either axis', () => {
    expect(frameAngleOf(scaling(-1, 1))).toBeCloseTo(0, 9);
    expect(frameAngleOf(scaling(1, -1))).toBeCloseTo(0, 9);
  });

  it('agrees with rotationOf whenever the matrix is not reflected', () => {
    for (const angle of [0, 0.4, -0.9, Math.PI / 2, 2.5]) {
      const m = compose(rotation(angle), scaling(2, 3));
      expect(frameAngleOf(m)).toBeCloseTo(rotationOf(m), 9);
    }
  });

  it('keeps the rotation of a layer that was rotated and then mirrored', () => {
    const m = compose(scaling(-1, 1), rotation(0.4));
    expect(rotationOf(m)).not.toBeCloseTo(0.4, 3); // the bug this replaces
    expect(frameAngleOf(m)).toBeCloseTo(0.4, 9);
  });

  it('puts the north-west handle at the visual top-left of a mirrored frame', () => {
    // The user-visible symptom: mirror a layer and the handles swap corners.
    const mirrored = compose(scaling(-1, 1), rotation(0));
    const frame = selectionFrame(
      [
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 60 },
          { x: 0, y: 60 },
        ].map((p) => applyToPoint(mirrored, p)),
      ],
      frameAngleOf(mirrored),
    );
    expect(frame).not.toBeNull();
    if (!frame) return;
    const nw = handlePoint(frame, 'nw');
    const se = handlePoint(frame, 'se');
    expect(nw.x).toBeLessThan(se.x);
    expect(nw.y).toBeLessThan(se.y);
  });
});

describe('a handle dragged to where it already is', () => {
  /*
   * The general form of "typing the width already shown must not resize".
   *
   * It is also the strongest guard against the whole family of accumulating-drag
   * bugs: if grabbing a handle and not moving it is not the identity, then every
   * pointer event during a real drag carries that same error, and fifty of them
   * a second is what made resizing accelerate away from the cursor.
   */
  it('is the identity, for every handle at every angle', () => {
    for (const angle of [0, 0.3, -0.7, Math.PI / 4, Math.PI / 2, 2.2]) {
      const frame = tilted(angle);
      for (const handle of RESIZE_HANDLES) {
        const m = scaleMatrix(frame, handle, handlePoint(frame, handle));
        const start = identity();
        for (const key of ['a', 'b', 'c', 'd', 'e', 'f'] as const) {
          expect(m[key], `${handle} at ${angle}`).toBeCloseTo(start[key], 9);
        }
      }
    }
  });

  it('is still the identity with the aspect locked or pivoting on the centre', () => {
    const frame = tilted(0.6);
    for (const handle of RESIZE_HANDLES) {
      for (const options of [{ lockAspect: true }, { fromCentre: true }]) {
        const m = scaleMatrix(frame, handle, handlePoint(frame, handle), options);
        const start = identity();
        for (const key of ['a', 'b', 'c', 'd', 'e', 'f'] as const) {
          expect(m[key], `${handle} ${JSON.stringify(options)}`).toBeCloseTo(start[key], 9);
        }
      }
    }
  });
});
