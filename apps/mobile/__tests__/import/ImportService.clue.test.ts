import { describe, it, expect } from 'vitest';
import { detectSource, parseClueExport, parseClueMeasurements, ledgerEntryToLogEntry } from '../../src/services/ImportService';
import clueSample from './fixtures/clue-sample.json';
import clueMeasurements from './fixtures/clue-measurements-sample.json';
import { ClueExport, ClueMeasurement } from '../../src/models/ImportTypes';

describe('ImportService - Clue', () => {
    it('detectSource returns "clue" for Clue-shaped JSON', () => {
        expect(detectSource(clueSample)).toBe('clue');
    });

    it('rejects JSON without data array', () => {
        expect(() => parseClueExport({} as any)).toThrow('missing data array');
        expect(() => parseClueExport({ data: "not an array" } as any)).toThrow('missing data array');
    });

    it('parses correct entry count and tracks stats', () => {
        const result = parseClueExport(clueSample as unknown as ClueExport);
        expect(result.source).toBe('clue');
        expect(result.entries.length).toBe(7); // 7 valid days in the fixture
        expect(result.stats.totalDays).toBe(7);
        expect(result.stats.skippedDays).toBe(0);
        expect(result.stats.periodDays).toBe(5); // 5 days with period/* keys
        expect(result.stats.spottingDays).toBe(1); // 1 day with spotting
    });

    it('maps flow intensity correctly based on Clue tags', () => {
        const result = parseClueExport(clueSample as unknown as ClueExport);

        // Jan 1: period/light -> flow: 1
        const jan1 = result.entries.find(e => e.ts === new Date(2024, 0, 1).getTime());
        expect(jan1?.isPeriod).toBe(true);
        expect(jan1?.flow).toBe(1);

        // Jan 2: period/heavy -> flow: 3
        const jan2 = result.entries.find(e => e.ts === new Date(2024, 0, 2).getTime());
        expect(jan2?.isPeriod).toBe(true);
        expect(jan2?.flow).toBe(3);

        // Jan 3: period/medium -> flow: 2
        const jan3 = result.entries.find(e => e.ts === new Date(2024, 0, 3).getTime());
        expect(jan3?.isPeriod).toBe(true);
        expect(jan3?.flow).toBe(2);
    });

    it('handles spotting as non-period with flow 0', () => {
        const result = parseClueExport(clueSample as unknown as ClueExport);
        const jan4 = result.entries.find(e => e.ts === new Date(2024, 0, 4).getTime());

        expect(jan4?.isPeriod).toBe(false);
        expect(jan4?.flow).toBe(0);
    });

    it('sets isStart and isEnd flags on consecutive runs', () => {
        const result = parseClueExport(clueSample as unknown as ClueExport);

        // Cycle 1: Jan 1 - Jan 3 (Jan 4 is spotting, so period ends Jan 3)
        const jan1 = result.entries.find(e => e.ts === new Date(2024, 0, 1).getTime());
        const jan2 = result.entries.find(e => e.ts === new Date(2024, 0, 2).getTime());
        const jan3 = result.entries.find(e => e.ts === new Date(2024, 0, 3).getTime());

        expect(jan1?.isStart).toBe(true);
        expect(jan1?.isEnd).toBeUndefined();

        expect(jan2?.isStart).toBeUndefined();
        expect(jan2?.isEnd).toBeUndefined();

        expect(jan3?.isStart).toBeUndefined();
        expect(jan3?.isEnd).toBe(true);

        // Cycle 2: Jan 29 - Jan 30
        const jan29 = result.entries.find(e => e.ts === new Date(2024, 0, 29).getTime());
        const jan30 = result.entries.find(e => e.ts === new Date(2024, 0, 30).getTime());

        expect(jan29?.isStart).toBe(true);
        expect(jan29?.isEnd).toBeUndefined();

        expect(jan30?.isStart).toBeUndefined();
        expect(jan30?.isEnd).toBe(true);
    });

    it('preserves bbt values natively', () => {
        const result = parseClueExport(clueSample as unknown as ClueExport);
        const jan20 = result.entries.find(e => e.ts === new Date(2024, 0, 20).getTime());

        expect(jan20?.bbt).toBe(98.6);
        expect(jan20?.isPeriod).toBe(false); // No period tags
    });

    it('maps symptoms to notes instead of unmapped keys', () => {
        const result = parseClueExport(clueSample as unknown as ClueExport);

        const jan1 = result.entries.find(e => e.ts === new Date(2024, 0, 1).getTime());
        expect(jan1?.note).toBe('Pain: Headache');
        expect(jan1?.unmapped).toBeUndefined();

        const jan2 = result.entries.find(e => e.ts === new Date(2024, 0, 2).getTime());
        expect(jan2?.note).toContain('Pain: Cramps');
        expect(jan2?.note).toContain('Feelings: Sad');

        // Warnings should be 0 because we mapped everything in the sample!
        expect(result.warnings.length).toBe(0);
    });

    it('all timestamps are local midnight', () => {
        const result = parseClueExport(clueSample as unknown as ClueExport);
        for (const entry of result.entries) {
            const date = new Date(entry.ts);
            expect(date.getHours()).toBe(0);
            expect(date.getMinutes()).toBe(0);
            expect(date.getSeconds()).toBe(0);
        }
    });

    it('gaps produce no interpolated entries', () => {
        const result = parseClueExport(clueSample as unknown as ClueExport);
        // Between Jan 4 and Jan 20 there's a gap
        const jan10 = result.entries.find(e => e.ts === new Date(2024, 0, 10).getTime());
        expect(jan10).toBeUndefined();
    });
});

