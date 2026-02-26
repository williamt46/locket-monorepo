import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { canonicalStringify } from '@locket/shared';
import { LocketBackupFile } from '../types/BackupTypes';
import { initStorage, loadEvents, getUserConfig, saveUserConfig, rawNukeData, rawSaveEvents } from './StorageService';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const CURRENT_VERSION = 1;

export const CloudBackupService = {
    /**
     * Creates an encrypted .locket backup file envelope.
     * @param masterKeyHex The user's 256-bit master key
     * @returns A JSON string representing the LocketBackupFile
     */
    async createBackup(masterKeyHex: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. Gather all data
                await initStorage();
                const events = await loadEvents();
                const config = await getUserConfig();

                const payload = {
                    events,
                    config
                };

                // 2. Serialize deterministically
                const plaintext = canonicalStringify(payload);

                // 3. Calculate integrity hash on the plaintext
                const hash = QuickCrypto.createHash('sha256');
                hash.update(plaintext);
                const integrityHash = `0x${hash.digest('hex')}`;

                // 4. Generate random DEK (Data Encryption Key)
                const dek = QuickCrypto.randomBytes(32);

                // 5. Encrypt data payload with DEK
                const dataIV = QuickCrypto.randomBytes(IV_LENGTH);
                const dataCipher = QuickCrypto.createCipheriv(ALGORITHM, dek, dataIV);
                let encryptedData = dataCipher.update(plaintext, 'utf8', 'hex');
                encryptedData += dataCipher.final('hex');
                const dataAuthTag = dataCipher.getAuthTag().toString('hex');

                // 6. Wrap DEK with Master Key
                const masterKey = Buffer.from(masterKeyHex, 'hex');
                const dekIV = QuickCrypto.randomBytes(IV_LENGTH);
                const dekCipher = QuickCrypto.createCipheriv(ALGORITHM, masterKey, dekIV);
                let wrappedDEK = dekCipher.update(dek.toString('hex'), 'hex', 'hex');
                wrappedDEK += dekCipher.final('hex');
                const dekAuthTag = dekCipher.getAuthTag().toString('hex');

                // 7. Assemble envelope
                const backupFile: LocketBackupFile = {
                    version: CURRENT_VERSION,
                    createdAt: Date.now(),
                    integrityHash,
                    envelope: {
                        wrappedDEK,
                        dekIV: dekIV.toString('hex'),
                        dekAuthTag: dekAuthTag,
                        dataIV: dataIV.toString('hex'),
                        dataAuthTag: dataAuthTag,
                        encryptedData
                    }
                };

                resolve(JSON.stringify(backupFile, null, 2));

            } catch (e) {
                console.error('[CloudBackupService] Failed to create backup:', e);
                reject(e);
            }
        });
    },

    /**
     * Parses a .locket backup file, decrypts it, and restores it to local storage.
     * @param backupJson The raw JSON string from the .locket file
     * @param masterKeyHex The user's 256-bit master key
     * @returns The number of events restored
     */
    async parseAndRestore(backupJson: string, masterKeyHex: string): Promise<number> {
        return new Promise(async (resolve, reject) => {
            try {
                const backupFile: LocketBackupFile = JSON.parse(backupJson);

                if (backupFile.version > CURRENT_VERSION) {
                    throw new Error(`Unsupported backup version: ${backupFile.version}`);
                }

                const env = backupFile.envelope;
                const masterKey = Buffer.from(masterKeyHex, 'hex');

                // 1. Unwrap the DEK using the Master Key
                const dekIV = Buffer.from(env.dekIV, 'hex');
                const dekAuthTag = Buffer.from(env.dekAuthTag, 'hex');
                const dekDecipher = QuickCrypto.createDecipheriv(ALGORITHM, masterKey, dekIV);
                dekDecipher.setAuthTag(dekAuthTag);

                let dekHex = dekDecipher.update(env.wrappedDEK, 'hex', 'hex');
                dekHex += dekDecipher.final('hex');
                const dek = Buffer.from(dekHex, 'hex');

                // 2. Decrypt the Data payload using the recovered DEK
                const dataIV = Buffer.from(env.dataIV, 'hex');
                const dataAuthTag = Buffer.from(env.dataAuthTag, 'hex');
                const dataDecipher = QuickCrypto.createDecipheriv(ALGORITHM, dek, dataIV);
                dataDecipher.setAuthTag(dataAuthTag);

                let plaintext = dataDecipher.update(env.encryptedData, 'hex', 'utf8');
                plaintext += dataDecipher.final('utf8');

                // 3. Verify Integrity Hash (Defense in depth)
                const hash = QuickCrypto.createHash('sha256');
                hash.update(plaintext);
                const computedHash = `0x${hash.digest('hex')}`;

                if (computedHash !== backupFile.integrityHash) {
                    throw new Error('Backup integrity hash verification failed. The data may have been tampered with or corrupted before encryption.');
                }

                // 4. Parse payload
                const payload = JSON.parse(plaintext);

                if (!payload || !Array.isArray(payload.events)) {
                    throw new Error('Invalid backup payload structure');
                }

                // 5. Restore Config
                if (payload.config) {
                    await saveUserConfig(payload.config);
                }

                // 6. Restore Events (Overwrite mode)
                console.log(`[CloudBackupService] Restoring ${payload.events.length} events...`);
                await rawNukeData();
                if (payload.events.length > 0) {
                    await rawSaveEvents(payload.events);
                }

                resolve(payload.events.length);

            } catch (e: any) {
                console.error('[CloudBackupService] Restore failed:', e.message);
                reject(e);
            }
        });
    }
};
