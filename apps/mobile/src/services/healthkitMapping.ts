/**
 * healthkitMapping — Apple Health samples → import-domain `LedgerEntry[]`.
 *
 * Produces the SAME `LedgerEntry` shape the file parsers emit, so everything
 * downstream (`ledgerEntryToLogEntry`, symptom extraction, BBT unit inference,
 * preview, commit) is shared and unchanged. Structured homes:
 *
 *   menstrualFlow                → isPeriod + flow (0..3)
 *   intermenstrualBleeding       → spotting (flow 0)
 *   basalBodyTemperature (BBT)   → entry.bbt (clamped, Celsius)
 *   sexualActivity               → note "Sex Protected"/"Sex Unprotected"/…,
 *                                  lifted to sex_protected/sex_unprotected pills
 *                                  by extractSymptomsFromNote downstream
 *
 * Every other reproductive-health identifier — and any unknown enum value — is
 * PRESERVED as note text in Apple's own vocabulary, never dropped.
 *
 * Enum values are hardcoded from the installed d.ts
 * (generated/healthkit.generated.d.ts) so this module has NO dependency on the
 * native library and its tests need no mock.
 *
 * DST / midnight-UTC trap: sample instants are folded to the LOCAL calendar day
 * (getFullYear/getMonth/getDate → local midnight ts), matching the file parsers
 * and `toLocalIsoDate`. Using UTC slicing would push evening-local samples to
 * the next day — the documented off-by-one.
 */
import { LedgerEntry } from '../models/ImportTypes';
import { clampTemperature, inferTemperatureUnit } from '../utils/temperature';
import { applyBoundaryFlags } from './ImportService';
import type { HealthKitSampleSet, HealthKitCategorySample, HealthKitQuantitySample } from './HealthKitSource';

// --- Category value enums (from generated/healthkit.generated.d.ts) ----------

const MENSTRUAL_FLOW = { unspecified: 1, light: 2, medium: 3, heavy: 4, none: 5 } as const;

// value → 0..3 flow scale (FLOW_TO_INTENSITY in ImportService: 0 spotting …3 heavy)
const MENSTRUAL_FLOW_TO_SCALE: Record<number, number> = {
    [MENSTRUAL_FLOW.unspecified]: 2, // no intensity given → medium (mirrors the parsers)
    [MENSTRUAL_FLOW.light]: 1,
    [MENSTRUAL_FLOW.medium]: 2,
    [MENSTRUAL_FLOW.heavy]: 3,
};

const CONTRACEPTIVE_LABELS: Record<number, string> = {
    1: 'Unspecified', 2: 'Implant', 3: 'Injection', 4: 'Intrauterine Device',
    5: 'Intravaginal Ring', 6: 'Oral', 7: 'Patch',
};
const CERVICAL_MUCUS_LABELS: Record<number, string> = {
    1: 'Dry', 2: 'Sticky', 3: 'Creamy', 4: 'Watery', 5: 'Egg White',
};
const OVULATION_LABELS: Record<number, string> = {
    1: 'Negative', 2: 'Positive', 3: 'Indeterminate', 4: 'Estrogen Surge',
};
const TEST_RESULT_LABELS: Record<number, string> = {
    1: 'Negative', 2: 'Positive', 3: 'Indeterminate',
};

const CATEGORY_VALUE_NOT_APPLICABLE = 0;

// Metadata keys (from CategoryTypedMetadata in the generated d.ts).
const META_CYCLE_START = 'HKMenstrualCycleStart';
const META_PROTECTION_USED = 'HKSexualActivityProtectionUsed';

// --- Per-day accumulator ------------------------------------------------------

interface DayAcc {
    ts: number;
    sawPeriod: boolean;
    periodFlow?: number;      // 1..3 (or 2 default) once a period sample lands
    sawSpotting: boolean;
    bbt?: number;
    /** Instant the winning bbt was measured, so the EARLIEST reading wins. */
    bbtAtMs?: number;
    cycleStart: boolean;
    notes: string[];
}

