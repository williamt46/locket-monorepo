import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * PR1.S1.3 — Regression: createPersistentLedger() must FAIL CLOSED.
 *
 * On SQLite init failure it throws LedgerInitError and never constructs the
 * plaintext FileSystemLedger, unless the explicit LOCKET_ALLOW_PLAINTEXT_LEDGER
 * opt-in is set. We mock both ledger modules so the test runs in plain Node
 * without the expo-sqlite / expo-file-system native modules.
 */

const state = vi.hoisted(() => ({
    sqliteAvailable: false,
    sqliteInitThrows: false,
    fsConstructed: 0,
    fsInitCalled: 0,
}));

vi.mock('./SQLiteLedger.js', () => ({
    SQLiteLedger: class {
        static isAvailable() { return state.sqliteAvailable; }
        async init() { if (state.sqliteInitThrows) throw new Error('sqlite init boom'); }
        async saveEvent() {}
        async saveEvents() {}
        async loadEvents() { return []; }
        async deleteByTimestamp() {}
        async deleteByIds() {}
        async nuke() {}
    },
}));

vi.mock('./FileSystemLedger.js', () => ({
    FileSystemLedger: class {
        constructor() { state.fsConstructed++; }
        async init() { state.fsInitCalled++; }
        async saveEvent() {}
        async saveEvents() {}
        async loadEvents() { return []; }
        async deleteByTimestamp() {}
        async deleteByIds() {}
        async nuke() {}
    },
}));

import { createPersistentLedger } from './index.js';
import { LedgerInitError } from './types.js';

describe('createPersistentLedger — refuse plaintext fallback (PR1)', () => {
    beforeEach(() => {
        state.sqliteAvailable = false;
        state.sqliteInitThrows = false;
        state.fsConstructed = 0;
        state.fsInitCalled = 0;
        delete process.env.LOCKET_ALLOW_PLAINTEXT_LEDGER;
    });
    afterEach(() => {
        delete process.env.LOCKET_ALLOW_PLAINTEXT_LEDGER;
    });

    it('rejects with LedgerInitError when SQLite is unavailable, and never builds the FileSystem ledger', async () => {
        await expect(createPersistentLedger()).rejects.toBeInstanceOf(LedgerInitError);
        expect(state.fsConstructed).toBe(0);
        expect(state.fsInitCalled).toBe(0);
    });

    it('rejects with LedgerInitError when SQLite init throws, preserving the cause', async () => {
        state.sqliteAvailable = true;
        state.sqliteInitThrows = true;
        await expect(createPersistentLedger()).rejects.toBeInstanceOf(LedgerInitError);
        await createPersistentLedger().catch((err) => {
            expect(err).toBeInstanceOf(LedgerInitError);
            expect((err as LedgerInitError).cause).toBeInstanceOf(Error);
        });
        expect(state.fsConstructed).toBe(0);
    });

    it('returns the SQLite ledger when init succeeds (no fallback constructed)', async () => {
        state.sqliteAvailable = true;
        const ledger = await createPersistentLedger();
        expect(ledger).toBeDefined();
        expect(state.fsConstructed).toBe(0);
    });

    it('uses the FileSystem ledger ONLY when the explicit opt-in is set', async () => {
        process.env.LOCKET_ALLOW_PLAINTEXT_LEDGER = '1';
        const ledger = await createPersistentLedger();
        expect(ledger).toBeDefined();
        expect(state.fsConstructed).toBe(1);
        expect(state.fsInitCalled).toBe(1);
    });
});
