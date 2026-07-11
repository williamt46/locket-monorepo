/**
 * Single source of truth for menstrual-cycle phase boundaries.
 *
 * The follicular/ovulatory split (45% / 55% of the cycle) was previously
 * duplicated across PredictionEngine, cycleHistory, and OrbitGauge, which
 * risked the three copies drifting and disagreeing about which phase a day
 * belongs to. Everything now derives from `computePhaseBoundaries` here.
 *
 * Phase model for a 0-indexed cycle day `d` (0 = first day of the period):
 *   [0, period)                  → menstrual
 *   [period, follicularEnd)      → follicular
 *   [follicularEnd, ovulatoryEnd)→ ovulatory
 *   [ovulatoryEnd, ∞)            → luteal   (CLAMPED, not modulo-wrapped)
 *
 * The luteal clamp is deliberate: day 30 of a 28-day cycle is an *overdue*
 * luteal day, not a wrapped-around menstrual day (the previous OrbitGauge
 * modulo behaviour). Callers that need "unknown for overdue" (e.g.
 * PredictionEngine.getCurrentPhase) apply that bound themselves.
 */

export type CorePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

/** Fraction of the cycle at which the follicular phase ends / ovulatory begins. */
export const FOLLICULAR_RATIO = 0.45;
/** Fraction of the cycle at which the ovulatory phase ends / luteal begins. */
export const OVULATORY_RATIO = 0.55;

export interface PhaseBoundaries {
    /** Sanitised cycle length (≥ 1). */
    cycleLength: number;
    /** End of the menstrual run (exclusive), i.e. period length clamped to the cycle. */
    period: number;
    /** End of the follicular phase (exclusive). */
    follicularEnd: number;
    /** End of the ovulatory phase (exclusive); luteal runs from here to cycle end. */
    ovulatoryEnd: number;
}

/**
 * Compute the canonical phase-boundary day indices for a cycle.
 *
 * Boundaries are monotonically non-decreasing even for degenerate inputs: a
 * period that swallows the follicular boundary collapses that segment to zero
 * rather than producing an out-of-order boundary.
 */
export function computePhaseBoundaries(cycleLength: number, periodLength: number): PhaseBoundaries {
    const len = Math.max(1, Math.round(cycleLength));
    const period = Math.min(Math.max(1, Math.round(periodLength)), len);
    const follicularEnd = Math.max(period, Math.floor(len * FOLLICULAR_RATIO));
    const ovulatoryEnd = Math.max(follicularEnd, Math.floor(len * OVULATORY_RATIO));
    return { cycleLength: len, period, follicularEnd, ovulatoryEnd };
}

/**
 * Map a 0-indexed cycle day to its phase, clamping to luteal past cycle end
 * (no modulo wrap). Negative days clamp to the first menstrual day.
 */
export function phaseForDay(day: number, cycleLength: number, periodLength: number): CorePhase {
    const { period, follicularEnd, ovulatoryEnd } = computePhaseBoundaries(cycleLength, periodLength);
    const d = Math.max(0, Math.floor(day));
    if (d < period) return 'menstrual';
    if (d < follicularEnd) return 'follicular';
    if (d < ovulatoryEnd) return 'ovulatory';
    return 'luteal';
}
