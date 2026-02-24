import { LocketCryptoService } from '@locket/core-crypto';

const crypto = new LocketCryptoService();

export const generateKey = async () => {
    return await crypto.generateKey();
};

export const encryptData = async (data, keyHex) => {
    return await crypto.encryptData(data, keyHex);
};

export const decryptData = async (encryptedPackage, keyHex) => {
    // Note: new service is async, old call sites might need adjustment
    // but in our refactored screens we use the hook which is handled.
    return await crypto.decryptData(encryptedPackage, keyHex);
};

export const generateIntegrityHash = async (data) => {
    return await crypto.generateIntegrityHash(data);
};
