import * as SQLite from 'expo-sqlite';
import { LedgerStorage, StorageRecord } from './types.js';

export class SQLiteLedger implements LedgerStorage {
    private db: SQLite.SQLiteDatabase | null = null;
    private dbName: string;

    constructor(dbName: string = 'locket.db') {
        this.dbName = dbName;
    }

    async init(): Promise<void> {
        this.db = await SQLite.openDatabaseAsync(this.dbName);

        // Use a transaction to ensure atomic schema creation
        await this.db.execAsync(`
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY NOT NULL,
                ts INTEGER NOT NULL,
                payload TEXT NOT NULL,
                status TEXT NOT NULL,
                assetId TEXT,
                signature TEXT,
                is_dummy INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
            CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
        `);
    }

    async saveEvent(record: StorageRecord): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const id = record.id || Math.random().toString(36).substring(7); // Simple fallback ID
        const payloadStr = typeof record.payload === 'string' ? record.payload : JSON.stringify(record.payload);

        await this.db.runAsync(
            `INSERT INTO events (id, ts, payload, status, assetId, signature, is_dummy) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, record.ts, payloadStr, record.status, record.assetId || null, record.signature || null, record.isDummy ? 1 : 0]
        );
    }

    async loadEvents(): Promise<StorageRecord[]> {
        if (!this.db) throw new Error('Database not initialized');

        const rows = await this.db.getAllAsync<any>(
            'SELECT * FROM events WHERE is_dummy = 0 ORDER BY ts DESC'
        );

        return rows.map(row => ({
            id: row.id,
            ts: row.ts,
            payload: this.tryParsePayload(row.payload),
            status: row.status,
            assetId: row.assetId,
            signature: row.signature,
            isDummy: row.is_dummy === 1
        }));
    }

    async nuke(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        await this.db.execAsync('DELETE FROM events');
    }

    /**
     * Internal: Inserts a dummy row for traffic padding.
     */
    async insertDummy(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const dummyRecord: StorageRecord = {
            id: `dummy_${Math.random().toString(36).substring(7)}`,
            ts: Date.now(),
            payload: { noise: Math.random().toString(36) },
            status: 'local',
            isDummy: true
        };

        await this.saveEvent(dummyRecord);
    }

    private tryParsePayload(payload: string): any {
        try {
            return JSON.parse(payload);
        } catch {
            return payload;
        }
    }
}
