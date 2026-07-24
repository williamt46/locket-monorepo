import { describe, it, expect, vi } from 'vitest';
import {
    buildDateIndex,
    buildImportPreview,
    selectEntriesToInscribe,
    dateKeyOf,
} from '../../src/services/importPreview';
import type { LogEntry } from '../../src/models/LogEntry';
import type { ImportPreview } from '../../src/models/ImportTypes';

/**
 * importPreview — the PURE preview-build + commit-selection logic. Plus a
 * commit→undo round-trip and the fail-closed guard, exercised through a
 * mirror of the hook's batchInscribe/purgeByIds against an in-memory ledger
 * (the repo has no hook renderer; the FILTERING under test is the real code).
 */

function entry(date: string, extra: Partial<LogEntry> = {}): LogEntry {
    const [y, m, d] = date.split('-').map(Number);
    return {
        event: 'manual_entry',
        date,
        ts: new Date(y, m - 1, d).getTime(),
        source: 'healthkit',
        ...extra,
    };
}

describe('buildDateIndex + dateKeyOf', () => {
    it('indexes existing entries by their day key', () => {
        const index = buildDateIndex([entry('2024-01-01'), entry('2024-01-03')]);
        expect(index.has('2024-01-01')).toBe(true);
        expect(index.has('2024-01-02')).toBe(false);
    });

    it('falls back to ts-derived local date when .date is missing', () => {
        const e = { event: 'manual_entry', date: '', ts: new Date(2024, 5, 15).getTime() } as LogEntry;
        expect(dateKeyOf(e)).toBe('2024-06-15');
    });
});

describe('buildImportPreview — rows, glyphs, range, counts', () => {
    it('precomputes glyphs and a ts-ascending row set with range', () => {
        const logEntries = [
            entry('2024-01-03', { bleeding: { intensity: 'medium' } }),
            entry('2024-01-01', { temperature: { value: 36.5, unit: 'C' }, symptoms: ['cramps'], note: 'x' }),
        ];
        const preview = buildImportPreview({
            source: 'healthkit',
            logEntries,
            existingByDate: new Map(),
            permissionState: 'available',
            truncation: null,
        });
        expect(preview.rows.map(r => r.date)).toEqual(['2024-01-01', '2024-01-03']); // sorted
        expect(preview.range).toEqual({ earliest: '2024-01-01', latest: '2024-01-03' });
        expect(preview.rows[0].glyphs).toEqual({ bleeding: false, temperature: true, symptoms: true, note: true });
        expect(preview.rows[1].glyphs).toEqual({ bleeding: true, temperature: false, symptoms: false, note: false });
        expect(preview.counts).toEqual({ total: 2, collisions: 0 });
    });

    it('detects collisions against the decrypted index and defaults them to keep-existing', () => {
        const existing = buildDateIndex([entry('2024-01-01', { note: 'mine' })]);
        const preview = buildImportPreview({
            source: 'healthkit',
            logEntries: [entry('2024-01-01', { note: 'incoming' }), entry('2024-01-02')],
            existingByDate: existing,
            permissionState: 'available',
            truncation: null,
        });
        expect(preview.rows[0].collision).not.toBeNull();
        expect(preview.rows[0].collision!.resolution).toBe('keep-existing');
        expect(preview.rows[0].collision!.existing.note).toBe('mine');
        expect(preview.rows[1].collision).toBeNull();
        expect(preview.counts).toEqual({ total: 2, collisions: 1 });
    });

    it('empty ledger → no collisions', () => {
        const preview = buildImportPreview({
            source: 'clue',
            logEntries: [entry('2024-01-01'), entry('2024-01-02')],
            existingByDate: new Map(),
            permissionState: 'available',
            truncation: null,
        });
        expect(preview.counts.collisions).toBe(0);
    });

    it('empty samples → empty rows, null range, ambiguous-zero carries through', () => {
        const preview = buildImportPreview({
            source: 'healthkit',
            logEntries: [],
            existingByDate: buildDateIndex([entry('2024-01-01')]),
            permissionState: 'ambiguous-zero',
            truncation: null,
        });
        expect(preview.rows).toEqual([]);
        expect(preview.range).toBeNull();
        expect(preview.counts).toEqual({ total: 0, collisions: 0 });
        expect(preview.permissionState).toBe('ambiguous-zero');
    });
});

