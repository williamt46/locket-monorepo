import { describe, it, expect } from 'vitest';
import { calculatePredictedPeriods, getLatestPeriodStart, getCurrentPhase } from '../../src/utils/PredictionEngine';

describe('PredictionEngine -> calculatePredictedPeriods', () => {
    it('predicts standard boundaries correctly', () => {
        // Start 2026-02-11 (month 1, day 11 UTC)
        // Next cycle (+28 days) -> March 11 (2026-02-11) Note: 2026 is not a leap year. Feb has 28 days.
        // Length 5 days
        const predictions = calculatePredictedPeriods('2026-02-11', 28, 5, 1);

        // LedgerScreen keys use 0-indexed months: 'YYYY-MM-DD' where MM = 2 (March)
        expect(predictions['2026-2-11']).toBe(true);
        expect(predictions['2026-2-12']).toBe(true);
        expect(predictions['2026-2-13']).toBe(true);
        expect(predictions['2026-2-14']).toBe(true);
        expect(predictions['2026-2-15']).toBe(true);

        // Check it doesn't bleed
        expect(predictions['2026-2-16']).toBeUndefined();
    });

    it('handles month wrapping correctly (end of month start)', () => {
        // Start 2026-01-31. Add 28 days -> Feb 28. (In JS Date, Jan is 0, Feb is 1).
        const predictions = calculatePredictedPeriods('2026-01-31', 28, 2, 1);

        expect(predictions['2026-1-28']).toBe(true);
        // March 1st (month 2, day 1)
        expect(predictions['2026-2-1']).toBe(true);
    });

    it('handles leap years correctly', () => {
        // 2024 is a leap year (Feb has 29). Start 2024-02-28.
        // +28 days = March 27.
        const predictions = calculatePredictedPeriods('2024-02-28', 28, 1, 1);

        // March is month 2.
        expect(predictions['2024-2-27']).toBe(true);
    });

    it('handles year boundary correctly', () => {
        // Dec 15th 2026. +28 days = Jan 12th 2027.
        const predictions = calculatePredictedPeriods('2026-12-15', 28, 3, 1);

        expect(predictions['2027-0-12']).toBe(true);
        expect(predictions['2027-0-13']).toBe(true);
        expect(predictions['2027-0-14']).toBe(true);
    });

    it('handles short cycles with long periods without advancing month early', () => {
        // Start 2026-05-01. Cycle 10. Length 8.
        // Next starts: May 11th, May 21th, May 31.
        const predictions = calculatePredictedPeriods('2026-05-01', 10, 8, 3);

        // First predicted cycle
        expect(predictions['2026-4-11']).toBe(true);
        expect(predictions['2026-4-18']).toBe(true);

        // Second predicted cycle
        expect(predictions['2026-4-21']).toBe(true);

        // Third predicted cycle (May 31 -> June 7)
        expect(predictions['2026-4-31']).toBe(true); // May 31
        expect(predictions['2026-5-1']).toBe(true);  // June 1
    });
});

describe('PredictionEngine -> getLatestPeriodStart', () => {
    it('returns config date when ledger is empty', () => {
        expect(getLatestPeriodStart({}, '2026-01-15')).toBe('2026-01-15');
    });

    it('returns config date when ledger has no isStart flags', () => {
        const data = {
            '2026-1-1': { ts: 1000, isPeriod: true },
        };
        expect(getLatestPeriodStart(data, '2026-01-15')).toBe('2026-01-15');
    });

    it('finds the most recent isStart event based on timestamp', () => {
        const data = {
            '2026-1-1': { ts: new Date(2026, 1, 1).getTime(), isPeriod: true, isStart: true },
            '2026-3-5': { ts: new Date(2026, 3, 5).getTime(), isPeriod: true, isStart: true },
            '2026-2-1': { ts: new Date(2026, 2, 1).getTime(), isPeriod: true, isStart: true },
        };

        // Month 3 array is April, so '2026-04-05' string
        expect(getLatestPeriodStart(data, '2026-01-15')).toBe('2026-04-05');
    });
});

describe('PredictionEngine -> getCurrentPhase', () => {
    it('returns unknown for malformed input', () => {
        const result = getCurrentPhase('2026-1-5', 28, 5); // not zero-padded → malformed
        expect(result.phase).toBe('unknown');
        expect(result.dayInCycle).toBe(0);
    });

    it('returns unknown for non-ISO input', () => {
        const result = getCurrentPhase('bad-date', 28, 5);
        expect(result.phase).toBe('unknown');
    });

    it('returns menstrual phase on day 0 (period start)', () => {
        const today = new Date('2026-04-01');
        const result = getCurrentPhase('2026-04-01', 28, 5, today);
        expect(result.phase).toBe('menstrual');
        expect(result.dayInCycle).toBe(0);
    });

    it('returns menstrual phase on last day of period', () => {
        const today = new Date('2026-04-05');
        const result = getCurrentPhase('2026-04-01', 28, 5, today);
        expect(result.phase).toBe('menstrual');
        expect(result.dayInCycle).toBe(4);
    });

    it('returns follicular phase after period ends', () => {
        // cycleLength=28, periodLength=5, follicularEnd = floor(28*0.45) = 12
        // day 6 → after period (5 days), before follicularEnd (12)
        const today = new Date('2026-04-07');
        const result = getCurrentPhase('2026-04-01', 28, 5, today);
        expect(result.phase).toBe('follicular');
        expect(result.dayInCycle).toBe(6);
    });

    it('returns ovulatory phase in the middle of cycle', () => {
        // follicularEnd = floor(28*0.45) = 12, ovulatoryEnd = floor(28*0.55) = 15
        // day 13 → ovulatory
        const today = new Date('2026-04-14');
        const result = getCurrentPhase('2026-04-01', 28, 5, today);
        expect(result.phase).toBe('ovulatory');
        expect(result.dayInCycle).toBe(13);
    });

    it('returns luteal phase in the second half of cycle', () => {
        // day 20 → luteal (after ovulatoryEnd=15)
        const today = new Date('2026-04-21');
        const result = getCurrentPhase('2026-04-01', 28, 5, today);
        expect(result.phase).toBe('luteal');
        expect(result.dayInCycle).toBe(20);
    });

    it('returns unknown when dayInCycle exceeds cycleLength', () => {
        // day 30 > cycleLength 28
        const today = new Date('2026-05-01');
        const result = getCurrentPhase('2026-04-01', 28, 5, today);
        expect(result.phase).toBe('unknown');
    });

    it('returns unknown when today is before period start', () => {
        const today = new Date('2026-03-31');
        const result = getCurrentPhase('2026-04-01', 28, 5, today);
        expect(result.phase).toBe('unknown');
        expect(result.dayInCycle).toBeLessThan(0);
    });
});
