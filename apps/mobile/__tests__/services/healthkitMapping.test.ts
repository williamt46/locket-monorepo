import { describe, it, expect } from 'vitest';
import { mapHealthKitSamples, localDayTs } from '../../src/services/healthkitMapping';
import { ledgerEntryToLogEntry } from '../../src/services/ImportService';
import type { HealthKitCategorySample, HealthKitQuantitySample } from '../../src/services/HealthKitSource';
import type { LedgerEntry } from '../../src/models/ImportTypes';

/**
 * healthkitMapping — HK samples → LedgerEntry[]. Pure (no native library), so no
 * mock is needed. Also exercises the real ledgerEntryToLogEntry so the full
 * "sample → app-domain LogEntry" contract (flow scale, BBT unit, symptom pills)
 * is covered end to end.
 */

function cat(
    categoryType: string,
    value: number,
    date: Date,
    metadata?: Record<string, unknown>,
): HealthKitCategorySample {
    return { categoryType, value, startDate: date, endDate: date, metadata };
}
function bbt(quantity: number, date: Date): HealthKitQuantitySample {
    return {
        quantityType: 'HKQuantityTypeIdentifierBasalBodyTemperature',
        quantity,
        unit: 'degC',
        startDate: date,
        endDate: date,
    };
}
function set(categorySamples: HealthKitCategorySample[], quantitySamples: HealthKitQuantitySample[] = []) {
    return { categorySamples, quantitySamples };
}
const d = (y: number, m: number, day: number, h = 9) => new Date(y, m - 1, day, h);

describe('healthkitMapping — menstrualFlow → flow scale', () => {
    it('maps light/medium/heavy enum values to flow 1/2/3 as period days', () => {
        const entries = mapHealthKitSamples(set([
            cat('HKCategoryTypeIdentifierMenstrualFlow', 2, d(2024, 1, 1)), // light
            cat('HKCategoryTypeIdentifierMenstrualFlow', 3, d(2024, 1, 2)), // medium
            cat('HKCategoryTypeIdentifierMenstrualFlow', 4, d(2024, 1, 3)), // heavy
        ]));
        expect(entries.map(e => e.flow)).toEqual([1, 2, 3]);
        expect(entries.every(e => e.isPeriod)).toBe(true);
        expect(entries.every(e => e.source === 'healthkit')).toBe(true);
    });

    it('maps unspecified (1) to a period day defaulting to medium flow', () => {
        const [e] = mapHealthKitSamples(set([cat('HKCategoryTypeIdentifierMenstrualFlow', 1, d(2024, 1, 1))]));
        expect(e.isPeriod).toBe(true);
        expect(e.flow).toBe(2);
    });

    it('drops a "none" (5) flow day that carries nothing else', () => {
        const entries = mapHealthKitSamples(set([cat('HKCategoryTypeIdentifierMenstrualFlow', 5, d(2024, 1, 1))]));
        expect(entries).toHaveLength(0);
    });

    it('preserves an UNKNOWN flow enum value as note text, still a period day', () => {
        const [e] = mapHealthKitSamples(set([cat('HKCategoryTypeIdentifierMenstrualFlow', 99, d(2024, 1, 1))]));
        expect(e.isPeriod).toBe(true);
        expect(e.flow).toBe(2);
        expect(e.note).toContain('Menstrual Flow: 99');
    });
});

describe('healthkitMapping — intermenstrualBleeding → spotting', () => {
    it('maps intermenstrual bleeding to flow 0 (spotting), not a period', () => {
        const [e] = mapHealthKitSamples(set([cat('HKCategoryTypeIdentifierIntermenstrualBleeding', 0, d(2024, 1, 5))]));
        expect(e.isPeriod).toBe(false);
        expect(e.flow).toBe(0);
    });

    it('period on the same day wins over spotting', () => {
        const [e] = mapHealthKitSamples(set([
            cat('HKCategoryTypeIdentifierIntermenstrualBleeding', 0, d(2024, 1, 5)),
            cat('HKCategoryTypeIdentifierMenstrualFlow', 4, d(2024, 1, 5)),
        ]));
        expect(e.isPeriod).toBe(true);
        expect(e.flow).toBe(3);
    });
});

describe('healthkitMapping — basalBodyTemperature', () => {
    it('stores an in-range Celsius BBT and infers unit C downstream', () => {
        const [e] = mapHealthKitSamples(set([], [bbt(36.5, d(2024, 1, 1))]));
        expect(e.bbt).toBe(36.5);
        const log = ledgerEntryToLogEntry(e);
        expect(log.temperature).toEqual({ value: 36.5, unit: 'C' });
    });

    it('clamps an out-of-range BBT to the physiological Celsius bound', () => {
        const [e] = mapHealthKitSamples(set([], [bbt(45, d(2024, 1, 1))]));
        expect(e.bbt).toBe(40.6); // TEMP_LIMITS.C.max
    });

    it('ignores a non-finite BBT reading', () => {
        const entries = mapHealthKitSamples(set([], [bbt(NaN, d(2024, 1, 1))]));
        expect(entries).toHaveLength(0);
    });
});

