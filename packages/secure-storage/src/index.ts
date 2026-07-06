export * from './types.js';
export * from './FileSystemLedger.js';

// We don't statically export SQLiteLedger from index to prevent crash-on-import
// but we still need it for the factory.
import { SQLiteLedger } from './SQLiteLedger.js';
import { FileSystemLedger } from './FileSystemLedger.js';
import { LedgerStorage, LedgerInitError } from './types.js';

/**
 * Build the persistent ledger.
 *
 * The encrypted SQLite ledger is the ONLY supported production store. If it
 * fails to initialize we FAIL CLOSED with a LedgerInitError rather than
 * silently downgrading to the plaintext FileSystemLedger (which writes
 * cleartext events.json to disk). The plaintext fallback is reachable only
 * via an explicit, opt-in dev/test escape hatch and is NEVER auto-enabled by
 * NODE_ENV or any implicit signal.
 */
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
        if (process.env.LOCKET_ALLOW_PLAINTEXT_LEDGER === '1') {
            console.warn('[Storage] SQLite unavailable and LOCKET_ALLOW_PLAINTEXT_LEDGER=1 — using plaintext FileSystem ledger (DEV/TEST ONLY).');
            const fsLedger = new FileSystemLedger();
            await fsLedger.init();
            return fsLedger;
        }
        throw new LedgerInitError(
            'Encrypted ledger (SQLite) failed to initialize; refusing to fall back to plaintext storage.',
            { cause: e }
        );
    }
}
