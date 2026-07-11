import { describe, it, expect } from 'vitest';
import {
    isLearningState,
    isOverdue,
    daysLate,
    formatMonDay,
    gaugeDayLine,
    cycleStartDate,
    buildCycleDayCells,
} from '../../src/utils/cycleStrip';

describe('isLearningState', () => {
    it('is false once a period start is logged, regardless of baseline', () => {
        expect(isLearningState(null, true)).toBe(false);
        expect(isLearningState({ lastPeriodDate: '2026-07-01' }, true)).toBe(false);
        expect(
            isLearningState({ lastPeriodDate: '2026-07-01', estimatedFields: ['lastPeriodDate'] }, true),
        ).toBe(false);
    });

    it('is true when no logged start and no baseline', () => {
        expect(isLearningState(null, false)).toBe(true);
        expect(isLearningState(undefined, false)).toBe(true);
    });

    it('is true when baseline exists but lastPeriodDate is missing', () => {
        expect(isLearningState({}, false)).toBe(true);
        expect(isLearningState({ estimatedFields: ['cycleLength'] }, false)).toBe(true);
    });

    it('is true when lastPeriodDate is estimated (an "I\'m not sure" run)', () => {
        expect(
            isLearningState(
                { lastPeriodDate: '2026-07-01', estimatedFields: ['lastPeriodDate'] },
                false,
            ),
        ).toBe(true);
    });

    it('is false when a real (non-estimated) lastPeriodDate is present', () => {
        expect(isLearningState({ lastPeriodDate: '2026-07-01' }, false)).toBe(false);
        expect(
            isLearningState({ lastPeriodDate: '2026-07-01', estimatedFields: [] }, false),
        ).toBe(false);
        expect(
            isLearningState(
                { lastPeriodDate: '2026-07-01', estimatedFields: ['cycleLength'] },
                false,
            ),
        ).toBe(false);
    });
});

describe('isOverdue', () => {
    it('is false at or before the last day of the cycle', () => {
        // 0-indexed day 27 is the last day of a 28-day cycle; day 28 is 1 late.
        expect(isOverdue(27, 28)).toBe(false);
        expect(isOverdue(28, 28)).toBe(false);
        expect(isOverdue(0, 28)).toBe(false);
    });
    it('is true past cycle end', () => {
        expect(isOverdue(29, 28)).toBe(true);
        expect(isOverdue(40, 28)).toBe(true);
    });
});

describe('daysLate', () => {
    it('is zero when not overdue', () => {
        expect(daysLate(10, 28)).toBe(0);
        expect(daysLate(28, 28)).toBe(0);
    });
    it('counts days past cycle end', () => {
        expect(daysLate(29, 28)).toBe(1);
        expect(daysLate(31, 28)).toBe(3);
    });
});

describe('formatMonDay', () => {
    it('formats as "{Mon} {DD}"', () => {
        expect(formatMonDay(new Date(2026, 6, 7))).toBe('Jul 7');
        expect(formatMonDay(new Date(2026, 0, 15))).toBe('Jan 15');
    });
});

describe('gaugeDayLine', () => {
    it('plain "DAY {n}" when not overdue', () => {
        expect(gaugeDayLine(0, 28)).toBe('DAY 1');
        expect(gaugeDayLine(13, 28)).toBe('DAY 14');
    });
    it('appends "{k} days late" when overdue, pluralizing correctly', () => {
        expect(gaugeDayLine(29, 28)).toBe('DAY 30 · 1 day late');
        expect(gaugeDayLine(30, 28)).toBe('DAY 31 · 2 days late');
    });
});

describe('cycleStartDate', () => {
    it('is local midnight of cycle day 0', () => {
        const today = new Date(2026, 6, 11, 15, 30);
        const start = cycleStartDate(10, today);
        expect(start.getFullYear()).toBe(2026);
        expect(start.getMonth()).toBe(6);
        expect(start.getDate()).toBe(1);
        expect(start.getHours()).toBe(0);
        expect(start.getMinutes()).toBe(0);
    });
    it('crosses month boundaries', () => {
        const start = cycleStartDate(5, new Date(2026, 6, 2));
        expect(start.getMonth()).toBe(5); // June
        expect(start.getDate()).toBe(27);
    });
    it('day 0 today returns today at midnight', () => {
        const start = cycleStartDate(0, new Date(2026, 6, 11, 9));
        expect(start.getDate()).toBe(11);
        expect(start.getHours()).toBe(0);
    });
});

describe('buildCycleDayCells', () => {
    const today = new Date(2026, 6, 11);

    it('produces one cell per day, day 1 → predicted end when not overdue', () => {
        const cells = buildCycleDayCells(10, 28, today);
        expect(cells).toHaveLength(28);
        expect(cells[0].dayIndex).toBe(0);
        expect(cells[27].dayIndex).toBe(27);
    });

    it('flags today and marks later days as future', () => {
        const cells = buildCycleDayCells(10, 28, today);
        expect(cells[10].isToday).toBe(true);
        expect(cells[10].date.getDate()).toBe(11);
        expect(cells[9].isFuture).toBe(false);
        expect(cells[11].isFuture).toBe(true);
        expect(cells.filter((c) => c.isToday)).toHaveLength(1);
    });

    it('extends past predicted end so today stays present when overdue', () => {
        // day 32 (0-indexed) of a 28-day cycle: strip must reach today.
        const cells = buildCycleDayCells(32, 28, today);
        expect(cells).toHaveLength(33); // day 1 → today inclusive
        expect(cells[32].isToday).toBe(true);
        expect(cells.some((c) => c.isFuture)).toBe(false);
    });

    it('the start cell is cycle day 0 at the correct calendar date', () => {
        const cells = buildCycleDayCells(10, 28, today);
        expect(cells[0].date.getMonth()).toBe(6);
        expect(cells[0].date.getDate()).toBe(1);
    });

    it('clamps degenerate cycle length to at least one cell', () => {
        const cells = buildCycleDayCells(0, 0, today);
        expect(cells.length).toBeGreaterThanOrEqual(1);
        expect(cells[0].isToday).toBe(true);
    });
});
