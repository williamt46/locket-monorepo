export * from './types.js';
export * from './SQLiteLedger.js';
export * from './FileSystemLedger.js';
export * from './TrafficPadding.js';

import { SQLiteLedger } from './SQLiteLedger.js';
import { FileSystemLedger } from './FileSystemLedger.js';
import { LedgerStorage } from './types.js';

export async function createPersistentLedger(): Promise<LedgerStorage> {
    const sqlite = new SQLiteLedger();
    try {
        console.log('[Storage] Attempting SQLite initialization...');
        await sqlite.init();
        console.log('[Storage] SQLite initialized successfully.');
        return sqlite;
    } catch (e) {
        console.warn('[Storage] SQLite failed, falling back to FileSystem storage:', e);
        const fsLedger = new FileSystemLedger();
        await fsLedger.init();
        return fsLedger;
    }
}
