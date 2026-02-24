export interface StorageRecord {
    id?: string;
    ts: number;
    payload: any;
    status: 'local' | 'anchoring' | 'anchored';
    assetId?: string;
    signature?: string;
    isDummy?: boolean;
}

export interface LedgerStorage {
    init(): Promise<void>;
    saveEvent(record: StorageRecord): Promise<void>;
    saveEvents(records: StorageRecord[]): Promise<void>;
    loadEvents(): Promise<StorageRecord[]>;
    deleteByTimestamp(ts: number): Promise<void>;
    nuke(): Promise<void>;
}
