import { describe, it, expect } from 'vitest';
import { detectSource, parseFloExport } from '../src/services/ImportService';
import floSample from './fixtures/flo-sample.json';
import { FloExport } from '../src/models/ImportTypes';

describe('ImportService - Flo', () => {
    it('detectSource returns "flo" for Flo-shaped JSON', () => {
        expect(detectSource(floSample)).toBe('flo');
    });

    it('rejects JSON without operationalData.cycles array', () => {
        expect(() => parseFloExport({} as any)).toThrow('missing cycles array');
        expect(() => parseFloExport({ operationalData: {} } as any)).toThrow('missing cycles array');
    });

    it('parses correct entry count and tracks stats', () => {
        const result = parseFloExport(floSample as unknown as FloExport);
        expect(result.source).toBe('flo');

        // Cycle 1: Jan 1 - Jan 5 (5 days)
        // Cycle 2: Jan 29 - Jan 29 (1 day)
        // Cycle 3: Feb 26 - Mar 2 (6 days, 2024 is leap year so Feb 26,27,28,29,Mar 1,2)
        expect(result.entries.length).toBe(12);

        expect(result.stats.totalDays).toBe(12);
        expect(result.stats.periodDays).toBe(12);
        expect(result.stats.spottingDays).toBe(0); // Flo doesn't have spotting ranges
        expect(result.stats.skippedDays).toBe(0);
    });

    it('all entries have isPeriod: true and flow 2', () => {
        const result = parseFloExport(floSample as unknown as FloExport);
        for (const entry of result.entries) {
            expect(entry.isPeriod).toBe(true);
            expect(entry.flow).toBe(2);
        }
    });

    it('sets isStart and isEnd flags correctly on cycles', () => {
        const result = parseFloExport(floSample as unknown as FloExport);

        // Cycle 1: Jan 1 - Jan 5
        const jan1 = result.entries.find(e => e.ts === new Date(2024, 0, 1).getTime());
        const jan3 = result.entries.find(e => e.ts === new Date(2024, 0, 3).getTime());
        const jan5 = result.entries.find(e => e.ts === new Date(2024, 0, 5).getTime());

        expect(jan1?.isStart).toBe(true);
        expect(jan1?.isEnd).toBeUndefined();

        expect(jan3?.isStart).toBeUndefined();
        expect(jan3?.isEnd).toBeUndefined();

        expect(jan5?.isStart).toBeUndefined();
        expect(jan5?.isEnd).toBe(true);
    });

    it('handles single-day period where both isStart and isEnd are true', () => {
        const result = parseFloExport(floSample as unknown as FloExport);

        // Cycle 2: Jan 29
        const jan29 = result.entries.find(e => e.ts === new Date(2024, 0, 29).getTime());

        expect(jan29?.isStart).toBe(true);
        expect(jan29?.isEnd).toBe(true);
    });

    it('all timestamps are local midnight', () => {
        const result = parseFloExport(floSample as unknown as FloExport);
        for (const entry of result.entries) {
            const date = new Date(entry.ts);
            expect(date.getHours()).toBe(0);
            expect(date.getMinutes()).toBe(0);
            expect(date.getSeconds()).toBe(0);
        }
    });

    it('maps cycle keys and cycle day into notes', () => {
        const result = parseFloExport(floSample as unknown as FloExport);

        const jan1 = result.entries.find(e => e.ts === new Date(2024, 0, 1).getTime());
        expect(jan1?.note).toContain('Symptom Cramps: 1');
        expect(jan1?.note).toContain('Flo Cycle Day: 1');
        expect(jan1?.unmapped).toBeUndefined();

        const jan2 = result.entries.find(e => e.ts === new Date(2024, 0, 2).getTime());
        expect(jan2?.note).toContain('Flo Cycle Day: 2');

        const jan29 = result.entries.find(e => e.ts === new Date(2024, 0, 29).getTime());
        expect(jan29?.note).toContain('Note: single day period edgecase');
    });

    it('detectSource returns unknown for garbage JSON', () => {
        expect(detectSource({ foo: "bar" })).toBe('unknown');
        expect(detectSource(null)).toBe('unknown');
        expect(detectSource("string")).toBe('unknown');
    });
});
