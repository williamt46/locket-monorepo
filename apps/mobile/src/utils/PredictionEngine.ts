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
            // Month is 0-indexed in JS date, need 1-indexed for string builder to match 'configLastDate' standard (YYYY-MM-DD)
            const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
            const day = d.getUTCDate().toString().padStart(2, '0');

            latestDateStr = `${y}-${m}-${day}`;
        }
    }

    return latestDateStr || configLastDate;
}
