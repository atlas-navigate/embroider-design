/**
 * Unit conventions.
 *
 * Every coordinate inside an `EmbPattern` is expressed in **0.1 mm units**,
 * which is the native resolution of essentially every consumer embroidery
 * format (DST, PES/PEC, EXP, JEF, VP3, XXX all step in 0.1 mm). Keeping the
 * internal representation on the machine grid means format writers only ever
 * round once, at the very end, instead of accumulating error through the
 * pipeline.
 */

export const UNITS_PER_MM = 10;
export const MM_PER_INCH = 25.4;
export const UNITS_PER_INCH = UNITS_PER_MM * MM_PER_INCH; // 254

export function mmToUnits(mm: number): number {
  return mm * UNITS_PER_MM;
}

export function unitsToMm(units: number): number {
  return units / UNITS_PER_MM;
}

export function inchesToUnits(inches: number): number {
  return inches * UNITS_PER_INCH;
}

export function unitsToInches(units: number): number {
  return units / UNITS_PER_INCH;
}

export type LengthUnit = 'mm' | 'inch';

export function unitsToDisplay(units: number, unit: LengthUnit): number {
  return unit === 'inch' ? unitsToInches(units) : unitsToMm(units);
}

export function displayToUnits(value: number, unit: LengthUnit): number {
  return unit === 'inch' ? inchesToUnits(value) : mmToUnits(value);
}

export function formatLength(units: number, unit: LengthUnit, digits = unit === 'inch' ? 2 : 1): string {
  return `${unitsToDisplay(units, unit).toFixed(digits)}${unit === 'inch' ? '"' : ' mm'}`;
}
