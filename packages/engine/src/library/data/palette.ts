/**
 * The catalogue's colours.
 *
 * Before this file every icon module declared its own near-duplicates — four
 * different golds, three greens called `LEAF` — and the library looked like
 * thirteen people had drawn it, because thirteen sets of colours is exactly
 * what a viewer reads as thirteen different hands.
 *
 * The palette is built the way an embroiderer works: in **families of three**.
 * A shape gets its base colour, a darker tone for the side facing away from
 * the light, and a lighter one for the side facing it. Three tones is what
 * makes a flat silhouette look like an object, and it is also about as many
 * thread changes as anyone will tolerate for one icon.
 *
 * Every value is chosen to exist as a real 40-weight polyester thread rather
 * than sampled from a screen. Saturated near-neon colours look fine on a
 * monitor and have no spool.
 */

/*
 * Keylines.
 *
 * The outline around an icon, its eyes, and its interior detail lines are all
 * one part in one of these — see `keyline.ts`. There are three rather than one
 * because a warm brown line around a silver anchor looks like mud, and only
 * three because every additional keyline tone is another stop of the machine on
 * an icon that has already spent its colour budget on the artwork.
 *
 * `INK` stays exactly what it was. It is true near-black, which is right for a
 * pupil or a cast-iron pot and wrong for a line drawn around a pumpkin.
 */
export const OUTLINE = '#3c2a20';
export const OUTLINE_COOL = '#243447';
export const OUTLINE_RED = '#7a1f1c';

/* Metals. */
export const GOLD = '#d4a13c';
export const GOLD_DARK = '#a97b22';
export const GOLD_LIGHT = '#f0cd7c';
export const SILVER = '#b9c0c9';
export const SILVER_DARK = '#8b939e';
export const SILVER_LIGHT = '#e4e9ee';
export const BRONZE = '#a9702f';
export const COPPER = '#c4703a';

/* Neutrals and line work. */
export const INK = '#22252b';
export const INK_SOFT = '#3b4048';
export const WHITE = '#f7f4ee';
export const CREAM = '#efe6d2';
export const CREAM_DARK = '#d8c9ab';
export const SHADOW = '#5a5f68';
/** A dark grey that is still a *fill*: penguins, tyres, wrought iron. `INK` fills flat. */
export const CHARCOAL = '#4a4f57';

/* Reds and pinks. */
export const RED = '#c8352f';
export const RED_DARK = '#98211f';
export const RED_LIGHT = '#e4655c';
export const CRIMSON = '#b1224a';
export const PINK = '#e58aa4';
export const PINK_DARK = '#c9647f';
export const PINK_LIGHT = '#f3bccb';
export const BLUSH = '#e8a0b4';
/** Cheeks at an inch. `BLUSH` is meant for a larger area and reads as a bruise small. */
export const BLUSH_LIGHT = '#f6c9d2';

/* Oranges and yellows. */
export const ORANGE = '#e0812c';
export const ORANGE_DARK = '#b45f18';
export const ORANGE_LIGHT = '#f2a85a';
export const YELLOW = '#efc03f';
export const YELLOW_DARK = '#c99820';
export const YELLOW_LIGHT = '#f8dc86';
export const PUMPKIN = '#e2761f';
/** Fox, terracotta, autumn leaves — the gap between `COPPER` and `RED`. */
export const RUST = '#b1552b';

/* Greens. */
export const GREEN = '#4f8a4a';
export const GREEN_DARK = '#356133';
export const GREEN_LIGHT = '#7cae66';
export const PINE = '#2f6b41';
export const PINE_DARK = '#1f4a2d';
export const PINE_LIGHT = '#4a8a58';
export const OLIVE = '#7d8b45';
export const MINT = '#a8cfa4';
/** Leaf undersides and shadow greens, darker than `GREEN_DARK` will go. */
export const GREEN_DEEP = '#2c5a34';

/* Blues and purples. */
export const BLUE = '#3d6ea8';
export const BLUE_DARK = '#28497a';
export const BLUE_LIGHT = '#6e9bd0';
export const SKY = '#8cc4e0';
export const SKY_LIGHT = '#bfe0f0';
export const NAVY = '#223a5c';
export const TEAL = '#2f8a8a';
export const PURPLE = '#7a5a9e';
export const PURPLE_DARK = '#57407a';
export const LAVENDER = '#b8a6d6';

/* Woods, earth and skin. */
export const WOOD = '#a9793f';
export const WOOD_DARK = '#7c5527';
export const WOOD_LIGHT = '#c79a62';
export const BROWN = '#7d5434';
export const BROWN_DARK = '#553722';
export const BROWN_LIGHT = '#a2795a';
export const EARTH = '#8b6b4a';
export const FUR = '#b07b45';
export const FUR_DARK = '#7a5128';
export const FUR_LIGHT = '#d4a878';
export const SAND = '#e0cb9a';
export const SKIN = '#e8bd94';
export const SKIN_DARK = '#c8926a';

/* Glass, water and ice. */
export const GLASS = '#cfe3ef';
export const WATER = '#4a8fbf';
export const WATER_DARK = '#2f6a94';
export const ICE = '#a8dcee';
export const ICE_LIGHT = '#dff2fa';
