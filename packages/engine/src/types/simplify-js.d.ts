/**
 * `simplify-js` (BSD-2-Clause) ships no type declarations, so we provide our
 * own. See THIRD_PARTY_LICENSES.md.
 */
declare module 'simplify-js' {
  interface SimplifyPoint {
    x: number;
    y: number;
  }

  function simplify<T extends SimplifyPoint>(
    points: T[],
    tolerance?: number,
    highestQuality?: boolean,
  ): T[];

  export = simplify;
}