describe('selectEntriesToInscribe — §14 commit filtering', () => {
    function previewWith(rows: ImportPreview['rows']): ImportPreview {
        return { source: 'healthkit', rows, range: null, truncation: null, permissionState: 'available', counts: { total: rows.length, collisions: 0 } };
    }
    const row = (date: string, collision: null | 'keep-existing' | 'import-anyway') => ({
        date,
        entry: entry(date),
        glyphs: { bleeding: false, temperature: false, symptoms: false, note: false },
        collision: collision ? { existing: entry(date), resolution: collision } : null,
    });

    it('inscribes non-collision rows and skips keep-existing collisions', () => {
        const { toInscribe, skippedCount } = selectEntriesToInscribe(previewWith([
            row('2024-01-01', null),
            row('2024-01-02', 'keep-existing'),
            row('2024-01-03', null),
        ]));
        expect(toInscribe.map(e => e.date)).toEqual(['2024-01-01', '2024-01-03']);
        expect(skippedCount).toBe(1);
    });

    it('inscribes an import-anyway collision as an additional record', () => {
        const { toInscribe, skippedCount } = selectEntriesToInscribe(previewWith([
            row('2024-01-01', 'import-anyway'),
            row('2024-01-02', 'keep-existing'),
        ]));
        expect(toInscribe.map(e => e.date)).toEqual(['2024-01-01']);
        expect(skippedCount).toBe(1);
    });

    it('all keep-existing → nothing inscribed, all skipped', () => {
        const { toInscribe, skippedCount } = selectEntriesToInscribe(previewWith([
            row('2024-01-01', 'keep-existing'),
            row('2024-01-02', 'keep-existing'),
        ]));
        expect(toInscribe).toHaveLength(0);
        expect(skippedCount).toBe(2);
    });
});

// --- commit → undo round-trip + fail-closed (mirror of hook internals) --------

function mintId(): string {
    return Math.random().toString(36).substring(7) + '-' + Date.now() + Math.random().toString(36).substring(2, 5);
}
function makeMemLedger() {
    const store: any[] = [];
    return {
        store,
        saveEvents: vi.fn(async (records: any[]) => {
            for (const r of records) {
                const id = r.id ?? mintId();
                const i = store.findIndex(e => e.id === id);
                if (i >= 0) store[i] = { ...r, id }; else store.push({ ...r, id });
            }
        }),
        deleteByIds: vi.fn(async (ids: string[]) => {
            const set = new Set(ids);
            const before = store.length;
            for (let i = store.length - 1; i >= 0; i--) {
                if (store[i].id && set.has(store[i].id)) store.splice(i, 1);
            }
            return before - store.length;
        }),
    };
}
const crypto = { encryptData: vi.fn(async (d: any) => ({ enc: JSON.stringify(d) })) };

// Mirror of commitPreview → batchInscribe (mint ids, return them; fail closed).
async function commit(preview: ImportPreview, ctx: { ledger: ReturnType<typeof makeMemLedger>; keyHex?: string }) {
    const { toInscribe, skippedCount } = selectEntriesToInscribe(preview);
    if (toInscribe.length === 0) return { inscribedIds: [], inscribedCount: 0, skippedCount };
    if (!ctx.keyHex) throw new Error('Ledger not ready or key missing'); // fail closed — nothing written
    const records: any[] = [];
    const ids: string[] = [];
    for (const data of toInscribe) {
        const id = mintId();
        const payload = await crypto.encryptData(data);
        records.push({ id, ts: data.ts, payload, status: 'local' });
        ids.push(id);
    }
    await ctx.ledger.saveEvents(records);
    return { inscribedIds: ids, inscribedCount: ids.length, skippedCount };
}

describe('commit → undo round-trip', () => {
    function previewOf(dates: string[], collisions: Record<string, 'keep-existing' | 'import-anyway'> = {}): ImportPreview {
        const rows = dates.map(date => ({
            date,
            entry: entry(date),
            glyphs: { bleeding: false, temperature: false, symptoms: false, note: false },
            collision: collisions[date] ? { existing: entry(date), resolution: collisions[date] } : null,
        }));
        return { source: 'healthkit', rows, range: null, truncation: null, permissionState: 'available', counts: { total: rows.length, collisions: Object.keys(collisions).length } };
    }

    it('returns ids matching the records written; undo removes exactly those', async () => {
        const ledger = makeMemLedger();
        const result = await commit(previewOf(['2024-01-01', '2024-01-02', '2024-01-03']), { ledger, keyHex: 'k' });

        expect(result.inscribedCount).toBe(3);
        expect(result.inscribedIds).toEqual(ledger.store.map(r => r.id));
        expect(ledger.store).toHaveLength(3);

        const removed = await ledger.deleteByIds(result.inscribedIds);
        expect(removed).toBe(3);
        expect(ledger.store).toHaveLength(0);

        // double undo is a no-op
        expect(await ledger.deleteByIds(result.inscribedIds)).toBe(0);
    });

    it('skippedCount is right and only non-skipped rows are inscribed/undoable', async () => {
        const ledger = makeMemLedger();
        const result = await commit(
            previewOf(['2024-01-01', '2024-01-02', '2024-01-03'], { '2024-01-02': 'keep-existing' }),
            { ledger, keyHex: 'k' },
        );
        expect(result.inscribedCount).toBe(2);
        expect(result.skippedCount).toBe(1);
        expect(ledger.store).toHaveLength(2);
        await ledger.deleteByIds(result.inscribedIds);
        expect(ledger.store).toHaveLength(0);
    });
});

