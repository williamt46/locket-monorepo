import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackgroundSyncService } from '../src/services/BackgroundSyncService';
import { BlockchainService } from '../src/services/BlockchainService';
import { SyncService } from '../src/services/SyncService';
import { LocketCryptoService } from '@locket/core-crypto';

vi.mock('../src/services/BlockchainService');
vi.mock('../src/services/SyncService');
vi.mock('@locket/core-crypto');

describe('BackgroundSyncService Decoupled Upload', () => {
    let mockLedger: any;
    let crypto: LocketCryptoService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockLedger = {
            loadEvents: vi.fn(),
            saveEvents: vi.fn(),
        };
        // @ts-ignore
        crypto = new LocketCryptoService();
    });

    it('should trigger uploadBaselineCiphertext after successful batch anchoring', async () => {
        const mockEvents = [
            { status: 'local', signature: 'sig1', payload: 'enc1', ts: 100 },
            { status: 'local', signature: 'sig2', payload: 'enc2', ts: 200 }
        ];

        mockLedger.loadEvents.mockResolvedValue(mockEvents);
        
        // Mock successful anchoring
        (BlockchainService.anchorBatch as any).mockResolvedValue({
            success: true,
            results: [{ assetId: 'a1' }, { assetId: 'a2' }],
            txId: 'tx123'
        });

        // Mock successful upload
        (SyncService.uploadBaselineCiphertext as any).mockResolvedValue({ success: true });

        // Mock decryption
        (crypto.decryptData as any).mockImplementation((payload: string) => {
            if (payload === 'enc1') return { val: 'data1' };
            if (payload === 'enc2') return { val: 'data2' };
            return null;
        });

        // We need to pass keyHex and publicKey to BackgroundSyncService
        // OR have it derived. For testing, let's assume we pass them or they are injected.
        // Let's refine the method signature in the test first.
        const keyHex = 'mock-key';
        const publicKey = 'mock-pub-key';

        await BackgroundSyncService.forceSync(mockLedger, undefined, keyHex);

        // 1. Verify anchoring happened
        expect(BlockchainService.anchorBatch).toHaveBeenCalled();

        // 2. Verify all events were loaded and decrypted for the baseline
        // Actually, it should upload the *entire* ledger as a baseline.
        // Let's assume loadEvents returns all events.
        expect(crypto.decryptData).toHaveBeenCalledTimes(2);

        // 3. Verify uploadBaselineCiphertext was called with decrypted data
        expect(SyncService.uploadBaselineCiphertext).toHaveBeenCalledWith(
            expect.arrayContaining([{ val: 'data1' }, { val: 'data2' }]),
            publicKey
        );
    });

    it('should NOT trigger upload if anchoring fails', async () => {
        const mockEvents = [{ status: 'local', signature: 'sig1', payload: 'enc1', ts: 100 }];
        mockLedger.loadEvents.mockResolvedValue(mockEvents);

        (BlockchainService.anchorBatch as any).mockResolvedValue({
            success: false,
            error: 'Fabric error'
        });

        await BackgroundSyncService.forceSync(mockLedger, undefined, 'k');

        expect(SyncService.uploadBaselineCiphertext).not.toHaveBeenCalled();
    });
});
