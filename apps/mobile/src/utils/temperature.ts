import type { TemperatureUnit } from '../models/LogEntry';

/**
 * Valid basal-body-temperature ranges and first-expand seed values, per unit.
 * The Fahrenheit and Celsius ranges do NOT overlap (105 °F = 40.6 °C, 92 °F =
 * 33.3 °C), which is what makes magnitude-based unit inference on import safe.
 */
export const TEMP_LIMITS: Record<TemperatureUnit, { min: number; max: number; seed: number }> = {
  F: { min: 92.0, max: 105.0, seed: 98.6 },
  C: { min: 33.3, max: 40.6, seed: 37.0 },
};

/** Stepper increment for the ±0.1 buttons. */
export const TEMP_STEP = 0.1;

/** Round to one decimal place, avoiding binary float drift (e.g. 0.1 + 0.2). */
export function roundTemp(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Clamp a temperature to the valid range for its unit. Applied on blur for
 * manual entry only — imported out-of-range values display as stored.
 * Non-finite input falls back to the unit's seed value.
 */
export function clampTemperature(value: number, unit: TemperatureUnit): number {
  const { min, max, seed } = TEMP_LIMITS[unit];
  if (!Number.isFinite(value)) return seed;
  if (value < min) return min;
  if (value > max) return max;
  return roundTemp(value);
}

/**
 * Convert a temperature between units. Storage is lossless (as entered), so
 * this is only for DISPLAY when the active unit differs from the stored unit.
 */
export function convertTemperature(value: number, from: TemperatureUnit, to: TemperatureUnit): number {
  if (from === to) return roundTemp(value);
  if (from === 'C' && to === 'F') return roundTemp(value * 9 / 5 + 32);
  // F -> C
  return roundTemp((value - 32) * 5 / 9);
}

/**
 * Infer the unit an imported BBT value was recorded in. Source formats
 * (Clue/Flo/CSV) never tag the unit, but valid °F (92–105) and °C (33.3–40.6)
 * ranges don't overlap, so magnitude is a reliable discriminator.
 */
export function inferTemperatureUnit(bbt: number): TemperatureUnit {
  return bbt >= 50 ? 'F' : 'C';
}
