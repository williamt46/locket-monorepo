import { describe, it, expect } from 'vitest';
import {
    computePhaseBoundaries,
    phaseForDay,
    FOLLICULAR_RATIO,
    OVULATORY_RATIO,
} from '../../src/utils/phaseBoundaries';
import { segmentCycle } from '../../src/utils/cycleHistory';
import { getCurrentPhase } from '../../src/utils/PredictionEngine';

// Expand a segmentCycle() result into a per-day phase array.
const segmentsToPhases = (cycleLength: number, periodLength: number): string[] => {
    const out: string[] = [];
    for (const seg of segmentCycle(cycleLength, periodLength)) {
        for (let i = 0; i < seg.count; i++) out.push(seg.phase);
    }
    return out;
};

// Phase from getCurrentPhase for a given 0-indexed dayInCycle: pin the period
// start and set `today` to start + dayInCycle (UTC to avoid TZ boundary drift).
const START = Date.UTC(2026, 3, 1); // 2026-04-01
const phaseFromEngine = (dayInCycle: number, cycleLength: number, periodLength: number): string => {
    const today = new Date(START + dayInCycle * 24 * 60 * 60 * 1000);
    return getCurrentPhase('2026-04-01', cycleLength, periodLength, today).phase;
};

describe('computePhaseBoundaries', () => {
    it('derives 45%/55% boundaries for a canonical 28/5 cycle', () => {
        expect(computePhaseBoundaries(28, 5)).toEqual({
            cycleLength: 28,
            period: 5,
            follicularEnd: 12, // floor(28*0.45)
            ovulatoryEnd: 15, // floor(28*0.55)
        });
    });

    it('exposes the ratios as the single source of truth', () => {
        expect(FOLLICULAR_RATIO).toBe(0.45);
        expect(OVULATORY_RATIO).toBe(0.55);
    });

    it('keeps boundaries non-decreasing when the period swallows follicular', () => {
        const b = computePhaseBoundaries(28, 14);
        expect(b.period).toBe(14);
        expect(b.follicularEnd).toBe(14); // collapsed, not floor(28*0.45)=12
        expect(b.ovulatoryEnd).toBe(15);
    });

    it('sanitises degenerate inputs (clamps period into the cycle, rounds length)', () => {
        const b = computePhaseBoundaries(0.4, 99);
        expect(b.cycleLength).toBe(1);
        expect(b.period).toBe(1);
        expect(b.follicularEnd).toBe(1);
        expect(b.ovulatoryEnd).toBe(1);
    });
});

describe('phaseForDay — luteal clamp (overdue), no modulo wrap', () => {
    it('maps each phase window of a 28/5 cycle', () => {
        expect(phaseForDay(0, 28, 5)).toBe('menstrual');
        expect(phaseForDay(4, 28, 5)).toBe('menstrual');
        expect(phaseForDay(5, 28, 5)).toBe('follicular');
        expect(phaseForDay(11, 28, 5)).toBe('follicular');
        expect(phaseForDay(12, 28, 5)).toBe('ovulatory');
        expect(phaseForDay(14, 28, 5)).toBe('ovulatory');
        expect(phaseForDay(15, 28, 5)).toBe('luteal');
        expect(phaseForDay(27, 28, 5)).toBe('luteal');
    });

    it('CLAMPS days past cycle end to luteal instead of wrapping to menstrual', () => {
        // Day 30 of a 28-day cycle is overdue-luteal, not a wrapped day-2 menstrual.
        expect(phaseForDay(28, 28, 5)).toBe('luteal');
        expect(phaseForDay(30, 28, 5)).toBe('luteal');
        expect(phaseForDay(200, 28, 5)).toBe('luteal');
    });

    it('clamps negative days to the first menstrual day', () => {
        expect(phaseForDay(-3, 28, 5)).toBe('menstrual');
    });
});

describe('boundary equivalence across all three call sites', () => {
    // OrbitGauge re-exports phaseForDay from phaseBoundaries (verified by the
    // re-export in OrbitGauge.tsx), so its ring/marker mapping is identical to
    // the util. This suite pins the two .ts consumers — getCurrentPhase
    // (PredictionEngine) and segmentCycle (cycleHistory) — to that same util.
    const configs: Array<[number, number]> = [
        [28, 5],
        [30, 6],
        [21, 4],
        [35, 7],
        [26, 3],
    ];

    it('getCurrentPhase agrees with phaseForDay for every in-range day', () => {
        for (const [cycle, period] of configs) {
            for (let day = 0; day < cycle; day++) {
                expect(phaseFromEngine(day, cycle, period)).toBe(phaseForDay(day, cycle, period));
            }
        }
    });

    it('segmentCycle agrees with phaseForDay for every day of the cycle', () => {
        for (const [cycle, period] of configs) {
            const fromSegments = segmentsToPhases(cycle, period);
            expect(fromSegments).toHaveLength(cycle);
            for (let day = 0; day < cycle; day++) {
                expect(fromSegments[day]).toBe(phaseForDay(day, cycle, period));
            }
        }
    });
});
