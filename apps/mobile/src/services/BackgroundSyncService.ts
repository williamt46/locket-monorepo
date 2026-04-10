// BackgroundSyncService.ts
// Optimistic Sync Engine for anchoring local hashes to Hyperledger Fabric in batches

import { BlockchainService } from './BlockchainService';
import { SyncService } from './SyncService';
import { StorageRecord } from '@locket/secure-storage';

const SYNC_THRESHOLD = 7; // Sync every 7 events (aligns with period auto-fill)

export const BackgroundSyncService = {
    isSyncing: false,
    onStatusChange: (syncing: boolean) => { },

    /**
     * Scans the ledger for unanchored ('local') records and anchors them in batches.
     * C2: userDid + ownerPublicKeyB64 are now required to trigger the decoupled
     * ciphertext upload after a successful anchor batch (stale data fix).
     *
     * @param ledger The ledger instance from useLedger
     * @param userDid The patient's DID — needed to index upload at the gateway
     * @param ownerPublicKeyB64 The patient's PRE public key — needed for encryption
     * @param onSyncComplete Optional callback to refresh UI
     */
    async performSync(
        ledger: any,
        userDid?: string,
        ownerPublicKeyB64?: string,
        onSyncComplete?: () => void
    ) {
        if (!ledger) {
            console.warn('[SyncEngine] Skipping performSync: Ledger not initialized.');
            return;
        }
        if (this.isSyncing) return;
        this.setSyncing(true);

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

            await this.executeAnchorBatch(pending, ledger, userDid, ownerPublicKeyB64, onSyncComplete);

        } catch (e) {
            console.error('[SyncEngine] Sync cycle failed:', e);
            this.setSyncing(false);
        }
    },

    /**
     * Bypasses the threshold and anchors all pending records immediately.
     */
    async forceSync(
        ledger: any,
        userDid?: string,
        ownerPublicKeyB64?: string,
        onSyncComplete?: () => void
    ) {
        if (!ledger) {
            console.error('[SyncEngine] Cannot force sync: Ledger is null.');
            return;
        }
        if (this.isSyncing) return;
        this.setSyncing(true);

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

            await this.executeAnchorBatch(pending, ledger, userDid, ownerPublicKeyB64, onSyncComplete);
        } catch (e) {
            console.error('[SyncEngine] Force sync failed:', e);
            this.setSyncing(false);
        }
    },

    async executeAnchorBatch(
        pending: StorageRecord[],
        ledger: any,
        userDid?: string,
        ownerPublicKeyB64?: string,
        onSyncComplete?: () => void
    ) {
        try {
            console.log(`[SyncEngine] Anchoring Batch: Tracking IDs [${pending.map(p => p.signature?.substring(0, 8)).join(', ')}]`);

            // Prepare assets for BlockchainService
            const assets = pending.map(p => ({
                dataHash: p.signature as string,
                id: p.assetId // Usually null for local
            }));

            const result = await BlockchainService.anchorBatch(assets);

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

                // C2: Decouple ciphertext upload from consent grant (stale data fix).
                // After a successful anchor batch, push fresh ciphertext to the gateway
                // so providers never decrypt stale data.
                if (userDid && ownerPublicKeyB64) {
                    const allEvents = await ledger.loadEvents();
                    SyncService.uploadBaselineCiphertext(allEvents, ownerPublicKeyB64, userDid)
                        .then(r => {
                            if (!r.success) console.warn('[SyncEngine] Ciphertext upload failed (non-fatal):', r.error);
                            else console.log('[SyncEngine] Ciphertext upload complete ✓');
                        })
                        .catch(e => console.warn('[SyncEngine] Ciphertext upload threw (non-fatal):', e));
                }

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
