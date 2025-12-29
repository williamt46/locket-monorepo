export * from './types.js';
export * from './FileSystemLedger.js';
export * from './TrafficPadding.js';

// We don't statically export SQLiteLedger from index to prevent crash-on-import
// but we still need it for the factory.
import { SQLiteLedger } from './SQLiteLedger.js';
import { FileSystemLedger } from './FileSystemLedger.js';
import { LedgerStorage } from './types.js';

export async function createPersistentLedger(): Promise<LedgerStorage> {
    try {
        console.log('[Storage] Checking SQLite availability...');
        if (!SQLiteLedger.isAvailable()) {
            throw new Error('SQLite native module is not registered in this environment');
        }

        const sqlite = new SQLiteLedger();
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
