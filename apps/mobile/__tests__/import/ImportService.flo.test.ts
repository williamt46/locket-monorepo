import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { detectSource, parseFloExport, ledgerEntryToLogEntry } from '../../src/services/ImportService';
import floSample from './fixtures/flo-sample.json';
import floSpaceDateSample from './fixtures/flo-spacedate-sample.json';
import floContainersSample from './fixtures/flo-containers-sample.json';
import { FloExport } from '../../src/models/ImportTypes';

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

/**
 * Regression suite for the real-export date format.
 *
 * Flo writes "YYYY-MM-DD 00:00:00.0". The old parser did
 * `period_start_date.split('-').map(Number)`, so the day token became
 * Number("04 00:00:00.0") === NaN. daysDiff was then NaN, and because
 * `NaN <= 0 || NaN > 30` is false it slipped past the sanity guard into
 * `for (let i = 0; i < NaN; i++)` — which never iterates. Every real export
 * therefore produced ZERO entries and ZERO warnings.
 */
describe('ImportService - Flo (real export date format)', () => {
    const parse = () => parseFloExport(floSpaceDateSample as unknown as FloExport);

    it('parses space-separated "YYYY-MM-DD 00:00:00.0" dates into entries', () => {
        const result = parse();

        // 7-day cycle (Mar 4-10) + 1-day cycle (Apr 1) = 8 entries.
        // The unparseable-date cycle and the 91-day cycle are both skipped.
        expect(result.entries.length).toBe(8);
        expect(result.stats.totalDays).toBe(8);
        expect(result.stats.periodDays).toBe(8);
    });

    it('produces local-midnight timestamps, not Invalid Date', () => {
        const result = parse();
        for (const entry of result.entries) {
            expect(Number.isFinite(entry.ts)).toBe(true);
            const d = new Date(entry.ts);
            expect(d.getHours()).toBe(0);
            expect(d.getMinutes()).toBe(0);
        }
        expect(result.entries[0].ts).toBe(new Date(2030, 2, 4).getTime());
        expect(result.entries.some(e => e.ts === new Date(2030, 3, 1).getTime())).toBe(true);
    });

    it('marks cycle boundaries across the parsed range', () => {
        const result = parse();

        const mar4 = result.entries.find(e => e.ts === new Date(2030, 2, 4).getTime());
        const mar10 = result.entries.find(e => e.ts === new Date(2030, 2, 10).getTime());
        const apr1 = result.entries.find(e => e.ts === new Date(2030, 3, 1).getTime());

        expect(mar4?.isStart).toBe(true);
        expect(mar10?.isEnd).toBe(true);
        // single-day cycle is both a start and an end
        expect(apr1?.isStart).toBe(true);
        expect(apr1?.isEnd).toBe(true);
    });

    it('fails closed on an unparseable date: warns and skips instead of silently passing NaN through', () => {
        const result = parse();

        expect(result.warnings.some(w => w.includes('unparseable date'))).toBe(true);
        // The bad cycle must not contribute a NaN-timestamped entry.
        expect(result.entries.every(e => Number.isFinite(e.ts))).toBe(true);
    });

    it('still rejects a suspiciously long cycle and keeps skippedDays finite', () => {
        const result = parse();

        expect(result.warnings.some(w => w.includes('suspiciously long'))).toBe(true);
        // 1 (unparseable) + 91 (Jun 1 - Aug 30 inclusive) = 92
        expect(result.stats.skippedDays).toBe(92);
        expect(Number.isFinite(result.stats.skippedDays)).toBe(true);
    });

    it('NaN daysDiff can never reach the day loop (the original silent-zero bug)', () => {
        // A cycle whose end date is unparseable would previously yield daysDiff NaN,
        // pass the `<= 0 || > 30` guard, and emit nothing without warning.
        const oneBadCycle = {
            operationalData: {
                cycles: [{ period_start_date: '2030-01-01 00:00:00.0', period_end_date: 'garbage-date' }]
            }
        };
        const result = parseFloExport(oneBadCycle as unknown as FloExport);

        expect(result.entries.length).toBe(0);
        // The point of the fix: zero entries is now always accompanied by a warning.
        expect(result.warnings.length).toBeGreaterThan(0);
    });
});

