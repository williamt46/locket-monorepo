import { SQLiteLedger } from '@locket/secure-storage';

const ledger = new SQLiteLedger();

export const initStorage = async () => {
    await ledger.init();
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

export const nukeData = async () => {
    await ledger.nuke();
};
