import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

const store = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
    getItemAsync: async (k: string) => (store.has(k) ? store.get(k)! : null),
    setItemAsync: async (k: string, v: string) => { store.set(k, v); },
    deleteItemAsync: async (k: string) => { store.delete(k); },
}));
vi.mock('@locket/secure-storage', () => ({ createPersistentLedger: vi.fn() }));
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

import { saveUserConfig, getUserConfig, nukeBaseline, resetBaselineCache } from '../../src/services/StorageService';

const CFG = { lastPeriodDate: '2026-02-12', periodLength: 5, cycleLength: 28 };
const USER_CONFIG_KEY = 'locket_user_config';
const BASELINE_KEY = 'locket_baseline_v2';

describe('StorageService — baseline at-rest wrap + shred', () => {
    beforeEach(() => { store.clear(); resetBaselineCache(); });

    it('saveUserConfig writes a wrapped v2 entry (no plaintext); getUserConfig reads it back', async () => {
        await saveUserConfig(CFG);
        expect(store.has(BASELINE_KEY)).toBe(true);
        expect(store.has(USER_CONFIG_KEY)).toBe(false);
        expect(store.get(BASELINE_KEY)).not.toContain('2026-02-12'); // encrypted, not plaintext
        resetBaselineCache(); // force a disk read
        expect(await getUserConfig()).toMatchObject(CFG);
    });

    it('getUserConfig falls back to the legacy plaintext entry', async () => {
        store.set(USER_CONFIG_KEY, JSON.stringify(CFG));
        expect(await getUserConfig()).toMatchObject(CFG);
    });

    it('nukeBaseline deletes both entries — no plaintext baseline left after reset', async () => {
        await saveUserConfig(CFG);
        store.set(USER_CONFIG_KEY, JSON.stringify(CFG)); // stale legacy present too
        await nukeBaseline();
        expect(store.has(BASELINE_KEY)).toBe(false);
        expect(store.has(USER_CONFIG_KEY)).toBe(false);
        resetBaselineCache();
        expect(await getUserConfig()).toBeNull();
    });

    it('a tampered v2 entry fails closed (returns null, no crash)', async () => {
        await saveUserConfig(CFG);
        const env = JSON.parse(store.get(BASELINE_KEY)!);
        env.ct.authTag = 'ff'.repeat(16);
        store.set(BASELINE_KEY, JSON.stringify(env));
        resetBaselineCache();
        expect(await getUserConfig()).toBeNull();
    });
});