/**
 * Flo splits user data across FOUR containers under operationalData. The parser
 * used to read only `cycles`, so a real export silently dropped 31 contraceptive
 * pill logs, every symptom, both BBT readings and the free-text note — while
 * simultaneously dumping the user's Flo user_id and record ids into the note of
 * every period day.
 */
describe('ImportService - Flo (all four containers)', () => {
    const parse = () => parseFloExport(floContainersSample as unknown as FloExport);
    const day = (dd: number) => parse().entries.find(e => e.ts === new Date(2030, 2, dd).getTime());

    it('merges every container by date into one entry per day', () => {
        const result = parse();
        // period 03-04..03-06, plus 03-20, 03-21 (events) and 03-22 (note) = 6.
        // The deleted 03-23 pill record must not create a 7th.
        expect(result.entries.length).toBe(6);
        expect(result.stats.totalDays).toBe(6);
        expect(result.stats.periodDays).toBe(3);
    });

    it('imports contraceptive pill logs as note text in Flo\'s own vocabulary', () => {
        expect(day(5)?.note).toContain('Medication: Pills: Taken On Time');
        expect(day(21)?.note).toContain('Medication: Pills: Taken On Time');
        expect(day(20)?.note).toContain('Medication: Pills: Missed');
    });

    it('does NOT normalize note text to the Clue parser\'s phrasing', () => {
        // Free-text notes carry one app's own vocabulary. Two exports are not
        // necessarily the same person, so converging the write pattern would
        // assert an equivalence the data doesn't support. Sources converge on
        // structured fields (flow, bbt, symptom pills) — not on note strings.
        for (const entry of parse().entries) {
            expect(entry.note || '').not.toContain('Birth Control Pill');
        }
    });

    it('respects the deleted flag on recurring events', () => {
        const result = parse();
        expect(result.entries.find(e => e.ts === new Date(2030, 2, 23).getTime())).toBeUndefined();
    });

    it('imports Temperature/Basal as bbt rather than note text', () => {
        expect(day(20)?.bbt).toBe(36.7);
        expect(day(20)?.note).not.toContain('36.7');
    });

    it('imports symptoms and moods as bare phrases so they can become pills', () => {
        expect(day(20)?.note).toContain('Tender Breasts');
        expect(day(21)?.note).toContain('Low Energy');

        const log = ledgerEntryToLogEntry(day(20)!);
        expect(log.symptoms).toContain('breast_tenderness');
    });

    it('imports measured values with their category', () => {
        expect(day(21)?.note).toContain('Weight: 60');
        expect(day(21)?.note).toContain('Water: 2.1');
    });

    it('imports free-text notes', () => {
        expect(day(22)?.note).toContain('felt steady today');
    });

    it('maps per-day period_intensity to flow', () => {
        // period_intensity {"2": 1} -> cycle day 2 (03-05) is level 1 = light
        expect(day(5)?.flow).toBe(1);
        expect(day(4)?.flow).toBe(2);   // no intensity recorded -> default medium
        expect(day(6)?.flow).toBe(2);
    });

    it('keeps real cycle-level data in notes', () => {
        expect(day(4)?.note).toContain('Symptom Cramps: 1');
        expect(day(4)?.note).toContain('Flo Cycle Day: 1');
    });

    it('NEVER writes ids, timestamps or null-valued keys into a note', () => {
        const result = parse();
        for (const entry of result.entries) {
            const note = entry.note || '';
            expect(note).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
            expect(note).not.toMatch(/User Id|Source Id|Parent Id|\bId:/i);
            expect(note).not.toMatch(/Created At|Updated At/i);
            expect(note).not.toMatch(/:\s*null/i);
            expect(note).not.toContain('{}');
            expect(note).not.toMatch(/Pregnant: false/i);
        }
    });

    it('non-period days carry data without being marked as period', () => {
        expect(day(21)?.isPeriod).toBe(false);
        expect(day(21)?.note).toBeTruthy();
        expect(day(4)?.isPeriod).toBe(true);
    });
});

