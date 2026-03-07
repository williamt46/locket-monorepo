import { describe, it, expect } from 'vitest';
import { detectSource, parseClueExport } from '../src/services/ImportService';
import clueSample from './fixtures/clue-sample.json';
import { ClueExport } from '../src/models/ImportTypes';

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
