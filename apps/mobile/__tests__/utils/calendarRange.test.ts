import { describe, it, expect } from 'vitest';
import { deriveCalendarRange, MonthRef } from '../../src/utils/calendarRange';

// Ledger/prediction day keys use "YYYY-M-D" (0-indexed month, no zero padding).
const key = (y: number, monthIndex: number, day: number) => `${y}-${monthIndex}-${day}`;

const first = (list: MonthRef[]) => list[0];
const last = (list: MonthRef[]) => list[list.length - 1];

describe('deriveCalendarRange', () => {
    // Reference "now": July 2026 (monthIndex 6).
    const today = new Date(2026, 6, 15);

    it('fresh user (no logged data): 10-year floor back → full forward year', () => {
        // Predictions now blanket the forward year; last predicted month here is
        // within the guaranteed window, so the forward floor (today + 12) governs.
        const futureKeys = [key(2026, 7, 10), key(2027, 5, 8)];
        const list = deriveCalendarRange([], futureKeys, today);

        // Start = today − 120 months = July 2016.
        expect(first(list)).toEqual({ year: 2016, monthIndex: 6 });
        // End = today + 12 months = July 2027.
        expect(last(list)).toEqual({ year: 2027, monthIndex: 6 });
        // Inclusive span July 2016 → July 2027 = 133 months.
        expect(list.length).toBe(133);
    });

    it('predictions running past the forward year extend the end further', () => {
        // A stray predicted key in Sep 2027 lies beyond today + 12 (July 2027).
        const list = deriveCalendarRange([], [key(2027, 8, 8)], today);
        // End = last predicted month (Sep 2027) + 1 = Oct 2027.
        expect(last(list)).toEqual({ year: 2027, monthIndex: 9 });
    });

    it('with no predictions at all, still gives a full forward year', () => {
        const list = deriveCalendarRange([], [], today);
        // Forward floor: end = today + 12 months = July 2027.
        expect(last(list)).toEqual({ year: 2027, monthIndex: 6 });
        // Start floored at July 2016 (10 years back).
        expect(first(list)).toEqual({ year: 2016, monthIndex: 6 });
    });

    it('old imported data extends the range back to its earliest month', () => {
        // A day logged in March 2010 (monthIndex 2) — well inside the 20-year cap.
        const dataKeys = [key(2010, 2, 14), key(2026, 5, 1)];
        const list = deriveCalendarRange(dataKeys, [key(2026, 8, 8)], today);

        expect(first(list)).toEqual({ year: 2010, monthIndex: 2 });
        // Prediction (Sep 2026) is inside the forward year, so end = today + 12.
        expect(last(list)).toEqual({ year: 2027, monthIndex: 6 });
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
        expect(first(list)).toEqual({ year: 2016, monthIndex: 6 });
    });

    it('ignores malformed keys', () => {
        const list = deriveCalendarRange(['garbage', '', 'x-y'], ['also-bad'], today);
        expect(first(list)).toEqual({ year: 2016, monthIndex: 6 });
        expect(last(list)).toEqual({ year: 2027, monthIndex: 6 });
    });

    it('handles a year-boundary today correctly', () => {
        // January 2026 (monthIndex 0): floor crosses the year boundary.
        const jan = new Date(2026, 0, 10);
        const list = deriveCalendarRange([], [], jan);
        // Start = Jan 2026 − 120 months = Jan 2016.
        expect(first(list)).toEqual({ year: 2016, monthIndex: 0 });
        // End = Jan 2026 + 12 months = Jan 2027.
        expect(last(list)).toEqual({ year: 2027, monthIndex: 0 });
    });
});
