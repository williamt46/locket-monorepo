import * as FileSystem from 'expo-file-system/legacy';

const DATA_DIR = `${FileSystem.documentDirectory}locket_data/`;
const DATA_FILE = `${DATA_DIR}events.json`;

/**
 * Initializes the storage directory.
 */
export const initStorage = async () => {
    const dirInfo = await FileSystem.getInfoAsync(DATA_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true });
    }
};

/**
 * Saves an encrypted event blob to local file system.
 * Appends to an array of events.
 * @param {Object} encryptedEvent 
 * @param {String} assetId (Optional) The anchor ID on blockchain
 */
export const saveEvent = async (encryptedEvent, assetId = null) => {
    await initStorage();
    
    let existingData = [];
    const fileInfo = await FileSystem.getInfoAsync(DATA_FILE);
    
    if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(DATA_FILE);
        existingData = JSON.parse(content);
    }

    // Add timestamp for local sorting (metadata leak acceptable for local)
    const record = {
        ts: Date.now(),
        payload: encryptedEvent,
        assetId: assetId
    };

    existingData.push(record);
    
    await FileSystem.writeAsStringAsync(DATA_FILE, JSON.stringify(existingData));
    console.log('[Storage] Saved event locally.');
};

/**
 * Reads all local events.
 */
export const loadEvents = async () => {
    const fileInfo = await FileSystem.getInfoAsync(DATA_FILE);
    if (!fileInfo.exists) return [];
    
    const content = await FileSystem.readAsStringAsync(DATA_FILE);
    return JSON.parse(content);
};

/**
 * Crypto-Shredding: Deletes the file.
 * (In a real scenario, we would also overwrite bytes).
 */
export const nukeData = async () => {
    await FileSystem.deleteAsync(DATA_FILE, { idempotent: true });
    console.log('[Storage] Data Nuked.');
};
