import { describe, it, expect } from 'vitest';
import { buildLogNavParams } from '../../src/utils/buildLogNavParams';
import { BaselineCycleData } from '../../src/models/BaselineCycleData';

// Ledger day keys use "YYYY-M-D" (0-indexed month, no zero padding).
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const baseline = (over: Partial<BaselineCycleData> = {}): BaselineCycleData =>
    ({ cycleLength: 28, periodLength: 5, lastPeriodDate: '2026-06-01', ...over } as BaselineCycleData);

describe('buildLogNavParams', () => {
    it('returns the ISO date of the tapped day', () => {
        const date = new Date(2026, 5, 15);
        const params = buildLogNavParams({}, baseline(), date);
        expect(params.date).toBe(date.toISOString());
    });

    it('picks initialData for the tapped day by "YYYY-M-D" key', () => {
        const date = new Date(2026, 5, 15);
        const entry = { isPeriod: true, note: 'cramps' };
        const data = { [key(date)]: entry };
        const params = buildLogNavParams(data, baseline(), date);
        expect(params.initialData).toBe(entry);
    });

    it('returns undefined initialData for a day with no entry', () => {
        const params = buildLogNavParams({}, baseline(), new Date(2026, 5, 15));
        expect(params.initialData).toBeUndefined();
    });

    it('maps only isPeriod days into existingPeriodDays as local-midnight timestamps', () => {
        const p1 = new Date(2026, 5, 10);
        const p2 = new Date(2026, 5, 11);
        const nonPeriod = new Date(2026, 5, 20);
        const data = {
            [key(p1)]: { isPeriod: true },
            [key(p2)]: { isPeriod: true },
            [key(nonPeriod)]: { isPeriod: false, note: 'symptom only' },
        };
        const params = buildLogNavParams(data, baseline(), new Date(2026, 5, 15));
        expect(params.existingPeriodDays.sort()).toEqual(
            [
                new Date(2026, 5, 10).getTime(),
                new Date(2026, 5, 11).getTime(),
            ].sort()
        );
    });

    it('excludes days whose entry lacks isPeriod (falsy)', () => {
        const d = new Date(2026, 5, 12);
        const data = { [key(d)]: { note: 'no period flag' } };
        const params = buildLogNavParams(data, baseline(), new Date(2026, 5, 15));
        expect(params.existingPeriodDays).toEqual([]);
    });

    it('returns an empty existingPeriodDays for an empty ledger', () => {
        const params = buildLogNavParams({}, baseline(), new Date(2026, 5, 15));
        expect(params.existingPeriodDays).toEqual([]);
    });

    it('carries periodLength from the baseline config', () => {
        const params = buildLogNavParams({}, baseline({ periodLength: 7 }), new Date(2026, 5, 15));
        expect(params.periodLength).toBe(7);
    });

    it('tolerates a null/undefined config (periodLength undefined)', () => {
        expect(buildLogNavParams({}, null, new Date(2026, 5, 15)).periodLength).toBeUndefined();
        expect(buildLogNavParams({}, undefined, new Date(2026, 5, 15)).periodLength).toBeUndefined();
    });
});
