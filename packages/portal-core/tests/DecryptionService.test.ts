import { describe, it, expect, vi } from 'vitest';
import { DecryptionService } from '../src/DecryptionService.js';
import { CryptoService } from '@locket/crypto-engine';
import type { GatewayResponse } from '../src/GatewayClient.js';

const mockDecryptAsRecipient = vi.fn().mockResolvedValue({ success: true, fromMock: true });

// Mock CryptoService
vi.mock('@locket/crypto-engine', () => {
    return {
        CryptoService: class {
            decryptAsRecipient = mockDecryptAsRecipient;
        }
    };
});

describe('DecryptionService', () => {
    it('should forward gateway response correctly to decryptAsRecipient', async () => {
        const service = new DecryptionService();

        const gatewayResponse: GatewayResponse = {
            ciphertextB64: 'fake-cipher',
            capsuleB64: 'fake-capsule',
            cfragB64: 'fake-cfrag',
            delegatorPublicKeyB64: 'fake-owner-pk',
            verifyingKeyB64: 'fake-verifying-key'
        };

        const result = await service.decryptSharedData('fake-recipient-sk', gatewayResponse);

        expect(result).toEqual({ success: true, fromMock: true });

        // Assert that the mocked decryptAsRecipient was called with correct args
        expect(mockDecryptAsRecipient).toHaveBeenCalledWith(
            'fake-recipient-sk',
            'fake-owner-pk',
            'fake-capsule',
            ['fake-cfrag'],
            'fake-cipher',
            'fake-verifying-key'
        );
    });
});
