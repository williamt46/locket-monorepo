import { describe, it, expect } from 'vitest';
import { buildCycleHistory, segmentCycle } from '../../src/utils/cycleHistory';

// Keys use the ledger's "YYYY-M-D" format (0-indexed month).
const periodDays = (year: number, month0: number, startDay: number, len: number) => {
    const out: Record<string, { isPeriod: boolean }> = {};
    for (let i = 0; i < len; i++) {
        const d = new Date(year, month0, startDay + i);
        out[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] = { isPeriod: true };
    }
    return out;
};

const TODAY = new Date(2026, 5, 15); // June 15 2026

describe('segmentCycle', () => {
    it('splits a completed cycle at the prediction-engine boundaries', () => {
        const segs = segmentCycle(28, 5);
        expect(segs).toEqual([
            { phase: 'menstrual', count: 5 },
            { phase: 'follicular', count: 7 },   // floor(28*0.45)=12
            { phase: 'ovulatory', count: 3 },    // floor(28*0.55)=15
            { phase: 'luteal', count: 13 },
        ]);
        expect(segs.reduce((a, s) => a + s.count, 0)).toBe(28);
    });

    it('handles a period that swallows the follicular boundary', () => {
        // period 14 > floor(28*0.45)=12 → follicular segment collapses to zero
        const segs = segmentCycle(28, 14);
        expect(segs.find((s) => s.phase === 'follicular')).toBeUndefined();
        expect(segs[0]).toEqual({ phase: 'menstrual', count: 14 });
        expect(segs.reduce((a, s) => a + s.count, 0)).toBe(28);
    });

    it('appends a future segment when the cycle is in flight', () => {
        const segs = segmentCycle(28, 5, 10);
        expect(segs[segs.length - 1]).toEqual({ phase: 'future', count: 18 });
        expect(segs.reduce((a, s) => a + s.count, 0)).toBe(28);
    });

    it('clamps elapsed above the cycle length (no negative future)', () => {
        const segs = segmentCycle(28, 5, 40);
        expect(segs.find((s) => s.phase === 'future')).toBeUndefined();
        expect(segs.reduce((a, s) => a + s.count, 0)).toBe(28);
    });

    it('clamps period to at least 1 and at most the cycle length', () => {
        const segs = segmentCycle(10, 99);
        expect(segs).toEqual([{ phase: 'menstrual', count: 10 }]);
    });
});