describe('healthkitMapping — sexualActivity metadata → symptom pills', () => {
    it('protection used → "Sex Protected" note, lifted to sex_protected pill', () => {
        const [e] = mapHealthKitSamples(set([
            cat('HKCategoryTypeIdentifierSexualActivity', 0, d(2024, 1, 1), { HKSexualActivityProtectionUsed: true }),
        ]));
        expect(e.note).toBe('Sex Protected');
        const log = ledgerEntryToLogEntry(e);
        expect(log.symptoms).toContain('sex_protected');
        expect(log.note).toBeUndefined();
    });

    it('protection NOT used → "Sex Unprotected" → sex_unprotected pill', () => {
        const [e] = mapHealthKitSamples(set([
            cat('HKCategoryTypeIdentifierSexualActivity', 0, d(2024, 1, 1), { HKSexualActivityProtectionUsed: false }),
        ]));
        const log = ledgerEntryToLogEntry(e);
        expect(log.symptoms).toContain('sex_unprotected');
    });

    it('absent protection metadata → generic "Sexual Activity" note (no pill)', () => {
        const [e] = mapHealthKitSamples(set([
            cat('HKCategoryTypeIdentifierSexualActivity', 0, d(2024, 1, 1)),
        ]));
        expect(e.note).toBe('Sexual Activity');
        const log = ledgerEntryToLogEntry(e);
        expect(log.symptoms).toBeUndefined();
        expect(log.note).toBe('Sexual Activity');
    });
});

describe('healthkitMapping — other identifiers preserved as notes', () => {
    it('renders value-bearing types in Apple vocabulary', () => {
        const entries = mapHealthKitSamples(set([
            cat('HKCategoryTypeIdentifierContraceptive', 6, d(2024, 1, 1)),           // Oral
            cat('HKCategoryTypeIdentifierCervicalMucusQuality', 5, d(2024, 1, 2)),    // Egg White
            cat('HKCategoryTypeIdentifierOvulationTestResult', 2, d(2024, 1, 3)),     // Positive
        ]));
        expect(entries[0].note).toBe('Contraceptive: Oral');
        expect(entries[1].note).toBe('Cervical Mucus: Egg White');
        expect(entries[2].note).toBe('Ovulation Test: Positive');
    });

    it('renders presence types (pregnancy/lactation) as a bare label', () => {
        const entries = mapHealthKitSamples(set([
            cat('HKCategoryTypeIdentifierPregnancy', 0, d(2024, 1, 1)),
            cat('HKCategoryTypeIdentifierLactation', 0, d(2024, 1, 2)),
        ]));
        expect(entries[0].note).toBe('Pregnancy');
        expect(entries[1].note).toBe('Lactation');
    });

    it('preserves an entirely unknown category type as titleized note text', () => {
        const [e] = mapHealthKitSamples(set([
            cat('HKCategoryTypeIdentifierPersistentIntermenstrualBleeding', 0, d(2024, 1, 1)),
        ]));
        expect(e.note).toBe('Persistent Intermenstrual Bleeding');
    });
});

describe('healthkitMapping — local-day / DST boundary', () => {
    it('folds a late-evening sample to its LOCAL calendar day (no UTC off-by-one)', () => {
        const sample = d(2024, 3, 10, 23); // 11pm local on the 10th
        const [e] = mapHealthKitSamples(set([cat('HKCategoryTypeIdentifierMenstrualFlow', 3, sample)]));
        const local = new Date(e.ts);
        expect(local.getFullYear()).toBe(2024);
        expect(local.getMonth()).toBe(2);   // March (0-based)
        expect(local.getDate()).toBe(10);   // same local day, NOT the 11th
        expect(local.getHours()).toBe(0);   // folded to local midnight
    });

    it('localDayTs zeroes the time component in local terms', () => {
        const ts = localDayTs(d(2024, 6, 15, 18));
        expect(new Date(ts).getHours()).toBe(0);
        expect(new Date(ts).getDate()).toBe(15);
    });
});

