import { describe, it, expect, beforeEach } from 'vitest';
import { KeyVault, type StoragePort } from './KeyVault.js';

/**
 * PR2.S2.1 — KeyVault unit tests with a pure in-memory StoragePort.
 * No expo-secure-store, no native modules: this is the payoff of putting the
 * vault in core-crypto behind an injected port + key generator.
 */
function memPort() {
    const store = new Map<string, string>();
    const port: StoragePort = {
        getItem: async (k) => (store.has(k) ? store.get(k)! : null),
        setItem: async (k, v) => { store.set(k, v); },
        deleteItem: async (k) => { store.delete(k); },
    };
    return { port, store };
}

describe('KeyVault (master-key only, in-memory port)', () => {
    let port: StoragePort;
    let store: Map<string, string>;
    let gen: number;
    let vault: KeyVault;

    beforeEach(() => {
        ({ port, store } = memPort());
        gen = 0;
        vault = new KeyVault({ port, generateKey: async () => `key${++gen}` });
    });

    it('generates and persists a key when absent', async () => {
        expect(await vault.hasMasterKey()).toBe(false);
        const key = await vault.getOrCreateMasterKey();
        expect(key).toBe('key1');
        expect(await vault.hasMasterKey()).toBe(true);
        expect(store.get('locket_master_key')).toBe('key1');
    });

    it('returns the existing key without regenerating', async () => {
        const first = await vault.getOrCreateMasterKey();
        const second = await vault.getOrCreateMasterKey();
        expect(second).toBe(first);
        expect(gen).toBe(1); // generated exactly once
    });

    it('installMasterKey overwrites for new-device restore', async () => {
        await vault.getOrCreateMasterKey();
        await vault.installMasterKey('restored-master-key');
        expect(await vault.getMasterKey()).toBe('restored-master-key');
    });

    it('nukeMasterKey crypto-shreds; getOrCreate then mints a fresh key', async () => {
        await vault.getOrCreateMasterKey();           // key1
        await vault.nukeMasterKey();
        expect(await vault.hasMasterKey()).toBe(false);
        expect(await vault.getOrCreateMasterKey()).toBe('key2');
    });

    it('propagates port errors instead of swallowing them', async () => {
        const failing: StoragePort = {
            getItem: async () => { throw new Error('keychain locked'); },
            setItem: async () => {},
            deleteItem: async () => {},
        };
        const v = new KeyVault({ port: failing, generateKey: async () => 'x' });
        await expect(v.getOrCreateMasterKey()).rejects.toThrow('keychain locked');
    });

    it('honors a custom keyAlias', async () => {
        const v = new KeyVault({ port, keyAlias: 'alt_key', generateKey: async () => 'x' });
        await v.getOrCreateMasterKey();
        expect(store.has('alt_key')).toBe(true);
        expect(store.has('locket_master_key')).toBe(false);
    });
});
