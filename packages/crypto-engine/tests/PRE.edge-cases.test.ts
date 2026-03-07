/**
 * PRE Edge Cases Test — Boundary conditions and unusual inputs
 */
import { describe, it, expect } from 'vitest';
import { CryptoService } from '../src/CryptoService';

describe('PRE Edge Cases', () => {
    const crypto = new CryptoService();

    it('should handle empty object payload', async () => {
        const owner = await crypto.generateUserKeys();
        const encrypted = await crypto.encryptLocalData({}, owner.publicKeyB64);

        expect(encrypted.anchorHash).toMatch(/^0x[a-f0-9]{64}$/);

        const decrypted = await crypto.decryptOriginalData(
            owner.secretKeyB64,
            encrypted.capsuleB64,
            encrypted.ciphertextB64
        );
        expect(decrypted).toEqual({});
    });

    it('should handle nested object payload', async () => {
        const owner = await crypto.generateUserKeys();
        const nested = {
            level1: {
                level2: {
                    level3: { value: 'deep' },
                },
            },
            array: [1, 2, 3],
        };

        const encrypted = await crypto.encryptLocalData(nested, owner.publicKeyB64);
        const decrypted = await crypto.decryptOriginalData(
            owner.secretKeyB64,
            encrypted.capsuleB64,
            encrypted.ciphertextB64
        );
        expect(decrypted).toEqual(nested);
    });

    it('should handle unicode characters in payload', async () => {
        const owner = await crypto.generateUserKeys();
        const unicodeData = {
            emoji: '🔒🌸📊',
            japanese: 'こんにちは',
            arabic: 'مرحبا',
            special: 'café résumé naïve',
        };

        const encrypted = await crypto.encryptLocalData(unicodeData, owner.publicKeyB64);
        const decrypted = await crypto.decryptOriginalData(
            owner.secretKeyB64,
            encrypted.capsuleB64,
            encrypted.ciphertextB64
        );
        expect(decrypted).toEqual(unicodeData);
    });

    it('should handle large payload (10KB)', async () => {
        const owner = await crypto.generateUserKeys();
        const largeData = {
            entries: Array.from({ length: 100 }, (_, i) => ({
                id: i,
                timestamp: Date.now() + i,
                value: 'x'.repeat(100),
            })),
        };

        const encrypted = await crypto.encryptLocalData(largeData, owner.publicKeyB64);
        const decrypted = await crypto.decryptOriginalData(
            owner.secretKeyB64,
            encrypted.capsuleB64,
            encrypted.ciphertextB64
        );
        expect(decrypted).toEqual(largeData);
    });

    it('should handle null and numeric values', async () => {
        const owner = await crypto.generateUserKeys();
        const mixedData = {
            nullVal: null,
            zero: 0,
            negative: -42,
            float: 3.14159,
            boolTrue: true,
            boolFalse: false,
        };

        const encrypted = await crypto.encryptLocalData(mixedData, owner.publicKeyB64);
        const decrypted = await crypto.decryptOriginalData(
            owner.secretKeyB64,
            encrypted.capsuleB64,
            encrypted.ciphertextB64
        );
        expect(decrypted).toEqual(mixedData);
    });
});
