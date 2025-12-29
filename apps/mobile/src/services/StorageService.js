import { createPersistentLedger } from '@locket/secure-storage';

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

export const nukeData = async () => {
    await ledger.nuke();
};
