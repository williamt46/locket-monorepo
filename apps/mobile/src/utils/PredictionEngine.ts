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
    configLastDate: string
): string {
    let highestTimestamp = 0;
    let latestDateStr: string | null = null;

    for (const dateKey of Object.keys(decryptedData)) {
        const entry = decryptedData[dateKey];
        if (entry && entry.isPeriod && entry.isStart && entry.ts > highestTimestamp) {
            highestTimestamp = entry.ts;

            const d = new Date(entry.ts);
            const y = d.getUTCFullYear();
            // Use UTC methods to match the UTC-based consumption in getCurrentPhase (avoids off-by-one near midnight in non-UTC timezones)
            const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
            const day = d.getUTCDate().toString().padStart(2, '0');

            latestDateStr = `${y}-${m}-${day}`;
        }
    }

    return latestDateStr || configLastDate;
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

  if (dayInCycle < periodLength) {
    return { phase: 'menstrual', dayInCycle };
  }

  const follicularEnd = Math.floor(cycleLength * 0.45);
  const ovulatoryEnd = Math.floor(cycleLength * 0.55);

  if (dayInCycle < follicularEnd) {
    return { phase: 'follicular', dayInCycle };
  }
  if (dayInCycle < ovulatoryEnd) {
    return { phase: 'ovulatory', dayInCycle };
  }
  return { phase: 'luteal', dayInCycle };
}
