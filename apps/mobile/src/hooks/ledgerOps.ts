import { StorageRecord } from '@locket/secure-storage';
import type { LogEntry } from '../models/LogEntry';

/**
 * Pure, dependency-injected ledger operations.
 *
 * These live outside the hook so they can be tested against the REAL code.
 * Previously the equivalent logic was inlined in `useLedger`'s useCallbacks and
 * the tests re-declared hand-copied "mirror" versions — which passed happily
 * with the production fix reverted. A mirror that can drift is not a guard.
 *
 * `useLedger` keeps its useCallbacks as thin wrappers that pass their closure
 * values in, so the behavior under test is the behavior that ships.
 */

export interface PurgeDeps {
    isInitialized: boolean;
    ledger: { deleteByIds?: (ids: string[]) => Promise<number> } | null | undefined;
    /** Bumps the sync epoch so an in-flight anchor write-back cannot resurrect. */
    invalidateSync: () => void;
    refresh: () => Promise<void>;
}

/**
 * Delete records by id, fail-loud.
 *
 * An empty id list is the ONLY case where "removed nothing" is a real success.
 * Every other early exit means we cannot purge, and returning 0 there would let
 * the undo UI render its done state ("0 removed") while the records are still in
 * the ledger and the affordance is gone — so those throw.
 *
 * The sync invalidation must happen BEFORE the delete: batchInscribe fires an
 * un-awaited performSync whose write-back re-saves the very records being
 * purged, which is how import Undo silently un-did itself.
 */
export async function purgeByIdsOp(
    ids: string[],
    deps: PurgeDeps,
): Promise<{ removedCount: number }> {
    if (!ids || ids.length === 0) return { removedCount: 0 };
    if (!deps.isInitialized || !deps.ledger) {
        throw new Error('Ledger not ready; cannot purge records.');
    }
    if (typeof deps.ledger.deleteByIds !== 'function') {
        throw new Error('Active ledger does not support deleteByIds; cannot purge records.');
    }
    deps.invalidateSync();
    // deleteByIds returns the number actually removed (missing ids don't count).
    // This feeds the §14 UndoResult.removedCount.
    const removedCount = await deps.ledger.deleteByIds(ids);
    await deps.refresh();
    // Not necessarily unreadable: this is also the import-undo path, where the
    // purged records are perfectly readable and were just inscribed.
    console.log(`[useLedger] Purged ${removedCount} record(s) by id`);
    return { removedCount };
}

export interface DecryptDeps {
    keyHex?: string;
    ledger: { loadEvents: () => Promise<StorageRecord[]> };
    crypto: { decryptData: (payload: unknown, keyHex: string) => Promise<unknown> };
}

/**
 * Decrypt every existing record to build the collision index, fail-closed.
 *
 * If ANY record cannot be decrypted, throw rather than returning a partial set:
 * a day that silently drops out of the index makes the preview claim "no overlap
 * with your existing entries" and inscribe a duplicate for that day. "The ledger
 * has no entry there" and "we could not read the entry there" must never look
 * the same to the user.
 *
 * Records that are structurally not encrypted payloads (dummy/noise records
 * written by insertDummy) are skipped without counting as failures — they carry
 * no user data and must not block the whole import.
 */
export async function decryptExistingEntriesOp(deps: DecryptDeps): Promise<LogEntry[]> {
    if (!deps.keyHex) throw new Error('Ledger not ready or key missing');
    const records = await deps.ledger.loadEvents();
    const out: LogEntry[] = [];
    let failed = 0;
    for (const rec of records) {
        if (rec.isDummy) continue;
        try {
            const data = await deps.crypto.decryptData(rec.payload, deps.keyHex);
            if (data && typeof data === 'object') out.push(data as LogEntry);
        } catch {
            failed++;
        }
    }
    if (failed > 0) {
        console.error(`[useLedger] ${failed} existing record(s) undecryptable for preview index`);
        throw new Error(
            `Could not read ${failed} existing ledger record(s), so overlap with your ` +
            `existing entries cannot be determined. Importing now could duplicate days. ` +
            `Resolve the unreadable entries from the Ledger screen first.`,
        );
    }
    return out;
}
