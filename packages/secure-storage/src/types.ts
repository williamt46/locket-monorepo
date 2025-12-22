export interface StorageRecord {
    id?: string;
    ts: number;
    payload: any;
    status: 'local' | 'anchoring' | 'anchored';
    assetId?: string;
    signature?: string;
}

export interface LedgerStorage {
    init(): Promise<void>;
    saveEvent(record: StorageRecord): Promise<void>;
    loadEvents(): Promise<StorageRecord[]>;
    nuke(): Promise<void>;
}
