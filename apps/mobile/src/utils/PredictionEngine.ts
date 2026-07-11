import { phaseForDay } from './phaseBoundaries';

export function calculatePredictedPeriods(
    lastStartDate: string,
    cycleLength: number,
    periodLength: number,
    count: number = 3
): Record<string, boolean> {
    const predictions: Record<string, boolean> = {};

    // Parse strings as UTC to strictly avoid timezone-induced boundary shifting
    const [yearStr, monthStr, dayStr] = lastStartDate.split('-');
    let currentStart = new Date(Date.UTC(+yearStr, +monthStr - 1, +dayStr));

    for (let cycle = 0; cycle < count; cycle++) {
        // Advance by cycleLength to find the next period start
        currentStart.setUTCDate(currentStart.getUTCDate() + cycleLength);

        // From this start, mark 'periodLength' consecutive days
        for (let day = 0; day < periodLength; day++) {
            const d = new Date(currentStart);
            d.setUTCDate(d.getUTCDate() + day);

            const y = d.getUTCFullYear();
            const m = d.getUTCMonth();
            // We want mapping keys compatible with LedgerScreen format: "YYYY-MM-DD" where MM is 0-indexed month
            const dayOfMonth = d.getUTCDate();
            predictions[`${y}-${m}-${dayOfMonth}`] = true;
        }
    }

    return predictions;
}

export function getLatestPeriodStart(
    decryptedData: Record<string, any>,
    configLastDate?: string
): string | null {
    let highestTimestamp = 0;
    let latestDateStr: string | null = null;

    for (const dateKey of Object.keys(decryptedData)) {
        const entry = decryptedData[dateKey];
        if (entry && entry.isPeriod && entry.isStart && entry.ts > highestTimestamp) {
            highestTimestamp = entry.ts;

            const d = new Date(entry.ts);
            // Timestamps are recorded as a local wall-clock instant when the user logs,
            // so derive the calendar key from local date parts. Reading these back with
            // getUTC* would shift the day by one in timezones offset from UTC.
            const y = d.getFullYear();
            const m = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');

            latestDateStr = `${y}-${m}-${day}`;
        }
    }

    // T7/§4: when there is no logged Period Start and no baseline date (the
    // "I'm not sure" path leaves `lastPeriodDate` undefined), return null so
    // callers keep predictions dormant instead of crashing on `.split('-')`.
    return latestDateStr ?? configLastDate ?? null;
}

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'unknown';

/**
 * Returns the current cycle phase and day-in-cycle for a user.
 *
 * @param latestPeriodStart - ISO date string "YYYY-MM-DD" (1-indexed month, zero-padded).
 *   This is the format returned by `getLatestPeriodStart`. Do NOT pass raw ledger keys
 *   (which use 0-indexed months: "YYYY-M-D"). Malformed input returns phase: 'unknown'.
 * @param cycleLength - Typical cycle length in days.
 * @param periodLength - Typical period length in days.
 * @param today - Defaults to new Date(). Injectable for testing.
 */
export function getCurrentPhase(
  latestPeriodStart: string,
  cycleLength: number,
  periodLength: number,
  today: Date = new Date()
): { phase: CyclePhase; dayInCycle: number } {
  // Guard against degenerate config values (short cycle or period >= cycle)
  if (!cycleLength || cycleLength <= 0 || !periodLength || periodLength >= cycleLength) {
    return { phase: 'unknown', dayInCycle: 0 };
  }

  // Validate ISO format YYYY-MM-DD
  const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (!ISO_RE.test(latestPeriodStart)) {
    return { phase: 'unknown', dayInCycle: 0 };
  }

  const [yStr, mStr, dStr] = latestPeriodStart.split('-');
  const startUTC = Date.UTC(+yStr, +mStr - 1, +dStr);
  if (isNaN(startUTC)) {
    return { phase: 'unknown', dayInCycle: 0 };
  }

  const todayUTC = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );

  const dayInCycle = Math.floor((todayUTC - startUTC) / (1000 * 60 * 60 * 24));

  if (dayInCycle < 0 || dayInCycle > cycleLength) {
    return { phase: 'unknown', dayInCycle };
  }

  // Phase boundaries come from the single-source-of-truth util so this stays
  // in lockstep with cycleHistory and OrbitGauge. dayInCycle is already bounded
  // to [0, cycleLength] above, so the util's luteal-clamp and this function's
  // legacy behaviour agree.
  return { phase: phaseForDay(dayInCycle, cycleLength, periodLength), dayInCycle };
}
