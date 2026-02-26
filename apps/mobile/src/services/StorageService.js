import { createPersistentLedger } from '@locket/secure-storage';
import * as SecureStore from 'expo-secure-store';

const USER_CONFIG_KEY = 'locket_user_config';

let ledger = null;

export const initStorage = async () => {
    if (!ledger) {
        ledger = await createPersistentLedger();
    }
};

export const saveEvent = async (encryptedEvent, assetId = null) => {
    const record = {
        ts: Date.now(),
        payload: encryptedEvent,
        assetId: assetId,
        status: assetId ? 'anchored' : 'local'
    };
    await ledger.saveEvent(record);
};

export const loadEvents = async () => {
    await ledger.init(); // Ensure init
    return await ledger.loadEvents();
};

// ── Raw Ledger Access (For Backup Restore) ───────────────────────

export const rawSaveEvents = async (records) => {
    await ledger.init();
    await ledger.saveEvents(records);
};

export const rawNukeData = async () => {
    await ledger.init();
    await ledger.nuke();
};

export const nukeData = async () => {
    await ledger.nuke();
};

// ── UserConfig persistence (Onboarding) ─────────────────────────────

export const saveUserConfig = async (config) => {
    await SecureStore.setItemAsync(USER_CONFIG_KEY, JSON.stringify(config));
};

export const getUserConfig = async () => {
    const raw = await SecureStore.getItemAsync(USER_CONFIG_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

