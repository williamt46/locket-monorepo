import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression coverage for the SDK 54 SQLite-detection fix (commit 6440e27).
 *
 * The previous heuristic checked global.ExpoModules / nativeModuleProxy /
 * NativeModules for the ExpoSQLite native module. On the new architecture
 * (SDK 54+) none of those hold the module, so isAvailable() returned false
 * even when SQLite genuinely was available — a false negative that silently
 * forced the plaintext FileSystem fallback on every boot (the exact failure
 * mode createPersistentLedger() now refuses to paper over, see index.test.ts).
 *
 * isAvailable() now delegates entirely to expo's requireOptionalNativeModule.
 * We mock 'expo' (not 'expo-sqlite', which SQLiteLedger also imports for the
 * DB driver) so this runs under plain Node/vitest without native bindings.
 */

const state = vi.hoisted(() => ({ resolved: null as any, db: null as any }));

vi.mock('expo', () => ({
    requireOptionalNativeModule: vi.fn((name: string) => state.resolved),
}));

vi.mock('expo-sqlite', () => ({
    openDatabaseAsync: vi.fn(async () => state.db),
}));

import { SQLiteLedger } from './SQLiteLedger.js';
import { requireOptionalNativeModule } from 'expo';

describe('SQLiteLedger.isAvailable — SDK 54 native module detection', () => {
    beforeEach(() => {
        state.resolved = null;
        vi.clearAllMocks();
    });

    it('returns true when requireOptionalNativeModule resolves the ExpoSQLite module', () => {
        state.resolved = { openDatabaseAsync: () => {} };
        expect(SQLiteLedger.isAvailable()).toBe(true);
        expect(requireOptionalNativeModule).toHaveBeenCalledWith('ExpoSQLite');
    });

    it('returns false when requireOptionalNativeModule resolves null (module truly absent)', () => {
        state.resolved = null;
        expect(SQLiteLedger.isAvailable()).toBe(false);
    });

    it('returns false when requireOptionalNativeModule resolves undefined', () => {
        state.resolved = undefined;
        expect(SQLiteLedger.isAvailable()).toBe(false);
    });

    it('logs a diagnostic (not a stale multi-source dump) when unavailable', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        state.resolved = null;
        SQLiteLedger.isAvailable();
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('ExpoSQLite native module not found via requireOptionalNativeModule'),
        );
        logSpy.mockRestore();
    });

    it('does not log when the module is available', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        state.resolved = { openDatabaseAsync: () => {} };
        SQLiteLedger.isAvailable();
        expect(logSpy).not.toHaveBeenCalled();
        logSpy.mockRestore();
    });
});

/**
 * deleteByIds now RETURNS the number of rows actually removed (it used to return
 * void). The §14 Undo banner reports that count, so a wrong number is a
 * user-visible lie — pin the contract against a fake SQLiteDatabase.
 */
describe('SQLiteLedger.deleteByIds — removed-row count', () => {
    function fakeDb(runAsync: any) {
        return { execAsync: vi.fn(async () => undefined), runAsync };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('returns SQLiteRunResult.changes, not the requested id count', async () => {
        const runAsync = vi.fn(async () => ({ changes: 2, lastInsertRowId: 0 }));
        state.db = fakeDb(runAsync);
        const ledger = new SQLiteLedger();
        await ledger.init();

        const removed = await ledger.deleteByIds(['a', 'b', 'missing']);
        expect(removed).toBe(2);
        const [sql, params] = runAsync.mock.calls[0] as any[];
        expect(sql).toContain('DELETE FROM events WHERE id IN (?,?,?)');
        expect(params).toEqual(['a', 'b', 'missing']);
    });

    it('returns 0 and issues NO delete for an empty id list', async () => {
        const runAsync = vi.fn(async () => ({ changes: 99 }));
        state.db = fakeDb(runAsync);
        const ledger = new SQLiteLedger();
        await ledger.init();

        expect(await ledger.deleteByIds([])).toBe(0);
        expect(runAsync).not.toHaveBeenCalled();
    });

    it('returns 0 when the driver does not report a numeric changes field', async () => {
        const runAsync = vi.fn(async () => undefined);
        state.db = fakeDb(runAsync);
        const ledger = new SQLiteLedger();
        await ledger.init();

        expect(await ledger.deleteByIds(['a'])).toBe(0);
    });

    it('throws instead of reporting a bogus count when the db is not initialized', async () => {
        const ledger = new SQLiteLedger();
        await expect(ledger.deleteByIds(['a'])).rejects.toThrow('Database not initialized');
    });
});
