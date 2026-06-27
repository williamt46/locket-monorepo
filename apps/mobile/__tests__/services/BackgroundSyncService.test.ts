import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the on-chain anchor so no network is touched.
vi.mock('../../src/services/BlockchainService', () => ({
    BlockchainService: {
        anchorBatch: vi.fn(),
    },
}));

import { BackgroundSyncService } from '../../src/services/BackgroundSyncService';
import { BlockchainService } from '../../src/services/BlockchainService';

function makeLedger(records: any[]) {
    return {
        loadEvents: vi.fn().mockResolvedValue(records),
        saveEvents: vi.fn().mockResolvedValue(undefined),
    };
}

// Fresh objects per call — executeAnchorBatch mutates record.status in place, so
// sharing a module-level array would leak 'anchored' state across tests.
function freshRecords() {
    return [
        { id: 'a', ts: 1, payload: { iv: 'x', encryptedData: 'y', authTag: 'z' }, status: 'local', signature: '0xhash1' },
        { id: 'b', ts: 2, payload: { iv: 'x', encryptedData: 'y', authTag: 'z' }, status: 'local', signature: '0xhash2' },
    ];
}

const anchorOk = {
    success: true,
    txId: 'tx123',
    results: [{ assetId: 'asset-a' }, { assetId: 'asset-b' }],
};

describe('BackgroundSyncService epoch guard', () => {
    beforeEach(() => {
        BackgroundSyncService.isSyncing = false;
        BackgroundSyncService.onStatusChange = () => { };
        (BlockchainService.anchorBatch as any).mockReset();
    });

    it('writes anchored records back when no reset happens mid-sync', async () => {
        (BlockchainService.anchorBatch as any).mockResolvedValue(anchorOk);
        const ledger = makeLedger(freshRecords());

        await BackgroundSyncService.forceSync(ledger);

        expect(ledger.saveEvents).toHaveBeenCalledTimes(1);
        const saved = (ledger.saveEvents as any).mock.calls[0][0];
        expect(saved).toHaveLength(2);
        expect(saved.every((r: any) => r.status === 'anchored')).toBe(true);
    });

    it('skips the write-back when the store is reset (invalidate) mid-anchor', async () => {
        // Simulate a factory reset landing while the on-chain anchor is in flight:
        // invalidate() bumps the epoch before anchorBatch resolves. The deferred
        // saveEvents must NOT resurrect the pre-reset records into the wiped store.
        (BlockchainService.anchorBatch as any).mockImplementation(async () => {
            BackgroundSyncService.invalidate();
            return anchorOk;
        });
        const ledger = makeLedger(freshRecords());

        await BackgroundSyncService.forceSync(ledger);

        expect(ledger.saveEvents).not.toHaveBeenCalled();
    });

    it('invalidate() bumps the epoch and clears the syncing flag', () => {
        const before = BackgroundSyncService.epoch;
        BackgroundSyncService.isSyncing = true;
        BackgroundSyncService.invalidate();
        expect(BackgroundSyncService.epoch).toBe(before + 1);
        expect(BackgroundSyncService.isSyncing).toBe(false);
    });
});
