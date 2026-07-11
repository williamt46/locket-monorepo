import { describe, it, expect } from 'vitest';
import { deriveCalendarRange, MonthRef } from '../../src/utils/calendarRange';

// Ledger/prediction day keys use "YYYY-M-D" (0-indexed month, no zero padding).
const key = (y: number, monthIndex: number, day: number) => `${y}-${monthIndex}-${day}`;

const first = (list: MonthRef[]) => list[0];
const last = (list: MonthRef[]) => list[list.length - 1];

describe('deriveCalendarRange', () => {
    // Reference "now": July 2026 (monthIndex 6).
    const today = new Date(2026, 6, 15);

    it('fresh user (no logged data): 24-month floor back → last predicted +1', () => {
        // Predictions run out to Sep 2026 (monthIndex 8) for a 3-cycle horizon.
        const futureKeys = [key(2026, 7, 10), key(2026, 8, 8)];
        const list = deriveCalendarRange([], futureKeys, today);

        // Start = today − 24 months = July 2024.
        expect(first(list)).toEqual({ year: 2024, monthIndex: 6 });
        // End = last predicted month (Sep 2026) + 1 = Oct 2026.
        expect(last(list)).toEqual({ year: 2026, monthIndex: 9 });
        // Inclusive span July 2024 → Oct 2026 = 28 months.
        expect(list.length).toBe(28);
    });

    it('with no predictions at all, still ends no earlier than the current month', () => {
        const list = deriveCalendarRange([], [], today);
        // lastFuture defaults to today, so end = today + 1 = Aug 2026.
        expect(last(list)).toEqual({ year: 2026, monthIndex: 7 });
        // Start still floored at July 2024.
        expect(first(list)).toEqual({ year: 2024, monthIndex: 6 });
    });

    it('old imported data extends the range back to its earliest month', () => {
        // A day logged in March 2010 (monthIndex 2) — well inside the 20-year cap.
        const dataKeys = [key(2010, 2, 14), key(2026, 5, 1)];
        const list = deriveCalendarRange(dataKeys, [key(2026, 8, 8)], today);

        expect(first(list)).toEqual({ year: 2010, monthIndex: 2 });
        // Still ends one month past the last prediction.
        expect(last(list)).toEqual({ year: 2026, monthIndex: 9 });
    });

    it('caps history at 20 years even with older imported data', () => {
        // A stray day in 1990 is beyond the 240-month cap.
        const dataKeys = [key(1990, 0, 1)];
        const list = deriveCalendarRange(dataKeys, [], today);

        // Cap = today − 240 months = July 2006.
        expect(first(list)).toEqual({ year: 2006, monthIndex: 6 });
    });

    it('does not extend back further than the floor for recent-only data', () => {
        // Only data in the last few months — floor still governs the start.
        const dataKeys = [key(2026, 4, 3), key(2026, 5, 20)];
        const list = deriveCalendarRange(dataKeys, [], today);
        expect(first(list)).toEqual({ year: 2024, monthIndex: 6 });
    });

    it('ignores malformed keys', () => {
        const list = deriveCalendarRange(['garbage', '', 'x-y'], ['also-bad'], today);
        expect(first(list)).toEqual({ year: 2024, monthIndex: 6 });
        expect(last(list)).toEqual({ year: 2026, monthIndex: 7 });
    });

    it('handles a year-boundary today correctly', () => {
        // January 2026 (monthIndex 0): floor crosses the year boundary.
        const jan = new Date(2026, 0, 10);
        const list = deriveCalendarRange([], [], jan);
        // Start = Jan 2026 − 24 months = Jan 2024.
        expect(first(list)).toEqual({ year: 2024, monthIndex: 0 });
        // End = Jan 2026 + 1 = Feb 2026.
        expect(last(list)).toEqual({ year: 2026, monthIndex: 1 });
    });
});
