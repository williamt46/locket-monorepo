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
    /** Removes records whose id is in `ids`; returns how many were removed. */
    deleteByIds(ids: string[]): Promise<number>;
    nuke(): Promise<void>;
}

/**
 * Thrown when the encrypted (SQLite) ledger cannot initialize and the factory
 * refuses to silently downgrade to plaintext on-disk storage. Carries the
 * underlying failure as `cause` so callers can surface diagnostics.
 */
export class LedgerInitError extends Error {
    readonly cause?: unknown;
    constructor(message: string, options?: { cause?: unknown }) {
        super(message);
        this.name = 'LedgerInitError';
        if (options && 'cause' in options) {
            this.cause = options.cause;
        }
        // Preserve prototype chain when targeting older TS lib levels.
        Object.setPrototypeOf(this, LedgerInitError.prototype);
    }
}
