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

const state = vi.hoisted(() => ({ resolved: null as any }));

vi.mock('expo', () => ({
    requireOptionalNativeModule: vi.fn((name: string) => state.resolved),
}));

vi.mock('expo-sqlite', () => ({
    openDatabaseAsync: vi.fn(),
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
