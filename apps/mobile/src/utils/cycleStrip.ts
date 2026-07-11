/**
 * Pure date/cycle math for the Insights tab's OrbitGauge + DayStrip (T5).
 *
 * All functions here are side-effect free and unit-tested. The screen and the
 * two visual components consume them so the "learning" trigger, the overdue
 * ("days late") math, and the full-cycle strip layout have a single, tested
 * source of truth rather than being re-derived inline in each component.
 */

/** Baseline shape this module needs. Kept structural so it doesn't couple to
 *  the full `BaselineCycleData` model (which gains `estimatedFields` in T7). */
export interface LearningBaseline {
    lastPeriodDate?: string;
    /** Fields carried through onboarding as typical/estimated values (T7/§4). */
    estimatedFields?: string[];
}

/**
 * "Learning your cycle" trigger (§3, reconciled with §4).
 *
 * True when there is **no logged period start** AND (**no baseline** OR the
 * baseline's `lastPeriodDate` is **missing or estimated**). An "I'm not sure"
 * onboarding run produces a baseline with typical values whose
 * `estimatedFields` includes `lastPeriodDate`; that must still read as
 * learning, so "no baseline" alone is insufficient.
 */
export function isLearningState(
    baseline: LearningBaseline | null | undefined,
    hasLoggedPeriodStart: boolean,
): boolean {
    if (hasLoggedPeriodStart) return false;
    if (!baseline) return true;
    if (!baseline.lastPeriodDate) return true;
    return (baseline.estimatedFields ?? []).includes('lastPeriodDate');
}

/**
 * Whether the current 0-indexed `dayInCycle` is past the end of a
 * `cycleLength`-day cycle (period is late). Matches `getCurrentPhase`, which
 * reports `unknown` once `dayInCycle > cycleLength`.
 */
export function isOverdue(dayInCycle: number, cycleLength: number): boolean {
    return dayInCycle > cycleLength;
}

/**
 * How many days late the period is, given a 0-indexed `dayInCycle`. Zero when
 * not overdue. Day `cycleLength` (0-indexed) is the first day past a
 * `cycleLength`-day cycle, i.e. 1 day late.
 */
export function daysLate(dayInCycle: number, cycleLength: number): number {
    return Math.max(0, dayInCycle - cycleLength);
}

/** Format a local Date as "{Mon} {DD}", e.g. "Jul 7". */
export function formatMonDay(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * The gauge center's DAY line. Overdue cycles pin at cycle end and read
 * "DAY {n} · {k} days late"; otherwise a plain "DAY {n}". `n` is the 1-indexed
 * day number.
 */
export function gaugeDayLine(dayInCycle: number, cycleLength: number): string {
    const dayNumber = dayInCycle + 1;
    if (isOverdue(dayInCycle, cycleLength)) {
        const late = daysLate(dayInCycle, cycleLength);
        return `DAY ${dayNumber} · ${late} ${late === 1 ? 'day' : 'days'} late`;
    }
    return `DAY ${dayNumber}`;
}

/** A single day cell in the full-cycle strip. `dayIndex` is 0-indexed. */
export interface CycleDayCell {
    /** 0-indexed day-in-cycle. */
    dayIndex: number;
    /** Local calendar date for this cell. */
    date: Date;
    /** This cell is today. */
    isToday: boolean;
    /** This cell is after today (a predicted future day — not loggable). */
    isFuture: boolean;
}

/**
 * Local-midnight Date of cycle day 0, derived from today and the 0-indexed
 * `dayInCycle`. Pure aside from the injectable `today`.
 */
export function cycleStartDate(dayInCycle: number, today: Date = new Date()): Date {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    start.setDate(start.getDate() - dayInCycle);
    return start;
}

/**
 * Build the strip's cells: one per day of the current cycle, day 1 →
 * `max(predicted end, today)`. When the period is overdue the strip extends
 * past the predicted end so today stays present and centerable (§3).
 *
 * @param dayInCycle 0-indexed current day-in-cycle (today).
 * @param cycleLength predicted cycle length in days.
 * @param today injectable "now" (local).
 */
export function buildCycleDayCells(
    dayInCycle: number,
    cycleLength: number,
    today: Date = new Date(),
): CycleDayCell[] {
    const len = Math.max(1, Math.round(cycleLength));
    const todayIdx = Math.max(0, dayInCycle);
    // day 1 → max(predicted end, today): today must always be a cell.
    const count = Math.max(len, todayIdx + 1);
    const start = cycleStartDate(dayInCycle, today);
    const cells: CycleDayCell[] = [];
    for (let i = 0; i < count; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        cells.push({
            dayIndex: i,
            date,
            isToday: i === todayIdx,
            isFuture: i > todayIdx,
        });
    }
    return cells;
}
