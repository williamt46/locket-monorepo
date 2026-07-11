import { describe, it, expect } from 'vitest';
import { recentDateStrings, RECENT_DAYS } from '../../src/utils/recentDates';

describe('recentDateStrings', () => {
    const from = new Date(2026, 6, 11); // Sat Jul 11 2026 (local)

    it('starts at today (newest first) and has the requested length', () => {
        const out = recentDateStrings(RECENT_DAYS, from);
        expect(out).toHaveLength(RECENT_DAYS);
        expect(out[0]).toBe('2026-07-11');
    });

    it('spans today back to (count - 1) days ago, never a future date', () => {
        const out = recentDateStrings(RECENT_DAYS, from);
        // Oldest is 280 days before Jul 11 2026 → Oct 4 2025.
        expect(out[out.length - 1]).toBe('2025-10-04');
        // Strictly descending; first element is the max (no future dates).
        expect(out[0] >= out[1]).toBe(true);
        expect(Math.max(...out.map((d) => Date.parse(d)))).toBe(Date.parse('2026-07-11'));
    });

    it('uses local calendar components (zero-padded, tz-stable)', () => {
        const out = recentDateStrings(3, new Date(2026, 0, 1)); // Jan 1 2026
        expect(out).toEqual(['2026-01-01', '2025-12-31', '2025-12-30']);
    });

    it('crosses month and year boundaries correctly', () => {
        const out = recentDateStrings(2, new Date(2026, 2, 1)); // Mar 1 2026
        expect(out).toEqual(['2026-03-01', '2026-02-28']);
    });
});
