export interface EncryptedPayload {
    iv: string;
    content: string; // or encryptedData
    tag: string; // or authTag
}

export interface LedgerEntry {
    timestamp: number;
    payload: EncryptedPayload;
    previousHash?: string;
}