describe('fail-closed commit guard', () => {
    it('throws and writes NOTHING when the key is missing', async () => {
        const ledger = makeMemLedger();
        await expect(commit(previewFixture(), { ledger, keyHex: undefined })).rejects.toThrow('Ledger not ready or key missing');
        expect(ledger.saveEvents).not.toHaveBeenCalled();
        expect(ledger.store).toHaveLength(0);
    });

    it('an all-collision (all keep-existing) commit writes nothing WITHOUT needing a key', async () => {
        const ledger = makeMemLedger();
        const preview: ImportPreview = {
            source: 'healthkit',
            rows: [{
                date: '2024-01-01', entry: entry('2024-01-01'),
                glyphs: { bleeding: false, temperature: false, symptoms: false, note: false },
                collision: { existing: entry('2024-01-01'), resolution: 'keep-existing' },
            }],
            range: null, truncation: null, permissionState: 'available', counts: { total: 1, collisions: 1 },
        };
        const result = await commit(preview, { ledger, keyHex: undefined });
        expect(result).toEqual({ inscribedIds: [], inscribedCount: 0, skippedCount: 1 });
        expect(ledger.saveEvents).not.toHaveBeenCalled();
    });
});

function previewFixture(): ImportPreview {
    return {
        source: 'healthkit',
        rows: [{
            date: '2024-01-01', entry: entry('2024-01-01'),
            glyphs: { bleeding: false, temperature: false, symptoms: false, note: false },
            collision: null,
        }],
        range: { earliest: '2024-01-01', latest: '2024-01-01' },
        truncation: null,
        permissionState: 'available',
        counts: { total: 1, collisions: 0 },
    };
}

describe('importPreview — review regressions', () => {
    it('keeps the NEWEST entry for a day in the collision index', () => {
        // loadEvents returns newest-first on both backends, so a plain set() per
        // entry would leave the OLDEST record as collision.existing.
        const newest = entry('2024-01-05', { note: 'NEWEST', ts: new Date(2024, 0, 5, 20, 0).getTime() });
        const oldest = entry('2024-01-05', { note: 'OLDEST', ts: new Date(2024, 0, 5, 1, 0).getTime() });
        const index = buildDateIndex([newest, oldest]);
        expect(index.get('2024-01-05')?.note).toBe('NEWEST');
    });

    it('does not let an import-anyway row un-mark an existing period day', () => {
        // The incoming HealthKit row has no period signal, so its isPeriod:false
        // is an absence of information. Both records share a local-midnight ts and
        // the per-day view merges newest-over-oldest, so writing that false would
        // erase the user's period marking.
        const incoming = entry('2024-03-10', { isPeriod: false, temperature: { value: 36.5, unit: 'C' } });
        const existing = entry('2024-03-10', { isPeriod: true, note: 'mine' });
        const preview: ImportPreview = {
            source: 'healthkit',
            rows: [
                {
                    date: '2024-03-10',
                    entry: incoming,
                    glyphs: { bleeding: false, temperature: true, symptoms: false, note: false },
                    collision: { existing, resolution: 'import-anyway' },
                },
            ],
            range: { earliest: '2024-03-10', latest: '2024-03-10' },
            truncation: null,
            permissionState: 'available',
            counts: { total: 1, collisions: 1 },
        };

        const { toInscribe } = selectEntriesToInscribe(preview);
        expect(toInscribe).toHaveLength(1);
        expect('isPeriod' in toInscribe[0]).toBe(false);
        // The data the user actually wanted still imports.
        expect(toInscribe[0].temperature?.value).toBe(36.5);
    });

    it('keeps a TRUE period flag on an import-anyway row (a real claim, not an absence)', () => {
        const incoming = entry('2024-03-11', { isPeriod: true, isStart: true });
        const existing = entry('2024-03-11', { note: 'mine' });
        const preview: ImportPreview = {
            source: 'healthkit',
            rows: [
                {
                    date: '2024-03-11',
                    entry: incoming,
                    glyphs: { bleeding: true, temperature: false, symptoms: false, note: false },
                    collision: { existing, resolution: 'import-anyway' },
                },
            ],
            range: { earliest: '2024-03-11', latest: '2024-03-11' },
            truncation: null,
            permissionState: 'available',
            counts: { total: 1, collisions: 1 },
        };
        const { toInscribe } = selectEntriesToInscribe(preview);
        expect(toInscribe[0].isPeriod).toBe(true);
        expect(toInscribe[0].isStart).toBe(true);
    });
});
