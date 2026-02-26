import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { SyncService } from '../../src/services/SyncService';

// Mock the CryptoService from @locket/crypto-engine
vi.mock('@locket/crypto-engine', () => {
    return {
        CryptoService: vi.fn().mockImplementation(function () {
            return {
                encryptLocalData: vi.fn().mockResolvedValue({
                    ciphertextB64: 'mockCiphertext',
                    capsuleB64: 'mockCapsule',
                    anchorHash: 'mockAnchorHash'
                }),
                generateConsentKFrag: vi.fn().mockReturnValue({
                    kfragB64: 'mockKFrag',
                    verifyingKeyB64: 'mockVerifyingKey'
                })
            };
        })
    };
});

// Mock global fetch
const originalFetch = global.fetch;

describe('SyncService', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({}),
            text: vi.fn().mockResolvedValue('')
        }) as Mock;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.clearAllMocks();
    });

    describe('uploadBaselineCiphertext', () => {
        it('should encrypt data and upload PRE payload to Serverless Gateway', async () => {
            const data = { bp: '120/80' };
            const ownerPublicKeyB64 = 'mockPublicKeyB64';

            const result = await SyncService.uploadBaselineCiphertext(data, ownerPublicKeyB64);

            expect(result.success).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/data/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ciphertextB64: 'mockCiphertext',
                    capsuleB64: 'mockCapsule'
                })
            });
        });
    });

    describe('grantAccess', () => {
        it('should generate kFrag and grant consent via Serverless Gateway', async () => {
            const ownerSecretKeyB64 = 'mockSecretKey';
            const recipientPublicKeyB64 = 'mockRecipientKey';
            const recipientDID = 'did:locket:clinic';
            const duration = '24h';

            const result = await SyncService.grantAccess(
                ownerSecretKeyB64,
                recipientPublicKeyB64,
                recipientDID,
                duration
            );

            expect(result.success).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/consent/grant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kfragB64: 'mockKFrag',
                    verifyingKeyB64: 'mockVerifyingKey',
                    recipientDID,
                    duration
                })
            });
        });
    });
});
