import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { canonicalStringify } from '@locket/shared';
import {
    LocketCryptoService,
    deriveKeyFromPassword,
    generateSalt,
    DEFAULT_KDF_PARAMS,
} from '@locket/core-crypto';
import { LocketBackupFileV1, LocketBackupFileV2 } from '../types/BackupTypes';
import {
    initStorage, loadEvents, getUserConfig, saveUserConfig, rawNukeData, rawSaveEvents,
} from './StorageService';

const CURRENT_VERSION = 2;
const gcm = new LocketCryptoService();

function sha256Hex(s: string): string {
    const h = QuickCrypto.createHash('sha256');
    h.update(s);
    return `0x${h.digest('hex')}`;
}

function verifyHash(plaintext: string, expected: string): void {
    if (sha256Hex(plaintext) !== expected) {
        throw new Error('Backup integrity hash verification failed. The data may have been tampered with or corrupted before encryption.');
    }
}

export interface DecodedBackup {
    version: number;
    masterKeyHex: string;
    events: any[];
    config: any;
}

/**
 * Encrypted .locket export/import. The key chain:
 *   v2:  password --Argon2id--> KEK --GCM--> masterKey --GCM--> DEK --GCM--> data
 *   v1:  (device) masterKey --GCM--> DEK --GCM--> data   (same-device only)
 * All GCM goes through the single LocketCryptoService primitive.
 */
export const EncryptedExportService = {
    /**
     * Build an encrypted backup. With a password -> v2 (restorable on a new
     * device). Without -> legacy v1 (same-device only). The export UI passes a
     * password as of PR2 S2.4.
     */
    async createBackup(masterKeyHex: string, password?: string): Promise<string> {
        await initStorage();
        const events = await loadEvents();
        const config = await getUserConfig();
        const plaintext = canonicalStringify({ events, config });
        const integrityHash = sha256Hex(plaintext);

        const dekHex = Buffer.from(QuickCrypto.randomBytes(32)).toString('hex');
        const data = gcm.encryptString(plaintext, dekHex);   // payload under DEK
        const dek = gcm.encryptString(dekHex, masterKeyHex); // DEK under master key

        if (!password) {
            const file: LocketBackupFileV1 = {
                version: 1,
                createdAt: Date.now(),
                integrityHash,
                envelope: {
                    wrappedDEK: dek.encryptedData, dekIV: dek.iv, dekAuthTag: dek.authTag,
                    dataIV: data.iv, dataAuthTag: data.authTag, encryptedData: data.encryptedData,
                },
            };
            return JSON.stringify(file, null, 2);
        }

        const salt = generateSalt();
        const kek = deriveKeyFromPassword(password, salt, DEFAULT_KDF_PARAMS);
        const masterKey = gcm.encryptString(masterKeyHex, kek); // master key under password-KEK
        const file: LocketBackupFileV2 = {
            version: 2,
            createdAt: Date.now(),
            integrityHash,
            kdf: { salt, params: DEFAULT_KDF_PARAMS },
            masterKey,
            dek,
            data,
        };
        return JSON.stringify(file, null, 2);
    },

    /**
     * Decode + verify a backup. Pure — performs NO writes. Version dispatch:
     * v1 needs masterKeyHex (same-device), v2 needs the password. Unknown or
     * future versions fail closed.
     */
    async decodeBackup(
        backupJson: string,
        opts: { password?: string; masterKeyHex?: string },
    ): Promise<DecodedBackup> {
        let file: LocketBackupFileV1 | LocketBackupFileV2;
        try {
            file = typeof backupJson === 'string' ? JSON.parse(backupJson) : (backupJson as any);
        } catch {
            throw new Error('Failed to parse backup JSON');
        }

        switch (file.version) {
            case 1: {
                if (!opts.masterKeyHex) {
                    throw new Error('This backup can only be restored on the device that created it.');
                }
                const env = file.envelope;
                const dekHex = gcm.decryptString(
                    { iv: env.dekIV, encryptedData: env.wrappedDEK, authTag: env.dekAuthTag },
                    opts.masterKeyHex,
                );
                const plaintext = gcm.decryptString(
                    { iv: env.dataIV, encryptedData: env.encryptedData, authTag: env.dataAuthTag },
                    dekHex,
                );
                verifyHash(plaintext, file.integrityHash);
                const payload = JSON.parse(plaintext);
                return { version: 1, masterKeyHex: opts.masterKeyHex, events: payload.events, config: payload.config };
            }
            case 2: {
                if (!opts.password) {
                    throw new Error('This backup needs your backup password.');
                }
                const kek = deriveKeyFromPassword(opts.password, file.kdf.salt, file.kdf.params);
                const masterKeyHex = gcm.decryptString(file.masterKey, kek); // wrong password fails here (GCM)
                const dekHex = gcm.decryptString(file.dek, masterKeyHex);
                const plaintext = gcm.decryptString(file.data, dekHex);
                verifyHash(plaintext, file.integrityHash);
                const payload = JSON.parse(plaintext);
                return { version: 2, masterKeyHex, events: payload.events, config: payload.config };
            }
            default:
                // Fail closed: never guess at an unknown/future envelope shape.
                throw new Error(`Unsupported backup version: ${(file as any).version}`);
        }
    },

    /**
     * v1 same-device restore (legacy). Side-effecting: overwrites local events +
     * config. v2 password-restore with master-key rebind is wired in PR2 S2.4.
     */
    async parseAndRestore(backupJson: string, masterKeyHex: string): Promise<number> {
        const { events, config } = await this.decodeBackup(backupJson, { masterKeyHex });
        if (!Array.isArray(events)) {
            throw new Error('Invalid backup payload structure');
        }
        if (config) {
            await saveUserConfig(config);
        }
        await rawNukeData();
        if (events.length > 0) {
            await rawSaveEvents(events);
        }
        return events.length;
    },
};
