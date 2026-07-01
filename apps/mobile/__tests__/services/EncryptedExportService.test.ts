import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Native crypto via Node, plus a DETERMINISTIC Argon2id stand-in. Argon2id
// output correctness is the device KAT; here we only need a stable KDF so the
// password -> KEK -> masterKey chain round-trips and wrong passwords diverge.
vi.mock('react-native-quick-crypto', () => ({
    default: {
        randomBytes: (n: number) => crypto.randomBytes(n),
        createHash: (a: string) => crypto.createHash(a),
        createCipheriv: (a: string, k: Buffer, iv: Buffer) => crypto.createCipheriv(a, k, iv),
        createDecipheriv: (a: string, k: Buffer, iv: Buffer) => crypto.createDecipheriv(a, k, iv),
        argon2Sync: (_algo: string, p: any) => {
            const h = crypto.createHash('sha256');
            h.update(Buffer.from(p.message));
            h.update(Buffer.from(p.nonce));
            return h.digest(); // 32 bytes, deterministic per (password, salt)
        },
    },
}));

vi.mock('../../src/services/StorageService', () => ({
    initStorage: vi.fn(),
    getUserConfig: vi.fn().mockResolvedValue({ lastPeriodDate: '2026-02-12', periodLength: 5, cycleLength: 28 }),
    saveUserConfig: vi.fn(),
    loadEvents: vi.fn().mockResolvedValue([
        { id: '1', ts: 1700000000000, payload: 'enc1', status: 'local', signature: 'h1' },
        { id: '2', ts: 1700000050000, payload: 'enc2', status: 'local', signature: 'h2' },
    ]),
    rawSaveEvents: vi.fn(),
    rawNukeData: vi.fn(),
}));

vi.mock('../../src/services/SecureKeyService', () => ({
    SecureKeyService: {
        installKey: vi.fn(),
        getOrGenerateKey: vi.fn(),
        nukeKey: vi.fn(),
    },
}));

import { EncryptedExportService } from '../../src/services/EncryptedExportService';

const MK = crypto.randomBytes(32).toString('hex');
const PW = 'correct-horse-Battery-9';

describe('EncryptedExportService — envelope v2 + version dispatch', () => {
    beforeEach(() => vi.clearAllMocks());

    it('createBackup(password) produces a v2 envelope', async () => {
        const f = JSON.parse(await EncryptedExportService.createBackup(MK, PW));
        expect(f.version).toBe(2);
        expect(f.kdf.salt).toBeDefined();
        expect(f.kdf.params.algorithm).toBe('argon2id');
        expect(f.masterKey.encryptedData).toBeDefined();
        expect(f.dek.encryptedData).toBeDefined();
        expect(f.data.encryptedData).toBeDefined();
    });

    it('createBackup() without a password produces legacy v1', async () => {
        const f = JSON.parse(await EncryptedExportService.createBackup(MK));
        expect(f.version).toBe(1);
        expect(f.envelope.wrappedDEK).toBeDefined();
    });

    it('decodeBackup v2 with the correct password recovers the master key + data', async () => {
        const json = await EncryptedExportService.createBackup(MK, PW);
        const decoded = await EncryptedExportService.decodeBackup(json, { password: PW });
        expect(decoded.version).toBe(2);
        expect(decoded.masterKeyHex).toBe(MK); // recovered from the blob — enables new-device restore
        expect(decoded.events).toHaveLength(2);
        expect(decoded.config).toMatchObject({ cycleLength: 28 });
    });

    it('decodeBackup v2 with the WRONG password fails at master-key unwrap', async () => {
        const json = await EncryptedExportService.createBackup(MK, PW);
        await expect(EncryptedExportService.decodeBackup(json, { password: 'wrong-password-xx' }))
            .rejects.toThrow(/Unsupported state or unable to authenticate data/);
    });

    it('decodeBackup v2 without a password errors clearly', async () => {
        const json = await EncryptedExportService.createBackup(MK, PW);
        await expect(EncryptedExportService.decodeBackup(json, {})).rejects.toThrow(/needs your backup password/);
    });

    it('decodeBackup v1 without a master key errors (same-device only)', async () => {
        const json = await EncryptedExportService.createBackup(MK); // v1
        await expect(EncryptedExportService.decodeBackup(json, {})).rejects.toThrow(/can only be restored on the device that created it/);
    });

    it('fails closed on an unknown/future version', async () => {
        const fake = JSON.stringify({ version: 99, createdAt: 1, integrityHash: '0x' });
        await expect(EncryptedExportService.decodeBackup(fake, { password: PW })).rejects.toThrow(/Unsupported backup version: 99/);
    });

    it('round-trips event identity through v2', async () => {
        const json = await EncryptedExportService.createBackup(MK, PW);
        const decoded = await EncryptedExportService.decodeBackup(json, { password: PW });
        expect(decoded.events.map((e: any) => e.id)).toEqual(['1', '2']);
    });

    it('restoreFromBackup installs the recovered master key BEFORE writing events (the rebind)', async () => {
        const json = await EncryptedExportService.createBackup(MK, PW);
        const { SecureKeyService } = await import('../../src/services/SecureKeyService');
        const storage = await import('../../src/services/StorageService');

        const { count, version } = await EncryptedExportService.restoreFromBackup(json, PW);
        expect(version).toBe(2);
        expect(count).toBe(2);
        expect(SecureKeyService.installKey).toHaveBeenCalledWith(MK);

        // Ordering is the P0 fix: install must precede the event write.
        const installOrder = (SecureKeyService.installKey as any).mock.invocationCallOrder[0];
        const saveOrder = (storage.rawSaveEvents as any).mock.invocationCallOrder[0];
        expect(installOrder).toBeLessThan(saveOrder);
    });

    it('restoreFromBackup with the wrong password installs nothing and writes nothing', async () => {
        const json = await EncryptedExportService.createBackup(MK, PW);
        const { SecureKeyService } = await import('../../src/services/SecureKeyService');
        const storage = await import('../../src/services/StorageService');

        await expect(EncryptedExportService.restoreFromBackup(json, 'wrong-password-99')).rejects.toThrow();
        expect(SecureKeyService.installKey).not.toHaveBeenCalled();
        expect(storage.rawNukeData).not.toHaveBeenCalled();
        expect(storage.rawSaveEvents).not.toHaveBeenCalled();
    });
});
