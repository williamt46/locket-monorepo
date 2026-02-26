import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudBackupService } from '../src/services/CloudBackupService';
import { LocketBackupFile } from '../src/types/BackupTypes';
import crypto from 'crypto';

// 1. Mock the native crypto module using Node's standard crypto library
vi.mock('react-native-quick-crypto', () => ({
    default: {
        randomBytes: (size: number) => crypto.randomBytes(size),
        createHash: (alg: string) => crypto.createHash(alg),
        createCipheriv: (alg: string, key: Buffer, iv: Buffer) => crypto.createCipheriv(alg, key, iv),
        createDecipheriv: (alg: string, key: Buffer, iv: Buffer) => crypto.createDecipheriv(alg, key, iv)
    }
}));

// 2. Mock the Storage Service so we don't hit SQLite/SecureStore
vi.mock('../src/services/StorageService.js', () => ({
    initStorage: vi.fn(),
    getUserConfig: vi.fn().mockResolvedValue({ lastPeriodDate: '2026-02-12', periodLength: 5, cycleLength: 28 }),
    saveUserConfig: vi.fn(),
    loadEvents: vi.fn().mockResolvedValue([
        { id: '1', ts: 1700000000000, payload: 'encrypted_data_1', status: 'local', signature: 'hash1' },
        { id: '2', ts: 1700000050000, payload: 'encrypted_data_2', status: 'local', signature: 'hash2' }
    ]),
    rawSaveEvents: vi.fn(),
    rawNukeData: vi.fn()
}));

const DUMMY_MASTER_KEY = crypto.randomBytes(32).toString('hex');
const WRONG_MASTER_KEY = crypto.randomBytes(32).toString('hex');

describe('CloudBackupService envelope encryption', () => {

    let generatedBackupJson: string;
    let parsedBackupFile: LocketBackupFile;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a valid .locket backup JSON', async () => {
        generatedBackupJson = await CloudBackupService.createBackup(DUMMY_MASTER_KEY);
        expect(generatedBackupJson).toBeDefined();

        parsedBackupFile = JSON.parse(generatedBackupJson);
        expect(parsedBackupFile.version).toBe(1);
        expect(parsedBackupFile.integrityHash).toBeDefined();
        expect(parsedBackupFile.envelope).toBeDefined();
        expect(parsedBackupFile.envelope.wrappedDEK).toBeDefined();
        expect(parsedBackupFile.envelope.encryptedData).toBeDefined();
    });

    it('successfully restores data with the correct master key', async () => {
        const eventsRestored = await CloudBackupService.parseAndRestore(generatedBackupJson, DUMMY_MASTER_KEY);
        expect(eventsRestored).toBe(2);

        const storageService = await import('../src/services/StorageService.js');
        expect(storageService.rawNukeData).toHaveBeenCalled();
        expect(storageService.rawSaveEvents).toHaveBeenCalledWith([
            { id: '1', ts: 1700000000000, payload: 'encrypted_data_1', status: 'local', signature: 'hash1' },
            { id: '2', ts: 1700000050000, payload: 'encrypted_data_2', status: 'local', signature: 'hash2' }
        ]);
        expect(storageService.saveUserConfig).toHaveBeenCalledWith({ lastPeriodDate: '2026-02-12', periodLength: 5, cycleLength: 28 });
    });

    it('fails to restore with the wrong master key', async () => {
        // The AES-GCM auth tag check on the DEK wrapping will fail
        await expect(CloudBackupService.parseAndRestore(generatedBackupJson, WRONG_MASTER_KEY))
            .rejects.toThrow(/Unsupported state or unable to authenticate data/);
    });

    it('detects tampering within the encrypted data payload', async () => {
        const tamperedFile = { ...parsedBackupFile };
        // Flip the last character of the encrypted data
        const lastChar = tamperedFile.envelope.encryptedData.slice(-1);
        const newChar = lastChar === 'a' ? 'b' : 'a';
        tamperedFile.envelope.encryptedData = tamperedFile.envelope.encryptedData.slice(0, -1) + newChar;

        const tamperedJson = JSON.stringify(tamperedFile);

        // The AES-GCM auth tag check on the data payload will fail
        await expect(CloudBackupService.parseAndRestore(tamperedJson, DUMMY_MASTER_KEY))
            .rejects.toThrow(/Unsupported state or unable to authenticate data/);
    });

    it('detects tampering of the integrity hash', async () => {
        // We modify ONLY the integrity hash on a valid file. 
        // AES-GCM decryption will succeed, but the final hash check will fail.
        const tamperedFile = JSON.parse(generatedBackupJson);
        tamperedFile.integrityHash = '0xfffffffbadhash';

        const tamperedJson = JSON.stringify(tamperedFile);

        await expect(CloudBackupService.parseAndRestore(tamperedJson, DUMMY_MASTER_KEY))
            .rejects.toThrow(/Backup integrity hash verification failed/);
    });
});
