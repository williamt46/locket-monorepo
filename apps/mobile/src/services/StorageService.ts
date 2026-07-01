import { createPersistentLedger, LedgerStorage } from '@locket/secure-storage';
import * as SecureStore from 'expo-secure-store';
import { BaselineCycleData } from '../models/BaselineCycleData';
import { SecureKeyService } from './SecureKeyService';
import { wrapBaseline, unwrapBaseline } from './BaselineCryptoService';

const USER_CONFIG_KEY = 'locket_user_config';   // legacy plaintext (read-only fallback until S3.3 migration)
const BASELINE_KEY = 'locket_baseline_v2';       // AES-GCM-wrapped baseline

// Session cache so the boot path unwraps the baseline at most once (< 50ms goal).
// `undefined` = not loaded yet; `null` = loaded, no baseline present.
let baselineCache: BaselineCycleData | null | undefined = undefined;

// Clear the cache when the master key changes (factory reset, restore rebind).
export const resetBaselineCache = (): void => {
    baselineCache = undefined;
};

let ledger: LedgerStorage | null = null;

export const initStorage = async (): Promise<void> => {
    if (!ledger) {
        ledger = await createPersistentLedger();
    }
};

// Single shared ledger instance. useLedger consumes this instead of building its
// own, so the whole app holds ONE ledger singleton (not one per module).
export const getLedger = async (): Promise<LedgerStorage> => {
    await initStorage();
    return ledger!;
};

// Clear the singleton so the next init() builds a fresh ledger — e.g. after a
// factory reset, so no module keeps a handle to the wiped/old-key ledger.
export const resetLedgerSingleton = (): void => {
    ledger = null;
};

export const saveEvent = async (encryptedEvent: string, assetId: string | null = null): Promise<void> => {
    const record = {
        ts: Date.now(),
        payload: encryptedEvent,
        assetId: assetId,
        status: (assetId ? 'anchored' : 'local') as 'anchored' | 'local'
    };
    await ledger!.saveEvent(record);
};

export const loadEvents = async (): Promise<any[]> => {
    await initStorage();
    if (ledger!.init) await ledger!.init(); // Ensure init
    return await ledger!.loadEvents();
};

// ── Raw Ledger Access (For Backup Restore) ───────────────────────

export const rawSaveEvents = async (records: any[]): Promise<void> => {
    await initStorage();
    if (ledger!.init) await ledger!.init();
    await ledger!.saveEvents(records);
};

export const rawNukeData = async (): Promise<void> => {
    await initStorage();
    if (ledger!.init) await ledger!.init();
    await ledger!.nuke();
};

export const nukeData = async (): Promise<void> => {
    await initStorage();
    if (ledger!.init) await ledger!.init();
    await ledger!.nuke();
};

// ── BaselineCycleData persistence (Onboarding) ─────────────────────────────
// At rest, baseline cycle data is AES-256-GCM-wrapped under HKDF(masterKey,
// 'baseline-cycle-v1') and stored at locket_baseline_v2 — same at-rest posture
// as LogEntry, closing the plaintext-metadata gap. The legacy plaintext
// locket_user_config is read as a fallback (migrated + deleted in S3.3).

export const saveUserConfig = async (config: BaselineCycleData): Promise<void> => {
    const masterKeyHex = await SecureKeyService.getOrGenerateKey();
    const envelope = wrapBaseline(masterKeyHex, config);
    await SecureStore.setItemAsync(BASELINE_KEY, JSON.stringify(envelope));
    baselineCache = config;
};

export const getUserConfig = async (): Promise<BaselineCycleData | null> => {
    if (baselineCache !== undefined) return baselineCache;

    const masterKeyHex = await SecureKeyService.getOrGenerateKey();

    // Preferred: the wrapped v2 entry.
    const wrapped = await SecureStore.getItemAsync(BASELINE_KEY);
    if (wrapped) {
        try {
            baselineCache = unwrapBaseline(masterKeyHex, JSON.parse(wrapped));
            return baselineCache;
        } catch (e) {
            // Tamper or key mismatch. Do NOT silently substitute defaults; surface
            // it. (A user-facing "couldn't verify your cycle settings" banner is a
            // follow-up.) Return null here so boot doesn't crash.
            console.error('[StorageService] baseline unwrap failed (BaselineIntegrityError):', e);
            baselineCache = null;
            return null;
        }
    }

    // Fallback: legacy plaintext entry (migration to v2 happens in S3.3).
    const legacy = await SecureStore.getItemAsync(USER_CONFIG_KEY);
    if (legacy) {
        try {
            baselineCache = JSON.parse(legacy) as BaselineCycleData;
            return baselineCache;
        } catch {
            baselineCache = null;
            return null;
        }
    }

    baselineCache = null;
    return null;
};
