import { describe, it, expect, vi } from 'vitest';
import { purgeByIdsOp, decryptExistingEntriesOp } from '../../src/hooks/ledgerOps';
import { buildDateIndex, buildImportPreview } from '../../src/services/importPreview';
import type { StorageRecord } from '@locket/secure-storage';
import type { LogEntry } from '../../src/models/LogEntry';

/**
 * Guards the fail-loud / fail-closed fixes in the undo and preview paths.
 *
 * These call the REAL `purgeByIdsOp` and `decryptExistingEntriesOp` from
 * `src/hooks/ledgerOps.ts`. An earlier version of this file re-declared
 * hand-copied "mirror" versions of the same logic, which meant every test here
 * stayed green with the production fix reverted — the repo's documented
 * vacuous-test failure mode. `useLedger`'s useCallbacks are now thin wrappers
 * over these functions, so what is asserted here is what ships.
 */

function makeLedger(deleteResult: number | Error = 0) {
    return {
        deleteByIds: vi.fn(async (_ids: string[]) => {
            if (deleteResult instanceof Error) throw deleteResult;
            return deleteResult;
        }),
    };
}

function rec(payload: unknown, extra: Partial<StorageRecord> = {}): StorageRecord {
    return { id: 'r', ts: 1, payload: payload as any, status: 'local', ...extra } as StorageRecord;
}

describe('purgeByIdsOp — fail-loud contract', () => {
    it('invalidates the sync epoch BEFORE deleting', async () => {
        // Ordering is the whole fix: batchInscribe fires an un-awaited
        // performSync whose write-back re-saves the records being purged. If the
        // epoch is bumped after (or not at all) the undo silently un-does itself.
        const order: string[] = [];
        const ledger = {
            deleteByIds: vi.fn(async () => {
                order.push('delete');
                return 2;
            }),
        };
        await purgeByIdsOp(['a', 'b'], {
            isInitialized: true,
            ledger,
            invalidateSync: () => order.push('invalidate'),
            refresh: async () => {},
        });
        expect(order).toEqual(['invalidate', 'delete']);
    });

    it('returns the backend count, not the requested id count', async () => {
        const ledger = makeLedger(1);
        const res = await purgeByIdsOp(['a', 'missing'], {
            isInitialized: true,
            ledger,
            invalidateSync: () => {},
            refresh: async () => {},
        });
        expect(res).toEqual({ removedCount: 1 });
    });

    it('an empty id list is the only safe zero — no ledger call, no invalidation', async () => {
        const ledger = makeLedger(0);
        const invalidateSync = vi.fn();
        const res = await purgeByIdsOp([], {
            isInitialized: true,
            ledger,
            invalidateSync,
            refresh: async () => {},
        });
        expect(res).toEqual({ removedCount: 0 });
        expect(ledger.deleteByIds).not.toHaveBeenCalled();
        expect(invalidateSync).not.toHaveBeenCalled();
    });

    it('THROWS rather than reporting 0 when the ledger is not ready', async () => {
        // Returning {removedCount: 0} here would let the undo UI render "0
        // removed" as success while the records are still in the ledger.
        await expect(
            purgeByIdsOp(['a'], {
                isInitialized: false,
                ledger: makeLedger(0),
                invalidateSync: () => {},
                refresh: async () => {},
            }),
        ).rejects.toThrow(/not ready/i);

        await expect(
            purgeByIdsOp(['a'], {
                isInitialized: true,
                ledger: null,
                invalidateSync: () => {},
                refresh: async () => {},
            }),
        ).rejects.toThrow(/not ready/i);
    });

    it('THROWS when the active ledger cannot delete by id', async () => {
        await expect(
            purgeByIdsOp(['a'], {
                isInitialized: true,
                ledger: {} as any,
                invalidateSync: () => {},
                refresh: async () => {},
            }),
        ).rejects.toThrow(/does not support deleteByIds/i);
    });

    it('propagates a backend failure instead of swallowing it', async () => {
        await expect(
            purgeByIdsOp(['a'], {
                isInitialized: true,
                ledger: makeLedger(new Error('io')),
                invalidateSync: () => {},
                refresh: async () => {},
            }),
        ).rejects.toThrow('io');
    });
});

describe('decryptExistingEntriesOp — collision index fails closed', () => {
    const crypto = {
        decryptData: vi.fn(async (payload: any) => {
            if (payload === 'bad') throw new Error('cannot decrypt');
            return payload;
        }),
    };

    it('returns every decrypted entry when all records are readable', async () => {
        const ledger = {
            loadEvents: async () => [rec({ date: '2024-01-01' }), rec({ date: '2024-01-02' })],
        };
        const out = await decryptExistingEntriesOp({ keyHex: 'k', ledger, crypto });
        expect(out.map((e: any) => e.date)).toEqual(['2024-01-01', '2024-01-02']);
    });

    it('THROWS if any record cannot be decrypted', async () => {
        // A dropped day would make the preview claim "no overlap" and inscribe a
        // duplicate for that day — "no entry" and "unreadable" must not look alike.
        const ledger = {
            loadEvents: async () => [rec({ date: '2024-01-01' }), rec('bad')],
        };
        await expect(
            decryptExistingEntriesOp({ keyHex: 'k', ledger, crypto }),
        ).rejects.toThrow(/Could not read 1 existing ledger record/);
    });

    it('an undecryptable record cannot silently hide a collision', async () => {
        // The composition that matters: if the throw were downgraded to a skip,
        // the day would vanish from the index and the row would look collision-free.
        const ledger = { loadEvents: async () => [rec('bad')] };
        await expect(
            decryptExistingEntriesOp({ keyHex: 'k', ledger, crypto }),
        ).rejects.toThrow();

        // Sanity: had it been skipped, this is the wrong answer it would produce.
        const preview = buildImportPreview({
            source: 'healthkit',
            logEntries: [{ event: 'manual_entry', date: '2024-01-01', ts: 1 } as LogEntry],
            existingByDate: buildDateIndex([]),
            permissionState: 'available',
            truncation: null,
        });
        expect(preview.counts.collisions).toBe(0);
    });

    it('skips dummy/noise records without counting them as failures', async () => {
        // insertDummy writes an unencrypted {noise} payload. Counting it as a
        // failure would permanently block import for anyone who has one.
        const ledger = {
            loadEvents: async () => [
                rec({ date: '2024-01-01' }),
                rec({ noise: 'x' }, { isDummy: true }),
            ],
        };
        const out = await decryptExistingEntriesOp({ keyHex: 'k', ledger, crypto });
        expect(out).toHaveLength(1);
    });

    it('throws before reading anything when the key is missing', async () => {
        const loadEvents = vi.fn(async () => [] as StorageRecord[]);
        await expect(
            decryptExistingEntriesOp({ keyHex: undefined, ledger: { loadEvents }, crypto }),
        ).rejects.toThrow(/key missing/i);
        expect(loadEvents).not.toHaveBeenCalled();
    });
});
