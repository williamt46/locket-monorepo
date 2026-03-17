// BackgroundSyncService.ts
// Optimistic Sync Engine for anchoring local hashes to Hyperledger Fabric in batches

import { BlockchainService } from './BlockchainService';
import { SyncService } from './SyncService';
import { LocketCryptoService } from '@locket/core-crypto';
import * as SecureStore from 'expo-secure-store';
import { StorageRecord } from '@locket/secure-storage';

const PRE_KEYPAIR_KEY = 'locket_pre_keypair';
const crypto = new LocketCryptoService();

const SYNC_THRESHOLD = 7; // Sync every 7 events (aligns with period auto-fill)

export const BackgroundSyncService = {
    isSyncing: false,
    onStatusChange: (syncing: boolean) => { },

    /**
     * Scans the ledger for unanchored ('local') records and anchors them in batches.
     * @param ledger The ledger instance from useLedger
     * @param onSyncComplete Optional callback to refresh UI
     * @param keyHex Optional symmetric key to enable decoupled PRE upload
     */
    async performSync(ledger: any, onSyncComplete?: () => void, keyHex?: string) {
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

            await this.executeAnchorBatch(pending, ledger, onSyncComplete);

        } catch (e) {
            console.error('[SyncEngine] Sync cycle failed:', e);
            this.setSyncing(false);
        }
    },

    /**
     * Bypasses the threshold and anchors all pending records immediately.
     */
    async forceSync(ledger: any, onSyncComplete?: () => void, keyHex?: string) {
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

            await this.executeAnchorBatch(pending, ledger, onSyncComplete);
        } catch (e) {
            console.error('[SyncEngine] Force sync failed:', e);
            this.setSyncing(false);
        }
    },

    async executeAnchorBatch(pending: StorageRecord[], ledger: any, onSyncComplete?: () => void, keyHex?: string) {
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

                // --- NEW: Decoupled PRE Upload ---
                // Trigger an optimistic baseline upload to the gateway so clinical data is always fresh.
                // This ensures that even if consent is granted later, the gateway already has the latest ciphertext.
                if (keyHex) {
                    this.triggerDecoupledUpload(ledger, keyHex);
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
    },

    /**
     * Performs a decoupled upload of the entire ledger to the gateway.
     * Decrypts local records using keyHex and re-encrypts for Gateway via SyncService.
     */
    async triggerDecoupledUpload(ledger: any, keyHex: string) {
        try {
            const keyPairStr = await SecureStore.getItemAsync(PRE_KEYPAIR_KEY);
            if (!keyPairStr) {
                console.log('[SyncEngine] PRE Upload skipped: No PRE keys found.');
                return;
            }

            const { publicKeyB64 } = JSON.parse(keyPairStr);
            const allEvents: StorageRecord[] = await ledger.loadEvents();

            // Decrypt all events to create a fresh baseline for the provider
            const decryptedData: any[] = [];
            for (const record of allEvents) {
                try {
                    const decrypted = await crypto.decryptData(record.payload, keyHex);
                    decryptedData.push(decrypted);
                } catch (e) {
                    console.error('[SyncEngine] Failed to decrypt record for PRE upload:', e);
                }
            }

            const result = await SyncService.uploadBaselineCiphertext(decryptedData, publicKeyB64);
            if (result.success) {
                console.log(`[SyncEngine] Decoupled PRE baseline uploaded (${decryptedData.length} events).`);
            } else {
                console.error('[SyncEngine] Decoupled PRE upload failed:', result.error);
            }
        } catch (e) {
            console.error('[SyncEngine] Unexpected error in decoupled upload:', e);
        }
    }
};
