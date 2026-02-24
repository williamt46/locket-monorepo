import { describe, it, expect } from 'vitest';
import {
    clampValue,
    PERIOD_MIN,
    PERIOD_MAX,
    CYCLE_MIN,
    CYCLE_MAX,
} from '../src/models/UserConfig';

/**
 * These tests validate the clamping logic that StepNumberPicker uses.
 * They exercise the pure clampValue function at the boundary values
 * that match the picker's increment/decrement behavior.
 */

describe('StepNumberPicker clamping — Period Length', () => {
    const min = PERIOD_MIN; // 1
    const max = PERIOD_MAX; // 20

    it('decrement from min stays at min', () => {
        expect(clampValue(min - 1, min, max)).toBe(min);
    });

    it('increment from max stays at max', () => {
        expect(clampValue(max + 1, min, max)).toBe(max);
    });

    it('increment from 1 → 2', () => {
        expect(clampValue(1 + 1, min, max)).toBe(2);
    });

    it('decrement from 20 → 19', () => {
        expect(clampValue(20 - 1, min, max)).toBe(19);
    });

    it('mid-range value passthrough', () => {
        expect(clampValue(10, min, max)).toBe(10);
    });
});

describe('StepNumberPicker clamping — Cycle Length', () => {
    const min = CYCLE_MIN; // 10
    const max = CYCLE_MAX; // 100

    it('decrement from min stays at min', () => {
        expect(clampValue(min - 1, min, max)).toBe(min);
    });

    it('increment from max stays at max', () => {
        expect(clampValue(max + 1, min, max)).toBe(max);
    });

    it('increment from 10 → 11', () => {
        expect(clampValue(10 + 1, min, max)).toBe(11);
    });

    it('decrement from 100 → 99', () => {
        expect(clampValue(100 - 1, min, max)).toBe(99);
    });

    it('default value 28 passthrough', () => {
        expect(clampValue(28, min, max)).toBe(28);
    });
});

describe('StepNumberPicker boundary exhaustive', () => {
    it('period: value exactly at min boundary', () => {
        expect(clampValue(PERIOD_MIN, PERIOD_MIN, PERIOD_MAX)).toBe(PERIOD_MIN);
    });

    it('period: value exactly at max boundary', () => {
        expect(clampValue(PERIOD_MAX, PERIOD_MIN, PERIOD_MAX)).toBe(PERIOD_MAX);
    });

    it('cycle: value exactly at min boundary', () => {
        expect(clampValue(CYCLE_MIN, CYCLE_MIN, CYCLE_MAX)).toBe(CYCLE_MIN);
    });

    it('cycle: value exactly at max boundary', () => {
        expect(clampValue(CYCLE_MAX, CYCLE_MIN, CYCLE_MAX)).toBe(CYCLE_MAX);
    });

    it('large out-of-range values are clamped', () => {
        expect(clampValue(1000, PERIOD_MIN, PERIOD_MAX)).toBe(PERIOD_MAX);
        expect(clampValue(1000, CYCLE_MIN, CYCLE_MAX)).toBe(CYCLE_MAX);
    });

    it('negative values are clamped to min', () => {
        expect(clampValue(-50, PERIOD_MIN, PERIOD_MAX)).toBe(PERIOD_MIN);
        expect(clampValue(-50, CYCLE_MIN, CYCLE_MAX)).toBe(CYCLE_MIN);
    });
});
