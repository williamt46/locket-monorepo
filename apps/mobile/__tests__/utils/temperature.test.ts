import { describe, it, expect } from 'vitest';
import {
  TEMP_LIMITS,
  clampTemperature,
  convertTemperature,
  inferTemperatureUnit,
  roundTemp,
} from '../../src/utils/temperature';

describe('clampTemperature', () => {
  it('leaves an in-range Fahrenheit value untouched', () => {
    expect(clampTemperature(98.6, 'F')).toBe(98.6);
  });

  it('leaves an in-range Celsius value untouched', () => {
    expect(clampTemperature(37.0, 'C')).toBe(37.0);
  });

  it('clamps below the Fahrenheit minimum to 92.0', () => {
    expect(clampTemperature(80, 'F')).toBe(TEMP_LIMITS.F.min);
    expect(clampTemperature(TEMP_LIMITS.F.min - 0.01, 'F')).toBe(92.0);
  });

  it('clamps above the Fahrenheit maximum to 105.0', () => {
    expect(clampTemperature(200, 'F')).toBe(TEMP_LIMITS.F.max);
    expect(clampTemperature(105.5, 'F')).toBe(105.0);
  });

  it('clamps to the Celsius bounds', () => {
    expect(clampTemperature(20, 'C')).toBe(33.3);
    expect(clampTemperature(45, 'C')).toBe(40.6);
  });

  it('accepts the exact boundary values', () => {
    expect(clampTemperature(92.0, 'F')).toBe(92.0);
    expect(clampTemperature(105.0, 'F')).toBe(105.0);
    expect(clampTemperature(33.3, 'C')).toBe(33.3);
    expect(clampTemperature(40.6, 'C')).toBe(40.6);
  });

  it('falls back to the unit seed for non-finite input', () => {
    expect(clampTemperature(NaN, 'F')).toBe(98.6);
    expect(clampTemperature(Infinity, 'C')).toBe(37.0);
  });

  it('rounds to one decimal place', () => {
    expect(clampTemperature(98.64, 'F')).toBe(98.6);
    expect(clampTemperature(98.65, 'F')).toBeCloseTo(98.7, 5);
  });
});

describe('inferTemperatureUnit', () => {
  it('infers Celsius for low-magnitude BBT values', () => {
    expect(inferTemperatureUnit(36.5)).toBe('C');
    expect(inferTemperatureUnit(33.3)).toBe('C');
    expect(inferTemperatureUnit(40.6)).toBe('C');
    expect(inferTemperatureUnit(49.9)).toBe('C');
  });

  it('infers Fahrenheit for high-magnitude BBT values', () => {
    expect(inferTemperatureUnit(98.6)).toBe('F');
    expect(inferTemperatureUnit(92.0)).toBe('F');
    expect(inferTemperatureUnit(105.0)).toBe('F');
  });

  it('treats 50 as the Fahrenheit threshold (>= 50 -> F)', () => {
    expect(inferTemperatureUnit(50)).toBe('F');
    expect(inferTemperatureUnit(49.99)).toBe('C');
  });
});

describe('convertTemperature', () => {
  it('returns the same value (rounded) when units match', () => {
    expect(convertTemperature(98.6, 'F', 'F')).toBe(98.6);
    expect(convertTemperature(37, 'C', 'C')).toBe(37);
  });

  it('converts Celsius to Fahrenheit', () => {
    expect(convertTemperature(37, 'C', 'F')).toBe(98.6);
    expect(convertTemperature(0, 'C', 'F')).toBe(32);
    expect(convertTemperature(100, 'C', 'F')).toBe(212);
  });

  it('converts Fahrenheit to Celsius', () => {
    expect(convertTemperature(98.6, 'F', 'C')).toBe(37);
    expect(convertTemperature(32, 'F', 'C')).toBe(0);
  });

  it('round-trips losslessly at one-decimal precision for typical BBT', () => {
    const f = 98.6;
    expect(convertTemperature(convertTemperature(f, 'F', 'C'), 'C', 'F')).toBe(f);
  });
});

describe('roundTemp', () => {
  it('avoids binary float drift', () => {
    expect(roundTemp(0.1 + 0.2)).toBe(0.3);
    expect(roundTemp(98.60000001)).toBe(98.6);
  });
});
