import { CryptoService } from '@locket/crypto-engine';

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

export const SyncService = {
    /**
     * Encrypt baseline clinical data via PRE and upload to the Serverless Gateway.
     */
    async uploadBaselineCiphertext(data: unknown, ownerPublicKeyB64: string): Promise<UploadResult> {
        try {
            console.log('[SyncService] Encrypting baseline data for PRE upload...');
            const encryptedPayload = await cryptoService.encryptLocalData(data, ownerPublicKeyB64);

            const payload = {
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
    }
};