/** Fold a sample instant to LOCAL-day midnight (avoids the UTC off-by-one). */
export function localDayTs(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function titleizeIdentifier(identifier: string): string {
    return identifier
        .replace(/^HKCategoryTypeIdentifier/, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim();
}

function addNote(acc: DayAcc, text: string) {
    if (text && !acc.notes.includes(text)) acc.notes.push(text);
}

/**
 * Map a full HealthKit sample set to import-domain LedgerEntry[], ts-ascending.
 *
 * Cycle boundaries: when ANY menstrualFlow sample carries the
 * `HKMenstrualCycleStart` metadata, Apple's authoritative cycle-start signal is
 * used for isStart (and isEnd is derived from gaps + the next cycle start).
 * Otherwise it falls back entirely to the 1.5-day-gap `applyBoundaryFlags`.
 */
export function mapHealthKitSamples(set: HealthKitSampleSet): LedgerEntry[] {
    const byDay = new Map<number, DayAcc>();
    const cycleStartDays = new Set<number>();
    let hasCycleStartMetadata = false;

    const accFor = (ts: number): DayAcc => {
        let acc = byDay.get(ts);
        if (!acc) {
            acc = { ts, sawPeriod: false, sawSpotting: false, cycleStart: false, notes: [] };
            byDay.set(ts, acc);
        }
        return acc;
    };

    for (const sample of set.categorySamples) {
        mapCategorySample(sample, accFor, cycleStartDays, () => { hasCycleStartMetadata = true; });
    }
    for (const sample of set.quantitySamples) {
        mapQuantitySample(sample, accFor);
    }

    // Resolve each day into a LedgerEntry, dropping empty days.
    const entries: LedgerEntry[] = [];
    for (const acc of byDay.values()) {
        const entry: LedgerEntry = { ts: acc.ts, isPeriod: acc.sawPeriod, source: 'healthkit' };

        if (acc.sawPeriod) {
            entry.flow = acc.periodFlow ?? 2;
        } else if (acc.sawSpotting) {
            entry.flow = 0; // spotting
        }

        if (acc.bbt !== undefined) entry.bbt = acc.bbt;
        if (acc.notes.length > 0) entry.note = acc.notes.join(', ');

        // Drop days that carry nothing importable (e.g. a lone "no flow" sample).
        if (!entry.isPeriod && entry.flow === undefined && entry.bbt === undefined && !entry.note) {
            continue;
        }
        entries.push(entry);
    }

    entries.sort((a, b) => a.ts - b.ts);

    if (hasCycleStartMetadata) {
        applyCycleStartBoundaries(entries, cycleStartDays);
    } else {
        applyBoundaryFlags(entries);
    }

    return entries;
}

function mapCategorySample(
    sample: HealthKitCategorySample,
    accFor: (ts: number) => DayAcc,
    cycleStartDays: Set<number>,
    markCycleStartMetadata: () => void,
): void {
    const ts = localDayTs(sample.startDate);
    const acc = accFor(ts);
    const value = sample.value;
    const meta = sample.metadata ?? {};

    switch (sample.categoryType) {
        case 'HKCategoryTypeIdentifierMenstrualFlow': {
            if (Object.prototype.hasOwnProperty.call(meta, META_CYCLE_START)) {
                markCycleStartMetadata();
                if (meta[META_CYCLE_START] === true) {
                    acc.cycleStart = true;
                    cycleStartDays.add(ts);
                }
            }
            if (value === MENSTRUAL_FLOW.none) {
                // Explicit "no flow" day — not a period, no flow value.
                return;
            }
            acc.sawPeriod = true;
            const scale = MENSTRUAL_FLOW_TO_SCALE[value];
            if (scale === undefined) {
                // Unknown enum value: default medium, preserve the raw reading.
                acc.periodFlow = 2;
                addNote(acc, `Menstrual Flow: ${value}`);
            } else {
                acc.periodFlow = scale;
            }
            return;
        }
        case 'HKCategoryTypeIdentifierIntermenstrualBleeding':
            acc.sawSpotting = true;
            return;
        case 'HKCategoryTypeIdentifierSexualActivity': {
            const protectionUsed = meta[META_PROTECTION_USED];
            if (protectionUsed === true) addNote(acc, 'Sex Protected');
            else if (protectionUsed === false) addNote(acc, 'Sex Unprotected');
            else addNote(acc, 'Sexual Activity');
            return;
        }
        case 'HKCategoryTypeIdentifierCervicalMucusQuality':
            addNote(acc, `Cervical Mucus: ${CERVICAL_MUCUS_LABELS[value] ?? value}`);
            return;
        case 'HKCategoryTypeIdentifierOvulationTestResult':
            addNote(acc, `Ovulation Test: ${OVULATION_LABELS[value] ?? value}`);
            return;
        case 'HKCategoryTypeIdentifierProgesteroneTestResult':
            addNote(acc, `Progesterone Test: ${TEST_RESULT_LABELS[value] ?? value}`);
            return;
        case 'HKCategoryTypeIdentifierPregnancyTestResult':
            addNote(acc, `Pregnancy Test: ${TEST_RESULT_LABELS[value] ?? value}`);
            return;
        case 'HKCategoryTypeIdentifierContraceptive':
            addNote(acc, `Contraceptive: ${CONTRACEPTIVE_LABELS[value] ?? value}`);
            return;
        case 'HKCategoryTypeIdentifierPregnancy':
            addNote(acc, 'Pregnancy');
            return;
        case 'HKCategoryTypeIdentifierLactation':
            addNote(acc, 'Lactation');
            return;
        default: {
            // Every other reproductive-health identifier (persistent/prolonged/
            // irregular/infrequent cycles, and any type added later) → note text
            // in Apple's own vocabulary. Value appended only when meaningful.
            const label = titleizeIdentifier(sample.categoryType);
            addNote(acc, value === CATEGORY_VALUE_NOT_APPLICABLE ? label : `${label}: ${value}`);
            return;
        }
    }
}

function mapQuantitySample(sample: HealthKitQuantitySample, accFor: (ts: number) => DayAcc): void {
    if (sample.quantityType !== 'HKQuantityTypeIdentifierBasalBodyTemperature') {
        // BBT is the only quantity type we query; ignore anything unexpected.
        return;
    }
    if (typeof sample.quantity !== 'number' || !Number.isFinite(sample.quantity)) return;
    const ts = localDayTs(sample.startDate);
    const acc = accFor(ts);
    // BASAL body temperature is the resting measurement taken on waking, so when
    // a day holds several readings the EARLIEST one is the basal value. Plain
    // last-write-wins would let an evening reading (or a third-party app's write)
    // replace the morning measurement and drive the temperature field and charts.
    const measuredAt = sample.startDate.getTime();
    if (acc.bbtAtMs !== undefined && measuredAt >= acc.bbtAtMs) return;
    // BBT is read in Celsius; clamp to the physiological range for its unit.
    const unit = inferTemperatureUnit(sample.quantity);
    acc.bbt = clampTemperature(sample.quantity, unit);
    acc.bbtAtMs = measuredAt;
}

/**
 * Boundary flags using Apple's authoritative cycle-start metadata for isStart,
 * with gap-based isEnd (a period day is an end when the next period day is >1.5d
 * away, absent, or itself a new cycle start). Requires ts-ascending input.
 */
function applyCycleStartBoundaries(entries: LedgerEntry[], cycleStartDays: Set<number>): void {
    const DAY_1_5 = 24 * 60 * 60 * 1000 * 1.5;
    // When Apple reported cycle starts at all, that signal is AUTHORITATIVE for
    // isStart and must not be OR-ed with the gap heuristic: a single unlogged day
    // mid-cycle would otherwise open a phantom cycle on the next logged day, and
    // PredictionEngine reads start-to-start as cycle length. The heuristic is the
    // fallback for exports that carry no HKMenstrualCycleStart metadata at all.
    const appleKnowsStarts = cycleStartDays.size > 0;
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        delete entry.isStart;
        delete entry.isEnd;
        if (!entry.isPeriod) continue;

        const prev = i > 0 ? entries[i - 1] : null;
        const next = i < entries.length - 1 ? entries[i + 1] : null;

        const isStart = appleKnowsStarts
            ? cycleStartDays.has(entry.ts)
            : !prev || !prev.isPeriod || entry.ts - prev.ts > DAY_1_5;
        if (isStart) {
            entry.isStart = true;
        }
        if (!next || !next.isPeriod || next.ts - entry.ts > DAY_1_5 || cycleStartDays.has(next.ts)) {
            entry.isEnd = true;
        }
    }
}
