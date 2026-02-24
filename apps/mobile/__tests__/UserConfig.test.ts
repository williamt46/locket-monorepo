import { describe, it, expect } from 'vitest';
import {
    clampValue,
    createDefaultUserConfig,
    todayUTC,
    PERIOD_MIN,
    PERIOD_MAX,
    CYCLE_MIN,
    CYCLE_MAX,
    type UserConfig,
} from '../src/models/UserConfig';

// ── clampValue ──────────────────────────────────────────────────────

describe('clampValue', () => {
    it('returns the value when within range', () => {
        expect(clampValue(5, 1, 20)).toBe(5);
        expect(clampValue(50, 10, 100)).toBe(50);
    });

    it('clamps to min when value is below', () => {
        expect(clampValue(0, 1, 20)).toBe(1);
        expect(clampValue(-5, 1, 20)).toBe(1);
        expect(clampValue(9, 10, 100)).toBe(10);
    });

    it('clamps to max when value is above', () => {
        expect(clampValue(21, 1, 20)).toBe(20);
        expect(clampValue(101, 10, 100)).toBe(100);
        expect(clampValue(999, 1, 20)).toBe(20);
    });

    it('handles min === max', () => {
        expect(clampValue(0, 5, 5)).toBe(5);
        expect(clampValue(10, 5, 5)).toBe(5);
        expect(clampValue(5, 5, 5)).toBe(5);
    });
});

// ── Period clamping ─────────────────────────────────────────────────

describe('Period length clamping', () => {
    it('cannot go below 1', () => {
        expect(clampValue(0, PERIOD_MIN, PERIOD_MAX)).toBe(1);
    });

    it('cannot go above 20', () => {
        expect(clampValue(21, PERIOD_MIN, PERIOD_MAX)).toBe(20);
    });

    it('preserves valid values', () => {
        expect(clampValue(5, PERIOD_MIN, PERIOD_MAX)).toBe(5);
        expect(clampValue(1, PERIOD_MIN, PERIOD_MAX)).toBe(1);
        expect(clampValue(20, PERIOD_MIN, PERIOD_MAX)).toBe(20);
    });
});

// ── Cycle clamping ──────────────────────────────────────────────────

describe('Cycle length clamping', () => {
    it('cannot go below 10', () => {
        expect(clampValue(9, CYCLE_MIN, CYCLE_MAX)).toBe(10);
    });

    it('cannot go above 100', () => {
        expect(clampValue(101, CYCLE_MIN, CYCLE_MAX)).toBe(100);
    });

    it('preserves valid values', () => {
        expect(clampValue(28, CYCLE_MIN, CYCLE_MAX)).toBe(28);
        expect(clampValue(10, CYCLE_MIN, CYCLE_MAX)).toBe(10);
        expect(clampValue(100, CYCLE_MIN, CYCLE_MAX)).toBe(100);
    });
});

// ── Constants ───────────────────────────────────────────────────────

describe('Clamping constants', () => {
    it('PERIOD_MIN is 1', () => expect(PERIOD_MIN).toBe(1));
    it('PERIOD_MAX is 20', () => expect(PERIOD_MAX).toBe(20));
    it('CYCLE_MIN is 10', () => expect(CYCLE_MIN).toBe(10));
    it('CYCLE_MAX is 100', () => expect(CYCLE_MAX).toBe(100));
});

// ── createDefaultUserConfig ─────────────────────────────────────────

describe('createDefaultUserConfig', () => {
    it('returns a valid UserConfig', () => {
        const config = createDefaultUserConfig();
        expect(config).toHaveProperty('lastPeriodDate');
        expect(config).toHaveProperty('periodLength');
        expect(config).toHaveProperty('cycleLength');
    });

    it('has sensible defaults', () => {
        const config = createDefaultUserConfig();
        expect(config.periodLength).toBe(5);
        expect(config.cycleLength).toBe(28);
    });

    it('lastPeriodDate is today in YYYY-MM-DD format', () => {
        const config = createDefaultUserConfig();
        expect(config.lastPeriodDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(config.lastPeriodDate).toBe(todayUTC());
    });

    it('default period length is within allowed range', () => {
        const config = createDefaultUserConfig();
        expect(config.periodLength).toBeGreaterThanOrEqual(PERIOD_MIN);
        expect(config.periodLength).toBeLessThanOrEqual(PERIOD_MAX);
    });

    it('default cycle length is within allowed range', () => {
        const config = createDefaultUserConfig();
        expect(config.cycleLength).toBeGreaterThanOrEqual(CYCLE_MIN);
        expect(config.cycleLength).toBeLessThanOrEqual(CYCLE_MAX);
    });
});

// ── todayUTC ────────────────────────────────────────────────────────

describe('todayUTC', () => {
    it('returns a string in YYYY-MM-DD format', () => {
        expect(todayUTC()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns consistent results when called multiple times', () => {
        const a = todayUTC();
        const b = todayUTC();
        expect(a).toBe(b);
    });
});
