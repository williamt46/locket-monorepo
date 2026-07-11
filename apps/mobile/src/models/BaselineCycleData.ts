/**
 * BaselineCycleData — the user's self-declared cycle baseline: lastPeriodDate,
 * periodLength, cycleLength. Persisted locally after onboarding; its presence
 * decides whether the app shows onboarding or jumps to auth.
 *
 * This is health data (GDPR Art. 9 class), not "config" or "metadata". PR3 wraps
 * it at rest (locket_baseline_v2) and it is never shared with clinicians.
 */

// ── Clamping constants ──────────────────────────────────────────────
export const PERIOD_MIN = 1;
export const PERIOD_MAX = 20;
export const CYCLE_MIN = 10;
export const CYCLE_MAX = 100;

// ── Clinical-median defaults (T7 "I'm not sure") ────────────────────
export const PERIOD_DEFAULT = 5;
export const CYCLE_DEFAULT = 28;

/** Which fields were left as typical/estimated values during onboarding (T7/§4). */
export type EstimatedField = 'lastPeriodDate' | 'periodLength' | 'cycleLength';

// ── Interface ───────────────────────────────────────────────────────
export interface BaselineCycleData {
    /**
     * ISO date string "YYYY-MM-DD" in UTC. OPTIONAL as of T7: an "I'm not sure"
     * onboarding run leaves this undefined — no ledger seeding, predictions stay
     * dormant until the first logged Period Start anchors them.
     */
    lastPeriodDate?: string;
    /** Typical period length in days (1–20) */
    periodLength: number;
    /** Typical cycle length in days (10–100) */
    cycleLength: number;
    /** Flag to indicate if initial onboarding data has been logged to ledger */
    hasSeededInitialData?: boolean;
    /**
     * Fields the user did not supply and that fell back to a clinical median.
     * ADDITIVE schema rev (T7/§4): old encrypted locket_baseline_v2 payloads
     * predate this field, so it is OPTIONAL on the type and read-side code MUST
     * default it to `[]` (see `normalizeBaseline`, which guarantees it is present
     * after any decode). Consumers reading it directly should use `?? []`.
     */
    estimatedFields?: EstimatedField[];
}

// ── Pure helpers ────────────────────────────────────────────────────

/**
 * Clamp a numeric value to [min, max].
 */
export function clampValue(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Get today's date as a "YYYY-MM-DD" string at UTC midnight.
 */
export function todayUTC(): string {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

/**
 * Create a BaselineCycleData with sensible defaults.
 */
export function createDefaultBaselineCycleData(): BaselineCycleData {
    return {
        lastPeriodDate: todayUTC(),
        periodLength: PERIOD_DEFAULT,
        cycleLength: CYCLE_DEFAULT,
        hasSeededInitialData: false,
        estimatedFields: [],
    };
}

/**
 * Whether a baseline carries a REAL last-period anchor to seed the ledger from.
 *
 * False when `lastPeriodDate` is missing OR flagged estimated (the T7 "I'm not
 * sure" path). LedgerScreen's initial-seed effect gates on this, which also
 * prevents the `lastPeriodDate.split('-')` crash on an undefined date. Pure.
 */
export function hasRealAnchor(config: Pick<BaselineCycleData, 'lastPeriodDate' | 'estimatedFields'> | null | undefined): boolean {
    if (!config || !config.lastPeriodDate) return false;
    return !(config.estimatedFields ?? []).includes('lastPeriodDate');
}

/**
 * Read-side normalizer for baseline payloads decoded from storage/backup.
 *
 * Pre-T7 payloads (encrypted `locket_baseline_v2` or legacy plaintext) have no
 * `estimatedFields` key. Parsing them yields `estimatedFields === undefined`,
 * which would break `.includes(...)` in consumers. This defaults it to `[]` so
 * old baselines read as "all fields known" — the correct semantics, since a
 * pre-T7 user always supplied a real last-period date. Idempotent.
 */
export function normalizeBaseline<T extends { estimatedFields?: EstimatedField[] }>(
    raw: T,
): T & { estimatedFields: EstimatedField[] } {
    return {
        ...raw,
        estimatedFields: Array.isArray(raw.estimatedFields) ? raw.estimatedFields : [],
    };
}
