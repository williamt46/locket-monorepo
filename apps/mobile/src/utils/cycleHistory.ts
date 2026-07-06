/**
 * Cycle history derivation for the Insights → Cycle Trends tab.
 *
 * Works on the same decrypted per-day map the ledger produces (keys "YYYY-M-D"
 * with 0-indexed month) and the same grouping heuristic as usePredictions:
 * consecutive period days ≤5 days apart belong to one period; a bigger gap
 * starts a new one. Phase segmentation mirrors PredictionEngine.getCurrentPhase
 * (menstrual = logged period run, follicular ends at 45% of cycle, ovulatory at 55%).
 */

export type SegmentPhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'future';

export interface CycleSegment {
    phase: SegmentPhase;
    count: number;
}

export interface CycleRecord {
    /** Local date of the period start that opens this cycle */
    startDate: string; // ISO YYYY-MM-DD
    /** Cycle length in days (start → next start); expected length for the current cycle */
    lengthDays: number;
    /** Logged period-run length in days */
    periodDays: number;
    segments: CycleSegment[];
    isCurrent: boolean;
}

export interface CycleHistory {
    cycles: CycleRecord[]; // newest first
    avgCycleDays: number | null;
    avgPeriodDays: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface PeriodRun {
    start: Date;
    days: number;
}

const toISO = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Split a cycle into phase segments using the prediction-engine boundaries. */
export function segmentCycle(lengthDays: number, periodDays: number, elapsedDays?: number): CycleSegment[] {
    const len = Math.max(1, Math.round(lengthDays));
    const period = Math.min(Math.max(1, Math.round(periodDays)), len);
    const follicularEnd = Math.max(period, Math.floor(len * 0.45));
    const ovulatoryEnd = Math.max(follicularEnd, Math.floor(len * 0.55));

    const bounds: Array<{ phase: SegmentPhase; end: number }> = [
        { phase: 'menstrual', end: period },
        { phase: 'follicular', end: follicularEnd },
        { phase: 'ovulatory', end: ovulatoryEnd },
        { phase: 'luteal', end: len },
    ];

    const cut = elapsedDays === undefined ? len : Math.min(Math.max(elapsedDays, 0), len);
    const segments: CycleSegment[] = [];
    let prev = 0;
    for (const b of bounds) {
        const visible = Math.max(0, Math.min(b.end, cut) - prev);
        if (visible > 0) segments.push({ phase: b.phase, count: visible });
        prev = b.end;
    }
    if (cut < len) segments.push({ phase: 'future', count: len - cut });
    return segments;
}

export function buildCycleHistory(
    decryptedDays: Record<string, { isPeriod?: boolean } | undefined>,
    baseline: { cycleLength?: number; periodLength?: number } | null | undefined,
    today: Date = new Date()
): CycleHistory {
    // 1. Collect period days as local dates
    const dates: Date[] = [];
    for (const key of Object.keys(decryptedDays ?? {})) {
        const entry = decryptedDays[key];
        if (!entry?.isPeriod) continue;
        const parts = key.split('-');
        if (parts.length !== 3) continue;
        const [y, m, d] = parts.map(Number);
        if ([y, m, d].some(Number.isNaN)) continue;
        dates.push(new Date(y, m, d));
    }
    dates.sort((a, b) => a.getTime() - b.getTime());

    // 2. Group into period runs (gap > 5 days = new period)
    const runs: PeriodRun[] = [];
    for (const date of dates) {
        const last = runs[runs.length - 1];
        if (!last) {
            runs.push({ start: date, days: 1 });
            continue;
        }
        const lastDay = new Date(last.start.getTime() + (last.days - 1) * DAY_MS);
        const gap = Math.round((date.getTime() - lastDay.getTime()) / DAY_MS);
        if (gap > 5) {
            runs.push({ start: date, days: 1 });
        } else {
            last.days += Math.max(1, gap); // count calendar span, tolerate 1-day holes
        }
    }

    if (runs.length === 0) {
        return { cycles: [], avgCycleDays: baseline?.cycleLength ?? null, avgPeriodDays: baseline?.periodLength ?? null };
    }

    // 3. Completed cycles between consecutive starts + the in-flight current cycle
    const cycles: CycleRecord[] = [];
    const completedLengths: number[] = [];

    for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        const next = runs[i + 1];
        if (next) {
            const length = Math.round((next.start.getTime() - run.start.getTime()) / DAY_MS);
            if (length <= 0 || length > 120) continue; // ignore degenerate spans (imports, edits)
            completedLengths.push(length);
            cycles.push({
                startDate: toISO(run.start),
                lengthDays: length,
                periodDays: run.days,
                segments: segmentCycle(length, run.days),
                isCurrent: false,
            });
        } else {
            const elapsed = Math.floor((today.getTime() - run.start.getTime()) / DAY_MS) + 1;
            const expected = Math.max(baseline?.cycleLength ?? 28, elapsed);
            cycles.push({
                startDate: toISO(run.start),
                lengthDays: expected,
                periodDays: run.days,
                segments: segmentCycle(expected, run.days, elapsed),
                isCurrent: true,
            });
        }
    }

    const avgCycleDays = completedLengths.length
        ? Math.round(completedLengths.reduce((a, b) => a + b, 0) / completedLengths.length)
        : baseline?.cycleLength ?? null;
    const avgPeriodDays = runs.length
        ? Math.round(runs.reduce((a, r) => a + r.days, 0) / runs.length)
        : baseline?.periodLength ?? null;

    return { cycles: cycles.reverse(), avgCycleDays, avgPeriodDays };
}
