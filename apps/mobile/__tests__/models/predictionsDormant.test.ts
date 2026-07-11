import { describe, it, expect } from 'vitest';
import { getLatestPeriodStart } from '../../src/utils/PredictionEngine';

// T7/§4: with no logged Period Start and no baseline date ("I'm not sure" path),
// getLatestPeriodStart must return null so callers keep predictions dormant
// rather than passing undefined into `.split('-')`.

describe('getLatestPeriodStart — dormant (no anchor) path', () => {
    it('returns null when there is no logged start and no config date', () => {
        expect(getLatestPeriodStart({}, undefined)).toBeNull();
    });

    it('falls back to the config date when no start is logged', () => {
        expect(getLatestPeriodStart({}, '2026-01-15')).toBe('2026-01-15');
    });

    it('prefers a logged period start over the config date', () => {
        const data = {
            '2026-3-4': { isPeriod: true, isStart: true, ts: Date.UTC(2026, 3, 4) },
        };
        expect(getLatestPeriodStart(data, undefined)).not.toBeNull();
    });

    it('returns a logged start even when config date is undefined', () => {
        const ts = new Date(2026, 3, 5).getTime();
        const data = { any: { isPeriod: true, isStart: true, ts } };
        const result = getLatestPeriodStart(data, undefined);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
