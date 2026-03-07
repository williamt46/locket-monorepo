import { createPersistentLedger, LedgerStorage } from '@locket/secure-storage';
import * as SecureStore from 'expo-secure-store';
import { UserConfig } from '../models/UserConfig';

const USER_CONFIG_KEY = 'locket_user_config';

let ledger: LedgerStorage | null = null;

export const initStorage = async (): Promise<void> => {
    if (!ledger) {
        ledger = await createPersistentLedger();
    }
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

// ── UserConfig persistence (Onboarding) ─────────────────────────────

export const saveUserConfig = async (config: UserConfig): Promise<void> => {
    await SecureStore.setItemAsync(USER_CONFIG_KEY, JSON.stringify(config));
};

export const getUserConfig = async (): Promise<UserConfig | null> => {
    const raw = await SecureStore.getItemAsync(USER_CONFIG_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as UserConfig;
    } catch {
        return null;
    }
};