/**
 * Findings from the 2026-07-23 review of the four-container change.
 */
describe('ImportService - Flo (review hardening)', () => {
    it('never writes a raw timestamp into a note, even for date-valued cycle keys', () => {
        // pregnant_start_date is USER data (so it belongs in the note) but Flo
        // stamps it with a time component. The real export has it null, so only a
        // synthetic case can catch the leak.
        const pregnant = {
            operationalData: {
                cycles: [{
                    period_start_date: '2030-03-04 00:00:00.0',
                    period_end_date: '2030-03-05 00:00:00.0',
                    pregnant: true,
                    pregnant_start_date: '2030-02-01 00:00:00.0',
                }]
            }
        };
        const result = parseFloExport(pregnant as unknown as FloExport);

        const notes = result.entries.map(e => e.note || '');
        expect(notes.some(n => n.includes('Pregnant Start Date: 2030-02-01'))).toBe(true);
        for (const note of notes) {
            expect(note).not.toMatch(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/);
        }
    });

    it('drops days whose container records carried no usable payload', () => {
        const empties = {
            operationalData: {
                cycles: [],
                notes: [{ date: '2030-05-01 00:00:00.0', text: '   ' }],
                point_events_manual_v2: [{ date: '2030-05-02 00:00:00.0', category: '', subcategory: '' }],
            }
        };
        const result = parseFloExport(empties as unknown as FloExport);

        // A blank note and a category-less event must not become blank ledger days.
        expect(result.entries.length).toBe(0);
    });

    it('warns instead of silently skipping events with an unusable date', () => {
        const badDates = {
            operationalData: {
                cycles: [{ period_start_date: '2030-03-04 00:00:00.0', period_end_date: '2030-03-04 00:00:00.0' }],
                repeatable_child_point_events: [
                    { date: 'nonsense', category: 'Medication', subcategory: 'Pills', properties: '{"missed_pill": false}' }
                ],
            }
        };
        const result = parseFloExport(badDates as unknown as FloExport);

        expect(result.stats.skippedDays).toBe(1);
        expect(result.warnings.some(w => w.includes('no usable date'))).toBe(true);
    });

    it('does not render a non-finite measurement into a note', () => {
        const nan = {
            operationalData: {
                cycles: [],
                point_events_manual_v2: [
                    { date: '2030-05-02 00:00:00.0', category: 'Weight', subcategory: 'N/A', properties: { value: NaN } }
                ],
            }
        };
        const result = parseFloExport(nan as unknown as FloExport);
        for (const e of result.entries) expect(e.note || '').not.toMatch(/NaN/);
    });
});

describe('ImportService - Flo DST regression', () => {
    // Fixed-ms day stepping drifts to 23:00 of the previous calendar day across a
    // fall-back transition, which duplicates one ISO date and drops the last day.
    //
    // The timezone is FORCED here rather than gated on the ambient one. Gating
    // (`it.runIf(tz === 'America/New_York')`) meant the test silently skipped on
    // every machine and in CI, so the fix it guards had no coverage at all.
    // Vitest isolates each test file in its own worker, so a file-local override
    // does not leak into other suites.
    let prevTZ: string | undefined;
    beforeAll(() => {
        prevTZ = process.env.TZ;
        process.env.TZ = 'America/New_York';
    });
    afterAll(() => {
        process.env.TZ = prevTZ;
    });

    it('emits one entry per calendar day across a DST fall-back', () => {
        const result = parseFloExport({
            operationalData: {
                cycles: [
                    {
                        // DST ends 2026-11-01 in America/New_York.
                        period_start_date: '2026-10-31 00:00:00.0',
                        period_end_date: '2026-11-04 00:00:00.0',
                    },
                ],
            },
        } as unknown as FloExport);

        const dates = result.entries.map((e) => ledgerEntryToLogEntry(e).date);
        expect(new Set(dates).size).toBe(dates.length); // no duplicated day
        expect(dates).toContain('2026-11-04');          // final day not dropped
        // Every entry sits at local midnight, so point-event merging keys line up.
        for (const e of result.entries) {
            const d = new Date(e.ts);
            expect(d.getHours()).toBe(0);
        }
    });
});