describe('buildCycleHistory', () => {
    it('returns baseline averages when no period days are logged', () => {
        const h = buildCycleHistory({}, { cycleLength: 30, periodLength: 6 }, TODAY);
        expect(h.cycles).toEqual([]);
        expect(h.avgCycleDays).toBe(30);
        expect(h.avgPeriodDays).toBe(6);
    });

    it('returns null averages with no data and no baseline', () => {
        const h = buildCycleHistory({}, null, TODAY);
        expect(h.avgCycleDays).toBeNull();
        expect(h.avgPeriodDays).toBeNull();
    });

    it('builds a single in-flight current cycle from one period run', () => {
        // Period June 1-5 2026, today June 15 → elapsed 15 days
        const h = buildCycleHistory(periodDays(2026, 5, 1, 5), { cycleLength: 28, periodLength: 5 }, TODAY);
        expect(h.cycles).toHaveLength(1);
        const c = h.cycles[0];
        expect(c.isCurrent).toBe(true);
        expect(c.startDate).toBe('2026-06-01');
        expect(c.lengthDays).toBe(28);
        expect(c.periodDays).toBe(5);
        const future = c.segments.find((s) => s.phase === 'future');
        expect(future?.count).toBe(13); // 28 expected - 15 elapsed
        // No completed cycles → averages fall back to baseline / logged run
        expect(h.avgCycleDays).toBe(28);
        expect(h.avgPeriodDays).toBe(5);
    });

    it('derives completed cycle lengths between consecutive starts, newest first', () => {
        const data = {
            ...periodDays(2026, 3, 1, 5),  // Apr 1 start
            ...periodDays(2026, 3, 29, 5), // Apr 29 start → first cycle = 28d
            ...periodDays(2026, 4, 29, 6), // May 29 start → second cycle = 30d
        };
        const h = buildCycleHistory(data, { cycleLength: 28, periodLength: 5 }, TODAY);
        expect(h.cycles).toHaveLength(3);
        expect(h.cycles[0].isCurrent).toBe(true);
        expect(h.cycles[0].startDate).toBe('2026-05-29');
        expect(h.cycles[1]).toMatchObject({ startDate: '2026-04-29', lengthDays: 30, isCurrent: false });
        expect(h.cycles[2]).toMatchObject({ startDate: '2026-04-01', lengthDays: 28, isCurrent: false });
        expect(h.avgCycleDays).toBe(29); // (28+30)/2
        expect(h.avgPeriodDays).toBe(5); // (5+5+6)/3 = 5.33 → 5
    });

    it('treats a gap of exactly 5 days as the same period, 6 as a new one', () => {
        const sameRun = {
            ...periodDays(2026, 5, 1, 2),  // Jun 1-2
            ...periodDays(2026, 5, 7, 2),  // Jun 7-8 (gap of 5 from Jun 2)
        };
        expect(buildCycleHistory(sameRun, null, TODAY).cycles).toHaveLength(1);

        const twoRuns = {
            ...periodDays(2026, 5, 1, 2),  // Jun 1-2
            ...periodDays(2026, 5, 8, 2),  // Jun 8-9 (gap of 6 from Jun 2)
        };
        const h = buildCycleHistory(twoRuns, null, TODAY);
        expect(h.cycles).toHaveLength(2);
        expect(h.cycles[0].startDate).toBe('2026-06-08');
    });

    it('tolerates a 1-day hole inside a period run', () => {
        const data = {
            ...periodDays(2026, 5, 1, 2), // Jun 1-2
            ...periodDays(2026, 5, 4, 2), // Jun 4-5 (Jun 3 missing)
        };
        const h = buildCycleHistory(data, { cycleLength: 28, periodLength: 5 }, TODAY);
        expect(h.cycles).toHaveLength(1);
        expect(h.cycles[0].periodDays).toBe(5); // calendar span Jun 1-5
    });

    it('ignores degenerate spans over 120 days (imports, stale edits)', () => {
        const data = {
            ...periodDays(2025, 0, 1, 5),  // Jan 2025 — 500+ days before next start
            ...periodDays(2026, 5, 1, 5),  // Jun 2026
        };
        const h = buildCycleHistory(data, { cycleLength: 28, periodLength: 5 }, TODAY);
        // The >120d "cycle" is dropped; only the current in-flight cycle remains
        expect(h.cycles).toHaveLength(1);
        expect(h.cycles[0].isCurrent).toBe(true);
        expect(h.avgCycleDays).toBe(28); // baseline fallback — no valid completed cycles
    });

    it('extends the current cycle expectation when elapsed exceeds the baseline', () => {
        // Started Feb 1, today Jun 15 → elapsed way past 28; expected stretches to elapsed
        const h = buildCycleHistory(periodDays(2026, 1, 1, 5), { cycleLength: 28, periodLength: 5 }, TODAY);
        expect(h.cycles[0].lengthDays).toBeGreaterThanOrEqual(134);
        expect(h.cycles[0].segments.find((s) => s.phase === 'future')).toBeUndefined();
    });

    it('skips malformed keys and non-period entries', () => {
        const data: Record<string, any> = {
            ...periodDays(2026, 5, 1, 5),
            'garbage-key': { isPeriod: true },
            '2026-5-20': { isPeriod: false },
            '2026-5-21': undefined,
        };
        const h = buildCycleHistory(data, { cycleLength: 28, periodLength: 5 }, TODAY);
        expect(h.cycles).toHaveLength(1);
        expect(h.cycles[0].periodDays).toBe(5);
    });
});
