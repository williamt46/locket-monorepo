// BlockchainService.ts
// Handles anchoring and verification of data hashes via the Locket Gateway (Hyperledger Fabric)

const GATEWAY_URL = 'http://localhost:3000/api';
const DEFAULT_USER_DID = 'did:locket:testUser1';

export interface AnchorResult {
    success: boolean;
    assetId?: string;
    txId?: string;
    error?: string;
}

export interface BatchAnchorResult {
    success: boolean;
    txId?: string;
    results?: Array<{ assetId: string }>;
    error?: string;
}

export const BlockchainService = {
    /**
     * Anchor a single data hash to the blockchain.
     */
    async anchorHash(dataHash: string, userDID: string = DEFAULT_USER_DID): Promise<AnchorResult> {
        try {
            console.log(`[BlockchainService] Anchoring single hash: ${dataHash.substring(0, 16)}...`);

            const response = await fetch(`${GATEWAY_URL}/anchor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userDID, dataHash })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Gateway anchor request failed');
            }

            const data = await response.json();
            return {
                success: true,
                assetId: data.assetId,
                txId: data.txId
            };
        } catch (e: any) {
            console.error('[BlockchainService] Anchor failed:', e);
            return { success: false, error: e.message };
        }
    },

    /**
     * Anchor a batch of data hashes in a single blockchain transaction.
     */
    async anchorBatch(assets: Array<{ id?: string; dataHash: string; userDID?: string }>): Promise<BatchAnchorResult> {
        try {
            console.log(`[BlockchainService] Anchoring batch of ${assets.length} assets...`);

            // Map assets to ensure userDID is present
            const payload = assets.map(a => ({
                id: a.id,
                dataHash: a.dataHash,
                userDID: a.userDID || DEFAULT_USER_DID
            }));

            const response = await fetch(`${GATEWAY_URL}/anchor/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assets: payload })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Gateway batch anchor request failed');
            }

            const data = await response.json();
            return {
                success: true,
                txId: data.txId,
                results: data.results
            };
        } catch (e: any) {
            console.error('[BlockchainService] Batch anchor failed:', e);
            return { success: false, error: e.message };
        }
    },

    /**
     * Verify a local hash against the on-chain anchor.
     */
    async verifyHash(assetId: string, localHash: string): Promise<{ verified: boolean; remoteHash?: string; error?: string }> {
        try {
            const response = await fetch(`${GATEWAY_URL}/verify/${assetId}`);
            if (!response.ok) {
                if (response.status === 404) return { verified: false, error: 'Asset not found on-chain' };
                throw new Error('Gateway verification request failed');
            }

            const chainData = await response.json();
            const remoteHash = chainData.dataHash;

            return {
                verified: remoteHash === localHash,
                remoteHash
            };
        } catch (e: any) {
            console.error('[BlockchainService] Verification failed:', e);
            return { verified: false, error: e.message };
        }
    }
};
