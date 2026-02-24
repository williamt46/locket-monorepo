import * as SQLite from 'expo-sqlite';
import { LedgerStorage, StorageRecord } from './types.js';

export class SQLiteLedger implements LedgerStorage {
    private db: SQLite.SQLiteDatabase | null = null;

    static isAvailable(): boolean {
        const g = global as any;
        const available = !!(g.ExpoModules?.ExpoSQLite || g.nativeModuleProxy?.ExpoSQLite || g.NativeModules?.ExpoSQLite);
        if (!available) {
            console.log('[SQLiteLedger] Module check failed:', {
                ExpoModules: !!g.ExpoModules,
                ExpoSQLite: !!g.ExpoModules?.ExpoSQLite,
                NativeModules: !!g.NativeModules?.ExpoSQLite
            });
        }
        return available;
    }

    async init(): Promise<void> {
        this.db = await SQLite.openDatabaseAsync('locket.db');
        await this.db.execAsync(`
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                ts INTEGER NOT NULL,
                payload TEXT NOT NULL,
                status TEXT NOT NULL,
                assetId TEXT,
                signature TEXT,
                is_dummy INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
        `);
    }

    async saveEvent(record: StorageRecord): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        await this.db.runAsync(
            'INSERT OR REPLACE INTO events (id, ts, payload, status, assetId, signature, is_dummy) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                record.id || Math.random().toString(36).substring(7),
                record.ts,
                JSON.stringify(record.payload),
                record.status,
                record.assetId || null,
                record.signature || null,
                record.isDummy ? 1 : 0
            ]
        );
    }

    async saveEvents(records: StorageRecord[]): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        // Note: Expo SQLite doesn't support explicit transactions in all versions easily, 
        // but we can use execAsync or a loop with runAsync. 
        // For efficiency, we use a single transaction wrap if supported or just loop.
        await this.db.withTransactionAsync(async () => {
            for (const record of records) {
                await (this.db as any).runAsync(
                    'INSERT OR REPLACE INTO events (id, ts, payload, status, assetId, signature, is_dummy) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [
                        record.id || Math.random().toString(36).substring(7),
                        record.ts,
                        JSON.stringify(record.payload),
                        record.status,
                        record.assetId || null,
                        record.signature || null,
                        record.isDummy ? 1 : 0
                    ]
                );
            }
        });
        console.log(`[SQLiteLedger] Batch saved ${records.length} events`);
    }

    async loadEvents(): Promise<StorageRecord[]> {
        if (!this.db) throw new Error('Database not initialized');

        const rows = await (this.db as any).getAllAsync(
            'SELECT * FROM events WHERE is_dummy = 0 ORDER BY ts DESC, rowid DESC'
        );

        console.log(`[SQLiteLedger] Loaded ${rows.length} non-dummy events`);
        return rows.map((row: any) => ({
            id: row.id,
            ts: row.ts,
            payload: this.tryParsePayload(row.payload),
            status: row.status,
            assetId: row.assetId,
            signature: row.signature,
            isDummy: row.is_dummy === 1
        }));
    }

    async deleteByTimestamp(ts: number): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        const date = new Date(ts);
        // Start and end of day in ms
        const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

        await (this.db as any).runAsync(
            'DELETE FROM events WHERE ts >= ? AND ts <= ? AND is_dummy = 0',
            [startOfDay, endOfDay]
        );
        console.log(`[SQLiteLedger] Deleted events between ${new Date(startOfDay).toISOString()} and ${new Date(endOfDay).toISOString()}`);
    }

    async nuke(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        await this.db.execAsync('DELETE FROM events');
    }

    private tryParsePayload(payload: string): any {
        try {
            return JSON.parse(payload);
        } catch {
            return payload;
        }
    }
}
