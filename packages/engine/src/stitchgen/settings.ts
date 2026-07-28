import { mmToUnits } from '../pattern/units.js';

/**
 * Stitch parameters.
 *
 * Every length is in 0.1 mm units. The defaults are the conservative middle of
 * what works on a domestic machine with 40-weight rayon on medium-weight
 * fabric with a cutaway stabiliser — dense enough to cover, loose enough not
 * to perforate.
 */

export type StitchType = 'running' | 'bean' | 'satin' | 'fill' | 'auto';

export type UnderlayType =
  | 'none'
  | 'edge-run'
  | 'zigzag'
  | 'center-walk'
  | 'center-walk-and-zigzag'
  | 'edge-run-and-zigzag'
  | 'auto';

export interface UnderlaySettings {
  type: UnderlayType;
  /** How far inside the finished edge the underlay sits. Keeps it from peeking out. */
  inset: number;
  /** Stitch length for running-stitch underlay passes. */
  stitchLength: number;
  /** Spacing between zigzag legs. */
  zigzagSpacing: number;
  /** Row spacing for fill underlay. Much coarser than the top fill. */
  fillSpacing: number;
}

export interface StitchSettings {
  /** Nominal stitch length for running stitch and along fill rows. */
  stitchLength: number;
  /** Stitches shorter than this are merged away — they deflect the needle and snap thread. */
  minStitchLength: number;
  /** Hard cap on any single stitch, independent of the format's own limit. */
  maxStitchLength: number;

  /** Distance between fill rows. Lower is denser and stiffer. */
  fillSpacing: number;
  /** Fill direction in degrees. 0 is horizontal. */
  fillAngle: number;
  /**
   * Rows before the needle-penetration offset pattern repeats. This is what
   * makes a tatami fill look like fabric instead of a set of ridges: without
   * the stagger, every row's penetrations line up into visible channels.
   */
  staggerRepeat: number;

  /** Distance between needle penetrations along one rail of a satin column. */
  satinDensity: number;
  /** Below this width, a satin column is too narrow to be worth it — use a bean stitch. */
  minSatinWidth: number;
  /** Above this width, satin stitches are too long to stay flat — use a fill. */
  maxSatinWidth: number;

  /**
   * Widening applied to each side of a column, to counteract the fabric being
   * pulled inward by thread tension. Without it, satin comes out visibly
   * narrower than designed and gaps appear against neighbouring shapes.
   */
  pullCompensation: number;

  /** Passes for a bean stitch. Must be odd; 3 is the classic triple stitch. */
  beanRepeats: number;

  underlay: UnderlaySettings;
}

export const DEFAULT_UNDERLAY_SETTINGS: UnderlaySettings = Object.freeze({
  type: 'auto',
  inset: mmToUnits(0.5),
  stitchLength: mmToUnits(2.5),
  zigzagSpacing: mmToUnits(2.5),
  fillSpacing: mmToUnits(2),
});

export const DEFAULT_STITCH_SETTINGS: StitchSettings = Object.freeze({
  stitchLength: mmToUnits(2.5),
  minStitchLength: mmToUnits(0.6),
  maxStitchLength: mmToUnits(10),

  fillSpacing: mmToUnits(0.4),
  fillAngle: 45,
  staggerRepeat: 4,

  satinDensity: mmToUnits(0.4),
  minSatinWidth: mmToUnits(0.8),
  maxSatinWidth: mmToUnits(10),

  pullCompensation: mmToUnits(0.2),
  beanRepeats: 3,

  underlay: DEFAULT_UNDERLAY_SETTINGS,
});

export type PartialStitchSettings = Partial<Omit<StitchSettings, 'underlay'>> & {
  underlay?: Partial<UnderlaySettings>;
};

/** Fills in defaults and clamps the values that would otherwise produce nonsense. */
export function resolveStitchSettings(partial: PartialStitchSettings = {}): StitchSettings {
  const underlay: UnderlaySettings = {
    ...DEFAULT_UNDERLAY_SETTINGS,
    ...partial.underlay,
  };
  const settings: StitchSettings = {
    ...DEFAULT_STITCH_SETTINGS,
    ...partial,
    underlay,
  };

  settings.stitchLength = Math.max(1, settings.stitchLength);
  settings.minStitchLength = Math.max(0, Math.min(settings.minStitchLength, settings.stitchLength));
  settings.maxStitchLength = Math.max(settings.stitchLength, settings.maxStitchLength);
  settings.fillSpacing = Math.max(0.5, settings.fillSpacing);
  settings.satinDensity = Math.max(0.5, settings.satinDensity);
  settings.staggerRepeat = Math.max(1, Math.round(settings.staggerRepeat));
  settings.pullCompensation = Math.max(0, settings.pullCompensation);
  // An even bean count would end the run on the wrong side of the path.
  settings.beanRepeats = Math.max(1, Math.round(settings.beanRepeats) | 1);
  settings.maxSatinWidth = Math.max(settings.minSatinWidth, settings.maxSatinWidth);
  underlay.inset = Math.max(0, underlay.inset);
  underlay.stitchLength = Math.max(1, underlay.stitchLength);
  underlay.zigzagSpacing = Math.max(1, underlay.zigzagSpacing);
  underlay.fillSpacing = Math.max(1, underlay.fillSpacing);
  return settings;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
