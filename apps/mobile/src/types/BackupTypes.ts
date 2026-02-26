export interface LocketBackupFile {
    version: number;
    createdAt: number;
    integrityHash: string;
    envelope: {
        wrappedDEK: string;
        dekIV: string;
        dekAuthTag: string;
        dataIV: string;
        dataAuthTag: string;
        encryptedData: string;
    };
}

export interface RestoreResult {
    success: boolean;
    eventsRestored: number;
    configRestored: boolean;
    error?: string;
}
