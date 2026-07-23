import { describe, it, expect } from 'vitest';
import { ledgerEntryToLogEntry } from '../../src/services/ImportService';
import { LedgerEntry } from '../../src/models/ImportTypes';

// Local-midnight ts for 2024-03-07
const TS = new Date(2024, 2, 7).getTime();

describe('ImportService - ledgerEntryToLogEntry (import -> app domain)', () => {
    it('maps flow intensity to bleeding.intensity (the LogScreen modal field)', () => {
        const cases: Array<[number, string]> = [
            [0, 'spotting'],
            [1, 'light'],
            [2, 'medium'],
            [3, 'heavy'],
        ];
        for (const [flow, intensity] of cases) {
            const entry: LedgerEntry = { ts: TS, isPeriod: flow > 0, flow, source: 'csv' };
            const log = ledgerEntryToLogEntry(entry);
            expect(log.bleeding).toEqual({ intensity });
        }
    });

    it('surfaces spotting as a bleeding card even though it is not a period day', () => {
        // Repro for bug #1: spotting (flow 0, isPeriod false) showed no card after import
        const entry: LedgerEntry = { ts: TS, isPeriod: false, flow: 0, source: 'csv' };
        const log = ledgerEntryToLogEntry(entry);
        expect(log.isPeriod).toBe(false);
        expect(log.bleeding?.intensity).toBe('spotting');
    });

    it('omits bleeding when there is no flow value', () => {
        const entry: LedgerEntry = { ts: TS, isPeriod: false, note: 'just a note', source: 'csv' };
        const log = ledgerEntryToLogEntry(entry);
        expect(log.bleeding).toBeUndefined();
    });

    // REGRESSION (T4 behavior change): imported bbt now lands in the dedicated
    // temperature field and is NO LONGER appended to the free-text note.
    it('maps bbt into temperature (not the note) with °C inferred by magnitude', () => {
        const entry: LedgerEntry = { ts: TS, isPeriod: false, bbt: 36.5, source: 'clue' };
        const log = ledgerEntryToLogEntry(entry);
        expect(log.temperature).toEqual({ value: 36.5, unit: 'C' });
        expect(log.note).toBeUndefined();
    });

    it('infers °F when the imported bbt magnitude is in the Fahrenheit range', () => {
        const entry: LedgerEntry = { ts: TS, isPeriod: false, bbt: 98.6, source: 'csv' };
        const log = ledgerEntryToLogEntry(entry);
        expect(log.temperature).toEqual({ value: 98.6, unit: 'F' });
    });

    it('keeps a free-text note untouched and does NOT append the bbt to it', () => {
        // 'Long day at work' maps to no symptom pill, so it stays as-is in the note.
        const entry: LedgerEntry = { ts: TS, isPeriod: true, flow: 2, note: 'Long day at work', bbt: 36.8, source: 'clue' };
        const log = ledgerEntryToLogEntry(entry);
        expect(log.note).toBe('Long day at work');
        expect(log.note).not.toContain('BBT');
        expect(log.symptoms).toBeUndefined();
        expect(log.temperature).toEqual({ value: 36.8, unit: 'C' });
        expect(log.bleeding?.intensity).toBe('medium');
    });

    it('lifts recognized symptom phrases from the note into structured pills', () => {
        // Repro for the CSV import bug: symptoms arrived as free text and never
        // populated their matching pills. "Backache" etc. map cleanly; "Body Aches"
        // and "Spotting / Bleeding" have no pill, so they stay in the note.
        const entry: LedgerEntry = {
            ts: TS,
            isPeriod: false,
            flow: 1,
            note: 'Backache, Spotting / Bleeding, Fatigue, Breast Sensitivity, Tender Breasts, Body Aches',
            source: 'csv',
        };
        const log = ledgerEntryToLogEntry(entry);
        // De-duplicated (Breast Sensitivity + Tender Breasts → one pill), first-seen order.
        expect(log.symptoms).toEqual(['back_pain', 'fatigue', 'breast_tenderness']);
        expect(log.note).toBe('Spotting / Bleeding, Body Aches');
    });

    it('drops the note entirely when every token maps to a pill', () => {
        const entry: LedgerEntry = { ts: TS, isPeriod: false, note: 'Backache', source: 'csv' };
        const log = ledgerEntryToLogEntry(entry);
        expect(log.symptoms).toEqual(['back_pain']);
        expect(log.note).toBeUndefined();
    });

    it('leaves note undefined when there is neither a note nor a bbt', () => {
        const entry: LedgerEntry = { ts: TS, isPeriod: true, flow: 2, source: 'flo' };
        const log = ledgerEntryToLogEntry(entry);
        expect(log.note).toBeUndefined();
    });

    it('preserves period boundary flags and timestamp', () => {
        const entry: LedgerEntry = { ts: TS, isPeriod: true, flow: 2, isStart: true, isEnd: false, source: 'flo' };
        const log = ledgerEntryToLogEntry(entry);
        expect(log.ts).toBe(TS);
        expect(log.isStart).toBe(true);
        expect(log.isEnd).toBeUndefined();
        expect(log.event).toBe('period_start');
        expect(log.date).toBe('2024-03-07');
    });

    it('ignores an out-of-range flow value instead of inventing an intensity', () => {
        const entry: LedgerEntry = { ts: TS, isPeriod: true, flow: 9, source: 'csv' };
        const log = ledgerEntryToLogEntry(entry);
        expect(log.bleeding).toBeUndefined();
    });

    // T3: provenance must survive the import -> app-domain mapping so a record's
    // origin is queryable on the persisted LogEntry.
    it('round-trips the source provenance tag for clue/flo/csv', () => {
        for (const source of ['clue', 'flo', 'csv'] as const) {
            const entry: LedgerEntry = { ts: TS, isPeriod: true, flow: 2, source };
            expect(ledgerEntryToLogEntry(entry).source).toBe(source);
        }
    });

    it('leaves source undefined when the import entry carries none', () => {
        const entry: LedgerEntry = { ts: TS, isPeriod: false, note: 'hand-typed' };
        expect(ledgerEntryToLogEntry(entry).source).toBeUndefined();
    });
});
