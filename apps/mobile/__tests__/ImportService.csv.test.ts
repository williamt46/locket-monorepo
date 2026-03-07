import { describe, it, expect } from 'vitest';
import { detectFormat, parseCsvExport } from '../src/services/ImportService';
import * as fs from 'fs';
import * as path from 'path';

describe('ImportService - CSV Auto-Detection', () => {
    it('detectFormat returns "csv" for CSV strings', () => {
        const csv = "date,flow\n2024-01-01,light";
        expect(detectFormat(csv)).toBe('csv');
    });

    it('detectFormat returns "json" for JSON strings', () => {
        expect(detectFormat('{"data":[]}')).toBe('json');
        expect(detectFormat('[{"day":"2024-01-01"}]')).toBe('json');
    });

    it('detectFormat returns "unknown" for garbage strings', () => {
        expect(detectFormat('hello world')).toBe('unknown');
        expect(detectFormat('')).toBe('unknown');
    });
});

describe('ImportService - CSV Parsing', () => {

    let isoCsv = '';
    let usCsv = '';

    // Load fixtures from filesystem since we can't cleanly import raw text via vite in test easily without setup
    try {
        isoCsv = fs.readFileSync(path.join(__dirname, 'fixtures', 'csv-sample-iso.csv'), 'utf8');
        usCsv = fs.readFileSync(path.join(__dirname, 'fixtures', 'csv-sample-us.csv'), 'utf8');
    } catch (e) {
        console.warn('Could not load CSV fixtures, tests may fail if files are missing.');
    }

    it('parses correct entry count from ISO fixture', () => {
        const result = parseCsvExport(isoCsv);
        expect(result.source).toBe('csv');
        // 7 rows of actual data, 1 empty/skipped
        expect(result.entries.length).toBe(7);
        expect(result.stats.totalDays).toBe(7);
        expect(result.stats.periodDays).toBe(5);
        expect(result.stats.spottingDays).toBe(1);
    });

    it('maps flow intensity correctly based on column headers and text values', () => {
        const result = parseCsvExport(isoCsv);

        // Jan 1: light -> flow: 1
        const jan1 = result.entries.find(e => e.ts === new Date(2024, 0, 1).getTime());
        expect(jan1?.isPeriod).toBe(true);
        expect(jan1?.flow).toBe(1);

        // Jan 2: heavy -> flow: 3
        const jan2 = result.entries.find(e => e.ts === new Date(2024, 0, 2).getTime());
        expect(jan2?.isPeriod).toBe(true);
        expect(jan2?.flow).toBe(3);

        // Jan 3: medium -> flow: 2
        const jan3 = result.entries.find(e => e.ts === new Date(2024, 0, 3).getTime());
        expect(jan3?.isPeriod).toBe(true);
        expect(jan3?.flow).toBe(2);
    });

    it('handles spotting correctly', () => {
        const result = parseCsvExport(isoCsv);
        // Jan 4: spotting -> flow: 0, isPeriod: false
        const jan4 = result.entries.find(e => e.ts === new Date(2024, 0, 4).getTime());
        expect(jan4?.isPeriod).toBe(false);
        expect(jan4?.flow).toBe(0);
    });

    it('sets isStart and isEnd flags correctly consecutive runs', () => {
        const result = parseCsvExport(isoCsv);

        const jan1 = result.entries.find(e => e.ts === new Date(2024, 0, 1).getTime());
        const jan3 = result.entries.find(e => e.ts === new Date(2024, 0, 3).getTime());

        const jan29 = result.entries.find(e => e.ts === new Date(2024, 0, 29).getTime());
        const jan30 = result.entries.find(e => e.ts === new Date(2024, 0, 30).getTime());

        expect(jan1?.isStart).toBe(true);
        expect(jan3?.isEnd).toBe(true);

        expect(jan29?.isStart).toBe(true);
        expect(jan30?.isEnd).toBe(true);
    });

    it('preserves bbt and note values natively', () => {
        const result = parseCsvExport(isoCsv);
        const jan1 = result.entries.find(e => e.ts === new Date(2024, 0, 1).getTime());
        expect(jan1?.bbt).toBe(97.4);
        expect(jan1?.note).toBe('first day of year, Mood: sad');

        const jan20 = result.entries.find(e => e.ts === new Date(2024, 0, 20).getTime());
        expect(jan20?.bbt).toBe(98.6);
        expect(jan20?.note).toBe('ovulation maybe');
    });

    it('maps unrecognized columns into notes defensively', () => {
        const result = parseCsvExport(isoCsv);
        const jan1 = result.entries.find(e => e.ts === new Date(2024, 0, 1).getTime());

        // 'mood' is an unrecognized column, should be stashed as a note string
        expect(jan1?.note).toContain('Mood: sad');
        expect(jan1?.unmapped).toBeUndefined();
    });

    it('gaps produce no interpolated entries', () => {
        const result = parseCsvExport(isoCsv);
        const jan10 = result.entries.find(e => e.ts === new Date(2024, 0, 10).getTime());
        expect(jan10).toBeUndefined();
    });

    it('handles US-format dates correctly and auto-detects based on first row', () => {
        const result = parseCsvExport(usCsv);
        expect(result.source).toBe('csv');
        expect(result.entries.length).toBe(7);

        // US fixture has 01/20/2024 (Jan 20)
        const jan20 = result.entries.find(e => e.ts === new Date(2024, 0, 20).getTime());
        expect(jan20?.bbt).toBe(98.6);
        expect(jan20?.note).toBe('ovulation maybe');
    });

    it('handles numeric flow values (0-3)', () => {
        const result = parseCsvExport(usCsv);

        // Jan 1: 1 -> flow: 1
        const jan1 = result.entries.find(e => e.ts === new Date(2024, 0, 1).getTime());
        expect(jan1?.flow).toBe(1);

        // Jan 2: 3 -> flow: 3
        const jan2 = result.entries.find(e => e.ts === new Date(2024, 0, 2).getTime());
        expect(jan2?.flow).toBe(3);

        // Jan 4: 0 -> flow: 0 (spotting)
        const jan4 = result.entries.find(e => e.ts === new Date(2024, 0, 4).getTime());
        expect(jan4?.flow).toBe(0);
        expect(jan4?.isPeriod).toBe(false);
    });

    it('ambiguous date format emits warning', () => {
        // Build an ambiguous CSV manually where the first row is 05/06/2024
        const amCsv = "Date,Flow\n05/06/2024,light\n";
        const result = parseCsvExport(amCsv);

        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain("Ambiguous date format");

        // Defaults to US (MM/DD) -> May 6
        const may6 = result.entries.find(e => e.ts === new Date(2024, 4, 6).getTime());
        expect(may6).toBeDefined();
        expect(result.stats.periodDays).toBe(1);
    });

    it('rejects CSV without a date/day column', () => {
        const badCsv = "flow,bbt\nlight,98.6\n";
        expect(() => parseCsvExport(badCsv)).toThrow('CSV must contain a date column');
    });

    it('empty rows and trailing newlines are skipped gracefully', () => {
        const dirtyCsv = "Date,Flow\n\n2024-01-01,light\n\n2024-01-02,heavy\n\r\n";
        const result = parseCsvExport(dirtyCsv);
        expect(result.entries.length).toBe(2);
    });
});
