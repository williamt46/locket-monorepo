import { CryptoService } from '@locket/crypto-engine';
import { GatewayResponse } from './GatewayClient.js';

export class DecryptionService {
    private cryptoService: CryptoService;

    constructor() {
        this.cryptoService = new CryptoService();
    }

    /**
     * Decrypt the re-encrypted data returned by the serverless gateway.
     */
    async decryptSharedData(
        recipientSecretKeyB64: string,
        gatewayResponse: GatewayResponse
    ): Promise<unknown> {
        return this.cryptoService.decryptAsRecipient(
            recipientSecretKeyB64,
            gatewayResponse.delegatorPublicKeyB64,
            gatewayResponse.capsuleB64,
            [gatewayResponse.cfragB64],
            gatewayResponse.ciphertextB64,
            gatewayResponse.verifyingKeyB64
        );
    }
}