/**
 * Regression suite for the real 2026 Clue export (`measurements.json`).
 *
 * That file is a top-level ARRAY of {type, date, value} records, not the legacy
 * `{data: [...]}` envelope. detectSource used to return 'unknown' for it, so the
 * real export could not be imported at all — useLedger threw
 * "Unrecognized JSON export schema (not Clue or Flo)".
 */
describe('ImportService - Clue (2026 measurements.json)', () => {
    const parse = () => parseClueMeasurements(clueMeasurements as unknown as ClueMeasurement[]);

    it('detectSource recognizes a top-level measurements array as clue', () => {
        expect(detectSource(clueMeasurements)).toBe('clue');
    });

    it('does not mistake an arbitrary array for a Clue export', () => {
        expect(detectSource([1, 2, 3])).toBe('unknown');
        expect(detectSource([])).toBe('unknown');
        expect(detectSource([{ foo: 'bar' }])).toBe('unknown');
    });

    it('parseClueExport dispatches an array to the measurements parser', () => {
        const viaEntryPoint = parseClueExport(clueMeasurements as any);
        expect(viaEntryPoint.source).toBe('clue');
        expect(viaEntryPoint.entries.length).toBe(parse().entries.length);
    });

    it('groups records by date into one entry per day', () => {
        const result = parse();
        // Distinct valid dates: 09-02, 09-03, 09-04, 09-14, 09-15 = 5
        expect(result.entries.length).toBe(5);
        expect(result.stats.totalDays).toBe(5);
    });

    it('maps period options light/medium/heavy to flow 1/2/3', () => {
        const result = parse();
        const day = (dd: number) => result.entries.find(e => e.ts === new Date(2030, 8, dd).getTime());

        expect(day(2)?.flow).toBe(3);   // heavy
        expect(day(3)?.flow).toBe(2);   // medium
        expect(day(4)?.flow).toBe(1);   // light
        expect(day(2)?.isPeriod).toBe(true);
        expect(result.stats.periodDays).toBe(3);
    });

    it('maps spotting to flow 0 and counts it', () => {
        const result = parse();
        const sep14 = result.entries.find(e => e.ts === new Date(2030, 8, 14).getTime());

        expect(sep14?.flow).toBe(0);
        expect(sep14?.isPeriod).toBe(false);
        expect(result.stats.spottingDays).toBe(1);
    });

    it('imports bbt.value.celsius but respects value.excluded', () => {
        const result = parse();
        const sep3 = result.entries.find(e => e.ts === new Date(2030, 8, 3).getTime());
        const sep4 = result.entries.find(e => e.ts === new Date(2030, 8, 4).getTime());

        expect(sep3?.bbt).toBe(36.62);
        // 39.91 was flagged excluded in Clue — importing it would corrupt BBT
        expect(sep4?.bbt).toBeUndefined();
        expect(result.warnings.some(w => w.includes('excluded'))).toBe(true);
    });

    it('handles array-shaped value (pain/energy/spotting) as well as object-shaped', () => {
        const result = parse();
        const sep2 = result.entries.find(e => e.ts === new Date(2030, 8, 2).getTime());

        // pain carries THREE options in an array; all must survive
        expect(sep2?.note).toContain('Period Cramps');
        expect(sep2?.note).toContain('Breast Tenderness');
        expect(sep2?.note).toContain('Lower Back');
        // energy is also array-shaped
        expect(sep2?.note).toContain('Exhausted');
    });

    it('maps birth_control_pill into note text using Clue\'s own vocabulary', () => {
        const result = parse();
        const sep15 = result.entries.find(e => e.ts === new Date(2030, 8, 15).getTime());
        expect(sep15?.note).toContain('Birth Control Pill: Taken');
    });

    it('does NOT adopt the Flo parser\'s note phrasing', () => {
        // Symmetric to the Flo suite's guard: note text stays in the source app's
        // own vocabulary. Two exports are not necessarily the same person, so the
        // sources must not converge on a shared free-text write pattern. They
        // converge on structured fields only (flow, bbt, symptom pills).
        for (const entry of parse().entries) {
            expect(entry.note || '').not.toContain('Medication: Pills');
        }
    });

    it('skips unparseable dates with a warning instead of emitting NaN entries', () => {
        const result = parse();
        expect(result.entries.every(e => Number.isFinite(e.ts))).toBe(true);
        expect(result.warnings.some(w => w.includes('unparseable date'))).toBe(true);
        expect(result.stats.skippedDays).toBe(1);
    });

    it('applies period boundary flags across grouped days', () => {
        const result = parse();
        const day = (dd: number) => result.entries.find(e => e.ts === new Date(2030, 8, dd).getTime());

        expect(day(2)?.isStart).toBe(true);
        expect(day(3)?.isStart).toBeUndefined();
        expect(day(4)?.isEnd).toBe(true);
    });

    it('recognized symptom phrases reach the app-domain LogEntry as pills', () => {
        const result = parse();
        const sep2 = result.entries.find(e => e.ts === new Date(2030, 8, 2).getTime())!;
        const log = ledgerEntryToLogEntry(sep2);

        expect(log.bleeding?.intensity).toBe('heavy');
        expect(log.symptoms).toContain('breast_tenderness');
    });
});

