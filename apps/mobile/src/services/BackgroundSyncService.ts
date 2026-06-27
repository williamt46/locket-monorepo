// BackgroundSyncService.ts
// Optimistic Sync Engine for anchoring local hashes to Hyperledger Fabric in batches

import { BlockchainService } from './BlockchainService';
import { StorageRecord } from '@locket/secure-storage';

const SYNC_THRESHOLD = 7; // Sync every 7 events (aligns with period auto-fill)

export const BackgroundSyncService = {
    isSyncing: false,
    // Monotonic generation counter. Bumped whenever the store/key is wiped
    // (factory reset, nuke). An in-flight sync captures the epoch at start and
    // refuses to write back if it has since changed — otherwise a deferred
    // saveEvents resurrects old-key records into a freshly-wiped store, leaving
    // permanently undecryptable orphans.
    epoch: 0,
    onStatusChange: (syncing: boolean) => { },

    /**
     * Invalidate any in-flight sync. Call this BEFORE wiping the ledger/key so a
     * deferred anchor write-back cannot re-persist pre-reset records.
     */
    invalidate() {
        this.epoch++;
        this.isSyncing = false;
        this.onStatusChange(false);
    },

    /**
     * Scans the ledger for unanchored ('local') records and anchors them in batches.
     * @param ledger The ledger instance from useLedger
     * @param onSyncComplete Optional callback to refresh UI
     */
    async performSync(ledger: any, onSyncComplete?: () => void) {
        if (!ledger) {
            console.warn('[SyncEngine] Skipping performSync: Ledger not initialized.');
            return;
        }
        if (this.isSyncing) return;
        this.setSyncing(true);
        const myEpoch = this.epoch;

        try {
            console.log('[SyncEngine] Pulse started. Scanning for local records...');

            const events: StorageRecord[] = await ledger.loadEvents();
            const localOnly = events.filter(e => e.status === 'local');
            const pending = localOnly.filter(e => e.signature);
            const orphans = localOnly.filter(e => !e.signature);

            if (orphans.length > 0) {
                console.log(`[SyncEngine] Warning: Found ${orphans.length} local records without signatures. These cannot be anchored.`);
            }

            if (pending.length === 0) {
                console.log('[SyncEngine] No anchorable records found.');
                this.setSyncing(false);
                return;
            }

            console.log(`[SyncEngine] Found ${pending.length} anchorable records.`);

            // Apply batching threshold
            if (pending.length < SYNC_THRESHOLD) {
                console.log(`[SyncEngine] Threshold not met (${pending.length}/${SYNC_THRESHOLD}). Skipping auto-sync.`);
                this.setSyncing(false);
                return;
            }

            await this.executeAnchorBatch(pending, ledger, onSyncComplete, myEpoch);

        } catch (e) {
            console.error('[SyncEngine] Sync cycle failed:', e);
            this.setSyncing(false);
        }
    },

    /**
     * Bypasses the threshold and anchors all pending records immediately.
     */
    async forceSync(ledger: any, onSyncComplete?: () => void) {
        if (!ledger) {
            console.error('[SyncEngine] Cannot force sync: Ledger is null.');
            return;
        }
        if (this.isSyncing) return;
        this.setSyncing(true);
        const myEpoch = this.epoch;

        try {
            console.log('[SyncEngine] Force Sync triggered!');
            const events: StorageRecord[] = await ledger.loadEvents();
            const localOnly = events.filter(e => e.status === 'local');
            const pending = localOnly.filter(e => e.signature);
            const orphans = localOnly.filter(e => !e.signature);

            if (orphans.length > 0) {
                console.log(`[SyncEngine] ForceSync: Found ${orphans.length} local records without signatures. Skipping them.`);
            }

            if (pending.length === 0) {
                console.log('[SyncEngine] No anchorable records to force sync.');
                this.setSyncing(false);
                return;
            }

            await this.executeAnchorBatch(pending, ledger, onSyncComplete, myEpoch);
        } catch (e) {
            console.error('[SyncEngine] Force sync failed:', e);
            this.setSyncing(false);
        }
    },

    async executeAnchorBatch(pending: StorageRecord[], ledger: any, onSyncComplete?: () => void, myEpoch?: number) {
        try {
            console.log(`[SyncEngine] Anchoring Batch: Tracking IDs [${pending.map(p => p.signature?.substring(0, 8)).join(', ')}]`);

            // Prepare assets for BlockchainService
            const assets = pending.map(p => ({
                dataHash: p.signature as string,
                id: p.assetId // Usually null for local
            }));

            const result = await BlockchainService.anchorBatch(assets);

            // Epoch guard: if the store/key was wiped (factory reset, nuke) while we
            // were anchoring on-chain, abort the write-back. Persisting now would
            // re-insert pre-reset records into the fresh store, where they can never
            // decrypt under the new key (permanently undecryptable orphans).
            if (myEpoch !== undefined && myEpoch !== this.epoch) {
                console.warn('[SyncEngine] Store was reset mid-sync (stale epoch). Skipping write-back to avoid resurrecting old records.');
                return;
            }

            if (result.success && result.results) {
                console.log(`[SyncEngine] Success: Batch anchored (Tx: ${result.txId?.substring(0, 16)}...)`);

                const updatedRecords: StorageRecord[] = [];
                for (let i = 0; i < pending.length; i++) {
                    const record = pending[i];
                    const anchorInfo = result.results[i];

                    record.status = 'anchored';
                    record.assetId = anchorInfo.assetId;
                    updatedRecords.push(record);
                }

                await ledger.saveEvents(updatedRecords);

                if (onSyncComplete) onSyncComplete();
            } else {
                console.error('[SyncEngine] Batch anchor failed:', result.error);
            }
        } finally {
            this.setSyncing(false);
        }
    },

    setSyncing(val: boolean) {
        this.isSyncing = val;
        this.onStatusChange(val);
    }
};
