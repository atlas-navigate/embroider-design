/**
 * The machine command vocabulary.
 *
 * Modelled as a frozen object plus a union type rather than a TypeScript
 * `enum`: the values stay plain strings, so they survive JSON round-trips in
 * saved projects and IPC messages without a lookup table, and they read
 * clearly in a debugger or a failing test diff.
 */
export const StitchCommand = {
  /** Needle down at this position — an actual stitch. */
  STITCH: 'STITCH',
  /** Move without sewing. Machines with auto-trim may trim across long jumps. */
  JUMP: 'JUMP',
  /** Cut the thread. Not supported by every format; writers degrade gracefully. */
  TRIM: 'TRIM',
  /** End of a colour block — the machine pauses for a thread change. */
  COLOR_CHANGE: 'COLOR_CHANGE',
  /** Pause without a colour change (appliqué placement, manual intervention). */
  STOP: 'STOP',
  /** Eject a sequin at this position. Degrades to a plain stitch where unsupported. */
  SEQUIN: 'SEQUIN',
  /** End of pattern. Always the final entry once a pattern is normalised. */
  END: 'END',
} as const;

export type StitchCommand = (typeof StitchCommand)[keyof typeof StitchCommand];

export const ALL_STITCH_COMMANDS: readonly StitchCommand[] = Object.freeze(
  Object.values(StitchCommand),
);

/**
 * One entry in a pattern's stitch list.
 *
 * Coordinates are **absolute**, in 0.1 mm units, in the design's Y-down
 * (screen) orientation. Relative encoding and the Y flip that machine formats
 * expect both happen once, in `toDeltaEncoding`.
 *
 * Control commands (`TRIM`, `COLOR_CHANGE`, `STOP`, `END`) still carry a
 * position: the position the needle is already at. This keeps the list
 * uniform, so bounds, transforms, and the preview renderer never need to
 * special-case them.
 */
export interface StitchPoint {
  x: number;
  y: number;
  command: StitchCommand;
}

export function stitchPoint(
  x: number,
  y: number,
  command: StitchCommand = StitchCommand.STITCH,
): StitchPoint {
  return { x, y, command };
}

/** True for commands that move the needle to a new position. */
export function isMovementCommand(command: StitchCommand): boolean {
  return (
    command === StitchCommand.STITCH ||
    command === StitchCommand.JUMP ||
    command === StitchCommand.SEQUIN
  );
}

/** True for commands that instruct the machine rather than move the needle. */
export function isControlCommand(command: StitchCommand): boolean {
  return !isMovementCommand(command);
}

/** True for commands that lay thread (used for thread-length statistics). */
export function isSewingCommand(command: StitchCommand): boolean {
  return command === StitchCommand.STITCH || command === StitchCommand.SEQUIN;
}

export function isBlockBoundary(command: StitchCommand): boolean {
  return command === StitchCommand.COLOR_CHANGE || command === StitchCommand.END;
}
