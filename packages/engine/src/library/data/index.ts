import type { LibraryShape } from '../types.js';
import { BASIC_SHAPES } from './basic.js';
import { ARROW_SHAPES } from './arrows.js';
import { STAR_BANNER_SHAPES } from './stars-banners.js';
import { CALLOUT_SHAPES } from './callouts.js';
import { FLOWCHART_SHAPES } from './flowchart.js';
import { EQUATION_SHAPES } from './equation.js';
import { HALLOWEEN_SHAPES } from './halloween.js';
import { CHRISTMAS_SHAPES } from './christmas.js';
import { VALENTINE_SHAPES } from './valentine.js';
import { WEDDING_SHAPES } from './wedding.js';
import { EASTER_SHAPES } from './easter.js';
import { THANKSGIVING_SHAPES } from './thanksgiving.js';
import { PATRIOTIC_SHAPES } from './patriotic.js';
import { BIRTHDAY_SHAPES } from './birthday.js';
import { SUMMER_SHAPES } from './summer.js';
import { SCHOOL_SHAPES } from './school.js';
import { PET_SHAPES } from './pets.js';
import { NAUTICAL_SHAPES } from './nautical.js';
import { NATURE_SHAPES } from './nature.js';
import { JEWISH_SHAPES } from './jewish.js';

/**
 * The catalogue, assembled.
 *
 * One module per category, concatenated in the order the categories are listed
 * in `types.ts`. Adding a category is a new file and one line here.
 */
export const CATALOGUE: readonly LibraryShape[] = [
  ...BASIC_SHAPES,
  ...ARROW_SHAPES,
  ...STAR_BANNER_SHAPES,
  ...CALLOUT_SHAPES,
  ...FLOWCHART_SHAPES,
  ...EQUATION_SHAPES,
  ...HALLOWEEN_SHAPES,
  ...CHRISTMAS_SHAPES,
  ...VALENTINE_SHAPES,
  ...WEDDING_SHAPES,
  ...EASTER_SHAPES,
  ...THANKSGIVING_SHAPES,
  ...PATRIOTIC_SHAPES,
  ...BIRTHDAY_SHAPES,
  ...SUMMER_SHAPES,
  ...SCHOOL_SHAPES,
  ...PET_SHAPES,
  ...NAUTICAL_SHAPES,
  ...NATURE_SHAPES,
  ...JEWISH_SHAPES,
];
