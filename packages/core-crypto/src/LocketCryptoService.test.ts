import { describe, it, expect, vi } from 'vitest';

// Back the GCM primitive with Node's crypto (real AES-256-GCM) so the round-trip
// and auth-tag behavior are exercised for real, just not on the device engine.
vi.mock('react-native-quick-crypto', () => {
    const nodeCrypto = require('crypto');
    return {
        default: {
            randomBytes: nodeCrypto.randomBytes,
            createHash: nodeCrypto.createHash,
            createCipheriv: nodeCrypto.createCipheriv,
            createDecipheriv: nodeCrypto.createDecipheriv,
        },
    };
});

import { LocketCryptoService } from './LocketCryptoService.js';

const KEY = '00'.repeat(32); // 32-byte key, hex

describe('LocketCryptoService — single GCM primitive', () => {
    const c = new LocketCryptoService();

    it('encryptString/decryptString round-trips', () => {
        const pkg = c.encryptString('hello world', KEY);
        expect(pkg.iv).toBeTruthy();
        expect(pkg.authTag).toBeTruthy();
        expect(c.decryptString(pkg, KEY)).toBe('hello world');
    });

    it('decryptString throws on the wrong key (GCM auth)', () => {
        const pkg = c.encryptString('secret', KEY);
        expect(() => c.decryptString(pkg, 'ff'.repeat(32))).toThrow();
    });

    it('decryptString throws on a tampered auth tag', () => {
        const pkg = c.encryptString('secret', KEY);
        expect(() => c.decryptString({ ...pkg, authTag: 'ff'.repeat(16) }, KEY)).toThrow();
    });

    it('encryptData/decryptData round-trips objects through the same primitive', async () => {
        const pkg = await c.encryptData({ a: 1, b: 'x' }, KEY);
        expect(await c.decryptData(pkg, KEY)).toEqual({ a: 1, b: 'x' });
    });

    it('decryptData returns the raw string for non-JSON payloads (key material)', async () => {
        const pkg = c.encryptString('abc123def456', KEY); // a bare hex-ish string, not JSON
        expect(await c.decryptData(pkg, KEY)).toBe('abc123def456');
    });
});