/**
 * Findings from the 2026-07-23 review.
 */
describe('ImportService - Clue (review hardening)', () => {
    it('preserves a record whose value shape is not understood', () => {
        // The whole point of this parser is that tracked data is never silently
        // ignored — an unrecognized `value` shape is exactly where that regresses.
        const unknownShape = [
            { type: 'period', date: '2030-09-02', value: { option: 'medium' } },
            { type: 'hydration', date: '2030-09-02', value: { litres: 2 } },
            { type: 'mystery', date: '2030-09-03', value: 'some-scalar' },
        ];
        const result = parseClueMeasurements(unknownShape as unknown as ClueMeasurement[]);

        const sep2 = result.entries.find(e => e.ts === new Date(2030, 8, 2).getTime());
        const sep3 = result.entries.find(e => e.ts === new Date(2030, 8, 3).getTime());
        expect(sep2?.note).toContain('Hydration');
        expect(sep3?.note).toContain('Mystery: some-scalar');
    });

    it('warns instead of silently skipping records with no date', () => {
        const undated = [
            { type: 'period', date: '2030-09-02', value: { option: 'medium' } },
            { type: 'period', value: { option: 'light' } },
        ];
        const result = parseClueMeasurements(undated as unknown as ClueMeasurement[]);

        expect(result.stats.skippedDays).toBe(1);
        expect(result.warnings.some(w => w.includes('no usable date'))).toBe(true);
    });

    it('drops a day whose only record was an excluded BBT', () => {
        const excludedOnly = [
            { type: 'bbt', date: '2030-09-09', value: { celsius: 39.9, excluded: true } },
        ];
        const result = parseClueMeasurements(excludedOnly as unknown as ClueMeasurement[]);

        expect(result.entries.length).toBe(0);
        expect(result.warnings.some(w => w.includes('excluded'))).toBe(true);
    });

    it('maps the Clue symptom options that previously fell through to free text', () => {
        const symptoms = [
            { type: 'pain', date: '2030-09-02', value: [{ option: 'period_cramps' }, { option: 'lower_back' }] },
            { type: 'energy', date: '2030-09-02', value: [{ option: 'exhausted' }] },
        ];
        const result = parseClueMeasurements(symptoms as unknown as ClueMeasurement[]);
        const log = ledgerEntryToLogEntry(result.entries[0]);

        expect(log.symptoms).toEqual(expect.arrayContaining(['cramps', 'back_pain', 'fatigue']));
    });
});