describe('healthkitMapping — cycle boundaries', () => {
    it("prefers Apple's HKMenstrualCycleStart metadata for isStart", () => {
        // Two back-to-back period runs with NO gap between them; only Apple's
        // metadata can tell the second cycle's start apart.
        const entries = mapHealthKitSamples(set([
            cat('HKCategoryTypeIdentifierMenstrualFlow', 3, d(2024, 1, 1), { HKMenstrualCycleStart: true }),
            cat('HKCategoryTypeIdentifierMenstrualFlow', 3, d(2024, 1, 2), { HKMenstrualCycleStart: false }),
            cat('HKCategoryTypeIdentifierMenstrualFlow', 3, d(2024, 1, 3), { HKMenstrualCycleStart: true }),
        ]));
        expect(entries[0].isStart).toBe(true);
        expect(entries[1].isStart).toBeUndefined();
        expect(entries[2].isStart).toBe(true);   // new cycle start mid-run
        expect(entries[1].isEnd).toBe(true);      // day before a new cycle start = end
    });

    it('falls back to gap detection when NO cycle-start metadata is present', () => {
        const entries = mapHealthKitSamples(set([
            cat('HKCategoryTypeIdentifierMenstrualFlow', 2, d(2024, 1, 1)),
            cat('HKCategoryTypeIdentifierMenstrualFlow', 2, d(2024, 1, 2)),
            // 5-day gap → new run
            cat('HKCategoryTypeIdentifierMenstrualFlow', 2, d(2024, 1, 7)),
        ]));
        expect(entries[0].isStart).toBe(true);
        expect(entries[0].isEnd).toBeUndefined();
        expect(entries[1].isEnd).toBe(true);
        expect(entries[2].isStart).toBe(true);
        expect(entries[2].isEnd).toBe(true);
    });
});

describe('healthkitMapping — merged day + empty set', () => {
    it('merges BBT and flow on the same day into one entry', () => {
        const entries = mapHealthKitSamples(set(
            [cat('HKCategoryTypeIdentifierMenstrualFlow', 3, d(2024, 1, 1))],
            [bbt(36.7, d(2024, 1, 1, 6))],
        ));
        expect(entries).toHaveLength(1);
        expect(entries[0].flow).toBe(2);
        expect(entries[0].bbt).toBe(36.7);
    });

    it('returns [] for an empty sample set', () => {
        const entries: LedgerEntry[] = mapHealthKitSamples(set([], []));
        expect(entries).toEqual([]);
    });
});

describe('healthkitMapping — review regressions', () => {
    it("does not invent a cycle start on a gap when Apple's metadata is present", () => {
        // Nov 1,2,3,5,6 logged; Apple says only Nov 1 starts a cycle. The missing
        // Nov 4 must NOT open a phantom cycle on Nov 5, or PredictionEngine reads
        // a 4-day cycle from start-to-start.
        const entries = mapHealthKitSamples({
            categorySamples: [
                cat('HKCategoryTypeIdentifierMenstrualFlow', 3, d(2024, 11, 1), { HKMenstrualCycleStart: true }),
                cat('HKCategoryTypeIdentifierMenstrualFlow', 3, d(2024, 11, 2), { HKMenstrualCycleStart: false }),
                cat('HKCategoryTypeIdentifierMenstrualFlow', 3, d(2024, 11, 3), { HKMenstrualCycleStart: false }),
                cat('HKCategoryTypeIdentifierMenstrualFlow', 3, d(2024, 11, 5), { HKMenstrualCycleStart: false }),
                cat('HKCategoryTypeIdentifierMenstrualFlow', 3, d(2024, 11, 6), { HKMenstrualCycleStart: false }),
            ],
            quantitySamples: [],
        });
        const starts = entries.filter((e) => e.isStart).map((e) => new Date(e.ts).getDate());
        expect(starts).toEqual([1]);
    });

    it('still falls back to the gap heuristic when no cycle-start metadata exists', () => {
        const entries = mapHealthKitSamples({
            categorySamples: [
                cat('HKCategoryTypeIdentifierMenstrualFlow', 3, d(2024, 11, 1)),
                cat('HKCategoryTypeIdentifierMenstrualFlow', 3, d(2024, 11, 2)),
                cat('HKCategoryTypeIdentifierMenstrualFlow', 3, d(2024, 11, 20)),
            ],
            quantitySamples: [],
        });
        const starts = entries.filter((e) => e.isStart).map((e) => new Date(e.ts).getDate());
        expect(starts).toEqual([1, 20]);
    });

    it('keeps the EARLIEST basal temperature of the day, not the last reading', () => {
        const morning = new Date(2024, 4, 10, 6, 30);
        const evening = new Date(2024, 4, 10, 21, 0);
        // Deliberately evening-first: correctness must not depend on input order.
        const entries = mapHealthKitSamples({
            categorySamples: [],
            quantitySamples: [bbt(37.9, evening), bbt(36.4, morning)],
        });
        expect(entries).toHaveLength(1);
        expect(entries[0].bbt).toBeCloseTo(36.4, 5);
    });
});
