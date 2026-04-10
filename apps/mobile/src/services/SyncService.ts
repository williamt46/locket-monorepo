import { CryptoService } from '@locket/crypto-engine';
import { ConsentRequest } from '../types/ConsentTypes';

const GATEWAY_URL = 'http://localhost:3000/api';

const cryptoService = new CryptoService();

export interface UploadResult {
    success: boolean;
    error?: string;
}

export interface GrantResult {
    success: boolean;
    error?: string;
}

export interface RegisterResult {
    sessionToken: string | null;
    error?: string;
}

export interface RevokeResult {
    success: boolean;
    error?: string;
}

export const SyncService = {
    /**
     * Encrypt baseline clinical data via PRE and upload to the Serverless Gateway.
     * C1 fix: userDid is now required so the gateway can index the ciphertext correctly.
     */
    async uploadBaselineCiphertext(
        data: unknown,
        ownerPublicKeyB64: string,
        userDid: string
    ): Promise<UploadResult> {
        try {
            console.log('[SyncService] Encrypting baseline data for PRE upload...');
            const encryptedPayload = await cryptoService.encryptLocalData(data, ownerPublicKeyB64);

            const payload = {
                userDid,
                ciphertextB64: encryptedPayload.ciphertextB64,
                capsuleB64: encryptedPayload.capsuleB64,
            };

            console.log('[SyncService] Uploading to Serverless Gateway...');
            const response = await fetch(`${GATEWAY_URL}/data/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Gateway data upload request failed');
            }

            return { success: true };
        } catch (e: any) {
            console.error('[SyncService] Data upload failed:', e);
            return { success: false, error: e.message };
        }
    },

    /**
     * Grant access to another user (e.g. clinic) by generating a kFrag and anchoring it on-chain.
     */
    async grantAccess(
        ownerSecretKeyB64: string,
        recipientPublicKeyB64: string,
        recipientDID: string,
        duration: string
    ): Promise<GrantResult> {
        try {
            console.log('[SyncService] Generating consent kFrag...');
            const kFrag = await cryptoService.generateConsentKFrag(ownerSecretKeyB64, recipientPublicKeyB64);

            const payload = {
                kfragB64: kFrag.kfragB64,
                verifyingKeyB64: kFrag.verifyingKeyB64,
                recipientDID,
                duration
            };

            console.log('[SyncService] Granting consent via Serverless Gateway...');
            const response = await fetch(`${GATEWAY_URL}/consent/grant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Gateway consent grant request failed');
            }

            return { success: true };
        } catch (e: any) {
            console.error('[SyncService] Consent grant failed:', e);
            return { success: false, error: e.message };
        }
    },

    // ─── Phase 6.5 — Reversed QR Consent ───────────────────────────────────

    /**
     * C3: Register this device with the gateway and obtain a session token.
     * Token is stored in SecureStore by the caller (useConsentRequests hook).
     */
    async registerSession(userDid: string): Promise<RegisterResult> {
        try {
            const response = await fetch(`${GATEWAY_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userDid }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Session registration failed');
            }

            const { sessionToken } = await response.json();
            return { sessionToken };
        } catch (e: any) {
            console.error('[SyncService] registerSession failed:', e);
            return { sessionToken: null, error: e.message };
        }
    },

    /**
     * C3: Fetch pending consent requests for a userDid.
     * Requires a valid sessionToken obtained via registerSession().
     * Returns the raw requests array from the gateway.
     * Caller is responsible for filtering locally-denied requests.
     */
    async fetchPendingRequests(
        userDid: string,
        sessionToken: string
    ): Promise<ConsentRequest[]> {
        const response = await fetch(`${GATEWAY_URL}/consent/pending/${encodeURIComponent(userDid)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.text();
            const statusError = new Error(error || 'Failed to fetch pending requests');
            (statusError as any).status = response.status;
            throw statusError;
        }

        const { requests } = await response.json();
        return requests as ConsentRequest[];
    },

    /**
     * C3: Revoke active consent — removes pending request and logs on-chain.
     */
    async revokeAccess(
        requestId: string,
        userDid: string,
        recipientPublicKeyB64: string,
        sessionToken: string
    ): Promise<RevokeResult> {
        try {
            const response = await fetch(`${GATEWAY_URL}/consent/revoke/${encodeURIComponent(requestId)}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userDid, recipientPublicKeyB64 }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Revoke request failed');
            }

            return { success: true };
        } catch (e: any) {
            console.error('[SyncService] revokeAccess failed:', e);
            return { success: false, error: e.message };
        }
    },
};
