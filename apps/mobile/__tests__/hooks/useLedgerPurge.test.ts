import { describe, it, expect, vi } from 'vitest';
import type { StorageRecord } from '@locket/secure-storage';
import { buildDateIndex, buildImportPreview } from '../../src/services/importPreview';

/**
 * Coverage for the useLedger internals hardened by the pre-landing review that
 * the existing useLedger.test.ts (produce + batchInscribe) does not reach:
 * `purgeByIds` and `decryptExistingEntries`, plus the HealthKit produce→preview
 * glue.
 *
 * Same approach and constraint as useLedger.test.ts: the repo has NO hook
 * rendering infrastructure (@testing-library/react-native / react-test-renderer
 * are absent, installing deps is out of scope) and these functions are
 * `useCallback` closures that are not exported. Each harness below is a verbatim
 * mirror of the production body in apps/mobile/src/hooks/useLedger.ts — keep
 * them in sync; they are the executable spec of these steps.
 */

// --- purgeByIds mirror (useLedger.ts) ---------------------------------------

async function purgeByIdsHarness(
    ids: string[],
    ctx: {
        isInitialized: boolean;
        ledger: any;
        sync: { invalidate: () => void };
        refresh: () => Promise<void>;
        order?: string[];
    },
): Promise<{ removedCount: number }> {
    if (!ids || ids.length === 0) return { removedCount: 0 };
    if (!ctx.isInitialized || !ctx.ledger) {
        throw new Error('Ledger not ready; cannot purge records.');
    }
    if (typeof ctx.ledger.deleteByIds !== 'function') {
        throw new Error('Active ledger does not support deleteByIds; cannot purge records.');
    }
    try {
        ctx.sync.invalidate();
        const removedCount = await ctx.ledger.deleteByIds(ids);
        await ctx.refresh();
        return { removedCount };
    } catch (e) {
        throw e;
    }
}

describe('useLedger.purgeByIds — fail-loud contract', () => {
    const okCtx = () => {
        const order: string[] = [];
        return {
            order,
            isInitialized: true,
            ledger: { deleteByIds: vi.fn(async (ids: string[]) => { order.push('delete'); return ids.length; }) },
            sync: { invalidate: vi.fn(() => { order.push('invalidate'); }) },
            refresh: vi.fn(async () => { order.push('refresh'); }),
        };
    };

    it('an EMPTY id list is the only successful no-op: returns 0 and touches nothing', async () => {
        const ctx = okCtx();
        await expect(purgeByIdsHarness([], ctx)).resolves.toEqual({ removedCount: 0 });
        expect(ctx.sync.invalidate).not.toHaveBeenCalled();
        expect(ctx.ledger.deleteByIds).not.toHaveBeenCalled();
    });

    it('THROWS (never returns 0) when the ledger is not initialized — undo must not render "done"', async () => {
        const ctx = okCtx();
        await expect(purgeByIdsHarness(['a'], { ...ctx, isInitialized: false })).rejects.toThrow(
            'Ledger not ready; cannot purge records.',
        );
        expect(ctx.ledger.deleteByIds).not.toHaveBeenCalled();
    });

    it('THROWS when the ledger has no ledger instance at all', async () => {
        const ctx = okCtx();
        await expect(purgeByIdsHarness(['a'], { ...ctx, ledger: null })).rejects.toThrow(
            'Ledger not ready; cannot purge records.',
        );
    });

    it('THROWS when the active backend does not support deleteByIds', async () => {
        const ctx = okCtx();
        await expect(purgeByIdsHarness(['a'], { ...ctx, ledger: {} })).rejects.toThrow(
            'does not support deleteByIds',
        );
    });

    it('invalidates the in-flight sync BEFORE deleting, so a write-back cannot resurrect the records', async () => {
        const ctx = okCtx();
        const result = await purgeByIdsHarness(['a', 'b'], ctx);
        expect(ctx.order).toEqual(['invalidate', 'delete', 'refresh']);
        expect(result).toEqual({ removedCount: 2 });
    });

    it('returns the backend removedCount (missing ids do not count) rather than ids.length', async () => {
        const ctx = okCtx();
        ctx.ledger.deleteByIds = vi.fn(async () => 1);
        await expect(purgeByIdsHarness(['a', 'b', 'c'], ctx)).resolves.toEqual({ removedCount: 1 });
    });

    it('propagates a backend failure instead of swallowing it', async () => {
        const ctx = okCtx();
        ctx.ledger.deleteByIds = vi.fn(async () => { throw new Error('disk full'); });
        await expect(purgeByIdsHarness(['a'], ctx)).rejects.toThrow('disk full');
        expect(ctx.refresh).not.toHaveBeenCalled();
    });
});

// --- decryptExistingEntries mirror (useLedger.ts) ----------------------------

async function decryptExistingEntriesHarness(ctx: {
    keyHex?: string;
    ledger: { loadEvents: () => Promise<StorageRecord[]> };
    crypto: { decryptData: (payload: any, keyHex: string) => Promise<any> };
}): Promise<any[]> {
    if (!ctx.keyHex) throw new Error('Ledger not ready or key missing');
    const records = await ctx.ledger.loadEvents();
    const out: any[] = [];
    let failed = 0;
    for (const rec of records) {
        try {
            const data = await ctx.crypto.decryptData(rec.payload, ctx.keyHex);
            if (data && typeof data === 'object') out.push(data);
        } catch {
            failed++;
        }
    }
    if (failed > 0) {
        throw new Error(
            `Could not read ${failed} existing ledger record(s), so overlap with your ` +
            `existing entries cannot be determined. Importing now could duplicate days. ` +
            `Resolve the unreadable entries from the Ledger screen first.`,
        );
    }
    return out;
}

