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

    // ── uploadBaselineCiphertext ─────────────────────────────────────────────

    describe('uploadBaselineCiphertext', () => {
        it('should encrypt data and upload PRE payload including userDid', async () => {
            const data = { bp: '120/80' };
            const ownerPublicKeyB64 = 'mockPublicKeyB64';
            const userDid = 'did:locket:alice';

            const result = await SyncService.uploadBaselineCiphertext(data, ownerPublicKeyB64, userDid);

            expect(result.success).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/data/upload',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userDid,
                        ciphertextB64: 'mockCiphertext',
                        capsuleB64:    'mockCapsule',
                    })
                })
            );
        });

        it('should return success:false when the server returns non-ok', async () => {
            (global.fetch as Mock).mockResolvedValueOnce({
                ok: false,
                json: vi.fn().mockResolvedValue({ error: 'Server error' }),
                text: vi.fn().mockResolvedValue('Server error'),
            });

            const result = await SyncService.uploadBaselineCiphertext(
                { bp: '120/80' }, 'mockPublicKeyB64', 'did:locket:alice'
            );

            expect(result.success).toBe(false);
        });

        it('should return success:false when fetch throws', async () => {
            (global.fetch as Mock).mockRejectedValueOnce(new Error('Network down'));

            const result = await SyncService.uploadBaselineCiphertext(
                { bp: '120/80' }, 'mockPublicKeyB64', 'did:locket:alice'
            );

            expect(result.success).toBe(false);
        });
    });

    // ── grantAccess ─────────────────────────────────────────────────────────

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
                    kfragB64:       'mockKFrag',
                    verifyingKeyB64:'mockVerifyingKey',
                    recipientDID,
                    duration
                })
            });
        });
    });

    // ── registerSession ──────────────────────────────────────────────────────

    describe('registerSession', () => {
        it('should POST /api/auth/register and return a session token', async () => {
            const userDid = 'did:locket:alice';
            (global.fetch as Mock).mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({ sessionToken: 'tok_abc123' }),
                text: vi.fn().mockResolvedValue(''),
            });

            const result = await SyncService.registerSession(userDid);

            expect(result.sessionToken).toBe('tok_abc123');
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/auth/register',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userDid }),
                })
            );
        });

        it('should return sessionToken:null and error when server returns non-ok', async () => {
            (global.fetch as Mock).mockResolvedValueOnce({
                ok: false,
                json: vi.fn().mockResolvedValue({}),
                text: vi.fn().mockResolvedValue('Unauthorized'),
            });

            const result = await SyncService.registerSession('did:locket:alice');
            expect(result.sessionToken).toBeNull();
            expect(result.error).toBeTruthy();
        });
    });

    // ── fetchPendingRequests ─────────────────────────────────────────────────

    describe('fetchPendingRequests', () => {
        const userDid      = 'did:locket:alice';
        const sessionToken = 'tok_abc123';

        it('should GET /api/consent/pending/:userDid with Bearer auth and return requests', async () => {
            const mockRequests = [
                { requestId: 'req1', displayName: 'Dr. Smith', requestedDuration: '24h' }
            ];
            (global.fetch as Mock).mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({ requests: mockRequests }),
                text: vi.fn().mockResolvedValue(''),
            });

            const result = await SyncService.fetchPendingRequests(userDid, sessionToken);

            expect(result).toEqual(mockRequests);
            expect(global.fetch).toHaveBeenCalledWith(
                `http://localhost:3000/api/consent/pending/${encodeURIComponent(userDid)}`,
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${sessionToken}`,
                    }),
                })
            );
        });

        it('should throw with .status = 401 when auth fails', async () => {
            (global.fetch as Mock).mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: vi.fn().mockResolvedValue({}),
                text: vi.fn().mockResolvedValue('Unauthorized'),
            });

            await expect(SyncService.fetchPendingRequests(userDid, sessionToken))
                .rejects.toMatchObject({ status: 401 });
        });

        it('should return empty array when no pending requests', async () => {
            (global.fetch as Mock).mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({ requests: [] }),
                text: vi.fn().mockResolvedValue(''),
            });

            const result = await SyncService.fetchPendingRequests(userDid, sessionToken);
            expect(result).toEqual([]);
        });
    });

    // ── revokeAccess ─────────────────────────────────────────────────────────

    describe('revokeAccess', () => {
        const requestId             = 'req_xyz';
        const userDid               = 'did:locket:alice';
        const recipientPublicKeyB64 = 'mockRecipientPubKey';
        const sessionToken          = 'tok_abc123';

        it('should POST /api/consent/revoke/:requestId with Bearer auth', async () => {
            (global.fetch as Mock).mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({ revoked: true }),
                text: vi.fn().mockResolvedValue(''),
            });

            const result = await SyncService.revokeAccess(
                requestId, userDid, recipientPublicKeyB64, sessionToken
            );

            expect(result.success).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                `http://localhost:3000/api/consent/revoke/${requestId}`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization:  `Bearer ${sessionToken}`,
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({ userDid, recipientPublicKeyB64 }),
                })
            );
        });

        it('should return success:false when revoke returns non-ok', async () => {
            (global.fetch as Mock).mockResolvedValueOnce({
                ok: false,
                json: vi.fn().mockResolvedValue({}),
                text: vi.fn().mockResolvedValue('Forbidden'),
            });

            const result = await SyncService.revokeAccess(
                requestId, userDid, recipientPublicKeyB64, sessionToken
            );
            expect(result.success).toBe(false);
        });
    });
});
