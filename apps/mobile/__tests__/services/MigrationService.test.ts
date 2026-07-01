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
});
