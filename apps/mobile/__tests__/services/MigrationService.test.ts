import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// In-memory SecureStore shared by the mock and the assertions.
const store = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
    getItemAsync: async (k: string) => (store.has(k) ? store.get(k)! : null),
    setItemAsync: async (k: string, v: string) => { store.set(k, v); },
    deleteItemAsync: async (k: string) => { store.delete(k); },
}));

vi.mock('../../src/services/SecureKeyService', () => ({
    SecureKeyService: { getOrGenerateKey: async () => 'ab'.repeat(32) },
}));

vi.mock('react-native-quick-crypto', () => ({
    default: {
        randomBytes: (n: number) => crypto.randomBytes(n),
        createCipheriv: (a: string, k: Buffer, iv: Buffer) => crypto.createCipheriv(a, k, iv),
        createDecipheriv: (a: string, k: Buffer, iv: Buffer) => crypto.createDecipheriv(a, k, iv),
        hkdfSync: (d: string, k: any, s: any, i: any, l: number) => crypto.hkdfSync(d, k, s, i, l),
    },
}));

import { runMigrations, resetMigrationFlag } from '../../src/services/MigrationService';
import { unwrapBaseline } from '../../src/services/BaselineCryptoService';

const MK = 'ab'.repeat(32);
const LEGACY = { lastPeriodDate: '2026-02-12', periodLength: 5, cycleLength: 28 };
const USER_CONFIG_KEY = 'locket_user_config';
const BASELINE_KEY = 'locket_baseline_v2';

describe('MigrationService — legacy plaintext baseline → locket_baseline_v2', () => {
    beforeEach(() => { store.clear(); resetMigrationFlag(); });

    it('fresh install: no legacy, no v2 → writes nothing', async () => {
        await runMigrations();
        expect(store.size).toBe(0);
    });

    it('migrates legacy plaintext, then deletes it; v2 unwraps to the same data', async () => {
        store.set(USER_CONFIG_KEY, JSON.stringify(LEGACY));
        await runMigrations();

        expect(store.has(USER_CONFIG_KEY)).toBe(false);        // plaintext gone
        expect(store.has(BASELINE_KEY)).toBe(true);            // wrapped written
        expect(store.get(BASELINE_KEY)).not.toContain('2026-02-12'); // not plaintext
        const env = JSON.parse(store.get(BASELINE_KEY)!);
        expect(unwrapBaseline(MK, env)).toMatchObject(LEGACY);
    });

    it('is idempotent: re-run after migration is a no-op (does not re-wrap)', async () => {
        store.set(USER_CONFIG_KEY, JSON.stringify(LEGACY));
        await runMigrations();
        const firstV2 = store.get(BASELINE_KEY);

        resetMigrationFlag(); // simulate a fresh launch
        await runMigrations();
        expect(store.get(BASELINE_KEY)).toBe(firstV2);         // unchanged
        expect(store.has(USER_CONFIG_KEY)).toBe(false);
    });

    it('crash recovery: v2 present AND stale legacy → deletes the stale plaintext', async () => {
        // Simulate a crash last run: v2 written but legacy not yet deleted.
        store.set(USER_CONFIG_KEY, JSON.stringify(LEGACY));
        store.set(BASELINE_KEY, 'PRE_EXISTING_V2');
        await runMigrations();

        expect(store.has(USER_CONFIG_KEY)).toBe(false);        // stale plaintext removed
        expect(store.get(BASELINE_KEY)).toBe('PRE_EXISTING_V2'); // existing v2 NOT re-wrapped
    });

    it('unparseable legacy entry: does not destroy it, does not write v2, never throws', async () => {
        store.set(USER_CONFIG_KEY, '{not valid json');
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(runMigrations()).resolves.toBeUndefined(); // never throws to caller

        expect(store.get(USER_CONFIG_KEY)).toBe('{not valid json'); // untouched
        expect(store.has(BASELINE_KEY)).toBe(false);                // no v2 written
        expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('legacy baseline unparseable; skipping'));
        errSpy.mockRestore();
    });

    it('verify read-fails after write: legacy is preserved, failure is swallowed (retried next launch)', async () => {
        store.set(USER_CONFIG_KEY, JSON.stringify(LEGACY));
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Simulate the SecureStore write silently not landing: after setItemAsync
        // writes BASELINE_KEY, immediately delete it so the verify-read finds nothing.
        const secureStore = await import('expo-secure-store');
        const originalSet = (secureStore as any).setItemAsync;
        (secureStore as any).setItemAsync = async (k: string, v: string) => {
            await originalSet(k, v);
            if (k === BASELINE_KEY) store.delete(k); // sabotage the verify read
        };

        await expect(runMigrations()).resolves.toBeUndefined(); // caught, never throws

        expect(store.has(USER_CONFIG_KEY)).toBe(true); // legacy preserved — NOT deleted
        expect(errSpy).toHaveBeenCalledWith(
            '[Migration] baseline migration failed; legacy entry preserved',
            expect.objectContaining({ message: expect.stringContaining('verify read failed after write') }),
        );

        (secureStore as any).setItemAsync = originalSet;
        errSpy.mockRestore();
    });

    it('verify mismatch after round-trip: legacy is preserved, failure is swallowed', async () => {
        store.set(USER_CONFIG_KEY, JSON.stringify(LEGACY));
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Corrupt the verify-read only: after the wrapped v2 entry is written for
        // real, swap in an envelope wrapping a DIFFERENT config (divergent
        // cycleLength) so the migration's own round-trip compare fails, without
        // touching the two initial reads (wrapped/legacy existence checks).
        const secureStore = await import('expo-secure-store');
        const { wrapBaseline } = await import('../../src/services/BaselineCryptoService');
        const originalGet = (secureStore as any).getItemAsync;
        let getCalls = 0;
        (secureStore as any).getItemAsync = async (k: string) => {
            getCalls += 1;
            // Calls 1-2 are the initial wrapped/legacy existence checks; call 3
            // is the post-write verify-read for BASELINE_KEY — return a mismatch.
            if (k === BASELINE_KEY && getCalls === 3) {
                return JSON.stringify(wrapBaseline(MK, { ...LEGACY, cycleLength: 999 }));
            }
            return originalGet(k);
        };

        await expect(runMigrations()).resolves.toBeUndefined(); // caught, never throws

        expect(store.has(USER_CONFIG_KEY)).toBe(true); // legacy preserved — NOT deleted
        expect(errSpy).toHaveBeenCalledWith(
            '[Migration] baseline migration failed; legacy entry preserved',
            expect.objectContaining({ message: expect.stringContaining('verify mismatch') }),
        );

        (secureStore as any).getItemAsync = originalGet;
        errSpy.mockRestore();
    });
});
