import { BaselineCycleData } from '../models/BaselineCycleData';

/**
 * The subset of `Log` route params derived from the decrypted ledger + baseline.
 *
 * Screen-specific params (`keyHex`, `currentPhase`) are added by each caller —
 * this helper owns only the data-derived fields so the `existingPeriodDays`
 * mapping isn't duplicated between LedgerScreen and CycleInsightsScreen.
 */
export interface LogNavParams {
    /** ISO string of the day being logged (local Date → toISOString). */
    date: string;
    /** The already-decrypted entry for that day, if any. */
    initialData: any;
    /** Baseline period length so LogScreen can auto-fill an End boundary. */
    periodLength: number | undefined;
    /**
     * Local-midnight timestamps of every logged period day — lets LogScreen
     * clear the orphan days of an existing period run when a boundary is
     * re-marked (span-clearing on re-mark).
     */
    existingPeriodDays: number[];
}

/**
 * Build the data-derived `Log` navigation params from the decrypted ledger map,
 * the user's baseline config, and the target date. Pure: no navigation or state.
 *
 * @param decryptedData per-day map keyed "YYYY-M-D" (0-indexed month), as produced by useDecryptedLedger
 * @param config the active baseline cycle data (or null before it loads)
 * @param date the local Date the user tapped
 */
export function buildLogNavParams(
    decryptedData: Record<string, any>,
    config: BaselineCycleData | null | undefined,
    date: Date,
): LogNavParams {
    const existingPeriodDays = Object.keys(decryptedData)
        .filter((k) => decryptedData[k]?.isPeriod)
        .map((k) => {
            const [y, m, d] = k.split('-').map(Number);
            return new Date(y, m, d).getTime();
        });

    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    return {
        date: date.toISOString(),
        initialData: decryptedData[dayKey],
        periodLength: config?.periodLength,
        existingPeriodDays,
    };
}