const rec = (id: string): StorageRecord => ({ id, ts: 1, payload: { tag: id } as any, status: 'local', signature: 's' } as any);

describe('useLedger.decryptExistingEntries — collision index fails closed', () => {
    it('returns every decrypted entry when the whole ledger is readable', async () => {
        const out = await decryptExistingEntriesHarness({
            keyHex: 'k',
            ledger: { loadEvents: async () => [rec('a'), rec('b')] },
            crypto: { decryptData: async (p: any) => ({ date: `2024-01-0${p.tag === 'a' ? 1 : 2}`, ts: 1 }) },
        });
        expect(out).toHaveLength(2);
    });

    it('THROWS when ANY record is undecryptable — "no entry" and "unreadable entry" must not look the same', async () => {
        await expect(decryptExistingEntriesHarness({
            keyHex: 'k',
            ledger: { loadEvents: async () => [rec('a'), rec('bad'), rec('c')] },
            crypto: {
                decryptData: async (p: any) => {
                    if (p.tag === 'bad') throw new Error('auth tag mismatch');
                    return { date: '2024-01-01', ts: 1 };
                },
            },
        })).rejects.toThrow('Could not read 1 existing ledger record(s)');
    });

    it('throws before touching the ledger when the key is missing', async () => {
        const loadEvents = vi.fn(async () => []);
        await expect(decryptExistingEntriesHarness({
            keyHex: undefined,
            ledger: { loadEvents },
            crypto: { decryptData: async () => ({}) },
        })).rejects.toThrow('Ledger not ready or key missing');
        expect(loadEvents).not.toHaveBeenCalled();
    });

    it('drops non-object plaintext without counting it as a decrypt failure', async () => {
        const out = await decryptExistingEntriesHarness({
            keyHex: 'k',
            ledger: { loadEvents: async () => [rec('a'), rec('b')] },
            crypto: { decryptData: async (p: any) => (p.tag === 'a' ? null : { date: '2024-01-02', ts: 1 }) },
        });
        expect(out).toHaveLength(1);
    });
});

// --- producePreviewFromHealthKit mirror (useLedger.ts) -----------------------

async function producePreviewFromHealthKitHarness(ctx: {
    isInitialized: boolean;
    source: any;
    mapSamples: (r: any) => any[];
    toLogEntry: (e: any) => any;
    existing: any[];
}) {
    if (!ctx.isInitialized) throw new Error('Ledger not initialized');
    if (!ctx.source.isAvailable()) {
        throw new Error('Apple Health is not available on this device');
    }
    const queryResult = await ctx.source.query();
    const logEntries = ctx.mapSamples(queryResult).map(ctx.toLogEntry);
    return buildImportPreview({
        source: 'healthkit',
        logEntries,
        existingByDate: buildDateIndex(ctx.existing),
        permissionState: queryResult.permissionState,
        truncation: queryResult.truncation,
    });
}

describe('useLedger.producePreviewFromHealthKit — glue contract', () => {
    const identity = (e: any) => e;

    it('throws WITHOUT querying when Apple Health is unavailable on the device', async () => {
        const query = vi.fn();
        await expect(producePreviewFromHealthKitHarness({
            isInitialized: true,
            source: { isAvailable: () => false, query },
            mapSamples: () => [],
            toLogEntry: identity,
            existing: [],
        })).rejects.toThrow('Apple Health is not available on this device');
        expect(query).not.toHaveBeenCalled();
    });

    it('throws when the ledger is not initialized', async () => {
        await expect(producePreviewFromHealthKitHarness({
            isInitialized: false,
            source: { isAvailable: () => true, query: async () => ({}) },
            mapSamples: () => [],
            toLogEntry: identity,
            existing: [],
        })).rejects.toThrow('Ledger not initialized');
    });

    it('carries permissionState and truncation from the query straight into the preview', async () => {
        const preview = await producePreviewFromHealthKitHarness({
            isInitialized: true,
            source: {
                isAvailable: () => true,
                query: async () => ({ permissionState: 'ambiguous-zero', truncation: { earliestAuthorized: '2024-01-01' } }),
            },
            mapSamples: () => [],
            toLogEntry: identity,
            existing: [],
        });
        expect(preview.source).toBe('healthkit');
        expect(preview.permissionState).toBe('ambiguous-zero');
        expect(preview.truncation).toEqual({ earliestAuthorized: '2024-01-01' });
        expect(preview.counts).toEqual({ total: 0, collisions: 0 });
        expect(preview.range).toBeNull();
    });

    it('a zero-sample HealthKit read is an empty preview, NOT the corrupted-file assert', async () => {
        const preview = await producePreviewFromHealthKitHarness({
            isInitialized: true,
            source: { isAvailable: () => true, query: async () => ({ permissionState: 'ambiguous-zero', truncation: null }) },
            mapSamples: () => [],
            toLogEntry: identity,
            existing: [],
        });
        expect(preview.rows).toEqual([]);
    });

    it('detects collisions for HealthKit rows against the decrypted existing index', async () => {
        const preview = await producePreviewFromHealthKitHarness({
            isInitialized: true,
            source: { isAvailable: () => true, query: async () => ({ permissionState: 'available', truncation: null }) },
            mapSamples: () => [
                { date: '2024-01-01', ts: 1704067200000 },
                { date: '2024-01-02', ts: 1704153600000 },
            ],
            toLogEntry: identity,
            existing: [{ date: '2024-01-02', ts: 1 } as any],
        });
        expect(preview.counts).toEqual({ total: 2, collisions: 1 });
        expect(preview.rows[1].collision?.resolution).toBe('keep-existing');
    });
});
