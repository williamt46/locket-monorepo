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

// ── Interface ───────────────────────────────────────────────────────
export interface BaselineCycleData {
    /** ISO date string "YYYY-MM-DD" in UTC */
    lastPeriodDate: string;
    /** Typical period length in days (1–20) */
    periodLength: number;
    /** Typical cycle length in days (10–100) */
    cycleLength: number;
    /** Flag to indicate if initial onboarding data has been logged to ledger */
    hasSeededInitialData?: boolean;
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
        periodLength: 5,
        cycleLength: 28,
        hasSeededInitialData: false,
    };
}
