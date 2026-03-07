export interface GatewayResponse {
    ciphertextB64: string;
    capsuleB64: string;
    cfragB64: string;
    delegatorPublicKeyB64: string;
    verifyingKeyB64: string;
}

export class GatewayClient {
    constructor(private gatewayUrl: string) { }

    /**
     * Request re-encrypted data from the serverless gateway.
     */
    async requestData(userDid: string, recipientPublicKeyB64: string): Promise<GatewayResponse> {
        const response = await fetch(`${this.gatewayUrl}/api/data/request/${userDid}/${recipientPublicKeyB64}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(`Gateway Error (${response.status}): ${errorData?.error || response.statusText}`);
        }

        return response.json() as Promise<GatewayResponse>;
    }
}
