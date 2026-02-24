/**
 * UserConfig — Onboarding configuration for the Locket sovereign health journal.
 *
 * Persisted locally after the user completes the 4-step onboarding wizard.
 * Presence of a stored UserConfig determines whether the app shows
 * onboarding or skips directly to authentication.
 */

// ── Clamping constants ──────────────────────────────────────────────
export const PERIOD_MIN = 1;
export const PERIOD_MAX = 20;
export const CYCLE_MIN = 10;
export const CYCLE_MAX = 100;

// ── Interface ───────────────────────────────────────────────────────
export interface UserConfig {
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
 * Create a UserConfig with sensible defaults.
 */
export function createDefaultUserConfig(): UserConfig {
    return {
        lastPeriodDate: todayUTC(),
        periodLength: 5,
        cycleLength: 28,
        hasSeededInitialData: false,
    };
}
