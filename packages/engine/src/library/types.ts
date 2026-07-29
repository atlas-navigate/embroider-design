import type { StitchType } from '../stitchgen/settings.js';

/**
 * The shape and icon catalogue's data model.
 *
 * Types live apart from the catalogue itself so the data modules can import
 * them without importing the registry that imports the data modules.
 */

export type CategoryId =
  // PowerPoint-style drawing shapes.
  | 'basic'
  | 'arrows'
  | 'stars-banners'
  | 'callouts'
  | 'flowchart'
  | 'equation'
  // Seasonal and thematic icons.
  | 'halloween'
  | 'christmas'
  | 'valentine'
  | 'wedding'
  | 'easter'
  | 'thanksgiving'
  | 'patriotic'
  | 'birthday'
  | 'summer'
  | 'school'
  | 'pets'
  | 'nautical'
  | 'nature';

export interface ShapeCategory {
  id: CategoryId;
  name: string;
  /** Which half of the browser it belongs in. */
  group: 'shapes' | 'icons';
}

export const CATEGORIES: readonly ShapeCategory[] = [
  { id: 'basic', name: 'Basic shapes', group: 'shapes' },
  { id: 'arrows', name: 'Arrows', group: 'shapes' },
  { id: 'stars-banners', name: 'Stars & banners', group: 'shapes' },
  { id: 'callouts', name: 'Callouts', group: 'shapes' },
  { id: 'flowchart', name: 'Flowchart', group: 'shapes' },
  { id: 'equation', name: 'Equation', group: 'shapes' },
  { id: 'halloween', name: 'Halloween', group: 'icons' },
  { id: 'christmas', name: 'Christmas', group: 'icons' },
  { id: 'valentine', name: "Valentine's", group: 'icons' },
  { id: 'wedding', name: 'Wedding', group: 'icons' },
  { id: 'easter', name: 'Easter & spring', group: 'icons' },
  { id: 'thanksgiving', name: 'Autumn & Thanksgiving', group: 'icons' },
  { id: 'patriotic', name: 'Patriotic', group: 'icons' },
  { id: 'birthday', name: 'Birthday', group: 'icons' },
  { id: 'summer', name: 'Summer & beach', group: 'icons' },
  { id: 'school', name: 'School', group: 'icons' },
  { id: 'pets', name: 'Pets', group: 'icons' },
  { id: 'nautical', name: 'Nautical', group: 'icons' },
  { id: 'nature', name: 'Nature', group: 'icons' },
];

/**
 * One piece of a shape, which becomes one layer.
 *
 * A part is the unit of colour, because in embroidery colour *is* a separate
 * pass of the machine. A snowman's hat cannot be "the same shape in a different
 * colour" — it is its own run of stitches, and the user needs to be able to
 * reorder or recolour it.
 *
 * Holes belong inside a part, not as separate parts: a counter-ring in the same
 * `d` string is picked up by `groupRingsIntoRegions`, which already understands
 * nesting, so a donut stitches as a ring rather than as a filled disc with a
 * disc on top.
 */
export interface LibraryPart {
  name: string;
  /** SVG path data in the 0-100 authoring box. */
  d: string;
  /** `#rrggbb`. Omitted parts fall back to the layer's default palette colour. */
  color?: string;
  stitchType?: StitchType;
}

export interface LibraryShape {
  /** Stable and unique across the whole catalogue; saved in project files. */
  id: string;
  name: string;
  category: CategoryId;
  /** Extra search terms, so "jack o lantern" also finds the pumpkin. */
  keywords?: string[];
  /** Sewn back to front: the first part is stitched first. */
  parts: LibraryPart[];
}

/**
 * Shapes are authored inside a 100 x 100 box.
 *
 * Nothing enforces that a shape fills it — a tall shape uses the full height
 * and less of the width — but staying inside it is what lets the placement code
 * scale every shape by the same rule.
 */
export const AUTHORING_BOX = 100;
