/**
 * StoragePort — the narrow persistence contract KeyVault depends on.
 *
 * Defined here (not in apps/mobile) so KeyVault stays free of any native-module
 * import. The on-device implementation is a thin adapter over expo-secure-store
 * in apps/mobile; tests use an in-memory adapter. Three methods, nothing more.
 */
export interface StoragePort {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    deleteItem(key: string): Promise<void>;
}

export interface KeyVaultDeps {
    port: StoragePort;
    /**
     * Returns a fresh master key as hex. Injected so KeyVault is agnostic to the
     * crypto implementation and unit-testable without native modules. On-device
     * this is LocketCryptoService.generateKey (32 random bytes, hex).
     */
    generateKey: () => Promise<string>;
    /** SecureStore key alias. Defaults to the existing 'locket_master_key'. */
    keyAlias?: string;
}

const DEFAULT_KEY_ALIAS = 'locket_master_key';

/**
 * Owns the lifecycle of the resident AES master key — the sole Tier-0 secret in
 * the MVP (the Umbral PRE keypair is deferred post-MVP). Storage is abstracted
 * behind StoragePort so identical logic runs on-device and in unit tests.
 *
 * The master key stays resident and is never wrapped on disk; password-based
 * wrapping is confined to the export/import envelope (PR2 S2.3/S2.4).
 */
export class KeyVault {
    private readonly port: StoragePort;
    private readonly generateKey: () => Promise<string>;
    private readonly keyAlias: string;

    constructor(deps: KeyVaultDeps) {
        this.port = deps.port;
        this.generateKey = deps.generateKey;
        this.keyAlias = deps.keyAlias ?? DEFAULT_KEY_ALIAS;
    }

    /** True when a master key is resident. */
    async hasMasterKey(): Promise<boolean> {
        return (await this.port.getItem(this.keyAlias)) != null;
    }

    /** The resident master key (hex), or null if none. */
    async getMasterKey(): Promise<string | null> {
        return this.port.getItem(this.keyAlias);
    }

    /** Return the resident master key, generating + persisting one if absent. */
    async getOrCreateMasterKey(): Promise<string> {
        const existing = await this.port.getItem(this.keyAlias);
        if (existing != null) return existing;
        const key = await this.generateKey();
        await this.port.setItem(this.keyAlias, key);
        return key;
    }

    /**
     * Overwrite the resident master key — e.g. installing one recovered from a
     * backup on a new device (PR2 S2.4 restore rebind). Caller is responsible
     * for ordering this before any decrypt pass.
     */
    async installMasterKey(keyHex: string): Promise<void> {
        await this.port.setItem(this.keyAlias, keyHex);
    }

    /** Crypto-shred: remove the master key so encrypted data becomes unrecoverable. */
    async nukeMasterKey(): Promise<void> {
        await this.port.deleteItem(this.keyAlias);
    }
}
