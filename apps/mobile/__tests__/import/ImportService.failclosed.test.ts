import { describe, it, expect } from 'vitest';
import { assertImportHasEntries } from '../../src/services/ImportService';
import { ImportResult } from '../../src/models/ImportTypes';

/**
 * The fail-closed guard behind the third diagnosed import defect.
 *
 * `useLedger.importData` used to return `{success: true, count: 0}` when a file
 * parsed but mapped to nothing, so the UI showed "Import Complete — Records
 * Inscribed: 0". The Flo NaN-date bug hid behind exactly that.
 *
 * The check originally lived inline in the hook, where it had NO test coverage
 * at all — the 2026-07-23 review pulled it into ImportService so it could be
 * asserted directly.
 */
const result = (over: Partial<ImportResult> = {}): ImportResult => ({
    source: 'flo',
    entries: [],
    warnings: [],
    stats: { totalDays: 0, periodDays: 0, spottingDays: 0, skippedDays: 0 },
    ...over,
});

describe('assertImportHasEntries', () => {
    it('throws when a recognized file produced no entries', () => {
        expect(() => assertImportHasEntries(result())).toThrow('found 0 valid entries');
    });

    it('names the detected source so the message is actionable', () => {
        expect(() => assertImportHasEntries(result({ source: 'flo' }))).toThrow(/Recognized as FLO/);
        expect(() => assertImportHasEntries(result({ source: 'clue' }))).toThrow(/Recognized as CLUE/);
    });

    it('throws on a null/undefined result rather than passing it through', () => {
        expect(() => assertImportHasEntries(null)).toThrow('found 0 valid entries');
        expect(() => assertImportHasEntries(undefined)).toThrow(/Recognized as the file/);
    });

    it('surfaces parser warnings so the user learns why it was empty', () => {
        const withWarnings = result({ warnings: ['Cycle starting X is invalid'] });
        expect(() => assertImportHasEntries(withWarnings)).toThrow(/Cycle starting X is invalid/);
    });

    it('caps the appended warnings so the message stays readable', () => {
        // A malformed file can emit one warning per cycle; the whole string ends
        // up in an alert box.
        const many = result({ warnings: Array.from({ length: 12 }, (_, i) => `w${i}`) });

        let message = '';
        try { assertImportHasEntries(many); } catch (e: any) { message = e.message; }

        expect(message).toContain('w0');
        expect(message).toContain('w2');
        expect(message).not.toContain('w3');
        expect(message).toContain('(+9 more)');
    });

    it('does not throw when entries were produced', () => {
        const ok = result({ entries: [{ ts: 1, isPeriod: true }] });
        expect(() => assertImportHasEntries(ok)).not.toThrow();
    });
});
